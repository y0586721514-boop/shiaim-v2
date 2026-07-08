/* ================================================================
   שכבת התקשורת — שיאים 2.0
   ----------------------------------------------------------------
   - כל בקשה נשלחת עם token (אימות אמיתי בצד השרת).
   - תור כתיבות אופליין: פעולת כתיבה בלי רשת נשמרת במכשיר
     ונשלחת אוטומטית כשהחיבור חוזר.
   - מצב הדגמה: כשעדיין לא הוגדרה כתובת שרת ב-config.js,
     האפליקציה רצה על נתוני דוגמה מקומיים — אפשר להתרשם מהכל.
   ================================================================ */

const IS_DEMO = !API_URL || API_URL.indexOf('PASTE_') !== -1;

const TOKEN_KEY = 'shiaim2_token';
const SESSION_KEY = 'shiaim2_session';   // {username, role, displayName}
const QUEUE_KEY = 'shiaim2_queue';

// פעולות כתיבה — נכנסות לתור אופליין אם אין רשת
const QUEUEABLE = new Set([
  'create', 'updateField', 'addLog', 'delete', 'completeProject', 'restoreProject',
  'archiveIdea', 'restoreIdea', 'addDesign', 'updateDesignField', 'addDesignLog',
  'deleteDesign', 'updateStatuses', 'updateLastSeen'
]);

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

function getSavedSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
}
function saveSession(s) {
  s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY);
}

/**
 * קריאה לשרת. מחזירה את אובייקט התשובה (עם ok:true) או זורקת Error
 * עם code ידידותי. שגיאת רשת בפעולת כתיבה → נכנסת לתור ומוחזר
 * {ok:true, queued:true}.
 */
async function api(action, data = {}, opts = {}) {
  if (IS_DEMO) return demoApi(action, data);

  const payload = JSON.stringify({ action, token: getToken(), data });
  let res, json;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },  // עוקף CORS preflight
      body: payload
    });
    json = await res.json();
  } catch (e) {
    // שגיאת רשת
    if (QUEUEABLE.has(action) && !opts.noQueue) {
      enqueue(action, data);
      return { ok: true, queued: true };
    }
    const err = new Error('network'); err.code = 'network'; throw err;
  }
  if (!json.ok) {
    if (json.error === 'unauthorized') handleSessionExpired();
    const err = new Error(json.error || 'server_error');
    err.code = json.error || 'server_error';
    throw err;
  }
  return json;
}

/** תרגום טקסטים לעברית דרך השרת (LanguageApp). מחזיר מערך מתורגם, או המקור בכשלון. */
async function translateToHebrew(texts) {
  const arr = Array.isArray(texts) ? texts : [texts];
  if (IS_DEMO) return arr;
  try {
    const res = await api('translate', { texts: arr, from: '', to: 'iw' }, { noQueue: true });
    return (res.translations && res.translations.length === arr.length) ? res.translations : arr;
  } catch (e) { return arr; }
}

function handleSessionExpired() {
  setToken('');
  saveSession(null);
  if (typeof showLoginScreen === 'function') {
    showLoginScreen('החיבור פג — צריך להתחבר מחדש');
  }
}

/* ================= תור כתיבות אופליין ================= */

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; }
}
function setQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  updateOfflineChip();
}
function enqueue(action, data) {
  const q = getQueue();
  q.push({ action, data, ts: new Date().toISOString() });
  setQueue(q);
}

function updateOfflineChip() {
  const q = getQueue();
  const chip = $('#offline-chip');
  if (!chip) return;
  chip.classList.toggle('hidden', q.length === 0);
  const count = $('#offline-count');
  if (count) count.textContent = q.length;
}

