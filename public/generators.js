"use strict";

const generatorCopy = {
  en: {
    general: "General tables", character: "Character", creature: "Creature", options: "Generation options",
    browse: "Browse tables", search: "Search this list", empty: "No matches", category: "Category",
    roll: "Reroll", pick: "Choose", quantity: "Number of items", presence: "Include in sheet",
    include: "Included", none: "None", gold: "Gold", statistics: "Statistics", level: "Level",
    background: "Background", species: "Creature type", branch: "Follow a random branch",
    projection: "Output", subcategory: "Browse categories", entries: "Select an entry", library: "Save to library",
    preview: "Unsaved sheet", updated: "Updated", properties: "Properties", randomLoot: "Random loot",
    chooseTable: "Choose a table or roll random loot.", chooseEntity: "Generate a sheet, then choose or reroll its entries.",
    settingsNote: "These options apply to the next full generation.", locked: "Defined by the archetype",
    PREVIEW_NOT_FOUND: "This preview has expired. Generate a new sheet to continue.",
  },
  fr: {
    general: "Tables générales", character: "Personnage", creature: "Créature", options: "Options de génération",
    browse: "Parcourir les tables", search: "Rechercher dans la liste", empty: "Aucun résultat", category: "Catégorie",
    roll: "Relancer", pick: "Choisir", quantity: "Nombre d’objets", presence: "Inclure dans la fiche",
    include: "Inclus", none: "Aucun", gold: "Or", statistics: "Statistiques", level: "Niveau",
    background: "Historique", species: "Type de créature", branch: "Suivre une branche au hasard",
    projection: "Résultat", subcategory: "Parcourir les catégories", entries: "Sélectionner une entrée", library: "Enregistrer en bibliothèque",
    preview: "Fiche non enregistrée", updated: "Mise à jour", properties: "Propriétés", randomLoot: "Butin aléatoire",
    chooseTable: "Choisissez une table ou générez du butin aléatoire.", chooseEntity: "Générez une fiche, puis choisissez ou relancez ses entrées.",
    settingsNote: "Ces options s’appliquent à la prochaine génération complète.", locked: "Défini par l’archétype",
    PREVIEW_NOT_FOUND: "Cet aperçu a expiré. Générez une nouvelle fiche pour continuer.",
  },
};
const gText = key => Object.hasOwn(generatorCopy[state.language], key) ? generatorCopy[state.language][key] : key;
const generatorTabs = new Map();
let generatorRender = 0;

function resetGenerators() {
  generatorTabs.clear();
  state.generation = { kind: "general" };
  generatorRender++;
}

function activateGenerator(requested, campaign, language) {
  const kind = ["general", "character", "creature"].includes(requested) ? requested : "general";
  const key = `${campaign}/${kind}`;
  if (!generatorTabs.has(key)) generatorTabs.set(key, {
    kind, campaign, language, trail: [], level: "", preview: null, result: null, busy: false,
  });
  state.generation = generatorTabs.get(key);
}

function generatorFieldName(key) {
  const label = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  return state.locale.generatorFields?.[label] || key.replaceAll("_", " ");
}

function genButton(label, name, value = "", extra = "") {
  return `<button type="button" data-action="gen-${attr(name)}" data-value="${attr(value)}" ${extra}>${esc(label)}</button>`;
}
function genRoot(gen) {
  return gen.kind === "general" ? "" : gen.kind === "character" ? "background" : "creature";
}
function resultName(gen) {
  const data = gen.preview?.data;
  return data ? (gen.kind === "character" ? [data.name.firstName, data.name.lastName].join(" ") : data.name) : gText(gen.kind);
}
function searchList(rows, label) {
  if (!rows.length) return "";
  return `<div class="gen-search"><label><span class="sr-only">${esc(label)}</span><input type="search" data-gen-search placeholder="${attr(gText("search"))}"></label><div class="gen-list">${rows.join("")}</div><p class="muted" data-no-matches hidden>${esc(gText("empty"))}</p></div>`;
}
function catalogButton(label, name, value, direction, description = "") {
  return `<button type="button" class="gen-option" data-action="gen-${name}" data-value="${attr(value)}" data-label="${attr(label)}"><span>${esc(label)}${description ? `<small>${esc(description)}</small>` : ""}</span><span aria-hidden="true">${direction}</span></button>`;
}

