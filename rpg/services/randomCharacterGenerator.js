const generatorCatalog = require('./generatorCatalog');
const generatorResolver = require('./generatorResolver');
const {
	maybeGenerateDescriptiveModifiers,
} = require('./descriptiveModifierGenerator');
const {
	getGenerationMetadata,
	resolveGenerationMetadata,
} = require('./generationMetadata');
const { BACKGROUND_ROUTER_ID } = require('./generatorSchema');
const {
	resolveArmorReference,
	resolveDescribedReferences,
	resolveGearReferences,
} = require('./generationReferenceResolver');
const { formatResolvedLootItem } = require('./lootGeneration');
const {
	prepareScopedRoutedArchetype,
	resolveScopedRoutedArchetype,
} = require('./routedArchetypeSelection');
const { pickEntry, roll, rollLevel, optionalRoll, withDraft } = require('./generationDraft');
const {
	randomInteger,
	readNormalizedRandom,
} = require('./random');
const {
	allocateRuleLevels,
	calculateRulePoints,
	calculateTalentCount,
} = require('./mechanics/characterGeneration');
const { canEquipArmor } = require('./mechanics/armor');
const {
	calculateMaxAp,
	createGeneratedResources,
} = require('./mechanics/resources');

const MAIN_EQUIPMENT_WEAPON_CHANCE = 0.8;
const CARRIED_LOOT_COUNT = 3;
const LOOT_DUPLICATE_MAX_ATTEMPTS = 10;

function populateRandomCharacter(character, options = {}) {
	const random = options.random ?? Math.random;
	const locale = options.locale ?? 'en';
	const formatGold = options.formatGold ?? (gold => `${gold} gold`);
	const draft = options.draft;
	const resolver = withDraft(options.resolver ?? generatorResolver, draft);
	const getGenerator = options.getGenerator ?? generatorCatalog.getGenerator;
	generatorResolver.assertGeneratorResolverInterface(resolver);
	const preparedBackground = prepareScopedRoutedArchetype({
		getGenerator,
		locale,
		rootId: BACKGROUND_ROUTER_ID,
		scopedPath: options.background,
	});
	if (!preparedBackground.ok && preparedBackground.reason === 'invalid-path') {
		throw generationError(
			`Unknown background traversal path: ${options.background}.`,
			'errors.backgroundUnknown',
			{ background: options.background },
		);
	}
	if (!preparedBackground.ok) {
		throw generationError(
			`Background route ${options.background ?? 'random'} is unavailable.`,
			'errors.generatorMissing',
			{ category: options.background ?? BACKGROUND_ROUTER_ID },
		);
	}
	const level = rollLevel(draft, options.level, () => randomInteger(1, 10, random));
	if (!Number.isInteger(level) || level < 1 || level > 10) {
		throw generationError(
			'Character level must be a whole number between 1 and 10.',
			'errors.characterLevelInvalid',
		);
	}

	character.level = level;
	const generatedName = pickOne('name', locale, random, undefined, draft, 'root.character.name');
	character.name.firstName = resolveSelectedField('name', generatedName, 'first_name', {
		locale, random, resolver, path: 'root.character.name.firstName',
	});
	character.name.lastName = resolveSelectedField('name', generatedName, 'last_name', {
		locale, random, resolver, path: 'root.character.name.lastName',
	});

	const race = pickOne('race', locale, random, undefined, draft, 'root.character.race');
	character.race.name = resolveSelectedField('race', race, 'name', {
		locale, random, resolver, path: 'root.character.race.name',
	});
	character.race.physicalDescription = resolveSelectedField('race', race, 'description', {
		locale, random, resolver, path: 'root.character.race.physicalDescription',
	});
	character.race.traits.skillBonus = resolveSelectedField('race', race, 'skill_bonus', {
		locale, random, resolver, path: 'root.character.race.skillBonus',
	});
	character.race.traits.physicalAbility = resolveSelectedField('race', race, 'physical_ability', {
		locale, random, resolver, path: 'root.character.race.physicalAbility',
	});

	const backgroundSelection = resolveScopedRoutedArchetype({
		getGenerator,
		locale,
		prepared: preparedBackground,
		random,
		resolver,
		rootId: BACKGROUND_ROUTER_ID,
		scopedPath: options.background,
	});
	if (!backgroundSelection.ok) {
		throw generationError(
			`Background route ${options.background ?? 'random'} is unavailable.`,
			'errors.generatorMissing',
			{ category: options.background ?? BACKGROUND_ROUTER_ID },
		);
	}
	const {
		entry: archetype,
		result: archetypeResult,
	} = backgroundSelection;
	const generation = getGenerationMetadata(archetype);
	const physicalDescriptionResult = resolver.resolveInlineReference(
		'{{ physical_description.description }}',
		locale,
		{ path: 'root.character.background.physicalDescription', random },
	);
	character.background.archetype = getResolvedTextValue(archetypeResult);
	character.background.physicalDescription = getResolvedTextValue(
		physicalDescriptionResult,
	);
	character.background.backstory = '';
	character.background.goals = '';

	const resolvedGeneration = resolveGenerationMetadata({
		entityType: 'character',
		draft,
		generation,
		archetypeKey: `${archetypeResult.generatorId}:${archetype.id}`,
		level,
		locale,
		random,
		resolver,
		getProfile: options.getStatProfile ?? undefined,
		createError: generationError,
		modifierReferenceOptions: {
			excludedEntryIdsByGenerator: { race: [race.id] },
		},
		preStatisticsCategories: ['modifiers'],
		categoryOrder: [
			'modifiers',
			'fixedRules',
			'templates',
			'statusEffects',
			'armor',
			'equipment',
			'inventory',
		],
		defaults: createCharacterGenerationDefaults({
			character,
			draft,
			formatGold,
		}),
	});
	character.statistics = resolvedGeneration.statistics;
	character.rules = resolvedGeneration.rules;
	character.talents = resolvedGeneration.templates;
	character.status.effects = resolvedGeneration.statusEffects;
	character.status.modifiers = resolvedGeneration.modifiers.map(modifier => (
		structuredClone(modifier)
	));

	Object.assign(character.resources, createGeneratedResources(
		character.statistics,
		level,
		resolvedGeneration.armorPercentage,
	));
	character.gear.equipment = resolvedGeneration.gear.armor === undefined
		? resolvedGeneration.gear.equipment
		: [resolvedGeneration.gear.armor, ...resolvedGeneration.gear.equipment];
	character.gear.inventory = resolvedGeneration.gear.inventory;

	return character;
}

