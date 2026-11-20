// The result stays in memory until all the visible dice have settled.
(() => {
  "use strict";

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const assets = new Map();
  const active = new Set();
  const criticalRoll = {
    duration: 5000,
    matches: (sides, value) => sides === 20 && (value === 1 || value === 20),
    advance(clock, now) {
      // Count presented time. A hidden tab, detached view or stalled frame cannot skip a phase.
      if (!document.hidden && clock.lastFrame !== null)
        clock.elapsed += Math.min(100, Math.max(0, now - clock.lastFrame));
      clock.lastFrame = document.hidden ? null : now;
      return clock.elapsed;
    },
  };

  function image(name) {
    if (!assets.has(name)) {
      const loading = new Promise((resolve, reject) => {
        const picture = new Image();
        const timeout = setTimeout(() => reject(new Error("Artwork unavailable")), 5000);
        picture.onload = () => { clearTimeout(timeout); resolve(picture); };
        picture.onerror = () => { clearTimeout(timeout); reject(new Error("Artwork unavailable")); };
        picture.src = `/dice/art/${name}.webp`;
      }).catch(() => {
        assets.delete(name);
        return null;
      });
      assets.set(name, loading);
    }
    return assets.get(name);
  }

  async function material(result) {
    const style = window.RandomDiceMaterials.resolve(result.appearance);
    const skin = style.id;
    if (result.sides !== 2) return { ...style, texture: await image(skin) };
    const [heads, tails, texture] = await Promise.all([
      image("heads"), image("tails"), skin === "marble" ? null : image(skin),
    ]);
    return { ...style, heads, tails, texture };
  }

  function create(result, animate, onComplete) {
    const critical = result.rolls.some(value => criticalRoll.matches(result.sides, value));
    return {
      result, critical, onComplete,
      animate: critical || (animate && !reducedMotion.matches),
      elapsed: 0, lastFrame: null, start: null, finished: false, mountId: 0,
    };
  }

  function mount(record, element, rollingText, showResult) {
    const mountId = ++record.mountId;
    cancelAnimationFrame(record.frame);
    if (!record.finished) active.add(record);
    record.lastFrame = null;
    element.innerHTML = `<div class="dice-motion" aria-hidden="true"></div><span role="status"></span>`;
    element.querySelector('[role="status"]').textContent = rollingText;
    const area = element.querySelector(".dice-motion");
    const { sides, rolls } = record.result;
    const classic = window.RandomClassicDice.supports(sides);
    const normalDuration = sides === 2 ? 1350 : 1500;
    const duration = record.critical ? criticalRoll.duration : normalDuration;
    const sources = new Map();
    const tiles = rolls.map(value => {
      const canvas = document.createElement("canvas");
      canvas.width = 440;
      canvas.height = 260;
      if (sides === 100) {
        const pair = document.createElement("div");
        pair.className = "percentile-dice";
        pair.dataset.tens = element.dataset.tens;
        pair.dataset.units = element.dataset.units;
        pair.append(canvas);
        area.append(pair);
      } else area.append(canvas);
      const source = sources.get(value);
      if (!source) sources.set(value, canvas);
      return { value, source, context: canvas.getContext("2d"), done: false };
    });

    let revealed = false;
    function finish() {
      if (revealed) return;
      revealed = true;
      const first = !record.finished;
      record.finished = true;
      record.reduce = null;
      active.delete(record);
      showResult(element, record.result);
      if (first) record.onComplete?.();
    }

    function draw(elapsed) {
      for (const tile of tiles) {
        const { context, value, source } = tile;
        if (!context || tile.done) continue;
        const critical = criticalRoll.matches(sides, value);
        const progress = Math.min(1, elapsed / (critical ? criticalRoll.duration : normalDuration));
        context.clearRect(0, 0, 440, 260);
        if (source) context.drawImage(source, 0, 0);
        else if (critical) window.RandomD20.drawCritical(context, progress, value, record.art, reducedMotion.matches);
        else if (classic) window.RandomClassicDice.draw(context, progress, sides, value, record.art);
        else (sides === 2 ? window.RandomCoin : window.RandomD20).draw(context, progress, value, record.art);
        tile.done = progress === 1;
      }
    }

    let canDraw = true;
    function tick(now) {
      if (record.mountId !== mountId) return;
      if (!element.isConnected) {
        record.reduce = null;
        active.delete(record);
        return;
      }
      if (record.finished || !record.animate) record.elapsed = duration;
      else if (record.critical) criticalRoll.advance(record, now);
      else record.elapsed = now - record.start;
      try {
        if (canDraw && record.art) draw(record.elapsed);
      } catch {
        canDraw = false;
        area.remove();
        if (!record.critical) record.elapsed = duration;
      }
      if (record.elapsed >= duration) finish();
      else record.frame = requestAnimationFrame(tick);
    }

    record.reduce = () => {
      if (record.critical) return;
      record.animate = false;
      cancelAnimationFrame(record.frame);
      tick(performance.now());
    };
    if (record.finished || !record.animate) finish();
    record.loading ??= material(record.result).then(art => {
      record.art = art;
      record.start = performance.now();
    });
    record.loading.then(() => {
      if (record.mountId === mountId) tick(performance.now());
    });
  }

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) for (const record of active) record.reduce();
  });
  window.RandomDicePlayback = { create, mount, criticalRoll };
})();
