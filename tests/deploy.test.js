const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDeployment, validateSite, withActivationLock } = require('../scripts/deploy');

const commit = 'a'.repeat(40);
const previous = 'random-release-' + 'b'.repeat(40) + '-' + 'c'.repeat(32);
const command = release => `node /home/ttrpg-random/${release}/server/index.js`;
const valid = () => ({
  type: 'nodejs', nodejs_version: '24', ssl_force: true, cache_enabled: false, max_idle_time: 0,
  environment: 'RANDOM_DATA_DIR=/home/ttrpg-random/random-data SECURE_COOKIES=1 TRUST_PROXY=1',
  working_directory: previous, command: command(previous),
});

test('deployment rejects altered persistence, security or release paths', () => {
  assert.doesNotThrow(() => validateSite(valid()));
  for (const change of [
    { environment: valid().environment + ' RANDOM_DATA_DIR=/tmp' },
    { ssl_force: false }, { cache_enabled: true }, { max_idle_time: 60 }, { signal_reload: 'HUP' },
    { command: 'node /tmp/app.js' }, { working_directory: '..', command: command('..') },
    { nodejs_version: '22' },
  ]) assert.throws(() => validateSite({ ...valid(), ...change }));
});

function scratch(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'random deployment '));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  return temp;
}

function fixture(t, { testPipes = false } = {}) {
  const temp = scratch(t);
  const tokenFile = path.join(temp, 'fake token');
  const key = path.join(temp, 'fake key');
  fs.writeFileSync(tokenFile, 'test-only-token');
  fs.writeFileSync(key, '');
  const output = [];
  const calls = [];
  const site = valid();
  const archive = Buffer.from([0, 255, 13, 10, 26]);
  const asset = Buffer.from('expected app.js');
  const manifest = Array.from({ length: 750 }, (_, i) => [`public/écran ${i}\t.js`, 'd'.repeat(40)]);
  const dirs = new Set();
  let locked = false;
  const state = {
    site, output, calls, dirs, running: () => null, publicStatus: 200, apiStatus: 200,
    asset, failure: null, patchFails: false, lockLost: false, dirty: false,
  };
  const cli = createDeployment({
    key, tokenFile, print: v => output.push(v), pause: async () => {},
    lock: async (_args, activate) => {
      assert.equal(locked, false);
      locked = true;
      try {
        await activate(() => {
          if (state.lockLost) throw new Error('Activation lock lost');
        });
      } finally {
        locked = false;
      }
    },
    request: async (url, options) => {
      if (url === 'https://api.alwaysdata.com/v1/site/1106281/') {
        assert.equal(options.redirect, 'error');
        if (state.apiStatus !== 200) return new Response('', { status: state.apiStatus });
        if (options.method === 'PATCH') {
          assert.equal(locked, true);
          calls.push('activate');
          const body = JSON.parse(options.body);
          assert.deepEqual(Object.keys(body).sort(), ['command', 'working_directory']);
          assert.equal(body.command, command(body.working_directory));
          Object.assign(site, body);
          if (state.patchFails) throw new Error('timed out after update');
          return new Response(null, { status: 204 });
        }
        return Response.json(site);
      }
      assert.equal(new URL(url).origin, 'https://ttrpg-random.alwaysdata.net');
      if (new URL(url).pathname === '/app.js') {
        calls.push('asset');
        return new Response(state.asset);
      }
      calls.push('probe');
      const release = state.running();
      return new Response('<script src="/app.js"></script>', {
        status: state.publicStatus, headers: release ? { 'X-Random-Release': release } : {},
      });
    },
    runCommand: (exe, args, options) => {
      if (exe === 'git') {
        if (args[0] === 'branch') return 'main\n';
        if (args[0] === 'status') return state.dirty ? '?? local-only\n' : '';
        if (args[0] === 'rev-parse') return commit + '\n';
        if (args[0] === 'ls-remote') return commit + '\trefs/heads/main\n';
        if (args.includes('archive')) {
          assert.deepEqual(args, ['-c', 'core.autocrlf=false', 'archive', '--format=tar', commit]);
          assert.equal(options.encoding, null);
          return archive;
        }
        if (args[0] === 'ls-tree') {
          assert.deepEqual(args, ['ls-tree', '-rz', commit]);
          return manifest.map(([name, hash]) => `100644 blob ${hash}\t${name}\0`).join('');
        }
        assert.deepEqual(args, ['show', `${commit}:public/app.js`]);
        return asset;
      }
      if (exe === 'npm' || exe === 'npm.cmd') {
        assert.equal(options.shell, process.platform === 'win32');
        if (state.failure === 'test') throw new Error('test failed');
        return '';
      }
      assert.equal(exe, 'ssh');
      assert.equal(args[args.indexOf('-i') + 1], key);
      assert.ok(args.includes('StrictHostKeyChecking=yes'));
      const remote = args.at(-1);
      const action = remote.includes('tar -xf -') ? 'upload' : remote.match(/" '(check|backup|verify|migration)'/)[1];
      calls.push(action);
      if (testPipes && (action === 'upload' || action === 'verify')) {
        // The local child is a stand-in for SSH and receives a real stdin pipe on Windows.
        const hashInput = "const data = require('node:fs').readFileSync(0); console.log(require('node:crypto').createHash('sha256').update(data).digest('hex'))";
        const transfer = spawnSync(process.execPath, ['-e', hashInput], { ...options, timeout: 5000 });
        assert.equal(transfer.status, 0, transfer.error?.message || String(transfer.stderr));
        assert.equal(String(transfer.stdout).trim(), createHash('sha256').update(options.input).digest('hex'));
      }
      if (action === 'upload') {
        assert.equal(options.encoding, null);
        assert.deepEqual(options.input, archive);
        const dir = remote.match(/mkdir '([^']+)'/)[1];
        assert.ok(!dirs.has(dir), 'retry must use a fresh release directory');
        dirs.add(dir);
      }
      if (action === 'verify') {
        assert.ok(options.input.length > 32767, 'manifest exceeds Windows command-line limits');
        assert.ok(remote.length < 32767);
        assert.deepEqual(JSON.parse(options.input), manifest);
      }
      if (state.failure === action) throw new Error(`interrupted ${action}`);
      return action === 'backup' ? '/home/ttrpg-random/random-backups/random-20261121T123000Z-abcd.sqlite\n' : 'ok\n';
    },
  });
  return { ...state, state, cli };
}