let flushing = false;
/** שליחת התור — נקרא כשחוזר חיבור ולפני כל סנכרון */
async function flushQueue() {
  if (flushing || IS_DEMO) return;
  const q = getQueue();
  if (!q.length) return;
  flushing = true;
  try {
    while (true) {
      const q2 = getQueue();
      if (!q2.length) break;
      const item = q2[0];
      try {
        await api(item.action, item.data, { noQueue: true });
      } catch (e) {
        if (e.code === 'network') return; // עדיין אין רשת — ננסה אחר כך
        // שגיאה אחרת (למשל הפריט נמחק) — מוותרים על הפריט וממשיכים
        console.warn('פעולה מהתור נכשלה:', item.action, e.code);
      }
      q2.shift();
      setQueue(q2);
    }
    toast('כל השינויים שחיכו סונכרנו ✓', 'success');
  } finally {
    flushing = false;
  }
}

window.addEventListener('online', () => { flushQueue().then(() => { if (typeof syncNow === 'function') syncNow(); }); });

/* ================================================================
   מצב הדגמה — שרת מדומה בתוך הדפדפן (localStorage)
   מיושם רק מה שצריך כדי להתרשם מהמערכת לפני חיבור לשרת אמיתי.
   ================================================================ */

const DEMO_KEY = 'shiaim2_demo_db';

function demoDb() {
  let db;
  try { db = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) { db = null; }
  if (!db) { db = demoSeed(); localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }
  return db;
}
function demoSave(db) { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }

