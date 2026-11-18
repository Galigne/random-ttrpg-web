const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { DatabaseSync } = require("node:sqlite");
const { openDatabase } = require("../server/db");
const { createApplication } = require("../server/app");
const { digest } = require("../server/security");
const rpg = require("../server/rpg");
const access = require("../server/access");
const {
  dryRun,
  applyMigration,
  entityId,
} = require("../server/legacy-migration");

const ownerDiscord = "111111111111111111";
const editorDiscord = "222222222222222222";
const unknownDiscord = "333333333333333333";

function writeJson(filename, value) {
  fs.writeFileSync(filename, JSON.stringify(value, null, 2));
}
function fixture(t) {
  const tempRoot = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(tempRoot, "random-legacy-test-"));
  const cleanups = [];
  t.after(async () => {
    for (const cleanup of cleanups) await cleanup();
    if (!path.resolve(directory).startsWith(tempRoot + path.sep))
      throw new Error("Unsafe cleanup path");
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const source = path.join(directory, "source");
  for (const type of ["characters", "creatures"])
    fs.mkdirSync(path.join(source, type, ".history"), { recursive: true });
  const database = path.join(directory, "website.sqlite");
  const db = openDatabase(database);
  for (const [id, username, role] of [
    ["owner-web", "Alice", "user"],
    ["editor-web", "Bob", "user"],
    ["other-web", "Other", "user"],
    ["admin-web", "Admin", "admin"],
  ]) {
    db.prepare("INSERT INTO users VALUES(?,?,?,?,'active','en',1)").run(
      id,
      username,
      "hash",
      role,
    );
  }
  const existing = rpg.createEntity("character");
  existing.name.firstName = "Same display";
  db.prepare(
    "INSERT INTO entities(id,type,owner_id,data,version,created_at) VALUES(?,? ,?,?,0,1)",
  ).run(existing.key, "character", "other-web", JSON.stringify(existing));
  db.prepare(
    "INSERT INTO entity_history(entity_id,version,data,created_at,actor_id) VALUES(?,0,?,1,?)",
  ).run(existing.key, JSON.stringify(existing), "other-web");
  // Recreate the original website schema to exercise its transactional upgrade.
  db.exec(
    [
      "ALTER TABLE entity_history RENAME TO old_history",
      "CREATE TABLE entity_history (entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE, version INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), portrait_hash TEXT, PRIMARY KEY(entity_id,version))",
      "INSERT INTO entity_history SELECT * FROM old_history",
      "DROP TABLE old_history",
    ].join(";"),
  );
  db.close();

  const character = rpg.createEntity("character");
  character.key = "hero";
  character.settings = {
    visibility: "public",
    access: [
      { userId: ownerDiscord, level: "owner" },
      { userId: editorDiscord, level: "partial" },
      { userId: unknownDiscord, level: "partial" },
    ],
  };
  character.name = { firstName: "Same display", lastName: "" };
  character.level = 4;
  character.resources.hp = { current: 71, max: 123 };
  character.resources.ar = { current: 3, max: 9 };
  character.race.name = "Géant des mers";
  character.background.backstory = "Un texte conservé tel quel.";
  character.personality = {
    traits: ["curieux"],
    description: "Sans traduction.",
  };
  character.status.effects = [
    { name: "Fatigué", description: "Repos nécessaire." },
  ];
  character.rules = [{ name: "RULE", description: "Original", level: 2 }];
  character.talents = ["Alchimie"];
  character.gear = {
    equipment: ["Épée"],
    inventory: ["Clé", "Livre"],
    encumbrance: { current: 2, max: 7 },
  };
  const beforeFirst = structuredClone(character);
  beforeFirst.resources.hp.current = 88;
  const beforeSecond = structuredClone(character);
  beforeSecond.resources.hp.current = 79;
  const characterHistory = {
    entries: [
      {
        createdAt: "2025-01-01T10:00:00.000Z",
        actorId: ownerDiscord,
        action: "set",
        character: beforeFirst,
      },
      {
        createdAt: "2025-01-01T10:01:00.000Z",
        actorId: unknownDiscord,
        action: "damage",
        character: beforeSecond,
      },
    ],
  };
  writeJson(path.join(source, "characters", "hero.json"), character);
  writeJson(
    path.join(source, "characters", ".history", "hero.json"),
    characterHistory,
  );

  const creature = rpg.createEntity("creature");
  creature.key = "dragon";
  creature.settings = { visibility: "public", access: [] };
  creature.name = "Same display";
  creature.description = "Description de la créature.";
  creature.traits = ["Ancien"];
  creature.source = {
    generatorId: "creature",
    entryId: "dragon",
    statProfileId: "default",
    provenance: [
      {
        type: "entry",
        selection: "fixed",
        generatorId: "creature",
        entryId: "dragon",
        path: "creature:dragon",
      },
    ],
  };
  creature.gear.inventory = ["Trésor"];
  creature.resources.hp = { current: 55, max: 100 };
  const previousCreature = structuredClone(creature);
  previousCreature.resources.hp.current = 60;
  const creatureHistory = {
    type: "creature",
    entries: [
      {
        createdAt: "2025-01-02T10:00:00.000Z",
        actorId: editorDiscord,
        action: "damage",
        creature: previousCreature,
      },
    ],
  };
  writeJson(path.join(source, "creatures", "dragon.json"), creature);
  writeJson(
    path.join(source, "creatures", ".history", "dragon.json"),
    creatureHistory,
  );
  const mapping = {
    discordUsers: [
      { discordId: ownerDiscord, username: "Alice", verified: true },
      { discordId: editorDiscord, username: "Bob", verified: true },
    ],
    ownerResolutions: [
      {
        type: "creature",
        legacyKey: "dragon",
        username: "Alice",
        confirmed: true,
        reason: "Explicit fixture decision",
      },
    ],
  };
  const mappingFile = path.join(directory, "mapping.json");
  writeJson(mappingFile, mapping);
  return {
    directory,
    database,
    source,
    mappingFile,
    mapping,
    character,
    creature,
    characterHistory,
    creatureHistory,
    existing,
    cleanups,
  };
}
function converted(data, id) {
  return {
    ...structuredClone(data),
    key: id,
    settings: { visibility: "private", access: [] },
  };
}

test("imports exact data, pre-change history, provenance and permissions without duplicates", async (t) => {
  const f = fixture(t);
  const before = fs.readFileSync(
    path.join(f.source, "characters", "hero.json"),
  );
  const dry = dryRun(f);
  assert.equal(dry.counts.ready, 2);
  assert.equal(dry.counts.mappedLegacyUsers, 2);
  assert.equal(dry.counts.historyEntriesFound, 3);
  assert.ok(dry.issues.some((item) => item.code === "UNMAPPED_EDITORS"));
  const result = await applyMigration(f);
  assert.equal(result.applied, true);
  assert.deepEqual(result.imported, {
    characters: 1,
    creatures: 1,
    historyEntries: 3,
  });
  assert.ok(fs.existsSync(result.backupPath));

  const savedBackup = new DatabaseSync(result.backupPath, { readOnly: true });
  assert.equal(
    savedBackup.prepare("SELECT count(*) AS n FROM entities").get().n,
    1,
  );
  assert.equal(
    savedBackup.prepare("SELECT count(*) AS n FROM users").get().n,
    4,
  );
  savedBackup.close();

  const db = openDatabase(f.database);
  const charId = entityId("character", "hero"),
    creatureId = entityId("creature", "dragon");
  const row = db.prepare("SELECT * FROM entities WHERE id=?").get(charId);
  assert.equal(row.owner_id, "owner-web");
  assert.deepEqual(JSON.parse(row.data), converted(f.character, charId));
  assert.deepEqual(
    JSON.parse(
      db.prepare("SELECT data FROM entities WHERE id=?").get(creatureId).data,
    ),
    converted(f.creature, creatureId),
  );
  assert.equal(db.prepare("SELECT count(*) AS n FROM entities").get().n, 3);
  assert.equal(db.prepare("SELECT count(*) AS n FROM assignments").get().n, 0);
  const permission = db
    .prepare(
      "SELECT user_id,permission FROM entity_permissions WHERE entity_id=?",
    )
    .all(charId);
  assert.deepEqual(
    permission.map((item) => ({ ...item })),
    [{ user_id: "editor-web", permission: "editor" }],
  );
  assert.equal(
    access.canEdit(db, { id: "editor-web", role: "user" }, row),
    true,
  );
  assert.equal(
    access.canView(db, { id: "other-web", role: "user" }, row),
    false,
  );
  assert.equal(
    access.canEdit(db, { id: "admin-web", role: "admin" }, row),
    true,
  );
  const history = db
    .prepare("SELECT * FROM entity_history WHERE entity_id=? ORDER BY version")
    .all(charId);
  assert.deepEqual(
    history.map((item) => item.version),
    [0, 1, 2],
  );
  assert.deepEqual(
    history.map((item) => item.actor_id),
    [null, "owner-web", null],
  );
  assert.equal(
    history[1].created_at,
    Date.parse(f.characterHistory.entries[0].createdAt),
  );
  assert.equal(
    history[2].created_at,
    Date.parse(f.characterHistory.entries[1].createdAt),
  );
  assert.deepEqual(
    JSON.parse(history[0].data),
    converted(f.characterHistory.entries[0].character, charId),
  );
  assert.deepEqual(
    JSON.parse(history[1].data),
    converted(f.characterHistory.entries[1].character, charId),
  );
  assert.deepEqual(JSON.parse(history[2].data), converted(f.character, charId));
  const provenance = db
    .prepare(
      "SELECT * FROM legacy_history_events WHERE entity_id=? ORDER BY before_version",
    )
    .all(charId);
  assert.deepEqual(
    provenance.map((item) => [
      item.before_version,
      item.after_version,
      item.recorded_at,
      item.discord_actor_id,
      item.website_actor_id,
      item.action,
    ]),
    [
      [0, 1, "2025-01-01T10:00:00.000Z", ownerDiscord, "owner-web", "set"],
      [1, 2, "2025-01-01T10:01:00.000Z", unknownDiscord, null, "damage"],
    ],
  );
  const originals = db
    .prepare(
      "SELECT source_json,history_json FROM legacy_entity_imports WHERE entity_id=?",
    )
    .get(charId);
  assert.deepEqual(JSON.parse(originals.source_json), f.character);
  assert.deepEqual(JSON.parse(originals.history_json), f.characterHistory);
  db.close();
  assert.deepEqual(
    fs.readFileSync(path.join(f.source, "characters", "hero.json")),
    before,
  );
  const repeated = await applyMigration(f);
  assert.equal(repeated.nothingToImport, true);
  assert.equal(repeated.counts.alreadyImported, 2);
  const updatedMapping = structuredClone(f.mapping);
  updatedMapping.discordUsers.push({
    discordId: unknownDiscord,
    username: "Other",
    verified: true,
  });
  writeJson(f.mappingFile, updatedMapping);
  const changedMapping = dryRun(f);
  assert.ok(
    changedMapping.issues.some(
      (item) => item.code === "EXISTING_EDITOR_UNCHANGED",
    ),
  );
  const dbAgain = openDatabase(f.database);
  assert.equal(
    dbAgain.prepare("SELECT count(*) AS n FROM entities").get().n,
    3,
  );
  assert.equal(
    dbAgain
      .prepare(
        "SELECT count(*) AS n FROM entity_permissions WHERE entity_id=? AND user_id=?",
      )
      .get(charId, "other-web").n,
    0,
  );
  dbAgain.close();
});

test("rejects malformed data, unresolved or conflicting ownership, and orphaned history before any changes", async (t) => {
  const f = fixture(t);
  let report = dryRun({ ...f, mappingFile: null });
  assert.equal(report.counts.ready, 0);
  assert.ok(report.issues.some((item) => item.code === "UNMAPPED_OWNER"));
  assert.ok(report.issues.some((item) => item.code === "NO_OWNER"));
  const invalidMapping = structuredClone(f.mapping);
  invalidMapping.discordUsers[0].verified = false;
  writeJson(f.mappingFile, invalidMapping);
  report = await applyMigration(f);
  assert.equal(report.applied, false);
  assert.ok(report.issues.some((item) => item.code === "INVALID_USER_MAPPING"));
  writeJson(f.mappingFile, f.mapping);
  const conflicting = structuredClone(f.character);
  conflicting.settings.access.push({
    userId: "444444444444444444",
    level: "owner",
  });
  writeJson(path.join(f.source, "characters", "hero.json"), conflicting);
  report = dryRun(f);
  assert.ok(report.issues.some((item) => item.code === "MULTIPLE_OWNERS"));
  const resolved = structuredClone(f.mapping);
  resolved.ownerResolutions.push({
    type: "character",
    legacyKey: "hero",
    username: "Alice",
    confirmed: true,
    reason: "Explicitly chose one owner",
  });
  writeJson(f.mappingFile, resolved);
  assert.ok(!dryRun(f).issues.some((item) => item.code === "MULTIPLE_OWNERS"));
  writeJson(f.mappingFile, f.mapping);
  fs.writeFileSync(path.join(f.source, "characters", "hero.json"), "{broken");
  writeJson(path.join(f.source, "characters", ".history", "missing.json"), {
    entries: [],
  });
  report = await applyMigration(f);
  assert.ok(report.issues.some((item) => item.code === "INVALID_SAVE"));
  assert.ok(report.issues.some((item) => item.code === "ORPHAN_HISTORY"));
  assert.equal(report.applied, false);
  const db = openDatabase(f.database);
  assert.equal(db.prepare("SELECT count(*) AS n FROM entities").get().n, 1);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM sqlite_master WHERE name='legacy_entity_imports'",
      )
      .get().n,
    0,
  );
  db.close();
});

