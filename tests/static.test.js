const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { openDatabase } = require("../server/db");
const { createApplication } = require("../server/app");

test("shared art and fonts are served while rulebook editions require authentication", async (t) => {
  const db = openDatabase(":memory:");
  const app = createApplication(db);
  const server = http.createServer(app.handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    app.live.shutdown();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [url, filename] of [
    ["/media/characters.webp", "media/rulebook/characters.webp"],
    ["/media/dice.webp", "media/rulebook/dice.webp"],
    ["/media/die-d6.webp", "public/media/die-d6.webp"],
    ["/dice/coin.js", "public/dice/coin.js"],
    ["/dice/d20.js", "public/dice/d20.js"],
    ["/dice/playback.js", "public/dice/playback.js"],
    ["/dice/art/heads.webp", "public/dice/art/heads.webp"],
    ["/dice/art/tails.webp", "public/dice/art/tails.webp"],
    ["/dice/art/marble.webp", "public/dice/art/marble.webp"],
    ["/fonts/Cinzel.ttf", "documentation/rulebook/fonts/Cinzel.ttf"],
  ]) {
    const response = await fetch(base + url);
    assert.equal(response.status, 200, url);
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      fs.readFileSync(path.join(__dirname, "..", filename)),
    );
  }
  assert.equal((await fetch(base + "/rulebook/en")).status, 401);
  assert.equal((await fetch(base + "/rulebook/fr")).status, 401);
});
