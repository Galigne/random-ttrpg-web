const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveGenerationMetadata } = require('../rpg/services/generationMetadata');
const { validateGenerationMetadata } = require('../rpg/services/generatorSchema/generationMetadataValidation');
const { validateGeneratorPair, validateRoutedArchetypeStatProfileRelationships } = require('../rpg/services/generatorSchema');
const { createGeneratorCatalogCandidate } = require('../rpg/services/generatorCatalog');
const { createStatProfileCandidate, getStatProfile } = require('../rpg/services/statProfileCatalog');
const { generateStats } = require('../rpg/services/mechanics/statGeneration');
const { GenerationDraft } = require('../rpg/services/generationDraft');
const resolver = require('../rpg/services/generatorResolver');

function resolve(generation, random, draft) {
  return resolveGenerationMetadata({
    entityType: 'character', generation, random, draft, level: 3,
    locale: 'en', categoryOrder: [],
  });
}

test('weighted profile selection follows eligibility and relative weights', () => {
  const generation = { statProfiles: [
    { id: 'character-fighter', weight: 3 },
    { id: 'character-rogue' },
    { id: 'default', weight: 2 },
  ] };
  const counts = new Map();
  for (let i = 0; i < 600; i++) {
    const selected = resolve(generation, () => (i + 0.5) / 600).statProfileId;
    counts.set(selected, (counts.get(selected) ?? 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(counts), {
    'character-fighter': 300, 'character-rogue': 100, default: 200,
  });
});

test('legacy and singleton profiles do not consume an extra random draw', () => {
  for (const generation of [{}, { statProfile: 'character-fighter' },
    { statProfiles: [{ id: 'character-fighter', weight: 7 }] }]) {
    let calls = 0;
    const actual = resolve(generation, () => { calls++; return 0.37; });
    let expectedCalls = 0;
    const expected = generateStats({ level: 3, profile: getStatProfile(actual.statProfileId),
      random: () => { expectedCalls++; return 0.37; } });
    assert.deepEqual(actual.statistics, expected);
    assert.equal(calls, expectedCalls);
    let draftCalls = 0;
    const recorded = resolve(generation, () => { draftCalls++; return 0.37; }, new GenerationDraft());
    assert.deepEqual(recorded.statistics, expected);
    assert.equal(draftCalls, expectedCalls);
  }
});

test('character fixed RULE overrides do not depend on Intelligence', () => {
  const result = resolveGenerationMetadata({
    entityType: 'character', generation: {
      statProfile: 'creature-brute', fixedRules: [{ entry: 'echo_rule', level: 2 }],
    }, level: 1, locale: 'en', random: () => 0, resolver, categoryOrder: ['fixedRules'],
  });
  assert.equal(result.statistics.intelligence, 4);
  assert.equal(result.rules[0].name, 'Echo RULE');
  assert.equal(result.rules[0].level, 2);
});

test('profile metadata rejects malformed lists, weights, and incompatible forms', () => {
  for (const generation of [
    { statProfiles: [] },
    { statProfile: 'default', statProfiles: [{ id: 'default' }] },
    { statProfiles: [{ id: 'default' }, { id: 'default', weight: 2 }] },
    { statProfiles: [{ id: 'default', weight: 0 }] },
    { statProfiles: [{ id: 'default', weight: -1 }] },
    { statProfiles: [{ id: 'default', weight: Infinity }] },
    { statProfiles: [{ id: 'default', weight: Number.MAX_VALUE }, { id: 'character-mage', weight: Number.MAX_VALUE }] },
    { statProfiles: [{ id: 'invalid_id' }] },
    { statProfiles: [{ id: 'default', extra: true }] },
    { statProfiles: Array.from({ length: 26 }, (_, i) => ({ id: `id-${i}` })) },
  ]) {
    assert.throws(() => validateGenerationMetadata(generation, 'test', 'character'));
    assert.throws(() => validateGenerationMetadata(generation, 'test', 'creature'));
  }
  validateGenerationMetadata({ statProfiles: [{ id: 'default' }, { id: 'character-mage', weight: 0.5 }] }, 'test', 'character');
});

test('profile references and weighted choices must agree across locales', () => {
  const catalogs = createGeneratorCatalogCandidate();
  const profiles = createStatProfileCandidate();
  const original = catalogs.get('en').get('criminal');
  const altered = structuredClone(original);
  altered.entries[0].generation.statProfiles[1].id = 'missing-profile';
  catalogs.get('en').set('criminal', altered);
  assert.throws(() => validateRoutedArchetypeStatProfileRelationships(catalogs, profiles),
    error => error.code === 'BACKGROUND_STAT_PROFILE_MISSING');

  const english = require('../rpg/data/generators/en/background_criminal.json');
  const french = structuredClone(require('../rpg/data/generators/fr/background_criminal.json'));
  french.entries[0].generation.statProfiles[0].weight++;
  assert.throws(() => validateGeneratorPair(english, french, 'background_criminal.json', {
    backgroundGeneratorIds: new Set(['criminal']),
  }), error => error.code === 'GENERATOR_LOCALE_PARITY_MISMATCH');
});
