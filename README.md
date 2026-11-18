# RANDOM TTRPG

A standalone English/French home for RANDOM: personal character and creature sheets, the original generators and dice, campaign workspaces, and the illustrated rulebooks. It runs independently of Discord. The original domain code and catalogs were copied from `incroyable-bot-discord` master at `d2dc994`; website accounts and campaign permissions are separate from the bot's legacy access settings.

## Requirements and local setup

- Node.js **22.13 or newer** (Node 24 LTS is recommended). The built-in `node:sqlite` module is still marked experimental in Node 22; a warning at startup is expected.
- A writable directory for the SQLite database. No npm packages or external services are required at runtime.
- One Node process. Presence, edit locks, and campaign chat intentionally live in that process's memory.

From this directory:

```sh
node server/init-admin.js YourAdminName
node server/index.js
```

The initialization command prompts for a password without echoing it and creates the first active Website Admin. It refuses to run if an administrator already exists. Usernames are 3–32 ASCII letters, digits, periods, hyphens, or underscores, beginning with a letter or digit; passwords must have at least 12 characters. Use a unique, long password. Initialization can also read a password from standard input for non-interactive provisioning; avoid putting passwords in command arguments or shell history.

Open `http://127.0.0.1:3000`. Sign in as the administrator. In **Administration**, create a single-use invitation link or approve pending account requests. Invitation links expire after seven days. Password-reset links expire after one hour, can be used once, and revoke the account's existing sessions. Copy a link when it is created; only its hash is stored. There is no email or external login.

Configuration is provided through environment variables; `.env.example` documents them but is **not** automatically loaded. Set them in the shell or in your hosting control panel:

| Variable          | Meaning                                                                          | Default     |
| ----------------- | -------------------------------------------------------------------------------- | ----------- |
| `HOST` or `IP`    | Address the HTTP server binds to                                                 | `127.0.0.1` |
| `PORT`            | HTTP port                                                                        | `3000`      |
| `RANDOM_DATA_DIR` | Directory containing `random.sqlite` and SQLite WAL files                        | `./var`     |
| `SECURE_COOKIES`  | Set to `1` when the public site uses HTTPS                                       | unset       |
| `TRUST_PROXY`     | Set to `1` only behind a trusted proxy that removes incoming `X-Real-IP` headers | unset       |

The data directory and secrets are excluded from Git. Keep it outside any public static-file directory, make it readable and writable only by the application account, and back it up. To take a file copy, stop the application first and copy the database together with any accompanying `-wal` and `-shm` files. Test restoring backups separately.

## Importing Discord saves

The one-time importer reads the bot's real `save/characters` and
`save/creatures` folders and their `.history` subfolders. It never writes to
the source. The destination must be an **existing website SQLite database**,
outside the source directory, with all required website accounts already
created and active. Stop both the bot and website for the import; keep the
source, database, mapping and report private. The source may also be selected
using `INCREDIBLE_BOT_SAVE_DIRECTORY` when `--source` is omitted.

1. Run a dry run without a mapping to identify the legacy keys and Discord IDs
   requiring decisions. A nonzero exit code means the report contains blocking
   errors, as expected when ownership is unresolved:

   ```sh
   node scripts/migrate-legacy.js --source "/path/to/bot/save" --database "/path/to/random.sqlite" --dry-run > var/legacy-report.json
   ```

2. Privately verify each Discord identity with the people concerned and create
   the corresponding active website accounts. Prepare a mapping file, for
   example `var/legacy-mapping.json`. The following values are placeholders;
   replace or remove every example:

   ```json
   {
     "discordUsers": [
       { "discordId": "111111111111111111", "username": "PlayerName", "verified": true },
       { "discordId": "222222222222222222", "username": "EditorName", "verified": true }
     ],
     "ownerResolutions": [
       {
         "type": "character",
         "legacyKey": "OldKey",
         "username": "PlayerName",
         "confirmed": true,
         "reason": "Ownership explicitly confirmed with the group"
       }
     ]
   }
   ```

   `verified: true` records a human verification; the tool cannot prove that a
   Discord user owns a website account. Each mapped username must name an
   active account. A single legacy owner with a verified mapping needs no
   separate resolution. For no owner, multiple owners, or an unmapped owner,
   provide an explicit, confirmed `ownerResolutions` entry and explain the
   decision. Do not use an administrator as a default owner. Mapped legacy
   `partial` users become editors; unmapped editors are listed in the report.
   Unmapped historical authors remain attributed to their original Discord IDs.

