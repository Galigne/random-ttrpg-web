const test = require("node:test");
const assert = require("node:assert/strict");
const previews = require("../server/generator-previews");
const rpg = require("../server/rpg");
const catalog = require("../rpg/services/generatorCatalog");
const { GenerationDraft } = require("../rpg/services/generationDraft");
const Character = require("../rpg/models/Character");
const Creature = require("../rpg/models/Creature");
const { populateRandomCharacter } = require("../rpg/services/randomCharacterGenerator");
const { populateRandomCreature } = require("../rpg/services/randomCreatureGenerator");
const { allocateRuleLevels, calculateRulePoints, calculateTalentCount } = require("../rpg/services/mechanics/characterGeneration");
const { getArmorPercentage, calculateArmorRating, canEquipArmor } = require("../rpg/services/mechanics/armor");
const { calculateMaxHp, calculateMaxAp, calculateMaxMovementDistance } = require("../rpg/services/mechanics/resources");

function seededRandom(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
function change(preview, key, value) {
  return previews.build(preview.type, preview.options, preview, { key, value });
}
function alternative(preview, key) {
  return preview.draft.options(key).find(entry => entry.id !== preview.draft.records.get(key).value).id;
}

test("recording a preview consumes the same weighted rolls as ordinary generation", () => {
  for (const [Entity, populate] of [[Character, populateRandomCharacter], [Creature, populateRandomCreature]]) {
    for (let seed = 0; seed < 24; seed++) {
      const locale = seed % 2 === 0 ? "en" : "fr";
      const ordinary = populate(new Entity("same"), { locale, random: seededRandom(seed) });
      const recorded = populate(new Entity("same"), { locale, random: seededRandom(seed), draft: new GenerationDraft() });
      assert.deepEqual(recorded, ordinary);
    }
  }
});

test("a race choice replaces the complete race and repairs only conflicting hybrid ancestry", () => {
  for (const language of ["en", "fr"]) {
    let p = previews.build("character", { language, level: 6 });
    p = change(p, "root.character.modifier.presence", "yes");
    p = change(p, "root.character.modifier", "race_hybrid");
    const hybrid = p.controls.find(c => c.key.startsWith("root.character.modifier.fields.description.references"));
    const excluded = p.draft.records.get(hybrid.key).value;
    const next = change(p, "root.character.race", excluded);
    const entry = catalog.getGenerator("race", language).entries.find(e => e.id === excluded);
    assert.equal(next.data.race.name, entry.name);
    assert.equal(next.data.race.physicalDescription, rpg.generate(`race:${excluded}.description`, language).display);
    assert.notEqual(next.draft.records.get(hybrid.key).value, excluded);
    assert.equal(next.data.status.modifiers[0].entryId, "race_hybrid");
    for (const key of ["name", "background", "personality", "statistics", "resources", "rules", "gear", "talents"])
      assert.deepEqual(next.data[key], p.data[key]);
    const human = change(next, "root.character.race", "human");
    const fields = catalog.getGenerator("race", language).entries.find(e => e.id === "human").fields;
    assert.deepEqual(human.data.race.traits, { skillBonus: fields.skill_bonus, physicalAbility: fields.physical_ability });
  }
});

test("changing a list entry preserves its siblings and level changes use the canonical budgets", () => {
  let p = previews.build("character", { language: "en", level: 6 });
  for (const [key, entries] of [["personality", p => p.data.personality.traits], ["talents", p => p.data.talents]]) {
    const slot = `root.character.${key}.0`;
    const replacement = alternative(p, slot);
    const next = change(p, slot, replacement);
    assert.deepEqual(entries(next).slice(1), entries(p).slice(1));
    assert.ok(!next.draft.options(slot).some(item => item.id === next.draft.records.get(`root.character.${key}.1`).value));
    p = next;
  }
  const raised = change(p, "level", "10");
  assert.equal(raised.data.talents.length, calculateTalentCount(10));
  assert.deepEqual(raised.data.talents.slice(0, p.data.talents.length), p.data.talents);
  assert.deepEqual(raised.data.rules.map(rule => rule.level), allocateRuleLevels(calculateRulePoints(raised.data.statistics.intelligence)));
  assert.equal(raised.data.resources.hp.max, calculateMaxHp(raised.data.statistics.constitution, 10));
  assert.equal(raised.data.resources.ap.max, calculateMaxAp(10));
  assert.equal(raised.data.resources.md.max, calculateMaxMovementDistance(raised.data.statistics.speed));
  for (const armor of raised.draft.options("root.character.armor")) {
    const entry = catalog.getGenerator("armors").entries.find(e => e.id === armor.id);
    assert.ok(canEquipArmor(raised.data.statistics.constitution, entry.fields.type));
  }
  assert.deepEqual(raised.data.gear.inventory.slice(0, -1), p.data.gear.inventory.slice(0, -1));
  assert.deepEqual(change(raised, "level", "6").data.statistics, p.data.statistics);
});

test("a reduced talent allowance keeps a manually selected trailing talent and its resolved properties", () => {
  const p = previews.build("character", { language: "fr", level: 10 });
  const slot = "root.character.talents.3";
  const selected = change(p, slot, alternative(p, slot));
  const reduced = change(selected, "level", "1");
  assert.deepEqual(reduced.data.talents, [selected.data.talents[3]]);
  assert.deepEqual(reduced.data.personality, p.data.personality);
});

test("creature equipment updates armor rating and provenance, and intrinsic RULEs follow the archetype", () => {
  let p = previews.build("creature", { language: "fr", path: "monster:bell_wraith", level: 4 });
  p = change(p, "root.generation.armor", "leather_armor");
  const next = change(p, "root.generation.armor.modifiers.0.modifier_rarity", "legendary");
  assert.equal(next.data.resources.ar.max, calculateArmorRating(next.data.resources.hp.max, getArmorPercentage("light", "legendary")));
  assert.equal(next.data.resources.ar.current, next.data.resources.ar.max);
  assert.deepEqual(next.data.gear.equipment.slice(1), p.data.gear.equipment.slice(1));
  assert.deepEqual(next.data.rules, p.data.rules);
  assert.ok(next.data.source.provenance.some(r => r.generatorId === "armors" && r.entryId === "leather_armor"));
  const drake = change(next, "archetype", "cinder_drake");
  const source = catalog.getGenerator("monster", "fr").entries.find(e => e.id === "cinder_drake");
  assert.equal(drake.data.name, source.name);
  assert.ok(source.generation.statProfiles.some(profile => profile.id === drake.data.source.statProfileId));
  assert.deepEqual(drake.data.rules.map(r => [r.entryId, r.level]), source.generation.fixedRules.map(r => [r.entry, r.level]));
  assert.equal(drake.data.resources.ar.max, calculateArmorRating(drake.data.resources.hp.max, source.generation.naturalArmorPercentage));
  assert.ok(!drake.controls.some(c => c.key === "root.generation.armor"));
});

test("catalog-backed creature traits can be replaced separately and replay keeps their resolved text", () => {
  const p = previews.build("creature", { language: "en", path: "animal:river_otter" });
  const next = change(p, "root.generation.traits.0", "keen_smell");
  assert.match(next.data.traits[0], /Keen Smell/);
  assert.deepEqual(next.data.traits.slice(1), p.data.traits.slice(1));
  assert.deepEqual(next.data.statistics, p.data.statistics);
  assert.deepEqual(change(next, "level", String(p.data.level)).data, next.data);
  assert.throws(() => change(next, "root.generation.traits.0", "free text"), /INVALID_GENERATION_CHOICE/);
});

test("character profile and statistic controls preserve independent choices and recalculate mechanics", () => {
  for (const language of ["en", "fr"]) {
    let p = previews.build("character", { language, path: "criminal:bandit", level: 6 });
    p = change(p, "statProfile", "character-fighter");
    p = change(p, "root.character.talents.0", alternative(p, "root.character.talents.0"));
    const before = p;
    assert.deepEqual(p.draft.options("statProfile").map(option => option.id),
      ["character-fighter", "character-rogue", "character-mage", "default"]);
    assert.throws(() => change(p, "statProfile", "creature-brute"), /INVALID_GENERATION_CHOICE/);
    p = change(p, "statProfile", "character-mage");
    assert.equal(p.draft.records.get("statProfile").value, "character-mage");
    for (const key of ["name", "race", "background", "personality", "talents", "status"])
      assert.deepEqual(p.data[key], before.data[key], key);
    assert.deepEqual(p.data.gear.inventory, before.data.gear.inventory);
    assert.equal(p.data.resources.hp.max, calculateMaxHp(p.data.statistics.constitution, 6));
    assert.equal(p.data.resources.md.max, calculateMaxMovementDistance(p.data.statistics.speed));
    assert.deepEqual(p.data.rules.map(rule => rule.level), allocateRuleLevels(calculateRulePoints(p.data.statistics.intelligence)));
    assert.ok(p.changed.some(item => item.label === "character.fields.statistics"));
    const armor = p.draft.records.get("root.character.armor");
    if (armor) {
      const type = catalog.getGenerator("armors", language).entries.find(e => e.id === armor.value).fields.type;
      assert.ok(canEquipArmor(p.data.statistics.constitution, type));
    }
    const rerolled = change(p, "statistics");
    assert.equal(rerolled.draft.records.get("statProfile").value, "character-mage");
    assert.deepEqual(rerolled.data.talents, p.data.talents);
    assert.deepEqual(rerolled.data.background, p.data.background);
    assert.deepEqual(rerolled.data.gear.inventory, p.data.gear.inventory);
    assert.deepEqual(rerolled.data.rules.map(rule => rule.level), allocateRuleLevels(calculateRulePoints(rerolled.data.statistics.intelligence)));
  }
});

test("creature profile changes keep intrinsic properties and fixed RULEs even at low Intelligence", () => {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    for (const language of ["en", "fr"]) {
      let p = previews.build("creature", { language, path: "monster:bell_wraith", level: 1 });
      const before = p;
      p = change(p, "statProfile", "creature-brute");
      assert.ok(p.data.statistics.intelligence < 10);
      assert.deepEqual(p.data.rules, before.data.rules);
      assert.equal(p.data.rules[0].entryId, "echo_rule");
      for (const key of ["name", "description", "traits", "status", "gear"])
        assert.deepEqual(p.data[key], before.data[key], key);
      assert.equal(p.data.source.statProfileId, "creature-brute");
      const rerolled = change(p, "statistics");
      assert.deepEqual(rerolled.data.rules, p.data.rules);
      assert.deepEqual(rerolled.data.gear, p.data.gear);
      assert.equal(rerolled.data.source.statProfileId, "creature-brute");
    }
  } finally { Math.random = originalRandom; }
});

