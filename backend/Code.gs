/**
 * ================================================================
 * התנהלות שוטפת — שיאים | גרסה 2.0 | קוד שרת (Google Apps Script)
 * ================================================================
 * שרת יחיד שכותב ל-Google Sheets ומנהל תיקיות Google Drive.
 *
 * עקרונות:
 *  - כל בקשה (חוץ מ-login/setup) חייבת token תקף.
 *  - סיסמאות נשמרות מגובבות (SHA-256 + salt) — לעולם לא כטקסט.
 *  - עדכונים הם ברמת שדה בודד (updateField) — לא דריסת אובייקט שלם.
 *  - השרת עצמו רושם כל שינוי ליומן — אין שינוי שנבלע.
 *  - הרשאות נאכפות כאן: מחיקה לצמיתות ופעולות ניהול — לבוס בלבד.
 *
 * התקנה מלאה: ראו docs/מדריך-התקנה.md בריפו.
 * בקצרה: הדבקת הקובץ הזה בפרויקט Apps Script חדש → Deploy → Web App
 * (Execute as: Me, Access: Anyone) → העתקת הכתובת ל-js/config.js.
 * הגיליון והתיקייה ב-Drive נוצרים אוטומטית בבקשה הראשונה.
 */

var API_VERSION = '2.0';

// שמות הגיליונות
var SHEETS = {
  users: 'Users',        // username | role | displayName | salt | passHash
  sessions: 'Sessions',  // token | username | createdAt | lastUsed
  projects: 'Projects',  // id | json | updatedAt | deleted
  ideas: 'Ideas',
  clients: 'Clients',
  suppliers: 'Suppliers',
  changes: 'Changes',    // id | ts | user | entityType | entityId | entityName | changeType | details
  meta: 'Meta'           // key | value
};

var ENTITY_SHEETS = { project: 'Projects', idea: 'Ideas', client: 'Clients', supplier: 'Suppliers' };

var ENTITY_NAMES_HE = { project: 'פרויקט', idea: 'רעיון', client: 'לקוח', supplier: 'ספק' };

var DEFAULT_STATUSES = [
  'בתכנון', 'בעיצוב ראשוני', 'אושר עיצוב ע"י הלקוח',
  'בסבב תיקונים', 'נשלח לעיצוב', 'נשלח למפעל לביצוע'
];

var MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
var TOKEN_IDLE_DAYS = 90;                // token שלא היה בשימוש 90 יום — פג

// ================================================================
// נקודות כניסה
// ================================================================

