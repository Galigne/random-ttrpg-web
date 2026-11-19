// The result stays in memory until all the visible dice have settled.
(() => {
  "use strict";

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const assets = {};

  function image(name) {
    if (!assets[name]) {
      assets[name] = new Promise((resolve, reject) => {
        const picture = new Image();
        picture.onload = () => resolve(picture);
        picture.onerror = reject;
        picture.src = `/dice/art/${name}.webp`;
      });
    }
    return assets[name];
  }

  function create(result, animate, onComplete) {
    return {
      result,
      animate: animate && !reducedMotion.matches,
      start: null,
      finished: false,
      art: null,
      element: null,
      frame: null,
      onComplete,
    };
  }

  function mount(record, element, rollingText, showResult) {
    if (!record.finished) active.add(record);
    record.element = element;
    record.showResult = showResult;
    element.innerHTML = `<div class="dice-motion" aria-hidden="true"></div><span role="status"></span>`;
    element.querySelector('[role="status"]').textContent = rollingText;
    const area = element.querySelector(".dice-motion");
    const { sides, rolls } = record.result;
    const classic = window.RandomClassicDice?.supports(sides);
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
      if (classic && !source) sources.set(value, canvas);
      return { canvas, value, source, context: canvas.getContext("2d") };
    });

    function finish() {
      const wasFinished = record.finished;
      record.finished = true;
      cancelAnimationFrame(record.frame);
      if (record.element?.isConnected)
        record.showResult(record.element, record.result);
      if (!wasFinished) record.onComplete?.();
    }

    function draw(progress) {
      const render = record.result.sides === 2 ? window.RandomCoin : window.RandomD20;
      if (!record.art) return;
      for (const { context, value, source } of tiles) {
        if (!context) continue;
        context.clearRect(0, 0, 440, 260);
        if (source) context.drawImage(source, 0, 0);
        else if (classic) window.RandomClassicDice.draw(context, progress, sides, value, record.art);
        else render.draw(context, progress, value, record.art);
      }
    }

    function tick(now) {
      if (record.element !== element) return;
      if (!element.isConnected) {
        active.delete(record);
        return;
      }
      const progress = !record.finished && record.animate
        ? Math.min(1, (now - record.start) / (sides === 2 ? 1350 : 1500))
        : 1;
      try {
        draw(progress);
      } catch {
        area.remove();
        finish();
        return;
      }
      if (progress >= 1) finish();
      else record.frame = requestAnimationFrame(tick);
    }

    if (!record.animate || record.finished || reducedMotion.matches) {
      record.animate = false;
      finish();
    }
    if (!record.loading) {
      const names = record.result.sides === 2 ? ["heads", "tails"] : ["marble"];
      record.loading = Promise.race([
        Promise.all(names.map(image)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Artwork unavailable")), 5000)),
      ]).then((pictures) => {
        record.art = record.result.sides === 2
          ? { heads: pictures[0], tails: pictures[1] }
          : pictures[0];
        record.start = performance.now();
      });
    }
    record.loading.then(() => {
      if (record.element === element) {
        if (record.finished) {
          try {
            draw(1);
          } catch {
            area.remove();
          }
          return;
        }
        if (reducedMotion.matches) record.animate = false;
        cancelAnimationFrame(record.frame);
        tick(performance.now());
      }
    }).catch(() => {
      if (record.element === element) {
        area.remove();
        if (!record.finished) finish();
      }
    });
  }

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      for (const record of active) {
        record.animate = false;
        if (record.element?.isConnected)
          mount(record, record.element, record.rollingText, record.showResult);
      }
    }
  });
  const active = new Set();
  window.RandomDicePlayback = {
    create(result, animate, onComplete) {
      const record = create(result, animate, () => {
        active.delete(record);
        onComplete?.();
      });
      return record;
    },
    mount(record, element, rollingText, showResult) {
      record.rollingText = rollingText;
      mount(record, element, rollingText, showResult);
    },
  };
})();
