const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSite } = require('../scripts/deploy');
const valid = () => ({ type: 'nodejs', nodejs_version: '24', ssl_force: true, cache_enabled: false, max_idle_time: 0, environment: 'RANDOM_DATA_DIR=/home/ttrpg-random/random-data SECURE_COOKIES=1 TRUST_PROXY=1', working_directory: 'random-release-abcdef12', command: 'node /home/ttrpg-random/random-release-abcdef12/server/index.js' });
test('deployment rejects altered persistence, security or release paths', () => {
  assert.doesNotThrow(() => validateSite(valid()));
  for (const change of [
    { environment: 'RANDOM_DATA_DIR=/home/ttrpg-random/random-data-other SECURE_COOKIES=1 TRUST_PROXY=1' },
    { ssl_force: false }, { cache_enabled: true }, { max_idle_time: 60 },
    { command: 'node /tmp/app.js' }, { working_directory: '../random-data' },
    { nodejs_version: '22' },
  ]) assert.throws(() => validateSite({ ...valid(), ...change }));
});