function browseMarkup(gen, browse) {
  const general = gen.kind === "general";
  const root = general ? gText("browse") : gText(gen.kind === "character" ? "background" : "species");
  const crumbs = [{ label: root }, ...gen.trail];
  const trail = `<nav class="gen-crumbs" aria-label="${attr(root)}">${crumbs.map((part, i) =>
    i === crumbs.length - 1 ? `<strong aria-current="page">${esc(part.label)}</strong>` :
      genButton(part.label, "back", i, 'class="plain"')).join('<span aria-hidden="true">›</span>')}</nav>`;
  const rows = browse.roots ? browse.roots.map(item => catalogButton(item.name, "path", item.id, "›", item.description)) :
    browse.candidates.map(item => catalogButton(item.label, browse.branches ? "path" : "entry", item.value, browse.branches ? "›" : "✓"));
  const route = browse.fields?.find(item => item.kind === "route");
  const fields = general ? browse.fields?.filter(item => item.kind === "field") || [] : [];
  return `${trail}${rows.length ? `<h3>${esc(gText(browse.roots || browse.branches ? "subcategory" : "entries"))}</h3>${searchList(rows, root)}` : ""}
    ${route ? catalogButton(gText("branch"), "path", route.value, "›") : ""}
    ${fields.length ? `<div class="gen-fields"><span>${esc(gText("projection"))}</span>${fields.map(item =>
      genButton(generatorFieldName(item.label), "field", item.value, 'class="secondary"')).join("")}</div>` : ""}`;
}

function previewControls(gen, field, index) {
  const controls = gen.preview.controls.filter(control => control.field === field && control.index === index);
  if (!controls.length) {
    const intrinsic = gen.kind === "creature" && index !== undefined && ["rules.value", "traits.value"].includes(field);
    return intrinsic ? `<small class="muted">${esc(gText("locked"))}</small>` : "";
  }
  const row = control => {
    const current = control.current === undefined ? "" : gText(control.current);
    const label = gText(control.label);
    const feedback = gen.editedKey === control.key && gen.preview.changed.length
      ? `<p class="gen-changes" role="status">${esc(gText("updated"))} · ${esc(changeMessage(gen.preview))}</p>` : "";
    return `<div class="gen-control" data-choice-key="${attr(control.key)}"><div class="gen-choice-row"><span>${esc(label)}${current ? `<small>${esc(current)}</small>` : ""}</span>
      <div>${genButton(gText("roll"), "reroll", control.key, `class="plain" aria-label="${attr(gText("roll") + " · " + label)}"`)}
      ${control.selectable ? genButton(gText("pick"), "options", control.key, `class="secondary" aria-expanded="false" aria-label="${attr(gText("pick") + " · " + label)}"`) : ""}</div></div>${feedback}</div>`;
  };
  const primary = controls.find(control => !/\.(category|source|route\d+|presence)$/.test(control.key)) || controls[0];
  const rest = controls.filter(control => control !== primary);
  return `<div class="gen-controls">${row(primary)}${rest.length ? `<details class="gen-properties"><summary>${esc(gText("properties"))} (${rest.length})</summary>${rest.map(row).join("")}</details>` : ""}</div>`;
}

function changeMessage(preview) {
  return preview.changed.map(change => fieldLabel(change.label) +
    (change.from === undefined ? "" : ` ${change.from} → ${change.to}`)).join(", ");
}

function previewMarkup(gen) {
  const preview = gen.preview;
  const controls = (field, index) => previewControls(gen, field, index);
  const sections = preview.sections.map(section => {
    if (section.id !== "background") return section;
    return { ...section, fields: [{ id: "background.archetype", labelKey: "character.fields.backgroundArchetype" }, ...section.fields],
      value: { ...section.value, "background.archetype": preview.data.background.archetype } };
  });
  return `<header class="gen-sheet-title"><span class="eyebrow">${esc(gText("preview"))} · ${esc(preview.language.toUpperCase())}</span><h2>${esc(resultName(gen))}</h2></header>
    ${preview.changed.length && !preview.controls.some(c => c.key === gen.editedKey) ? `<p class="gen-changes" role="status">${esc(gText("updated"))} · ${esc(changeMessage(preview))}</p>` : ""}
    <div class="sheet-sections">${sections.map(section => sectionMarkup(section, preview.data, false, controls)).join("")}</div>`;
}

