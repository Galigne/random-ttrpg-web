const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { openDatabase } = require("../server/db");
const { createApplication } = require("../server/app");
const { hashPassword, id } = require("../server/security");

async function setup(t) {
  const db = openDatabase(":memory:");
  const password = "correct horse battery staple";
  const hash = await hashPassword(password);
  const users = {};
  for (const [name, role] of [
    ["Admin", "admin"],
    ["Alice", "user"],
    ["Bob", "user"],
    ["Gwen", "user"],
    ["Other", "user"],
  ]) {
    users[name] = id();
    db.prepare(
      "INSERT INTO users(id,username,password_hash,role,status,language,created_at) VALUES(?,?,?,?,'active','en',?)",
    ).run(users[name], name, hash, role, Date.now());
  }
  const app = createApplication(db);
  const server = http.createServer(app.handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const streams = [];
  t.after(async () => {
    app.live.shutdown();
    for (const { controller } of streams) controller.abort();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  async function request(client, path, method = "GET", body) {
    const headers = {};
    if (client?.cookie) headers.cookie = client.cookie;
    if (client?.csrf) headers["x-csrf-token"] = client.csrf;
    if (method !== "GET") headers["content-type"] = "application/json";
    const response = await fetch(base + path, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(body || {}),
    });
    const data = response.headers.get("content-type")?.startsWith("image/")
      ? Buffer.from(await response.arrayBuffer())
      : await response.json();
    return { status: response.status, data, headers: response.headers };
  }
  async function login(name) {
    const result = await request(null, "/api/login", "POST", {
      username: name,
      password,
    });
    assert.equal(result.status, 200);
    return {
      id: users[name],
      cookie: result.headers.get("set-cookie").split(";")[0],
      csrf: result.data.csrf,
      tab: `test-tab-${name}-12345678`,
    };
  }
  async function stream(client, campaign) {
    const controller = new AbortController();
    const response = await fetch(
      `${base}/api/events?tab=${client.tab}${campaign ? `&campaign=${campaign}` : ""}`,
      { headers: { cookie: client.cookie }, signal: controller.signal },
    );
    assert.equal(response.status, 200);
    // Keep the live response reachable for as long as the test holds its tab's editing lock.
    streams.push({ controller, response });
    return controller;
  }
  return { db, users, request, login, stream, live: app.live, base };
}

test("dice appearance belongs to the account and is snapshotted for campaign participants", async (t) => {
  const { request, login } = await setup(t);
  const alice = await login("Alice"), bob = await login("Bob");
  const defaults = { skin: "marble", glow: null };
  const custom = { skin: "lapis", glow: "#ff9900" };
  const save = (client, appearance) => request(client, "/api/dice/appearance", "POST", appearance);
  assert.equal((await save(null, custom)).status, 401);
  assert.equal((await save(alice, { skin: "constructor", glow: null })).status, 400);
  assert.equal((await save(alice, { skin: "iron", glow: "red" })).status, 400);
  assert.deepEqual((await save(alice, custom)).data.appearance, custom);
  const nextSession = await login("Alice");
  assert.deepEqual((await request(nextSession, "/api/me")).data.user.diceAppearance, custom);
  assert.deepEqual((await request(bob, "/api/me")).data.user.diceAppearance, defaults);
  const campaign = (await request(alice, "/api/campaigns", "POST", {
    name: "Dice table", language: "fr",
  })).data.id;
  await request(alice, `/api/campaigns/${campaign}/invite`, "POST", { username: "Bob" });
  await request(bob, `/api/campaign-invitations/${campaign}`, "POST", { action: "accept" });
  const roll = (client, options) => request(client, "/api/dice", "POST", {
    expression: "2d20+3", ...options,
  });
  assert.deepEqual((await roll(nextSession, { campaignId: campaign })).data.result.appearance, custom);
  await roll(alice, { campaignId: campaign, private: true });
  await save(alice, { skin: "iron", glow: null });
  assert.deepEqual((await roll(bob, { appearance: custom })).data.result.appearance, defaults);
  const visible = (await request(bob, `/api/campaigns/${campaign}`)).data.chat;
  assert.equal(visible.length, 1);
  assert.deepEqual(visible[0].result.appearance, custom);
});

test("registration requires approval or a single-use invitation; reset revokes sessions", async (t) => {
  const { request, login } = await setup(t);
  const admin = await login("Admin");
  let r = await request(null, "/api/register", "POST", {
    username: "PendingUser",
    password: "long enough password",
    language: "fr",
  });
  assert.equal(r.data.status, "pending");
  r = await request(null, "/api/login", "POST", {
    username: "PendingUser",
    password: "long enough password",
  });
  assert.equal(r.status, 401);
  const invitation = await request(admin, "/api/admin/invitations", "POST");
  const invite = new URL(invitation.data.path, "http://test").searchParams.get(
    "invite",
  );
  r = await request(null, "/api/register", "POST", {
    username: "InvitedUser",
    password: "long enough password",
    invite,
  });
  assert.equal(r.data.status, "active");
  r = await request(null, "/api/register", "POST", {
    username: "AnotherUser",
    password: "long enough password",
    invite,
  });
  assert.equal(r.status, 400);
  const reset = await request(admin, "/api/admin/reset", "POST", {
    username: "Alice",
  });
  const token = new URL(reset.data.path, "http://test").searchParams.get(
    "reset",
  );
  const alice = await login("Alice");
  r = await request(null, "/api/reset", "POST", {
    token,
    password: "another long password",
  });
  assert.equal(r.status, 200);
  r = await request(alice, "/api/entities");
  assert.equal(r.status, 401);
});

test("private entities, campaign roles, exclusive locks and shared undo are enforced", async (t) => {
  const { request, login, stream, users, db } = await setup(t);
  const alice = await login("Alice"),
    bob = await login("Bob"),
    gwen = await login("Gwen"),
    other = await login("Other"),
    admin = await login("Admin");
  const created = await request(alice, "/api/campaigns", "POST", {
    name: "The Tower",
    description: "",
    language: "en",
  });
  const campaign = created.data.id;
  for (const [name, client] of [
    ["Bob", bob],
    ["Gwen", gwen],
  ]) {
    assert.equal(
      (
        await request(alice, `/api/campaigns/${campaign}/invite`, "POST", {
          username: name,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(client, `/api/campaign-invitations/${campaign}`, "POST", {
          action: "accept",
        })
      ).status,
      200,
    );
  }
  assert.equal(
    (
      await request(
        alice,
        `/api/campaigns/${campaign}/members/${users.Gwen}`,
        "POST",
        { action: "promote" },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        gwen,
        `/api/campaigns/${campaign}/members/${users.Alice}`,
        "POST",
        { action: "demote" },
      )
    ).status,
    403,
  );
  const entity = (
    await request(alice, "/api/entities", "POST", { type: "character" })
  ).data.id;
  assert.equal((await request(other, `/api/entities/${entity}`)).status, 404);
  assert.equal((await request(gwen, `/api/entities/${entity}`)).status, 404);
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/assignments`, "POST", {
        campaignId: campaign,
        visibility: "private",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        gwen,
        `/api/campaigns/${campaign}/assignments/${entity}`,
        "POST",
        { action: "approve" },
      )
    ).status,
    200,
  );
  assert.equal((await request(gwen, `/api/entities/${entity}`)).status, 200);
  assert.equal((await request(bob, `/api/entities/${entity}`)).status, 404);
  assert.equal(
    (
      await request(
        alice,
        `/api/campaigns/${campaign}/playing/${alice.id}`,
        "POST",
        { entityId: entity },
      )
    ).status,
    200,
  );
  let workspace = await request(bob, `/api/campaigns/${campaign}`);
  assert.ok(workspace.data.members.find((m) => m.id === alice.id).playing);
  assert.equal(workspace.data.entities.length, 0);
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/permissions`, "POST", {
        username: "Bob",
        permission: "editor",
      })
    ).status,
    200,
  );
  await stream(alice, campaign);
  await stream(bob, campaign);
  await stream(admin);
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/lock`, "POST", {
        tab: alice.tab,
        action: "start",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(admin, `/api/entities/${entity}/lock`, "POST", {
        tab: admin.tab,
        action: "start",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(bob, `/api/entities/${entity}/combat`, "POST", {
        tab: bob.tab,
        version: 0,
        action: "end-turn",
      })
    ).status,
    409,
  );
  let r = await request(alice, `/api/entities/${entity}/edit`, "POST", {
    tab: alice.tab,
    version: 0,
    field: "name",
    value: { "name.firstName": "Elena", "name.lastName": "Stone" },
    campaignId: campaign,
  });
  assert.equal(r.status, 200);
  r = await request(alice, `/api/entities/${entity}/combat`, "POST", {
    tab: alice.tab,
    version: 1,
    action: "damage",
    amount: 10,
    piercing: false,
    campaignId: campaign,
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.entity.data.resources.hp.current, 90);
  r = await request(alice, `/api/entities/${entity}/undo`, "POST", {
    tab: alice.tab,
    action: "undo",
  });
  assert.equal(r.data.entity.data.resources.hp.current, 100);
  r = await request(alice, `/api/entities/${entity}/undo`, "POST", {
    tab: alice.tab,
    action: "undo",
  });
  assert.equal(r.data.entity.data.name.firstName, "");
  r = await request(alice, `/api/entities/${entity}/undo`, "POST", {
    tab: alice.tab,
    action: "redo",
  });
  assert.equal(r.data.entity.data.name.firstName, "Elena");
  r = await request(alice, `/api/entities/${entity}/undo`, "POST", {
    tab: alice.tab,
    action: "save",
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.entity.version, 3);
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/lock`, "POST", {
        tab: alice.tab,
        action: "finish",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(bob, `/api/entities/${entity}/lock`, "POST", {
        tab: bob.tab,
        action: "start",
      })
    ).status,
    200,
  );
  r = await request(bob, `/api/entities/${entity}/undo`, "POST", {
    tab: bob.tab,
    action: "undo",
  });
  assert.equal(r.data.entity.data.resources.hp.current, 90);
  assert.equal(
    (
      await request(bob, `/api/entities/${entity}`, "DELETE", {
        confirm: "Elena Stone",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}`, "DELETE", {
        confirm: "Elena Stone",
        tab: alice.tab,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(admin, `/api/entities/${entity}`, "DELETE", {
        confirm: "Elena Stone",
        tab: admin.tab,
      })
    ).status,
    409,
  );
  const chat = await request(other, `/api/campaigns/${campaign}`);
  assert.equal(chat.status, 404);
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM entities WHERE id=?").get(entity).n,
    1,
  );
});

test("only the owner can customize or save a generated preview and failed edits are atomic", async (t) => {
  const { request, login, db } = await setup(t);
  const alice = await login("Alice"), bob = await login("Bob");
  const create = { type: "character", language: "fr", level: 4 };
  const first = (await request(alice, "/api/entity-previews", "POST", create)).data;
  const second = (await request(alice, "/api/entity-previews", "POST", { ...create, replace: first.previewId })).data;
  assert.notEqual(first.data.key, second.data.key);
  assert.equal((await request(alice, `/api/entity-previews/${first.previewId}/save`, "POST")).status, 404);
  const base = `/api/entity-previews/${second.previewId}`;
  const choice = { key: "root.character.race", value: "human", revision: 0 };
  assert.equal((await request(bob, base + "/options?key=" + choice.key)).status, 404);
  assert.equal((await request(bob, base + "/choice", "POST", choice)).status, 404);
  assert.equal((await request(bob, base + "/save", "POST")).status, 404);
  const options = (await request(alice, base + "/options?key=" + choice.key)).data.options;
  assert.ok(options.some(item => item.id === "human"));
  assert.equal((await request(alice, base + "/choice", "POST", { ...choice, value: "arbitrary text" })).status, 400);
  assert.equal((await request(alice, base + "/choice", "POST", { ...choice, key: "__proto__" })).status, 400);
  const changed = await request(alice, base + "/choice", "POST", choice);
  assert.equal(changed.status, 200);
  assert.equal(changed.data.revision, 1);
  assert.equal(changed.data.data.race.name, options.find(item => item.id === "human").name);
  assert.equal((await request(alice, base + "/choice", "POST", choice)).status, 409);
  assert.equal((await request(alice, base + "/save", "POST", { revision: 0 })).status, 409);
  assert.equal(db.prepare("SELECT count(*) AS n FROM entities").get().n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM entity_history").get().n, 0);
  const saved = await request(alice, base + "/save", "POST", { revision: 1, data: { name: "ignored" } });
  assert.equal(saved.status, 200);
  assert.deepEqual((await request(alice, "/api/entities/" + saved.data.id)).data.data, changed.data.data);
  assert.equal(db.prepare("SELECT count(*) AS n FROM entity_history").get().n, 1);
  assert.equal((await request(alice, base + "/save", "POST")).status, 404);
});

test("preview profile choices enforce the current archetype and save authoritative results", async (t) => {
  const { request, login } = await setup(t);
  const alice = await login("Alice"), bob = await login("Bob");
  const created = await request(alice, "/api/entity-previews", "POST", {
    type: "creature", language: "fr", level: 1, path: "monster:bell_wraith",
  });
  const base = `/api/entity-previews/${created.data.previewId}`;
  const options = await request(alice, base + "/options?key=statProfile");
  assert.deepEqual(options.data.options.map(item => item.id), ["creature-caster", "creature-brute", "creature-elemental"]);
  assert.equal(options.data.options[1].name, "Brute");
  assert.equal((await request(bob, base + "/options?key=statProfile")).status, 404);
  assert.equal((await request(alice, base + "/choice", "POST", {
    revision: 0, key: "statProfile", value: "character-mage",
  })).status, 400);
  const changed = await request(alice, base + "/choice", "POST", {
    revision: 0, key: "statProfile", value: "creature-brute",
  });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.data.source.statProfileId, "creature-brute");
  assert.deepEqual(changed.data.data.rules, created.data.data.rules);
  const saved = await request(alice, base + "/save", "POST", { revision: 1 });
  assert.deepEqual((await request(alice, `/api/entities/${saved.data.id}`)).data.data, changed.data.data);
});

test("preview is not persisted and campaign deletion preserves shared entities and other assignments", async (t) => {
  const { request, login, users, db, live } = await setup(t);
  const alice = await login("Alice"),
    bob = await login("Bob");
  const preview = await request(alice, "/api/entity-previews", "POST", {
    type: "character",
    language: "fr",
    level: 2,
  });
  assert.equal(preview.status, 200);
  assert.equal(db.prepare("SELECT count(*) AS n FROM entities").get().n, 0);
  const saved = await request(
    alice,
    `/api/entity-previews/${preview.data.previewId}/save`,
    "POST",
  );
  const entity = saved.data.id;
  assert.equal(
    (
      await request(
        alice,
        `/api/entity-previews/${preview.data.previewId}/save`,
        "POST",
      )
    ).status,
    404,
  );
  const first = (
    await request(alice, "/api/campaigns", "POST", {
      name: "First",
      description: "",
      language: "en",
    })
  ).data.id;
  const second = (
    await request(alice, "/api/campaigns", "POST", {
      name: "Second",
      description: "",
      language: "fr",
    })
  ).data.id;
  for (const campaign of [first, second]) {
    assert.equal(
      (
        await request(alice, `/api/entities/${entity}/assignments`, "POST", {
          campaignId: campaign,
          visibility: "private",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          alice,
          `/api/campaigns/${campaign}/assignments/${entity}`,
          "POST",
          { action: "approve" },
        )
      ).status,
      200,
    );
  }
  await request(alice, `/api/campaigns/${second}/invite`, "POST", {
    username: "Bob",
  });
  await request(bob, `/api/campaign-invitations/${second}`, "POST", {
    action: "accept",
  });
  await request(alice, `/api/entities/${entity}/permissions`, "POST", {
    username: "Bob",
    permission: "editor",
  });
  assert.equal(
    (
      await request(
        bob,
        `/api/campaigns/${second}/playing/${users.Bob}`,
        "POST",
        { entityId: entity },
      )
    ).status,
    200,
  );
  const notified = [];
  const previousCampaignChanged = live.campaignChanged;
  live.campaignChanged = (id) => {
    notified.push(id);
    previousCampaignChanged(id);
  };
  await request(alice, `/api/entities/${entity}/permissions`, "POST", {
    username: "Bob",
    permission: null,
  });
  assert.ok(notified.includes(second));
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM playing_characters WHERE campaign_id=? AND user_id=?",
      )
      .get(second, bob.id).n,
    0,
  );
  assert.equal(
    (
      await request(alice, `/api/campaigns/${first}`, "DELETE", {
        confirm: "First",
      })
    ).status,
    200,
  );
  assert.equal((await request(alice, `/api/entities/${entity}`)).status, 200);
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM assignments WHERE campaign_id=? AND entity_id=? AND state='approved'",
      )
      .get(second, entity).n,
    1,
  );
});

test("portrait changes participate in undo previews and history is private to authorized editors", async (t) => {
  const { request, login, stream, db } = await setup(t);
  const alice = await login("Alice"),
    other = await login("Other");
  const entity = (
    await request(alice, "/api/entities", "POST", { type: "creature" })
  ).data.id;
  await stream(alice);
  await request(alice, `/api/entities/${entity}/lock`, "POST", {
    tab: alice.tab,
    action: "start",
  });
  const image =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7y8AAAAASUVORK5CYII=";
  let r = await request(alice, `/api/entities/${entity}/portrait`, "POST", {
    tab: alice.tab,
    version: 0,
    image,
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.entity.version, 1);
  r = await request(alice, `/api/entities/${entity}/combat`, "POST", {
    tab: alice.tab,
    version: 1,
    action: "damage",
    amount: 1,
    piercing: false,
  });
  assert.equal(r.status, 200);
  r = await request(alice, `/api/entities/${entity}/undo`, "POST", {
    tab: alice.tab,
    action: "undo",
  });
  assert.equal(r.data.entity.portrait, true);
  const imagePath = `/api/entities/${entity}/portrait?preview=1&tab=${alice.tab}`;
  r = await request(alice, imagePath);
  assert.equal(r.status, 200);
  assert.ok(Buffer.isBuffer(r.data));
  assert.equal((await request(other, imagePath)).status, 404);
  r = await request(alice, `/api/entities/${entity}/undo`, "POST", {
    tab: alice.tab,
    action: "undo",
  });
  assert.equal(r.data.entity.portrait, false);
  r = await request(alice, `/api/entities/${entity}/undo`, "POST", {
    tab: alice.tab,
    action: "save",
  });
  assert.equal(r.data.entity.portrait, false);
  assert.equal(r.data.entity.version, 3);
  r = await request(alice, `/api/entities/${entity}/undo`, "POST", {
    tab: alice.tab,
    action: "undo",
  });
  assert.equal(r.data.entity.portrait, true);
  await request(alice, `/api/entities/${entity}/undo`, "POST", {
    tab: alice.tab,
    action: "cancel",
  });
  await request(alice, `/api/entities/${entity}/lock`, "POST", {
    tab: alice.tab,
    action: "finish",
  });
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}`, "DELETE", {
        confirm: "Unnamed creature",
        tab: alice.tab,
      })
    ).status,
    200,
  );
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM entity_images WHERE entity_id=?")
      .get(entity).n,
    0,
  );
});

