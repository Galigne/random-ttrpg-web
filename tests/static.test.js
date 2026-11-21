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
    ["/dice/classic.js", "public/dice/classic.js"],
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

test('static assets compress and revalidate while private rulebook assets require a current session', async t => {
  const { digest } = require('../server/security');
  const db = openDatabase(':memory:');
  db.prepare("INSERT INTO users VALUES('u','User','hash','user','active','en',1)").run();
  const raw = 'a'.repeat(43);
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(raw), 'u', 'csrf', Date.now() + 60000);
  const app = createApplication(db);
  const server = http.createServer(app.handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { app.live.shutdown(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const compressed = await fetch(base + '/app.js', { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(compressed.headers.get('content-encoding'), 'gzip');
  assert.match(compressed.headers.get('vary'), /Accept-Encoding/i);
  const etag = compressed.headers.get('etag');
  const cached = await fetch(base + '/app.js', { headers: { 'if-none-match': etag } });
  assert.equal(cached.status, 304);
  const identity = await fetch(base + '/app.js', { headers: { 'accept-encoding': 'gzip;q=0' } });
  assert.equal(identity.headers.get('content-encoding'), null);
  const index = await (await fetch(base + '/')).text();
  const versioned = index.match(/src="(\/app\.js\?v=[a-f0-9]{16})"/)[1];
  assert.match((await fetch(base + versioned)).headers.get('cache-control'), /immutable/);
  assert.equal((await fetch(base + '/rulebook/assets/cover.webp')).status, 401);
  const auth = { cookie: `random_session=${raw}` };
  const art = await fetch(base + '/rulebook/assets/cover.webp', { headers: auth });
  assert.equal(art.status, 200);
  assert.match(art.headers.get('cache-control'), /private/);
  assert.equal((await fetch(base + '/rulebook/assets/cover.webp', { headers: { 'if-none-match': art.headers.get('etag') } })).status, 401);
  const book = await fetch(base + '/rulebook/en', { headers: auth });
  assert.equal(book.status, 200);
  assert.match(book.headers.get('cache-control'), /no-store/);
});