3. Repeat the dry run with the mapping, review every error and warning, and
   resolve the blocking errors. Missing history files are reported but can be
   normal for sheets that have not been changed. Orphaned histories, invalid
   saves, unsupported or out-of-order history entries, conflicts and unresolved
   ownership block the **whole** import:

   ```sh
   node scripts/migrate-legacy.js --source "/path/to/bot/save" --database "/path/to/random.sqlite" --mapping var/legacy-mapping.json --dry-run > var/legacy-report.json
   ```

4. With both applications stopped, use the same arguments with `--apply` in
   place of `--dry-run`. The importer validates again while holding the
   database write lock, creates a consistent SQLite backup beside the database
   (including committed WAL contents), inserts all new entities and history in
   one transaction, verifies the imported data and checks that the source has
   not changed before committing. It prints the backup path and import counts.
   Keep the backup private and test restoring it separately. On failure the
   transaction is rolled back; a completed backup is retained.

5. Review the report and open both types of imported sheet with the intended
   accounts. Check their fields, resources, permissions, and Undo/Redo before
   opening the site for normal use. Sheets are private and receive no campaign
   assignments. Grant any initially unmapped editor permissions in the website
   once those users are verified. Repeating the importer does not overwrite
   website edits, change ownership, add later mappings or create duplicates;
   differences in existing permissions are reported. Changed legacy files or
   UUID collisions are reported as conflicts for manual review.

The imported UUID remains stable, while display names may be duplicated. The
database keeps the original EntityKey, full source documents, and each
history action's original timestamp and Discord author as private provenance.
Each old pre-change snapshot becomes a website history version, followed by the
current save; the action and any verified website author belong to the
**following** version. The creator and creation time of the earliest snapshot
are not known: its author is null and its timestamp is the first recorded
action time, or the source file modification time if there is no history.
Original history timestamps and actors are also retained verbatim in the
provenance records.

Never commit the mapping, report, source saves, database, backups, credentials
or uploads. The suggested `var/` files and SQLite backups are Git-ignored.

## Alwaysdata deployment

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

## Using the website

- Create a campaign or accept an invitation from another member. The creator is its Owner and a GM; ownership remains separate from GM membership. Invite existing users from the Members view and manage roles and presentation in the campaign.
- Create a blank sheet in Characters or Creatures, or generate and inspect a complete preview before saving it. A new sheet is private. Owners can give named users viewer/editor access and request assignments to multiple campaigns; a destination GM approves each request. A campaign link or ID also permits a request when the entity owner is not a campaign member; it does not grant membership. Campaign visibility is chosen independently for each assignment.
- Open a sheet from a campaign to announce eligible combat events there. Opening it from the library keeps combat personal. Start an exclusive editing session before modifying fields or using combat actions. Fields save on blur; related fields are validated together. Undo/Redo is a preview until explicitly saved, and can be cancelled. A disconnected or inactive editor loses the lock without an automatic draft save.
- A campaign member may select an eligible assigned character as their Playing Character. Its limited member preview is visible to campaign members even when the complete sheet is private.
- The personal Dice page is private. Campaign rolls can be public or private to the roller and GMs. Chat is temporary: it disappears on server restart or five minutes after the last member leaves that campaign workspace.
- Portraits and campaign covers accept PNG, JPEG, or WebP, at most 4 MiB and 32 million pixels, with no dimension exceeding 8192 pixels. Images are stored in SQLite; portrait history is deduplicated per entity.

## Rulebooks and development

`documentation/TTRPG_RANDOM_RULES_EN.md` and `documentation/JDR_RANDOM_RULES_FR.md` are the canonical sources. Their standalone generated HTML editions, reading tools, bundled fonts, and WebP illustrations are retained in the repository. The website serves the original editions behind authentication. The source renderer is in `documentation/rulebook/`; it reads the Markdown and does not alter it. Do not hand-edit the generated HTML or change rules to fit the website.

The Discord-independent RPG implementation and locale data are under `rpg/`; HTTP routes, permissions, persistence, and live delivery are under `server/`; the browser contains presentation logic only. Uploaded files and the live database never belong in the checkout. The website's entity IDs are stable UUIDs, while display names can repeat and change.

Run validation with:

```sh
npm test
```

This runs website authorization, persistence, lock, chat, image, undo, and dice tests as well as the source project's production generator-integrity suite against the copied domain code and catalogs. The artwork provenance for website-created illustrations is recorded in `media/website-artwork.json`.
