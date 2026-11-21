// Routing and the live connection share an explicit set of presentation callbacks.
export function createNavigation({ state, app, api, mast, authScreen, flushSheet, homeScreen,
  campaignList, campaignScreen, libraryScreen, renderSheet, entityScreen, activateGenerator,
  generatorScreen, diceScreen, rulebookScreen, adminScreen, notify, errorMessage,
  clearPersonalRolls, campaignRolls, recentChat, animatedDice, chatMessage, mountChatRolls,
  loseLock, refreshBattle, t }) {
function parseRoute() {
  const [path, query = ""] = (
    location.hash.replace(/^#\/?/, "") || "home"
  ).split("?");
  return {
    parts: path.split("/").filter(Boolean),
    query: new URLSearchParams(query),
  };
}
let renderSequence = 0;
async function renderRoute() {
  clearTimeout(refreshTimer);
  const sequence = ++renderSequence;
  const { parts, query } = parseRoute();
  if (!state.user) {
    authScreen();
    return;
  }
  const page = parts[0] || "home",
    newSheet = page === "sheet" ? parts[1] : null;
  const campaignId =
    page === "campaign"
      ? parts[1]
      : page === "sheet"
        ? query.get("campaign")
        : null;
  if (
    state.sheet &&
    state.editing &&
    (newSheet !== state.sheet.id || (campaignId || "") !== state.sheetCampaign)
  ) {
    const previous = state.sheet.id;
    try {
      await flushSheet();
    } catch {
      if (sequence !== renderSequence) return;
      const context = state.sheetCampaign ? `?campaign=${encodeURIComponent(state.sheetCampaign)}` : "";
      history.replaceState(null, "", `#/sheet/${previous}${context}`);
      return;
    }
    if (sequence !== renderSequence) return;
    await api(`/api/entities/${previous}/lock`, "POST", {
      action: "finish",
      tab: state.tab,
    }).catch(() => {});
    if (sequence !== renderSequence) return;
    state.editing = false;
    state.preview = false;
    state.sheet = null;
  }
  if (sequence !== renderSequence) return;
  state.screen =
    page === "campaign"
      ? "campaigns"
      : page === "sheet"
        ? state.sheet?.type === "creature"
          ? "creatures"
          : "characters"
        : page;
  mast();
  connect(campaignId || null);
  try {
    if (page === "home") homeScreen();
    else if (page === "campaigns") await campaignList();
    else if (page === "campaign" && parts[1])
      await campaignScreen(
        parts[1],
        ["overview", "members", "characters", "creatures", "settings"].includes(
          parts[2],
        )
          ? parts[2]
          : "overview",
      );
    else if (page === "characters" || page === "creatures")
      await libraryScreen(page === "characters" ? "character" : "creature");
    else if (page === "sheet" && parts[1]) {
      if (newSheet === state.sheet?.id && state.editing) renderSheet();
      else await entityScreen(parts[1], campaignId || "");
    } else if (page === "generators") {
      const campaign = query.get("campaign") || "";
      const kind = query.get("kind") || state.generation.kind;
      let language = state.language;
      if (campaign && state.generation.campaign !== campaign) {
        language = (await api(`/api/campaigns/${encodeURIComponent(campaign)}`)).campaign.language;
        if (sequence !== renderSequence) return;
      }
      activateGenerator(kind, campaign, language);
      await generatorScreen();
    } else if (page === "dice") diceScreen();
    else if (page === "rulebook") rulebookScreen();
    else if (page === "admin" && state.user.role === "admin")
      await adminScreen();
    else {
      location.hash = "#/home";
      return;
    }
    if (sequence === renderSequence) app.focus({ preventScroll: true });
  } catch (error) {
    if (sequence !== renderSequence) return;
    notify(errorMessage(error), true);
    if (error.message === "LOGIN_REQUIRED") {
      clearPersonalRolls();
      state.user = null;
      authScreen();
    } else if (page === "sheet" || page === "campaign") {
      location.hash = "#/home";
    }
  }
}
let refreshTimer;
function refreshSoon() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (
      document.activeElement?.matches("input,textarea,select") ||
      state.editing
    ) {
      refreshSoon();
      return;
    }
    renderRoute();
  }, 500);
}
function connect(campaignId) {
  if (state.stream && state.streamCampaign === campaignId) return;
  if (state.stream) {
    state.stream.close();
    state.stream = null;
  }
  campaignRolls.clear();
  recentChat.clear();
  state.streamCampaign = campaignId;
  const query = new URLSearchParams({ tab: state.tab });
  if (campaignId) query.set("campaign", campaignId);
  const stream = new EventSource(`/api/events?${query}`);
  state.stream = stream;
  stream.addEventListener("chat", (event) => {
    if (state.stream !== stream) return;
    const item = JSON.parse(event.data);
    if (item.id && recentChat.has(item.id)) return;
    if (item.id) {
      recentChat.set(item.id, { item, received: performance.now() });
      if (recentChat.size > 500) recentChat.delete(recentChat.keys().next().value);
    }
    if (item.id && item.type === "roll" && animatedDice(item.result) && !campaignRolls.has(item.id)) {
      campaignRolls.set(item.id, window.RandomDicePlayback.create(item.result, true));
      if (campaignRolls.size > 500) campaignRolls.delete(campaignRolls.keys().next().value);
    }
    const box = document.querySelector("#chat");
    if (box && parseRoute().parts[1] === campaignId) {
      if (item.id && [...box.children].some(node => node.dataset.chatId === item.id)) return;
      box.insertAdjacentHTML("beforeend", chatMessage(item));
      mountChatRolls(box.lastElementChild, [item]);
      box.scrollTop = box.scrollHeight;
    }
  });
  stream.addEventListener("presence", (event) => {
    if (state.stream !== stream || state.campaign?.campaign.id !== campaignId) return;
    const presence = JSON.parse(event.data);
    state.campaign.presence = presence;
    for (const node of app.querySelectorAll("[data-presence-user]")) {
      const status = presence[node.dataset.presenceUser] || "offline";
      node.className = `presence ${status}`;
      node.title = t(status);
    }
  });
  let battleTimer;
  stream.addEventListener("battle", () => {
    if (state.stream !== stream) return;
    clearTimeout(battleTimer);
    const update = () => {
      if (state.stream !== stream) return;
      const panel = app.querySelector(".battle-panel");
      if (panel?.contains(document.activeElement) && document.activeElement.matches("input,textarea,select")) {
        battleTimer = setTimeout(update, 500);
        return;
      }
      refreshBattle().catch(error => notify(errorMessage(error), true));
    };
    battleTimer = setTimeout(update, 150);
  });
  stream.addEventListener("campaign", async () => {
    if (
      state.sheet &&
      state.sheetCampaign === campaignId &&
      parseRoute().parts[0] === "sheet"
    ) {
      if (state.editing) {
        try {
          await api(
            `/api/entities/${encodeURIComponent(state.sheet.id)}?campaign=${encodeURIComponent(campaignId)}`,
          );
        } catch {
          loseLock();
        }
      } else refreshSoon();
    } else if (state.screen === "campaigns") refreshSoon();
  });
  stream.addEventListener("refresh", () => refreshSoon());
  stream.addEventListener("entity", async (event) => {
    const item = JSON.parse(event.data);
    if (state.sheet?.id === item.id && parseRoute().parts[0] === "sheet") {
      if (state.editing) {
        try {
          const sheet = await api(
            `/api/entities/${encodeURIComponent(item.id)}`,
          );
          if (!sheet.lock || sheet.lock.userId !== state.user.id) loseLock();
        } catch {
          loseLock();
        }
      } else refreshSoon();
    } else if (
      state.screen === "campaigns" ||
      state.screen === "characters" ||
      state.screen === "creatures"
    )
      refreshSoon();
  });
  stream.onerror = () => {
    if (state.stream === stream && state.editing) loseLock();
  };
}
  function captureRoute() {
    const sequence = renderSequence, hash = location.hash;
    return () => sequence === renderSequence && hash === location.hash;
  }
  return { parseRoute, renderRoute, refreshSoon, captureRoute };
}