test('readiness and backup bypass an unavailable application but require API, SSH and SQLite checks', async t => {
  const { cli, state, calls } = fixture(t);
  state.publicStatus = 503;
  await cli.check();
  await cli.backup();
  assert.deepEqual(calls, ['check', 'check', 'backup']);
  state.site.command = 'broken startup command';
  await cli.backup();
  state.site.environment = 'RANDOM_DATA_DIR=/tmp';
  await assert.rejects(cli.backup(), /Unexpected production database directory/);
  state.site.environment = valid().environment;
  state.apiStatus = 403;
  await assert.rejects(cli.backup(), /API GET returned HTTP 403/);
  state.apiStatus = 200;
  state.failure = 'check';
  await assert.rejects(cli.backup(), /interrupted check/);
  assert.equal(calls.filter(call => call === 'backup').length, 2);
});

test('deploy streams the archive and long manifest during outage recovery and verifies the running release', async t => {
  const { cli, state, calls, output } = fixture(t, { testPipes: true });
  state.publicStatus = 503;
  state.running = () => {
    if (state.site.working_directory === previous) return null;
    state.publicStatus = 200;
    return state.site.working_directory;
  };
  // Return a transient 503 on the first post-activation probe.
  let probes = 0;
  const currentRelease = state.running;
  state.running = () => ++probes === 1 ? null : currentRelease();
  await cli.deploy();
  assert.deepEqual(calls, ['check', 'upload', 'verify', 'backup', 'migration', 'activate', 'probe', 'probe', 'asset']);
  assert.ok(output.some(line => line.includes('Deployment verified: ' + commit)));
});

test('failed preparation from upload through migration can be retried without activation or path reuse', async t => {
  const { cli, state, calls, dirs } = fixture(t);
  for (const failure of ['upload', 'verify', 'backup', 'migration']) {
    state.failure = failure;
    await assert.rejects(cli.deploy(), new RegExp(`interrupted ${failure}`));
    assert.equal(state.site.working_directory, previous);
  }
  state.failure = null;
  state.running = () => state.site.working_directory;
  await cli.deploy();
  assert.equal(dirs.size, 5);
  assert.equal(calls.filter(call => call === 'activate').length, 1);
});

