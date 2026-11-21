# RANDOM TTRPG

A standalone English/French home for RANDOM: character and creature sheets, generators, dice, campaigns and illustrated rulebooks, independent of Discord.

## Quick start

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

## Documentation

- [Website user guide](documentation/user-guide.md) · [Guide utilisateur en français](documentation/user-guide-fr.md)
- [Development and architecture](documentation/development.md)
- [Alwaysdata deployment](documentation/deployment.md)
- [Importing Discord saves](documentation/legacy-migration.md)
- [Agent instructions](AGENTS.md)
- [Canonical English rules](documentation/TTRPG_RANDOM_RULES_EN.md) · [Règles françaises](documentation/JDR_RANDOM_RULES_FR.md)

Run `npm test` for the automated suite; see the development guide for browser tests and rulebook builds.
