# Alwaysdata deployment

When possible, create the required accounts on a private local or staging
instance, import and verify the saves there, then use that verified database for
the initial deployment. Transfer it as a consistent SQLite backup or copy the
stopped application's database with its WAL files. If the
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

See Alwaysdata's [Node.js configuration](https://help.alwaysdata.com/en/docs/web-hosting/languages/nodejs/configuration/) and [HTTP stack](https://help.alwaysdata.com/en/docs/web-hosting/sites/http-stack/) documentation. A continuously running service behind a reverse proxy may be appropriate if the hosting site's idle shutdown is unsuitable for long sessions; see [Alwaysdata's site guidance](https://help.alwaysdata.com/en/docs/web-hosting/sites/misc/).

## Current hosting observations

The existing site `ttrpg-random.alwaysdata.net` (site 1106281) is configured as Node.js 24, with a versioned release working directory and `RANDOM_DATA_DIR=/home/ttrpg-random/random-data`. Use `npm run deploy:status` to inspect the current release. HTTPS is forced, the site cache is disabled, and idle time is 0. Alwaysdata documents that 0 prevents idle shutdown but maintenance can still stop a process; the first request starts it. Check current settings before changing them. The process log is available in the administration panel and under `/home/ttrpg-random/admin/logs/sites`; HTTP logs are under `admin/logs/http`.

## Routine deployment from Windows

The commands require Node 22.13+, Git, OpenSSH, HTTPS access, an authorized SSH key and an Alwaysdata API token. They target the site and paths documented above. They never deploy on Git pushes. A restart interrupts requests and clears in-memory chat, presence and editing locks; coordinate a maintenance window. Database migrations run automatically at startup.

The configured PC uses `%USERPROFILE%\.ssh\random_alwaysdata_deploy` and the Git-ignored `var/alwaysdata-api-token`. Configure another machine by authenticating SSH with an authorized key, verifying the host fingerprint against the Alwaysdata panel, and storing an API token in a private file outside Git. Set `RANDOM_DEPLOY_SSH_KEY` and `RANDOM_DEPLOY_TOKEN_FILE` to those paths when the defaults do not apply. The API token grants the permissions of the Alwaysdata profile, not just restart access: restrict file permissions, never share or commit it, and revoke it in Alwaysdata if exposed. Two-factor authentication is required by Alwaysdata to create a token.

From the repository root in PowerShell:

```powershell
npm run deploy:status  # compare the configured and running releases
npm run deploy:check   # read-only readiness checks
npm run deploy:backup  # create and verify a private online SQLite backup
npm run deploy         # validate, back up, stage, activate and verify
```

**Readiness and backups.** `deploy:check` requires a clean `main` checkout that matches the current remote `origin/main`. It checks Alwaysdata API access and settings, SSH, server tools, and database access. HTTPS application failures do not block a deployment or a backup. `deploy:backup` checks API access, SSH, and SQLite, then uses SQLite's online backup API to include committed WAL contents. It publishes the snapshot under `/home/ttrpg-random/random-backups` only after checking integrity and foreign keys. Copy verified backups to a separate private location and test recovery.

**Deployment.** `deploy` runs local tests and transfers an archive of the exact commit with `core.autocrlf=false` to preserve rulebook fingerprints. It verifies the archived files, takes a backup and tests startup migrations on a temporary copy. Alwaysdata updates the command and working directory together and restarts the site. Success requires a healthy HTTPS response from the expected release and a byte-for-byte match of the served `app.js`. Review sign-in, a sheet and its history, and a campaign with authorized accounts after deployment.

**Status.** The configured release comes from Alwaysdata. The running release is reported by the process over HTTPS using the identity it captured at startup. Older releases can answer successfully without identifying themselves. In that case the running release is unknown. A failed probe leaves it unavailable. Status exits with an error when it cannot confirm the configured release is serving traffic or when the two releases differ.

**Interrupted runs.** Each attempt has its own staging and migration paths. An SSH session holds the activation lock and releases it when the session ends, so a retry can proceed after the host detects a lost connection. Incomplete releases and private scratch directories may remain after a hard interruption. They cannot block a new attempt and can be reviewed later to reclaim quota. Keep active and previous releases and verified backups. If an API request times out during activation, run `npm run deploy:status` and inspect the process log before retrying. The tool preserves the live database and leaves any recovery decision to the operator.

Run `node --test tests/deploy.test.js` to exercise the CLI with simulated SSH and HTTPS. Run `python tests/deploy-remote.test.py` to exercise the server helper with temporary files and a SQLite WAL database. Both suites run without production credentials or network access to Alwaysdata.

## Initial setup and manual fallback

The initial setup above is separate from routine deployment. If automation is unavailable, stop edits, take a consistent SQLite online backup, archive the intended committed `main` version with `git -c core.autocrlf=false archive`, upload it to a new private release directory and verify it. Test migrations against a copy of the backup. In **Web → Sites**, update both the Node.js command and working directory to the new release; submitting the form triggers a restart. Preserve the data path and site settings, then verify HTTPS and application logs. The previous release and backups must be retained for recovery.

## Recovery and troubleshooting

Retain the previous release and backup. If a release fails, inspect `/home/ttrpg-random/admin/logs/sites` and the site configuration first. Switching to old code is safe only after checking its compatibility with the current schema; startup migrations may have already changed the live database. Never automatically replace the live database with an older backup: that would lose later writes. If restoration is necessary, stop writes, preserve a fresh consistent copy of the current database, assess what would be lost, and obtain explicit approval before restoring. Test restoration separately before reopening. An idle time of 0 prevents inactivity shutdown but does not guarantee uninterrupted operation during host maintenance.