function createCharacterGenerationDefaults({ character, draft, formatGold }) {
	return {
		beforeStatistics({ locale, random, resolver }) {
			character.personality.traits = pickMany('personality', 2, locale, random, undefined, draft, 'root.character.personality')
				.map((entry, index) => resolveSelectedField('personality', entry, 'description', {
					locale, random, resolver, path: `root.character.personality.${index}`,
				}));
		},
		modifiers({ locale, modifierReferenceOptions, random, resolver }) {
			return maybeGenerateDescriptiveModifiers({
				generator: 'modifier_character',
				draft,
				resolver,
				locale,
				random,
				path: 'root.character.modifier',
				resolverOptions: modifierReferenceOptions,
			});
		},
		fixedRules({ locale, random, resolver, statistics }) {
			const rulePointCount = calculateRulePoints(statistics.intelligence);
			const ruleLevels = allocateRuleLevels(rulePointCount);
			return pickMany('rules', ruleLevels.length, locale, random, undefined, draft, 'root.character.rules')
				.map((entry, index) => ({
					name: resolveSelectedField('rules', entry, 'name', {
						locale, random, resolver, path: `root.character.rules.${index}.name`,
					}),
					description: resolveSelectedField('rules', entry, 'description', {
						locale, random, resolver, path: `root.character.rules.${index}.description`,
					}),
					level: ruleLevels[index],
				}));
		},
		templates({ level, locale, random, resolver }) {
			const talentCount = calculateTalentCount(level);
			const selectedTalents = pickMany('talents', talentCount, locale, random, undefined, draft, 'root.character.talents');
			return resolveSelectedDescribedEntries(
				'talents',
				selectedTalents,
				{
					locale,
					path: 'root.character.talents',
					random,
					resolver,
				},
			).map(({ name, description }) => `${name} — ${description}`);
		},
		statusEffects({ locale, random, resolver }) {
			if (!optionalRoll(draft, 'root.character.status.effects', () => random() < 0.25)) {
				return [];
			}
			const selectedStatusEffect = pickOne('status_effect', locale, random, undefined, draft, 'root.character.status.effects.0');
			return resolveSelectedDescribedEntries(
				'status_effect',
				[selectedStatusEffect],
				{
					locale,
					path: 'root.character.status.effects',
					random,
					resolver,
				},
			).map(({ name, description }) => ({ name, description }));
		},
		armor({ locale, random, resolver, statistics }) {
			if (!canEquipArmor(statistics.constitution, 'light')) {
				return {};
			}
			const armor = pickOne(
				'armors',
				locale,
				random,
				entry => canEquipArmor(
					statistics.constitution,
					getField(entry, 'type'),
				),
				draft, 'root.character.armor',
			);
			return resolveArmorReference(`armors:${armor.id}`, {
				createError: generationError,
				locale,
				path: 'root.character.armor',
				random,
				resolver,
			});
		},
		equipment({ locale, random, resolver }) {
			const mainEquipmentCount = roll(draft, 'root.character.equipment.count', () => randomInteger(1, 2, random), { label: 'quantity' });
			const mainEquipment = pickMainEquipment(
				mainEquipmentCount,
				locale,
				random,
				draft,
			);
			return resolveGearReferences(
				mainEquipment.map(item => `${item.generatorId}:${item.entry.id}`),
				{
					createError: generationError,
					locale,
					path: 'root.character.equipment',
					random,
					resolver,
				},
			);
		},
		inventory({ level, locale, random, resolver }) {
			const inventory = pickCarriedLoot(
				CARRIED_LOOT_COUNT,
				locale,
				random,
				resolver,
				draft,
			);
			const gold = level * roll(draft, 'root.character.gold', () => randomInteger(1, 20, random), { label: 'gold' }) + 5;
			inventory.push(formatGold(gold));
			return { values: inventory };
		},
	};
}

