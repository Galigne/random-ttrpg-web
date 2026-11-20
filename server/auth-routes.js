const { transaction } = require("./db");
const {
  id,
  token,
  digest,
  validUsername,
  validPassword,
  hashPassword,
  verifyPassword,
  sessionCookie,
  makeLimiter,
} = require("./security");
const { isIP } = require("node:net");

const diceSkins = require("../public/dice/skins");

module.exports = ({ db, live, route, fail, secureCookies, diceAppearance }) => {
  const allowAuth = makeLimiter({ limit: 20 });
  const publicUser = (user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    language: user.language,
    diceAppearance: diceAppearance(user.id),
  });
  const rate = (req) => {
    const forwarded =
      process.env.TRUST_PROXY === "1" ? req.headers["x-real-ip"] : null;
    const address =
      typeof forwarded === "string" && isIP(forwarded)
        ? forwarded
        : req.socket.remoteAddress || "unknown";
    if (!allowAuth(address)) fail(429, "TOO_MANY_ATTEMPTS");
  };
  function admin(user) {
    if (user.role !== "admin") fail(403, "FORBIDDEN");
  }
  function activeUser(username) {
    const user = db
      .prepare(
        "SELECT id,username,role,status FROM users WHERE username=? COLLATE NOCASE AND status='active'",
      )
      .get(username);
    if (!user) fail(404, "USER_NOT_FOUND");
    return user;
  }
  route(
    "GET",
    "/api/me",
    ({ auth }) => ({
      user: auth ? publicUser(auth.user) : null,
      csrf: auth?.csrf || null,
    }),
    { public: true },
  );
  route(
    "POST",
    "/api/register",
    async ({ req, body }) => {
      rate(req);
      const username =
        typeof body.username === "string" ? body.username.trim() : "";
      if (!validUsername(username)) fail(400, "USERNAME_REQUIREMENTS");
      if (!validPassword(body.password)) fail(400, "PASSWORD_REQUIREMENTS");
      const password = await hashPassword(body.password);
      return transaction(db, () => {
        if (
          db
            .prepare("SELECT 1 FROM users WHERE username=? COLLATE NOCASE")
            .get(username)
        )
          fail(409, "USERNAME_TAKEN");
        let status = "pending";
        if (body.invite) {
          if (typeof body.invite !== "string" || body.invite.length > 128)
            fail(400, "INVITATION_INVALID");
          const hash = digest(body.invite);
          const invitation = db
            .prepare(
              "SELECT * FROM tokens WHERE token_hash=? AND kind='invite' AND expires_at>?",
            )
            .get(hash, Date.now());
          if (!invitation) fail(400, "INVITATION_INVALID");
          db.prepare("DELETE FROM tokens WHERE token_hash=?").run(hash);
          status = "active";
        }
        db.prepare(
          "INSERT INTO users(id,username,password_hash,role,status,language,created_at) VALUES(?,?,?,?,?,?,?)",
        ).run(
          id(),
          username,
          password,
          "user",
          status,
          body.language === "fr" ? "fr" : "en",
          Date.now(),
        );
        return { status };
      });
    },
    { public: true, noCsrf: true },
  );
  route(
    "POST",
    "/api/login",
    async ({ req, res, body }) => {
      rate(req);
      const name =
        typeof body.username === "string" ? body.username.trim() : "";
      const user = db
        .prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE")
        .get(name);
      // Apply the same password derivation cost even when the username is absent.
      const dummy =
        "scrypt$dummy-salt$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      if (
        !(await verifyPassword(body.password, user?.password_hash || dummy)) ||
        !user ||
        user.status !== "active"
      )
        fail(401, "LOGIN_FAILED");
      const raw = token();
      const csrf = token();
      db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
      db.prepare(
        "INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)",
      ).run(digest(raw), user.id, csrf, Date.now() + 7 * 86400000);
      res.setHeader("Set-Cookie", sessionCookie(raw, secureCookies));
      return { user: publicUser(user), csrf };
    },
    { public: true, noCsrf: true },
  );
  route("POST", "/api/logout", ({ res, auth }) => {
    db.prepare("DELETE FROM sessions WHERE token_hash=?").run(auth.hash);
    live.disconnectSession(auth.hash);
    res.setHeader("Set-Cookie", sessionCookie("", secureCookies, 0));
    return { ok: true };
  });
  route("POST", "/api/dice/appearance", ({ user, body }) => {
    const { skin, glow } = body;
    if (typeof skin !== "string" || !Object.hasOwn(diceSkins, skin) ||
        !(glow === null || (typeof glow === "string" && /^#[0-9a-f]{6}$/i.test(glow))))
      fail(400, "INVALID_DICE_APPEARANCE");
    const appearance = { skin, glow: glow?.toLowerCase() ?? null };
    db.prepare(`INSERT INTO dice_preferences(user_id,skin,glow) VALUES(?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET skin=excluded.skin, glow=excluded.glow`)
      .run(user.id, appearance.skin, appearance.glow);
    return { appearance };
  });
  route("POST", "/api/language", ({ user, body }) => {
    if (!["en", "fr"].includes(body.language)) fail(400, "INVALID_LANGUAGE");
    db.prepare("UPDATE users SET language=? WHERE id=?").run(
      body.language,
      user.id,
    );
    live.userChanged(user.id);
    return { ok: true };
  });
  route(
    "POST",
    "/api/reset",
    async ({ req, body }) => {
      rate(req);
      if (
        typeof body.token !== "string" ||
        body.token.length > 128 ||
        !validPassword(body.password)
      )
        fail(400, "RESET_INVALID");
      const password = await hashPassword(body.password);
      const sessions = transaction(db, () => {
        const reset = db
          .prepare(
            "SELECT * FROM tokens WHERE token_hash=? AND kind='reset' AND expires_at>?",
          )
          .get(digest(body.token), Date.now());
        if (!reset) fail(400, "RESET_INVALID");
        const existing = db
          .prepare("SELECT token_hash FROM sessions WHERE user_id=?")
          .all(reset.user_id);
        db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(
          password,
          reset.user_id,
        );
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(reset.user_id);
        db.prepare("DELETE FROM tokens WHERE user_id=? AND kind='reset'").run(
          reset.user_id,
        );
        return existing;
      });
      for (const item of sessions) live.disconnectSession(item.token_hash);
      return { ok: true };
    },
    { public: true, noCsrf: true },
  );
  route("GET", "/api/admin/users", ({ user }) => {
    admin(user);
    return {
      users: db
        .prepare(
          "SELECT id,username,role,status,language,created_at FROM users ORDER BY username COLLATE NOCASE",
        )
        .all(),
    };
  });
  route("POST", "/api/admin/users/:id", ({ user, params, body }) => {
    admin(user);
    const target = db.prepare("SELECT * FROM users WHERE id=?").get(params.id);
    if (!target) fail(404, "USER_NOT_FOUND");
    const role = body.role ?? target.role,
      status = body.status ?? target.status;
    if (
      !["user", "admin"].includes(role) ||
      !["active", "pending", "rejected", "disabled"].includes(status)
    )
      fail(400, "INVALID_ACCOUNT");
    if (
      target.role === "admin" &&
      target.status === "active" &&
      (role !== "admin" || status !== "active") &&
      db
        .prepare(
          "SELECT count(*) AS n FROM users WHERE role='admin' AND status='active'",
        )
        .get().n === 1
    )
      fail(409, "LAST_ADMIN");
    const sessions =
      status !== "active"
        ? db
            .prepare("SELECT token_hash FROM sessions WHERE user_id=?")
            .all(target.id)
        : [];
    const affected = transaction(db, () => {
      db.prepare("UPDATE users SET role=?,status=? WHERE id=?").run(
        role,
        status,
        target.id,
      );
      if (status !== "active")
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(target.id);
      const campaigns = new Set();
      for (const row of db
        .prepare(
          "SELECT DISTINCT entity_id FROM playing_characters WHERE user_id=?",
        )
        .all(target.id))
        for (const campaignId of require("./access").pruneSelections(
          db,
          row.entity_id,
        ))
          campaigns.add(campaignId);
      return [...campaigns];
    });
    for (const session of sessions) live.disconnectSession(session.token_hash);
    for (const campaignId of affected) live.campaignChanged(campaignId);
    live.userChanged(target.id);
    return { ok: true };
  });
  route("GET", "/api/admin/invitations", ({ user }) => {
    admin(user);
    return {
      invitations: db
        .prepare(
          "SELECT token_hash,created_at,expires_at FROM tokens WHERE kind='invite' AND expires_at>? ORDER BY created_at DESC",
        )
        .all(Date.now()),
    };
  });
  route("POST", "/api/admin/invitations", ({ user }) => {
    admin(user);
    const raw = token();
    db.prepare(
      "INSERT INTO tokens(token_hash,kind,user_id,created_by,expires_at,created_at) VALUES(?,'invite',NULL,?,?,?)",
    ).run(digest(raw), user.id, Date.now() + 7 * 86400000, Date.now());
    return { path: `/?invite=${raw}` };
  });
  route("DELETE", "/api/admin/invitations/:id", ({ user, params }) => {
    admin(user);
    db.prepare("DELETE FROM tokens WHERE token_hash=? AND kind='invite'").run(
      params.id,
    );
    return { ok: true };
  });
  route("POST", "/api/admin/reset", ({ user, body }) => {
    admin(user);
    const target = activeUser(body.username);
    const raw = token();
    transaction(db, () => {
      db.prepare("DELETE FROM tokens WHERE kind='reset' AND user_id=?").run(
        target.id,
      );
      db.prepare(
        "INSERT INTO tokens(token_hash,kind,user_id,created_by,expires_at,created_at) VALUES(?,'reset',?,?,?,?)",
      ).run(digest(raw), target.id, user.id, Date.now() + 3600000, Date.now());
    });
    return { path: `/?reset=${raw}` };
  });
};
