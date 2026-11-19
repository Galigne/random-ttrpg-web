const test = require("node:test");
const assert = require("node:assert/strict");
const Character = require("../rpg/models/Character");
const { createGeneratorResolver } = require("../rpg/services/generatorResolver");
const { populateRandomCharacter } = require("../rpg/services/randomCharacterGenerator");

function fixtureResolver(locale) {
  const words = locale === "fr" ? ["un", "deux"] : ["one", "two"];
  const generator = (id, entries, required = []) => ({
    id, name: id, visibility: "public", entrySchema: { required }, entries,
  });
  const generators = [
    generator("outer", [{ id: "one", name: "Start {{ middle:one.description }}; {{ middle:one.name }}" }]),
    generator("middle", [{
      id: "one", name: "{{ leaf:one.name }}",
      fields: { description: "See {{ leaf:one.description }}", amount: 7, enabled: true },
    }], ["description", "amount", "enabled"]),
    generator("leaf", [{
      id: "one", name: "{{ word:first.name }}",
      fields: { description: "{{ word:second.name }}" },
    }], ["description"]),
    generator("word", [
      { id: "first", name: words[0] },
      { id: "second", name: words[1], weight: 3 },
    ]),
    generator("router", [{ id: "route", name: "Route", generator: "leaf" }]),
    generator("routed", [{ id: "one", name: "{{ router:route.generator:one.description }}" }]),
    generator("repeat", [{ id: "one", name: "{{ word.name }} / {{ word.name }}" }]),
    generator("loop_a", [{ id: "one", name: "{{ loop_b.name }}" }]),
    generator("loop_b", [{ id: "one", name: "{{ loop_a.name }}" }]),
    ...Array.from({ length: 6 }, (_, index) => generator(`depth_${index + 1}`, [{
      id: "one", name: index === 5 ? "end" : `{{ depth_${index + 2}.name }}`,
    }])),
  ];
  const byId = new Map(generators.map((item) => [item.id, item]));
  return createGeneratorResolver({
    getGenerator: (id) => byId.get(id),
    listGenerators: () => generators,
  });
}

test("nested references resolve selected fields and routes in both languages", () => {
  for (const locale of ["en", "fr"]) {
    const resolver = fixtureResolver(locale);
    const result = resolver.generate("outer:one", locale, { random: () => 0 });
    assert.equal(result.value, locale === "fr" ? "Start See deux; un" : "Start See two; one");
    assert.deepEqual(result.provenance.map((item) => item.generatorId), [
      "outer", "middle", "leaf", "word", "middle", "leaf", "word",
    ]);
    const routed = resolver.generate("routed:one", locale, { random: () => 0 });
    assert.equal(routed.value, locale === "fr" ? "deux" : "two");
    assert.deepEqual(routed.provenance.map((item) => item.generatorId), [
      "routed", "router", "leaf", "word",
    ]);
    assert.equal(
      resolver.resolveReference("middle:one.description", locale, { random: () => 0 }).display,
      locale === "fr" ? "See deux" : "See two",
    );
  }
});

test("weighted field references expose resolved text while retaining non-text types and source fields", () => {
  for (const locale of ["en", "fr"]) {
    const resolver = fixtureResolver(locale);
    const result = resolver.resolveReference({
      generator: { oneOf: [{ id: "middle", weight: 2 }] },
      select: "fields",
    }, locale, { random: () => 0 });
    assert.deepEqual(result.value, {
      name: locale === "fr" ? "un" : "one",
      description: locale === "fr" ? "See deux" : "See two",
      amount: 7,
      enabled: true,
    });
    assert.equal(result.fields.name, "{{ leaf:one.name }}");
    assert.equal(result.fields.description, "See {{ leaf:one.description }}");
  }
});

test("repeated random references select independently with their original weights", () => {
  const resolver = fixtureResolver("en");
  const rolls = [0, 0.99];
  const result = resolver.generate("repeat:one", "en", { random: () => rolls.shift() });
  assert.equal(result.value, "one / two");
  assert.deepEqual(result.provenance.filter((item) => item.generatorId === "word")
    .map((item) => item.entryId), ["first", "second"]);
  assert.equal(rolls.length, 0);
});

test("cycles, excessive depth and invalid references fail safely", () => {
  const resolver = fixtureResolver("en");
  assert.equal(resolver.generate("depth_2:one", "en", { random: () => 0 }).value, "end");
  assert.throws(() => resolver.generate("loop_a:one", "en", { random: () => 0 }), {
    code: "GENERATOR_REFERENCE_CYCLE",
  });
  assert.throws(() => resolver.generate("depth_1:one", "en", { random: () => 0 }), {
    code: "GENERATOR_MAX_DEPTH_EXCEEDED",
  });
  for (const expression of ["{{ missing.name }}", "{{ word:missing }}", "{{ word.unknown }}"]) {
    assert.throws(() => resolver.resolveInlineString(expression, "en"), {
      code: "INVALID_GENERATOR_REFERENCE_PATH",
    });
  }
  assert.throws(() => resolver.resolveInlineString("broken {{ word.name", "en"), {
    code: "INVALID_GENERATOR_INLINE_REFERENCE",
  });
  assert.throws(() => resolver.resolveReference("word.name", "en", {
    fixedEntryIdsByGenerator: { word: "missing" },
  }), { code: "INVALID_GENERATOR_REFERENCE_PATH" });
  assert.equal(resolver.resolveReference("word:first.name", "en").display, "one");
});

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test("generated characters resolve race bonuses and elemental rules in both languages", () => {
  for (const locale of ["en", "fr"]) {
    const character = populateRandomCharacter(new Character("test"), {
      locale, level: 5, random: seededRandom(1),
    });
    assert.equal(character.race.traits.skillBonus, locale === "fr"
      ? "Pistage par les traces, la chaleur et les odeurs."
      : "Tracking through marks, heat, and scent.");
    assert.equal(character.rules[0].name, locale === "fr" ? "LOI élémentaire : Givre" : "Frost RULE");
    assert.doesNotMatch(JSON.stringify(character), /\{\{/);
  }
});
