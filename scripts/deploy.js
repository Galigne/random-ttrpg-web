const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const host = 'ttrpg-random@ssh-ttrpg-random.alwaysdata.net';
const siteId = '1106281';
const account = 'ttrpg-random';
const home = '/home/ttrpg-random';
const url = 'https://ttrpg-random.alwaysdata.net';
const key = process.env.RANDOM_DEPLOY_SSH_KEY || path.join(os.homedir(), '.ssh', 'random_alwaysdata_deploy');
const tokenFile = process.env.RANDOM_DEPLOY_TOKEN_FILE || path.join(root, 'var', 'alwaysdata-api-token');
const args = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'IdentitiesOnly=yes', '-o', 'ConnectTimeout=15', '-i', key, host];
function run(cmd, argv, options = {}) {
  const r = spawnSync(cmd, argv, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
  if (r.error || r.status !== 0) throw new Error(`${cmd} failed: ${r.error?.message || String(r.stderr || '').trim() || `exit ${r.status}`}`);
  return r.stdout || '';
}
function ssh(command, options = {}) { return run('ssh', [...args, command], options); }
function python(source, options = {}) {
  const code = Buffer.from(source).toString('base64');
  return ssh(`python3 -c "import base64;exec(base64.b64decode('${code}'))"`, options);
}
function token() {
  const t = fs.readFileSync(tokenFile, 'utf8').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(t)) throw new Error('Invalid API token file');
  return t;
}
async function api(method = 'GET', body) {
  const authorization = Buffer.from(`${token()} account=${account}:`).toString('base64');
  const response = await fetch(`https://api.alwaysdata.com/v1/site/${siteId}/`, {
    method, headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json', 'alwaysdata-synchronous': 'yes' },
    body: body && JSON.stringify(body), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Alwaysdata API ${method} failed with HTTP ${response.status}; inspect the site before retrying.`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
function validateSite(site) {
  if (site.type !== 'nodejs' || site.nodejs_version !== '24' || !site.ssl_force || site.cache_enabled || site.max_idle_time !== 0 ||
      !['RANDOM_DATA_DIR=/home/ttrpg-random/random-data', 'SECURE_COOKIES=1', 'TRUST_PROXY=1'].every(value => (site.environment || '').split(/\s+/).includes(value)))
    throw new Error('Unexpected site configuration; inspect Alwaysdata before continuing.');
  if (!/^node \/home\/ttrpg-random\/[a-zA-Z0-9._-]+\/server\/index\.js$/.test(site.command) || !/^[a-zA-Z0-9._-]+$/.test(site.working_directory) || site.command !== `node ${home}/${site.working_directory}/server/index.js`)
    throw new Error('Unexpected application path; inspect Alwaysdata before continuing.');
}
async function health() {
  const r = await fetch(url + '/', { signal: AbortSignal.timeout(30000), redirect: 'error' });
  if (r.status !== 200) throw new Error(`Site health check returned HTTP ${r.status}`);
  const html = await r.text();
  if (!html.includes('/app.js')) throw new Error('Unexpected site response');
}
async function status() {
  const site = await api(); validateSite(site);
  const name = site.working_directory;
  const match = name.match(/^random-release-([a-f0-9]{8,40})(?:-exact|-[0-9]+)?$/);
  let commit = match ? match[1] : 'unknown';
  if (match && commit.length < 40) { try { commit = run('git', ['rev-parse', '--verify', `${commit}^{commit}`]).trim(); } catch {} }
  console.log('Site:', url, '\nRelease directory:', name, '\nCommit from directory:', commit);
  console.log(ssh(`test -f '${home}/${name}/server/index.js' && echo 'Application files accessible'`).trim());
  await health(); console.log('HTTPS: HTTP 200');
  return site;
}
function gitHead() {
  if (run('git', ['branch', '--show-current']).trim() !== 'main') throw new Error('Checkout must be on main');
  if (run('git', ['status', '--porcelain']).trim()) throw new Error('Commit or discard local changes before deployment');
  const head = run('git', ['rev-parse', 'HEAD']).trim();
  const remote = run('git', ['ls-remote', 'origin', 'refs/heads/main']).trim().split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(head) || head !== remote) throw new Error('HEAD must equal the current origin/main');
  return head;
}
const backupCode = `import os,sqlite3,datetime\nos.umask(0o077)\nd=os.path.expanduser('~/random-backups')\nos.makedirs(d,mode=0o700,exist_ok=True)\np=os.path.join(d,'random-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.sqlite')\na=sqlite3.connect('file:/home/ttrpg-random/random-data/random.sqlite?mode=ro',uri=True)\nb=sqlite3.connect(p)\na.backup(b)\nok=b.execute('PRAGMA integrity_check').fetchall()\nfk=b.execute('PRAGMA foreign_key_check').fetchall()\nb.close(); a.close()\nif ok != [('ok',)] or fk: raise Exception('Backup verification failed: '+p)\nprint(p)`;
function backup() { const p = python(backupCode).trim(); if (!/^\/home\/ttrpg-random\/random-backups\/random-[0-9T]+Z\.sqlite$/.test(p)) throw new Error('Unexpected backup output'); console.log('Verified backup:', p); return p; }
async function check() {
  if (!fs.existsSync(key)) throw new Error(`SSH key not found: ${key}`);
  token(); const head = gitHead(); console.log('Intended commit:', head);
  const site = await status();
  console.log(python("import os,sqlite3\np='/home/ttrpg-random/random-data/random.sqlite'\nassert os.path.isfile(p) and os.access(p,os.R_OK)\nc=sqlite3.connect('file:'+p+'?mode=ro',uri=True)\nprint('Database accessible; schema',c.execute('PRAGMA user_version').fetchone()[0]); c.close()" ).trim());
  console.log('Readiness checks passed; production was not modified.'); return { head, site };
}
async function deploy() {
  const { head, site } = await check();
  console.log('Running local tests...');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const test = spawnSync(npm, ['test'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (test.error || test.status !== 0) throw new Error('Local tests failed; nothing deployed');
  if (gitHead() !== head) throw new Error('Commit changed while tests ran');
  const lock = `${home}/random-deploy.lock`;
  ssh(`umask 077; mkdir '${lock}'`);
  let archive;
  try {
    const current = await api(); validateSite(current);
    if (current.command !== site.command || current.working_directory !== site.working_directory) throw new Error('Site configuration changed during preparation');
    const saved = backup();
    const release = `random-release-${head}-${Date.now()}`;
    const remoteDir = `${home}/${release}`;
    archive = path.join(os.tmpdir(), `random-release-${crypto.randomUUID()}.tar`);
    run('git', ['-c', 'core.autocrlf=false', 'archive', '--format=tar', `--output=${archive}`, head]);
    const bytes = fs.readFileSync(archive);
    ssh(`umask 077; mkdir '${remoteDir}' && tar -xf - -C '${remoteDir}'`, { input: bytes, encoding: null });
    const tree = run('git', ['ls-tree', '-r', head]);
    const files = tree.split('\n').filter(Boolean).map(line => { const [meta, file] = line.split('\t'); return [file, meta.split(' ')[2]]; });
    const verify = `import hashlib,os,json,sys\nroot=${JSON.stringify(remoteDir)}\nexpected=json.load(sys.stdin)\nfor name,want in expected:\n p=os.path.join(root,name)\n with open(p,'rb') as f: data=f.read()\n got=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\\0'+data).hexdigest()\n if got!=want: raise Exception('Mismatch: '+name)\nprint('Verified',len(expected),'release files')`;
    console.log(python(verify, { input: JSON.stringify(files) }).trim());
    const testCopy = `${home}/random-backups/migration-test-${head}.sqlite`;
    const migration = `import os,shutil,subprocess\nsrc=${JSON.stringify(saved)}\ndst=${JSON.stringify(testCopy)}\nif os.path.exists(dst): raise Exception('Migration test copy already exists')\nshutil.copyfile(src,dst)\ntry:\n env=dict(os.environ,NODEJS_VERSION='24')\n js=\"const d=require('./server/db').openDatabase(process.argv[1]); if(d.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')process.exit(1); d.close()\"\n subprocess.run(['node','-e',js,dst],cwd=${JSON.stringify(remoteDir)},env=env,check=True)\n print('Migration verified on backup copy')\nfinally:\n for suffix in ('','-wal','-shm'):\n  if os.path.exists(dst+suffix): os.remove(dst+suffix)`;
    console.log(python(migration).trim());
    const before = await api(); validateSite(before);
    if (before.command !== site.command || before.working_directory !== site.working_directory) throw new Error('Site configuration changed; release staged but not activated');
    console.log('Activating release; Alwaysdata will restart the process...');
    await api('PATCH', { command: `node ${remoteDir}/server/index.js`, working_directory: release });
    const after = await api(); validateSite(after);
    if (after.command !== `node ${remoteDir}/server/index.js` || after.working_directory !== release) throw new Error('Site configuration does not show the requested release; inspect Alwaysdata');
    const expected = run('git', ['show', `${head}:public/app.js`], { encoding: null });
    const logCheck = `import glob,os
files=sorted(glob.glob('/home/ttrpg-random/admin/logs/sites/*/sites-*.log'))
needle=${JSON.stringify(`Upstream starting: node ${remoteDir}/server/index.js`)}
for name in reversed(files):
 with open(name,errors='replace') as f: text=f.read()
 pos=text.rfind(needle)
 if pos>=0:
  assert 'RANDOM listening at http://' in text[pos:], 'Startup not yet logged'
  print('New release startup recorded in',name)
  break
else: raise Exception('Release startup not yet logged')`;
    let verified = false, lastError;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        await health();
        const remoteAsset = await fetch(url + '/app.js', { headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(15000) });
        if (!remoteAsset.ok || !Buffer.from(await remoteAsset.arrayBuffer()).equals(expected)) throw new Error('Live asset does not match the release');
        console.log(python(logCheck).trim());
        verified = true; break;
      } catch (error) { lastError = error; if (attempt < 11) await new Promise(resolve => setTimeout(resolve, 3000)); }
    }
    if (!verified) throw new Error(`Release was activated but verification failed: ${lastError.message}. Inspect site status and logs; no database restore was attempted.`);
    console.log('Deployment verified:', head, '\nBackup:', saved, '\nPrevious release:', site.working_directory);
  } finally {
    if (archive) try { fs.unlinkSync(archive); } catch {}
    try { ssh(`rmdir '${lock}'`); } catch (e) { console.error(`Could not remove deployment lock ${lock}: ${e.message}`); }
  }
}
async function main() {
  const command = process.argv[2];
  if (command === 'status') await status();
  else if (command === 'check') await check();
  else if (command === 'backup') { await status(); backup(); }
  else if (command === 'deploy') await deploy();
  else throw new Error('Usage: node scripts/deploy.js {deploy|check|status|backup}');
}
if (require.main === module) main().catch(error => { console.error(`Deployment error: ${error.message}`); process.exitCode = 1; });
module.exports = { validateSite };
