/* RANDOM's browser is a presentation client; game rules and authorization live on the server. */
import { state, t, esc, attr, fieldLabel, notify, errorMessage, api } from "./core.js";
import { createGenerators } from "./generators.js";
import { createSheetEditor } from "./sheet-editor.js";
import { createNavigation } from "./navigation.js";
import { createCampaignScreen } from "./campaign-screen.js";

const app = document.querySelector("#app");
const masthead = document.querySelector("#masthead");
const sheetEditor = createSheetEditor({ esc, attr, t });
const { resetGenerators, activateGenerator, generatorFieldName, generatorScreen, generatorAction } =
  createGenerators({ state, api, t, esc, attr, sectionMarkup, langSelect, resultMarkup, notify, app });
function tag(label, cls = "") {
  return `<span class="pill ${cls}">${esc(label)}</span>`;
}
function action(label, actionName, value = "", cls = "secondary") {
  return `<button type="button" class="${cls}" data-action="${attr(actionName)}" data-value="${attr(value)}">${esc(label)}</button>`;
}
function header(title, description = "", buttons = "") {
  return `<header class="page-head"><div><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ""}</div>${buttons ? `<div class="actions">${buttons}</div>` : ""}</header>`;
}
function input(label, name, value = "", options = "") {
  return `<label>${esc(label)}<input name="${attr(name)}" value="${attr(value)}" ${options}></label>`;
}
function langSelect(name = "language", value = state.language) {
  return `<select name="${name}" aria-label="${attr(t("language"))}"><option value="en" ${value === "en" ? "selected" : ""}>English</option><option value="fr" ${value === "fr" ? "selected" : ""}>Français</option></select>`;
}
function mast() {
  const nav = [
    "home",
    "campaigns",
    "characters",
    "creatures",
    "generators",
    "dice",
    "rulebook",
  ];
  if (state.user?.role === "admin") nav.push("admin");
  const links = nav.map((n) =>
    `<a href="#/${n}" ${state.screen === n ? 'class="active" aria-current="page"' : ""}>${esc(t(n))}</a>`
  ).join("");
  masthead.innerHTML = `<div class="mast-inner">
    <a class="brand" href="#/home">RANDOM<small>${esc(t("tagline"))}</small></a>
    ${state.user ? `<nav class="main-nav" aria-label="${attr(t("navigation"))}">${links}</nav>` : ""}
    <div class="account">${state.user ? `<span class="username" title="${attr(state.user.username)}">${esc(state.user.username)}</span>` : ""}
    ${langSelect("siteLanguage")}${state.user ? `<button class="secondary" data-action="logout">${esc(t("signOut"))}</button>` : ""}</div></div>`;
  document.documentElement.lang = state.language;
  document.title = `RANDOM · ${t("tagline")}`;
  document.querySelector("#footer-tagline").textContent = t("tagline");
}
function authScreen(mode = "login", status = "") {
  resetGenerators();
  state.screen = "auth";
  mast();
  const params = new URLSearchParams(location.search),
    invite = params.get("invite"),
    reset = params.get("reset");
  if (reset) mode = "reset";
  else if (invite && mode === "login") mode = "register";
  const title =
    mode === "login"
      ? t("signIn")
      : mode === "reset"
        ? t("resetPassword")
        : invite
          ? t("inviteRegister")
          : t("register");
  app.innerHTML = `<div class="auth-layout"><div class="auth-art"><div class="auth-copy"><h2>${esc(t("welcome"))}</h2><p>${esc(t("welcomeText"))}</p></div><img src="/media/journey-1000.webp" srcset="/media/journey-1000.webp 1000w, /media/journey.webp 1672w" sizes="(max-width: 720px) 100vw, 50vw" alt=""></div><div class="auth-form"><h1>${esc(title)}</h1>${status ? `<p class="warning">${esc(status)}</p>` : ""}<form id="auth-form" data-mode="${mode}">${mode !== "reset" ? input(t("username"), "username", "", 'required autocomplete="username" minlength="3" maxlength="32"') : ""}${mode === "register" ? `<small>${esc(t("usernameHint"))}</small>` : ""}${input(t("password"), "password", "", 'required minlength="12" type="password" autocomplete="' + (mode === "login" ? "current-password" : "new-password") + '"')}${mode !== "login" ? `<small>${esc(t("passwordHint"))}</small>` : ""}${mode === "register" ? `<label>${esc(t("language"))}${langSelect()}</label>` : ""}<p><button class="full">${esc(title)}</button></p></form><div class="divider">✦</div>${mode === "login" ? action(t("register"), "auth-mode", "register", "plain") : !reset ? action(t("signIn"), "auth-mode", "login", "plain") : ""}</div></div>`;
}
function homeScreen() {
  const destinations = [
    ["characters", "characters"],
    ["creatures", "combat"],
    ["generators", "loot"],
    ["dice", "dice"],
    ["rulebook", "cover"],
  ];
  app.innerHTML = `<section class="hero paper"><div class="hero-copy"><h1>${esc(t("adventure"))}</h1><p>${esc(t("homeIntro"))}</p><a class="button" href="#/campaigns">${esc(t("openCampaigns"))}</a></div><img class="hero-art" src="/media/journey-1000.webp" srcset="/media/journey-1000.webp 1000w, /media/journey.webp 1672w" sizes="(max-width: 720px) 100vw, 50vw" alt=""></section>
    <section class="shortcuts"><h2 class="ruled-title">${esc(t("begin"))}</h2><div class="shortcut-grid">${destinations.map(([page, art]) =>
      `<a class="card shortcut" href="#/${page}"><img src="/media/${art}-card.webp" alt=""><span class="shortcut-title">${esc(t(page))}<span aria-hidden="true">→</span></span></a>`
    ).join("")}</div></section>`;
}
function imageFor(type, id, portrait, extra = "") {
  if (
    !extra &&
    state.preview &&
    state.sheet?.id === id &&
    state.sheet.previewPortrait
  )
    extra = `?preview=1&tab=${encodeURIComponent(state.tab)}`;
  return portrait
    ? `/api/entities/${encodeURIComponent(id)}/portrait${extra}`
    : `/media/${type === "creature" ? "combat" : "characters"}-card.webp`;
}
function entityCard(e, campaign = "") {
  const query = campaign ? `?campaign=${encodeURIComponent(campaign)}` : "";
  return `<article class="card entity-card"><a href="#/sheet/${attr(e.id)}${query}">
    <img class="card-art" src="${attr(imageFor(e.type, e.id, e.portrait))}" alt="">
    <div class="card-body"><div class="eyebrow">${esc(t(e.type === "character" ? "characterSheet" : "creatureSheet"))}</div>
    <h2>${esc(e.name)}</h2><span class="card-link">${esc(t("viewSheet"))}<span aria-hidden="true">→</span></span></div>
    </a></article>`;
}
async function campaignList() {
  const current = captureRoute();
  const data = await api("/api/campaigns");
  if (!current()) return;
  app.innerHTML = `${header(t("campaigns"), t("campaignIntro"), action(t("newCampaign"), "show-new-campaign", "", ""))}<section id="new-campaign" class="paper" hidden><h2>${esc(t("newCampaign"))}</h2><form id="create-campaign">${input(t("name"), "name", "", 'required maxlength="120"')}<label>${esc(t("description"))}<textarea name="description" maxlength="4000"></textarea></label><label>${esc(t("language"))}${langSelect()}</label><p><button>${esc(t("create"))}</button></p></form></section>${data.invitations.length ? `<section class="paper"><h2>${esc(t("invitations"))}</h2><div class="list">${data.invitations.map((i) => `<div class="list-row"><div class="grow"><strong>${esc(i.name)}</strong><p class="muted">${esc(t("invitedBy"))} ${esc(i.invitedBy)}</p></div>${action(t("accept"), "campaign-invite", `${i.id}|accept`)}${action(t("reject"), "campaign-invite", `${i.id}|reject`)}</div>`).join("")}</div></section><div class="divider">✦</div>` : ""}${data.campaigns.length ? `<div class="grid">${data.campaigns.map((c) => `<article class="card campaign-card"><img class="cover" src="${c.cover ? `/api/campaigns/${attr(c.id)}/cover` : "/media/journey-1000.webp"}" alt=""><div class="card-body"><h3><a class="campaign-card-link" href="#/campaign/${attr(c.id)}/overview">${esc(c.name)}</a></h3><p>${esc(c.description)}</p><p>${tag(c.role === "gm" ? t("gm") : c.role ? t("member") : t("owner"))}</p></div></article>`).join("")}</div>` : `<div class="empty">${esc(t("noCampaigns"))}</div>`}`;
}
function resourcePills(resources) {
  return `<div class="resources">${["hp", "ar", "ap", "md"].map((key) => {
    const label = fieldLabel(`character.resources.${key}.name`);
    const short = fieldLabel(`character.resources.${key}.abbreviation`);
    return `<span class="resource" title="${attr(label)}"><span class="resource-label"><abbr title="${attr(label)}">${esc(short)}</abbr><span class="resource-name">${esc(label)}</span></span>
      <span class="resource-value"><b>${esc(resources[key].current)}</b> / ${esc(resources[key].max)}</span></span>`;
  }).join("")}</div>`;
}
const campaignRolls = new Map();
const recentChat = new Map();
const personalRolls = [];
const battleUI = { selectedBattleTarget: "", selectedBattleToken: "", currentBattleSession: null,
  resourceMode: "damage", resourceKey: "hp" };
