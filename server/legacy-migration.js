const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const {
  validateCharacterSaveSchema,
} = require("../rpg/services/characterSaveSchema");
const {
  validateCreatureSaveSchema,
} = require("../rpg/services/creatureSaveSchema");
const rpg = require("./rpg");

const kinds = [
  {
    type: "character",
    directory: "characters",
    validate: validateCharacterSaveSchema,
  },
  {
    type: "creature",
    directory: "creatures",
    validate: validateCreatureSaveSchema,
  },
];
const actions = new Set(["set", "damage", "heal", "end-turn"]);
const uuidNamespace = Buffer.from("3f1564ab14bb4d5baf617c501b49f74b", "hex");
const emptyMapping = { discordUsers: [], ownerResolutions: [] };

function issue(issues, severity, code, subject, message) {
  issues.push({ severity, code, subject, message });
}
function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
function entityId(type, key) {
  const bytes = createHash("sha1")
    .update(uuidNamespace)
    .update(type + "\0" + key, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    h.slice(12, 16),
    h.slice(16, 20),
    h.slice(20),
  ].join("-");
}
function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function isTimestamp(value) {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
function readDirectory(directory, subject, issues, optional = false) {
  try {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("must be a real directory, not a file or symbolic link");
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (error.code === "ENOENT" && optional) {
      issue(
        issues,
        "warning",
        "NO_HISTORY_DIRECTORY",
        subject,
        "No history directory exists; no history is available here.",
      );
      return [];
    }
    issue(issues, "error", "MISSING_DIRECTORY", subject, error.message);
    return [];
  }
}
function scanSource(root) {
  const issues = [],
    entities = [],
    signatures = [],
    seenKeys = new Map();
  const counts = {
    charactersFound: 0,
    creaturesFound: 0,
    historyEntriesFound: 0,
  };
  const sourceRoot = path.resolve(root);
  try {
    const stat = fs.lstatSync(sourceRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("Save root must be a real directory.");
  } catch (error) {
    issue(issues, "error", "MISSING_SOURCE", sourceRoot, error.message);
    return { root: sourceRoot, entities, issues, counts, signature: "" };
  }
  for (const kind of kinds) {
    const dir = path.join(sourceRoot, kind.directory);
    const historyDir = path.join(dir, ".history");
    const entries = readDirectory(dir, kind.directory, issues);
    const historyEntries = readDirectory(
      historyDir,
      kind.directory + "/.history",
      issues,
      true,
    );
    const files = new Map(),
      histories = new Map();
    function collect(entry, directory, target, label) {
      if (entry.name === ".history" && directory === dir && entry.isDirectory())
        return;
      const name = label + "/" + entry.name;
      signatures.push(name);
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        issue(
          issues,
          "error",
          "UNEXPECTED_FILE",
          name,
          "Expected a regular .json file.",
        );
        return;
      }
      try {
        const fullPath = path.join(directory, entry.name);
        const bytes = fs.readFileSync(fullPath);
        const stat = fs.statSync(fullPath);
        signatures.push(name + "\0" + hash(bytes));
        target.set(entry.name.slice(0, -5), {
          name,
          bytes,
          mtime: Math.trunc(stat.mtimeMs),
        });
      } catch (error) {
        issue(issues, "error", "UNREADABLE_FILE", name, error.message);
      }
    }
    for (const entry of entries) collect(entry, dir, files, kind.directory);
    for (const entry of historyEntries)
      collect(entry, historyDir, histories, kind.directory + "/.history");
    counts[kind.type === "character" ? "charactersFound" : "creaturesFound"] =
      files.size;
    for (const [key, file] of files) {
      const subject = kind.type + ":" + key;
      if (seenKeys.has(key))
        issue(
          issues,
          "error",
          "DUPLICATE_LEGACY_KEY",
          subject,
          "The same EntityKey exists in both types: " + seenKeys.get(key),
        );
      else seenKeys.set(key, subject);
      let data;
      try {
        data = JSON.parse(file.bytes.toString("utf8"));
        kind.validate(data, key);
      } catch (error) {
        issue(issues, "error", "INVALID_SAVE", file.name, error.message);
        continue;
      }
      const historyFile = histories.get(key);
      let document = null;
      if (!historyFile) {
        issue(
          issues,
          "warning",
          "NO_HISTORY_FILE",
          subject,
          "No history file exists; this is normal if no changes were recorded.",
        );
      } else {
        try {
          document = JSON.parse(historyFile.bytes.toString("utf8"));
          const validEnvelope =
            isRecord(document) &&
            Array.isArray(document.entries) &&
            (kind.type === "character"
              ? Object.keys(document).length === 1
              : Object.keys(document).length === 2 &&
                document.type === "creature");
          if (!validEnvelope)
            throw new Error("Invalid legacy history envelope.");
          counts.historyEntriesFound += document.entries.length;
          let previousTime = -Infinity;
          for (const [index, entry] of document.entries.entries()) {
            if (
              !isRecord(entry) ||
              !isTimestamp(entry.createdAt) ||
              typeof entry.actorId !== "string" ||
              !entry.actorId.trim() ||
              !actions.has(entry.action)
            )
              throw new Error(
                "Entry " +
                  index +
                  " has invalid or unrepresentable metadata or action.",
              );
            const time = Date.parse(entry.createdAt);
            if (time < previousTime)
              throw new Error(
                "Entry " + index + " is out of chronological order.",
              );
            previousTime = time;
            kind.validate(entry[kind.type], key);
          }
        } catch (error) {
          issue(
            issues,
            "error",
            "INVALID_HISTORY",
            historyFile.name,
            error.message,
          );
          continue;
        }
      }
      entities.push({
        ...kind,
        key,
        subject,
        data,
        file,
        historyFile,
        document,
      });
    }
    for (const [key, file] of histories) {
      if (!files.has(key))
        issue(
          issues,
          "error",
          "ORPHAN_HISTORY",
          file.name,
          "The corresponding current save is missing.",
        );
    }
  }
  signatures.sort();
  return {
    root: sourceRoot,
    entities,
    issues,
    counts,
    signature: hash(signatures.join("\n")),
  };
}

function readMapping(filename) {
  if (!filename) return structuredClone(emptyMapping);
  const mapping = JSON.parse(fs.readFileSync(filename, "utf8"));
  if (
    !isRecord(mapping) ||
    !Array.isArray(mapping.discordUsers) ||
    !Array.isArray(mapping.ownerResolutions) ||
    Object.keys(mapping).some(
      (key) => !["discordUsers", "ownerResolutions"].includes(key),
    )
  )
    throw new Error(
      "Mapping must contain only discordUsers and ownerResolutions arrays.",
    );
  return mapping;
}
function websiteSnapshot(data, id, type) {
  const copy = structuredClone(data);
  copy.key = id;
  copy.settings = { visibility: "private", access: [] };
  const hydrated = rpg.hydrate(type, copy);
  rpg.sections(type, hydrated);
  return copy;
}
function tableExists(db, name) {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
      .get(name),
  );
}
function planMigration(db, source, mapping) {
  const issues = [...source.issues],
    mappedUsers = new Map(),
    resolutions = new Map();
  const discoveredUsers = new Set(),
    usedMappedUsers = new Set();
  const activeUser = db.prepare(
    "SELECT id,username FROM users WHERE username=? COLLATE NOCASE AND status='active'",
  );
  for (const entry of mapping.discordUsers) {
    if (
      !isRecord(entry) ||
      typeof entry.discordId !== "string" ||
      !entry.discordId.trim() ||
      typeof entry.username !== "string" ||
      !entry.username.trim() ||
      entry.verified !== true
    ) {
      issue(
        issues,
        "error",
        "INVALID_USER_MAPPING",
        "mapping",
        "Each Discord mapping requires a nonempty discordId, username, and verified: true.",
      );
      continue;
    }
    if (mappedUsers.has(entry.discordId)) {
      issue(
        issues,
        "error",
        "DUPLICATE_USER_MAPPING",
        entry.discordId,
        "Discord ID appears more than once.",
      );
      continue;
    }
    const user = activeUser.get(entry.username);
    if (!user) {
      issue(
        issues,
        "error",
        "ACCOUNT_NOT_ACTIVE",
        entry.discordId,
        "The mapped website account does not exist or is not active: " +
          entry.username,
      );
      continue;
    }
    mappedUsers.set(entry.discordId, user);
  }
  for (const entry of mapping.ownerResolutions) {
    if (
      !isRecord(entry) ||
      !["character", "creature"].includes(entry.type) ||
      typeof entry.legacyKey !== "string" ||
      !entry.legacyKey ||
      typeof entry.username !== "string" ||
      !entry.username.trim() ||
      entry.confirmed !== true ||
      typeof entry.reason !== "string" ||
      !entry.reason.trim()
    ) {
      issue(
        issues,
        "error",
        "INVALID_OWNER_RESOLUTION",
        "mapping",
        "Each owner resolution requires type, legacyKey, username, confirmed: true, and a reason.",
      );
      continue;
    }
    const key = entry.type + ":" + entry.legacyKey;
    if (resolutions.has(key)) {
      issue(
        issues,
        "error",
        "DUPLICATE_OWNER_RESOLUTION",
        key,
        "Entity appears more than once in owner resolutions.",
      );
      continue;
    }
    const user = activeUser.get(entry.username);
    if (!user) {
      issue(
        issues,
        "error",
        "ACCOUNT_NOT_ACTIVE",
        key,
        "The selected website account does not exist or is not active: " +
          entry.username,
      );
      continue;
    }
    resolutions.set(key, { user, reason: entry.reason });
  }
  for (const key of resolutions.keys()) {
    if (!source.entities.some((entity) => entity.subject === key))
      issue(
        issues,
        "error",
        "UNKNOWN_OWNER_RESOLUTION",
        key,
        "No valid matching source entity exists.",
      );
  }
  const hasImports = tableExists(db, "legacy_entity_imports");
  const planned = [],
    details = [];
  for (const entity of source.entities) {
    const owners = entity.data.settings.access
      .filter((item) => item.level === "owner")
      .map((item) => item.userId);
    const editors = entity.data.settings.access
      .filter((item) => item.level === "partial")
      .map((item) => item.userId);
    for (const userId of [...owners, ...editors]) discoveredUsers.add(userId);
    for (const entry of entity.document?.entries || [])
      discoveredUsers.add(entry.actorId);
    const resolution = resolutions.get(entity.subject);
    let owner = null;
    if (resolution) {
      owner = resolution.user;
      const mappedOwner = owners.length === 1 && mappedUsers.get(owners[0]);
      if (mappedOwner && mappedOwner.id !== owner.id)
        issue(
          issues,
          "error",
          "CONFLICTING_OWNER_RESOLUTION",
          entity.subject,
          "The explicit owner conflicts with the verified Discord owner mapping.",
        );
    } else if (owners.length === 1 && mappedUsers.has(owners[0])) {
      owner = mappedUsers.get(owners[0]);
    } else {
      const code =
        owners.length === 0
          ? "NO_OWNER"
          : owners.length > 1
            ? "MULTIPLE_OWNERS"
            : "UNMAPPED_OWNER";
      issue(
        issues,
        "error",
        code,
        entity.subject,
        "Explicit owner resolution or a verified owner mapping is required.",
      );
    }
    const editorUsers = new Map(),
      unmappedEditors = [];
    for (const discordId of editors) {
      const user = mappedUsers.get(discordId);
      if (!user) unmappedEditors.push(discordId);
      else if (!owner || user.id !== owner.id) editorUsers.set(user.id, user);
    }
    if (unmappedEditors.length)
      issue(
        issues,
        "warning",
        "UNMAPPED_EDITORS",
        entity.subject,
        "Some legacy partial permissions cannot be imported: " +
          unmappedEditors.join(", "),
      );
    const id = entityId(entity.type, entity.key);
    const existing = hasImports
      ? db
          .prepare(
            "SELECT * FROM legacy_entity_imports WHERE legacy_type=? AND legacy_key=?",
          )
          .get(entity.type, entity.key)
      : null;
    const occupied = db.prepare("SELECT id FROM entities WHERE id=?").get(id);
    let status = "ready";
    if (existing) {
      status = "already_imported";
      if (
        existing.entity_id !== id ||
        existing.source_sha256 !== hash(entity.file.bytes) ||
        existing.history_sha256 !==
          (entity.historyFile ? hash(entity.historyFile.bytes) : null)
      ) {
        status = "conflict";
        issue(
          issues,
          "error",
          "IMPORT_CONFLICT",
          entity.subject,
          "The source changed or the recorded identity differs from the previous import.",
        );
      } else {
        const saved = db
          .prepare("SELECT owner_id FROM entities WHERE id=?")
          .get(id);
        if (!saved) {
          status = "conflict";
          issue(
            issues,
            "error",
            "MISSING_IMPORTED_ENTITY",
            entity.subject,
            "The recorded website entity no longer exists.",
          );
        } else if (owner && saved.owner_id !== owner.id) {
          issue(
            issues,
            "warning",
            "EXISTING_OWNER_UNCHANGED",
            entity.subject,
            "The website owner differs from this mapping; repeat imports never change ownership.",
          );
        }
        for (const user of editorUsers.values()) {
          const permission = db
            .prepare(
              "SELECT permission FROM entity_permissions WHERE entity_id=? AND user_id=?",
            )
            .get(id, user.id);
          if (!permission || permission.permission !== "editor")
            issue(
              issues,
              "warning",
              "EXISTING_EDITOR_UNCHANGED",
              entity.subject,
              "The mapped editor " +
                user.username +
                " is not an editor on the existing entity; update permissions explicitly in the website.",
            );
        }
      }
    } else if (occupied) {
      status = "conflict";
      issue(
        issues,
        "error",
        "UUID_CONFLICT",
        entity.subject,
        "The deterministic UUID is already used by a website entity.",
      );
    }
    const snapshots = [];
    try {
      for (const entry of entity.document?.entries || [])
        snapshots.push(websiteSnapshot(entry[entity.type], id, entity.type));
      snapshots.push(websiteSnapshot(entity.data, id, entity.type));
    } catch (error) {
      if (status === "ready") status = "blocked";
      issue(
        issues,
        "error",
        "WEBSITE_VALIDATION_FAILED",
        entity.subject,
        error.message,
      );
    }
    if (!owner && status === "ready") status = "blocked";
    details.push({
      type: entity.type,
      legacyKey: entity.key,
      websiteId: id,
      status,
      legacyOwners: owners,
      resolvedOwner: owner?.username || null,
      unmappedEditors,
      historyEntries: entity.document?.entries.length || 0,
    });
    planned.push({
      ...entity,
      id,
      owner,
      editorUsers,
      unmappedEditors,
      snapshots,
      status,
      resolution,
    });
  }
  for (const userId of discoveredUsers)
    if (mappedUsers.has(userId)) usedMappedUsers.add(userId);
  const report = {
    source: source.root,
    counts: {
      ...source.counts,
      validEntities: source.entities.length,
      mappedLegacyUsers: usedMappedUsers.size,
      ready: planned.filter((item) => item.status === "ready").length,
      blocked: planned.filter(
        (item) => item.status === "blocked" || item.status === "conflict",
      ).length,
      alreadyImported: planned.filter(
        (item) => item.status === "already_imported",
      ).length,
    },
    unmappedDiscordIds: [...discoveredUsers]
      .filter((id) => !mappedUsers.has(id))
      .sort(),
    entities: details,
    issues,
  };
  return { planned, mappedUsers, report };
}

