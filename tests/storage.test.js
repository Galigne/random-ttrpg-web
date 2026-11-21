const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { openDatabase } = require("../server/db");
const { readImage } = require("../server/images");

test("SQLite records survive a close and reopen", (t) => {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(
    path.join(temporaryRoot, "random-web-test-"),
  );
  t.after(() => {
    if (!path.resolve(directory).startsWith(temporaryRoot + path.sep))
      throw new Error("Unsafe cleanup path");
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const filename = path.join(directory, "data.sqlite");
  let db = openDatabase(filename);
  db.prepare(
    "INSERT INTO users VALUES('id','name','hash','user','active','fr',1)",
  ).run();
  db.close();
  db = openDatabase(filename);
  assert.equal(
    db.prepare("SELECT language FROM users WHERE id=?").get("id").language,
    "fr",
  );
  db.close();
});
test("image validation rejects unsupported formats and oversized dimensions", () => {
  const valid =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7y8AAAAASUVORK5CYII=";
  assert.equal(readImage(valid).mime, "image/png");
  assert.throws(() => readImage("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="));
  const bytes = Buffer.from(valid.split(",")[1], "base64");
  bytes.writeUInt32BE(8193, 16);
  assert.throws(() =>
    readImage("data:image/png;base64," + bytes.toString("base64")),
  );
});

test("unversioned databases upgrade once without losing history", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'random-schema-test-'));
  t.after(() => {
    if (!path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)) throw new Error('Unsafe cleanup path');
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const filename = path.join(directory, 'old.sqlite');
  let db = openDatabase(filename);
  db.exec(`
    INSERT INTO users VALUES('owner','Owner','hash','user','active','en',1);
    INSERT INTO entities(id,type,owner_id,data,created_at) VALUES('e','character','owner','{}',1);
    DROP TABLE entity_history;
    CREATE TABLE entity_history(entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      version INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL,
      actor_id TEXT REFERENCES users(id), PRIMARY KEY(entity_id,version));
    INSERT INTO entity_history VALUES('e',0,'{"old":true}',1,'owner');
    PRAGMA user_version=0;
  `);
  db.close();
  db = openDatabase(filename);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
  assert.equal(db.prepare('SELECT data FROM entity_history WHERE entity_id=?').get('e').data, '{"old":true}');
  assert.ok(db.prepare('PRAGMA table_info(entity_history)').all().some(column => column.name === 'portrait_hash'));
  db.close();
  db = openDatabase(filename);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entity_history').get().n, 1);
  db.exec('PRAGMA user_version=999');
  db.close();
  assert.throws(() => openDatabase(filename), /newer than this application/);
});