function doGet(e) {
  return jsonOut_({ ok: true, name: 'shiaim-api', version: API_VERSION });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'bad_request' });
  }
  var action = req.action || '';
  var data = req.data || {};

  try {
    // פעולות פתוחות (ללא token)
    if (action === 'ping')  return jsonOut_({ ok: true, version: API_VERSION, needsSetup: needsSetup_() });
    if (action === 'setup') return jsonOut_(handleSetup_(data));
    if (action === 'login') return jsonOut_(handleLogin_(data));

    // כל השאר — דורש token
    var session = checkToken_(req.token);
    if (!session) return jsonOut_({ ok: false, error: 'unauthorized' });

    var user = session.username;
    var role = session.role;

    var lock = LockService.getScriptLock();
    var isWrite = !/^(getAll|sync|getChanges|getFiles|exportBackup)$/.test(action);
    if (isWrite) lock.waitLock(20000);
    try {
      switch (action) {
        // קריאה
        case 'getAll':        return jsonOut_(handleGetAll_(user));
        case 'sync':          return jsonOut_(handleSync_(user, data));
        case 'getChanges':    return jsonOut_(handleGetChanges_(data));
        case 'getFiles':      return jsonOut_(handleGetFiles_(data));
        case 'exportBackup':  return jsonOut_(handleExportBackup_());

        // חשבון
        case 'changePassword': return jsonOut_(handleChangePassword_(user, data));
        case 'logout':         return jsonOut_(handleLogout_(req.token));
        case 'updateLastSeen': return jsonOut_(handleUpdateLastSeen_(user, data));

        // כתיבה — ישויות
        case 'create':          return jsonOut_(handleCreate_(user, role, data));
        case 'updateField':     return jsonOut_(handleUpdateField_(user, role, data));
        case 'addLog':          return jsonOut_(handleAddLog_(user, data));
        case 'delete':          return jsonOut_(handleDelete_(user, role, data));
        case 'completeProject': return jsonOut_(handleCompleteProject_(user, data, true));
        case 'restoreProject':  return jsonOut_(handleCompleteProject_(user, data, false));
        case 'archiveIdea':     return jsonOut_(handleArchiveIdea_(user, data, true));
        case 'restoreIdea':     return jsonOut_(handleArchiveIdea_(user, data, false));

        // עיצובים (תת-ישות של פרויקט)
        case 'addDesign':         return jsonOut_(handleAddDesign_(user, data));
        case 'updateDesignField': return jsonOut_(handleUpdateDesignField_(user, data));
        case 'addDesignLog':      return jsonOut_(handleAddDesignLog_(user, data));
        case 'deleteDesign':      return jsonOut_(handleDeleteDesign_(user, data));

        // ניהול (בוס בלבד — נאכף בתוך הפונקציות)
        case 'updateStatuses': return jsonOut_(handleUpdateStatuses_(user, role, data));
        case 'importData':     return jsonOut_(handleImportData_(user, role, data));

        // קבצים ב-Drive
        case 'uploadFile': return jsonOut_(handleUploadFile_(user, data));
        case 'deleteFile': return jsonOut_(handleDeleteFile_(user, role, data));

        default: return jsonOut_({ ok: false, error: 'unknown_action' });
      }
    } finally {
      if (isWrite) lock.releaseLock();
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: 'server_error', message: String(err && err.message || err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================================================================
// אתחול — גיליון + תיקיית Drive נוצרים אוטומטית
// ================================================================

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* נמחק? ניצור חדש */ }
  }
  var ss = SpreadsheetApp.create('שיאים — התנהלות שוטפת (נתונים)');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var headers = {
      Users: ['username', 'role', 'displayName', 'salt', 'passHash'],
      Sessions: ['token', 'username', 'createdAt', 'lastUsed'],
      Projects: ['id', 'json', 'updatedAt', 'deleted'],
      Ideas: ['id', 'json', 'updatedAt', 'deleted'],
      Clients: ['id', 'json', 'updatedAt', 'deleted'],
      Suppliers: ['id', 'json', 'updatedAt', 'deleted'],
      Changes: ['id', 'ts', 'user', 'entityType', 'entityId', 'entityName', 'changeType', 'details'],
      Meta: ['key', 'value']
    }[name];
    if (headers) sh.appendRow(headers);
  }
  return sh;
}

function getRootFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ROOT_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* ניצור חדש */ }
  }
  var folder = DriveApp.createFolder('שיאים — התנהלות שוטפת');
  props.setProperty('ROOT_FOLDER_ID', folder.getId());
  return folder;
}

function needsSetup_() {
  var sh = getSheet_(SHEETS.users);
  return sh.getLastRow() < 2;
}

// ================================================================
// Meta (הגדרות: סטטוסים, נראה-לאחרונה)
// ================================================================

function metaGet_(key, fallback) {
  var sh = getSheet_(SHEETS.meta);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      try { return JSON.parse(rows[i][1]); } catch (e) { return rows[i][1]; }
    }
  }
  return fallback;
}

function metaSet_(key, value) {
  var sh = getSheet_(SHEETS.meta);
  var rows = sh.getDataRange().getValues();
  var str = JSON.stringify(value);
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) { sh.getRange(i + 1, 2).setValue(str); return; }
  }
  sh.appendRow([key, str]);
}

// ================================================================
// משתמשים, סיסמאות, טוקנים
// ================================================================

function hashPassword_(salt, password) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '::' + password, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function randomToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