async function generatorScreen() {
  const seq = ++generatorRender;
  const gen = state.generation;
  const general = gen.kind === "general";
  const path = gen.trail.at(-1)?.value || genRoot(gen);
  const cacheKey = `${gen.language}/${path}`;
  if (cacheKey !== gen.browseKey) {
    const browse = await api(`/api/generators?language=${gen.language}&path=${encodeURIComponent(path)}`);
    if (seq !== generatorRender || state.screen !== "generators") return;
    gen.browse = browse;
    gen.browseKey = cacheKey;
  }
  if (state.screen !== "generators") return;
  const art = general ? "loot" : gen.kind === "character" ? "characters" : "combat";
  const tabs = ["general", "character", "creature"].map(kind => genButton(gText(kind), "kind", kind,
    `aria-pressed="${gen.kind === kind}" class="${gen.kind === kind ? "active" : ""}"`)).join("");
  const scope = gen.trail.at(-1)?.label || (general ? gText("randomLoot") : t("random"));
  const options = `<label>${esc(t("generationLanguage"))}${langSelect("generationLanguage", gen.language)}</label>
    ${general ? "" : `<label>${esc(t("level"))}<select id="generation-level"><option value="">${esc(t("random"))}</option>${Array.from({ length: 10 }, (_, i) => `<option ${gen.level === String(i + 1) ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label>`}`;
  app.innerHTML = `<div class="gen-workspace"><header class="gen-banner"><div><h1>${esc(t("generators"))}</h1><p>${esc(t("generationIntro"))}</p></div><img src="/media/${art}-card.webp" alt=""></header>
    <nav class="tabs gen-tabs" aria-label="${attr(t("generators"))}">${tabs}</nav>
    <div class="gen-columns"><details class="paper gen-catalog" ${gen.optionsOpen !== false ? "open" : ""}><summary>${esc(gText("options"))}</summary>
    <div class="gen-settings">${options}</div>${gen.preview ? `<p class="muted">${esc(gText("settingsNote"))}</p>` : ""}${browseMarkup(gen, gen.browse)}</details>
    <section class="gen-sheet" aria-label="${attr(general ? t("result") : gText("preview"))}">${general && gen.result ? `<h2>${esc(t("result"))}</h2>${resultMarkup(gen.result)}` : gen.preview ? previewMarkup(gen) :
      `<div class="gen-empty"><img src="/media/${art}-card.webp" alt=""><h2>${esc(general ? t("result") : t("generatedPreview"))}</h2><p>${esc(gText(general ? "chooseTable" : "chooseEntity"))}</p></div>`}</section></div>
    <div class="gen-dock"><div><span class="gen-target">${esc(gText(gen.kind))}<strong>${esc(scope)}</strong></span><div class="actions">
    ${genButton(gen.result || gen.preview ? t("regenerate") : t("generate"), "generate", "", gen.busy ? "disabled" : "")}
    ${gen.preview ? genButton(gText("library"), "save", "", `class="secondary" ${gen.busy ? "disabled" : ""}`) : ""}</div></div></div></div>`;
}

async function generatorAction(what, value, button) {
  const gen = state.generation;
  if (gen.busy) return;
  if (what === "gen-kind") {
    activateGenerator(value, gen.campaign, gen.language);
    const query = new URLSearchParams();
    query.set("kind", value);
    if (gen.campaign) query.set("campaign", gen.campaign);
    history.replaceState(null, "", `#/generators?${query}`);
    return generatorScreen();
  }
  gen.optionsOpen = document.querySelector(".gen-catalog").open;
  if (what === "gen-back") {
    gen.trail.length = Number(value);
    return generatorScreen();
  }
  if (["gen-entry", "gen-field", "gen-path"].includes(what)) {
    gen.trail.push({ value, label: button.dataset.label || button.textContent.trim() });
    if (what === "gen-path" || gen.kind !== "general") return generatorScreen();
  }
  if (what === "gen-options") {
    const container = button.closest(".gen-control");
    if (container.querySelector(".gen-picker")) {
      container.querySelector(".gen-picker").remove();
      button.setAttribute("aria-expanded", "false");
      return;
    }
    const { options } = await api(`/api/entity-previews/${gen.preview.previewId}/options?key=${encodeURIComponent(value)}`);
    if (!container.isConnected || container.querySelector(".gen-picker")) return;
    container.insertAdjacentHTML("beforeend", `<div class="gen-picker">${searchList(options.map(item =>
      catalogButton(gText(item.name), "choose", item.id, "✓")), gText("pick"))}</div>`);
    button.setAttribute("aria-expanded", "true");
    container.querySelector("input")?.focus({ preventScroll: true });
    return;
  }
  const oldScroll = scrollY;
  const openProperties = [...document.querySelectorAll(".gen-properties[open]")].map(node => node.querySelector("[data-choice-key]").dataset.choiceKey);
  const closedSections = [...document.querySelectorAll(".gen-sheet .sheet-section:not([open])")].map(node => node.className);
  const choiceKey = what === "gen-choose" ? button.closest("[data-choice-key]").dataset.choiceKey : value;
  gen.busy = true;
  const workspace = document.querySelector(".gen-workspace");
  workspace.setAttribute("aria-busy", "true");
  workspace.querySelectorAll("button, select").forEach(el => { el.disabled = true; });
  try {
    if (what === "gen-save") {
      const saved = await api(`/api/entity-previews/${gen.preview.previewId}/save`, "POST", { revision: gen.preview.revision });
      gen.preview = null;
      if (state.generation === gen && state.screen === "generators") location.hash = `#/sheet/${saved.id}`;
      return;
    }
    if (what === "gen-choose" || what === "gen-reroll") {
      gen.preview = await api(`/api/entity-previews/${gen.preview.previewId}/choice`, "POST", {
        revision: gen.preview.revision, key: choiceKey, ...(what === "gen-choose" ? { value } : {}),
      });
      gen.editedKey = choiceKey;
    } else if (gen.kind === "general") {
      gen.result = (await api("/api/generators", "POST", {
        path: gen.trail.at(-1)?.value || "loot.generator", language: gen.language,
      })).result;
    } else {
      const path = gen.trail.at(-1)?.value || "";
      const start = path.search(/[.:]/);
      gen.preview = await api("/api/entity-previews", "POST", {
        type: gen.kind, tab: state.tab, language: gen.language, level: gen.level, path: start < 0 ? "" : path.slice(start + 1),
        replace: gen.preview?.previewId,
      });
      gen.editedKey = null;
      if (matchMedia("(max-width: 800px)").matches) gen.optionsOpen = false;
    }
  } catch (error) {
    if (error.message === "PREVIEW_NOT_FOUND") {
      gen.preview = null;
      notify(gText(error.message), true);
    } else if (error.message === "VERSION_CONFLICT" && gen.preview) {
      gen.preview = await api(`/api/entity-previews/${gen.preview.previewId}`);
      notify(t("VERSION_CONFLICT"), true);
    } else throw error;
  } finally {
    gen.busy = false;
    if (state.generation === gen && state.screen === "generators" && location.hash.startsWith("#/generators")) {
      await generatorScreen();
      document.querySelectorAll(".gen-properties").forEach(node => {
        node.open = openProperties.includes(node.querySelector("[data-choice-key]").dataset.choiceKey);
      });
      document.querySelectorAll(".gen-sheet .sheet-section").forEach(node => {
        if (closedSections.includes(node.className)) node.open = false;
      });
      if (what === "gen-reroll" || what === "gen-choose") {
        const selector = `[data-choice-key="${CSS.escape(choiceKey)}"] button`;
        document.querySelector(selector)?.focus({ preventScroll: true });
        window.scrollTo(0, oldScroll);
      } else if (gen.preview || gen.result) {
        document.querySelector(".gen-sheet")?.scrollIntoView({ block: "nearest" });
      }
    }
  }
}

document.addEventListener("input", event => {
  if (!event.target.matches("[data-gen-search]")) return;
  const fold = value => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
  const query = fold(event.target.value);
  const list = event.target.closest(".gen-search");
  let matches = 0;
  list.querySelectorAll(".gen-option").forEach(option => {
    option.hidden = !fold(option.textContent).includes(query);
    if (!option.hidden) matches++;
  });
  list.querySelector("[data-no-matches]").hidden = matches !== 0;
});
