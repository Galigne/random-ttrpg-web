const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { openDatabase } = require('../server/db');
const { createApplication } = require('../server/app');
const { digest } = require('../server/security');
const access = require('../server/access');
const rpg = require('../server/rpg');

test('bulk permission predicates agree with individual checks across roles and sharing', () => {
  const db = openDatabase(':memory:');
  try {
    for (const id of ['owner', 'editor', 'viewer', 'member', 'gm', 'outsider', 'admin'])
      db.prepare('INSERT INTO users VALUES(?,?,?, ?,\'active\',\'en\',1)').run(id, id, 'hash', id === 'admin' ? 'admin' : 'user');
    db.prepare("INSERT INTO campaigns(id,name,language,owner_id,created_at) VALUES('c','Campaign','en','owner',1)").run();
    for (const [id, role] of [['member','member'],['gm','gm']])
      db.prepare("INSERT INTO members VALUES('c',?,?)").run(id, role);
    for (const [id, visibility, assignment] of [['private','private','approved'],['shared','shared','approved'],['pending','shared','pending'],['unassigned',null,null]]) {
      db.prepare("INSERT INTO entities(id,type,owner_id,data,created_at) VALUES(?,'character','owner','{}',1)").run(id);
      if (assignment) db.prepare("INSERT INTO assignments VALUES(?,'c',?,?,1)").run(id,assignment,visibility);
    }
    db.prepare("INSERT INTO entity_permissions VALUES('private','editor','editor')").run();
    db.prepare("INSERT INTO entity_permissions VALUES('private','viewer','viewer')").run();
    const query = db.prepare(`SELECT e.id, ${access.sqlCanView()} AS view, ${access.sqlCanEdit()} AS edit FROM entities e`);
    for (const id of ['owner', 'editor', 'viewer', 'member', 'gm', 'outsider', 'admin']) {
      const user = { id, role: id === 'admin' ? 'admin' : 'user' };
      for (const row of query.all({ user: id, admin: Number(id === 'admin') })) {
        const entity = access.entityMetadata(db,row.id);
        assert.equal(Boolean(row.view), access.canView(db,user,entity), `${id}/${row.id} view`);
        assert.equal(Boolean(row.edit), access.canEdit(db,user,entity), `${id}/${row.id} edit`);
      }
    }
  } finally { db.close(); }
});

test('library and battle snapshots avoid per-entity queries and image blobs', async t => {
  const db = openDatabase(':memory:');
  for (const id of ['viewer','other']) db.prepare("INSERT INTO users VALUES(?,?,?,'user','active','en',1)").run(id,id,'hash');
  const raw = 'a'.repeat(43);
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(raw),'viewer','csrf',Date.now()+60000);
  db.prepare("INSERT INTO campaigns(id,name,language,owner_id,created_at) VALUES('c','Campaign','en','viewer',1)").run();
  db.prepare("INSERT INTO members VALUES('c','viewer','gm')").run();
  const portrait = Buffer.alloc(1024 * 1024);
  db.prepare("UPDATE campaigns SET cover=?,cover_type='image/png' WHERE id='c'").run(portrait);
  for (let i=0;i<205;i++) {
    const data = rpg.createEntity('character',{key:`e${i}`});
    db.prepare('INSERT INTO entities(id,type,owner_id,data,portrait,portrait_type,created_at) VALUES(?,?,?,?,?,?,1)')
      .run(data.key,'character',i<5?'viewer':'other',JSON.stringify(data),i<5?portrait:null,i<5?'image/png':null);
    if (i<5) db.prepare("INSERT INTO assignments VALUES(?,'c','approved','shared',1)").run(data.key);
  }
  let stats = { queries: 0, blobs: 0 };
  const counted = new Proxy(db,{get(target,key){
    if (key === 'prepare') return sql => new Proxy(target.prepare(sql),{get(stmt,method){
      if (['get','all','run'].includes(method)) return (...args) => {
        stats.queries++;
        const result=stmt[method](...args);
        for (const row of Array.isArray(result) ? result : [result])
          if (row && typeof row === 'object') for (const value of Object.values(row)) if (value instanceof Uint8Array) stats.blobs += value.byteLength;
        return result;
      };
      const value=stmt[method]; return typeof value === 'function' ? value.bind(stmt) : value;
    }});
    const value=target[key]; return typeof value === 'function' ? value.bind(target) : value;
  }});
  const app = createApplication(counted);
  app.live.setBattle('c',{round:1,index:0,baseOrder:['group'],groups:[{id:'group',entries:Array.from({length:5},(_,i)=>({entityId:`e${i}`,token:`t${i}`}))}]});
  const server=http.createServer(app.handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{app.live.shutdown();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));db.close();});
  for (const [route, limit] of [['/api/entities?type=character',10], ['/api/entities/e0',10], ['/api/campaigns/c',30], ['/api/campaigns/c/battle',15]]) {
    stats={queries:0,blobs:0};
    const response=await fetch(`http://127.0.0.1:${server.address().port}${route}`,{headers:{cookie:`random_session=${raw}`}});
    assert.equal(response.status,200);
    await response.json();
    assert.ok(stats.queries < limit, `${route}: ${stats.queries} queries`);
    assert.equal(stats.blobs,0,route);
    t.diagnostic(`${route}: ${stats.queries} SQL statements, ${stats.blobs} image bytes`);
  }
});