/** הקמה ראשונית — עובד רק כשאין עדיין משתמשים במערכת. */
function handleSetup_(data) {
  if (!needsSetup_()) return { ok: false, error: 'already_setup' };
  var yp = String(data.yakovPassword || '');
  var ap = String(data.aharonPassword || '');
  if (yp.length < 4 || ap.length < 4) return { ok: false, error: 'password_too_short' };
  var sh = getSheet_(SHEETS.users);
  [['yakov', 'boss', 'יעקב', yp], ['aharon', 'user', 'אהרון', ap]].forEach(function (u) {
    var salt = randomToken_().slice(0, 16);
    sh.appendRow([u[0], u[1], u[2], salt, hashPassword_(salt, u[3])]);
  });
  metaSet_('statuses', DEFAULT_STATUSES);
  getRootFolder_(); // יצירת תיקיית השורש מראש
  return { ok: true };
}

function findUser_(username) {
  var rows = getSheet_(SHEETS.users).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === String(username).toLowerCase()) {
      return { row: i + 1, username: rows[i][0], role: rows[i][1], displayName: rows[i][2], salt: rows[i][3], passHash: rows[i][4] };
    }
  }
  return null;
}

function handleLogin_(data) {
  if (needsSetup_()) return { ok: false, error: 'needs_setup' };
  var u = findUser_(data.username);
  if (!u || hashPassword_(u.salt, String(data.password || '')) !== u.passHash) {
    Utilities.sleep(500); // האטה קלה נגד ניחוש סיסמאות
    return { ok: false, error: 'bad_credentials' };
  }
  var token = randomToken_();
  var now = new Date().toISOString();
  getSheet_(SHEETS.sessions).appendRow([token, u.username, now, now]);
  CacheService.getScriptCache().put('tok_' + token, JSON.stringify({ username: u.username, role: u.role }), 21600);
  return { ok: true, token: token, username: u.username, role: u.role, displayName: u.displayName };
}

function checkToken_(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var cached = cache.get('tok_' + token);
  if (cached) return JSON.parse(cached);

  var sh = getSheet_(SHEETS.sessions);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === token) {
      var lastUsed = new Date(rows[i][3]);
      if ((Date.now() - lastUsed.getTime()) > TOKEN_IDLE_DAYS * 86400000) return null;
      sh.getRange(i + 1, 4).setValue(new Date().toISOString());
      var u = findUser_(rows[i][1]);
      if (!u) return null;
      var session = { username: u.username, role: u.role };
      cache.put('tok_' + token, JSON.stringify(session), 21600);
      return session;
    }
  }
  return null;
}

function handleLogout_(token) {
  CacheService.getScriptCache().remove('tok_' + token);
  var sh = getSheet_(SHEETS.sessions);
  var rows = sh.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0] === token) sh.deleteRow(i + 1);
  }
  return { ok: true };
}

function handleChangePassword_(username, data) {
  var u = findUser_(username);
  if (!u) return { ok: false, error: 'unauthorized' };
  if (hashPassword_(u.salt, String(data.current || '')) !== u.passHash) {
    return { ok: false, error: 'bad_current_password' };
  }
  var np = String(data.newPassword || '');
  if (np.length < 4) return { ok: false, error: 'password_too_short' };
  var salt = randomToken_().slice(0, 16);
  var sh = getSheet_(SHEETS.users);
  sh.getRange(u.row, 4).setValue(salt);
  sh.getRange(u.row, 5).setValue(hashPassword_(salt, np));
  return { ok: true };
}

// ================================================================
// קריאת ישויות
// ================================================================

function readEntities_(sheetName, sinceIso, includeDeleted) {
  var rows = getSheet_(sheetName).getDataRange().getValues();
  var out = [], deletedIds = [];
  for (var i = 1; i < rows.length; i++) {
    var updatedAt = String(rows[i][2]);
    if (sinceIso && updatedAt <= sinceIso) continue;
    var isDeleted = rows[i][3] === true || rows[i][3] === 'TRUE' || rows[i][3] === 1;
    if (isDeleted) { deletedIds.push(String(rows[i][0])); continue; }
    try { out.push(JSON.parse(rows[i][1])); } catch (e) { /* שורה פגומה — מדלגים */ }
  }
  return { items: out, deletedIds: deletedIds };
}

