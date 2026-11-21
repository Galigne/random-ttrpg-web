const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const {
  renderBook,
  sourceStart,
  sourceEnd,
} = require("../documentation/rulebook/build");

for (const [language, basename] of [
  ["en", "TTRPG_RANDOM_RULES_EN"],
  ["fr", "JDR_RANDOM_RULES_FR"],
]) {
  test(`${language} rulebook retains its canonical Markdown content and source fingerprint`, async () => {
    const root = path.join(__dirname, "..", "documentation");
    const source = await fs.readFile(path.join(root, `${basename}.md`));
    const html = await fs.readFile(path.join(root, `${basename}.html`), "utf8");
    const hash = createHash("sha256").update(source).digest("hex");
    assert.ok(html.includes(`name="rulebook-source-sha256" content="${hash}"`));
    const { book } = await renderBook(source.toString("utf8"), { language });
    assert.ok(html.includes(`${sourceStart}\n${book}\n${sourceEnd}`));
    assert.match(html, /id="search-dialog"/);
    assert.match(html, /id="chapter-navigation"/);
  });
}

test('website editions use compact external artwork without changing canonical rules', async () => {
  for (const [language, basename] of [['en', 'TTRPG_RANDOM_RULES_EN'], ['fr', 'JDR_RANDOM_RULES_FR']]) {
    const root = path.join(__dirname, '..', 'documentation');
    const source = await fs.readFile(path.join(root, `${basename}.md`), 'utf8');
    const html = await fs.readFile(path.join(root, `website-rules-${language}.html`), 'utf8');
    const { book } = await renderBook(source, { language, web: true });
    assert.ok(html.includes(`${sourceStart}\n${book}\n${sourceEnd}`));
    assert.ok(Buffer.byteLength(html) < 250000);
    assert.doesNotMatch(html, /data:image\/webp;base64/);
    assert.match(html, /\/rulebook\/assets\/cover\.webp/);
    assert.match(html, /loading="lazy"/);
    assert.match(html, /\.woff2/);
    const images = [...html.matchAll(/src="\/rulebook\/assets\/([^"]+)"/g)].map(match => match[1]);
    assert.equal(images.length, 15);
    for (const image of images) await fs.access(path.join(root, '..', 'public', 'rulebook-art', image));
  }
});
