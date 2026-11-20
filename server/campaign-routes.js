const { transaction } = require("./db");
const { id } = require("./security");
const access = require("./access");
const rpg = require("./rpg");
const { readImage, sendImage } = require("./images");

module.exports = ({ db, live, route, fail, diceAppearance }) => {
  const member = (campaignId, userId) =>
    access.membership(db, campaignId, userId);
  function getCampaign(user, campaignId) {
    const c = access.campaign(db, campaignId);
    if (!c || !access.canOpenCampaign(db, user, campaignId))
      fail(404, "CAMPAIGN_NOT_FOUND");
    return c;
  }
  function canParticipate(user, campaignId) {
    if (!member(campaignId, user.id) && user.role !== "admin")
      fail(403, "MEMBERS_ONLY");
  }
  function activeUser(username) {
    if (typeof username !== "string") fail(400, "USER_NOT_FOUND");
    const target = db
      .prepare(
        "SELECT id,username,role,status FROM users WHERE username=? COLLATE NOCASE AND status='active'",
      )
      .get(username.trim());
    if (!target) fail(404, "USER_NOT_FOUND");
    return target;
  }
  function presentation(input) {
    if (
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.length > 120 ||
      typeof input.description !== "string" ||
      input.description.length > 4000 ||
      !["en", "fr"].includes(input.language)
    )
      fail(400, "INVALID_CAMPAIGN");
    return {
      name: input.name.trim(),
      description: input.description.trim(),
      language: input.language,
    };
  }
  function pruneAll() {
    const affected = new Set();
    for (const row of db
      .prepare("SELECT DISTINCT entity_id FROM playing_characters")
      .all())
      for (const campaignId of access.pruneSelections(db, row.entity_id))
        affected.add(campaignId);
    return [...affected];
  }
  function identity(campaignId, user) {
    const selected = db
      .prepare(
        "SELECT e.data,e.type FROM playing_characters p JOIN entities e ON e.id=p.entity_id WHERE p.campaign_id=? AND p.user_id=?",
      )
      .get(campaignId, user.id);
    return {
      username: user.username,
      characterName: selected
        ? rpg.displayName(
            selected.type,
            JSON.parse(selected.data),
            user.language,
          )
        : null,
    };
  }
  route("GET", "/api/events", ({ req, res, user, auth, url }) => {
    const tab = url.searchParams.get("tab") || "";
    const campaignId = url.searchParams.get("campaign") || null;
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(tab)) fail(400, "INVALID_TAB");
    if (campaignId) getCampaign(user, campaignId);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const client = { user, session: auth.hash, tab, campaignId, res };
    live.add(client);
    const timer = setInterval(() => {
      live.sweep();
      if (!res.writableEnded) res.write(": heartbeat\n\n");
    }, 25000);
    res.on("close", () => {
      clearInterval(timer);
      live.remove(client);
    });
  });
  route("GET", "/api/campaigns", ({ user }) => {
    const campaigns = db
      .prepare(
        "SELECT c.id,c.name,c.description,c.language,c.owner_id,(c.cover IS NOT NULL) AS has_cover,u.username AS owner FROM campaigns c JOIN users u ON u.id=c.owner_id ORDER BY c.created_at DESC",
      )
      .all()
      .filter((c) => access.canOpenCampaign(db, user, c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        language: c.language,
        owner: c.owner,
        ownerId: c.owner_id,
        cover: Boolean(c.has_cover),
        role: member(c.id, user.id)?.role || null,
      }));
    const invitations = db
      .prepare(
        "SELECT c.id,c.name,u.username AS invitedBy FROM campaign_invitations i JOIN campaigns c ON c.id=i.campaign_id JOIN users u ON u.id=i.created_by WHERE i.user_id=? ORDER BY i.created_at DESC",
      )
      .all(user.id);
    return { campaigns, invitations };
  });
  route("POST", "/api/campaigns", ({ user, body }) => {
    const p = presentation({
      name: body.name,
      description: body.description || "",
      language: body.language || user.language,
    });
    const campaignId = id();
    transaction(db, () => {
      db.prepare(
        "INSERT INTO campaigns(id,name,description,language,owner_id,created_at) VALUES(?,?,?,?,?,?)",
      ).run(campaignId, p.name, p.description, p.language, user.id, Date.now());
      db.prepare(
        "INSERT INTO members(campaign_id,user_id,role) VALUES(?,?,'gm')",
      ).run(campaignId, user.id);
    });
    return { id: campaignId };
  });
  route("POST", "/api/campaign-invitations/:id", ({ user, params, body }) => {
    const invitation = db
      .prepare(
        "SELECT * FROM campaign_invitations WHERE campaign_id=? AND user_id=?",
      )
      .get(params.id, user.id);
    if (!invitation) fail(404, "INVITATION_INVALID");
    if (!["accept", "reject"].includes(body.action))
      fail(400, "INVALID_ACTION");
    transaction(db, () => {
      db.prepare(
        "DELETE FROM campaign_invitations WHERE campaign_id=? AND user_id=?",
      ).run(params.id, user.id);
      if (body.action === "accept")
        db.prepare(
          "INSERT OR IGNORE INTO members(campaign_id,user_id,role) VALUES(?,?,'member')",
        ).run(params.id, user.id);
    });
    live.membershipChanged(params.id);
    live.campaignChanged(params.id);
    live.userChanged(user.id);
    return { ok: true };
  });
  route("GET", "/api/campaigns/:id", ({ user, params }) => {
    const c = getCampaign(user, params.id);
    const gm = access.isGm(db, user, c.id);
    const campaignMember = Boolean(member(c.id, user.id));
    const members = db
      .prepare(
        "SELECT u.id,u.username,m.role,p.entity_id FROM members m JOIN users u ON u.id=m.user_id LEFT JOIN playing_characters p ON p.campaign_id=m.campaign_id AND p.user_id=m.user_id WHERE m.campaign_id=? ORDER BY u.username COLLATE NOCASE",
      )
      .all(c.id)
      .map((m) => {
        let playing = null;
        if (m.entity_id) {
          const e = db
            .prepare(
              "SELECT id,type,owner_id,data,(portrait IS NOT NULL) AS has_portrait FROM entities WHERE id=?",
            )
            .get(m.entity_id);
          if (
            e &&
            (campaignMember ||
              user.role === "admin" ||
              access.canViewInCampaign(db, user, e, c.id))
          ) {
            const data = JSON.parse(e.data);
            playing = {
              id: e.id,
              name: rpg.displayName(e.type, data, user.language),
              level: data.level,
              description: data.background.physicalDescription,
              resources: data.resources,
              portrait: Boolean(e.has_portrait),
            };
          }
        }
        return { id: m.id, username: m.username, role: m.role, playing };
      });
    const entities = db
      .prepare(
        "SELECT e.id,e.type,e.owner_id,e.data,(e.portrait IS NOT NULL) AS has_portrait,a.visibility FROM assignments a JOIN entities e ON e.id=a.entity_id WHERE a.campaign_id=? AND a.state='approved' ORDER BY e.created_at DESC",
      )
      .all(c.id)
      .filter((e) => access.canViewInCampaign(db, user, e, c.id))
      .map((e) => ({
        id: e.id,
        type: e.type,
        name: rpg.displayName(e.type, JSON.parse(e.data), user.language),
        visibility: e.visibility,
        portrait: Boolean(e.has_portrait),
        canEdit: access.canEdit(db, user, e),
      }));
    const pending = gm
      ? db
          .prepare(
            "SELECT e.id,e.type,e.data,u.username AS owner,a.visibility FROM assignments a JOIN entities e ON e.id=a.entity_id JOIN users u ON u.id=e.owner_id WHERE a.campaign_id=? AND a.state='pending' ORDER BY a.created_at",
          )
          .all(c.id)
          .map((e) => ({
            id: e.id,
            type: e.type,
            name: rpg.displayName(e.type, JSON.parse(e.data), user.language),
            owner: e.owner,
            visibility: e.visibility,
          }))
      : [];
    return {
      campaign: {
        id: c.id,
        name: c.name,
        description: c.description,
        language: c.language,
        ownerId: c.owner_id,
        cover: Boolean(c.cover),
      },
      members,
      entities,
      pending,
      gm,
      manage: access.managesCampaign(db, user, c.id),
      membership: member(c.id, user.id)?.role || null,
      presence: live.presence(c.id),
      chat:
        campaignMember || user.role === "admin" ? live.history(c.id, user) : [],
      chatSnapshotTime: Date.now(),
    };
  });
  route("POST", "/api/campaigns/:id", ({ user, params, body }) => {
    const c = getCampaign(user, params.id);
    if (!access.managesCampaign(db, user, c.id) && !access.isGm(db, user, c.id))
      fail(403, "FORBIDDEN");
    const p = presentation(body);
    db.prepare(
      "UPDATE campaigns SET name=?,description=?,language=? WHERE id=?",
    ).run(p.name, p.description, p.language, c.id);
    live.campaignChanged(c.id);
    return { ok: true };
  });
  route("DELETE", "/api/campaigns/:id", ({ user, params, body }) => {
    const c = getCampaign(user, params.id);
    if (!access.managesCampaign(db, user, c.id)) fail(403, "FORBIDDEN");
    if (body.confirm !== c.name) fail(400, "CONFIRMATION_REQUIRED");
    const affected = transaction(db, () => {
      db.prepare("DELETE FROM campaigns WHERE id=?").run(c.id);
      return pruneAll();
    });
    live.discardCampaign(c.id);
    for (const campaignId of affected) live.campaignChanged(campaignId);
    for (const u of db.prepare("SELECT id FROM users").all())
      live.userChanged(u.id);
    return { ok: true };
  });
  route("POST", "/api/campaigns/:id/transfer", ({ user, params, body }) => {
    const c = getCampaign(user, params.id);
    if (!access.managesCampaign(db, user, c.id)) fail(403, "FORBIDDEN");
    const target = activeUser(body.username);
    db.prepare("UPDATE campaigns SET owner_id=? WHERE id=?").run(
      target.id,
      c.id,
    );
    live.userChanged(target.id);
    live.userChanged(user.id);
    live.campaignChanged(c.id);
    return { ok: true };
  });
  route("POST", "/api/campaigns/:id/invite", ({ user, params, body }) => {
    const c = getCampaign(user, params.id);
    if (!access.managesCampaign(db, user, c.id) && !access.isGm(db, user, c.id))
      fail(403, "FORBIDDEN");
    const target = activeUser(body.username);
    if (member(c.id, target.id)) fail(409, "ALREADY_MEMBER");
    db.prepare(
      "INSERT OR REPLACE INTO campaign_invitations(campaign_id,user_id,created_by,created_at) VALUES(?,?,?,?)",
    ).run(c.id, target.id, user.id, Date.now());
    live.userChanged(target.id);
    return { ok: true };
  });
  route(
    "POST",
    "/api/campaigns/:id/members/:member",
    ({ user, params, body }) => {
      const c = getCampaign(user, params.id);
      const target = member(c.id, params.member);
      if (!target) fail(404, "USER_NOT_FOUND");
      let affected = [];
      if (body.action === "promote" || body.action === "demote") {
        if (!access.managesCampaign(db, user, c.id)) fail(403, "FORBIDDEN");
        affected = transaction(db, () => {
          db.prepare(
            "UPDATE members SET role=? WHERE campaign_id=? AND user_id=?",
          ).run(
            body.action === "promote" ? "gm" : "member",
            c.id,
            target.user_id,
          );
          return pruneAll();
        });
      } else if (body.action === "remove") {
        const self = target.user_id === user.id;
        if (
          !self &&
          !access.managesCampaign(db, user, c.id) &&
          !(access.isGm(db, user, c.id) && target.role === "member")
        )
          fail(403, "FORBIDDEN");
        affected = transaction(db, () => {
          db.prepare(
            "DELETE FROM members WHERE campaign_id=? AND user_id=?",
          ).run(c.id, target.user_id);
          return pruneAll();
        });
      } else fail(400, "INVALID_ACTION");
      live.userChanged(target.user_id);
      live.membershipChanged(c.id);
      live.campaignChanged(c.id);
      for (const campaignId of affected)
        if (campaignId !== c.id) live.campaignChanged(campaignId);
      return { ok: true };
    },
  );
  route(
    "POST",
    "/api/campaigns/:id/playing/:member",
    ({ user, params, body }) => {
      const c = getCampaign(user, params.id);
      const target = member(c.id, params.member);
      if (!target) fail(404, "USER_NOT_FOUND");
      const gm = access.isGm(db, user, c.id);
      if (user.id !== target.user_id && !gm) fail(403, "FORBIDDEN");
      transaction(db, () => {
        if (body.entityId === null) {
          db.prepare(
            "DELETE FROM playing_characters WHERE campaign_id=? AND user_id=?",
          ).run(c.id, target.user_id);
          return;
        }
        const e = access.entity(db, body.entityId);
        const targetUser = db
          .prepare("SELECT id,role FROM users WHERE id=? AND status='active'")
          .get(target.user_id);
        if (
          !e ||
          e.type !== "character" ||
          !targetUser ||
          !access.canEdit(db, targetUser, e) ||
          !db
            .prepare(
              "SELECT 1 FROM assignments WHERE campaign_id=? AND entity_id=? AND state='approved'",
            )
            .get(c.id, e.id)
        )
          fail(400, "CHARACTER_INELIGIBLE");
        const claimed = db
          .prepare(
            "SELECT user_id FROM playing_characters WHERE campaign_id=? AND entity_id=?",
          )
          .get(c.id, e.id);
        if (claimed && claimed.user_id !== target.user_id && !gm)
          fail(409, "CHARACTER_ALREADY_PLAYING");
        if (claimed && gm)
          db.prepare(
            "DELETE FROM playing_characters WHERE campaign_id=? AND entity_id=?",
          ).run(c.id, e.id);
        db.prepare(
          "INSERT INTO playing_characters(campaign_id,user_id,entity_id) VALUES(?,?,?) ON CONFLICT(campaign_id,user_id) DO UPDATE SET entity_id=excluded.entity_id",
        ).run(c.id, target.user_id, e.id);
      });
      live.campaignChanged(c.id);
      return { ok: true };
    },
  );
  route("POST", "/api/campaigns/:id/chat", ({ user, params, body }) => {
    const c = getCampaign(user, params.id);
    canParticipate(user, c.id);
    if (
      typeof body.text !== "string" ||
      !body.text.trim() ||
      body.text.length > 2000
    )
      fail(400, "INVALID_MESSAGE");
    live.append(c.id, {
      type: "text",
      identity: identity(c.id, user),
      text: body.text.trim(),
    });
    return { ok: true };
  });
  route("POST", "/api/dice", ({ user, body }) => {
    const result = { ...rpg.roll(body.expression), appearance: diceAppearance(user.id) };
    if (body.campaignId) {
      const c = getCampaign(user, body.campaignId);
      canParticipate(user, c.id);
      if (body.private !== undefined && typeof body.private !== "boolean")
        fail(400, "INVALID_ACTION");
      live.append(c.id, {
        type: "roll",
        identity: identity(c.id, user),
        rollerId: user.id,
        privateRoll: Boolean(body.private),
        result,
      });
    }
    return { result };
  });
  route("GET", "/api/campaigns/:id/cover", ({ user, params, res }) => {
    const c = getCampaign(user, params.id);
    if (!c.cover) fail(404, "NOT_FOUND");
    sendImage(res, c.cover, c.cover_type);
  });
  route("POST", "/api/campaigns/:id/cover", ({ user, params, body }) => {
    const c = getCampaign(user, params.id);
    if (!access.managesCampaign(db, user, c.id) && !access.isGm(db, user, c.id))
      fail(403, "FORBIDDEN");
    let image;
    try {
      image = readImage(body.image);
    } catch {
      fail(400, "INVALID_IMAGE");
    }
    db.prepare("UPDATE campaigns SET cover=?,cover_type=? WHERE id=?").run(
      image?.bytes || null,
      image?.mime || null,
      c.id,
    );
    live.campaignChanged(c.id);
    return { ok: true };
  });
};