function findEntityRow_(sheetName, id) {
  var sh = getSheet_(sheetName);
  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      var obj = null;
      try { obj = JSON.parse(rows[i][1]); } catch (e) {}
      return { sheet: sh, rowIndex: i + 1, obj: obj, deleted: rows[i][3] === true || rows[i][3] === 'TRUE' };
    }
  }
  return null;
}

function writeEntity_(sheetName, obj, existingRowIndex) {
  var sh = getSheet_(sheetName);
  obj.updatedAt = new Date().toISOString();
  var rowValues = [obj.id, JSON.stringify(obj), obj.updatedAt, false];
  if (existingRowIndex) {
    sh.getRange(existingRowIndex, 1, 1, 4).setValues([rowValues]);
  } else {
    sh.appendRow(rowValues);
  }
  return obj;
}

function handleGetAll_(user) {
  return {
    ok: true,
    projects: readEntities_(SHEETS.projects).items,
    ideas: readEntities_(SHEETS.ideas).items,
    clients: readEntities_(SHEETS.clients).items,
    suppliers: readEntities_(SHEETS.suppliers).items,
    statuses: metaGet_('statuses', DEFAULT_STATUSES),
    changes: readChanges_(null, 50),
    lastSeen: metaGet_('lastSeen_' + user, ''),
    serverTime: new Date().toISOString()
  };
}

function handleSync_(user, data) {
  var since = String(data.since || '');
  var sinceChangeId = Number(data.sinceChangeId || 0);
  var p = readEntities_(SHEETS.projects, since);
  var i = readEntities_(SHEETS.ideas, since);
  var c = readEntities_(SHEETS.clients, since);
  var s = readEntities_(SHEETS.suppliers, since);
  return {
    ok: true,
    projects: p.items, ideas: i.items, clients: c.items, suppliers: s.items,
    deleted: { project: p.deletedIds, idea: i.deletedIds, client: c.deletedIds, supplier: s.deletedIds },
    statuses: metaGet_('statuses', DEFAULT_STATUSES),
    changes: readChangesSince_(sinceChangeId),
    serverTime: new Date().toISOString()
  };
}

// ================================================================
// יומן שינויים — נכתב ע"י השרת על כל שינוי
// ================================================================

function nextChangeId_() {
  var id = Number(metaGet_('changeCounter', 0)) + 1;
  metaSet_('changeCounter', id);
  return id;
}

function logChange_(user, entityType, entityId, entityName, changeType, details) {
  getSheet_(SHEETS.changes).appendRow([
    nextChangeId_(), new Date().toISOString(), user,
    entityType, entityId, entityName, changeType, details || ''
  ]);
}

function changeRowToObj_(r) {
  return {
    id: Number(r[0]), ts: String(r[1]), user: String(r[2]),
    entityType: String(r[3]), entityId: String(r[4]), entityName: String(r[5]),
    changeType: String(r[6]), details: String(r[7])
  };
}

/** קריאת שינויים אחרונים עם pagination (beforeId → אחורה בהיסטוריה). */
function readChanges_(beforeId, limit) {
  var rows = getSheet_(SHEETS.changes).getDataRange().getValues();
  var out = [];
  for (var i = rows.length - 1; i >= 1; i--) {
    var id = Number(rows[i][0]);
    if (beforeId && id >= beforeId) continue;
    out.push(changeRowToObj_(rows[i]));
    if (out.length >= (limit || 50)) break;
  }
  return out;
}

function readChangesSince_(sinceChangeId) {
  if (!sinceChangeId) return [];
  var rows = getSheet_(SHEETS.changes).getDataRange().getValues();
  var out = [];
  for (var i = rows.length - 1; i >= 1; i--) {
    var id = Number(rows[i][0]);
    if (id <= sinceChangeId) break;
    out.push(changeRowToObj_(rows[i]));
  }
  return out.reverse();
}

function handleGetChanges_(data) {
  return { ok: true, changes: readChanges_(Number(data.beforeId || 0) || null, Number(data.limit || 50)) };
}

