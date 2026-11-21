# Alwaysdata deployment

When possible, create the required accounts on a private local or staging
instance, import and verify the saves there, then use that verified database for
the initial deployment. Transfer it as a consistent SQLite backup or copy the
stopped application's database with its WAL files as described above. If the
accounts are created on Alwaysdata instead, perform the import against that
database while the site is stopped and restricted. Do not replace a database
that already contains newer accounts or changes.

1. Clone or upload this repository into a private application directory, for example `/home/ACCOUNT/random-ttrpg-web`, and select Node 24 in **Environment → Node.js**. No package installation or build is needed.
2. Create a private data directory, for example `/home/ACCOUNT/random-data`, and restrict its permissions. Place the verified initial database there, or, for a new database, set `RANDOM_DATA_DIR` over SSH and run `node server/init-admin.js YourAdminName` once. If importing bot saves on Alwaysdata, provision the other required accounts and complete the import as described above before opening the website for normal use.
3. In **Web → Sites**, create a **Node.js** site for the desired domain. Set its working directory to the checkout and its command to `node /home/ACCOUNT/random-ttrpg-web/server/index.js`. Alwaysdata supplies `IP`/`HOST` and `PORT`; the server uses those values. Configure `RANDOM_DATA_DIR`, `SECURE_COOKIES=1`, and `TRUST_PROXY=1` in the site's environment.
4. Enable HTTPS and redirect HTTP to HTTPS. Keep the site's HTTP cache disabled for application responses and allow long-lived server-sent-event connections; the application sends `X-Accel-Buffering: no` for live streams. Run **one** application instance, since chat, presence, and edit locks are deliberately in memory.
5. Start the site with access restricted while provisioning accounts and importing any legacy saves. Then sign in and test registration, imported sheets, a campaign session, and the rulebook before opening access. Site process logs are available under Alwaysdata's site logs. A server restart clears temporary chat, presence, and locks but preserves accounts, campaigns, sheets, permissions, history, and images.

The checkout's required media occupy approximately 97 MB before Git history,
the database, uploaded images, and backups. Allow sufficient hosting storage, or
upload the working tree without its `.git` directory to save space.