const { campaignScreen, refreshBattle } = createCampaignScreen({ state, app, api, t, esc, attr,
  fieldLabel, action, header, input, langSelect, tag, resourcePills, imageFor, entityCard,
  chatMessage, mountChatRolls, animatedDice, campaignRolls, recentChat, battleUI,
  captureRoute: () => captureRoute(), parseRoute: () => parseRoute() });
const { parseRoute, renderRoute, refreshSoon, captureRoute } = createNavigation({
  state, app, api, mast, authScreen, flushSheet, homeScreen, campaignList,
  campaignScreen, libraryScreen, renderSheet, entityScreen, activateGenerator,
  generatorScreen, diceScreen, rulebookScreen, adminScreen, notify, errorMessage,
  clearPersonalRolls, campaignRolls, recentChat, animatedDice, chatMessage,
  mountChatRolls, loseLock, refreshBattle, t,
});
let personalRequest = 0;
let personalSession = 0;

function clearPersonalRolls() {
  personalRolls.length = 0;
  personalSession++;
}

function animatedDice(result) {
  return Array.isArray(result.rolls) &&
    (result.sides === 2 || result.sides === 20 || window.RandomClassicDice?.supports(result.sides));
}
function diceDetails(r) {
  const criticalLabels = r.sides === 20 ? [[1, "criticalSuccess"], [20, "criticalFailure"]]
    .filter(([face]) => r.rolls.includes(face))
    .map(([face, key]) => tag(`${face} · ${t(key)}`)).join(" ") : "";
  return `<div class="dice-details"><div class="eyebrow">${esc(r.normalized)}</div><div>${esc(r.rolls.join(" + "))}${r.modifier ? ` ${r.modifier > 0 ? "+" : "−"} ${esc(Math.abs(r.modifier))} (${esc(t("modifier"))})` : ""}</div><strong class="result-total">${esc(t("total"))}: ${esc(r.total)}</strong>${criticalLabels && `<div>${criticalLabels}</div>`}</div>`;
}
function showDiceResult(element, result) {
  element.querySelector('[role="status"]')?.remove();
  element.insertAdjacentHTML("beforeend", diceDetails(result));
}
function mountDice(record, element) {
  window.RandomDicePlayback.mount(record, element, t("diceRolling"), showDiceResult);
}
function diceDisplay(r, rollId = "") {
  if (animatedDice(r)) {
    const places = r.sides === 100 ? ` data-tens="${attr(t("tens"))}" data-units="${attr(t("units"))}"` : "";
    return `<div class="dice-result dice-animated" aria-live="polite" data-roll-id="${attr(rollId)}"${places}></div>`;
  }
  const illustrated = [4, 6, 8, 10, 12, 20].includes(r.sides);
  const faces = r.animation
    ? `<img src="/media/${attr(r.animation)}" alt="${attr(r.rolls[0])}">`
    : r.rolls
        .map((n) =>
          illustrated
            ? `<span class="illustrated-die"><img src="/media/die-d${attr(r.sides)}.webp" alt=""><strong>${esc(n)}</strong></span>`
            : `<span class="die-number">${esc(n)}</span>`,
        )
        .join("");
  const { id, ink, glow, finish } = window.RandomDiceMaterials.resolve(r.appearance);
  return `<div class="dice-result" data-finish="${attr(finish || "")}" style="--die-texture:url('/dice/art/${id}.webp');--die-ink:${ink};--die-glow:${glow}">${faces}${diceDetails(r)}</div>`;
}
function chatMessage(item) {
  const who = item.identity?.characterName
    ? `${item.identity.characterName} (${item.identity.username})`
    : item.identity?.username || "";
  const content =
    item.type === "text"
      ? `<p>${esc(item.text)}</p>`
      : item.type === "roll"
        ? `${item.privateRoll ? tag(t("private")) : ""}${diceDisplay(item.result, item.id || "")}`
        : `<p>${item.entityName ? `<strong>${esc(item.entityName)}</strong> · ` : ""}${esc(t(item.action === "end-turn" ? "endTurn" : item.action === "resource" || item.action === "set" ? "status" : item.action))}</p>${item.resources ? resourcePills(item.resources) : ""}`;
  return `<div class="chat-message" data-chat-id="${attr(item.id || "")}"><strong>${esc(who)}</strong> <small>${esc(new Date(item.time).toLocaleTimeString(state.language, { hour: "2-digit", minute: "2-digit" }))}</small>${content}</div>`;
}
function mountChatRolls(container, items) {
  const elements = container.querySelectorAll(".dice-animated");
  const rolls = items.filter(item => item.type === "roll" && animatedDice(item.result));
  elements.forEach((element, index) => {
    const item = rolls[index];
    if (!item) return;
    let record = item.id && campaignRolls.get(item.id);
    if (!record) {
      record = window.RandomDicePlayback.create(item.result, false);
      if (item.id) campaignRolls.set(item.id, record);
    }
    mountDice(record, element);
  });
}
async function libraryScreen(type) {
  const current = captureRoute();
  const data = await api(`/api/entities?type=${type}`);
  if (!current()) return;
  const title = t(type === "character" ? "characters" : "creatures");
  app.innerHTML = `${header(title, t("entityIntro"), `${action(t("newBlank"), "new-entity", type, "")} <a class="button secondary" href="#/generators?kind=${type}">${esc(t(type === "character" ? "generateCharacter" : "generateCreature"))}</a>`)}${data.entities.length ? `<div class="grid">${data.entities.map((e) => entityCard(e)).join("")}</div>` : `<div class="empty">${esc(t("noEntities"))}</div>`}`;
}
function sheetValue(field, section, data, value, controls) {
  if (value == null || value === "")
    return `<span class="muted" aria-hidden="true">—</span><span class="sr-only">${esc(t("noValue"))}</span>`;
  if (field.pair) return esc(String(value).replace(":", " / "));
  if (field.format || (controls && Array.isArray(data[section.id]))) {
    const entries = section.kind === "multiline"
      ? data[section.id]
      : field.id.split(".").reduce((record, key) => record?.[key], data);
    if (Array.isArray(entries))
      return `<ul class="sheet-entries">${entries.map((entry, index) => {
        const actions = controls?.(field.id, index) || "";
        if (typeof entry === "string") return `<li>${esc(entry)}${actions}</li>`;
        const level = entry.level == null ? "" : ` <small>${esc(t("level"))} ${esc(entry.level)}</small>`;
        return `<li><strong>${esc(entry.name)}</strong>${level}<div>${esc(entry.description)}</div>${actions}</li>`;
      }).join("")}</ul>`;
  }
  return esc(value);
}
function sectionMarkup(section, data, enabled, controls) {
  const fields = ["multi", "named-lines"].includes(section.kind)
    ? section.fields
    : [
        section.fields[0] || {
          id: section.id,
          labelKey: section.labelKey,
          paragraph: section.kind !== "scalar",
        },
      ];
  const statistics =
    section.kind === "named-lines"
      ? Object.fromEntries(
          section.value.split("\n").map((line) => {
            const at = line.indexOf(":");
            return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
          }),
        )
      : null;
  const title = fieldLabel(section.labelKey);
  const body = fields
    .map((field) => {
      const value =
        section.kind === "multi"
          ? section.value[field.id]
          : section.kind === "named-lines"
            ? statistics[field.id.split(".").at(-1)]
            : section.value;
      const paragraph = field.paragraph || section.kind === "multiline";
      const label = fieldLabel(field.labelKey);
      if (!enabled) {
        const hideLabel = fields.length === 1 && label === title;
        return `<div class="sheet-field${paragraph ? " wide" : ""}"><dt${hideLabel ? ' class="sr-only"' : ""}>${esc(label)}</dt><dd>${sheetValue(field, section, data, value, controls)}${controls?.(field.id) || ""}</dd></div>`;
      }
      return sheetEditor.renderField(field, section, data, value, label);
    })
    .join("");
  const wrapper = enabled ? "div" : "dl";
  return `<details class="sheet-section section-${attr(section.id)}" open>
    <summary>${esc(title)}</summary>
    <${wrapper} class="section-body" data-section="${attr(section.id)}">${body}${enabled ? `<div class="section-save"><small role="status">${esc(t("unsaved"))}</small><button type="button" class="secondary" data-sheet-save>${esc(t("save"))}</button></div>` : ""}</${wrapper}>${controls?.(section.id) || ""}</details>`;
}
function sheetContents(entity, enabled = false) {
  const sections = [
    ...entity.sections.filter((s) => s.id === "statistics"),
    ...entity.sections.filter((s) => s.id !== "statistics"),
  ];
  return `<div class="sheet-sections">${sections.map((section) => sectionMarkup(section, entity.data, enabled)).join("")}</div>`;
}
async function entityScreen(entityId, campaignId = "") {
  const current = captureRoute();
  const entity = await api(
    `/api/entities/${encodeURIComponent(entityId)}${campaignId ? `?campaign=${encodeURIComponent(campaignId)}` : ""}`,
  );
  if (!current()) return;
  let campaigns = [];
  if (entity.isOwner) campaigns = (await api("/api/campaigns")).campaigns;
  if (!current()) return;
  state.sheet = entity;
  state.screen = entity.type === "creature" ? "creatures" : "characters";
  mast();
  state.sheetCampaign = campaignId;
  state.editing = false;
  state.preview = false;
  state.availableCampaigns = campaigns;
  renderSheet();
}
function sheetIdentity(entity) {
  const archetype = entity.type === "character" && entity.data.background?.archetype;
  return `<div class="eyebrow">${esc(t(entity.type === "character" ? "characterSheet" : "creatureSheet"))}</div>
    <h1>${esc(entity.name)}</h1>
    <div class="sheet-meta"><strong>${esc(t("level"))} ${esc(entity.data.level)}</strong>
    ${archetype ? `<span><span class="sr-only">${esc(fieldLabel("character.fields.backgroundArchetype"))}: </span>${esc(archetype)}</span>` : ""}
    <span>${esc(t("owner"))} · ${esc(entity.owner)}</span></div>`;
}
function renderSheet() {
  const e = state.sheet,
    edit = state.editing,
    preview = state.preview;
  const lockText =
    e.lock && !edit
      ? `<span class="warning">${esc(t("lockedBy"))}: ${esc(e.lock.username)}</span>`
      : "";
  const controls = e.canEdit
    ? edit
      ? `${action(t("finishEditing"), "lock-finish", "", "")} ${action(t("undo"), "undo", "undo")} ${preview ? action(t("redo"), "undo", "redo") + action(t("saveReversal"), "undo", "save", "") + action(t("cancelReversal"), "undo", "cancel") : ""}`
      : action(t("startEditing"), "lock-start", "", "")
    : "";
  const library = e.type === "character" ? "characters" : "creatures";
  const back = state.sheetCampaign ? `#/campaign/${attr(state.sheetCampaign)}/${library}` : `#/${library}`;
  const editable = edit && !preview;
  app.innerHTML = `<a class="back-link" href="${back}"><span aria-hidden="true">←</span> ${esc(t(library))}</a>
    <header class="sheet-heading paper${e.portrait ? " has-portrait" : ""}">
      <div class="sheet-identity">${sheetIdentity(e)}</div>
      <img class="sheet-portrait" src="${attr(imageFor(e.type, e.id, e.portrait))}" alt="">
    </header>
    <div class="sheet-bar">${resourcePills(e.data.resources)}
      ${controls || lockText ? `<div class="actions">${controls}${lockText}</div>` : ""}</div>
    ${preview ? `<p class="warning">${esc(t("previewing"))}</p>` : ""}
    <div id="lock-warning" class="warning" hidden></div>
    ${editable ? `<div class="edit-intro"><p>${esc(t("editHint"))}</p>
      <form id="entity-portrait-form"><label>${esc(t("portrait"))}<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label>
      <div class="actions"><button>${esc(t("upload"))}</button>${action(t("removeImage"), "entity-portrait-remove")}</div>
      <small>${esc(t("imageHint"))}</small></form></div>` : ""}
    ${sheetContents(e, editable)}${
    e.isOwner
      ? `<section class="sheet-settings"><h2 class="ruled-title">${esc(t("sheetSettings"))}</h2><div class="settings-grid"><section class="panel"><h3>${esc(t("permissions"))}</h3>${e.permissions.length ? e.permissions.map((p) => `<div class="list-row"><span class="grow">${esc(p.username)} · ${esc(t(p.permission))}</span>${action(t("revoke"), "revoke-permission", p.username)}</div>`).join("") : `<p class="muted">${esc(t("private"))}</p>`}<form id="permission-form">${input(t("username"), "username", "", "required")}<label>${esc(t("permissions"))}<select name="permission"><option value="viewer">${esc(t("viewer"))}</option><option value="editor">${esc(t("editor"))}</option></select></label><p><button>${esc(t("grant"))}</button></p></form></section><section class="panel"><h3>${esc(t("assignments"))}</h3>${e.assignments.map((a) => `<div class="list-row"><div class="grow">${esc(a.name)}<br>${tag(t(a.state === "pending" ? "pending" : "active"))} ${tag(t(a.visibility))}</div>${action(t("withdraw"), "entity-assignment-remove", a.campaign_id)}${action(t("changeVisibility"), "entity-assignment-visibility", `${a.campaign_id}|${a.visibility === "shared" ? "private" : "shared"}`)}</div>`).join("")}<form id="assignment-form"><label>${esc(t("requestAssignment"))}<select name="campaignId" required>${state.availableCampaigns
          .filter((c) => !e.assignments.some((a) => a.campaign_id === c.id))
          .map((c) => `<option value="${attr(c.id)}">${esc(c.name)}</option>`)
          .join(
            "",
          )}</select></label><label>${esc(t("status"))}<select name="visibility"><option value="private">${esc(t("private"))}</option><option value="shared">${esc(t("shared"))}</option></select></label><p><button>${esc(t("request"))}</button></p></form></section><section class="panel"><h3>${esc(t("transferOwnership"))}</h3><form id="entity-transfer">${input(t("username"), "username", "", "required")}<p><button>${esc(t("transfer"))}</button></p></form><div class="divider">✦</div><h3 class="danger">${esc(t("deleteEntity"))}</h3><p>${esc(t("confirmEntity"))}</p><form id="entity-delete">${input(t("name"), "confirm", "", "required")}<p><button>${esc(t("deleteEntity"))}</button></p></form></section></div></section>`
      : ""
  }`;
  if (editable) app.querySelectorAll(".entry-list").forEach(sheetEditor.refreshEntries);
  const assignmentForm = document.querySelector("#assignment-form");
  if (assignmentForm) {
    assignmentForm.elements.campaignId.required = false;
    const label = document.createElement("label");
    label.textContent = t("campaignReference");
    const input = document.createElement("input");
    input.name = "campaignReference";
    label.append(input);
    assignmentForm.insertBefore(label, assignmentForm.querySelector("p"));
  }
}
function loseLock() {
  if (!state.editing) return;
  state.editing = false;
  state.preview = false;
  document
    .querySelectorAll(
      "[data-section] :is(input,textarea,select,button),#entity-portrait-form input",
    )
    .forEach((el) => {
      el.disabled = true;
    });
  const box = document.querySelector("#lock-warning");
  if (box) {
    box.hidden = false;
    box.textContent = t("lockLost");
  }
  notify(t("lockLost"), true);
}
function mergeSheet(next) {
  state.sheet = {
    ...state.sheet,
    ...next,
    permissions: next.permissions || state.sheet?.permissions,
    assignments: next.assignments || state.sheet?.assignments,
  };
}
function markSectionDirty(container) {
  container.dataset.dirty = String((Number(container.dataset.dirty) || 0) + 1);
  container.querySelector(".section-save small").textContent = t("unsaved");
  if (container.hasAttribute("data-checked")) sheetEditor.check(container);
}
function saveSection(container) {
  if (!state.editing || state.preview || !container.dataset.dirty)
    return Promise.resolve();
  const entityId = state.sheet.id;
  const revision = container.dataset.dirty;
  if (container.pendingSave?.revision === revision)
    return container.pendingSave.promise;
  state.saveQueue = state.saveQueue
    .catch(() => {})
    .then(async () => {
      if (!state.editing || state.preview || state.sheet?.id !== entityId)
        throw new Error("LOCK_REQUIRED");
      if (!container.dataset.dirty) return;
      container.dataset.checked = "";
      if (sheetEditor.check(container)) throw new Error("checkFields");
      const captured = container.dataset.dirty;
      const { fields, recordRows } = sheetEditor.snapshot(container);
      const result = await api(`/api/entities/${entityId}/edit`, "POST", {
        tab: state.tab,
        field: container.dataset.section,
        fields,
        version: state.sheet.version,
        campaignId: state.sheetCampaign || null,
      });
      mergeSheet(result.entity);
      for (const rows of recordRows)
        rows.forEach((row, index) => { row.dataset.sourceIndex = String(index); });
      if (container.dataset.dirty === captured) {
        delete container.dataset.dirty;
        delete container.dataset.checked;
      }
      document
        .querySelector(".sheet-bar .resources")
        ?.replaceWith(
          document
            .createRange()
            .createContextualFragment(
              resourcePills(state.sheet.data.resources),
            ),
        );
      const identity = document.querySelector(".sheet-identity");
      if (identity) identity.innerHTML = sheetIdentity(state.sheet);
      notify(t("saved"));
    });
  const pending = state.saveQueue.catch((error) => {
    if (error.message === "LOCK_REQUIRED") loseLock();
    container.querySelector(".section-save small").textContent = errorMessage(error);
    notify(errorMessage(error), true);
    throw error;
  });
  container.pendingSave = { revision, promise: pending };
  pending
    .finally(() => {
      if (container.pendingSave?.promise === pending)
        container.pendingSave = null;
    })
    .catch(() => {});
  return pending;
}
async function flushSheet() {
  let section;
  while (state.editing && !state.preview && (section = app.querySelector("[data-section][data-dirty]"))) {
    try {
      await saveSection(section);
    } catch (error) {
      section.closest("details").open = true;
      const invalid = sheetEditor.check(section);
      invalid?.focus();
      invalid?.reportValidity();
      throw error;
    }
  }
}
function resultMarkup(result) {
  if (!result) return `<div class="empty">${esc(t("noPreview"))}</div>`;
  const fields = result.displayFields || result.fields;
  return `<article class="paper"><div class="eyebrow">${esc(result.generatorName || t("result"))}</div>${
    fields
      ? Object.entries(fields)
          .map(
            ([key, value]) =>
              `<p><strong>${esc(generatorFieldName(key))}</strong><br>${esc(typeof value === "string" ? value : JSON.stringify(value))}</p>`,
          )
          .join("")
      : `<p>${esc(result.value || result.display || "")}</p>`
  }${result.modifiers?.length ? `<div class="divider">✦</div><h3>${esc(t("modifiers"))}</h3>${result.modifiers.map((m) => `<p>${esc(m.display || m.value || "")}</p>`).join("")}` : ""}</article>`;
}
const glowPalette = [
  { color: "#dc4452", en: "Ruby", fr: "Rubis" },
  { color: "#ec9c28", en: "Amber", fr: "Ambre" },
  { color: "#37af83", en: "Jade", fr: "Jade" },
  { color: "#39bcd2", en: "Aquamarine", fr: "Aigue-marine" },
  { color: "#5389ed", en: "Sapphire", fr: "Saphir" },
  { color: "#a66cf0", en: "Amethyst", fr: "Améthyste" },
  { color: "#ed77a9", en: "Rose quartz", fr: "Quartz rose" },
];