function handleUpdateLastSeen_(user, data) {
  metaSet_('lastSeen_' + user, String(data.ts || new Date().toISOString()));
  return { ok: true };
}

// ================================================================
// יצירה / עדכון שדה / מחיקה
// ================================================================

var BOSS_ONLY_FIELDS = { project: ['priority'] }; // דחיפות — לבוס בלבד

function handleCreate_(user, role, data) {
  var entity = String(data.entity || '');
  var sheetName = ENTITY_SHEETS[entity];
  if (!sheetName) return { ok: false, error: 'bad_entity' };
  var obj = data.obj || {};
  if (!obj.id) obj.id = Utilities.getUuid().slice(0, 13);
  if (!obj.name) return { ok: false, error: 'missing_name' };
  obj.createdAt = new Date().toISOString();
  obj.createdBy = user;

  // פרויקט חדש מקבל תיקיית Drive אוטומטית
  if (entity === 'project' && !obj.folderId) {
    try {
      var folder = getRootFolder_().createFolder(obj.name);
      obj.folderId = folder.getId();
    } catch (e) { obj.folderId = ''; }
  }

  writeEntity_(sheetName, obj);
  logChange_(user, entity, obj.id, obj.name, 'created', '');
  return { ok: true, obj: obj };
}

function handleUpdateField_(user, role, data) {
  var entity = String(data.entity || '');
  var sheetName = ENTITY_SHEETS[entity];
  if (!sheetName) return { ok: false, error: 'bad_entity' };
  var found = findEntityRow_(sheetName, data.id);
  if (!found || !found.obj || found.deleted) return { ok: false, error: 'not_found' };

  var field = String(data.field || '');
  if (!field || field === 'id' || field === 'createdAt' || field === 'createdBy') {
    return { ok: false, error: 'bad_field' };
  }
  var bossOnly = (BOSS_ONLY_FIELDS[entity] || []).indexOf(field) !== -1;
  if (bossOnly && role !== 'boss') return { ok: false, error: 'forbidden' };

  var obj = found.obj;
  var oldVal = obj[field];
  obj[field] = data.value;
  writeEntity_(sheetName, obj, found.rowIndex);

  var changeType = field === 'status' ? 'status' : (field === 'priority' ? 'priority' : 'field');
  logChange_(user, entity, obj.id, obj.name, changeType,
    fieldLabel_(field) + ': ' + displayVal_(oldVal) + ' ← ' + displayVal_(data.value));
  return { ok: true, obj: obj };
}

function handleAddLog_(user, data) {
  var entity = String(data.entity || '');
  var sheetName = ENTITY_SHEETS[entity];
  if (!sheetName) return { ok: false, error: 'bad_entity' };
  var found = findEntityRow_(sheetName, data.id);
  if (!found || !found.obj) return { ok: false, error: 'not_found' };
  var area = data.area === 'importantInfo' ? 'importantInfo' : 'notes';
  var obj = found.obj;
  if (!obj[area]) obj[area] = [];
  var entry = { date: new Date().toISOString(), user: user, text: String(data.text || '').slice(0, 5000) };
  obj[area].push(entry);
  writeEntity_(sheetName, obj, found.rowIndex);
  logChange_(user, entity, obj.id, obj.name, 'note',
    (area === 'notes' ? 'הערה חדשה' : 'מידע חשוב חדש') + ': ' + entry.text.slice(0, 120));
  return { ok: true, obj: obj, entry: entry };
}

/** מחיקה לצמיתות — בוס בלבד. soft-delete כדי שהסנכרון יעדכן את כולם. */
function handleDelete_(user, role, data) {
  if (role !== 'boss') return { ok: false, error: 'forbidden' };
  var entity = String(data.entity || '');
  var sheetName = ENTITY_SHEETS[entity];
  if (!sheetName) return { ok: false, error: 'bad_entity' };
  var found = findEntityRow_(sheetName, data.id);
  if (!found || !found.obj) return { ok: false, error: 'not_found' };
  found.sheet.getRange(found.rowIndex, 3).setValue(new Date().toISOString());
  found.sheet.getRange(found.rowIndex, 4).setValue(true);
  logChange_(user, entity, data.id, found.obj.name || '', 'deleted', '');
  return { ok: true };
}