test('dirty checkout, failed tests, and a lost activation lock cannot trigger a site update', async t => {
  const { cli, state, calls } = fixture(t);
  state.dirty = true;
  await assert.rejects(cli.deploy(), /local changes/);
  state.dirty = false;
  state.failure = 'test';
  await assert.rejects(cli.deploy(), /test failed/);
  assert.ok(!calls.includes('upload'));
  state.failure = null;
  state.lockLost = true;
  await assert.rejects(cli.deploy(), /lock lost/);
  assert.ok(!calls.includes('activate'));
});

test('status distinguishes an outage, a legacy response, and a different running release', async t => {
  const { cli, state, output } = fixture(t);
  state.publicStatus = 503;
  await assert.rejects(cli.status(), /Could not verify/);
  assert.ok(output.some(line => line.includes('Running release unavailable: HTTPS returned HTTP 503')));
  state.publicStatus = 200;
  await assert.rejects(cli.status(), /Could not verify/);
  assert.ok(output.some(line => line.includes('Running release unknown')));
  state.running = () => 'random-release-' + commit;
  await assert.rejects(cli.status(), /differs/);
  assert.ok(output.some(line => line.includes('Configured release: ' + previous)));
  state.running = () => previous;
  await cli.status();
});

test('wrong asset or old running process prevents success even when Alwaysdata shows the new release', async t => {
  const { cli, state, output } = fixture(t);
  state.running = () => previous;
  await assert.rejects(cli.deploy(), /instead of random-release/);
  state.running = () => state.site.working_directory;
  state.asset = Buffer.from('stale asset');
  await assert.rejects(cli.deploy(), /Live app.js does not match/);
  assert.ok(!output.some(line => line.includes('Deployment verified')));
});

test('uncertain API response never reports success or rolls back a potentially active release', async t => {
  const { cli, state, calls, output } = fixture(t);
  state.patchFails = true;
  await assert.rejects(cli.deploy(), /Activation could not be confirmed.*deploy:status/);
  assert.notEqual(state.site.working_directory, previous);
  assert.equal(calls.filter(call => call === 'activate').length, 1);
  assert.ok(!output.some(line => line.includes('Deployment verified')));
});

test('activation lock closes its SSH session on failure and detects a dropped connection', async () => {
  let child;
  function spawnSsh(exe, args, options) {
    assert.equal(exe, 'ssh');
    assert.match(args.at(-1), /flock -n .*cat >\/dev\/null/);
    child = spawn(process.execPath, ['-e', 'process.stdin.resume(); console.log("locked");'], options);
    return child;
  }
  await assert.rejects(withActivationLock([], async assertLocked => {
    assertLocked();
    throw new Error('activation failed');
  }, spawnSsh), /activation failed/);
  assert.equal(child.exitCode, 0);
  await assert.rejects(withActivationLock([], async assertLocked => {
    const done = once(child, 'close');
    child.kill();
    await done;
    assertLocked();
  }, spawnSsh), /Lost the activation lock connection/);
  await withActivationLock([], async assertLocked => assertLocked(), spawnSsh);
});

test('application reports the identity captured at startup and ignores marker changes until restart', async t => {
  const release = 'random-release-' + commit + '-' + 'f'.repeat(32);
  const directory = path.join(scratch(t), release);
  const server = path.join(directory, 'server');
  fs.mkdirSync(server, { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../server/index.js'), path.join(server, 'index.js'));
  fs.writeFileSync(path.join(server, 'db.js'), 'exports.openDatabase = () => {};');
  fs.writeFileSync(path.join(server, 'app.js'), 'exports.createApplication = () => ({ handler: (_, res) => res.end("ok") });');
  const marker = path.join(directory, '.random-release');
  fs.writeFileSync(marker, release);
  const child = spawn(process.execPath, [path.join(server, 'index.js')], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const done = once(child, 'close');
  t.after(async () => { child.kill(); await done; });
  const [line] = await once(child.stdout, 'data', { signal: AbortSignal.timeout(10000) });
  const address = line.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  fs.unlinkSync(marker);
  const response = await fetch(address + '/?deploy=test');
  assert.equal(await response.text(), 'ok');
  assert.equal(response.headers.get('x-random-release'), release);
});
