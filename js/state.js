/* ================================================================
   מצב האפליקציה + סנכרון — שיאים 2.0
   ================================================================ */

const S = {
  user: '', role: '', displayName: '',
  view: 'today',
  projects: [], ideas: [], clients: [], suppliers: [],
  statuses: [],
  changes: [],           // אחרונים, מהחדש לישן
  lastSeen: '',          // מתי המשתמש ראה לאחרונה את יומן השינויים
  lastSyncTs: '',        // updatedAt הגבוה ביותר שנקלט
  lastChangeId: 0,
  showCompleted: false,
  filters: { search: '', type: '', status: '', priority: '', client: '', deadline: '' },
  loaded: false
};

const isBoss = () => S.role === 'boss';

/* ================= חיפושים ================= */

function getProject(id)  { return S.projects.find(p => p.id === id); }

/* פרויקטי עיצוב מנוהלים בנפרד מפרויקטי הייבוא (אותה ישות, שדה kind) */
function isDesignProject(p) { return !!p && p.kind === 'design'; }
function importProjects() { return S.projects.filter(p => p.kind !== 'design'); }
function designProjects() { return S.projects.filter(p => p.kind === 'design'); }
function getIdea(id)     { return S.ideas.find(i => i.id === id); }
function getClient(id)   { return S.clients.find(c => c.id === id); }
function getSupplier(id) { return S.suppliers.find(s => s.id === id); }

function clientName(id) {
  if (!id) return '';
  const c = getClient(id);
  return c ? c.name : '';
}
function supplierName(id) {
  if (!id) return '';
  const s = getSupplier(id);
  return s ? s.name : '';
}
function userDisplay(username) {
  return username === 'yakov' ? 'יעקב' : username === 'aharon' ? 'אהרון' : username;
}

function projectsOfClient(clientId) {
  return S.projects.filter(p => p.clientId === clientId);
}
function ideasOfClient(clientId) {
  return S.ideas.filter(i => i.clientId === clientId);
}
function projectsOfSupplier(supplierId) {
  return S.projects.filter(p => p.supplierId === supplierId);
}

/* ================= טעינה וסנכרון ================= */

async function loadAll() {
  const res = await api('getAll');
  S.projects = res.projects || [];
  S.ideas = res.ideas || [];
  S.clients = res.clients || [];
  S.suppliers = res.suppliers || [];
  S.statuses = res.statuses || [];
  S.changes = (res.changes || []).sort((a, b) => b.id - a.id);
  S.lastSeen = res.lastSeen || '';
  S.lastSyncTs = res.serverTime || new Date().toISOString();
  S.lastChangeId = S.changes.length ? S.changes[0].id : 0;
  S.loaded = true;
  updateChangesBadge();
  updateNavCounts();
}

/** מיזוג ישות מעודכנת מהשרת לתוך המצב המקומי */
function mergeEntity(entity, obj) {
  const list = { project: S.projects, idea: S.ideas, client: S.clients, supplier: S.suppliers }[entity];
  if (!list || !obj) return;
  const i = list.findIndex(o => o.id === obj.id);
  if (i === -1) list.push(obj); else list[i] = obj;
  if (obj.updatedAt && obj.updatedAt > S.lastSyncTs) S.lastSyncTs = obj.updatedAt;
}

function removeEntity(entity, id) {
  const list = { project: S.projects, idea: S.ideas, client: S.clients, supplier: S.suppliers }[entity];
  if (!list) return;
  const i = list.findIndex(o => o.id === id);
  if (i !== -1) list.splice(i, 1);
}

let syncTimer = null;

function startSyncLoop() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => { if (!document.hidden) syncNow(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.loaded) syncNow(); });
}

