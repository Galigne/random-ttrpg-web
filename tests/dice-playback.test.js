const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const path = require("node:path");

function environment(reduced = false) {
  let now = 0;
  let nextFrame = 0;
  const frames = new Map();
  const rendered = [];
  const motion = { matches: reduced, addEventListener(_, listener) { this.change = listener; } };
  const window = {
    RandomClassicDice: {
      supports: sides => [4, 6, 8, 10, 12, 100].includes(sides),
      draw: (_, progress, sides, value) => rendered.push({ progress, sides, value }),
    },
    RandomCoin: { draw: (_, progress, value) => rendered.push({ progress, value }) },
    RandomD20: {
      draw: (_, progress, value) => rendered.push({ progress, value }),
      drawCritical: (_, progress, value, art, quiet) => rendered.push({ progress, value, art, quiet }),
    },
  };
  class Image {
    set src(value) {
      this.path = value;
      queueMicrotask(() => this.onload());
    }
  }
  const context = {
    window,
    Image,
    matchMedia: () => motion,
    performance: { now: () => now },
    requestAnimationFrame(callback) {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout() {},
    clearTimeout() {},
    document: {
      createElement() {
        return { dataset: {}, append() {}, getContext: () => ({ clearRect() {}, drawImage() {} }) };
      },
    },
  };
  for (const file of ["skins.js", "playback.js"])
    runInNewContext(readFileSync(path.join(__dirname, "../public/dice", file), "utf8"), context);
  function element() {
    const area = { canvases: [], append(canvas) { this.canvases.push(canvas); }, remove() {} };
    const status = { textContent: "" };
    return {
      isConnected: true,
      dataset: { tens: "Tens", units: "Units" },
      set innerHTML(value) { this.markup = value; },
      querySelector(selector) { return selector === ".dice-motion" ? area : status; },
      area,
      status,
    };
  }
  function advance(time) {
    while (now < time) {
      now = Math.min(now + 20, time);
      const callbacks = [...frames.values()];
      frames.clear();
      for (const callback of callbacks) callback(now);
    }
  }
  return { playback: window.RandomDicePlayback, rendered, element, advance, motion, document: context.document };
}

test("simultaneous rolls keep values hidden through refresh until their animations finish", async () => {
  const env = environment();
  const revealed = [];
  const coin = env.playback.create({ sides: 2, rolls: [2], total: 5 }, true);
  const dice = env.playback.create({ sides: 20, rolls: [1, 20], total: 24 }, true);
  const show = (_, result) => revealed.push(result.total);
  let coinView = env.element();
  const dieView = env.element();
  env.playback.mount(coin, coinView, "Rolling", show);
  env.playback.mount(dice, dieView, "Rolling", show);
  await new Promise(setImmediate);
  assert.deepEqual(revealed, []);
  assert.equal(dieView.area.canvases.length, 2);
  assert.equal(coinView.status.textContent, "Rolling");

  env.advance(600);
  coinView.isConnected = false;
  coinView = env.element();
  env.playback.mount(coin, coinView, "Rolling", show);
  await new Promise(setImmediate);
  env.advance(1300);
  assert.deepEqual(revealed, []);
  env.advance(1350);
  assert.deepEqual(revealed, [5]);
  env.advance(1500);
  assert.deepEqual(revealed, [5]);
  env.advance(4999);
  assert.deepEqual(revealed, [5]);
  env.advance(5000);
  assert.deepEqual(revealed, [5, 24]);
  assert.ok(env.rendered.some(frame => frame.progress === 1 && frame.value === 20));
});

test("reduced motion reveals ordinary rolls immediately while artwork loads", () => {
  const env = environment(true);
  const record = env.playback.create({ sides: 20, rolls: [19], total: 20 }, true);
  const revealed = [];
  env.playback.mount(record, env.element(), "Rolling", (_, result) => revealed.push(result.total));
  assert.deepEqual(revealed, [20]);
});

test("critical playback uses the roller's material and resumes its visible time after remount", async () => {
  const env = environment(true);
  const result = { sides: 20, rolls: [7, 20], appearance: { skin: "iron", glow: "#3366ff" } };
  const record = env.playback.create(result, false);
  let count = 0;
  const first = env.element();
  env.playback.mount(record, first, "Rolling", () => count++);
  await new Promise(setImmediate);
  env.advance(2000);
  assert.ok(env.rendered.some(frame => frame.value === 7 && frame.progress === 1));
  const frame = env.rendered.find(frame => frame.value === 20);
  assert.equal(frame.art.glow, "#3366ff");
  assert.equal(frame.art.texture.path, "/dice/art/iron.webp");
  assert.equal(frame.quiet, true);
  env.motion.change();
  env.document.hidden = true;
  env.advance(8000);
  first.isConnected = false;
  env.advance(9000);
  env.document.hidden = false;
  env.playback.mount(record, env.element(), "Rolling", () => count++);
  await new Promise(setImmediate);
  env.advance(11999);
  assert.equal(count, 0);
  env.advance(12000);
  assert.equal(count, 1);
});

test("classic dice finish together with their supplied values and modified totals", async () => {
  const env = environment();
  const results = [
    { sides: 6, rolls: [3, 5, 3], total: 13 },
    { sides: 10, rolls: [1, 10], total: 11 },
    { sides: 100, rolls: [7, 90, 100], total: 197 },
  ];
  const revealed = [];
  for (const result of results) {
    const display = env.element();
    env.playback.mount(env.playback.create(result, true), display, "Rolling", (_, r) => revealed.push(r));
    assert.equal(display.area.canvases.length, result.rolls.length);
  }
  await new Promise(setImmediate);
  env.advance(1499);
  assert.deepEqual(revealed, []);
  env.advance(1500);
  assert.deepEqual(revealed, results);
  for (const result of results) {
    assert.deepEqual(
      env.rendered.filter(f => f.progress === 1 && f.sides === result.sides).map(f => f.value),
      [...new Set(result.rolls)],
    );
  }
});
