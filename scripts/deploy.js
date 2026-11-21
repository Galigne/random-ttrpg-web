const { spawn, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '..');
const account = 'ttrpg-random';
const home = '/home/ttrpg-random';
const host = 'ttrpg-random@ssh-ttrpg-random.alwaysdata.net';
const siteApi = 'https://api.alwaysdata.com/v1/site/1106281/';
const siteUrl = 'https://ttrpg-random.alwaysdata.net';
const releasePattern = /^random-release-([a-f0-9]{8,40})(?:-exact|-\d+|-[a-f0-9]{32})?$/;
const remoteScript = fs.readFileSync(path.join(__dirname, 'deploy-remote.py')).toString('base64');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} failed: ${result.error?.message || String(result.stderr || '').trim() || (result.signal ?? `exit ${result.status}`)}`);
  }
  return result.stdout;
}

function environmentMatches(site, ...expected) {
  const environment = (site.environment || '').split(/\s+/);
  return expected.every(value =>
    environment.filter(entry => entry.startsWith(value.split('=')[0] + '=')).join(' ') === value);
}

function validateReleasePath(site) {
  if (typeof site.working_directory !== 'string' ||
      !/^(?!\.{1,2}$)[a-zA-Z0-9._-]+$/.test(site.working_directory) ||
      site.command !== `node ${home}/${site.working_directory}/server/index.js`) {
    throw new Error('Unexpected application path. Inspect Alwaysdata before continuing.');
  }
}

const dataDirectory = 'RANDOM_DATA_DIR=/home/ttrpg-random/random-data';
function validateSite(site) {
  if (site.type !== 'nodejs' || site.nodejs_version !== '24' || !site.ssl_force ||
      site.cache_enabled || site.max_idle_time !== 0 || site.signal_reload ||
      !environmentMatches(site, dataDirectory, 'SECURE_COOKIES=1', 'TRUST_PROXY=1')) {
    throw new Error('Unexpected site configuration. Inspect Alwaysdata before continuing.');
  }
  validateReleasePath(site);
}

function makeManifest(tree) {
  return tree.split('\0').filter(Boolean).map(entry => {
    const tab = entry.indexOf('\t');
    const match = /^(100644|100755) blob ([a-f0-9]{40})$/.exec(entry.slice(0, tab));
    if (!match || tab < 0) throw new Error('Release contains an unsupported Git entry.');
    return [entry.slice(tab + 1), match[2]];
  });
}

// The lock lives for the SSH session. EOF or a lost connection releases it without a cleanup command.
async function withActivationLock(args, activate, spawnSsh = spawn) {
  const child = spawnSsh('ssh', [...args,
    `umask 077; flock -n '${home}/.random-deploy-activation.lock' sh -c 'echo locked; cat >/dev/null'`],
  { stdio: ['pipe', 'pipe', 'inherit'] });
  child.stdin.on('error', () => {});
  const closed = new Promise(resolve => child.once('close', resolve));
  const lines = createInterface({ input: child.stdout });
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', () => reject(new Error('Could not acquire activation lock. Another deployment may be activating, or SSH failed.')));
      lines.once('line', line => line === 'locked' ? resolve() : reject(new Error('Unexpected activation lock response.')));
    });
    return await activate(() => {
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error('Lost the activation lock connection. Check deploy:status before retrying.');
    });
  } finally {
    lines.close();
    child.stdin.end();
    await closed;
  }
}

function createDeployment({
  runCommand = run, request = fetch, lock = withActivationLock, print = console.log,
  pause = delay, key = process.env.RANDOM_DEPLOY_SSH_KEY || path.join(os.homedir(), '.ssh', 'random_alwaysdata_deploy'),
  tokenFile = process.env.RANDOM_DEPLOY_TOKEN_FILE || path.join(root, 'var', 'alwaysdata-api-token'),
} = {}) {
  const sshArgs = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'IdentitiesOnly=yes',
    '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=3', '-i', key, host];
  const ssh = (command, options) => runCommand('ssh', [...sshArgs, command], options);
  const remote = (operation, values = [], options) =>
    ssh(`python3 -c "import base64;exec(base64.b64decode('${remoteScript}'))" ${[operation, ...values].map(v => `'${v}'`).join(' ')}`, options);

  async function api(method = 'GET', body) {
    const token = fs.readFileSync(tokenFile, 'utf8').trim();
    if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('Invalid API token file.');
    const authorization = Buffer.from(`${token} account=${account}:`).toString('base64');
    const response = await request(siteApi, {
      method, headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json', 'alwaysdata-synchronous': 'yes' },
      body: body && JSON.stringify(body), signal: AbortSignal.timeout(30000), redirect: 'error',
    });
    if (!response.ok) throw new Error(`Alwaysdata API ${method} returned HTTP ${response.status}.`);
    if (method === 'GET') return response.json();
    await response.text();
  }

  async function probe() {
    const response = await request(siteUrl + '/?deploy=' + randomUUID(), {
      signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store',
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new Error(`HTTPS returned HTTP ${response.status}.`);
    }
    const html = await response.text();
    if (!html.includes('/app.js')) throw new Error('Unexpected HTTPS response.');
    const release = response.headers.get('x-random-release');
    return releasePattern.test(release) ? release : null;
  }

  async function status() {
    print(`Site: ${siteUrl}`);
    let configured;
    let running;
    try {
      const site = await api();
      validateReleasePath(site);
      configured = site.working_directory;
      print(`Configured release: ${configured} (commit ${releasePattern.exec(configured)?.[1] || 'unknown'})`);
    } catch (error) {
      print(`Configured release unavailable or invalid: ${error.message}`);
    }
    try {
      running = await probe();
      print(running
        ? `HTTPS HTTP 200. Running release: ${running} (commit ${releasePattern.exec(running)[1]})`
        : 'HTTPS HTTP 200. Running release unknown. The response did not identify a release.');
    } catch (error) {
      print(`Running release unavailable: ${error.message}`);
    }
    if (!configured || !running) throw new Error('Could not verify the configured release is serving traffic.');
    if (running !== configured) throw new Error('The running release differs from the configured release.');
    print('Configured release is serving traffic.');
  }

  function gitHead() {
    if (runCommand('git', ['branch', '--show-current']).trim() !== 'main') throw new Error('Checkout must be on main.');
    if (runCommand('git', ['status', '--porcelain']).trim()) throw new Error('Commit or discard local changes before deployment.');
    const head = runCommand('git', ['rev-parse', 'HEAD']).trim();
    const latest = runCommand('git', ['ls-remote', 'origin', 'refs/heads/main']).trim().split(/\s+/)[0];
    if (!/^[0-9a-f]{40}$/.test(head) || head !== latest) throw new Error('HEAD must equal the current origin/main.');
    return head;
  }

  async function prerequisites(operation) {
    const site = await api();
    if (operation === 'deploy') validateSite(site);
    else if (!environmentMatches(site, dataDirectory))
      throw new Error('Unexpected production database directory. Inspect Alwaysdata before backing up.');
    if (!fs.existsSync(key)) throw new Error(`SSH key not found: ${key}`);
    print(remote('check', [operation]).trim());
    return site;
  }

  async function check() {
    const head = gitHead();
    print(`Intended commit: ${head}`);
    const site = await prerequisites('deploy');
    print('Deployment prerequisites passed. Application availability is checked after activation.');
    return { head, site };
  }

  function saveBackup() {
    const saved = remote('backup').trim();
    if (!/^\/home\/ttrpg-random\/random-backups\/random-[a-f0-9TZ-]+\.sqlite$/.test(saved))
      throw new Error('Unexpected backup output.');
    print(`Verified backup: ${saved}`);
    return saved;
  }

  async function backup() {
    await prerequisites('backup');
    return saveBackup();
  }

  async function deploy() {
    const { head, site } = await check();
    print('Running local tests...');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    runCommand(npm, ['test'], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (gitHead() !== head) throw new Error('Commit changed while tests ran.');

    const release = `random-release-${head}-${randomUUID().replaceAll('-', '')}`;
    const remoteDir = `${home}/${release}`;
    // Keep app files byte-for-byte. Pass the archive as binary and the manifest through stdin on Windows.
    const archive = runCommand('git', ['-c', 'core.autocrlf=false', 'archive', '--format=tar', head],
      { encoding: null, maxBuffer: 256 * 1024 * 1024 });
    ssh(`umask 077; mkdir '${remoteDir}' && tar -xf - -C '${remoteDir}'`,
      { input: archive, encoding: null });
    const files = makeManifest(runCommand('git', ['ls-tree', '-rz', head]));
    print(remote('verify', [release], { input: JSON.stringify(files) }).trim());
    const expected = runCommand('git', ['show', `${head}:public/app.js`], { encoding: null });
    const saved = saveBackup();
    print(remote('migration', [release, path.posix.basename(saved)]).trim());
    if (gitHead() !== head) throw new Error('Commit changed during preparation.');

    await lock(sshArgs, async assertLocked => {
      const current = await api();
      validateSite(current);
      if (current.command !== site.command || current.working_directory !== site.working_directory)
        throw new Error('Site configuration changed during preparation. The release was staged without activation.');
      assertLocked();
      print('Activating release through Alwaysdata...');
      try {
        await api('PATCH', { command: `node ${remoteDir}/server/index.js`, working_directory: release });
      } catch (error) {
        throw new Error(`Activation could not be confirmed: ${error.message} Run npm run deploy:status before retrying.`);
      }

      let lastError;
      for (let attempt = 0; attempt < 12; attempt++) {
        assertLocked();
        try {
          const after = await api();
          validateSite(after);
          if (after.working_directory !== release) throw new Error('Alwaysdata does not show the expected release.');
          const running = await probe();
          if (running !== release) throw new Error(`HTTPS reports ${running || 'an unknown release'} instead of ${release}.`);
          const asset = await request(siteUrl + '/app.js?deploy=' + release, {
            headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store',
          });
          if (!asset.ok || !Buffer.from(await asset.arrayBuffer()).equals(expected))
            throw new Error('Live app.js does not match the release.');
          assertLocked();
          print(`Deployment verified: ${head}\nBackup: ${saved}\nPrevious release: ${site.working_directory}`);
          return;
        } catch (error) {
          lastError = error;
          if (attempt < 11) await pause(3000);
        }
      }
      throw new Error(`Activation was requested but could not be verified: ${lastError.message} Check deploy:status and the Alwaysdata process log.`);
    });
  }

  return { deploy, check, status, backup };
}

async function main() {
  const command = process.argv[2];
  if (!['deploy', 'check', 'status', 'backup'].includes(command))
    throw new Error('Usage: node scripts/deploy.js {deploy|check|status|backup}');
  await createDeployment()[command]();
}

if (require.main === module) main().catch(error => {
  console.error(`Deployment error: ${error.message}`);
  process.exitCode = 1;
});
module.exports = { createDeployment, validateSite, withActivationLock };
