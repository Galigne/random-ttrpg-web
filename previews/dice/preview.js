// Standalone review page. The example values exist only in this preview.
(() => {
  "use strict";
  const copy = {
    en: {
      title: "Dice in motion", intro: "Roll the dice together, or choose a result to inspect one landing.",
      pair: "Roll all dice", coin: "Coin toss", die: "Twenty-sided die", toss: "Toss coin", roll: "Roll die",
      d4: "Tetrahedron", d6: "Cube", d8: "Octahedron", d10: "Trapezohedron", d12: "Dodecahedron", d100: "Percentile dice",
      tip: "Read the number at the tip.", tens: "Tens", units: "Units",
      choose: "Choose a face…", coinChoice: "Choose a coin face", dieChoice: "Choose a D20 face",
      rolling: "Rolling…", pairRolling: "Rolling…", tossing: "Tossing…", heads: "Heads", tails: "Tails", result: "Result",
      error: "The artwork could not load. Open the preview with its art folder alongside it."
    },
    fr: {
      title: "Les dés en mouvement", intro: "Lancez tous les dés ou choisissez un résultat pour observer un dé à l’arrêt.",
      pair: "Lancer tous les dés", coin: "Pile ou face", die: "Dé à vingt faces", toss: "Lancer la pièce", roll: "Lancer le dé",
      d4: "Tétraèdre", d6: "Cube", d8: "Octaèdre", d10: "Trapézoèdre", d12: "Dodécaèdre", d100: "Dés de pourcentage",
      tip: "Lisez le nombre à la pointe.", tens: "Dizaines", units: "Unités",
      choose: "Choisir une face…", coinChoice: "Choisir un côté de la pièce", dieChoice: "Choisir une face du D20",
      rolling: "Le dé roule…", pairRolling: "Les dés roulent…", tossing: "La pièce tourne…", heads: "Face", tails: "Pile", result: "Résultat",
      error: "Les illustrations sont introuvables. Ouvrez l’aperçu avec son dossier art au même emplacement."
    }
  };
  let lang = navigator.language.startsWith("fr") ? "fr" : "en";
  const preview = document.getElementById("random-dice-preview");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const panels = [];
  const pair = preview.querySelector("#pair");
  const error = preview.querySelector("#error");

  function translate() {
    document.documentElement.lang = lang;
    document.title = copy[lang].title + " · RANDOM";
    preview.querySelectorAll("[data-copy]").forEach(node => { node.textContent = copy[lang][node.dataset.copy]; });
    preview.querySelectorAll("[data-lang]").forEach(button => { button.setAttribute("aria-pressed", button.dataset.lang === lang); });
    preview.querySelector("nav").setAttribute("aria-label", lang === "fr" ? "Langue" : "Language");
    for (const panel of panels) panel.translate();
    if (!error.hidden) error.textContent = copy[lang].error;
  }
  preview.querySelectorAll("[data-lang]").forEach(button => {
    button.addEventListener("click", () => { lang = button.dataset.lang; translate(); });
  });
  translate();

  function loadImage(name) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = "../../public/dice/art/" + name + ".webp";
    });
  }

  function makePanel(id, sides, duration, draw, art) {
    const root = preview.querySelector("#" + id);
    const canvas = root.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const status = root.querySelector("output");
    const button = root.querySelector("button");
    const select = root.querySelector("select");
    for (let n = 1; n <= sides; n++) select.add(new Option(String(n), String(n)));

    let target = 1, progress = 1, pending = 0;
    function drawFrame() {
      ctx.setTransform(canvas.width / 440, 0, 0, canvas.height / 260, 0, 0);
      ctx.clearRect(0, 0, 440, 260);
      draw(ctx, progress, target, art);
    }
    function resize() {
      const width = Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2));
      if (width <= 0) return;
      canvas.width = width;
      canvas.height = Math.round(width * 260 / 440);
      drawFrame();
    }
    new ResizeObserver(resize).observe(root);

    function updateStatus() {
      const words = copy[lang];
      if (progress < 1) {
        status.textContent = sides === 2 ? words.tossing : sides === 100 ? words.pairRolling : words.rolling;
      } else {
        const label = sides !== 2 ? words.result : target === 1 ? words.heads : words.tails;
        status.textContent = label + " · " + target;
      }
    }
    function finish() {
      cancelAnimationFrame(pending);
      progress = 1;
      drawFrame();
      updateStatus();
    }
    function play(value) {
      cancelAnimationFrame(pending);
      target = value;
      if (reducedMotion.matches) { finish(); return; }
      progress = 0;
      updateStatus();
      drawFrame();
      const start = performance.now();
      function tick(now) {
        progress = Math.min(1, (now - start) / duration);
        if (progress >= 1) { finish(); return; }
        drawFrame();
        pending = requestAnimationFrame(tick);
      }
      pending = requestAnimationFrame(tick);
    }
    reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) finish(); });
    select.addEventListener("change", () => {
      const value = Number(select.value);
      select.value = "";
      if (value >= 1 && value <= sides) play(value);
    });
    button.addEventListener("click", () => play(1 + Math.floor(Math.random() * sides)));
    function translatePanel() {
      select.setAttribute("aria-label", sides === 2 ? copy[lang].coinChoice : copy[lang].dieChoice.replace("D20", "D" + sides));
      if (sides === 2) {
        select.options[1].text = copy[lang].heads + " · 1";
        select.options[2].text = copy[lang].tails + " · 2";
      }
      updateStatus();
    }
    resize();
    select.disabled = button.disabled = false;
    return { play, translate: translatePanel };
  }

  const artReady = ["heads", "tails", "marble"].map(loadImage);
  const numeralsReady = document.fonts.load("600 34px Cinzel", "0123456789").catch(() => []);
  Promise.all([...artReady, numeralsReady]).then(([heads, tails, marble]) => {
    const classic = [4, 6, 8, 10, 12, 100].map(sides => {
      const section = preview.querySelector("#die").cloneNode(true);
      const id = "d" + sides;
      section.id = id;
      const title = section.querySelector("h2");
      title.id = id + "-title";
      title.dataset.copy = id;
      section.setAttribute("aria-labelledby", title.id);
      section.querySelector(".heading span").textContent = "D" + sides;
      if (sides === 100 || sides === 4) {
        const legend = document.createElement("div");
        legend.className = "reading-guide";
        for (const key of sides === 4 ? ["tip"] : ["tens", "units"]) {
          const label = document.createElement("span");
          label.dataset.copy = key;
          legend.append(label);
        }
        section.querySelector("output").before(legend);
      }
      preview.querySelector(".spread").insertBefore(section, preview.querySelector("#coin"));
      const draw = (ctx, t, value, art) => window.RandomClassicDice.draw(ctx, t, sides, value, art);
      return {sides, panel: makePanel(id, sides, 1500, draw, marble)};
    });
    const coin = makePanel("coin", 2, 1350, window.RandomCoin.draw, { heads, tails });
    const die = makePanel("die", 20, 1500, window.RandomD20.draw, marble);
    panels.push(coin, die, ...classic.map(entry => entry.panel));
    const entries = [...classic, {sides: 2, panel: coin}, {sides: 20, panel: die}];
    pair.addEventListener("click", () => {
      for (const {sides, panel} of entries) panel.play(1 + Math.floor(Math.random() * sides));
    });
    pair.disabled = false;
    for (const {sides, panel} of entries) panel.play(sides);
    translate();
  }).catch(() => {
    error.textContent = copy[lang].error;
    error.hidden = false;
  });
})();
