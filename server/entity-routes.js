const { transaction } = require("./db");
const { id } = require("./security");
const access = require("./access");
const rpg = require("./rpg");
const generatorPreviews = require("./generator-previews");
const { readImage, sendImage } = require("./images");
const { createHash } = require("node:crypto");

module.exports = (ctx) => {
  const { db, live, route, fail } = ctx;
  const generated = new Map();
  const previews = new Map();
  live.onLockEnd((entityId, lock) =>
    previews.delete(`${entityId}:${lock.session}:${lock.tab}`),
  );
  function get(user, entityId, edit = false) {
    const row = access.entity(db, entityId);
    if (!(edit ? access.canEdit(db, user, row) : access.canView(db, user, row)))
      fail(404, "ENTITY_NOT_FOUND");
    return row;
  }
  function owner(user, row) {
    if (!access.ownsEntity(user, row)) fail(403, "FORBIDDEN");
  }
  function activeUser(username) {
    if (typeof username !== "string") fail(400, "USER_NOT_FOUND");
    const user = db
      .prepare(
        "SELECT id,username,role FROM users WHERE username=? COLLATE NOCASE AND status='active'",
      )
      .get(username.trim());
    if (!user) fail(404, "USER_NOT_FOUND");
    return user;
  }
  function tab(body) {
    if (
      typeof body.tab !== "string" ||
      !/^[a-zA-Z0-9_-]{16,80}$/.test(body.tab)
    )
      fail(400, "INVALID_TAB");
    return body.tab;
  }
  function requireLock(row, user, auth, body) {
    const tabId = tab(body);
    if (!live.requireLock(row.id, user, auth.hash, tabId))
      fail(409, "LOCK_REQUIRED");
    return tabId;
  }
  function previewKey(row, auth, tabId) {
    return `${row.id}:${auth.hash}:${tabId}`;
  }
  function assertNotPreview(row, auth, tabId) {
    const key = previewKey(row, auth, tabId),
      state = previews.get(key);
    if (state && state.lock === live.getLock(row.id))
      fail(409, "UNDO_PREVIEW_ACTIVE");
    if (state) previews.delete(key);
  }
  function insert(user, type, data) {
    const entityId = data.key;
    rpg.hydrate(type, data);
    transaction(db, () => {
      db.prepare(
        "INSERT INTO entities(id,type,owner_id,data,version,created_at) VALUES(?,?,?,?,0,?)",
      ).run(entityId, type, user.id, JSON.stringify(data), Date.now());
      db.prepare(
        "INSERT INTO entity_history(entity_id,version,data,created_at,actor_id) VALUES(?,0,?,?,?)",
      ).run(entityId, JSON.stringify(data), Date.now(), user.id);
    });
    return entityId;
  }
  function publish(
    row,
    data,
    user,
    expectedVersion,
    image = { bytes: row.portrait, mime: row.portrait_type },
  ) {
    rpg.hydrate(row.type, data);
    const previous = JSON.parse(row.data);
    const summary = (value) =>
      JSON.stringify({
        name: value.name,
        level: value.level,
        description: value.background?.physicalDescription,
        resources: value.resources,
      });
    const oldImage = row.portrait ? Buffer.from(row.portrait) : null;
    const newImage = image?.bytes ? Buffer.from(image.bytes) : null;
    const portraitChanged =
      Boolean(oldImage) !== Boolean(newImage) ||
      Boolean(oldImage && newImage && !oldImage.equals(newImage)) ||
      row.portrait_type !== (image?.mime || null);
    const playingChanged =
      row.type === "character" &&
      (summary(previous) !== summary(data) || portraitChanged);
    transaction(db, () => {
      const result = db
        .prepare(
          "UPDATE entities SET data=?,portrait=?,portrait_type=?,version=version+1 WHERE id=? AND version=?",
        )
        .run(
          JSON.stringify(data),
          image?.bytes || null,
          image?.mime || null,
          row.id,
          expectedVersion,
        );
      if (!result.changes) fail(409, "VERSION_CONFLICT");
      let imageHash = null;
      if (image?.bytes) {
        imageHash = createHash("sha256")
          .update(image.mime)
          .update(image.bytes)
          .digest("hex");
        db.prepare(
          "INSERT OR IGNORE INTO entity_images(entity_id,hash,image,mime) VALUES(?,?,?,?)",
        ).run(row.id, imageHash, image.bytes, image.mime);
      }
      db.prepare(
        "INSERT INTO entity_history(entity_id,version,data,created_at,actor_id,portrait_hash) VALUES(?,?,?,?,?,?)",
      ).run(
        row.id,
        expectedVersion + 1,
        JSON.stringify(data),
        Date.now(),
        user.id,
        imageHash,
      );
    });
    live.entityChanged(row.id);
    if (playingChanged) live.playingChanged(row.id);
  }
  ctx.publishEntity = publish;
  function sheet(row, user, data = JSON.parse(row.data)) {
    const entity = rpg.hydrate(row.type, data);
    const held = live.getLock(row.id);
    return {
      id: row.id,
      type: row.type,
      name: rpg.displayName(row.type, data, user.language),
      ownerId: row.owner_id,
      owner: db
        .prepare("SELECT username FROM users WHERE id=?")
        .get(row.owner_id)?.username,
      version: row.version,
      data,
      sections: rpg.sections(row.type, entity),
      portrait: Boolean(row.portrait),
      previewPortrait: false,
      canEdit: access.canEdit(db, user, row),
      isOwner: access.ownsEntity(user, row),
      lock: held ? { userId: held.userId, username: held.username } : null,
    };
  }
  function campaignContext(user, row, campaignId) {
    if (!campaignId) return null;
    if (
      !access.canOpenCampaign(db, user, campaignId) ||
      !access.canViewInCampaign(db, user, row, campaignId)
    )
      fail(404, "CAMPAIGN_NOT_FOUND");
    return campaignId;
  }
  function logAction(campaignId, row, user, details) {
    if (!campaignId) return;
    live.append(campaignId, {
      type: "combat",
      identity: {
        username: user.username,
        characterName: null,
      },
      entityIds: [row.id],
      entityName: rpg.displayName(
        row.type,
        JSON.parse(row.data),
        user.language,
      ),
      ...details,
    });
  }
  route("GET", "/api/generators", ({ user, url }) =>
    rpg.browse(
      url.searchParams.get("path") || "",
      url.searchParams.get("language") || user.language,
    ),
  );
  route("POST", "/api/generators", ({ user, body }) => {
    if (typeof body.path !== "string" || body.path.length > 300)
      fail(400, "INVALID_GENERATOR_PATH");
    return { result: rpg.generate(body.path, body.language || user.language) };
  });
  function ownedPreview(previewId, user) {
    const preview = generated.get(previewId);
    if (!preview || preview.owner !== user.id)
      fail(404, "PREVIEW_NOT_FOUND");
    return preview;
  }
  function keepPreview(previewId, preview, user, session, tabId) {
    clearTimeout(generated.get(previewId)?.timer);
    const stored = { ...preview, owner: user.id, session, tabId };
    // Retain all drafts of an open tab, including those behind another generator.
    const expire = () => {
      if (tabId && live.hasTab(session, tabId)) stored.timer = setTimeout(expire, 1800000).unref();
      else generated.delete(previewId);
    };
    stored.timer = setTimeout(expire, 1800000).unref();
    generated.set(previewId, stored);
    return generatorPreviews.response(previewId, preview);
  }
  route("POST", "/api/entity-previews", ({ user, auth, body }) => {
    const tabId = body.tab === undefined ? undefined : tab(body);
    if (!["character", "creature"].includes(body.type))
      fail(400, "INVALID_ENTITY_TYPE");
    const preview = generatorPreviews.build(body.type, {
      language: body.language === "fr" || (!body.language && user.language === "fr") ? "fr" : "en",
      level: body.level, path: body.path,
    });
    if (body.replace) {
      const previous = generated.get(body.replace);
      if (previous?.owner === user.id && previous.type === body.type) {
        clearTimeout(previous.timer);
        generated.delete(body.replace);
      }
    }
    return keepPreview(id(), preview, user, auth.hash, tabId);
  });
  route("GET", "/api/entity-previews/:id", ({ user, params }) =>
    generatorPreviews.response(params.id, ownedPreview(params.id, user)),
  );
  route("GET", "/api/entity-previews/:id/options", ({ user, params, url }) => {
    const preview = ownedPreview(params.id, user);
    const key = url.searchParams.get("key");
    if (!preview.draft.records.get(key)?.label) fail(400, "INVALID_GENERATION_CHOICE");
    return { revision: preview.revision, options: preview.draft.options(key).map(item => ({
      id: item.id, name: rpg.catalogLabel(item.name, preview.options.language),
    })) };
  });
  route("POST", "/api/entity-previews/:id/choice", ({ user, params, body }) => {
    const preview = ownedPreview(params.id, user);
    if (body.revision !== preview.revision) fail(409, "VERSION_CONFLICT");
    const next = generatorPreviews.build(preview.type, preview.options, preview, {
      key: body.key, value: body.value,
    });
    return keepPreview(params.id, next, user, preview.session, preview.tabId);
  });
  route("POST", "/api/entity-previews/:id/save", ({ user, params, body }) => {
    const preview = ownedPreview(params.id, user);
    if (body.revision !== undefined && body.revision !== preview.revision) fail(409, "VERSION_CONFLICT");
    const entityId = insert(user, preview.type, preview.data);
    clearTimeout(preview.timer);
    generated.delete(params.id);
    return { id: entityId };
  });
  route("GET", "/api/entities", ({ user, url }) => {
    const type = url.searchParams.get("type");
    const entities = db
      .prepare(
        "SELECT id,type,owner_id,data,(portrait IS NOT NULL) AS has_portrait FROM entities ORDER BY created_at DESC",
      )
      .all()
      .filter((e) => (!type || e.type === type) && access.canView(db, user, e))
      .map((e) => ({
        id: e.id,
        type: e.type,
        name: rpg.displayName(e.type, JSON.parse(e.data), user.language),
        portrait: Boolean(e.has_portrait),
        ownerId: e.owner_id,
        canEdit: access.canEdit(db, user, e),
      }));
    return { entities };
  });
  route("POST", "/api/entities", ({ user, body }) => {
    if (!["character", "creature"].includes(body.type))
      fail(400, "INVALID_ENTITY_TYPE");
    return { id: insert(user, body.type, rpg.createEntity(body.type)) };
  });
  route("GET", "/api/entities/:id", ({ user, params, url }) => {
    const row = get(user, params.id);
    campaignContext(user, row, url.searchParams.get("campaign"));
    const result = sheet(row, user);
    if (result.isOwner) {
      result.permissions = db
        .prepare(
          "SELECT p.permission,u.id,u.username FROM entity_permissions p JOIN users u ON u.id=p.user_id WHERE p.entity_id=? ORDER BY u.username",
        )
        .all(row.id);
      result.assignments = db
        .prepare(
          "SELECT a.campaign_id,a.state,a.visibility,c.name FROM assignments a JOIN campaigns c ON c.id=a.campaign_id WHERE a.entity_id=?",
        )
        .all(row.id);
    }
    return result;
  });
  route("DELETE", "/api/entities/:id", ({ user, params, auth, body }) => {
    const row = get(user, params.id);
    owner(user, row);
    if (
      body.confirm !==
      rpg.displayName(row.type, JSON.parse(row.data), user.language)
    )
      fail(400, "CONFIRMATION_REQUIRED");
    if (
      live.getLock(row.id) &&
      !live.requireLock(row.id, user, auth.hash, body.tab, false)
    )
      fail(409, "LOCKED");
    if (live.getLock(row.id)) live.release(row.id, user, auth.hash, body.tab);
    const assigned = db
      .prepare("SELECT campaign_id FROM assignments WHERE entity_id=?")
      .all(row.id);
    db.prepare("DELETE FROM entities WHERE id=?").run(row.id);
    for (const item of assigned) live.campaignChanged(item.campaign_id);
    for (const account of db.prepare("SELECT id FROM users").all())
      live.userChanged(account.id);
    return { ok: true };
  });
  route("POST", "/api/entities/:id/lock", ({ user, params, auth, body }) => {
    const row = get(user, params.id, true);
    const tabId = tab(body);
    if (body.action === "start") {
      if (!live.acquire(row.id, user, auth.hash, tabId)) fail(409, "LOCKED");
    } else if (body.action === "activity") {
      if (!live.requireLock(row.id, user, auth.hash, tabId))
        fail(409, "LOCK_REQUIRED");
    } else if (body.action === "finish") {
      if (!live.release(row.id, user, auth.hash, tabId))
        fail(409, "LOCK_REQUIRED");
      previews.delete(previewKey(row, auth, tabId));
    } else fail(400, "INVALID_ACTION");
    return { ok: true };
  });
  route("POST", "/api/entities/:id/edit", ({ user, params, auth, body }) => {
    const row = get(user, params.id, true);
    const tabId = requireLock(row, user, auth, body);
    assertNotPreview(row, auth, tabId);
    if (!Number.isSafeInteger(body.version) || body.version !== row.version)
      fail(409, "VERSION_CONFLICT");
    const campaignId = campaignContext(user, row, body.campaignId);
    const data = rpg.edit(
      row.type,
      JSON.parse(row.data),
      body.field,
      body.value,
    );
    publish(row, data, user, row.version);
    if (
      body.field === "resources" &&
      JSON.stringify(JSON.parse(row.data).resources) !==
        JSON.stringify(data.resources)
    )
      logAction(campaignId, row, user, {
        action: "resource",
        resources: data.resources,
      });
    return { entity: sheet(access.entity(db, row.id), user) };
  });
  route("POST", "/api/entities/:id/combat", ({ user, params, auth, body }) => {
    const row = get(user, params.id, true);
    const tabId = requireLock(row, user, auth, body);
    assertNotPreview(row, auth, tabId);
    const campaignId = campaignContext(user, row, body.campaignId);
    if (!Number.isSafeInteger(body.version) || body.version !== row.version)
      fail(409, "VERSION_CONFLICT");
    const result = rpg.combat(
      row.type,
      JSON.parse(row.data),
      body.action,
      body,
    );
    publish(row, result.data, user, row.version);
    logAction(campaignId, row, user, {
      action: body.action,
      result: result.result,
      resources: result.data.resources,
    });
    return {
      entity: sheet(access.entity(db, row.id), user),
      result: result.result,
    };
  });
  route("POST", "/api/entities/:id/undo", ({ user, params, auth, body }) => {
    const row = get(user, params.id, true);
    const tabId = requireLock(row, user, auth, body);
    const key = previewKey(row, auth, tabId);
    let state = previews.get(key);
    const held = live.getLock(row.id);
    if (state && state.lock !== held) {
      previews.delete(key);
      state = null;
    }
    if (body.action === "cancel") {
      previews.delete(key);
      return { entity: sheet(row, user), preview: false };
    }
    if (body.action === "undo") {
      if (!state) state = { baseVersion: row.version, offset: 0, lock: held };
      if (row.version !== state.baseVersion) fail(409, "VERSION_CONFLICT");
      if (state.offset >= state.baseVersion) fail(400, "NO_MORE_UNDO");
      state.offset++;
      previews.set(key, state);
    } else if (body.action === "redo") {
      if (!state || state.offset < 1) fail(400, "NO_MORE_REDO");
      state.offset--;
      if (state.offset === 0) {
        previews.delete(key);
        return { entity: sheet(row, user), preview: false };
      }
    } else if (body.action === "save") {
      if (!state || !state.offset || row.version !== state.baseVersion)
        fail(409, "VERSION_CONFLICT");
      const previous = db
        .prepare(
          "SELECT h.data,i.image,i.mime FROM entity_history h LEFT JOIN entity_images i ON i.entity_id=h.entity_id AND i.hash=h.portrait_hash WHERE h.entity_id=? AND h.version=?",
        )
        .get(row.id, state.baseVersion - state.offset);
      if (!previous) fail(409, "VERSION_CONFLICT");
      publish(row, JSON.parse(previous.data), user, state.baseVersion, {
        bytes: previous.image,
        mime: previous.mime,
      });
      previews.delete(key);
      return { entity: sheet(access.entity(db, row.id), user), preview: false };
    } else fail(400, "INVALID_ACTION");
    const previous = db
      .prepare(
        "SELECT h.data,i.image,i.mime FROM entity_history h LEFT JOIN entity_images i ON i.entity_id=h.entity_id AND i.hash=h.portrait_hash WHERE h.entity_id=? AND h.version=?",
      )
      .get(row.id, state.baseVersion - state.offset);
    if (!previous) fail(409, "VERSION_CONFLICT");
    return {
      entity: {
        ...sheet(
          { ...row, portrait: previous.image, portrait_type: previous.mime },
          user,
          JSON.parse(previous.data),
        ),
        previewPortrait: true,
      },
      preview: true,
      offset: state.offset,
    };
  });
  route("POST", "/api/entities/:id/transfer", ({ user, params, body }) => {
    const row = get(user, params.id);
    owner(user, row);
    const target = activeUser(body.username);
    const affected = transaction(db, () => {
      db.prepare("UPDATE entities SET owner_id=? WHERE id=?").run(
        target.id,
        row.id,
      );
      return access.pruneSelections(db, row.id);
    });
    for (const campaignId of affected) live.campaignChanged(campaignId);
    live.entityChanged(row.id);
    live.userChanged(user.id);
    live.userChanged(target.id);
    return { ok: true };
  });
  route("POST", "/api/entities/:id/permissions", ({ user, params, body }) => {
    const row = get(user, params.id);
    owner(user, row);
    const target = activeUser(body.username);
    if (target.id === row.owner_id) fail(400, "ALREADY_OWNER");
    const affected = transaction(db, () => {
      if (body.permission === null)
        db.prepare(
          "DELETE FROM entity_permissions WHERE entity_id=? AND user_id=?",
        ).run(row.id, target.id);
      else if (["viewer", "editor"].includes(body.permission))
        db.prepare(
          "INSERT INTO entity_permissions(entity_id,user_id,permission) VALUES(?,?,?) ON CONFLICT(entity_id,user_id) DO UPDATE SET permission=excluded.permission",
        ).run(row.id, target.id, body.permission);
      else fail(400, "INVALID_PERMISSION");
      return access.pruneSelections(db, row.id);
    });
    for (const campaignId of affected) live.campaignChanged(campaignId);
    live.userChanged(target.id);
    live.entityChanged(row.id);
    return { ok: true };
  });
  route("POST", "/api/entities/:id/assignments", ({ user, params, body }) => {
    const row = get(user, params.id);
    owner(user, row);
    const campaignId = body.campaignId;
    if (typeof campaignId !== "string" || !access.campaign(db, campaignId))
      fail(404, "CAMPAIGN_NOT_FOUND");
    if (!["private", "shared"].includes(body.visibility))
      fail(400, "INVALID_VISIBILITY");
    if (
      db
        .prepare(
          "SELECT 1 FROM assignments WHERE entity_id=? AND campaign_id=?",
        )
        .get(row.id, campaignId)
    )
      fail(409, "ALREADY_ASSIGNED");
    db.prepare(
      "INSERT INTO assignments(entity_id,campaign_id,state,visibility,created_at) VALUES(?,?,'pending',?,?)",
    ).run(row.id, campaignId, body.visibility, Date.now());
    live.campaignChanged(campaignId);
    return { ok: true };
  });
  route(
    "POST",
    "/api/campaigns/:campaign/assignments/:id",
    ({ user, params, body }) => {
      const row = access.entity(db, params.id);
      const assignment = db
        .prepare(
          "SELECT * FROM assignments WHERE entity_id=? AND campaign_id=?",
        )
        .get(params.id, params.campaign);
      if (!row || !assignment) fail(404, "ASSIGNMENT_NOT_FOUND");
      const gm = access.isGm(db, user, params.campaign),
        own = access.ownsEntity(user, row);
      if (!own && !gm) fail(404, "ASSIGNMENT_NOT_FOUND");
      if (!own && !access.canOpenCampaign(db, user, params.campaign))
        fail(404, "CAMPAIGN_NOT_FOUND");
      const affected = transaction(db, () => {
        if (body.action === "approve" && assignment.state === "pending" && gm)
          db.prepare(
            "UPDATE assignments SET state='approved' WHERE entity_id=? AND campaign_id=?",
          ).run(row.id, params.campaign);
        else if (body.action === "remove" && (own || gm)) {
          db.prepare(
            "DELETE FROM assignments WHERE entity_id=? AND campaign_id=?",
          ).run(row.id, params.campaign);
          return access.pruneSelections(db, row.id);
        } else if (
          body.action === "visibility" &&
          own &&
          ["private", "shared"].includes(body.visibility)
        ) {
          db.prepare(
            "UPDATE assignments SET visibility=? WHERE entity_id=? AND campaign_id=?",
          ).run(body.visibility, row.id, params.campaign);
          return access.pruneSelections(db, row.id);
        } else fail(403, "FORBIDDEN");
        return [];
      });
      for (const campaignId of affected)
        if (campaignId !== params.campaign) live.campaignChanged(campaignId);
      live.entityChanged(row.id);
      live.campaignChanged(params.campaign);
      live.userChanged(row.owner_id);
      return { ok: true };
    },
  );
  route(
    "GET",
    "/api/entities/:id/portrait",
    ({ user, params, auth, url, res }) => {
      const row = access.entity(db, params.id);
      let allowed = access.canView(db, user, row);
      if (url.searchParams.get("preview") === "1") {
        if (!row || !access.canEdit(db, user, row)) fail(404, "NOT_FOUND");
        const tabId = url.searchParams.get("tab") || "";
        const state = previews.get(previewKey(row, auth, tabId));
        if (
          !state ||
          state.lock !== live.getLock(row.id) ||
          state.baseVersion !== row.version ||
          !live.requireLock(row.id, user, auth.hash, tabId, false)
        )
          fail(404, "NOT_FOUND");
        const image = db
          .prepare(
            "SELECT i.image,i.mime FROM entity_history h JOIN entity_images i ON i.entity_id=h.entity_id AND i.hash=h.portrait_hash WHERE h.entity_id=? AND h.version=?",
          )
          .get(row.id, state.baseVersion - state.offset);
        if (!image) fail(404, "NOT_FOUND");
        sendImage(res, image.image, image.mime);
        return;
      }
      if (!allowed || !row?.portrait) fail(404, "NOT_FOUND");
      sendImage(res, row.portrait, row.portrait_type);
    },
  );
  route(
    "POST",
    "/api/entities/:id/portrait",
    ({ user, params, auth, body }) => {
      const row = get(user, params.id, true);
      const tabId = requireLock(row, user, auth, body);
      assertNotPreview(row, auth, tabId);
      let image;
      try {
        image = readImage(body.image);
      } catch {
        fail(400, "INVALID_IMAGE");
      }
      if (!Number.isSafeInteger(body.version) || body.version !== row.version)
        fail(409, "VERSION_CONFLICT");
      publish(row, JSON.parse(row.data), user, row.version, image);
      return { entity: sheet(access.entity(db, row.id), user) };
    },
  );
};