function openExisting(filename, readOnly) {
  const resolved = fs.realpathSync(filename);
  if (!fs.statSync(resolved).isFile())
    throw new Error("Destination database must be an existing file.");
  const db = new DatabaseSync(resolved, { readOnly });
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  return { db, resolved };
}
function validateDatabase(db) {
  const integrity = db.prepare("PRAGMA quick_check").all();
  if (integrity.length !== 1 || integrity[0].quick_check !== "ok")
    throw new Error("Destination database failed quick_check.");
  if (db.prepare("PRAGMA foreign_key_check").all().length)
    throw new Error("Destination database has foreign-key violations.");
  for (const name of [
    "users",
    "entities",
    "entity_permissions",
    "assignments",
    "entity_history",
  ])
    if (!tableExists(db, name))
      throw new Error("Destination is missing website table: " + name);
}
function assertOutsideSource(sourceRoot, filename) {
  const root = fs.realpathSync(sourceRoot);
  const relative = path.relative(root, filename);
  if (
    !relative ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  )
    throw new Error(
      "Destination database and backup must be outside the legacy save directory.",
    );
}
function hasErrors(report) {
  return report.issues.some((item) => item.severity === "error");
}
function dryRun({ source, database, mappingFile }) {
  const scanned = scanSource(source);
  const mapping = readMapping(mappingFile);
  const { db, resolved } = openExisting(database, true);
  try {
    validateDatabase(db);
    if (fs.existsSync(scanned.root))
      assertOutsideSource(scanned.root, resolved);
    return planMigration(db, scanned, mapping).report;
  } finally {
    db.close();
  }
}

