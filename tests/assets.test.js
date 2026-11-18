const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { createHash } = require("node:crypto");
const path = require("node:path");

test("generated website artwork retains its visual inputs and recorded hashes", () => {
  const root = path.join(__dirname, "..");
  const manifest = require("../media/website-artwork.json");
  const verify = (name, expected) =>
    assert.equal(
      createHash("sha256")
        .update(readFileSync(path.join(root, name)))
        .digest("hex"),
      expected,
      name,
    );
  for (const [name, hash] of Object.entries(manifest.references))
    verify(name, hash);
  for (const item of manifest.illustrations) {
    assert.ok(
      item.inputs.every((input) => Object.hasOwn(manifest.references, input)),
    );
    if (item.output) verify(item.output, item.sha256);
    for (const [name, details] of Object.entries(item.outputs || {}))
      verify(name, details.sha256);
  }
  for (let i = 1; i <= 20; i++)
    assert.ok(existsSync(path.join(root, "public", "media", `D20-${i}.gif`)));
  for (const coin of ["HEADS.gif", "TAILS.gif"])
    assert.ok(existsSync(path.join(root, "public", "media", coin)));
});