function handleCompleteProject_(user, data, complete) {
  var found = findEntityRow_(SHEETS.projects, data.id);
  if (!found || !found.obj) return { ok: false, error: 'not_found' };
  var obj = found.obj;
  obj.completed = !!complete;
  obj.completedAt = complete ? new Date().toISOString() : '';
  writeEntity_(SHEETS.projects, obj, found.rowIndex);
  logChange_(user, 'project', obj.id, obj.name, complete ? 'completed' : 'restored', '');
  return { ok: true, obj: obj };
}

function handleArchiveIdea_(user, data, archive) {
  var found = findEntityRow_(SHEETS.ideas, data.id);
  if (!found || !found.obj) return { ok: false, error: 'not_found' };
  var obj = found.obj;
  obj.archived = !!archive;
  obj.archiveReason = archive ? String(data.reason || '') : '';
  obj.archivedAt = archive ? new Date().toISOString() : '';
  writeEntity_(SHEETS.ideas, obj, found.rowIndex);
  logChange_(user, 'idea', obj.id, obj.name, archive ? 'archived' : 'restored',
    archive ? 'סיבה: ' + obj.archiveReason : '');
  return { ok: true, obj: obj };
}

// ================================================================
// עיצובים — תת-ישות בתוך פרויקט, מזוהים לפי id
// ================================================================

function withProject_(projectId, fn) {
  var found = findEntityRow_(SHEETS.projects, projectId);
  if (!found || !found.obj) return { ok: false, error: 'not_found' };
  return fn(found.obj, found.rowIndex);
}

function findDesign_(project, designId) {
  var designs = project.designs || [];
  for (var i = 0; i < designs.length; i++) {
    if (String(designs[i].id) === String(designId)) return designs[i];
  }
  return null;
}

function handleAddDesign_(user, data) {
  return withProject_(data.projectId, function (proj, rowIndex) {
    var d = data.design || {};
    if (!d.name) return { ok: false, error: 'missing_name' };
    d.id = d.id || Utilities.getUuid().slice(0, 13);
    d.status = d.status || '';
    d.deadline = d.deadline || '';
    d.priority = d.priority || 0;
    d.notes = d.notes || [];
    d.importantInfo = d.importantInfo || [];
    if (!proj.designs) proj.designs = [];
    proj.designs.push(d);
    writeEntity_(SHEETS.projects, proj, rowIndex);
    logChange_(user, 'project', proj.id, proj.name, 'field', 'עיצוב חדש: ' + d.name);
    return { ok: true, obj: proj, design: d };
  });
}

function handleUpdateDesignField_(user, data) {
  return withProject_(data.projectId, function (proj, rowIndex) {
    var d = findDesign_(proj, data.designId);
    if (!d) return { ok: false, error: 'design_not_found' };
    var field = String(data.field || '');
    if (!field || field === 'id') return { ok: false, error: 'bad_field' };
    var oldVal = d[field];
    d[field] = data.value;
    writeEntity_(SHEETS.projects, proj, rowIndex);
    logChange_(user, 'project', proj.id, proj.name, 'field',
      'עיצוב "' + d.name + '" — ' + fieldLabel_(field) + ': ' + displayVal_(oldVal) + ' ← ' + displayVal_(data.value));
    return { ok: true, obj: proj };
  });
}

function handleAddDesignLog_(user, data) {
  return withProject_(data.projectId, function (proj, rowIndex) {
    var d = findDesign_(proj, data.designId);
    if (!d) return { ok: false, error: 'design_not_found' };
    var area = data.area === 'importantInfo' ? 'importantInfo' : 'notes';
    if (!d[area]) d[area] = [];
    var entry = { date: new Date().toISOString(), user: user, text: String(data.text || '').slice(0, 5000) };
    d[area].push(entry);
    writeEntity_(SHEETS.projects, proj, rowIndex);
    logChange_(user, 'project', proj.id, proj.name, 'note',
      'עיצוב "' + d.name + '" — הערה: ' + entry.text.slice(0, 120));
    return { ok: true, obj: proj, entry: entry };
  });
}