See Alwaysdata's [Node.js configuration](https://help.alwaysdata.com/fr/docs/hebergement-web/langages/nodejs/configuration/) and [HTTP stack](https://help.alwaysdata.com/en/docs/web-hosting/sites/http-stack/) documentation. A continuously running service behind a reverse proxy may be appropriate if the hosting site's idle shutdown is unsuitable for long sessions; see [Alwaysdata's site guidance](https://help.alwaysdata.com/en/docs/web-hosting/sites/misc/).

## Current hosting observations

The existing site `ttrpg-random.alwaysdata.net` (site 1106281) is configured as Node.js 24, with working directory `/home/ttrpg-random/random-release-6a90b2d8-exact` (commit `6a90b2d8ed8ef9ed7af3d6d222e6f3b42a044c9f`) and `RANDOM_DATA_DIR=/home/ttrpg-random/random-data`. HTTPS is forced, the site cache is disabled, and idle time is 0. Alwaysdata documents that 0 prevents idle shutdown but maintenance can still stop a process; the first request starts it. Check current settings before changing them. The process log is available in the administration panel and under `/home/ttrpg-random/admin/logs/sites`; HTTP logs are under `admin/logs/http`.

**Routine deployment is not yet configured or verified.** Do not treat the initial setup above as a safe update procedure or overwrite the existing database. A restart loses in-memory chat, presence and locks; startup may migrate SQLite. Obtain a consistent backup including committed WAL data before updating, preserve the old application version, and get explicit approval before a production deployment. Never restore an older backup over newer production data automatically. Use the Alwaysdata site restart control or its [site restart API](https://help.alwaysdata.com/en/docs/development/api/) after a safe, verified application update. Recovery requires assessing schema compatibility and preserving the current database before any manual restoration; consult the site logs and test a backup separately. The exact workflow remains to be established after inspecting the deployed files and SSH access.

On 2026-11-21, the old application directory `/home/ttrpg-random/random-ttrpg-web` was retained, and the WAL-aware pre-switch backup `/home/ttrpg-random/random-backups/pre-switch-20261121T124439Z.sqlite` passed `integrity_check`. The live database migrated from unversioned schema 0 to schema 3. Do not switch back to older code or restore an old database without first assessing schema compatibility and preserving all newer data. A backup is a point-in-time snapshot and does not include later writes.

## Manual update until automation is configured

There are currently no `npm run deploy`, `deploy:check`, `deploy:status`, or `deploy:backup` scripts. Do not assume that pushing to Git deploys the site. Use this procedure explicitly, and announce a maintenance window: a restart clears temporary chat, presence and editing locks, and startup may migrate the database. Stop normal edits before the backup; a backup taken while users continue to write is only a point-in-time snapshot.

1. On `main`, inspect the intended commit and local changes, then run `npm test`. Make sure the desired commit is on `origin/main`. In PowerShell, from the repository root, create an archive of that commit (not the working tree):

   ```powershell
   git status --short --branch
   git rev-parse HEAD
   npm test
   git -c core.autocrlf=false archive --format=tar.gz --output=var/random-release.tar.gz HEAD
   ```

   Disabling conversion preserves the canonical rulebooks’ byte fingerprints. The archive contains only committed files. Do not use a local database, `.env`, private key, or backup in a release.
2. Check SSH host fingerprints against the Alwaysdata administration panel and connect using the existing account and key. Keep host-key verification enabled. Ensure sufficient account quota for the archive, extracted release and backup. An operating-system `df` result alone does not establish account quota.
3. With normal edits stopped, create a private consistent backup using SQLite’s online backup API; a plain copy of `random.sqlite` alone can omit committed WAL transactions. On the server:

   ```sh
   umask 077
   mkdir -p "$HOME/random-backups"
   chmod 700 "$HOME/random-backups"
   NODEJS_VERSION=24 node <<'NODE'
   const { DatabaseSync, backup } = require('node:sqlite');
   const fs = require('node:fs');
   const path = require('node:path');
   (async () => {
     const name = `random-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
     const dest = path.join(process.env.HOME, 'random-backups', name);
     fs.closeSync(fs.openSync(dest, 'wx', 0o600));
     const src = new DatabaseSync(path.join(process.env.HOME, 'random-data', 'random.sqlite'), { readOnly: true });
     try { await backup(src, dest); } finally { src.close(); }
     const db = new DatabaseSync(dest, { readOnly: true });
     try {
       const integrity = db.prepare('PRAGMA integrity_check').all();
       const foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
       if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || foreignKeys.length) throw new Error('Backup verification failed');
     } finally { db.close(); }
     console.log(`Verified backup: ${dest}`);
   })().catch(error => { console.error(error.message); process.exitCode = 1; });
   NODE
   ```

   Keep a copy outside the hosting account and test recovery on a separate database. A failed or incomplete backup must not be used.
4. Upload the archive using your verified SSH connection. Extract into a newly created, private release directory outside `random-data`, never over the active release. Verify the extracted files against the commit and test it. On a memory-constrained host, run Node 24 tests sequentially with `NODE_OPTIONS=--max-old-space-size=128 node --test --test-concurrency=1 tests/*.test.js rpg/scripts/generatorProductionIntegrity.test.js`; investigate failures and resource kills before proceeding. Test startup migrations on a **copy** of the backup.
5. In Alwaysdata **Web → Sites**, update the command and working directory together to the new release; submitting the change restarts the site. Preserve the environment variables, Node 24, HTTPS, disabled cache and idle time 0. Request the HTTPS site to start it, inspect process logs for the new path and successful startup, and check sign-in, a sheet and history, and a campaign with authorized accounts. A successful HTTP response alone does not verify these workflows.

## Recovery and troubleshooting

Retain the previous release and backup. If a release fails, inspect `/home/ttrpg-random/admin/logs/sites` and the site configuration first. Switching to old code is safe only after checking its compatibility with the current schema; startup migrations may have already changed the live database. Never automatically replace the live database with an older backup: that would lose later writes. If restoration is necessary, stop writes, preserve a fresh consistent copy of the current database, assess what would be lost, and obtain explicit approval before restoring. Test restoration separately before reopening. An idle time of 0 prevents inactivity shutdown but does not guarantee uninterrupted operation during host maintenance.