test("the pre-import backup includes committed data still in the SQLite WAL", async (t) => {
  const f = fixture(t);
  const writer = openDatabase(f.database);
  f.cleanups.push(() => writer.close());
  writer
    .prepare("INSERT INTO users VALUES(?,?,?,'user','active','en',1)")
    .run("wal-user", "WalUser", "hash");
  assert.ok(fs.statSync(f.database + "-wal").size > 0);
  const result = await applyMigration(f);
  assert.equal(result.applied, true);
  const savedBackup = new DatabaseSync(result.backupPath, { readOnly: true });
  assert.equal(
    savedBackup.prepare("SELECT username FROM users WHERE id='wal-user'").get()
      .username,
    "WalUser",
  );
  assert.equal(
    savedBackup.prepare("SELECT count(*) AS n FROM entities").get().n,
    1,
  );
  savedBackup.close();
});

test("rolls back schema and data on failure and rejects changed sources on repeat", async (t) => {
  const f = fixture(t);
  await assert.rejects(
    applyMigration({
      ...f,
      beforeCommit: () => {
        throw new Error("injected failure");
      },
    }),
    /injected failure/,
  );
  const sourceFile = path.join(f.source, "characters", "hero.json");
  const original = fs.readFileSync(sourceFile);
  await assert.rejects(
    applyMigration({
      ...f,
      beforeCommit: () => fs.appendFileSync(sourceFile, "\n"),
    }),
    /source changed/,
  );
  fs.writeFileSync(sourceFile, original);
  let db = openDatabase(f.database);
  assert.equal(db.prepare("SELECT count(*) AS n FROM entities").get().n, 1);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM sqlite_master WHERE name='legacy_entity_imports'",
      )
      .get().n,
    0,
  );
  assert.equal(
    db
      .prepare("PRAGMA table_info(entity_history)")
      .all()
      .find((column) => column.name === "actor_id").notnull,
    1,
  );
  db.close();
  assert.equal((await applyMigration(f)).applied, true);
  const changed = structuredClone(f.character);
  changed.level = 5;
  writeJson(path.join(f.source, "characters", "hero.json"), changed);
  const report = await applyMigration(f);
  assert.equal(report.applied, false);
  assert.ok(report.issues.some((item) => item.code === "IMPORT_CONFLICT"));
  db = openDatabase(f.database);
  assert.equal(
    JSON.parse(
      db
        .prepare("SELECT data FROM entities WHERE id=?")
        .get(entityId("character", "hero")).data,
    ).level,
    4,
  );
  db.close();
});

