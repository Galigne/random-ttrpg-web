const rpg = require("./rpg");
const { GenerationDraft } = require("../rpg/services/generationDraft");

const locations = {
  name: "name.firstName", race: "race.name", personality: "personality.traits",
  rules: "rules.value", fixedRules: "rules.value", talents: "talents.value", traits: "traits.value",
  statusEffects: "status.effects", modifier: "status.modifiers", modifiers: "status.modifiers",
  armor: "gear.equipment", equipment: "gear.equipment", inventory: "gear.inventory", gold: "gear.inventory",
};

function location(key, type, data, draft) {
  if (key === "level") return { field: "level.value" };
  if (key === "statistics" || key === "statProfile") return { field: "statistics" };
  if (key.startsWith("archetype")) return { field: type === "character" ? "background.archetype" : "identity.name" };
  const [, , component, ...parts] = key.split(".");
  if (component === "background") return { field: "background.physicalDescription" };
  if (component === "status") return { field: "status.effects", index: /^\d+$/.test(parts[1]) ? Number(parts[1]) : undefined };
  const field = locations[component];
  let index = /^\d+$/.test(parts[0]) ? Number(parts[0]) : undefined;
  if (component === "armor") index = 0;
  if (component === "equipment" && index !== undefined) {
    const hasArmor = draft.records.has("root.character.armor") ||
      (type === "creature" && data.source.provenance.some(p => p.path === "root.generation.armor" && p.generatorId === "armors"));
    if (hasArmor) index++;
  }
  if (component === "gold") index = data.gear.inventory.length - 1;
  return { field, index };
}

function build(type, options, previous, edit) {
  const draft = new GenerationDraft(previous?.draft, edit);
  const data = rpg.createEntity(type, { ...options, key: previous?.data.key, random: true, draft });
  const sections = rpg.sections(type, rpg.hydrate(type, data));
  const controls = draft.controls().map(control => ({
    ...control, current: rpg.catalogLabel(control.current, options.language), ...location(control.key, type, data, draft),
  }));
  const changed = previous ? sections.flatMap(section => describeChanges(section, previous, data)) : [];
  if (previous && edit?.key.startsWith("archetype") &&
      previous.draft.records.get("statProfile")?.value !== draft.records.get("statProfile")?.value) {
    changed.unshift({ message: "profileChanged", to: controls.find(control => control.key === "statProfile")?.current });
  }
  if (previous && type === "character") {
    const oldArmor = previous.draft.records.get("root.character.armor")?.value;
    const newArmor = draft.records.get("root.character.armor")?.value;
    if (oldArmor && !newArmor) changed.push({ message: "armorRemoved" });
    else if (oldArmor && newArmor && oldArmor !== newArmor) changed.push({ message: "armorReplaced" });
  }
  draft.previous = new Map();
  return { type, options, data, draft, sections, controls, changed, revision: (previous?.revision ?? -1) + 1 };
}

function describeChanges(section, previous, data) {
  const old = previous.sections.find(item => item.id === section.id);
  if (section.id === "resources") {
    return section.fields.flatMap(field => {
      const resource = field.id.split(".")[1];
      const from = previous.data.resources[resource].max;
      const to = data.resources[resource].max;
      return from === to ? [] : [{ label: field.labelKey, from, to }];
    });
  }
  if (JSON.stringify(section.value) === JSON.stringify(old.value) &&
      !(section.id === "background" && previous.data.background.archetype !== data.background.archetype)) return [];
  const before = previous.data[section.id], after = data[section.id];
  return Array.isArray(after) && before.length !== after.length
    ? [{ label: section.labelKey, from: before.length, to: after.length }]
    : [{ label: section.labelKey }];
}

function response(previewId, preview) {
  const { type, data, sections, controls, changed, revision, options } = preview;
  return { previewId, type, data, sections, controls, changed, revision, language: options.language };
}

module.exports = { build, response };
