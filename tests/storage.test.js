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
