const Character = require("../rpg/models/Character");
const Creature = require("../rpg/models/Creature");
const characterEditor = require("../rpg/services/characterEditor");
const creatureEditor = require("../rpg/services/creatureEditor");
const characterCatalog = require("../rpg/services/characterFieldCatalog");
const creatureCatalog = require("../rpg/services/creatureFieldCatalog");
const {
  populateRandomCharacter,
} = require("../rpg/services/randomCharacterGenerator");
const {
  populateRandomCreature,
} = require("../rpg/services/randomCreatureGenerator");
const { dealDamage } = require("../rpg/services/mechanics/damage");
const {
  restoreHealingResources,
  resetTurnResources,
} = require("../rpg/services/mechanics/resources");
const { rollDiceExpression } = require("../rpg/services/diceRollService");
const catalog = require("../rpg/services/generatorCatalog");
const resolver = require("../rpg/services/generatorResolver");
const { isGeneratorRouter } = require("../rpg/services/generatorSchema/routerValidation");
const traversal = require("../rpg/services/generatorTraversal");
const { id } = require("./security");
const localizedContent = {
  en: require("../rpg/locales/en.json"),
  fr: require("../rpg/locales/fr.json"),
};

function locale(value) {
  return value === "fr" ? "fr" : "en";
}
function createEntity(type, options = {}) {
  if (!["character", "creature"].includes(type))
    throw new Error("INVALID_ENTITY_TYPE");
  const entity =
    type === "character"
      ? new Character(options.key ?? id(), { visibility: "private", access: [] })
      : new Creature(options.key ?? id(), { visibility: "private", access: [] });
  if (options.random) {
    const opts = { locale: locale(options.language), draft: options.draft };
    if (
      options.level !== "" &&
      options.level !== undefined &&
      options.level !== null
    )
      opts.level = Number(options.level);
    if (type === "character") {
      if (options.path) opts.background = options.path;
      opts.formatGold = (value) =>
        localizedContent[opts.locale].character.generatedGold.replace(
          "{{gold}}",
          String(value),
        );
      populateRandomCharacter(entity, opts);
    } else {
      if (options.path) opts.type = options.path;
      populateRandomCreature(entity, opts);
    }
  }
  return JSON.parse(JSON.stringify(entity));
}
function hydrate(type, data) {
  return type === "character"
    ? Character.fromSave(data)
    : Creature.fromSave(data);
}
function displayName(type, data, language = "en") {
  const name =
    type === "character"
      ? [data.name.firstName, data.name.lastName].filter(Boolean).join(" ")
      : data.name;
  return (
    name ||
    (language === "fr"
      ? type === "character"
        ? "Personnage sans nom"
        : "Créature sans nom"
      : type === "character"
        ? "Unnamed character"
        : "Unnamed creature")
  );
}
function editor(type) {
  return type === "character" ? characterEditor : creatureEditor;
}
function sections(type, entity) {
  const character = type === "character";
  const defs = character
    ? characterCatalog.getCharacterSections()
    : creatureCatalog.getCreatureSections();
  const find = character
    ? characterCatalog.getCharacterFieldDefinition
    : creatureCatalog.getCreatureFieldDefinition;
  return defs.map((section) => ({
    id: section.id,
    labelKey: section.labelKey,
    kind: section.editKind,
    fields: section.editInputIds.map((fieldId) => {
      const def = find(fieldId);
      return {
        id: fieldId,
        labelKey: def?.labelKey || fieldId,
        paragraph: Boolean(def?.paragraph || def?.multiline),
        pair: def?.inputKind === "pair",
        numeric: def?.type === "number",
        format: def?.rules
          ? "formatRules"
          : def?.described
            ? "formatDescribed"
            : def?.multiline
              ? "formatLines"
              : null,
      };
    }),
    value: editor(type).getEditableFieldValue(entity, section.id),
  }));
}
function edit(type, data, field, value) {
  const entity = hydrate(type, data);
  editor(type).setEditableFieldValue(entity, field, value);
  const updated = JSON.parse(JSON.stringify(entity));
  hydrate(type, updated); // Validate the complete resulting save before publication.
  return updated;
}
function combat(type, data, action, input) {
  const entity = hydrate(type, data);
  let result;
  if (action === "damage")
    result = dealDamage(entity, Number(input.amount), Boolean(input.piercing));
  else if (action === "heal")
    result = restoreHealingResources(
      entity,
      input.resource,
      Number(input.percentage),
    );
  else if (action === "end-turn") {
    resetTurnResources(entity);
    result = null;
  } else throw new Error("INVALID_ACTION");
  const updated = JSON.parse(JSON.stringify(entity));
  hydrate(type, updated);
  return { data: updated, result };
}
function roll(expression) {
  const { result } = rollDiceExpression(expression);
  const animation =
    result.count === 1 && result.sides === 20
      ? `D20-${result.rolls[0]}.gif`
      : result.count === 1 && result.sides === 2
        ? result.rolls[0] === 1
          ? "HEADS.gif"
          : "TAILS.gif"
        : null;
  return { ...result, animation };
}
function catalogLabel(name, language) {
  if (!name?.includes("{{")) return name;
  return name.replace(/\{\{([^{}]+)\}\}/g, (_, expression) => {
    const analysis = traversal.analyzeGeneratorTraversalPath(expression.trim(), locale(language), {
      allowAliases: false, rootVisibility: "all", implicitRouterSelections: false,
    });
    const context = analysis?.contexts[0];
    if (!context) return "…";
    const fixed = context.generator.entries.find(entry => entry.id === context.entryId);
    return fixed && !fixed.name.includes("{{") ? fixed.name : `‹${context.generator.name}›`;
  });
}
function browse(path, language) {
  const lang = locale(language);
  if (!path)
    return {
      roots: catalog
        .listGenerators(lang)
        .map(({ id: rootId, name, description }) => ({
          id: rootId,
          name,
          description,
        })),
    };
  const analysis = traversal.analyzeGeneratorTraversalPath(path, lang);
  if (!analysis) throw new Error("INVALID_GENERATOR_PATH");
  const candidates = traversal.getGeneratorTraversalSuggestions(
    `${path}:`,
    lang,
  );
  const fields = traversal.getGeneratorTraversalSuggestions(`${path}.`, lang);
  const branches = analysis.contexts.every(({ generator }) => isGeneratorRouter(generator));
  return { path, candidates: candidates.map(item => ({ ...item, label: catalogLabel(item.label, lang) })), fields, branches };
}
function generate(path, language) {
  const value = resolver.generate(path, locale(language));
  if (!value) throw new Error("INVALID_GENERATOR_PATH");
  return value;
}
module.exports = {
  createEntity,
  hydrate,
  displayName,
  sections,
  edit,
  combat,
  roll,
  browse,
  catalogLabel,
  generate,
};
