# Importing Discord saves

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
