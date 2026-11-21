const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

function openDatabase(filename) {
  if (filename !== ":memory:")
    fs.mkdirSync(path.dirname(path.resolve(filename)), {
      recursive: true,
      mode: 0o700,
    });
  const db = new DatabaseSync(filename);
  try {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    migrate(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

// Each migration supports both fresh databases and unversioned website databases.
const migrations = [
  db => db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','admin')),
      status TEXT NOT NULL CHECK(status IN ('active','pending','rejected','disabled')),
      language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('en','fr')),
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dice_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      skin TEXT NOT NULL, glow TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tokens (
      token_hash TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('invite','reset')),
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE, created_by TEXT NOT NULL REFERENCES users(id),
      expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL CHECK(language IN ('en','fr')),
      owner_id TEXT NOT NULL REFERENCES users(id), cover BLOB, cover_type TEXT, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS members (
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('member','gm')),
      PRIMARY KEY(campaign_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS campaign_invitations (
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
      PRIMARY KEY(campaign_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('character','creature')),
      owner_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0,
      portrait BLOB, portrait_type TEXT, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entity_permissions (
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission TEXT NOT NULL CHECK(permission IN ('viewer','editor')),
      PRIMARY KEY(entity_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS assignments (
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      state TEXT NOT NULL CHECK(state IN ('pending','approved')),
      visibility TEXT NOT NULL CHECK(visibility IN ('private','shared')),
      created_at INTEGER NOT NULL, PRIMARY KEY(entity_id,campaign_id)
    );
    CREATE TABLE IF NOT EXISTS playing_characters (
      campaign_id TEXT NOT NULL, user_id TEXT NOT NULL, entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      PRIMARY KEY(campaign_id,user_id), UNIQUE(campaign_id,entity_id),
      FOREIGN KEY(campaign_id,user_id) REFERENCES members(campaign_id,user_id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS entity_history (
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      version INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL,
      actor_id TEXT REFERENCES users(id), portrait_hash TEXT, PRIMARY KEY(entity_id,version)
    );
    CREATE TABLE IF NOT EXISTS entity_images (
      entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      hash TEXT NOT NULL, image BLOB NOT NULL, mime TEXT NOT NULL,
      PRIMARY KEY(entity_id,hash)
    );
    CREATE INDEX IF NOT EXISTS assignment_campaign ON assignments(campaign_id,state);
    CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
  `),
  db => {
    if (!db.prepare("PRAGMA table_info(entity_history)").all().some(column => column.name === "portrait_hash"))
      db.exec("ALTER TABLE entity_history ADD COLUMN portrait_hash TEXT");
  },
  db => db.exec(`
    CREATE INDEX IF NOT EXISTS members_user ON members(user_id,campaign_id);
    CREATE INDEX IF NOT EXISTS entity_permissions_user ON entity_permissions(user_id,entity_id);
    CREATE INDEX IF NOT EXISTS entities_type_created ON entities(type,created_at);
  `),
];
function migrate(db) {
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > migrations.length) throw new Error("Database schema is newer than this application");
  for (let index = version; index < migrations.length; index++) {
    transaction(db, () => {
      migrations[index](db);
      db.exec(`PRAGMA user_version = ${index + 1}`);
    });
  }
}

function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

module.exports = { openDatabase, transaction };
