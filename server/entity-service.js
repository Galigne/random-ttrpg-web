const { createHash } = require("node:crypto");
const { transaction } = require("./db");
const rpg = require("./rpg");

// All website entity writes share validation, history and live notifications.
function createEntityService(db, live, fail) {
  function insert(user, type, data) {
    rpg.hydrate(type, data);
    transaction(db, () => {
      const json = JSON.stringify(data);
      db.prepare("INSERT INTO entities(id,type,owner_id,data,version,created_at) VALUES(?,?,?,?,0,?)")
        .run(data.key, type, user.id, json, Date.now());
      db.prepare("INSERT INTO entity_history(entity_id,version,data,created_at,actor_id) VALUES(?,0,?,?,?)")
        .run(data.key, json, Date.now(), user.id);
    });
    return data.key;
  }

  // An omitted image retains the portrait without reading or rewriting the BLOB.
  function publish(row, data, user, expectedVersion, image) {
    rpg.hydrate(row.type, data);
    const previous = JSON.parse(row.data);
    const summary = value => JSON.stringify({
      name: value.name, level: value.level,
      description: value.background?.physicalDescription, resources: value.resources,
    });
    let portraitChanged = false;
    transaction(db, () => {
      let imageHash;
      if (image === undefined) {
        imageHash = db.prepare("SELECT portrait_hash FROM entity_history WHERE entity_id=? AND version=?")
          .get(row.id, expectedVersion)?.portrait_hash || null;
        // Older databases can contain portraits before history deduplication was introduced.
        if (!imageHash && row.has_portrait) {
          const old = db.prepare("SELECT portrait,portrait_type FROM entities WHERE id=?").get(row.id);
          imageHash = storeImage(row.id, old.portrait, old.portrait_type);
        }
        const result = db.prepare("UPDATE entities SET data=?,version=version+1 WHERE id=? AND version=?")
          .run(JSON.stringify(data), row.id, expectedVersion);
        if (!result.changes) fail(409, "VERSION_CONFLICT");
      } else {
        const old = db.prepare("SELECT portrait,portrait_type FROM entities WHERE id=?").get(row.id);
        const oldBytes = old?.portrait ? Buffer.from(old.portrait) : null;
        const newBytes = image?.bytes ? Buffer.from(image.bytes) : null;
        portraitChanged = Boolean(oldBytes) !== Boolean(newBytes) ||
          Boolean(oldBytes && newBytes && !oldBytes.equals(newBytes)) ||
          (old?.portrait_type || null) !== (image?.mime || null);
        const result = db.prepare("UPDATE entities SET data=?,portrait=?,portrait_type=?,version=version+1 WHERE id=? AND version=?")
          .run(JSON.stringify(data), image?.bytes || null, image?.mime || null, row.id, expectedVersion);
        if (!result.changes) fail(409, "VERSION_CONFLICT");
        imageHash = image?.bytes ? storeImage(row.id, image.bytes, image.mime) : null;
      }
      db.prepare("INSERT INTO entity_history(entity_id,version,data,created_at,actor_id,portrait_hash) VALUES(?,?,?,?,?,?)")
        .run(row.id, expectedVersion + 1, JSON.stringify(data), Date.now(), user.id, imageHash);
    });
    live.entityChanged(row.id);
    if (row.type === "character" && (summary(previous) !== summary(data) || portraitChanged))
      live.playingChanged(row.id);
  }
  function storeImage(entityId, bytes, mime) {
    const hash = createHash("sha256").update(mime).update(bytes).digest("hex");
    db.prepare("INSERT OR IGNORE INTO entity_images(entity_id,hash,image,mime) VALUES(?,?,?,?)")
      .run(entityId, hash, bytes, mime);
    return hash;
  }
  return { insert, publish };
}
module.exports = { createEntityService };
