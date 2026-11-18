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