function diceAppearanceForm() {
  const { skin, glow } = state.user.diceAppearance;
  const skins = window.RandomDiceMaterials.skins;
  const choices = Object.entries(skins).map(([id, material]) =>
    `<label class="skin-choice"><input type="radio" name="skin" value="${id}" ${skin === id ? "checked" : ""}>${material.finish === "silver-rim"
      ? '<span class="skin-sample silver-rim" aria-hidden="true"></span>'
      : `<img class="skin-sample" src="/dice/art/${id}.webp" alt="">`}<span>${esc(material[state.language])}</span></label>`
  ).join("");
  const color = glow || skins[skin].color;
  const choice = !glow ? "auto" : glowPalette.some(p => p.color === glow) ? glow : "custom";
  const radio = value => `<input type="radio" name="glowChoice" value="${value}" ${choice === value ? "checked" : ""}>`;
  const palette = glowPalette.map(p => `<label class="glow-swatch" title="${attr(p[state.language])}">
    ${radio(p.color)}<span style="--swatch:${p.color}"><span class="sr-only">${esc(p[state.language])}</span></span></label>`).join("");
  return `<form id="dice-appearance" class="paper dice-appearance"><h2>${esc(t("appearance"))}</h2>
    <div class="dice-workshop"><div class="dice-controls">
    <fieldset><legend>${esc(t("texture"))}</legend><div class="skin-choices">${choices}</div></fieldset>
    <fieldset><legend>${esc(t("glow"))}</legend><div class="glow-palette">
      <label class="glow-auto">${radio("auto")}<span>${esc(t("matchTexture"))}</span></label>${palette}
    </div><div class="custom-glow">
      <label>${radio("custom")} ${esc(t("customGlow"))}</label>
      <input type="color" aria-label="${attr(t("glow"))}" name="glow" value="${attr(color)}">
      <input type="text" name="hex" aria-label="${attr(t("hexColor"))}" value="${attr(color.toUpperCase())}" pattern="#?[0-9a-fA-F]{6}" maxlength="7" spellcheck="false" autocomplete="off" required>
    </div></fieldset>
    <button type="submit" class="secondary">${esc(t("save"))}</button></div>
    <section class="critical-preview"><div class="preview-heading"><h3>${esc(t("criticalPreview"))}</h3>
    <button type="button" class="secondary" data-replay>${esc(t("replay"))}</button></div>
    <div class="critical-tray"><div class="preview-stage" aria-hidden="true"></div>
    <span><b>1</b> ${esc(t("criticalSuccess"))}</span><span><b>20</b> ${esc(t("criticalFailure"))}</span></div>
    </section></div></form>`;
}

