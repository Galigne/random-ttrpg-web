const test = require("node:test");
const assert = require("node:assert/strict");
const { openDatabase } = require("../server/db");
const { createLive } = require("../server/live");
const rpg = require("../server/rpg");

test("presence counts tabs, chat expires after the last member leaves, and private events are filtered", () => {
  const db = openDatabase(":memory:");
  let time = Date.now();
  const live = createLive(db, { now: () => time, retention: 300000 });
  const addUser = (id, role = "user") => {
    db.prepare(
      "INSERT INTO users(id,username,password_hash,role,status,language,created_at) VALUES(?,?,?,?,'active','en',?)",
    ).run(id, id, "hash", role, time);
    db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
      `session-${id}`,
      id,
      "csrf",
      time + 86400000,
    );
  };
  addUser("owner");
  addUser("gm");
  addUser("player");
  addUser("admin", "admin");
  db.prepare(
    "INSERT INTO campaigns(id,name,description,language,owner_id,created_at) VALUES('c','Campaign','','en','owner',?)",
  ).run(time);
  for (const [id, role] of [
    ["owner", "member"],
    ["gm", "gm"],
    ["player", "member"],
    ["admin", "member"],
  ])
    db.prepare("INSERT INTO members VALUES(?,?,?)").run("c", id, role);
  const data = rpg.createEntity("character");
  db.prepare(
    "INSERT INTO entities(id,type,owner_id,data,version,created_at) VALUES(?,?,?,?,0,?)",
  ).run(data.key, "character", "owner", JSON.stringify(data), time);
  db.prepare("INSERT INTO assignments VALUES(?,?,'approved','private',?)").run(
    data.key,
    "c",
    time,
  );
  function client(id, tab, campaignId) {
    const lines = [];
    return {
      user: { id, username: id, role: "user" },
      session: `session-${id}`,
      tab,
      campaignId,
      lines,
      res: {
        writableEnded: false,
        write(line) {
          lines.push(line);
        },
        end() {
          this.writableEnded = true;
        },
      },
    };
  }
  const owner = client("owner", "owner-tab-123456", "c"),
    gm = client("gm", "gm-tab-12345678", "c"),
    player = client("player", "player-tab-12345", "c"),
    admin = client("admin", "admin-tab-123456", "c"),
    elsewhere = client("player", "elsewhere-tab-123", null);
  for (const c of [owner, gm, player, admin, elsewhere]) live.add(c);
  assert.equal(live.presence("c").player, "here");
  db.prepare(
    "INSERT INTO playing_characters(campaign_id,user_id,entity_id) VALUES(?,?,?)",
  ).run("c", "owner", data.key);
  player.lines.length = 0;
  live.entityChanged(data.key);
  assert.ok(!player.lines.some((line) => line.includes("event: entity")));
  live.playingChanged(data.key);
  assert.ok(player.lines.some((line) => line.includes("event: campaign")));
  assert.ok(!player.lines.some((line) => line.includes(data.key)));
  live.append("c", {
    type: "combat",
    entityIds: [data.key],
    entityName: "Secret",
  });
  assert.ok(owner.lines.some((line) => line.includes("Secret")));
  assert.ok(gm.lines.some((line) => line.includes("Secret")));
  assert.ok(!player.lines.some((line) => line.includes("Secret")));
  live.append("c", {
    type: "roll",
    privateRoll: true,
    rollerId: "player",
    result: { total: 7 },
  });
  assert.equal(live.history("c", { id: "owner", role: "user" }).length, 1);
  assert.equal(live.history("c", { id: "gm", role: "user" }).length, 2);
  assert.equal(live.history("c", { id: "player", role: "user" }).length, 1);
  assert.equal(live.history("c", { id: "admin", role: "admin" }).length, 1);
  assert.ok(!admin.lines.some((line) => line.includes('"privateRoll":true')));
  db.prepare(
    "UPDATE members SET role='gm' WHERE campaign_id='c' AND user_id='admin'",
  ).run();
  assert.equal(live.history("c", { id: "admin", role: "admin" }).length, 2);
  live.remove(admin);
  live.remove(player);
  assert.equal(live.presence("c").player, "online");
  live.remove(gm);
  live.remove(owner);
  time += 299999;
  assert.equal(live.history("c", { id: "gm", role: "user" }).length, 2);
  time += 1;
  assert.equal(live.history("c", { id: "gm", role: "user" }).length, 0);
  live.shutdown();
  db.close();
});

