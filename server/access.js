function campaign(db, campaignId) {
  return db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId);
}
function membership(db, campaignId, userId) {
  return db
    .prepare("SELECT * FROM members WHERE campaign_id = ? AND user_id = ?")
    .get(campaignId, userId);
}
function isAdmin(user) {
  return user.role === "admin";
}
function canOpenCampaign(db, user, campaignId) {
  const c = db
    .prepare("SELECT owner_id FROM campaigns WHERE id=?")
    .get(campaignId);
  return Boolean(
    c &&
    (isAdmin(user) ||
      c.owner_id === user.id ||
      membership(db, campaignId, user.id)),
  );
}
function isGm(db, user, campaignId) {
  return isAdmin(user) || membership(db, campaignId, user.id)?.role === "gm";
}
function managesCampaign(db, user, campaignId) {
  const c = db
    .prepare("SELECT owner_id FROM campaigns WHERE id=?")
    .get(campaignId);
  return Boolean(c && (isAdmin(user) || c.owner_id === user.id));
}
function entity(db, entityId) {
  return db.prepare("SELECT * FROM entities WHERE id = ?").get(entityId);
}
function entityMetadata(db, entityId) {
  return db
    .prepare("SELECT id,type,owner_id FROM entities WHERE id=?")
    .get(entityId);
}
function canEdit(db, user, row) {
  if (!row) return false;
  if (isAdmin(user) || row.owner_id === user.id) return true;
  if (
    db
      .prepare(
        "SELECT 1 FROM entity_permissions WHERE entity_id=? AND user_id=? AND permission='editor'",
      )
      .get(row.id, user.id)
  )
    return true;
  return Boolean(
    db
      .prepare(
        "SELECT 1 FROM assignments a JOIN members m ON m.campaign_id=a.campaign_id WHERE a.entity_id=? AND a.state='approved' AND m.user_id=? AND m.role='gm' LIMIT 1",
      )
      .get(row.id, user.id),
  );
}
function canView(db, user, row) {
  if (!row) return false;
  if (canEdit(db, user, row)) return true;
  if (
    db
      .prepare(
        "SELECT 1 FROM entity_permissions WHERE entity_id=? AND user_id=?",
      )
      .get(row.id, user.id)
  )
    return true;
  return Boolean(
    db
      .prepare(
        "SELECT 1 FROM assignments a JOIN members m ON m.campaign_id=a.campaign_id WHERE a.entity_id=? AND a.state='approved' AND a.visibility='shared' AND m.user_id=? LIMIT 1",
      )
      .get(row.id, user.id),
  );
}
function canViewInCampaign(db, user, row, campaignId) {
  if (!row) return false;
  const assignment = db
    .prepare(
      "SELECT visibility FROM assignments WHERE entity_id=? AND campaign_id=? AND state='approved'",
    )
    .get(row.id, campaignId);
  if (!assignment) return false;
  if (isAdmin(user) || row.owner_id === user.id) return true;
  if (
    db
      .prepare(
        "SELECT 1 FROM entity_permissions WHERE entity_id=? AND user_id=?",
      )
      .get(row.id, user.id)
  )
    return true;
  const member = membership(db, campaignId, user.id);
  return Boolean(
    member && (member.role === "gm" || assignment.visibility === "shared"),
  );
}
function ownsEntity(user, row) {
  return Boolean(row && (isAdmin(user) || row.owner_id === user.id));
}
function pruneSelections(db, entityId) {
  const row = entityMetadata(db, entityId);
  const affected = new Set();
  const selections = db
    .prepare(
      `SELECT p.*, u.role, u.status FROM playing_characters p JOIN users u ON u.id=p.user_id WHERE p.entity_id=?`,
    )
    .all(entityId);
  for (const selection of selections) {
    const assigned = db
      .prepare(
        "SELECT 1 FROM assignments WHERE campaign_id=? AND entity_id=? AND state='approved'",
      )
      .get(selection.campaign_id, entityId);
    if (
      !assigned ||
      selection.status !== "active" ||
      !canEdit(db, { id: selection.user_id, role: selection.role }, row)
    ) {
      db.prepare(
        "DELETE FROM playing_characters WHERE campaign_id=? AND user_id=?",
      ).run(selection.campaign_id, selection.user_id);
      affected.add(selection.campaign_id);
    }
  }
  return [...affected];
}
module.exports = {
  campaign,
  membership,
  isAdmin,
  canOpenCampaign,
  isGm,
  managesCampaign,
  entity,
  entityMetadata,
  canEdit,
  canView,
  canViewInCampaign,
  ownsEntity,
  pruneSelections,
};
