// Campaign presentation and battle controls receive shared services explicitly.
export function createCampaignScreen({ state, app, api, t, esc, attr, fieldLabel, action,
  header, input, langSelect, tag, resourcePills, imageFor, entityCard, chatMessage,
  mountChatRolls, animatedDice, campaignRolls, recentChat, battleUI, captureRoute, parseRoute }) {
function memberList(data, interactive = false) {
  const c = data.campaign;
  const chars = data.gm
    ? data.entities.filter((e) => e.type === "character")
    : data.controlledCharacters || [];
  return `<div class="list">${data.members
    .map((m) => {
      const p = m.playing;
      const name = p ? `${p.name} (${m.username})` : m.username;
      const status = data.presence[m.id] || "offline";
      const select =
        data.gm || m.id === state.user.id
          ? `<label>${esc(t("playing"))}<select data-playing="${attr(m.id)}"><option value="">${esc(t("noCharacter"))}</option>${chars
              .filter((e) => data.gm || e.canEdit)
              .map(
                (e) =>
                  `<option value="${attr(e.id)}" ${p?.id === e.id ? "selected" : ""}>${esc(e.name)}</option>`,
              )
              .join(
                "",
              )}</select>${data.gm ? "" : `<small>${esc(t("playingChoiceHint"))}</small>`}</label>`
          : "";
      const roleButtons = interactive
        ? `${data.manage ? action(m.role === "gm" ? t("demote") : t("promote"), "member-role", `${m.id}|${m.role === "gm" ? "demote" : "promote"}`) : ""}${data.manage || (data.gm && m.role !== "gm") || m.id === state.user.id ? action(m.id === state.user.id ? t("leave") : t("remove"), "member-role", `${m.id}|remove`) : ""}`
        : "";
      return `<div class="list-row"><span class="presence ${attr(status)}" data-presence-user="${attr(m.id)}" title="${attr(t(status))}"></span><div class="grow"><details class="member-preview"><summary><strong>${esc(name)}</strong> ${tag(m.role === "gm" ? t("gm") : t("member"))} ${c.ownerId === m.id ? tag(t("owner")) : ""}</summary>${p ? `<div class="row" style="align-items:start;margin-top:.7rem"><img class="portrait fit" src="${attr(imageFor("character", p.id, p.portrait, `?previewCampaign=${encodeURIComponent(c.id)}`))}" alt=""><div><p><strong>${esc(p.name)}</strong> (${esc(m.username)}) · ${esc(t("level"))} ${esc(p.level)}</p>${resourcePills(p.resources)}</div></div>` : `<p class="muted">${esc(t("noCharacter"))}</p>`}</details>${interactive ? select : ""}</div>${roleButtons ? `<div class="actions">${roleButtons}</div>` : ""}</div>`;
    })
    .join("")}</div>`;
}
function campaignTabs(id, selected) {
  const tabs = ["overview", "members", "characters", "creatures", "settings"];
  return `<nav class="tabs">${tabs.map((x) => `<a ${x === selected ? 'class="active" aria-current="page"' : ""} href="#/campaign/${attr(id)}/${x}">${esc(t(x))}</a>`).join("")}</nav>`;
}
function battlePanel(data, session) {
  battleUI.currentBattleSession = session;
  const { battle, targets } = session;
  if (!targets.some(target => target.id === battleUI.selectedBattleTarget)) battleUI.selectedBattleTarget = "";
  if (!battleUI.selectedBattleTarget && targets.length === 1) battleUI.selectedBattleTarget = targets[0].id;
  const selected = targets.find(target => target.id === battleUI.selectedBattleTarget);
  const options = targets.map(target => `<option value="${attr(target.id)}">${esc(target.name)}</option>`).join("");
  const shortResource = key => fieldLabel(`character.resources.${key}.abbreviation`);
  const slider = (label, name, value, maximum, step = "1", cap = false) => `<div class="resource-adjust" data-resource-adjust><label>${esc(label)}<input type="number" name="${attr(name)}" value="${attr(value)}" min="${name === "amount" ? 1 : 0}" step="${attr(step)}" ${cap ? `max="${attr(maximum)}"` : ""} data-adjust-number required></label><input type="range" aria-label="${attr(`${t("adjust")} ${label}`)}" min="${name === "amount" ? 1 : 0}" max="${attr(Math.max(1, maximum, value))}" step="${attr(step)}" value="${attr(value)}" data-base-max="${attr(maximum)}" data-adjust-slider></div>`;
  const amountMax = Math.max(1, selected ? selected.resources.hp.current + selected.resources.ar.current : 1, selected?.resources.hp.max || 0, selected?.resources.ar.max || 0);
  const modes = ["damage", "heal", "restore", "set"];
  const keys = ["hp", "ar", "ap", "md"];
  const modeLabel = mode => t(mode === "set" ? "setResource" : mode);
  function operationForm(mode) {
    const choice = ["heal", "restore"].includes(mode) ? `<div class="resource-choices">${["hp", "armor", "both"].map((value, i) =>
      `<label><input type="radio" name="resource" value="${value}" ${i === 0 ? "checked" : ""}><span>${esc(value === "both" ? shortResource("hp") + " + " + shortResource("ar") : shortResource(i ? "ar" : "hp"))}</span></label>`).join("")}</div>` : "";
    const adjust = mode === "restore" ? slider(t("percentage"), "percentage", 100, 100, "any", true)
      : slider(t("amount"), "amount", 1, amountMax);
    return `<form class="campaign-resource" data-operation="${mode}" ${mode !== battleUI.resourceMode ? "hidden" : ""}>
      ${choice}${adjust}${mode === "damage" ? `<label><input type="checkbox" name="piercing"> ${esc(t("piercing"))}</label>` : ""}
      <button>${esc(modeLabel(mode))}</button></form>`;
  }
  const controls = selected ? `<div class="battle-target resource-console"><h3>${esc(selected.name)}</h3>
    <div class="resource-meters">${keys.map(key => {
      const r = selected.resources[key];
      return `<button type="button" data-edit-pool="${key}" aria-label="${attr(t("adjust") + " " + shortResource(key))}"><strong>${esc(shortResource(key))}</strong> <span>${esc(r.current)} / ${esc(r.max)}</span><progress max="${Math.max(r.max, 1)}" value="${r.current}"></progress></button>`;
    }).join("")}</div>
    <div class="resource-modes">${modes.map(mode => `<button type="button" data-resource-mode="${mode}" aria-pressed="${mode === battleUI.resourceMode}">${esc(modeLabel(mode))}</button>`).join("")}</div>
    ${modes.slice(0, 3).map(operationForm).join("")}
    ${keys.map(key => {
      const r = selected.resources[key];
      return `<form class="campaign-resource" data-operation="set" data-pool="${key}" ${battleUI.resourceMode !== "set" || battleUI.resourceKey !== key ? "hidden" : ""}>
        <label>${esc(t("resourceControls"))}<select name="resourceKey">${keys.map(k => `<option value="${k}" ${key === k ? "selected" : ""}>${esc(shortResource(k))}</option>`).join("")}</select></label>
        ${slider(shortResource(key) + " · " + t("maximum") + " " + r.max, "value", r.current, r.max, key === "ap" ? "1" : "any")}
        <button>${esc(t("save"))}</button></form>`;
    }).join("")}</div>` : "";
  const tracker = battle ? `<div class="battle-heading"><h3>${esc(t("round"))} ${esc(battle.round)}</h3>${data.gm ? action(t("advanceTurn"), "battle-action", "advance") + action(t("endBattle"), "battle-action", "end") : ""}</div><div class="initiative">${battle.groups.map(group => `<div class="initiative-group${group.active ? " is-active" : ""}">${group.entries.map(entry => `<div class="initiative-entry"><span>${entry.control ? action(entry.name || t("unknownCombatant"), "select-combatant", entry.token) : esc(entry.name || t("unknownCombatant"))} ${group.active ? tag(t("activeTurn")) : ""} ${entry.finished ? tag(t("finishedTurn")) : ""}</span>${battleUI.selectedBattleToken === entry.token ? `<div class="actions">${entry.control && group.active && !entry.finished ? action(t("endTurn"), "battle-action", `finish|${entry.token}`) + action(t("delayTurn"), "battle-action", `delay|${entry.token}`) : ""}${data.gm ? action(t("moveUp"), "battle-action", `up|${entry.token}`) + action(t("moveDown"), "battle-action", `down|${entry.token}`) + action(t("correctTurn"), "battle-action", `correct|${entry.token}`) + action(t("remove"), "battle-action", `remove|${entry.token}`) : ""}</div>` : ""}</div>`).join("")}</div>`).join("")}</div>${data.gm && targets.length ? `<form id="battle-add" class="row"><label>${esc(t("addCombatant"))}<select name="entityId">${options}</select></label><button>${esc(t("addCombatant"))}</button></form>` : ""}` : data.gm ? action(t("startBattle"), "battle-action", "start", "") : "";
  return `<section class="paper battle-panel"><h2>${esc(t("battle"))}</h2>${tracker}<h3>${esc(t("resourceControls"))}</h3>${targets.length ? `<label>${esc(t("selectTarget"))}<select id="battle-target"><option value="">${esc(t("selectTarget"))}</option>${targets.map(target => `<option value="${attr(target.id)}" ${battleUI.selectedBattleTarget === target.id ? "selected" : ""}>${esc(target.name)}</option>`).join("")}</select></label>` : `<p class="muted">${esc(t("noTargets"))}</p>`}${controls}</section>`;
}
let battleRefreshSequence = 0;
let campaignRenderSequence = 0;
async function refreshBattle() {
  const sequence = ++battleRefreshSequence;
  const current = captureRoute();
  const campaignId = state.campaign?.campaign.id;
  const panel = app.querySelector(".battle-panel");
  if (!panel || !campaignId || parseRoute().parts[0] !== "campaign") return;
  const session = await api(`/api/campaigns/${encodeURIComponent(campaignId)}/battle`);
  if (!current() || sequence !== battleRefreshSequence || !panel.isConnected || state.campaign?.campaign.id !== campaignId) return;
  panel.outerHTML = battlePanel(state.campaign, session);
}
async function campaignScreen(campaignId, tabName) {
  const sequence = ++campaignRenderSequence;
  const routeCurrent = captureRoute();
  const current = () => routeCurrent() && sequence === campaignRenderSequence;
  const previousCampaignId = state.campaign?.campaign.id;
  const requestStarted = performance.now();
  const data = await api(`/api/campaigns/${encodeURIComponent(campaignId)}`);
  if (!current()) return;
  const earliestNewMessage = data.chatSnapshotTime - (performance.now() - requestStarted);
  const known = new Set(data.chat.map(item => item.id));
  for (const { item, received } of recentChat.values()) {
    if (item.campaignId === campaignId && received >= requestStarted && !known.has(item.id) &&
        (item.type === "text" || item.type === "roll") &&
        (!item.privateRoll || item.rollerId === state.user.id || data.gm))
      data.chat.push(item);
  }
  for (const item of data.chat) {
    if (item.id && item.type === "roll" && animatedDice(item.result) &&
        item.time >= earliestNewMessage && !campaignRolls.has(item.id))
      campaignRolls.set(item.id, window.RandomDicePlayback.create(item.result, true));
  }
  if (tabName === "members" && data.membership && !data.gm)
    data.controlledCharacters = (
      await api("/api/entities?type=character")
    ).entities.filter((entity) => entity.canEdit);
  if (!current()) return;
  state.campaign = data;
  const c = data.campaign,
    tabs = campaignTabs(c.id, tabName);
  const top = `${header(c.name, c.description)}${tabs}`;
  if (tabName === "overview") {
    const session = data.membership || state.user.role === "admin" ? await api(`/api/campaigns/${encodeURIComponent(campaignId)}/battle`) : null;
    if (!current()) return;
    const chatDraft = previousCampaignId === campaignId ? app.querySelector("#chat-form input")?.value || "" : "";
    app.innerHTML =
      top +
      `${session ? battlePanel(data, session) : ""}<div class="split"><section class="panel"><h2>${esc(t("chat"))}</h2><div class="chat" id="chat">${data.chat.map(chatMessage).join("")}</div><form id="chat-form" class="row"><label>${esc(t("message"))}<input name="text" maxlength="2000" required autocomplete="off"></label><button class="fit">${esc(t("send"))}</button></form><div class="divider">✦</div><h3>${esc(t("dice"))}</h3><form id="dice-form" class="row"><label>${esc(t("expression"))}<input name="expression" value="1d20" required></label><label class="fit"><input type="checkbox" name="private"> ${esc(t("privateRoll"))}</label><button class="fit">${esc(t("roll"))}</button></form></section><aside class="stack"><section class="panel"><h2>${esc(t("members"))}</h2>${memberList(data)}</section><section class="panel"><h2>${esc(t("characters"))} &amp; ${esc(t("creatures"))}</h2>${data.entities.length ? data.entities.map((e) => `<p><a href="#/sheet/${attr(e.id)}?campaign=${attr(c.id)}">${esc(e.name)}</a></p>`).join("") : `<p class="muted">${esc(t("noEntities"))}</p>`}</section></aside></div>`;
    const chat = document.querySelector("#chat");
    const chatInput = document.querySelector("#chat-form input");
    if (chatInput) chatInput.value = chatDraft;
    if (!data.membership && state.user.role !== "admin") {
      document.querySelector("#chat-form").remove();
      document.querySelector("#dice-form").remove();
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = t("membersOnly");
      chat.replaceChildren(message);
    } else mountChatRolls(chat, data.chat);
    chat.scrollTop = chat.scrollHeight;
  } else if (tabName === "members") {
    app.innerHTML =
      top +
      `<section class="paper"><h2>${esc(t("members"))}</h2>${memberList(data, true)}${data.gm || data.manage ? `<div class="divider">✦</div><form id="campaign-invite-form" class="row"><label>${esc(t("inviteMember"))}<input name="username" required></label><button class="fit">${esc(t("invite"))}</button></form>` : ""}</section>`;
  } else if (tabName === "characters" || tabName === "creatures") {
    const type = tabName === "characters" ? "character" : "creature";
    const entities = data.entities.filter((e) => e.type === type);
    const pending = data.pending.filter((e) => e.type === type);
    app.innerHTML =
      top +
      `${pending.length ? `<section class="paper"><h2>${esc(t("pendingAssignments"))}</h2>${pending.map((e) => `<div class="list-row"><div class="grow"><strong>${esc(e.name)}</strong> · ${esc(e.owner)} ${tag(t(e.visibility))}</div>${action(t("approve"), "assignment-action", `${e.id}|approve`)}${action(t("reject"), "assignment-action", `${e.id}|remove`)}</div>`).join("")}</section><div class="divider">✦</div>` : ""}${entities.length ? `<div class="grid">${entities.map((e) => `<div>${entityCard(e, c.id)}${data.gm ? action(t("remove"), "assignment-action", `${e.id}|remove`) : ""}</div>`).join("")}</div>` : `<div class="empty">${esc(t("noEntities"))}</div>`}`;
  } else {
    const mayEdit = data.gm || data.manage;
    app.innerHTML =
      top +
      `<div class="grid two">${mayEdit ? `<section class="paper"><h2>${esc(t("campaignSettings"))}</h2><form id="campaign-settings">${input(t("name"), "name", c.name, 'required maxlength="120"')}<label>${esc(t("description"))}<textarea name="description" maxlength="4000">${esc(c.description)}</textarea></label><label>${esc(t("language"))}${langSelect("language", c.language)}</label><p><button>${esc(t("save"))}</button></p></form><div class="divider">✦</div><h3>${esc(t("cover"))}</h3><p class="muted">${esc(t("imageHint"))}</p><form id="campaign-cover-form"><input type="file" name="image" accept="image/png,image/jpeg,image/webp" required><p><button>${esc(t("upload"))}</button> ${action(t("removeImage"), "campaign-cover-remove")}</p></form></section>` : ""}${data.manage ? `<section class="paper"><h2>${esc(t("transferOwnership"))}</h2><form id="campaign-transfer">${input(t("username"), "username", "", "required")}<p><button>${esc(t("transfer"))}</button></p></form><div class="divider">✦</div><h3 class="danger">${esc(t("deleteCampaign"))}</h3><p>${esc(t("confirmCampaign"))}</p><form id="campaign-delete">${input(t("name"), "confirm", "", "required")}<p><button>${esc(t("deleteCampaign"))}</button></p></form></section>` : ""}</div>`;
  }
}

return { campaignScreen, refreshBattle };
}