test("entity notifications respect the visibility of the subscribed campaign", () => {
  const db = openDatabase(":memory:");
  const now = Date.now();
  const live = createLive(db, { now: () => now });
  for (const user of ["owner", "viewer"]) {
    db.prepare("INSERT INTO users VALUES(?,?,?,'user','active','en',?)").run(
      user,
      user,
      "hash",
      now,
    );
  }
  db.prepare(
    "INSERT INTO sessions VALUES('viewer-session','viewer','csrf',?)",
  ).run(now + 86400000);
  for (const campaign of ["private", "shared"]) {
    db.prepare(
      "INSERT INTO campaigns(id,name,description,language,owner_id,created_at) VALUES(?,?,'','en','owner',?)",
    ).run(campaign, campaign, now);
    db.prepare("INSERT INTO members VALUES(?,'viewer','member')").run(campaign);
  }
  const entity = rpg.createEntity("character");
  db.prepare(
    "INSERT INTO entities(id,type,owner_id,data,version,created_at) VALUES(?,'character','owner',?,0,?)",
  ).run(entity.key, JSON.stringify(entity), now);
  for (const campaign of ["private", "shared"])
    db.prepare("INSERT INTO assignments VALUES(?,?,'approved',?,?)").run(
      entity.key,
      campaign,
      campaign,
      now,
    );
  const client = (campaignId) => ({
    user: { id: "viewer", username: "viewer", role: "user" },
    session: "viewer-session",
    tab: `tab-${campaignId || "personal"}`,
    campaignId,
    lines: [],
    res: {
      writableEnded: false,
      write(line) {
        this.owner.lines.push(line);
      },
      end() {},
    },
  });
  const personal = client(null),
    inPrivate = client("private"),
    inShared = client("shared");
  for (const c of [personal, inPrivate, inShared]) {
    c.res.owner = c;
    live.add(c);
    c.lines.length = 0;
  }
  live.entityChanged(entity.key);
  assert.ok(personal.lines.some((line) => line.includes("event: entity")));
  assert.ok(inShared.lines.some((line) => line.includes("event: entity")));
  assert.ok(!inPrivate.lines.some((line) => line.includes("event: entity")));
  live.shutdown();
  db.close();
});
test("locks expire from inactivity and a viewer never acquires one", () => {
  const db = openDatabase(":memory:");
  let now = Date.now();
  const live = createLive(db, { now: () => now });
  db.prepare(
    "INSERT INTO users VALUES('u','user','hash','user','active','en',?)",
  ).run(now);
  db.prepare("INSERT INTO sessions VALUES('s','u','csrf',?)").run(
    now + 86400000,
  );
  const client = {
    user: { id: "u", username: "user", role: "user" },
    session: "s",
    tab: "tab-123456789012",
    campaignId: null,
    res: { writableEnded: false, write() {}, end() {} },
  };
  live.add(client);
  assert.equal(live.getLock("entity"), null);
  assert.equal(live.acquire("entity", client.user, "s", client.tab), true);
  let released = false;
  live.onLockEnd((entityId) => {
    if (entityId === "entity") released = true;
  });
  now += 299999;
  assert.ok(live.getLock("entity"));
  now += 1;
  assert.equal(live.getLock("entity"), null);
  assert.equal(released, true);
  live.shutdown();
  db.close();
});

test("removing the last workspace member starts chat expiration even if their tab remains open", () => {
  const db = openDatabase(":memory:");
  let now = Date.now();
  const live = createLive(db, { now: () => now, retention: 300000 });
  db.prepare(
    "INSERT INTO users VALUES('u','user','hash','user','active','en',?)",
  ).run(now);
  db.prepare("INSERT INTO sessions VALUES('s','u','csrf',?)").run(
    now + 86400000,
  );
  db.prepare(
    "INSERT INTO campaigns(id,name,description,language,owner_id,created_at) VALUES('c','C','','en','u',?)",
  ).run(now);
  db.prepare("INSERT INTO members VALUES('c','u','member')").run();
  const client = {
    user: { id: "u", username: "user", role: "user" },
    session: "s",
    tab: "tab-123456789012",
    campaignId: "c",
    res: { writableEnded: false, write() {}, end() {} },
  };
  live.add(client);
  live.append("c", { type: "text", text: "temporary" });
  db.prepare("DELETE FROM members WHERE campaign_id='c' AND user_id='u'").run();
  live.membershipChanged("c");
  now += 300000;
  assert.equal(live.history("c", client.user).length, 0);
  live.shutdown();
  db.close();
});