test("archetype changes retain an eligible manual profile and replace an ineligible one", () => {
  for (const language of ["en", "fr"]) {
    let p = previews.build("creature", { language, path: "monster:bell_wraith", level: 4 });
    p = change(p, "statProfile", "creature-elemental");
    const drake = change(p, "archetype", "cinder_drake");
    assert.equal(drake.data.source.statProfileId, "creature-elemental");
    assert.equal(drake.data.rules[0].entryId, "elemental_rule");
    assert.notDeepEqual(drake.data.traits, p.data.traits);
    const hound = change(drake, "archetype", "grave_hound");
    assert.ok(hound.draft.options("statProfile").some(option => option.id === hound.data.source.statProfileId));
    assert.notEqual(hound.data.source.statProfileId, "creature-elemental");
    assert.ok(hound.changed.some(item => item.message === "profileChanged"));
    assert.deepEqual(hound.data.rules, []);
    assert.throws(() => change(hound, "statProfile", "creature-elemental"), /INVALID_GENERATION_CHOICE/);
    const animal = change(hound, "archetype.route0", "animal");
    assert.equal(animal.data.source.generatorId, "animal");
    assert.ok(animal.draft.options("statProfile").some(option => option.id === animal.data.source.statProfileId));
  }
});

test("automatic armor removal is called out when a profile lowers Constitution", () => {
  const originalRandom = Math.random;
  Math.random = () => 0.999;
  try {
    let p = previews.build("character", { language: "en", path: "criminal:bandit", level: 1 });
    p = change(p, "statProfile", "character-fighter");
    assert.ok(p.draft.records.has("root.character.armor"));
    const next = change(p, "statProfile", "character-mage");
    assert.ok(!next.draft.records.has("root.character.armor"));
    assert.ok(next.changed.some(item => item.message === "armorRemoved"));
  } finally { Math.random = originalRandom; }
});

test("a profile change keeps a manually chosen RULE when the Intelligence allowance shrinks", () => {
  const originalRandom = Math.random;
  Math.random = seededRandom(123);
  try {
    let p = previews.build("character", { language: "en", path: "criminal:bandit", level: 6 });
    p = change(p, "statProfile", "character-mage");
    assert.equal(p.data.rules.length, 2);
    p = change(p, "root.character.rules.1", alternative(p, "root.character.rules.1"));
    const selected = p.data.rules[1].name;
    const next = change(p, "statProfile", "character-fighter");
    assert.equal(next.data.rules.length, 1);
    assert.equal(next.data.rules[0].name, selected);
  } finally { Math.random = originalRandom; }
});
