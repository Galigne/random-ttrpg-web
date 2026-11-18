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

## Alwaysdata deployment

1. Clone or upload this repository into a private application directory, for example `/home/ACCOUNT/random-ttrpg-web`, and select Node 24 in **Environment → Node.js**. No package installation or build is needed.
2. Create a private data directory, for example `/home/ACCOUNT/random-data`, and restrict its permissions. Over SSH, set `RANDOM_DATA_DIR` to that directory and run `node server/init-admin.js YourAdminName` once.
3. In **Web → Sites**, create a **Node.js** site for the desired domain. Set its working directory to the checkout and its command to `node /home/ACCOUNT/random-ttrpg-web/server/index.js`. Alwaysdata supplies `IP`/`HOST` and `PORT`; the server uses those values. Configure `RANDOM_DATA_DIR`, `SECURE_COOKIES=1`, and `TRUST_PROXY=1` in the site's environment.
4. Enable HTTPS and redirect HTTP to HTTPS. Keep the site's HTTP cache disabled for application responses and allow long-lived server-sent-event connections; the application sends `X-Accel-Buffering: no` for live streams. Run **one** application instance, since chat, presence, and edit locks are deliberately in memory.
5. Start the site, sign in, and test registration, a campaign session, and the rulebook. Site process logs are available under Alwaysdata's site logs. A server restart clears temporary chat, presence, and locks but preserves accounts, campaigns, sheets, permissions, history, and images.

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