test("playing-character portrait preview is the only private-sheet exception", async (t) => {
  const { request, login, stream, live } = await setup(t);
  const alice = await login("Alice"),
    bob = await login("Bob");
  const campaign = (
    await request(alice, "/api/campaigns", "POST", {
      name: "Private",
      description: "",
      language: "en",
    })
  ).data.id;
  await request(alice, `/api/campaigns/${campaign}/invite`, "POST", {
    username: "Bob",
  });
  await request(bob, `/api/campaign-invitations/${campaign}`, "POST", {
    action: "accept",
  });
  const entity = (
    await request(alice, "/api/entities", "POST", { type: "character" })
  ).data.id;
  await request(alice, `/api/entities/${entity}/assignments`, "POST", {
    campaignId: campaign,
    visibility: "private",
  });
  await request(
    alice,
    `/api/campaigns/${campaign}/assignments/${entity}`,
    "POST",
    { action: "approve" },
  );
  await stream(alice, campaign);
  await request(alice, `/api/entities/${entity}/lock`, "POST", {
    tab: alice.tab,
    action: "start",
  });
  const image =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7y8AAAAASUVORK5CYII=";
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/portrait`, "POST", {
        tab: alice.tab,
        version: 0,
        image,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/combat`, "POST", {
        tab: alice.tab,
        version: 1,
        action: "damage",
        amount: 1,
        piercing: false,
        campaignId: campaign,
      })
    ).status,
    200,
  );
  await request(
    alice,
    `/api/campaigns/${campaign}/playing/${alice.id}`,
    "POST",
    { entityId: entity },
  );
  let summaries = 0;
  const previousPlayingChanged = live.playingChanged;
  live.playingChanged = (id) => {
    summaries++;
    previousPlayingChanged(id);
  };
  const sheet = (await request(alice, `/api/entities/${entity}`)).data;
  const gear = sheet.sections.find((section) => section.id === "gear").value;
  gear["gear.inventory"] = "Rope";
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/edit`, "POST", {
        tab: alice.tab,
        version: 2,
        field: "gear",
        value: gear,
        campaignId: campaign,
      })
    ).status,
    200,
  );
  assert.equal(summaries, 0);
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/edit`, "POST", {
        tab: alice.tab,
        version: 3,
        field: "name",
        value: { "name.firstName": "Elena", "name.lastName": "Stone" },
        campaignId: campaign,
      })
    ).status,
    200,
  );
  assert.equal(summaries, 1);
  assert.equal((await request(bob, `/api/entities/${entity}`)).status, 404);
  assert.equal(
    (await request(bob, `/api/entities/${entity}/portrait`)).status,
    404,
  );
  assert.equal(
    (
      await request(
        bob,
        `/api/entities/${entity}/portrait?previewCampaign=${campaign}`,
      )
    ).status,
    200,
  );
  assert.equal(
    (await request(bob, `/api/campaigns/${campaign}`)).data.chat.length,
    0,
  );
  await request(
    alice,
    `/api/campaigns/${campaign}/playing/${alice.id}`,
    "POST",
    { entityId: null },
  );
  assert.equal(
    (
      await request(
        bob,
        `/api/entities/${entity}/portrait?previewCampaign=${campaign}`,
      )
    ).status,
    404,
  );
});