function handleDeleteDesign_(user, data) {
  return withProject_(data.projectId, function (proj, rowIndex) {
    var before = (proj.designs || []).length;
    var name = '';
    proj.designs = (proj.designs || []).filter(function (d) {
      if (String(d.id) === String(data.designId)) { name = d.name; return false; }
      return true;
    });
    if (proj.designs.length === before) return { ok: false, error: 'design_not_found' };
    writeEntity_(SHEETS.projects, proj, rowIndex);
    logChange_(user, 'project', proj.id, proj.name, 'field', 'עיצוב נמחק: ' + name);
    return { ok: true, obj: proj };
  });
}

// ================================================================
// סטטוסים — כולל עדכון פרויקטים קיימים בשינוי שם (תיקון באג 14)
// ================================================================

function handleUpdateStatuses_(user, role, data) {
  if (role !== 'boss') return { ok: false, error: 'forbidden' };
  var statuses = (data.statuses || []).map(function (s) { return String(s).trim(); }).filter(Boolean);
  if (!statuses.length) return { ok: false, error: 'empty_statuses' };
  metaSet_('statuses', statuses);

  // renames: { "שם ישן": "שם חדש" } — מעדכן את כל הפרויקטים והעיצובים
  var renames = data.renames || {};
  var renamed = 0;
  if (Object.keys(renames).length) {
    var sh = getSheet_(SHEETS.projects);
    var rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var obj;
      try { obj = JSON.parse(rows[i][1]); } catch (e) { continue; }
      var touched = false;
      if (renames[obj.status]) { obj.status = renames[obj.status]; touched = true; }
      (obj.designs || []).forEach(function (d) {
        if (renames[d.status]) { d.status = renames[d.status]; touched = true; }
      });
      if (touched) { writeEntity_(SHEETS.projects, obj, i + 1); renamed++; }
    }
  }
  logChange_(user, 'system', '', 'סטטוסים', 'field', 'רשימת הסטטוסים עודכנה' + (renamed ? ' (עודכנו ' + renamed + ' פרויקטים)' : ''));
  return { ok: true, statuses: statuses, renamedProjects: renamed };
}

// ================================================================
// ייבוא נתונים מהמערכת הישנה — בוס בלבד
// ================================================================

function handleImportData_(user, role, data) {
  if (role !== 'boss') return { ok: false, error: 'forbidden' };
  var counts = { projects: 0, ideas: 0, clients: 0, suppliers: 0, changes: 0 };

  // לקוחות: הפיכת מחרוזות לקוח לישויות. clientNameToId ממופה מראש בצד הלקוח.
  (data.clients || []).forEach(function (c) {
    if (!c.id || !c.name) return;
    if (findEntityRow_(SHEETS.clients, c.id)) return; // לא מייבאים פעמיים
    writeEntity_(SHEETS.clients, c);
    counts.clients++;
  });

  (data.suppliers || []).forEach(function (s) {
    if (!s.id || !s.name) return;
    if (findEntityRow_(SHEETS.suppliers, s.id)) return;
    writeEntity_(SHEETS.suppliers, s);
    counts.suppliers++;
  });

  (data.ideas || []).forEach(function (idea) {
    if (!idea.id || !idea.name) return;
    if (findEntityRow_(SHEETS.ideas, idea.id)) return;
    writeEntity_(SHEETS.ideas, idea);
    counts.ideas++;
  });

  (data.projects || []).forEach(function (p) {
    if (!p.id || !p.name) return;
    if (findEntityRow_(SHEETS.projects, p.id)) return;
    // עיצובים ישנים בלי id — מקבלים id (תיקון באג 17)
    (p.designs || []).forEach(function (d) { if (!d.id) d.id = Utilities.getUuid().slice(0, 13); });
    writeEntity_(SHEETS.projects, p);
    counts.projects++;
  });

  if (data.statuses && data.statuses.length) metaSet_('statuses', data.statuses);

  (data.changes || []).forEach(function (ch) {
    getSheet_(SHEETS.changes).appendRow([
      nextChangeId_(), ch.timestamp || ch.ts || new Date().toISOString(), ch.user || '',
      ch.entityType || 'project', ch.projectId || ch.entityId || '', ch.projectName || ch.entityName || '',
      ch.changeType || 'field', ch.details || ''
    ]);
    counts.changes++;
  });

  logChange_(user, 'system', '', 'ייבוא', 'created',
    'ייבוא מהמערכת הישנה: ' + counts.projects + ' פרויקטים, ' + counts.clients + ' לקוחות, ' + counts.ideas + ' רעיונות, ' + counts.changes + ' רשומות יומן');
  return { ok: true, counts: counts };
}

