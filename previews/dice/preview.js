// Standalone review page. The example values exist only in this preview.
(() => {
  "use strict";
  const copy = {
    en: {
      title: "Dice in motion", intro: "Play the paired examples, or choose a face to inspect its landing.",
      pair: "Play next pair", coin: "Coin toss", die: "Twenty-sided die", toss: "Toss coin", roll: "Roll die",
      choose: "Choose a face…", coinChoice: "Choose a coin face", dieChoice: "Choose a D20 face",
      rolling: "Rolling…", tossing: "Tossing…", heads: "Heads", tails: "Tails", result: "Result",
      error: "The artwork could not load. Open the preview with its art folder alongside it."
    },
    fr: {
      title: "Les dés en mouvement", intro: "Lancez les deux exemples ou choisissez une face pour observer le résultat.",
      pair: "Voir le duo suivant", coin: "Pile ou face", die: "Dé à vingt faces", toss: "Lancer la pièce", roll: "Lancer le dé",
      choose: "Choisir une face…", coinChoice: "Choisir un côté de la pièce", dieChoice: "Choisir une face du D20",
      rolling: "Le dé roule…", tossing: "La pièce tourne…", heads: "Face", tails: "Pile", result: "Résultat",
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
        status.textContent = sides === 2 ? words.tossing : words.rolling;
      } else {
        const label = sides === 20 ? words.result : target === 1 ? words.heads : words.tails;
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
      select.setAttribute("aria-label", copy[lang][sides === 2 ? "coinChoice" : "dieChoice"]);
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
    const coin = makePanel("coin", 2, 1350, window.RandomCoin.draw, { heads, tails });
    const die = makePanel("die", 20, 1500, window.RandomD20.draw, marble);
    panels.push(coin, die);
    let secondPair = false;
    function playPair() {
      coin.play(secondPair ? 2 : 1);
      die.play(secondPair ? 1 : 20);
      secondPair = !secondPair;
    }
    pair.addEventListener("click", playPair);
    pair.disabled = false;
    playPair();
    translate();
  }).catch(() => {
    error.textContent = copy[lang].error;
    error.hidden = false;
  });
})();
