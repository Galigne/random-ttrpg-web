const test = require("node:test");
const assert = require("node:assert/strict");
const rpg = require("../server/rpg");
const { rollDiceExpression } = require("../rpg/services/diceRollService");
const { initializeGenerationData } = require("../rpg/services/generationData");

test("the original catalog loads both locales and supports routed and fixed generation", () => {
  initializeGenerationData();
  for (const language of ["en", "fr"]) {
    assert.ok(rpg.browse("", language).roots.length > 5);
    assert.ok(rpg.browse("creature", language).candidates.length > 0);
    const result = rpg.generate("creature:monster", language);
    assert.ok(result.display);
    assert.ok(result.provenance.some((entry) => entry.selection === "fixed"));
    const character = rpg.createEntity("character", {
      random: true,
      language,
      level: 3,
    });
    const creature = rpg.createEntity("creature", {
      random: true,
      language,
      level: 4,
    });
    assert.equal(character.level, 3);
    assert.equal(creature.level, 4);
    assert.doesNotThrow(() => rpg.hydrate("character", character));
    assert.doesNotThrow(() => rpg.hydrate("creature", creature));
  }
});

test("turn recovery carries half of unused AP and permits editing creature resources", () => {
  const creature = rpg.createEntity("creature");
  creature.resources.ap = { current: 3, max: 4 };
  creature.resources.md = { current: 1, max: 5 };
  const recovered = rpg.combat("creature", creature, "end-turn", {}).data;
  assert.equal(recovered.resources.ap.current, 5);
  assert.equal(recovered.resources.md.current, 5);
  const edited = rpg.edit("creature", recovered, "resources", {
    "resources.hp": `${recovered.resources.hp.current}:${recovered.resources.hp.max}`,
    "resources.ar": `${recovered.resources.ar.current}:${recovered.resources.ar.max}`,
    "resources.ap": "5:4", "resources.md": "2:5",
  });
  assert.equal(edited.resources.ap.current, 5);
  assert.equal(edited.resources.md.current, 2);
});
test("dice preserve the source parser limits and animations include modifiers", () => {
  assert.throws(() => rollDiceExpression("1d20+1d6"), {
    code: "INVALID_FORMAT",
  });
  assert.throws(() => rollDiceExpression("101d6"), {
    code: "DICE_COUNT_OUT_OF_RANGE",
  });
  assert.throws(() => rollDiceExpression("1d1001"), {
    code: "DICE_SIDES_OUT_OF_RANGE",
  });
  for (let i = 0; i < 20; i++) {
    const roll = rpg.roll("1d20+3");
    assert.equal(roll.total, roll.rolls[0] + 3);
    assert.equal(roll.animation, `D20-${roll.rolls[0]}.gif`);
    const coin = rpg.roll("1d2-1");
    assert.ok(["HEADS.gif", "TAILS.gif"].includes(coin.animation));
  }
});
test("edits validate an entire group before changing saved data and combat uses source mechanics", () => {
  const initial = rpg.createEntity("character");
  assert.throws(() =>
    rpg.edit("character", initial, "resources", {
      "resources.hp": "1:100",
      "resources.ar": "0:0",
      "resources.ap": "9:11",
      "resources.md": "5:5",
    }),
  );
  assert.equal(initial.resources.hp.current, 100);
  const edited = rpg.edit("character", initial, "resources", {
    "resources.hp": "60:100",
    "resources.ar": "10:10",
    "resources.ap": "4:4",
    "resources.md": "5:5",
  });
  const damage = rpg.combat("character", edited, "damage", {
    amount: 15,
    piercing: false,
  });
  assert.equal(damage.data.resources.ar.current, 0);
  assert.equal(damage.data.resources.hp.current, 55);
  const healing = rpg.combat("character", damage.data, "heal", {
    resource: "both",
    percentage: 50,
  });
  assert.equal(healing.data.resources.hp.current, 50);
  assert.equal(healing.data.resources.ar.current, 5);
  const fixed = rpg.combat("character", damage.data, "heal", {
    resource: "both", amount: 20,
  });
  assert.equal(fixed.data.resources.hp.current, 75);
  assert.equal(fixed.data.resources.ar.current, 10);
  const restored = rpg.combat("character", fixed.data, "restore", {
    resource: "hp", percentage: 50,
  });
  assert.equal(restored.data.resources.hp.current, 50);
  assert.equal(restored.data.resources.ar.current, 10);
  assert.throws(() => rpg.combat("character", damage.data, "heal", {
    resource: "both", amount: -1,
  }));
});

test("over-maximum resources survive edits, damage and capped healing", () => {
  for (const type of ["character", "creature"]) {
    const entity = rpg.createEntity(type);
    const edited = rpg.edit(type, entity, "resources", {
      "resources.hp": "190:180", "resources.ar": "20:10",
      "resources.ap": "12:4", "resources.md": "8:5",
    });
    assert.equal(edited.resources.hp.current, 190);
    assert.doesNotThrow(() => rpg.hydrate(type, edited));
    const healed = rpg.combat(type, edited, "heal", { resource: "both", amount: 5 }).data;
    assert.equal(healed.resources.hp.current, 190);
    assert.equal(healed.resources.ar.current, 20);
    const damaged = rpg.combat(type, edited, "damage", { amount: 25, piercing: false }).data;
    assert.equal(damaged.resources.ar.current, 0);
    assert.equal(damaged.resources.hp.current, 185);
    const restored = rpg.combat(type, edited, "restore", { resource: "hp", percentage: 100 }).data;
    assert.equal(restored.resources.hp.current, 180);
  }
});
