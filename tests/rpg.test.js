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
      "resources.ap": "9:4",
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
});