function prepareSchema(db) {
  const columns = db.prepare("PRAGMA table_info(entity_history)").all();
  const names = columns.map((column) => column.name);
  const expected = [
    "entity_id",
    "version",
    "data",
    "created_at",
    "actor_id",
    "portrait_hash",
  ];
  if (
    names.length !== expected.length ||
    expected.some((name) => !names.includes(name))
  )
    throw new Error("Unsupported entity_history schema; no data was changed.");
  if (columns.find((column) => column.name === "actor_id").notnull) {
    const extras = db
      .prepare(
        "SELECT type,name FROM sqlite_master WHERE tbl_name='entity_history' AND type IN ('trigger','index') AND sql IS NOT NULL",
      )
      .all();
    if (extras.length)
      throw new Error(
        "Custom history indexes or triggers require manual schema review.",
      );
    for (const table of db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()) {
      const quoted = '"' + table.name.replaceAll('"', '""') + '"';
      if (
        db
          .prepare("PRAGMA foreign_key_list(" + quoted + ")")
          .all()
          .some((fk) => fk.table === "entity_history")
      )
        throw new Error(
          "A table references entity_history; manual schema review is required.",
        );
    }
    db.exec(`
      CREATE TABLE entity_history_migration_new (
        entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        version INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL,
        actor_id TEXT REFERENCES users(id), portrait_hash TEXT, PRIMARY KEY(entity_id,version)
      );
      INSERT INTO entity_history_migration_new SELECT entity_id,version,data,created_at,actor_id,portrait_hash FROM entity_history;
      DROP TABLE entity_history;
      ALTER TABLE entity_history_migration_new RENAME TO entity_history;
    `);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS legacy_entity_imports (
      entity_id TEXT PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
      legacy_type TEXT NOT NULL, legacy_key TEXT NOT NULL,
      source_sha256 TEXT NOT NULL, history_sha256 TEXT,
      source_json TEXT NOT NULL, history_json TEXT,
      owner_resolution TEXT, imported_at INTEGER NOT NULL,
      UNIQUE(legacy_type,legacy_key)
    );
    CREATE TABLE IF NOT EXISTS legacy_history_events (
      entity_id TEXT NOT NULL REFERENCES legacy_entity_imports(entity_id) ON DELETE CASCADE,
      before_version INTEGER NOT NULL, after_version INTEGER NOT NULL,
      recorded_at TEXT NOT NULL, discord_actor_id TEXT NOT NULL,
      website_actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL, entry_json TEXT NOT NULL,
      PRIMARY KEY(entity_id,before_version)
    );
  `);
}
function insertPlanned(db, plan) {
  const now = Date.now();
  for (const item of plan.planned.filter(
    (entity) => entity.status === "ready",
  )) {
    const events = item.document?.entries || [];
    const createdAt = events.length
      ? Date.parse(events[0].createdAt)
      : item.file.mtime;
    db.prepare(
      "INSERT INTO entities(id,type,owner_id,data,version,created_at) VALUES(?,?,?,?,?,?)",
    ).run(
      item.id,
      item.type,
      item.owner.id,
      JSON.stringify(item.snapshots.at(-1)),
      events.length,
      createdAt,
    );
    db.prepare(
      "INSERT INTO legacy_entity_imports VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(
      item.id,
      item.type,
      item.key,
      hash(item.file.bytes),
      item.historyFile ? hash(item.historyFile.bytes) : null,
      item.file.bytes.toString("utf8"),
      item.historyFile ? item.historyFile.bytes.toString("utf8") : null,
      item.resolution
        ? JSON.stringify({
            username: item.resolution.user.username,
            reason: item.resolution.reason,
          })
        : null,
      now,
    );
    for (const user of item.editorUsers.values())
      db.prepare(
        "INSERT INTO entity_permissions(entity_id,user_id,permission) VALUES(?,?,'editor')",
      ).run(item.id, user.id);
    for (let version = 0; version < item.snapshots.length; version++) {
      const preceding = events[version - 1];
      const actor = preceding ? plan.mappedUsers.get(preceding.actorId) : null;
      db.prepare(
        "INSERT INTO entity_history(entity_id,version,data,created_at,actor_id,portrait_hash) VALUES(?,?,?,?,?,NULL)",
      ).run(
        item.id,
        version,
        JSON.stringify(item.snapshots[version]),
        preceding ? Date.parse(preceding.createdAt) : createdAt,
        actor?.id || null,
      );
    }
    for (const [index, event] of events.entries()) {
      db.prepare(
        "INSERT INTO legacy_history_events VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        item.id,
        index,
        index + 1,
        event.createdAt,
        event.actorId,
        plan.mappedUsers.get(event.actorId)?.id || null,
        event.action,
        JSON.stringify(event),
      );
    }
  }
}
function verifyInserted(db, plan) {
  for (const item of plan.planned.filter(
    (entity) => entity.status === "ready",
  )) {
    const row = db.prepare("SELECT * FROM entities WHERE id=?").get(item.id);
    if (
      !row ||
      row.type !== item.type ||
      row.owner_id !== item.owner.id ||
      row.version !== item.snapshots.length - 1 ||
      row.data !== JSON.stringify(item.snapshots.at(-1))
    )
      throw new Error("Imported entity verification failed: " + item.subject);
    const events = item.document?.entries || [];
    const createdAt = events.length
      ? Date.parse(events[0].createdAt)
      : item.file.mtime;
    const history = db
      .prepare(
        "SELECT version,data,created_at,actor_id FROM entity_history WHERE entity_id=? ORDER BY version",
      )
      .all(item.id);
    if (
      history.length !== item.snapshots.length ||
      history.some((entry, index) => {
        const preceding = events[index - 1];
        return (
          entry.version !== index ||
          entry.data !== JSON.stringify(item.snapshots[index]) ||
          entry.created_at !==
            (preceding ? Date.parse(preceding.createdAt) : createdAt) ||
          entry.actor_id !==
            (preceding
              ? plan.mappedUsers.get(preceding.actorId)?.id || null
              : null)
        );
      })
    )
      throw new Error("Imported history verification failed: " + item.subject);
    const permissions = db
      .prepare(
        "SELECT user_id,permission FROM entity_permissions WHERE entity_id=?",
      )
      .all(item.id);
    if (
      permissions.length !== item.editorUsers.size ||
      permissions.some(
        (entry) =>
          entry.permission !== "editor" || !item.editorUsers.has(entry.user_id),
      )
    )
      throw new Error(
        "Imported permission verification failed: " + item.subject,
      );
    if (db.prepare("SELECT 1 FROM assignments WHERE entity_id=?").get(item.id))
      throw new Error(
        "Imported entity unexpectedly has a campaign assignment: " +
          item.subject,
      );
    const original = db
      .prepare("SELECT * FROM legacy_entity_imports WHERE entity_id=?")
      .get(item.id);
    if (
      !original ||
      original.legacy_type !== item.type ||
      original.legacy_key !== item.key ||
      original.source_sha256 !== hash(item.file.bytes) ||
      original.source_json !== item.file.bytes.toString("utf8") ||
      original.history_sha256 !==
        (item.historyFile ? hash(item.historyFile.bytes) : null) ||
      original.history_json !==
        (item.historyFile ? item.historyFile.bytes.toString("utf8") : null)
    )
      throw new Error(
        "Imported source provenance verification failed: " + item.subject,
      );
    const provenance = db
      .prepare(
        "SELECT * FROM legacy_history_events WHERE entity_id=? ORDER BY before_version",
      )
      .all(item.id);
    if (
      provenance.length !== events.length ||
      provenance.some(
        (entry, index) =>
          entry.before_version !== index ||
          entry.after_version !== index + 1 ||
          entry.recorded_at !== events[index].createdAt ||
          entry.discord_actor_id !== events[index].actorId ||
          entry.website_actor_id !==
            (plan.mappedUsers.get(events[index].actorId)?.id || null) ||
          entry.action !== events[index].action ||
          entry.entry_json !== JSON.stringify(events[index]),
      )
    )
      throw new Error(
        "Imported history provenance verification failed: " + item.subject,
      );
  }
  if (db.prepare("PRAGMA foreign_key_check").all().length)
    throw new Error("Imported database failed foreign-key verification.");
}
async function applyMigration({ source, database, mappingFile, beforeCommit }) {
  const first = dryRun({ source, database, mappingFile });
  if (hasErrors(first)) return { ...first, applied: false };
  if (!first.counts.ready)
    return { ...first, applied: false, nothingToImport: true };
  const initialSource = scanSource(source);
  const mapping = readMapping(mappingFile);
  const { db, resolved } = openExisting(database, false);
  let backupPath = null,
    backupComplete = false,
    inTransaction = false;
  try {
    assertOutsideSource(initialSource.root, resolved);
    db.exec("BEGIN IMMEDIATE");
    inTransaction = true;
    validateDatabase(db);
    const plan = planMigration(db, initialSource, mapping);
    if (hasErrors(plan.report)) {
      db.exec("ROLLBACK");
      inTransaction = false;
      return { ...plan.report, applied: false };
    }
    if (!plan.report.counts.ready) {
      db.exec("ROLLBACK");
      inTransaction = false;
      return { ...plan.report, applied: false, nothingToImport: true };
    }
    backupPath = resolved + ".pre-legacy-" + randomUUID() + ".sqlite";
    const handle = fs.openSync(backupPath, "wx", 0o600);
    fs.closeSync(handle);
    const backupSource = new DatabaseSync(resolved, { readOnly: true });
    try {
      await backup(backupSource, backupPath);
      backupComplete = true;
    } finally {
      backupSource.close();
    }
    prepareSchema(db);
    insertPlanned(db, plan);
    verifyInserted(db, plan);
    if (beforeCommit) beforeCommit(db);
    if (scanSource(source).signature !== initialSource.signature)
      throw new Error(
        "Legacy source changed during the import; transaction rolled back.",
      );
    db.exec("COMMIT");
    inTransaction = false;
    const imported = plan.planned.filter((item) => item.status === "ready");
    return {
      ...plan.report,
      applied: true,
      backupPath,
      imported: {
        characters: imported.filter((item) => item.type === "character").length,
        creatures: imported.filter((item) => item.type === "creature").length,
        historyEntries: imported.reduce(
          (total, item) => total + (item.document?.entries.length || 0),
          0,
        ),
      },
    };
  } catch (error) {
    if (inTransaction) db.exec("ROLLBACK");
    if (backupPath && backupComplete) error.backupPath = backupPath;
    else if (backupPath) error.incompleteBackupPath = backupPath;
    throw error;
  } finally {
    db.close();
  }
}

module.exports = { scanSource, dryRun, applyMigration, entityId, hasErrors };