function chosenAppearance(form) {
  const { skin, glowChoice, glow } = form.elements;
  return { skin: skin.value, glow: glowChoice.value === "auto" ? null : glow.value };
}

function previewCriticals(form, replay = false) {
  if (!form.isConnected) return;
  const stage = form.querySelector(".preview-stage");
  const appearance = chosenAppearance(form);
  const key = JSON.stringify(appearance);
  if (!replay && stage.dataset.appearance === key) return;
  stage.dataset.appearance = key;
  const view = document.createElement("div");
  stage.replaceChildren(view);
  const playback = window.RandomDicePlayback;
  const record = playback.create({ sides: 20, rolls: [1, 20], appearance }, true);
  playback.mount(record, view, "", node => node.querySelector('[role="status"]')?.remove());
}

function updateGlow(form, target, editing = false) {
  const { skin, glowChoice, glow, hex } = form.elements;
  if (target === hex) {
    if (!hex.validity.valid) return;
    glow.value = "#" + hex.value.replace(/^#/, "");
  }
  if (target === glow || target === hex) glowChoice.value = "custom";
  if (glowChoice.value === "auto") glow.value = window.RandomDiceMaterials.skins[skin.value].color;
  else if (glowChoice.value !== "custom") glow.value = glowChoice.value;
  if (target !== hex || !editing) hex.value = glow.value.toUpperCase();
  clearTimeout(form.glowTimer);
  if (editing) form.glowTimer = setTimeout(() => previewCriticals(form), 180);
  else previewCriticals(form);
}
function diceScreen() {
  app.innerHTML = `${header(t("dice"), t("diceIntro"))}<div class="grid two"><section class="paper"><img class="card-art dice-art" src="/media/dice-card.webp" alt=""><form id="dice-form">${input(t("expression"), "expression", "1d20", "required")}<small>${esc(t("diceExample"))}</small><p><button>${esc(t("roll"))}</button></p></form></section><section class="paper"><h2>${esc(t("personalRoll"))}</h2><div id="dice-result" class="chat"></div></section></div>`;
  app.insertAdjacentHTML("beforeend", diceAppearanceForm());
  const form = document.querySelector("#dice-appearance");
  form.querySelector("[data-replay]").addEventListener("click", () => previewCriticals(form, true));
  previewCriticals(form);
  renderPersonalRolls();
}
function renderPersonalRolls() {
  const target = document.querySelector("#dice-result");
  if (!target) return;
  target.innerHTML = personalRolls.length
    ? personalRolls.map(entry => chatMessage(entry.item)).join("")
    : `<p class="muted">${esc(t("noPreview"))}</p>`;
  personalRolls.forEach((entry, index) => {
    if (!entry.record) return;
    const element = target.children[index].querySelector(".dice-animated");
    window.RandomDicePlayback.mount(entry.record, element, t("diceRolling"), (node, result) => {
      showDiceResult(node, result);
      if (target.isConnected) target.scrollTop = target.scrollHeight;
    });
  });
  target.scrollTop = target.scrollHeight;
}
function rulebookScreen() {
  const language = state.rulebookLanguage || state.language;
  app.innerHTML = `${header(t("rulebook"), t("rulebookIntro"), `<a class="button secondary" href="/rulebook/${language}" target="_blank" rel="noopener">${esc(t("openEdition"))}</a>`)}<div class="tabs">${["en", "fr"].map((x) => `<button type="button" aria-pressed="${x === language}" class="${x === language ? "active" : ""}" data-action="rulebook-language" data-value="${x}">${x === "fr" ? "Français" : "English"}</button>`).join("")}</div><iframe class="rulebook-frame" title="${attr(t("rulebook"))}" src="/rulebook/${language}"></iframe>`;
}
async function adminScreen() {
  const current = captureRoute();
  const [{ users }, { invitations }] = await Promise.all([
    api("/api/admin/users"),
    api("/api/admin/invitations"),
  ]);
  if (!current()) return;
  app.innerHTML = `${header(t("administration"))}<div class="split"><section class="paper"><h2>${esc(t("accounts"))}</h2><div class="list">${users.map((u) => `<div class="list-row"><div class="grow"><strong>${esc(u.username)}</strong><p>${tag(t(u.status))} ${tag(t(u.role))}</p></div><div class="actions">${u.status === "pending" ? action(t("approve"), "admin-user", `${u.id}|status|active`) + action(t("reject"), "admin-user", `${u.id}|status|rejected`) : action(t(u.status === "active" ? "disable" : "enable"), "admin-user", `${u.id}|status|${u.status === "active" ? "disabled" : "active"}`)}${u.status === "active" ? action(t(u.role === "admin" ? "makeUser" : "makeAdmin"), "admin-user", `${u.id}|role|${u.role === "admin" ? "user" : "admin"}`) + action(t("resetLink"), "admin-reset", u.username) : ""}</div></div>`).join("")}</div></section><aside class="paper"><h2>${esc(t("inviteLinks"))}</h2>${action(t("createInvite"), "admin-invite", "", "")}<div id="created-link"></div><div class="divider">✦</div>${invitations.length ? invitations.map((i) => `<div class="list-row"><span class="grow">${esc(t("expires"))}: ${esc(new Date(i.expires_at).toLocaleDateString(state.language))}</span>${action(t("revoke"), "admin-invite-remove", i.token_hash)}</div>`).join("") : `<p class="muted">${esc(t("noInvitations"))}</p>`}</aside></div>`;
}
async function readImage(file) {
  if (
    !file ||
    file.size > 4 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error("INVALID_IMAGE");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("INVALID_IMAGE"));
    reader.readAsDataURL(file);
  });
}
function showLink(path) {
  const node = document.querySelector("#created-link");
  if (node)
    node.innerHTML = `<label>${esc(t("createdLink"))}<input readonly value="${attr(location.origin + path)}"></label>`;
  else window.prompt(t("createdLink"), location.origin + path);
}
async function refreshSheet() {
  const entity = await api(
    `/api/entities/${state.sheet.id}${state.sheetCampaign ? `?campaign=${encodeURIComponent(state.sheetCampaign)}` : ""}`,
  );
  mergeSheet(entity);
  if (entity.isOwner)
    state.availableCampaigns = (await api("/api/campaigns")).campaigns;
  renderSheet();
}
async function refreshSession() {
  const current = await api("/api/me");
  state.user = current.user;
  state.csrf = current.csrf;
  if (state.user) {
    state.language = state.user.language;
    state.locale = await api("/api/locale");
  }
}
document.addEventListener("submit", async (event) => {
  const form = event.target;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  try {
    if (form.classList.contains("campaign-resource")) {
      await api(`/api/campaigns/${state.campaign.campaign.id}/resources`, "POST", { ...data, entityId: battleUI.selectedBattleTarget, action: form.dataset.operation, piercing: Boolean(form.elements.piercing?.checked) });
      await refreshBattle();
    } else if (form.id === "battle-add") {
      await api(`/api/campaigns/${state.campaign.campaign.id}/battle`, "POST", { ...data, action: "add" });
      await refreshBattle();
    } else if (form.id === "auth-form") {
      const mode = form.dataset.mode,
        params = new URLSearchParams(location.search);
      if (mode === "login") {
        const result = await api("/api/login", "POST", data);
        clearPersonalRolls();
        state.user = result.user;
        state.csrf = result.csrf;
        state.language = result.user.language;
        state.locale = await api("/api/locale");
        history.replaceState(null, "", location.pathname + "#/home");
        await renderRoute();
      } else if (mode === "register") {
        data.invite = params.get("invite") || undefined;
        const result = await api("/api/register", "POST", data);
        history.replaceState(null, "", location.pathname);
        authScreen(
          "login",
          t(result.status === "active" ? "accountActive" : "accountPending"),
        );
      } else {
        await api("/api/reset", "POST", {
          token: params.get("reset"),
          password: data.password,
        });
        history.replaceState(null, "", location.pathname);
        authScreen("login", t("resetDone"));
      }
    } else if (form.id === "create-campaign") {
      const result = await api("/api/campaigns", "POST", data);
      location.hash = `#/campaign/${result.id}/overview`;
    } else if (form.id === "campaign-invite-form") {
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/invite`,
        "POST",
        data,
      );
      form.reset();
      notify(t("requestSent"));
    } else if (form.id === "campaign-settings") {
      await api(`/api/campaigns/${state.campaign.campaign.id}`, "POST", data);
      notify(t("saved"));
      await renderRoute();
    } else if (form.id === "campaign-transfer") {
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/transfer`,
        "POST",
        data,
      );
      notify(t("saved"));
      await renderRoute();
    } else if (form.id === "campaign-delete") {
      await api(`/api/campaigns/${state.campaign.campaign.id}`, "DELETE", data);
      location.hash = "#/campaigns";
    } else if (form.id === "campaign-cover-form") {
      const image = await readImage(form.elements.image.files[0]);
      await api(`/api/campaigns/${state.campaign.campaign.id}/cover`, "POST", {
        image,
      });
      notify(t("saved"));
      await renderRoute();
    } else if (form.id === "chat-form") {
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/chat`,
        "POST",
        data,
      );
      form.reset();
    } else if (form.id === "dice-appearance") {
      const user = state.user;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const { appearance } = await api("/api/dice/appearance", "POST", chosenAppearance(form));
        if (state.user === user) {
          user.diceAppearance = appearance;
          notify(t("saved"));
        }
      } finally {
        button.disabled = false;
      }
    } else if (form.id === "dice-form") {
      const request = ++personalRequest;
      const session = personalSession;
      const user = state.user;
      const time = Date.now();
      const campaignId =
        parseRoute().parts[0] === "campaign"
          ? state.campaign.campaign.id
          : null;
      const result = await api("/api/dice", "POST", {
        expression: data.expression,
        campaignId,
        private: Boolean(form.elements.private?.checked),
      });
      const target = document.querySelector("#dice-result");
      if (!campaignId && session === personalSession && state.user?.id === user.id) {
        const item = { type: "roll", result: result.result, time, identity: { username: user.username } };
        const record = animatedDice(item.result)
          ? window.RandomDicePlayback.create(item.result, Boolean(target))
          : null;
        personalRolls.push({ request, item, record });
        personalRolls.sort((a, b) => a.request - b.request);
        renderPersonalRolls();
      }
    } else if (form.id === "permission-form") {
      if (state.editing) await flushSheet();
      await api(`/api/entities/${state.sheet.id}/permissions`, "POST", data);
      notify(t("saved"));
      await refreshSheet();
    } else if (form.id === "assignment-form") {
      if (state.editing) await flushSheet();
      const reference = (data.campaignReference || "").trim();
      if (reference)
        data.campaignId =
          reference.match(/#\/campaign\/([a-f0-9-]{36})/i)?.[1] || reference;
      delete data.campaignReference;
      await api(`/api/entities/${state.sheet.id}/assignments`, "POST", data);
      notify(t("requestSent"));
      await refreshSheet();
    } else if (form.id === "entity-transfer") {
      if (state.editing) {
        if (state.preview) throw new Error("UNDO_PREVIEW_ACTIVE");
        await flushSheet();
        await api(`/api/entities/${state.sheet.id}/lock`, "POST", {
          action: "finish",
          tab: state.tab,
        });
        state.editing = false;
      }
      const entityId = state.sheet.id;
      await api(`/api/entities/${entityId}/transfer`, "POST", data);
      notify(t("saved"));
      location.hash = `#/${state.sheet.type === "character" ? "characters" : "creatures"}`;
    } else if (form.id === "entity-delete") {
      const type = state.sheet.type;
      await api(`/api/entities/${state.sheet.id}`, "DELETE", {
        ...data,
        tab: state.tab,
      });
      state.editing = false;
      state.sheet = null;
      notify(t("entityDeleted"));
      location.hash = `#/${type === "character" ? "characters" : "creatures"}`;
    } else if (form.id === "entity-portrait-form") {
      await flushSheet();
      const image = await readImage(form.elements.image.files[0]);
      const result = await api(
        `/api/entities/${state.sheet.id}/portrait`,
        "POST",
        { image, tab: state.tab, version: state.sheet.version },
      );
      mergeSheet(result.entity);
      renderSheet();
    }
  } catch (error) {
    if (error.message === "LOCK_REQUIRED") loseLock();
    notify(errorMessage(error), true);
  }
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const what = button.dataset.action,
    value = button.dataset.value || "";
  try {
    if (what === "select-combatant") {
      battleUI.selectedBattleToken = value;
      battleUI.selectedBattleTarget = battleUI.currentBattleSession?.battle?.groups.flatMap(group => group.entries).find(entry => entry.token === value)?.entityId || "";
      await refreshBattle();
    } else if (what === "battle-action") {
      let [actionName, token] = value.split("|");
      const direction = actionName === "up" ? -1 : actionName === "down" ? 1 : undefined;
      if (direction) actionName = "move";
      await api(`/api/campaigns/${state.campaign.campaign.id}/battle`, "POST", { action: actionName, token, direction });
      await refreshBattle();
    } else if (what === "auth-mode") authScreen(value);
    else if (what === "logout") {
      if (state.editing && !state.preview) await flushSheet();
      await api("/api/logout", "POST");
      state.stream?.close();
      state.stream = null;
      state.streamCampaign = undefined;
      state.user = null;
      state.csrf = null;
      campaignRolls.clear();
      recentChat.clear();
      clearPersonalRolls();
      state.editing = false;
      state.sheet = null;
      history.replaceState(null, "", location.pathname);
      authScreen();
    } else if (what === "show-new-campaign")
      document.querySelector("#new-campaign").hidden = false;
    else if (what === "campaign-invite") {
      const [campaign, decision] = value.split("|");
      await api(`/api/campaign-invitations/${campaign}`, "POST", {
        action: decision,
      });
      await campaignList();
    } else if (what === "member-role") {
      const [person, decision] = value.split("|");
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/members/${person}`,
        "POST",
        { action: decision },
      );
      if (person === state.user.id && decision === "remove")
        location.hash = "#/campaigns";
      else await renderRoute();
    } else if (what === "assignment-action") {
      const [entityId, decision] = value.split("|");
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/assignments/${entityId}`,
        "POST",
        { action: decision },
      );
      await renderRoute();
    } else if (what === "campaign-cover-remove") {
      await api(`/api/campaigns/${state.campaign.campaign.id}/cover`, "POST", {
        image: null,
      });
      await renderRoute();
    } else if (what === "new-entity") {
      const result = await api("/api/entities", "POST", { type: value });
      location.hash = `#/sheet/${result.id}`;
    } else if (what === "lock-start") {
      await api(`/api/entities/${state.sheet.id}/lock`, "POST", {
        action: "start",
        tab: state.tab,
      });
      state.editing = true;
      state.preview = false;
      await refreshSheet();
    } else if (what === "lock-finish") {
      if (state.preview) throw new Error("UNDO_PREVIEW_ACTIVE");
      await flushSheet();
      await api(`/api/entities/${state.sheet.id}/lock`, "POST", {
        action: "finish",
        tab: state.tab,
      });
      state.editing = false;
      state.preview = false;
      await refreshSheet();
    } else if (what === "undo") {
      if (!state.preview) await flushSheet();
      const result = await api(`/api/entities/${state.sheet.id}/undo`, "POST", {
        action: value,
        tab: state.tab,
      });
      mergeSheet(result.entity);
      state.preview = result.preview;
      renderSheet();
    } else if (what === "entity-portrait-remove") {
      await flushSheet();
      const result = await api(
        `/api/entities/${state.sheet.id}/portrait`,
        "POST",
        { image: null, tab: state.tab, version: state.sheet.version },
      );
      mergeSheet(result.entity);
      renderSheet();
    } else if (what === "revoke-permission") {
      if (state.editing) await flushSheet();
      await api(`/api/entities/${state.sheet.id}/permissions`, "POST", {
        username: value,
        permission: null,
      });
      await refreshSheet();
    } else if (
      what === "entity-assignment-remove" ||
      what === "entity-assignment-visibility"
    ) {
      if (state.editing) await flushSheet();
      const [campaign, visibility] = value.split("|");
      await api(
        `/api/campaigns/${campaign}/assignments/${state.sheet.id}`,
        "POST",
        what.endsWith("remove")
          ? { action: "remove" }
          : { action: "visibility", visibility },
      );
      await refreshSheet();
    } else if (what.startsWith("gen-")) {
      await generatorAction(what, value, button);
    } else if (what === "rulebook-language") {
      state.rulebookLanguage = value;
      rulebookScreen();
    } else if (what === "admin-user") {
      const [userId, key, next] = value.split("|");
      await api(`/api/admin/users/${userId}`, "POST", { [key]: next });
      await adminScreen();
    } else if (what === "admin-invite") {
      const result = await api("/api/admin/invitations", "POST");
      await adminScreen();
      showLink(result.path);
    } else if (what === "admin-invite-remove") {
      await api(`/api/admin/invitations/${value}`, "DELETE");
      await adminScreen();
    } else if (what === "admin-reset") {
      const result = await api("/api/admin/reset", "POST", { username: value });
      showLink(result.path);
    }
  } catch (error) {
    if (error.message === "LOCK_REQUIRED") loseLock();
    notify(errorMessage(error), true);
  }
});
document.addEventListener("change", async (event) => {
  if (event.target.id === "battle-target") {
    battleUI.selectedBattleTarget = event.target.value;
    battleUI.selectedBattleToken = battleUI.currentBattleSession?.battle?.groups.flatMap(group => group.entries).find(entry => entry.entityId === battleUI.selectedBattleTarget)?.token || "";
    try { await refreshBattle(); } catch (error) { notify(errorMessage(error), true); }
    return;
  }
  const target = event.target;
  try {
    if (target.matches("select[data-field]") && state.editing && !state.preview) {
      await saveSection(target.closest("[data-section]"));
    } else if (target.form?.id === "dice-appearance") {
      updateGlow(target.form, target);
    } else if (target.name === "siteLanguage") {
      if (state.editing && !state.preview) await flushSheet();
      state.language = target.value;
      localStorage.setItem("random-language", state.language);
      if (state.user) {
        await api("/api/language", "POST", { language: state.language });
        state.locale = await api("/api/locale");
        await renderRoute();
      } else authScreen();
    } else if (target.name === "generationLanguage") {
      const gen = state.generation;
      gen.language = target.value;
      gen.trail = [];
      await generatorScreen();
    } else if (target.id === "generation-level") state.generation.level = target.value;
    else if (target.dataset.playing) {
      await api(
        `/api/campaigns/${state.campaign.campaign.id}/playing/${target.dataset.playing}`,
        "POST",
        { entityId: target.value || null },
      );
      await renderRoute();
    }
  } catch (error) {
    if (target.dataset.playing)
      target.value =
        state.campaign?.members.find(
          (member) => member.id === target.dataset.playing,
        )?.playing?.id || "";
    notify(errorMessage(error), true);
  }
});
document.addEventListener("input", (event) => {
  const target = event.target;
  const adjust = target.closest("[data-resource-adjust]");
  if (adjust) {
    const number = adjust.querySelector("[data-adjust-number]");
    const range = adjust.querySelector("[data-adjust-slider]");
    if (target === range) number.value = range.value;
    else if (target === number && number.value !== "" && Number.isFinite(number.valueAsNumber)) {
      const limit = number.hasAttribute("max") ? Number(number.max) : Math.max(1, Number(range.dataset.baseMax), number.valueAsNumber);
      range.max = String(limit);
      range.value = number.value;
    }
  }
  if (target.form?.id === "dice-appearance" && (target.name === "hex" || target.name === "glow"))
    updateGlow(target.form, target, true);
  const section = event.target.closest("[data-section]");
  if (section && state.editing && !state.preview) markSectionDirty(section);
});
function selectResourceAction(panel, mode, pool) {
  battleUI.resourceMode = mode;
  battleUI.resourceKey = pool || battleUI.resourceKey;
  for (const button of panel.querySelectorAll("[data-resource-mode]"))
    button.setAttribute("aria-pressed", String(button.dataset.resourceMode === mode));
  for (const form of panel.querySelectorAll(".campaign-resource")) {
    form.hidden = form.dataset.operation !== mode || (mode === "set" && form.dataset.pool !== battleUI.resourceKey);
    if (!form.hidden && mode === "set") form.elements.resourceKey.value = battleUI.resourceKey;
  }
}
document.addEventListener("click", event => {
  const button = event.target.closest("[data-resource-mode],[data-edit-pool]");
  if (button) selectResourceAction(button.closest(".resource-console"), button.dataset.resourceMode || "set", button.dataset.editPool);
});
document.addEventListener("change", event => {
  if (event.target.matches(".resource-console select[name=resourceKey]")) {
    const panel = event.target.closest(".resource-console");
    selectResourceAction(panel, "set", event.target.value);
    panel.querySelector("form:not([hidden]) select").focus();
  }
});
document.addEventListener("focusout", (event) => {
  const section = event.target.closest("[data-section]");
  if (section && state.editing && !state.preview && !section.contains(event.relatedTarget))
    queueMicrotask(() => {
      if (!section.contains(document.activeElement)) saveSection(section).catch(() => {});
    });
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-step],[data-entry-action],[data-sheet-save]");
  if (!button || !state.editing || state.preview) return;
  const section = button.closest("[data-section]");
  if (button.hasAttribute("data-sheet-save")) {
    saveSection(section).catch(() => {
      const invalid = sheetEditor.check(section);
      invalid?.focus();
      invalid?.reportValidity();
    });
    return;
  }
  if (button.hasAttribute("data-entry-action")) sheetEditor.changeEntries(button);
  else if (!sheetEditor.adjust(button)) return;
  markSectionDirty(section);
});
let lastActivity = 0;
function editingActivity() {
  if (!state.editing || !state.sheet || Date.now() - lastActivity < 30000)
    return;
  lastActivity = Date.now();
  api(`/api/entities/${state.sheet.id}/lock`, "POST", {
    action: "activity",
    tab: state.tab,
  }).catch(loseLock);
}
document.addEventListener("keydown", editingActivity);
document.addEventListener("pointerdown", editingActivity);
window.addEventListener("hashchange", () => renderRoute());
window.addEventListener("pagehide", () => {
  state.editing = false;
});
refreshSession()
  .then(() => (state.user ? renderRoute() : authScreen()))
  .catch((error) => {
    notify(errorMessage(error), true);
    authScreen();
  });
