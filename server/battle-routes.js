const access = require('./access');
const rpg = require('./rpg');
const { randomUUID } = require('node:crypto');

module.exports = (ctx) => {
  const { db, live, route, fail } = ctx;
  const assigned = (campaignId, entityId) => db.prepare("SELECT e.id,e.type,e.owner_id,e.data,e.version,(e.portrait IS NOT NULL) AS has_portrait,e.portrait_type FROM assignments a JOIN entities e ON e.id=a.entity_id WHERE a.campaign_id=? AND a.entity_id=? AND a.state='approved'").get(campaignId, entityId);
  const own = (campaignId, userId, entityId) => Boolean(db.prepare('SELECT 1 FROM playing_characters WHERE campaign_id=? AND user_id=? AND entity_id=?').get(campaignId, userId, entityId));
  function campaign(user, campaignId) {
    if (!access.canOpenCampaign(db, user, campaignId)) fail(404, 'CAMPAIGN_NOT_FOUND');
    if (!access.membership(db, campaignId, user.id) && !access.isAdmin(user)) fail(403, 'MEMBERS_ONLY');
  }
  function permitted(user, campaignId, entityId) {
    return access.isGm(db, user, campaignId) || (own(campaignId, user.id, entityId) && access.canEdit(db, user, access.entityMetadata(db, entityId)));
  }
  function clean(campaignId, battle, assignedIds) {
    if (!battle) return;
    const ids = assignedIds || new Set(db.prepare("SELECT entity_id FROM assignments WHERE campaign_id=? AND state='approved'").all(campaignId).map(row => row.entity_id));
    for (const group of battle.groups) group.entries = group.entries.filter(e => ids.has(e.entityId));
    battle.groups = battle.groups.filter(g => g.entries.length);
    battle.baseOrder = battle.baseOrder.filter(id => battle.groups.some(group => group.id === id));
    if (battle.index >= battle.groups.length) battle.index = 0;
  }
  function snapshot(campaignId, user) {
    const member = access.membership(db, campaignId, user.id);
    const gm = access.isAdmin(user) || member?.role === 'gm';
    const rows = db.prepare(`SELECT e.id,e.type,e.owner_id,e.data,a.visibility,
      ${access.sqlCanEdit()} AS can_edit,
      EXISTS(SELECT 1 FROM entity_permissions p WHERE p.entity_id=e.id AND p.user_id=@user) AS direct_access,
      EXISTS(SELECT 1 FROM playing_characters p WHERE p.campaign_id=@campaign AND p.user_id=@user AND p.entity_id=e.id) AS playing
      FROM assignments a JOIN entities e ON e.id=a.entity_id
      WHERE a.campaign_id=@campaign AND a.state='approved' ORDER BY e.created_at DESC`)
      .all({ campaign: campaignId, user: user.id, admin: Number(access.isAdmin(user)) });
    const indexed = new Map(rows.map(row => [row.id, row]));
    const control = row => Boolean(gm || (row.playing && row.can_edit));
    const visible = row => Boolean(control(row) || access.isAdmin(user) || row.owner_id === user.id || row.direct_access ||
      (member && (member.role === 'gm' || row.visibility === 'shared')));
    const battle = live.getBattle(campaignId);
    clean(campaignId, battle, new Set(indexed.keys()));
    return {
      targets: rows.filter(control).map(row => {
        const data = JSON.parse(row.data);
        return { id: row.id, name: rpg.displayName(row.type, data, user.language), resources: data.resources };
      }),
      battle: battle && { round: battle.round, groups: battle.groups.map((group, index) => ({
        active: index === battle.index,
        entries: group.entries.map(entry => {
          const row = indexed.get(entry.entityId);
          const canControl = control(row);
          return { token: entry.token, name: visible(row) ? rpg.displayName(row.type, JSON.parse(row.data), user.language) : null,
            finished: entry.finished, control: canControl, ...(canControl ? { entityId: row.id } : {}) };
        })
      })) }
    };
  }
  function changed(campaignId, battle) { live.setBattle(campaignId, battle); }
  function event(campaignId, user, action, row) {
    live.append(campaignId, { type: 'combat', identity: { username: user.username }, action,
      entityIds: row ? [row.id] : [], entityName: row ? rpg.displayName(row.type, JSON.parse(row.data), user.language) : '' });
  }
  function recover(row, user) {
    if (live.getLock(row.id)) fail(409, 'ENTITY_LOCKED');
    const result = rpg.combat(row.type, JSON.parse(row.data), 'end-turn', {});
    ctx.entities.publish(row, result.data, user, row.version);
  }
  function addCombatant(battle, row, side) {
    const speed = JSON.parse(row.data).statistics.speed;
    const entry = { token: randomUUID(), entityId: row.id, finished: false };
    let index = battle.groups.findIndex(g => !g.delayed && g.speed === speed && g.side === side);
    if (index >= 0) battle.groups[index].entries.push(entry);
    else {
      index = battle.groups.findIndex(g => g.speed < speed || (g.speed === speed && side === 'players' && g.side === 'enemies'));
      if (index < 0) index = battle.groups.length;
      if (battle.begun && battle.groups.length && index <= battle.index) battle.index++;
      const groupId = randomUUID();
      const nextId = battle.groups[index]?.id;
      const baseIndex = nextId ? battle.baseOrder.indexOf(nextId) : -1;
      battle.baseOrder.splice(baseIndex < 0 ? battle.baseOrder.length : baseIndex, 0, groupId);
      battle.groups.splice(index, 0, { id: groupId, speed, side, entries: [entry] });
    }
  }
  function advance(battle) {
    if (!battle.groups.length) { battle.index = 0; return; }
    battle.index++;
    if (battle.index >= battle.groups.length) {
      battle.index = 0; battle.round++;
      const merged = new Map();
      for (const group of battle.groups) {
        if (!merged.has(group.id)) merged.set(group.id, { ...group, delayed: false, entries: [] });
        merged.get(group.id).entries.push(...group.entries);
      }
      battle.groups = battle.baseOrder.map(id => merged.get(id)).filter(Boolean);
      for (const group of battle.groups) for (const entry of group.entries) { entry.finished = false; entry.recovered = false; }
    }
  }
  route('GET', '/api/campaigns/:id/battle', ({ user, params }) => { campaign(user, params.id); return snapshot(params.id, user); });
  route('POST', '/api/campaigns/:id/battle', ({ user, params, body }) => {
    const campaignId = params.id; campaign(user, campaignId);
    const gm = access.isGm(db, user, campaignId);
    let battle = live.getBattle(campaignId);
    clean(campaignId, battle);
    if (body.action === 'start') {
      if (!gm) fail(403, 'FORBIDDEN');
      if (battle) fail(409, 'INVALID_ACTION');
      battle = { round: 1, index: 0, groups: [], baseOrder: [], begun: false };
      const presence = live.presence(campaignId);
      const selections = db.prepare(`SELECT p.user_id, e.id,e.type,e.owner_id,e.data,e.version,(e.portrait IS NOT NULL) AS has_portrait,e.portrait_type, u.role FROM playing_characters p
        JOIN users u ON u.id=p.user_id AND u.status='active'
        JOIN entities e ON e.id=p.entity_id AND e.type='character'
        JOIN assignments a ON a.entity_id=e.id AND a.campaign_id=p.campaign_id AND a.state='approved'
        WHERE p.campaign_id=?`).all(campaignId);
      for (const row of selections) {
        if (presence[row.user_id] !== 'offline' && presence[row.user_id] &&
            access.canEdit(db, { id: row.user_id, role: row.role }, row))
          addCombatant(battle, row, 'players');
      }
      changed(campaignId, battle); event(campaignId, user, 'battleStarted');
      return { ok: true };
    }
    if (body.action === 'end') {
      if (!gm) fail(403, 'FORBIDDEN');
      if (!battle) fail(409, 'INVALID_ACTION');
      changed(campaignId, null); event(campaignId, user, 'battleEnded'); return { ok: true };
    }
    if (!battle) fail(409, 'INVALID_ACTION');
    let actionRow = null;
    if (body.action === 'add') {
      if (!gm) fail(403, 'FORBIDDEN');
      const row = assigned(campaignId, body.entityId);
      if (!row) fail(400, 'INVALID_ACTION');
      if (battle.groups.some(g => g.entries.some(e => e.entityId === row.id))) fail(409, 'INVALID_ACTION');
      addCombatant(battle, row, 'enemies');
    } else {
      const groupIndex = battle.groups.findIndex(g => g.entries.some(e => e.token === body.token));
      const group = battle.groups[groupIndex];
      const entry = group?.entries.find(e => e.token === body.token);
      const row = entry && assigned(campaignId, entry.entityId);
      actionRow = row;
      if (body.action === 'advance') {
        if (!gm) fail(403, 'FORBIDDEN');
        if (battle.groups.length) { battle.begun = true; advance(battle); }
      } else if (!entry || !row) fail(404, 'ENTITY_NOT_FOUND');
      else if (body.action === 'remove') {
        if (!gm) fail(403, 'FORBIDDEN');
        group.entries = group.entries.filter(e => e !== entry);
        if (!group.entries.length) { battle.groups.splice(groupIndex, 1); if (!battle.groups.some(g => g.id === group.id)) battle.baseOrder = battle.baseOrder.filter(id => id !== group.id); if (groupIndex < battle.index) battle.index--; if (battle.index >= battle.groups.length) battle.index = 0; }
        else if (groupIndex === battle.index && group.entries.every(e => e.finished)) advance(battle);
      } else if (body.action === 'finish') {
        if (!permitted(user, campaignId, row.id)) fail(403, 'FORBIDDEN');
        if (groupIndex !== battle.index || entry.finished) fail(409, 'INVALID_ACTION');
        if (!entry.recovered) { recover(row, user); entry.recovered = true; }
        battle.begun = true; entry.finished = true; event(campaignId, user, 'end-turn', row);
        if (group.entries.every(e => e.finished)) advance(battle);
      } else if (body.action === 'delay') {
        if (!permitted(user, campaignId, row.id)) fail(403, 'FORBIDDEN');
        if (groupIndex !== battle.index || entry.finished || groupIndex === battle.groups.length - 1) fail(409, 'INVALID_ACTION');
        battle.begun = true;
        group.entries = group.entries.filter(e => e !== entry);
        const delayed = { id: group.id, speed: group.speed, side: group.side, delayed: true, entries: [entry] };
        if (group.entries.length) { battle.groups.splice(groupIndex + 2, 0, delayed); if (group.entries.every(e => e.finished)) advance(battle); }
        else { battle.groups.splice(groupIndex, 1); battle.groups.splice(groupIndex + 1, 0, delayed); }
      } else if (body.action === 'move') {
        if (!gm || ![-1, 1].includes(body.direction)) fail(403, 'FORBIDDEN');
        const other = groupIndex + body.direction;
        if (other < 0 || other >= battle.groups.length) fail(400, 'INVALID_ACTION');
        [battle.groups[groupIndex], battle.groups[other]] = [battle.groups[other], battle.groups[groupIndex]];
        const first = battle.baseOrder.indexOf(group.id), second = battle.baseOrder.indexOf(battle.groups[groupIndex].id);
        if (first >= 0 && second >= 0) [battle.baseOrder[first], battle.baseOrder[second]] = [battle.baseOrder[second], battle.baseOrder[first]];
        if (battle.index === groupIndex) battle.index = other; else if (battle.index === other) battle.index = groupIndex;
      } else if (body.action === 'correct') {
        if (!gm) fail(403, 'FORBIDDEN');
        battle.index = groupIndex;
        for (const e of group.entries) e.finished = false;
      } else fail(400, 'INVALID_ACTION');
    }
    if (['add', 'remove', 'delay', 'correct', 'move'].includes(body.action)) {
      const changedRow = body.action === 'add' ? assigned(campaignId, body.entityId) : actionRow;
      if (changedRow) event(campaignId, user, body.action === 'delay' ? 'delayTurn' : body.action === 'correct' ? 'correctTurn' : body.action === 'add' ? 'addCombatant' : body.action === 'move' ? 'moveUp' : 'remove', changedRow);
    }
    if (body.action === 'advance') event(campaignId, user, 'advanceTurn');
    changed(campaignId, battle); return { ok: true };
  });
  route('POST', '/api/campaigns/:id/resources', ({ user, params, body }) => {
    campaign(user, params.id);
    const row = assigned(params.id, body.entityId);
    if (!row || !permitted(user, params.id, row.id)) fail(404, 'ENTITY_NOT_FOUND');
    if (!['damage', 'heal', 'restore', 'set'].includes(body.action)) fail(400, 'INVALID_ACTION');
    if (live.getLock(row.id)) fail(409, 'ENTITY_LOCKED');
    if (body.action === 'damage' && typeof body.piercing !== 'boolean') fail(400, 'INVALID_ACTION');
    const data = JSON.parse(row.data);
    let updated;
    if (body.action === 'set') {
      const fields = {};
      const keys = ['hp', 'ar', 'ap', 'md'];
      if (body.resourceKey !== undefined && !keys.includes(body.resourceKey)) fail(400, 'INVALID_ACTION');
      for (const key of keys) {
        const value = body.resourceKey === undefined ? body[key] : body.resourceKey === key ? body.value : String(data.resources[key].current);
        if (typeof value !== 'string' || !/^(?:\d+)(?:\.\d+)?$/.test(value)) fail(400, 'INVALID_ACTION');
        fields[`resources.${key}`] = `${value}:${data.resources[key].max}`;
      }
      updated = rpg.edit(row.type, data, 'resources', fields);
    } else updated = rpg.combat(row.type, data, body.action, body).data;
    ctx.entities.publish(row, updated, user, row.version);
    event(params.id, user, body.action, row);
    live.campaignChanged(params.id);
    return { ok: true };
  });
};
