# Development guide

`documentation/TTRPG_RANDOM_RULES_EN.md` and `documentation/JDR_RANDOM_RULES_FR.md` are the canonical sources. Their standalone generated HTML editions, reading tools, bundled fonts, and WebP illustrations are retained in the repository. The website serves compact web editions behind authentication; the original standalone editions remain available as files. The web editions load optimized artwork as needed and use shared WOFF2 fonts. The source renderer is in `documentation/rulebook/`; it reads the Markdown and does not alter it. Do not hand-edit the generated HTML or change rules to fit the website.

The Discord-independent RPG implementation and locale data are under `rpg/`; HTTP routes, permissions, persistence, and live delivery are under `server/`; the browser contains presentation logic only. Uploaded files and the live database never belong in the checkout. The website's entity IDs are stable UUIDs, while display names can repeat and change.

Run validation with:

```sh
npm test
```

This runs website authorization, persistence, migrations, lock, chat, image, undo, delivery, and dice tests as well as the source project's production generator-integrity suite against the copied domain code and catalogs. The artwork provenance for website-created illustrations is recorded in `media/website-artwork.json`.

A real-browser regression suite covers editing, two-tab locks, live battle updates and reconnection, navigation, the generator, both interface languages, and the rulebook. To run it locally, install Playwright for development and its Chromium browser, then run:

```sh
npm install --no-save --no-package-lock playwright@1.62.1
npx playwright install chromium
npm run test:browser
```

Set `BROWSER_EXECUTABLE` to use an existing Chromium-compatible browser. The browser tests use an in-memory database. CI runs both suites. SQLite schema changes are applied as numbered transactions at startup; back up the database before deploying an upgrade. Older unversioned website databases are upgraded automatically, while a database from a newer schema is rejected.

To rebuild the website-only rulebooks after an authorized reader or rulebook change, run `node documentation/rulebook/build.js --web`. The compact illustrations and fonts are committed; regenerating those derivatives with `python scripts/build-web-assets.py` requires Pillow and `fonttools[woff]`. The command reads the original artwork and fonts and does not change the standalone editions.

## Architecture and responsibilities

`server/index.js` starts one HTTP process and opens the database. `server/app.js` composes routes, authorization, static delivery and live services; route modules handle authentication, campaigns, entities and battles. `server/db.js` owns the numbered schema migrations. `server/live.js` keeps presence, editing locks, previews and campaign chat in memory. Restarts discard this transient state. Images and their history are stored in SQLite, not an uploads directory. `public/` implements presentation and interaction, while `rpg/` owns mechanics, generation, catalogs and domain translations. Do not rely on browser checks for authorization.

`RANDOM_DATA_DIR` selects the private directory holding `random.sqlite` and its WAL files; `.env.example` is a reference and is not loaded automatically. See the [README](../README.md) for all server environment variables. Schema migrations run in numbered transactions when `openDatabase` starts; a newer schema is rejected. Back up production before starting updated code, and never assume older code can read a migrated database. Use temporary or in-memory databases for tests.

Interface strings live in `public/translations.js`; RPG locale data and bilingual generator catalogs live in `rpg/locales/` and `rpg/data/generators/`. See the [generator authoring guide](../rpg/data/generators/README.md) and [architecture](../rpg/data/generators/GENERATOR_ARCHITECTURE.md); some examples describe the original Discord command interface, while website behavior is implemented in `public/` and `server/`. New generated artwork requires actual reference inputs and provenance in `media/website-artwork.json`. See the [rulebook build guide](rulebook/README.md) for its separate artwork and offline editions.