test("simultaneous edits serialize and undo rejects a newer saved version", async (t) => {
  const { request, login, stream, db } = await setup(t);
  const alice = await login("Alice");
  const entity = (
    await request(alice, "/api/entities", "POST", { type: "character" })
  ).data.id;
  await stream(alice);
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/lock`, "POST", {
        action: "start",
        tab: alice.tab,
      })
    ).status,
    200,
  );
  const edits = await Promise.all(
    ["One", "Two", "Three", "Four"].map((name) =>
      request(alice, `/api/entities/${entity}/edit`, "POST", {
        tab: alice.tab,
        version: 0,
        field: "name",
        value: { "name.firstName": name, "name.lastName": "" },
      }),
    ),
  );
  assert.equal(edits.filter((result) => result.status === 200).length, 1);
  assert.equal(edits.filter((result) => result.status === 409).length, 3);
  assert.equal(
    db
      .prepare("SELECT count(*) AS n FROM entity_history WHERE entity_id=?")
      .get(entity).n,
    2,
  );
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/undo`, "POST", {
        tab: alice.tab,
        action: "undo",
      })
    ).data.preview,
    true,
  );
  const row = db.prepare("SELECT data FROM entities WHERE id=?").get(entity);
  const newer = JSON.parse(row.data);
  newer.name.firstName = "Newer";
  db.prepare("UPDATE entities SET data=?,version=version+1 WHERE id=?").run(
    JSON.stringify(newer),
    entity,
  );
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/undo`, "POST", {
        tab: alice.tab,
        action: "save",
      })
    ).status,
    409,
  );
  assert.equal(
    JSON.parse(
      db.prepare("SELECT data FROM entities WHERE id=?").get(entity).data,
    ).name.firstName,
    "Newer",
  );
});

test("an owner who leaves retains administration without gaining members-only private previews or chat", async (t) => {
  const { request, login } = await setup(t);
  const alice = await login("Alice"),
    bob = await login("Bob");
  const campaign = (
    await request(alice, "/api/campaigns", "POST", {
      name: "Campaign",
      description: "",
      language: "en",
    })
  ).data.id;
  await request(alice, `/api/campaigns/${campaign}/invite`, "POST", {
    username: "Bob",
  });
  await request(bob, `/api/campaign-invitations/${campaign}`, "POST", {
    action: "accept",
  });
  const character = (
    await request(bob, "/api/entities", "POST", { type: "character" })
  ).data.id;
  await request(bob, `/api/entities/${character}/assignments`, "POST", {
    campaignId: campaign,
    visibility: "private",
  });
  await request(
    alice,
    `/api/campaigns/${campaign}/assignments/${character}`,
    "POST",
    { action: "approve" },
  );
  await request(bob, `/api/campaigns/${campaign}/playing/${bob.id}`, "POST", {
    entityId: character,
  });
  await request(bob, `/api/campaigns/${campaign}/chat`, "POST", {
    text: "A private session",
  });
  await request(
    alice,
    `/api/campaigns/${campaign}/members/${alice.id}`,
    "POST",
    { action: "remove" },
  );
  const view = await request(alice, `/api/campaigns/${campaign}`);
  assert.equal(view.status, 200);
  assert.equal(view.data.manage, true);
  assert.equal(
    view.data.members.find((entry) => entry.id === bob.id).playing,
    null,
  );
  assert.deepEqual(view.data.entities, []);
  assert.deepEqual(view.data.chat, []);
  assert.equal(
    (
      await request(alice, `/api/campaigns/${campaign}/chat`, "POST", {
        text: "Not a member",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        alice,
        `/api/campaigns/${campaign}/members/${bob.id}`,
        "POST",
        { action: "promote" },
      )
    ).status,
    200,
  );
});

test("sharing in one campaign never exposes a private assignment or combat event in another", async (t) => {
  const { request, login, stream } = await setup(t);
  const alice = await login("Alice"),
    bob = await login("Bob");
  const first = (
    await request(alice, "/api/campaigns", "POST", {
      name: "Hidden",
      description: "",
      language: "en",
    })
  ).data.id;
  const second = (
    await request(alice, "/api/campaigns", "POST", {
      name: "Shared",
      description: "",
      language: "en",
    })
  ).data.id;
  for (const campaign of [first, second]) {
    await request(alice, `/api/campaigns/${campaign}/invite`, "POST", {
      username: "Bob",
    });
    await request(bob, `/api/campaign-invitations/${campaign}`, "POST", {
      action: "accept",
    });
  }
  const entity = (
    await request(alice, "/api/entities", "POST", { type: "character" })
  ).data.id;
  for (const [campaign, visibility] of [
    [first, "private"],
    [second, "shared"],
  ]) {
    await request(alice, `/api/entities/${entity}/assignments`, "POST", {
      campaignId: campaign,
      visibility,
    });
    await request(
      alice,
      `/api/campaigns/${campaign}/assignments/${entity}`,
      "POST",
      { action: "approve" },
    );
  }
  assert.equal((await request(bob, `/api/entities/${entity}`)).status, 200);
  assert.equal(
    (await request(bob, `/api/entities/${entity}?campaign=${first}`)).status,
    404,
  );
  assert.equal(
    (await request(bob, `/api/entities/${entity}?campaign=${second}`)).status,
    200,
  );
  assert.equal(
    (await request(bob, `/api/campaigns/${first}`)).data.entities.length,
    0,
  );
  assert.equal(
    (
      await request(
        bob,
        `/api/campaigns/${first}/assignments/${entity}`,
        "POST",
        { action: "remove" },
      )
    ).status,
    404,
  );
  assert.equal(
    (await request(bob, `/api/campaigns/${second}`)).data.entities.length,
    1,
  );
  await stream(alice, first);
  await request(alice, `/api/entities/${entity}/lock`, "POST", {
    tab: alice.tab,
    action: "start",
  });
  assert.equal(
    (
      await request(alice, `/api/entities/${entity}/combat`, "POST", {
        tab: alice.tab,
        version: 0,
        action: "damage",
        amount: 5,
        piercing: false,
        campaignId: first,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(bob, `/api/campaigns/${first}`)).data.chat.length,
    0,
  );
  assert.equal(
    (await request(bob, `/api/campaigns/${second}`)).data.chat.length,
    0,
  );
  await request(alice, `/api/entities/${entity}/permissions`, "POST", {
    username: "Bob",
    permission: "viewer",
  });
  assert.equal(
    (await request(bob, `/api/campaigns/${first}`)).data.entities.length,
    1,
  );
  assert.equal(
    (await request(bob, `/api/campaigns/${first}`)).data.chat.length,
    1,
  );
});

test("playing selections survive visibility changes while global control remains authorized", async (t) => {
  const { request, login, db } = await setup(t);
  const alice = await login("Alice"),
    bob = await login("Bob");
  const first = (
    await request(alice, "/api/campaigns", "POST", {
      name: "First",
      description: "",
      language: "en",
    })
  ).data.id;
  const second = (
    await request(alice, "/api/campaigns", "POST", {
      name: "Second",
      description: "",
      language: "en",
    })
  ).data.id;
  for (const campaign of [first, second]) {
    await request(alice, `/api/campaigns/${campaign}/invite`, "POST", {
      username: "Bob",
    });
    await request(bob, `/api/campaign-invitations/${campaign}`, "POST", {
      action: "accept",
    });
  }
  await request(alice, `/api/campaigns/${second}/members/${bob.id}`, "POST", {
    action: "promote",
  });
  const entity = (
    await request(alice, "/api/entities", "POST", { type: "character" })
  ).data.id;
  for (const [campaign, visibility] of [
    [first, "shared"],
    [second, "private"],
  ]) {
    await request(alice, `/api/entities/${entity}/assignments`, "POST", {
      campaignId: campaign,
      visibility,
    });
    await request(
      alice,
      `/api/campaigns/${campaign}/assignments/${entity}`,
      "POST",
      { action: "approve" },
    );
  }
  assert.equal(
    (
      await request(bob, `/api/campaigns/${first}/playing/${bob.id}`, "POST", {
        entityId: entity,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        alice,
        `/api/campaigns/${first}/assignments/${entity}`,
        "POST",
        { action: "visibility", visibility: "private" },
      )
    ).status,
    200,
  );
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM playing_characters WHERE campaign_id=? AND user_id=?",
      )
      .get(first, bob.id).n,
    1,
  );
  assert.equal((await request(bob, `/api/entities/${entity}`)).status, 200);
  assert.equal(
    (await request(bob, `/api/entities/${entity}?campaign=${first}`)).status,
    404,
  );
  const firstCampaign = (await request(bob, `/api/campaigns/${first}`)).data;
  assert.equal(firstCampaign.entities.length, 0);
  assert.equal(
    firstCampaign.members.find((member) => member.id === bob.id).playing.id,
    entity,
  );
  assert.equal(
    (
      await request(bob, `/api/campaigns/${first}/playing/${bob.id}`, "POST", {
        entityId: null,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(bob, `/api/campaigns/${first}/playing/${bob.id}`, "POST", {
        entityId: entity,
      })
    ).status,
    200,
  );
  await request(alice, `/api/campaigns/${second}/members/${bob.id}`, "POST", {
    action: "demote",
  });
  assert.equal(
    db
      .prepare(
        "SELECT count(*) AS n FROM playing_characters WHERE campaign_id=? AND user_id=?",
      )
      .get(first, bob.id).n,
    0,
  );
});

test("an entity owner can request assignment using a campaign link without being a member", async (t) => {
  const { request, login } = await setup(t);
  const alice = await login("Alice"),
    bob = await login("Bob");
  const campaign = (
    await request(alice, "/api/campaigns", "POST", {
      name: "Invitation-only",
      description: "",
      language: "en",
    })
  ).data.id;
  const entity = (
    await request(bob, "/api/entities", "POST", { type: "creature" })
  ).data.id;
  assert.equal((await request(bob, `/api/campaigns/${campaign}`)).status, 404);
  assert.equal(
    (
      await request(bob, `/api/entities/${entity}/assignments`, "POST", {
        campaignId: campaign,
        visibility: "private",
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(alice, `/api/campaigns/${campaign}`)).data.pending.length,
    1,
  );
  assert.equal(
    (
      await request(
        alice,
        `/api/campaigns/${campaign}/assignments/${entity}`,
        "POST",
        { action: "approve" },
      )
    ).status,
    200,
  );
  assert.equal((await request(bob, `/api/campaigns/${campaign}`)).status, 404);
  assert.equal(
    (await request(bob, `/api/entities/${entity}`)).data.assignments[0].state,
    "approved",
  );
});

test("mutations require a session, CSRF token, same origin, and authorized subscriptions", async (t) => {
  const { request, login, base } = await setup(t);
  const alice = await login("Alice"),
    bob = await login("Bob");
  const campaign = (
    await request(alice, "/api/campaigns", "POST", {
      name: "Secure",
      description: "",
      language: "en",
    })
  ).data.id;
  assert.equal((await request(null, "/api/entities")).status, 401);
  assert.equal(
    (await request(bob, `/api/events?tab=${bob.tab}&campaign=${campaign}`))
      .status,
    404,
  );
  const body = JSON.stringify({
    name: "Unwanted",
    description: "",
    language: "en",
  });
  let response = await fetch(base + "/api/campaigns", {
    method: "POST",
    headers: { cookie: alice.cookie, "content-type": "application/json" },
    body,
  });
  assert.equal(response.status, 403);
  response = await fetch(base + "/api/campaigns", {
    method: "POST",
    headers: {
      cookie: alice.cookie,
      "content-type": "application/json",
      "x-csrf-token": alice.csrf,
      origin: "https://untrusted.example",
    },
    body,
  });
  assert.equal(response.status, 403);
});
