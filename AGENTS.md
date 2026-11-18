# RANDOM website contributor guide

This repository is the standalone website. The canonical English and French
rulebooks are the Markdown files in `documentation/`; do not change their rules to
match an implementation. Their generated HTML, fonts, illustrations, reader,
and build inputs belong together. Rebuild with `node documentation/rulebook/build.js`
only after an explicitly authorized rulebook or reader change, never by hand.

`rpg/` contains the Discord-independent domain implementation, catalogs, and
translations migrated from the bot. Keep its formulas, generator weights, routing,
schemas, and field catalogs authoritative. Website identity, access, and
persistence are implemented separately in `server/`; do not use the legacy bot
settings as website permissions or implement RPG calculations in the browser.

The web server is intentionally a single Node process. SQLite owns persistent
data and transactional history. Presence, editing locks, previews, and campaign
chat are in memory. Every entity read, mutation, subscription, image request, and
live event must check current server-side authorization. In particular, do not
expose private entity names, portraits, or events to unauthorized campaign members,
except for the explicitly limited Playing Character preview. Locks cannot be
forcibly released by an owner or administrator.

Keep both interface languages usable. A saved entity's generated text is never
translated automatically. Any newly generated artwork must use appropriate files
from `media/references/` as actual image inputs, and its prompt, input paths, and
hashes must be recorded in `media/website-artwork.json`.

Do not commit configuration, credentials, database files, uploads, or chat. Use
isolated temporary databases for tests. Run `npm test`, check the affected browser
flows when changing the interface, and preserve the original bot checkout and its
real saves. See `README.md` for setup and Alwaysdata deployment.