function demoSeed() {
  const now = Date.now();
  const iso = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString();
  const dstr = (days) => {
    const d = new Date(now + days * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const clients = [
    { id: 'c-mobile', name: 'מובייל', contactName: 'דוד', phone: '050-1234567', notes: '', createdAt: iso(200), updatedAt: iso(200) },
    { id: 'c-osher', name: 'אושר עד', contactName: 'משה', phone: '052-7654321', notes: 'סניף ראשי ירושלים', createdAt: iso(300), updatedAt: iso(300) },
    { id: 'c-lavoga', name: 'LAVOGA', contactName: 'שרה', phone: '', notes: '', createdAt: iso(150), updatedAt: iso(150) }
  ];
  const suppliers = [
    { id: 's-yiwu', name: 'מפעל Yiwu Toys', field: 'צעצועים', contactName: 'Lily', wechat: 'lily_yiwu', phone: '', notes: 'מחירים טובים, ייצור 30 יום', createdAt: iso(200), updatedAt: iso(200) },
    { id: 's-acryl', name: 'Shenzhen Acrylic Co', field: 'אקריליק', contactName: 'Chen', wechat: 'chen_acryl', phone: '', notes: 'איכות מעולה, יקר יחסית', createdAt: iso(100), updatedAt: iso(100) }
  ];
  const projects = [
    {
      id: 'p1', name: 'סביבוני LED לחנוכה', clientId: 'c-osher', type: 'client',
      status: 'נשלח למפעל לביצוע', deadline: dstr(-3), priority: 5,
      notes: [{ date: iso(2), user: 'aharon', text: 'המפעל מבקש אישור סופי על הצבעים' }],
      importantInfo: [{ date: iso(10), user: 'yakov', text: 'חייב להגיע למחסן עד ר"ח כסלו' }],
      designs: [
        { id: 'd1', name: 'עיצוב אריזה', status: 'אושר עיצוב ע"י הלקוח', deadline: '', priority: 3, notes: [], importantInfo: [] },
        { id: 'd2', name: 'הדפסה על הסביבון', status: 'בסבב תיקונים', deadline: dstr(2), priority: 4, notes: [], importantInfo: [] }
      ],
      completed: false, createdAt: iso(60), createdBy: 'yakov', updatedAt: iso(2), folderId: '', supplierId: 's-yiwu'
    },
    {
      id: 'p2', name: 'מגנטים לימי הולדת', clientId: 'c-mobile', type: 'client',
      status: 'בעיצוב ראשוני', deadline: dstr(4), priority: 3,
      notes: [], importantInfo: [], designs: [],
      completed: false, createdAt: iso(20), createdBy: 'aharon', updatedAt: iso(1), folderId: '', supplierId: ''
    },
    {
      id: 'p3', name: 'סטנדים אקריליק ליודאיקה', clientId: 'c-lavoga', type: 'client',
      status: 'בתכנון', deadline: '', priority: 2,
      notes: [], importantInfo: [], designs: [],
      completed: false, createdAt: iso(30), createdBy: 'yakov', updatedAt: iso(12), folderId: '', supplierId: 's-acryl'
    },
    {
      id: 'p4', name: 'קטלוג מוצרים חדש', clientId: '', type: 'office',
      status: 'בעיצוב ראשוני', deadline: dstr(14), priority: 1,
      notes: [], importantInfo: [], designs: [],
      completed: false, createdAt: iso(15), createdBy: 'aharon', updatedAt: iso(3), folderId: '', supplierId: ''
    },
    {
      id: 'p5', name: 'משחק קופסה — מסע המצוות', clientId: 'c-osher', type: 'client',
      status: 'נשלח לעיצוב', deadline: dstr(-10), priority: 4,
      notes: [], importantInfo: [], designs: [],
      completed: true, completedAt: iso(5), createdAt: iso(90), createdBy: 'yakov', updatedAt: iso(5), folderId: '', supplierId: ''
    }
  ];
  const ideas = [
    { id: 'i1', name: 'פאזל מגנטי פרשת שבוע', description: 'פאזל שמתחלף כל שבוע לפי הפרשה', clientId: 'c-osher', notes: [], archived: false, archiveReason: '', createdAt: iso(45), createdBy: 'yakov', updatedAt: iso(45) },
    { id: 'i2', name: 'כוסות קידוש לילדים', description: 'סט כוסות פלסטיק מהודרות', clientId: '', notes: [], archived: false, archiveReason: '', createdAt: iso(3), createdBy: 'aharon', updatedAt: iso(3) },
    { id: 'i3', name: 'שעון עומר דיגיטלי', description: '', clientId: '', notes: [], archived: true, archiveReason: 'עלות ייצור גבוהה מדי', archivedAt: iso(20), createdAt: iso(80), createdBy: 'yakov', updatedAt: iso(20) }
  ];
  const changes = [
    { id: 1, ts: iso(2), user: 'aharon', entityType: 'project', entityId: 'p1', entityName: 'סביבוני LED לחנוכה', changeType: 'note', details: 'הערה חדשה: המפעל מבקש אישור סופי על הצבעים' },
    { id: 2, ts: iso(1), user: 'aharon', entityType: 'project', entityId: 'p2', entityName: 'מגנטים לימי הולדת', changeType: 'status', details: 'סטטוס: בתכנון ← בעיצוב ראשוני' },
    { id: 3, ts: iso(0.2), user: 'aharon', entityType: 'idea', entityId: 'i2', entityName: 'כוסות קידוש לילדים', changeType: 'created', details: '' }
  ];
  return {
    users: { yakov: { role: 'boss', displayName: 'יעקב', password: '1234' }, aharon: { role: 'user', displayName: 'אהרון', password: '1234' } },
    statuses: ['בתכנון', 'בעיצוב ראשוני', 'אושר עיצוב ע"י הלקוח', 'בסבב תיקונים', 'נשלח לעיצוב', 'ממתין להעברת תשלום', 'נשלח למפעל לביצוע', 'סיים ייצור', 'יצא למשלוח', 'במשלוח אוניה', 'במשלוח אוויר', 'הגיע לנמל בישראל', 'שוחרר', 'סיום תהליך'],
    projects, ideas, clients, suppliers, changes,
    changeCounter: 3, lastSeen: {}
  };
}

function demoEntityList(db, entity) {
  return { project: db.projects, idea: db.ideas, client: db.clients, supplier: db.suppliers }[entity];
}

function demoLogChange(db, user, entityType, entityId, entityName, changeType, details) {
  db.changeCounter = (db.changeCounter || 0) + 1;
  db.changes.push({ id: db.changeCounter, ts: new Date().toISOString(), user, entityType, entityId, entityName, changeType, details: details || '' });
}

async function demoApi(action, data) {
  const db = demoDb();
  const session = getSavedSession();
  const user = session ? session.username : 'yakov';
  const role = session ? session.role : 'boss';
  const nowIso = () => new Date().toISOString();
  const fail = (code) => { const e = new Error(code); e.code = code; throw e; };

  switch (action) {
    case 'ping': return { ok: true, needsSetup: false, demo: true };
    case 'login': {
      const u = db.users[String(data.username || '').toLowerCase()];
      if (!u || u.password !== data.password) fail('bad_credentials');
      return { ok: true, token: 'demo-token', username: String(data.username).toLowerCase(), role: u.role, displayName: u.displayName };
    }
    case 'changePassword': {
      const u = db.users[user];
      if (!u || u.password !== data.current) fail('bad_current_password');
      if (String(data.newPassword || '').length < 4) fail('password_too_short');
      u.password = data.newPassword; demoSave(db);
      return { ok: true };
    }
    case 'logout': return { ok: true };
    case 'getAll':
      return {
        ok: true, projects: db.projects, ideas: db.ideas, clients: db.clients, suppliers: db.suppliers,
        statuses: db.statuses, changes: db.changes.slice(-50).reverse(),
        lastSeen: db.lastSeen[user] || '', serverTime: nowIso()
      };
    case 'sync':
      return {
        ok: true,
        projects: db.projects.filter(p => p.updatedAt > (data.since || '')),
        ideas: db.ideas.filter(p => p.updatedAt > (data.since || '')),
        clients: db.clients.filter(p => p.updatedAt > (data.since || '')),
        suppliers: db.suppliers.filter(p => p.updatedAt > (data.since || '')),
        deleted: { project: [], idea: [], client: [], supplier: [] },
        statuses: db.statuses,
        changes: db.changes.filter(c => c.id > (data.sinceChangeId || 0)),
        serverTime: nowIso()
      };
    case 'getChanges': {
      const before = Number(data.beforeId || 0);
      let list = db.changes.slice().reverse();
      if (before) list = list.filter(c => c.id < before);
      return { ok: true, changes: list.slice(0, data.limit || 50) };
    }
    case 'updateLastSeen': db.lastSeen[user] = data.ts; demoSave(db); return { ok: true };
    case 'create': {
      const list = demoEntityList(db, data.entity) || fail('bad_entity');
      const obj = data.obj;
      obj.id = obj.id || uid();
      obj.createdAt = nowIso(); obj.createdBy = user; obj.updatedAt = nowIso();
      if (data.entity === 'project') obj.folderId = '';
      list.push(obj);
      demoLogChange(db, user, data.entity, obj.id, obj.name, 'created', '');
      demoSave(db);
      return { ok: true, obj };
    }
    case 'updateField': {
      const list = demoEntityList(db, data.entity) || fail('bad_entity');
      const obj = list.find(o => o.id === data.id) || fail('not_found');
      if (data.entity === 'project' && data.field === 'priority' && role !== 'boss') fail('forbidden');
      const old = obj[data.field];
      obj[data.field] = data.value; obj.updatedAt = nowIso();
      demoLogChange(db, user, data.entity, obj.id, obj.name,
        data.field === 'status' ? 'status' : (data.field === 'priority' ? 'priority' : 'field'),
        data.field + ': ' + (old ?? '(ריק)') + ' ← ' + (data.value ?? '(ריק)'));
      demoSave(db);
      return { ok: true, obj };
    }
    case 'addLog': {
      const list = demoEntityList(db, data.entity) || fail('bad_entity');
      const obj = list.find(o => o.id === data.id) || fail('not_found');
      const area = data.area === 'importantInfo' ? 'importantInfo' : 'notes';
      obj[area] = obj[area] || [];
      const entry = { date: nowIso(), user, text: data.text };
      obj[area].push(entry); obj.updatedAt = nowIso();
      demoLogChange(db, user, data.entity, obj.id, obj.name, 'note', (area === 'notes' ? 'הערה חדשה: ' : 'מידע חשוב חדש: ') + String(data.text).slice(0, 120));
      demoSave(db);
      return { ok: true, obj, entry };
    }
    case 'delete': {
      if (role !== 'boss') fail('forbidden');
      const list = demoEntityList(db, data.entity) || fail('bad_entity');
      const i = list.findIndex(o => o.id === data.id);
      if (i === -1) fail('not_found');
      demoLogChange(db, user, data.entity, data.id, list[i].name, 'deleted', '');
      list.splice(i, 1);
      demoSave(db);
      return { ok: true };
    }
    case 'completeProject': case 'restoreProject': {
      const obj = db.projects.find(o => o.id === data.id) || fail('not_found');
      obj.completed = action === 'completeProject';
      obj.completedAt = obj.completed ? nowIso() : '';
      obj.updatedAt = nowIso();
      demoLogChange(db, user, 'project', obj.id, obj.name, obj.completed ? 'completed' : 'restored', '');
      demoSave(db);
      return { ok: true, obj };
    }
    case 'archiveIdea': case 'restoreIdea': {
      const obj = db.ideas.find(o => o.id === data.id) || fail('not_found');
      obj.archived = action === 'archiveIdea';
      obj.archiveReason = obj.archived ? (data.reason || '') : '';
      obj.archivedAt = obj.archived ? nowIso() : '';
      obj.updatedAt = nowIso();
      demoLogChange(db, user, 'idea', obj.id, obj.name, obj.archived ? 'archived' : 'restored', obj.archived ? 'סיבה: ' + obj.archiveReason : '');
      demoSave(db);
      return { ok: true, obj };
    }
    case 'addDesign': {
      const proj = db.projects.find(o => o.id === data.projectId) || fail('not_found');
      const d = Object.assign({ id: uid(), status: '', deadline: '', priority: 0, notes: [], importantInfo: [] }, data.design);
      proj.designs = proj.designs || [];
      proj.designs.push(d); proj.updatedAt = nowIso();
      demoLogChange(db, user, 'project', proj.id, proj.name, 'field', 'עיצוב חדש: ' + d.name);
      demoSave(db);
      return { ok: true, obj: proj, design: d };
    }
    case 'updateDesignField': {
      const proj = db.projects.find(o => o.id === data.projectId) || fail('not_found');
      const d = (proj.designs || []).find(x => x.id === data.designId) || fail('design_not_found');
      d[data.field] = data.value; proj.updatedAt = nowIso();
      demoLogChange(db, user, 'project', proj.id, proj.name, 'field', 'עיצוב "' + d.name + '" עודכן');
      demoSave(db);
      return { ok: true, obj: proj };
    }
    case 'addDesignLog': {
      const proj = db.projects.find(o => o.id === data.projectId) || fail('not_found');
      const d = (proj.designs || []).find(x => x.id === data.designId) || fail('design_not_found');
      const area = data.area === 'importantInfo' ? 'importantInfo' : 'notes';
      d[area] = d[area] || [];
      d[area].push({ date: nowIso(), user, text: data.text });
      proj.updatedAt = nowIso();
      demoSave(db);
      return { ok: true, obj: proj };
    }
    case 'deleteDesign': {
      const proj = db.projects.find(o => o.id === data.projectId) || fail('not_found');
      proj.designs = (proj.designs || []).filter(x => x.id !== data.designId);
      proj.updatedAt = nowIso();
      demoSave(db);
      return { ok: true, obj: proj };
    }
    case 'updateStatuses': {
      if (role !== 'boss') fail('forbidden');
      db.statuses = data.statuses;
      const renames = data.renames || {};
      db.projects.forEach(p => {
        if (renames[p.status]) { p.status = renames[p.status]; p.updatedAt = nowIso(); }
        (p.designs || []).forEach(d => { if (renames[d.status]) d.status = renames[d.status]; });
      });
      demoSave(db);
      return { ok: true, statuses: db.statuses };
    }
    case 'exportBackup':
      return { ok: true, exportedAt: nowIso(), projects: db.projects, ideas: db.ideas, clients: db.clients, suppliers: db.suppliers, statuses: db.statuses, changes: db.changes };
    case 'getFiles':
      return { ok: true, files: [], folderUrl: '' };
    case 'uploadFile':
      fail('network'); // אין Drive במצב הדגמה
    case 'importData':
      fail('forbidden');
    default:
      fail('unknown_action');
  }
}
