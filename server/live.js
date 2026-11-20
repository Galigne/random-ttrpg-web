const access = require("./access");
const { randomUUID } = require("node:crypto");

function createLive(db, { now = () => Date.now(), retention = 300000 } = {}) {
  const clients = new Set();
  const locks = new Map();
  const lockEndListeners = new Set();
  const messages = new Map();
  const emptySince = new Map();
  const expirationTimers = new Map();
  function currentUser(client) {
    return db
      .prepare(
        "SELECT u.id,u.username,u.role,u.language FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'",
      )
      .get(client.session, now());
  }
  function hasMember(campaignId) {
    return [...clients].some(
      (c) =>
        c.campaignId === campaignId &&
        currentUser(c) &&
        access.membership(db, campaignId, c.user.id),
    );
  }
  function sweep() {
    for (const [id, lock] of locks)
      if (now() - lock.lastActivity >= 300000) {
        endLock(id, lock);
      }
    for (const [campaignId, since] of emptySince)
      if (!hasMember(campaignId) && now() - since >= retention) {
        messages.delete(campaignId);
        emptySince.delete(campaignId);
        clearTimeout(expirationTimers.get(campaignId));
        expirationTimers.delete(campaignId);
      }
  }
  function endLock(entityId, lock) {
    if (locks.get(entityId) !== lock) return;
    locks.delete(entityId);
    clearTimeout(lock.timer);
    for (const listener of lockEndListeners) listener(entityId, lock);
    entityChanged(entityId);
  }
  function scheduleLockExpiration(entityId, lock) {
    clearTimeout(lock.timer);
    const remaining = Math.max(1, 300000 - (now() - lock.lastActivity));
    lock.timer = setTimeout(() => {
      if (locks.get(entityId) !== lock) return;
      if (now() - lock.lastActivity >= 300000) {
        endLock(entityId, lock);
      } else scheduleLockExpiration(entityId, lock);
    }, remaining);
    lock.timer.unref();
  }
  function markEmpty(campaignId) {
    if (emptySince.has(campaignId)) return;
    emptySince.set(campaignId, now());
    const timer = setTimeout(() => {
      expirationTimers.delete(campaignId);
      sweep();
    }, retention);
    timer.unref();
    expirationTimers.set(campaignId, timer);
  }
  function send(client, type, value) {
    if (client.res.writableEnded) return;
    client.res.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`);
  }
  function authorized(user, event) {
    if (
      event.privateRoll &&
      event.rollerId !== user.id &&
      access.membership(db, event.campaignId, user.id)?.role !== "gm"
    )
      return false;
    return (event.entityIds || []).every((entityId) =>
      access.canViewInCampaign(
        db,
        user,
        access.entityMetadata(db, entityId),
        event.campaignId,
      ),
    );
  }
  function append(campaignId, event) {
    sweep();
    const item = { ...event, id: randomUUID(), campaignId, time: now() };
    const list = messages.get(campaignId) ?? [];
    list.push(item);
    messages.set(campaignId, list);
    if (!hasMember(campaignId)) markEmpty(campaignId);
    for (const client of clients) {
      const user = currentUser(client);
      if (
        user &&
        client.campaignId === campaignId &&
        (access.isAdmin(user) || access.membership(db, campaignId, user.id)) &&
        authorized(user, item)
      )
        send(client, "chat", item);
    }
  }
  function history(campaignId, user) {
    sweep();
    return (messages.get(campaignId) ?? []).filter((item) =>
      authorized(user, item),
    );
  }
  function presence(campaignId) {
    const members = db
      .prepare("SELECT user_id FROM members WHERE campaign_id=?")
      .all(campaignId);
    return Object.fromEntries(
      members.map(({ user_id: userId }) => [
        userId,
        [...clients].some(
          (c) =>
            c.user.id === userId &&
            c.campaignId === campaignId &&
            currentUser(c),
        )
          ? "here"
          : [...clients].some((c) => c.user.id === userId && currentUser(c))
            ? "online"
            : "offline",
      ]),
    );
  }
  function presenceChanged() {
    const campaignIds = new Set(
      [...clients].map((c) => c.campaignId).filter(Boolean),
    );
    for (const campaignId of campaignIds) {
      const state = presence(campaignId);
      for (const client of clients) {
        const user = currentUser(client);
        if (
          user &&
          client.campaignId === campaignId &&
          access.canOpenCampaign(db, user, campaignId)
        )
          send(client, "presence", state);
      }
    }
  }
  function add(client) {
    sweep();
    clients.add(client);
    if (
      client.campaignId &&
      access.membership(db, client.campaignId, client.user.id)
    ) {
      emptySince.delete(client.campaignId);
      clearTimeout(expirationTimers.get(client.campaignId));
      expirationTimers.delete(client.campaignId);
    }
    send(client, "ready", {});
    presenceChanged();
  }
  function remove(client) {
    if (!clients.delete(client)) return;
    for (const [entityId, lock] of locks)
      if (lock.session === client.session && lock.tab === client.tab) {
        endLock(entityId, lock);
      }
    if (client.campaignId && !hasMember(client.campaignId))
      markEmpty(client.campaignId);
    presenceChanged();
  }
  function getLock(entityId) {
    sweep();
    return locks.get(entityId) || null;
  }
  function hasTab(session, tab) {
    return [...clients].some(c => c.session === session && c.tab === tab && currentUser(c));
  }
  function acquire(entityId, user, session, tab) {
    if (!hasTab(session, tab)) return false;
    const held = getLock(entityId);
    if (held && (held.session !== session || held.tab !== tab)) return false;
    const lock = held || {
      userId: user.id,
      username: user.username,
      session,
      tab,
      lastActivity: now(),
    };
    lock.lastActivity = now();
    locks.set(entityId, lock);
    scheduleLockExpiration(entityId, lock);
    entityChanged(entityId);
    return true;
  }
  function requireLock(entityId, user, session, tab, touch = true) {
    const lock = getLock(entityId);
    if (
      !lock ||
      lock.userId !== user.id ||
      lock.session !== session ||
      lock.tab !== tab
    )
      return false;
    if (touch) {
      lock.lastActivity = now();
      scheduleLockExpiration(entityId, lock);
    }
    return true;
  }
  function release(entityId, user, session, tab) {
    if (!requireLock(entityId, user, session, tab, false)) return false;
    endLock(entityId, locks.get(entityId));
    return true;
  }
  function entityChanged(entityId) {
    const row = access.entityMetadata(db, entityId);
    for (const client of clients) {
      const user = currentUser(client);
      if (
        user &&
        (client.campaignId
          ? access.canViewInCampaign(db, user, row, client.campaignId)
          : access.canView(db, user, row))
      )
        send(client, "entity", { id: entityId });
    }
  }
  function campaignChanged(campaignId) {
    for (const client of clients) {
      const user = currentUser(client);
      if (
        user &&
        client.campaignId === campaignId &&
        access.canOpenCampaign(db, user, campaignId)
      )
        send(client, "campaign", {});
    }
  }
  function playingChanged(entityId) {
    for (const row of db
      .prepare(
        "SELECT DISTINCT campaign_id FROM playing_characters WHERE entity_id=?",
      )
      .all(entityId)) {
      const entity = access.entityMetadata(db, entityId);
      for (const client of clients) {
        const user = currentUser(client);
        if (
          user &&
          client.campaignId === row.campaign_id &&
          (access.isAdmin(user) ||
            access.membership(db, row.campaign_id, user.id) ||
            access.canViewInCampaign(db, user, entity, row.campaign_id))
        )
          send(client, "campaign", {});
      }
    }
  }
  function membershipChanged(campaignId) {
    if (!hasMember(campaignId)) markEmpty(campaignId);
    else {
      emptySince.delete(campaignId);
      clearTimeout(expirationTimers.get(campaignId));
      expirationTimers.delete(campaignId);
    }
    presenceChanged();
  }
  function userChanged(userId) {
    for (const c of clients) if (c.user.id === userId) send(c, "refresh", {});
  }
  function discardCampaign(campaignId) {
    messages.delete(campaignId);
    emptySince.delete(campaignId);
    clearTimeout(expirationTimers.get(campaignId));
    expirationTimers.delete(campaignId);
  }
  function disconnectSession(session) {
    for (const c of clients) if (c.session === session) c.res.end();
  }
  function shutdown() {
    for (const client of [...clients]) {
      remove(client);
      client.res.end();
    }
    for (const timer of expirationTimers.values()) clearTimeout(timer);
    expirationTimers.clear();
    for (const [entityId, lock] of locks) endLock(entityId, lock);
    lockEndListeners.clear();
  }
  return {
    add,
    remove,
    append,
    history,
    presence,
    getLock,
    hasTab,
    acquire,
    requireLock,
    release,
    entityChanged,
    campaignChanged,
    playingChanged,
    membershipChanged,
    onLockEnd: (listener) => lockEndListeners.add(listener),
    userChanged,
    discardCampaign,
    disconnectSession,
    shutdown,
    sweep,
  };
}
module.exports = { createLive };
