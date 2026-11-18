#!/usr/bin/env node
const {
  dryRun,
  applyMigration,
  hasErrors,
} = require("../server/legacy-migration");

function usage() {
  return [
    "Usage: node scripts/migrate-legacy.js --source SAVE_DIR --database WEBSITE.sqlite",
    "       [--mapping PRIVATE_MAPPING.json] [--dry-run | --apply]",
    "",
    "--source defaults to INCREDIBLE_BOT_SAVE_DIRECTORY when set.",
    "The website database must already exist. Dry-run is the default.",
    "Stop the bot and website before applying; keep mappings and reports private.",
  ].join("\n");
}
function parseArguments(args) {
  const result = {
    source: process.env.INCREDIBLE_BOT_SAVE_DIRECTORY,
    apply: false,
  };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (seen.has(arg)) throw new Error("Duplicate option: " + arg);
    seen.add(arg);
    if (["--source", "--database", "--mapping"].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith("--"))
        throw new Error("Missing value for " + arg);
      result[
        {
          "--source": "source",
          "--database": "database",
          "--mapping": "mappingFile",
        }[arg]
      ] = value;
    } else if (arg === "--apply") result.apply = true;
    else if (arg !== "--dry-run") throw new Error("Unknown option: " + arg);
  }
  if (seen.has("--apply") && seen.has("--dry-run"))
    throw new Error("Choose either --apply or --dry-run.");
  if (!result.source || !result.database)
    throw new Error("Both a source and a destination database are required.");
  return result;
}
async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const report = options.apply
    ? await applyMigration(options)
    : dryRun(options);
  console.log(JSON.stringify(report, null, 2));
  if (hasErrors(report)) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  if (error.backupPath)
    console.error("The pre-import backup is at: " + error.backupPath);
  if (error.incompleteBackupPath)
    console.error(
      "The backup failed and this incomplete file must not be used: " +
        error.incompleteBackupPath,
    );
  process.exitCode = 1;
});