test("imported sheets open and edit through the website, and undo and redo traverse legacy snapshots", async (t) => {
  const f = fixture(t);
  assert.equal((await applyMigration(f)).applied, true);
  const db = openDatabase(f.database);
  const app = createApplication(db);
  const token = "a".repeat(43),
    csrf = "test-csrf",
    tab = "test-tab-alice-12345";
  db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
    digest(token),
    "owner-web",
    csrf,
    Date.now() + 60000,
  );
  const server = http.createServer(app.handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const controller = new AbortController();
  f.cleanups.push(async () => {
    controller.abort();
    app.live.shutdown();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  async function request(url, body) {
    const headers = { cookie: "random_session=" + token, "x-csrf-token": csrf };
    if (body) headers["content-type"] = "application/json";
    const response = await fetch(base + url, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  }
  const id = entityId("character", "hero");
  let result = await request("/api/entities/" + id);
  assert.equal(result.status, 200);
  assert.equal(result.data.data.resources.hp.current, 71);
  const stream = await fetch(base + "/api/events?tab=" + tab, {
    headers: { cookie: "random_session=" + token },
    signal: controller.signal,
  });
  assert.equal(stream.status, 200);
  result = await request("/api/entities/" + id + "/lock", {
    tab,
    action: "start",
  });
  assert.equal(result.status, 200);
  result = await request("/api/entities/" + id + "/undo", {
    tab,
    action: "undo",
  });
  assert.equal(result.data.entity.data.resources.hp.current, 79);
  result = await request("/api/entities/" + id + "/undo", {
    tab,
    action: "undo",
  });
  assert.equal(result.data.entity.data.resources.hp.current, 88);
  result = await request("/api/entities/" + id + "/undo", {
    tab,
    action: "redo",
  });
  assert.equal(result.data.entity.data.resources.hp.current, 79);
  result = await request("/api/entities/" + id + "/undo", {
    tab,
    action: "redo",
  });
  assert.equal(result.data.entity.data.resources.hp.current, 71);
  result = await request("/api/entities/" + id + "/edit", {
    tab,
    version: 2,
    field: "name",
    value: { "name.firstName": "Edited", "name.lastName": "Name" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.entity.data.name.firstName, "Edited");
  const creatureId = entityId("creature", "dragon");
  result = await request("/api/entities/" + creatureId);
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.data.source, f.creature.source);
  assert.equal(
    (
      await request("/api/entities/" + creatureId + "/lock", {
        tab,
        action: "start",
      })
    ).status,
    200,
  );
  result = await request("/api/entities/" + creatureId + "/undo", {
    tab,
    action: "undo",
  });
  assert.equal(result.data.entity.data.resources.hp.current, 60);
  result = await request("/api/entities/" + creatureId + "/undo", {
    tab,
    action: "redo",
  });
  assert.equal(result.data.entity.data.resources.hp.current, 55);
  result = await request("/api/entities/" + creatureId + "/edit", {
    tab,
    version: 1,
    field: "identity",
    value: {
      "identity.name": "Edited creature",
      "identity.description": "Description intacte",
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.entity.data.name, "Edited creature");
});