// ================================================================
// גיבוי מלא
// ================================================================

function handleExportBackup_() {
  return {
    ok: true,
    exportedAt: new Date().toISOString(),
    projects: readEntities_(SHEETS.projects).items,
    ideas: readEntities_(SHEETS.ideas).items,
    clients: readEntities_(SHEETS.clients).items,
    suppliers: readEntities_(SHEETS.suppliers).items,
    statuses: metaGet_('statuses', DEFAULT_STATUSES),
    changes: readChanges_(null, 10000)
  };
}

// ================================================================
// קבצים ב-Google Drive
// ================================================================

function handleGetFiles_(data) {
  var folderId = String(data.folderId || '');
  if (!folderId) return { ok: false, error: 'missing_folder' };
  var folder;
  try { folder = DriveApp.getFolderById(folderId); }
  catch (e) { return { ok: false, error: 'folder_not_found' }; }
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    files.push({
      id: f.getId(), name: f.getName(), mimeType: f.getMimeType(),
      size: f.getSize(), url: f.getUrl(),
      updatedAt: f.getLastUpdated().toISOString()
    });
  }
  files.sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
  return { ok: true, files: files, folderUrl: folder.getUrl() };
}

function handleUploadFile_(user, data) {
  var folderId = String(data.folderId || '');
  if (!folderId) return { ok: false, error: 'missing_folder' };
  var base64 = String(data.base64 || '');
  if (!base64) return { ok: false, error: 'missing_file' };
  var bytes;
  try { bytes = Utilities.base64Decode(base64); }
  catch (e) { return { ok: false, error: 'bad_file' }; }
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: 'file_too_big' };
  var folder;
  try { folder = DriveApp.getFolderById(folderId); }
  catch (e) { return { ok: false, error: 'folder_not_found' }; }
  var blob = Utilities.newBlob(bytes, String(data.mimeType || 'application/octet-stream'), String(data.filename || 'קובץ'));
  var file = folder.createFile(blob);
  return { ok: true, file: { id: file.getId(), name: file.getName(), mimeType: file.getMimeType(), size: file.getSize(), url: file.getUrl() } };
}

function handleDeleteFile_(user, role, data) {
  if (role !== 'boss') return { ok: false, error: 'forbidden' };
  try {
    DriveApp.getFileById(String(data.fileId || '')).setTrashed(true);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'file_not_found' };
  }
}

// ================================================================
// עזרי תצוגה ליומן השינויים
// ================================================================

var FIELD_LABELS = {
  name: 'שם', client: 'לקוח', clientId: 'לקוח', type: 'סוג', status: 'סטטוס',
  deadline: 'דדליין', priority: 'דחיפות', description: 'תיאור',
  contactName: 'איש קשר', phone: 'טלפון', wechat: 'WeChat', field: 'תחום',
  notes: 'הערות', supplierId: 'ספק', email: 'אימייל'
};

function fieldLabel_(field) { return FIELD_LABELS[field] || field; }

function displayVal_(v) {
  if (v === null || v === undefined || v === '') return '(ריק)';
  if (typeof v === 'object') return '(עודכן)';
  return String(v).slice(0, 80);
}