function pickMainEquipment(count, locale, random, draft) {
	draft?.retainSlots('root.character.equipment', count);
	const categoryOptions = draft && ['weapons', 'shields'].map(id => ({
		id, name: generatorCatalog.getGenerator(id, locale).name,
	}));
	const categoryIds = Array.from({ length: count }, (_, index) => roll(
		draft, `root.character.equipment.${index}.category`, () => selectMainEquipmentGenerator(random),
		{ label: 'category', options: categoryOptions },
	));
	const items = [];
	for (const generatorId of new Set(categoryIds)) {
		const slots = categoryIds.flatMap((id, index) => id === generatorId ? [index] : []);
		const entries = pickMany(generatorId, slots.length, locale, random, undefined, draft,
			'root.character.equipment', slots.map(index => `root.character.equipment.${index}`));
		slots.forEach((index, i) => { items[index] = { generatorId, entry: entries[i] }; });
	}
	return items;
}

function selectMainEquipmentGenerator(random) {
	return readNormalizedRandom(random) < MAIN_EQUIPMENT_WEAPON_CHANCE
		? 'weapons'
		: 'shields';
}

function pickCarriedLoot(count, locale, random, resolver, draft) {
	const selectedIdentities = new Set();
	const selectedValues = [];
	for (let index = 0; index < count; index += 1) {
		let selected;
		for (let attempt = 0; attempt < LOOT_DUPLICATE_MAX_ATTEMPTS; attempt += 1) {
			const before = draft && new Map(draft.records);
			const resolved = resolver.generate(
				'loot.generator',
				locale,
				{ random, choicePath: `root.character.inventory.${index}`, uniqueLoot: true },
			);
			selected = {
				identity: getLootSelectionIdentity(resolved?.provenance),
				value: getResolvedDisplayValue(resolved, locale),
			};
			if (!selectedIdentities.has(selected.identity) || attempt === LOOT_DUPLICATE_MAX_ATTEMPTS - 1) break;
			if (draft) draft.records = before;
		}
		selectedIdentities.add(selected.identity);
		selectedValues.push(selected.value);
	}
	return selectedValues;
}