let syncing = false;
/** סנכרון: מושך רק מה שהשתנה מאז הפעם הקודמת ומרענן את המסך */
async function syncNow() {
  if (syncing || !S.loaded || !getToken()) return;
  syncing = true;
  try {
    await flushQueue();
    const res = await api('sync', { since: S.lastSyncTs, sinceChangeId: S.lastChangeId });
    let changed = false;
    (res.projects || []).forEach(o => { mergeEntity('project', o); changed = true; });
    (res.ideas || []).forEach(o => { mergeEntity('idea', o); changed = true; });
    (res.clients || []).forEach(o => { mergeEntity('client', o); changed = true; });
    (res.suppliers || []).forEach(o => { mergeEntity('supplier', o); changed = true; });
    const del = res.deleted || {};
    Object.keys(del).forEach(entity => (del[entity] || []).forEach(id => { removeEntity(entity, id); changed = true; }));
    if (res.statuses) S.statuses = res.statuses;
    (res.changes || []).forEach(c => {
      if (c.id > S.lastChangeId) { S.changes.unshift(c); S.lastChangeId = c.id; changed = true; }
    });
    S.changes.sort((a, b) => b.id - a.id);
    if (res.serverTime) S.lastSyncTs = res.serverTime;
    if (changed) {
      updateChangesBadge();
      updateNavCounts();
      renderCurrentView();
    }
  } catch (e) {
    /* אין רשת או שגיאה זמנית — ננסה שוב בסבב הבא */
  } finally {
    syncing = false;
  }
}

/* ================= פעמון השינויים ================= */

function unseenChanges() {
  return S.changes.filter(c => c.user !== S.user && (!S.lastSeen || c.ts > S.lastSeen));
}

function updateChangesBadge() {
  const badge = $('#changes-badge');
  if (!badge) return;
  const n = unseenChanges().length;
  badge.textContent = n > 99 ? '99+' : n;
  badge.classList.toggle('hidden', n === 0);
}

function updateNavCounts() {
  const activeProjects = importProjects().filter(p => !p.completed).length;
  const activeDesign = designProjects().filter(p => !p.completed).length;
  const openIdeas = S.ideas.filter(i => !i.archived).length;
  const np = $('#nav-count-projects'), ni = $('#nav-count-ideas'), nd = $('#nav-count-design');
  if (np) np.textContent = activeProjects || '';
  if (ni) ni.textContent = openIdeas || '';
  if (nd) nd.textContent = activeDesign || '';
}

/* ================= ביצוע-עם-ביטול (Undo) =================
   הפעולה מופעלת מיד על המסך, אבל נשלחת לשרת רק אחרי 10 שניות.
   לחיצה על "בטל" בטוסט — מחזירה הכל ולא שולחת כלום. */

function doWithUndo({ message, apply, commit, revert }) {
  apply();
  let done = false;
  const timer = setTimeout(async () => {
    done = true;
    try { await commit(); } catch (e) { toast(friendlyError(e.code), 'error'); revert(); renderCurrentView(); }
  }, 10000);
  toast(message, '', {
    undo: () => {
      if (done) return;
      clearTimeout(timer);
      revert();
      renderCurrentView();
      toast('בוטל ✓', 'success');
    }
  });
}

/* ================= עדכון שדה (אופטימי) ================= */

/**
 * מעדכן שדה של ישות: קודם על המסך, ואז בשרת.
 * בכשלון — מחזיר את הערך הישן ומציג שגיאה ידידותית.
 */
async function updateFieldOptimistic(entity, id, field, value, rerender) {
  const list = { project: S.projects, idea: S.ideas, client: S.clients, supplier: S.suppliers }[entity];
  const obj = list.find(o => o.id === id);
  if (!obj) return false;
  const oldVal = obj[field];
  obj[field] = value;
  if (rerender) rerender();
  try {
    const res = await api('updateField', { entity, id, field, value });
    if (res.queued) { toast('נשמר במכשיר — יסונכרן כשיהיה חיבור ⏳'); }
    else { if (res.obj) mergeEntity(entity, res.obj); toast('נשמר ✓', 'success'); }
    updateNavCounts();
    return true;
  } catch (e) {
    obj[field] = oldVal;
    if (rerender) rerender();
    toast(friendlyError(e.code), 'error');
    return false;
  }
}