function getLootSelectionIdentity(provenance) {
	const selections = (provenance ?? []).filter(record => (
		record.type === 'entry' && record.generatorId && record.entryId
	));
	const routerIndex = selections.findIndex(record => record.generatorId === 'loot');
	const selection = selections[routerIndex + 1];
	if (!selection) {
		throw generationError(
			'Loot resolution omitted child selection provenance.',
			'errors.generatorMissing',
			{ category: 'loot' },
		);
	}
	return `${selection.generatorId}:${selection.entryId}`;
}

function getResolvedDisplayValue(result, locale) {
	let value;
	try {
		value = formatResolvedLootItem(result, locale);
	}
	catch {
		throw generationError(
			'Loot resolution did not produce display text.',
			'errors.generatorTextExpected',
		);
	}
	return value;
}

function pickOne(generatorId, locale, random, predicate, draft, key) {
	return pickMany(generatorId, 1, locale, random, predicate, draft, key, [key])[0];
}

function pickMany(generatorId, count, locale, random, predicate = () => true, draft, key, slotKeys) {
	if (!slotKeys) draft?.retainSlots(key, count);
	const generator = generatorCatalog.getGenerator(generatorId, locale);
	if (!generator) {
		throw generationError(
			`Missing generator category: ${generatorId}.`,
			'errors.generatorMissing',
			{ category: generatorId },
		);
	}
	const availableEntries = generator.entries.filter(predicate);
	if (availableEntries.length < count) {
		throw generationError(
			`Generator category ${generatorId} needs at least ${count} eligible entries.`,
			'errors.generatorNeedsEntries',
			{ category: generatorId, count },
		);
	}

	const selectedEntries = [];
	for (let index = 0; index < count; index += 1) {
		const slot = slotKeys?.[index] ?? `${key}.${index}`;
		const entry = pickEntry(draft, slot, generator, availableEntries, random, `${key}:${generatorId}`);
		selectedEntries.push(entry);
		if (!draft) availableEntries.splice(availableEntries.indexOf(entry), 1);
	}
	return selectedEntries;
}

function getField(entry, requestedField) {
	if (requestedField === 'name' && typeof entry?.name === 'string') {
		return entry.name;
	}
	if (!entry?.fields) {
		throw generationError(
			`Expected a generator entry with additional field ${requestedField}.`,
			'errors.generatorStructuredExpected',
			{ field: requestedField },
		);
	}
	if (!Object.hasOwn(entry.fields, requestedField)) {
		throw generationError(
			`Generator entry is missing field: ${requestedField}.`,
			'errors.generatorFieldMissing',
			{ field: requestedField },
		);
	}
	return entry.fields[requestedField];
}

function resolveSelectedField(generatorId, entry, field, { locale, path, random, resolver }) {
	const result = resolver.resolveReference(`${generatorId}:${entry.id}.${field}`, locale, {
		path,
		random,
	});
	return getField(result, field);
}

function getResolvedTextValue(result) {
	if (typeof result?.value !== 'string') {
		throw generationError(
			'Expected a generator result containing one selected string.',
			'errors.generatorTextExpected',
		);
	}
	return result.value;
}

function resolveSelectedDescribedEntries(
	generatorId,
	entries,
	{ locale, path, random, resolver },
) {
	return resolveDescribedReferences(
		entries.map(entry => `${generatorId}:${entry.id}`),
		{
			createError: generationError,
			locale,
			path,
			random,
			resolver,
		},
	);
}

function generationError(message, translationKey, translationVariables = {}) {
	const error = new Error(message);
	error.code = 'INVALID_RANDOM_CHARACTER';
	error.translationKey = translationKey;
	error.translationVariables = translationVariables;
	return error;
}

module.exports = {
	CARRIED_LOOT_COUNT,
	LOOT_DUPLICATE_MAX_ATTEMPTS,
	MAIN_EQUIPMENT_WEAPON_CHANCE,
	allocateRuleLevels,
	calculateMaxAp,
	calculateRulePoints,
	pickCarriedLoot,
	pickMainEquipment,
	populateRandomCharacter,
	selectMainEquipmentGenerator,
};
