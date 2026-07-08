/* ================================================================
   פרויקטים — רשימה, פאנל, עיצובים, קבצים | שיאים 2.0
   ================================================================ */

let currentProjectId = null;
let currentProjectTab = 'details';
let currentDesignId = null;

/* ================= סינון ומיון ================= */

function textOfLogs(entries) {
  return (entries || []).map(e => e.text).join(' ');
}

/** חיפוש שמוצא גם בהערות ובעיצובים (שיפור מהמפרט) */
function projectMatchesSearch(p, q) {
  if (!q) return true;
  const hay = [
    p.name, clientName(p.clientId), p.status, supplierName(p.supplierId),
    textOfLogs(p.notes), textOfLogs(p.importantInfo),
    ...(p.designs || []).map(d => d.name + ' ' + textOfLogs(d.notes) + ' ' + textOfLogs(d.importantInfo))
  ].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

function getFilteredProjects() {
  const f = S.filters;
  let list = importProjects().filter(p => !!p.completed === S.showCompleted);
  if (f.search) list = list.filter(p => projectMatchesSearch(p, f.search));
  if (f.type) list = list.filter(p => p.type === f.type);
  if (f.status) list = list.filter(p => p.status === f.status);
  if (f.priority) list = list.filter(p => String(p.priority || 0) === f.priority);
  if (f.client) list = list.filter(p => p.clientId === f.client);
  if (f.deadline) list = list.filter(p => {
    const k = deadlineInfo(p.deadline).key;
    return f.deadline === 'none' ? k === 'none' : k === f.deadline;
  });
  // מיון: דחיפות יורדת → דדליין עולה (ללא דדליין בסוף)
  return list.sort((a, b) => {
    const pr = (b.priority || 0) - (a.priority || 0);
    if (pr) return pr;
    if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });
}

/* ================= תצוגת רשימת פרויקטים ================= */

function renderProjectsView() {
  const container = $('#view-container');
  const list = getFilteredProjects();
  const activeCount = importProjects().filter(p => !p.completed).length;
  const doneCount = importProjects().filter(p => p.completed).length;

  container.innerHTML =
    '<div class="page-header">' +
      '<div class="page-header-text">' +
        '<span class="page-title">' + (S.showCompleted ? 'פרויקטים שהסתיימו' : 'פרויקטים פעילים') + '</span>' +
        '<span class="page-meta">' + list.length + ' פרויקטים</span>' +
      '</div>' +
      '<div class="page-actions">' +
        '<button class="btn-secondary" id="toggle-completed">' +
          (S.showCompleted ? '← חזרה לפעילים (' + activeCount + ')' : 'הסתיימו (' + doneCount + ')') +
        '</button>' +
        '<button class="btn-gold" id="btn-add-project">+ פרויקט חדש</button>' +
      '</div>' +
    '</div>' +
    filtersBarHtml() +
    '<main class="project-list" id="project-list">' +
      (list.length ? list.map(projectRowHtml).join('') :
        '<div class="empty-state"><div class="big">📋</div>אין פרויקטים להצגה</div>') +
    '</main>';

  $('#toggle-completed').onclick = () => { S.showCompleted = !S.showCompleted; renderProjectsView(); };
  $('#btn-add-project').onclick = openAddProjectModal;
  wireFilters();
  container.querySelectorAll('.project-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const sub = e.target.closest('.design-subrow');
      if (sub) { openProjectPanel(row.dataset.id); openDesignPanel(row.dataset.id, sub.dataset.designId); return; }
      openProjectPanel(row.dataset.id);
    });
  });
}

function filtersBarHtml() {
  const f = S.filters;
  const statusOpts = S.statuses.map(s => '<option value="' + esc(s) + '"' + (f.status === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
  const clientOpts = S.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'))
    .map(c => '<option value="' + esc(c.id) + '"' + (f.client === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  return (
    '<div class="filters-bar" id="filters-bar">' +
      '<div class="search-wrap"><span class="search-ico">' + icon('search') + '</span>' +
        '<input type="text" id="f-search" class="filter-search" placeholder="חיפוש בשם, בהערות ובעיצובים..." value="' + esc(f.search) + '"></div>' +
      '<select id="f-type" class="filter-select">' +
        '<option value="">כל הסוגים</option>' +
        '<option value="client"' + (f.type === 'client' ? ' selected' : '') + '>לקוחות</option>' +
        '<option value="office"' + (f.type === 'office' ? ' selected' : '') + '>משרד</option>' +
      '</select>' +
      '<select id="f-status" class="filter-select"><option value="">כל הסטטוסים</option>' + statusOpts + '</select>' +
      '<select id="f-priority" class="filter-select">' +
        '<option value="">כל הדחיפויות</option>' +
        [5, 4, 3, 2, 1].map(n => '<option value="' + n + '"' + (f.priority === String(n) ? ' selected' : '') + '>' + '★'.repeat(n) + '</option>').join('') +
      '</select>' +
      '<select id="f-client" class="filter-select"><option value="">כל הלקוחות</option>' + clientOpts + '</select>' +
      '<select id="f-deadline" class="filter-select">' +
        '<option value="">כל הדדליינים</option>' +
        '<option value="overdue"' + (f.deadline === 'overdue' ? ' selected' : '') + '>⚠️ עבר</option>' +
        '<option value="soon"' + (f.deadline === 'soon' ? ' selected' : '') + '>⏰ השבוע</option>' +
        '<option value="none"' + (f.deadline === 'none' ? ' selected' : '') + '>ללא דדליין</option>' +
      '</select>' +
      '<button class="btn-clear-filters" id="f-clear">נקה</button>' +
    '</div>'
  );
}

function wireFilters() {
  const f = S.filters;
  let searchTimer;
  $('#f-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { f.search = e.target.value.trim(); refreshProjectListOnly(); }, 200);
  });
  [['f-type', 'type'], ['f-status', 'status'], ['f-priority', 'priority'], ['f-client', 'client'], ['f-deadline', 'deadline']]
    .forEach(([id, key]) => {
      $('#' + id).addEventListener('change', (e) => { f[key] = e.target.value; refreshProjectListOnly(); });
    });
  $('#f-clear').onclick = () => {
    S.filters = { search: '', type: '', status: '', priority: '', client: '', deadline: '' };
    renderProjectsView();
  };
}

function refreshProjectListOnly() {
  const listEl = $('#project-list');
  if (!listEl) return renderProjectsView();
  const list = getFilteredProjects();
  listEl.innerHTML = list.length ? list.map(projectRowHtml).join('') :
    '<div class="empty-state"><div class="big">📋</div>אין פרויקטים להצגה</div>';
  const meta = document.querySelector('.page-meta');
  if (meta) meta.textContent = list.length + ' פרויקטים';
  listEl.querySelectorAll('.project-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const sub = e.target.closest('.design-subrow');
      if (sub) { openProjectPanel(row.dataset.id); openDesignPanel(row.dataset.id, sub.dataset.designId); return; }
      openProjectPanel(row.dataset.id);
    });
  });
}

function projectRowHtml(p) {
  const dl = deadlineInfo(p.deadline);
  const cName = clientName(p.clientId);
  const indicators =
    ((p.notes || []).length ? icon('note') : '') +
    ((p.importantInfo || []).length ? icon('info') : '') +
    ((p.designs || []).length ? icon('design') : '') +
    ((p.documents || []).length ? icon('paperclip') : '');
  const designRows = (p.designs || []).map(d => {
    const ddl = deadlineInfo(d.deadline);
    return '<div class="design-subrow" data-design-id="' + esc(d.id) + '">' +
      '<span class="design-subrow-icn">' + icon('design') + '</span><span class="design-name">' + esc(d.name) + '</span>' +
      (d.status ? '<span class="tag tag-status">' + esc(d.status) + '</span>' : '') +
      (d.priority ? '<span class="priority-stars">' + stars(d.priority) + '</span>' : '') +
      (ddl.label ? '<span class="tag ' + ddl.cls + '">' + ddl.label + '</span>' : '') +
    '</div>';
  }).join('');

  return (
    '<div class="project-row pri-' + (p.priority || 0) + '" data-id="' + esc(p.id) + '">' +
      '<div class="project-row-top">' +
        '<span class="project-name">' + esc(p.name) + '</span>' +
        (p.priority ? '<span class="priority-stars">' + stars(p.priority) + '</span>' : '') +
        (p.status ? '<span class="tag tag-status">' + esc(p.status) + '</span>' : '') +
      '</div>' +
      '<div class="project-row-meta">' +
        (cName ? '<span class="row-client">' + icon('user') + esc(cName) + '</span>' : '') +
        '<span class="tag tag-type-' + esc(p.type) + '">' + (p.type === 'office' ? 'משרד' : 'לקוח') + '</span>' +
        (dl.label ? '<span class="tag ' + dl.cls + '">' + esc(dl.label) + '</span>' : '') +
        (p.etaIsrael ? '<span class="tag tag-eta">' + icon('truck') + 'הגעה · ' + esc(fmtDateBoth(p.etaIsrael)) + '</span>' : '') +
        (indicators ? '<span class="row-indicators">' + indicators + '</span>' : '') +
      '</div>' +
      (designRows ? '<div class="design-subrows">' + designRows + '</div>' : '') +
    '</div>'
  );
}

/* ================= פאנל פרויקט ================= */

function openProjectPanel(id, tab) {
  // פרויקטי עיצוב נפתחים בפאנל הייעודי שלהם (ניהול נפרד מהייבוא)
  const proj = getProject(id);
  if (isDesignProject(proj)) { openDesignProjectPanel(id); return; }
  currentProjectId = id;
  currentProjectTab = tab || 'details';
  renderProjectPanel();
  openPanel('project-panel');
}

function renderProjectPanel() {
  const p = getProject(currentProjectId);
  if (!p) { closePanel('project-panel'); return; }
  // אם מדובר בפרויקט עיצוב (למשל אחרי עריכת נכס) — לרנדר את הפאנל הייעודי
  if (isDesignProject(p)) { renderDesignProjectPanel(); return; }

  $('#project-panel .panel-title').textContent = p.name;
  $$('#project-tabs .panel-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === currentProjectTab);
    t.onclick = () => { currentProjectTab = t.dataset.tab; renderProjectPanel(); };
  });

  const body = $('#project-panel-body');
  if (currentProjectTab === 'details') renderProjectDetailsTab(body, p);
  else if (currentProjectTab === 'development') renderProjectDevelopmentTab(body, p);
  else if (currentProjectTab === 'designs') renderProjectDesignsTab(body, p);
  else if (currentProjectTab === 'documents') renderProjectDocumentsTab(body, p);
  else if (currentProjectTab === 'calculator') renderProjectCalculatorTab(body, p);
  else renderProjectNotesTab(body, p);

  // Footer
  const footer = $('#project-panel-footer');
  footer.innerHTML = p.completed
    ? '<button class="btn-secondary" id="pp-restore">↩ החזר לפעילים</button>' +
      (isBoss() ? '<button class="btn-danger" id="pp-delete">🗑 מחק לצמיתות</button>' : '')
    : '<button class="btn-gold" id="pp-complete">✅ סיים פרויקט</button>' +
      (isBoss() ? '<button class="btn-danger" id="pp-delete">🗑 מחק לצמיתות</button>' : '');

  const btnC = $('#pp-complete'), btnR = $('#pp-restore'), btnD = $('#pp-delete');
  if (btnC) btnC.onclick = () => completeProjectFlow(p.id);
  if (btnR) btnR.onclick = () => restoreProjectFlow(p.id);
  if (btnD) btnD.onclick = () => deleteProjectFlow(p.id);
}

/** רשימת הקטגוריות הקיימות לבחירה */
function categoryOptions() {
  const cats = {};
  importProjects().forEach(p => { if (p.category) cats[p.category] = true; });
  return [{ value: '', label: '— ללא —' }]
    .concat(Object.keys(cats).sort((a, b) => a.localeCompare(b, 'he')).map(c => ({ value: c, label: c })))
    .concat([{ value: '__new__', label: '+ קטגוריה חדשה...' }]);
}

/** רשימת המכולות/משלוחים הקיימים לבחירה */
function shipmentOptions() {
  const names = {};
  importProjects().forEach(p => { if (p.shipmentName) names[p.shipmentName] = true; });
  return [{ value: '', label: '— ללא —' }]
    .concat(Object.keys(names).sort().map(n => ({ value: n, label: n })))
    .concat([{ value: '__new__', label: '+ מכולה / משלוח חדש...' }]);
}

/** סיכום מכולה משותפת — כל הפרויקטים באותו משלוח, ונפח מצטבר מול הקיבולת */
function shipmentSummaryHtml(p) {
  if (!p.shipmentName) return '';
  const group = importProjects().filter(x => !x.completed && x.shipmentName === p.shipmentName);
  const total = group.reduce((s, x) => s + projectVolume(x), 0);
  const cap20 = 28, cap40 = 67;
  const rows = group.map(x => {
    const v = projectVolume(x);
    return '<div class="ship-grp-item' + (x.id === p.id ? ' me' : '') + '" data-id="' + esc(x.id) + '">' +
      '<span>' + esc(x.name) + (x.id === p.id ? ' (הפרויקט הזה)' : '') + '</span>' +
      '<span>' + (Math.round(v * 100) / 100) + ' מ״ק</span></div>';
  }).join('');
  return (
    '<div class="ship-grp">' +
      '<div class="ship-grp-head">' + icon('truck') + ' מכולה משותפת: "' + esc(p.shipmentName) + '" · ' + group.length + ' מוצרים</div>' +
      rows +
      '<div class="ship-grp-total">נפח מצטבר: <b>' + (Math.round(total * 100) / 100) + ' מ״ק</b> · ' +
        Math.round(total / cap40 * 100) + '% ממכולת 40׳ · ' + Math.round(total / cap20 * 100) + '% ממכולת 20׳</div>' +
      (total > cap40 ? '<div class="ship-grp-warn">⚠️ חורג ממכולת 40׳ אחת — שקול מכולה נוספת או פיצול</div>' :
        (total > cap20 && total <= cap40 ? '<div class="ship-grp-ok">✓ נכנס במכולת 40׳</div>' :
        (total > 0 && total <= cap20 ? '<div class="ship-grp-ok">✓ נכנס במכולת 20׳</div>' : ''))) +
    '</div>'
  );
}

function clientOptions() {
  return [{ value: '', label: '— ללא לקוח —' }]
    .concat(S.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(c => ({ value: c.id, label: c.name })))
    .concat([{ value: '__new__', label: '+ לקוח חדש...' }]);
}

function supplierOptions() {
  return [{ value: '', label: '— ללא ספק —' }]
    .concat(S.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(s => ({ value: s.id, label: s.name })));
}

function renderProjectDetailsTab(body, p) {
  body.innerHTML =
    fieldRowHtml({ label: 'שם', field: 'name', value: p.name }) +
    (p.nameOriginal ? '<div class="field-row"><span class="field-label">שם מקורי</span><span class="field-value readonly">' + esc(p.nameOriginal) + '</span></div>' : '') +
    fieldRowHtml({ label: 'לקוח', field: 'clientId', value: p.clientId, display: clientName(p.clientId), type: 'select' }) +
    fieldRowHtml({ label: 'סוג', field: 'type', value: p.type, display: p.type === 'office' ? 'פרויקט משרד' : 'פרויקט לקוח', type: 'select' }) +
    fieldRowHtml({ label: 'קטגוריה', field: 'category', value: p.category, type: 'select' }) +
    fieldRowHtml({ label: 'סטטוס', field: 'status', value: p.status, type: 'select' }) +
    fieldRowHtml({ label: 'דדליין', field: 'deadline', value: p.deadline, display: p.deadline ? fmtDateBoth(p.deadline) : '', type: 'date' }) +
    fieldRowHtml({ label: 'צפי הגעה לישראל', field: 'etaIsrael', value: p.etaIsrael, display: p.etaIsrael ? fmtDateBoth(p.etaIsrael) : '', type: 'date' }) +
    priorityRowHtml(p.priority, isBoss()) +
    fieldRowHtml({ label: 'ספק', field: 'supplierId', value: p.supplierId, display: supplierName(p.supplierId), type: 'select' }) +
    fieldRowHtml({ label: 'כתובת איסוף', field: 'pickupAddress', value: p.pickupAddress, type: 'textarea' }) +
    fieldRowHtml({ label: 'נמל יציאה', field: 'port', value: p.port }) +
    fieldRowHtml({ label: 'שיוך למכולה', field: 'shipmentName', value: p.shipmentName, type: 'select' }) +
    fieldRowHtml({ label: 'חלקי חילוף / ספייר', field: 'spareParts', value: p.spareParts, type: 'textarea' }) +
    shipmentSummaryHtml(p) +
    '<div class="field-row"><span class="field-label">נוצר</span><span class="field-value readonly">' +
      esc(fmtDateBoth(p.createdAt) + ' · ' + userDisplay(p.createdBy)) + '</span></div>' +
    filesSectionHtml(p);

  wireInlineEdits(body, {
    getValue: (f) => p[f],
    options: (f) => {
      if (f === 'clientId') return clientOptions();
      if (f === 'supplierId') return supplierOptions();
      if (f === 'shipmentName') return shipmentOptions();
      if (f === 'category') return categoryOptions();
      if (f === 'type') return [{ value: 'client', label: 'פרויקט לקוח' }, { value: 'office', label: 'פרויקט משרד' }];
      if (f === 'status') return S.statuses.map(s => ({ value: s, label: s }));
      return null;
    },
    save: async (f, v) => {
      if (f === 'clientId' && v === '__new__') { openAddClientModal((newId) => saveProjectField(p.id, 'clientId', newId)); renderProjectPanel(); return; }
      if (f === 'shipmentName' && v === '__new__') {
        openModal({
          title: 'מכולה / משלוח חדש', maxWidth: '360px',
          bodyHtml: '<div class="form-group"><label class="form-label">שם המכולה / המשלוח</label><input type="text" id="new-shipment" class="form-input" placeholder="למשל: מכולה - דצמבר"></div>',
          footerHtml: '<button class="btn-gold" id="new-shipment-ok">שמור</button><button class="btn-secondary btn-modal-close">ביטול</button>',
          onOpen(back, close) {
            back.querySelector('#new-shipment-ok').onclick = () => {
              const name = back.querySelector('#new-shipment').value.trim();
              if (!name) { toast('צריך שם', 'error'); return; }
              close(); saveProjectField(p.id, 'shipmentName', name);
            };
          }
        });
        renderProjectPanel();
        return;
      }
      if (f === 'category' && v === '__new__') {
        openModal({
          title: 'קטגוריה חדשה', maxWidth: '360px',
          bodyHtml: '<div class="form-group"><label class="form-label">שם הקטגוריה</label><input type="text" id="new-cat" class="form-input" placeholder="למשל: צעצועים / אקריליק / אריזות"></div>',
          footerHtml: '<button class="btn-gold" id="new-cat-ok">שמור</button><button class="btn-secondary btn-modal-close">ביטול</button>',
          onOpen(back, close) {
            back.querySelector('#new-cat-ok').onclick = () => {
              const name = back.querySelector('#new-cat').value.trim();
              if (!name) { toast('צריך שם', 'error'); return; }
              close(); saveProjectField(p.id, 'category', name);
            };
          }
        });
        renderProjectPanel();
        return;
      }
      await saveProjectField(p.id, f, v);
    }
  });
  wirePriority(body, { editable: isBoss(), save: (v) => saveProjectField(p.id, 'priority', v) });
  wireFilesSection(body, p);
  body.querySelectorAll('.ship-grp-item').forEach(item => {
    item.addEventListener('click', () => { if (item.dataset.id !== p.id) openProjectPanel(item.dataset.id); });
  });
}

async function saveProjectField(id, field, value) {
  await updateFieldOptimistic('project', id, field, value, () => {
    renderProjectPanel();
    renderCurrentView();
  });
}

function renderProjectNotesTab(body, p) {
  body.innerHTML = logSectionHtml('importantInfo', p.importantInfo) + logSectionHtml('notes', p.notes);
  wireLogSections(body, {
    save: async (area, text) => {
      try {
        const res = await api('addLog', { entity: 'project', id: p.id, area, text });
        if (res.obj) mergeEntity('project', res.obj);
        else { p[area] = p[area] || []; p[area].push({ date: new Date().toISOString(), user: S.user, text }); }
        toast(res.queued ? 'נשמר במכשיר ⏳' : 'נשמר ✓', res.queued ? '' : 'success');
        renderProjectPanel();
      } catch (e) { toast(friendlyError(e.code), 'error'); }
    }
  });
}

/* ================= טאב פיתוח מוצר ================= */

function renderProjectDevelopmentTab(body, p) {
  const d = p.development || {};
  const sampleDocs = (p.documents || []).filter(x => x.section === 'sample');
  body.innerHTML =
    '<div class="log-section-title">🏭 מפעל והצעת מחיר</div>' +
    fieldRowHtml({ label: 'מפעל / איתור', field: 'factory', value: d.factory }) +
    fieldRowHtml({ label: 'הצעת מחיר ($)', field: 'quotePrice', value: d.quotePrice }) +
    fieldRowHtml({ label: 'נתוני המוצר בהצעה', field: 'quoteProductData', value: d.quoteProductData, type: 'textarea' }) +
    fieldRowHtml({ label: 'הערות לשינויים ועיצוב אישי', field: 'quoteNotes', value: d.quoteNotes, type: 'textarea' }) +

    '<div class="log-section-title" style="margin-top:1.2rem">🧪 דוגמאות</div>' +
    fieldRowHtml({ label: 'סטטוס דוגמאות', field: 'sampleStatus', value: d.sampleStatus, type: 'select' }) +
    fieldRowHtml({ label: 'סטטוס משלוח דוגמאות', field: 'sampleShipStatus', value: d.sampleShipStatus, type: 'select' }) +
    fieldRowHtml({ label: 'עלות משלוח דוגמאות ($)', field: 'sampleShipCost', value: d.sampleShipCost }) +

    '<div class="log-section-title" style="margin-top:1.1rem">🧾 חשבונית דוגמאות</div>' +
    '<div class="files-list" id="dev-sample-files">' +
      (sampleDocs.length ? sampleDocs.map(f =>
        '<div class="file-row"><span>' + fileIcon(f.mimeType) + '</span>' +
        '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' +
        (isBoss() ? '<button class="file-del" data-doc-id="' + esc(f.id) + '">🗑</button>' : '') + '</div>').join('')
        : '<div style="color:var(--text-muted)">אין עדיין חשבונית דוגמאות</div>') +
    '</div>' +
    (IS_DEMO ? '<div class="form-hint">העלאת חשבונית תעבוד אחרי חיבור לשרת</div>' :
      '<div class="upload-row"><input type="file" id="dev-sample-input" style="display:none"><button class="btn-secondary" id="dev-sample-upload">⬆ העלה חשבונית דוגמאות</button></div>');

  wireInlineEdits(body, {
    getValue: (f) => (p.development || {})[f],
    options: (f) => {
      if (f === 'sampleStatus') return ['לא הוזמנו', 'הוזמנו', 'בייצור', 'נשלחו', 'התקבלו', 'אושרו', 'נדחו'].map(s => ({ value: s, label: s }));
      if (f === 'sampleShipStatus') return ['—', 'נשלח', 'בדרך', 'הגיע לישראל'].map(s => ({ value: s, label: s }));
      return null;
    },
    save: (f, v) => saveDevField(p, f, v)
  });

  const inp = body.querySelector('#dev-sample-input');
  const upBtn = body.querySelector('#dev-sample-upload');
  if (upBtn && inp) {
    upBtn.onclick = () => { inp.value = ''; inp.click(); };
    inp.onchange = async () => {
      const f = inp.files[0];
      if (!f) return;
      if (f.size > 20 * 1024 * 1024) { toast('הקובץ גדול מדי — עד 20MB', 'error'); return; }
      await uploadDocument(p, 'sample', 'חשבונית דוגמאות', f);
    };
  }
  body.querySelectorAll('#dev-sample-files .file-del').forEach(b => {
    b.onclick = () => deleteDocument(p, b.dataset.docId);
  });
}

async function saveDevField(p, field, value) {
  const dev = Object.assign({}, p.development || {});
  dev[field] = value;
  p.development = dev;
  try {
    const res = await api('updateField', { entity: 'project', id: p.id, field: 'development', value: dev });
    if (res.obj) mergeEntity('project', res.obj);
    toast(res.queued ? 'נשמר במכשיר ⏳' : 'נשמר ✓', res.queued ? '' : 'success');
    renderProjectPanel();
  } catch (e) { toast(friendlyError(e.code), 'error'); }
}

/* ================= טאב "עיצוב" בפרויקט ייבוא (חלון לקריאה בלבד) =================
   ניהול העיצוב עצמו נעשה באזור "עיצובים" הנפרד. כאן רק רואים את פרויקטי
   העיצוב המקושרים ואת הקבצים הסופיים שסונכרנו אליהם — הפונקציה ב-design.js. */

function renderProjectDesignsTab(body, p) {
  renderImportProjectDesignWindow(body, p);
}

function filesSectionHtml(p) {
  return (
    '<div class="log-section-title" style="margin-top:1.2rem">📁 קבצי הפרויקט' +
      (p.folderId ? ' <a id="folder-link" href="https://drive.google.com/drive/folders/' + esc(p.folderId) + '" target="_blank" rel="noopener" style="font-size:.85rem">פתח תיקייה ב-Drive</a>' : '') +
    '</div>' +
    '<div class="files-list" id="files-list">' +
      (p.folderId || !IS_DEMO ? '<div style="color:var(--text-muted)">טוען קבצים...</div>' : '<div style="color:var(--text-muted)">העלאת קבצים תעבוד אחרי חיבור לשרת האמיתי</div>') +
    '</div>' +
    '<div class="upload-row">' +
      '<input type="file" id="file-input" style="display:none">' +
      '<button class="btn-secondary" id="btn-upload">⬆ העלה קובץ</button>' +
      '<span class="form-hint">עד 20MB, נשמר בתיקיית הפרויקט ב-Drive</span>' +
    '</div>'
  );
}

async function wireFilesSection(body, p) {
  const fileInput = body.querySelector('#file-input');
  const btnUpload = body.querySelector('#btn-upload');
  if (!btnUpload) return;
  btnUpload.onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('הקובץ גדול מדי — עד 20MB', 'error'); return; }
    btnUpload.disabled = true; btnUpload.textContent = 'מעלה...';
    try {
      const base64 = await fileToBase64(file);
      await api('uploadFile', { folderId: p.folderId, filename: file.name, base64, mimeType: file.type }, { noQueue: true });
      toast('הקובץ הועלה ✓', 'success');
      loadFilesList(body, p);
    } catch (e) {
      toast(e.code === 'network' ? 'העלאת קבצים דורשת חיבור לאינטרנט' : friendlyError(e.code), 'error');
    } finally {
      btnUpload.disabled = false; btnUpload.textContent = '⬆ העלה קובץ';
      fileInput.value = '';
    }
  };
  if (p.folderId && !IS_DEMO) loadFilesList(body, p);
  else if (IS_DEMO) body.querySelector('#files-list').innerHTML = '<div style="color:var(--text-muted)">במצב הדגמה אין חיבור ל-Drive</div>';
}

async function loadFilesList(body, p) {
  const listEl = body.querySelector('#files-list');
  if (!listEl) return;
  try {
    const res = await api('getFiles', { folderId: p.folderId });
    const files = res.files || [];
    listEl.innerHTML = files.length ? files.map(f =>
      '<div class="file-row">' +
        '<span>' + fileIcon(f.mimeType) + '</span>' +
        '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' +
        '<span class="file-size">' + formatFileSize(f.size) + '</span>' +
        (isBoss() ? '<button class="file-del" data-file-id="' + esc(f.id) + '" title="מחיקת קובץ">🗑</button>' : '') +
      '</div>'
    ).join('') : '<div style="color:var(--text-muted)">אין עדיין קבצים</div>';
    listEl.querySelectorAll('.file-del').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const ok = await confirmModal({ title: 'מחיקת קובץ', message: 'למחוק את הקובץ מהתיקייה?', btnLabel: 'מחק' });
        if (!ok) return;
        try {
          await api('deleteFile', { fileId: btn.dataset.fileId }, { noQueue: true });
          toast('הקובץ נמחק ✓', 'success');
          loadFilesList(body, p);
        } catch (err) { toast(friendlyError(err.code), 'error'); }
      };
    });
  } catch (e) {
    listEl.innerHTML = '<div style="color:var(--text-muted)">לא הצלחנו לטעון את הקבצים כרגע</div>';
  }
}

/* ================= פאנל עיצוב ================= */

function openDesignPanel(projectId, designId) {
  currentProjectId = projectId;
  currentDesignId = designId;
  renderDesignPanel();
  openPanel('design-panel');
}

function renderDesignPanel() {
  const p = getProject(currentProjectId);
  const d = p && (p.designs || []).find(x => x.id === currentDesignId);
  if (!d) { closePanel('design-panel'); return; }

  $('#design-panel .panel-title').textContent = 'עיצוב — ' + d.name;
  const body = $('#design-panel-body');
  body.innerHTML =
    fieldRowHtml({ label: 'שם', field: 'name', value: d.name }) +
    fieldRowHtml({ label: 'סוג נכס', field: 'assetType', value: d.assetType, type: 'select' }) +
    fieldRowHtml({ label: 'סטטוס עיצוב', field: 'status', value: d.status, type: 'select' }) +
    fieldRowHtml({ label: 'מי מטפל', field: 'assignedTo', value: d.assignedTo }) +
    fieldRowHtml({ label: 'דדליין', field: 'deadline', value: d.deadline, display: d.deadline ? fmtDateBoth(d.deadline) : '', type: 'date' }) +
    priorityRowHtml(d.priority, isBoss()) +
    fieldRowHtml({ label: 'פרומפט AI', field: 'aiPrompt', value: d.aiPrompt, type: 'textarea' }) +
    designFilesHtml(p, d) +
    designQAHtml(d) +
    logSectionHtml('importantInfo', d.importantInfo) +
    logSectionHtml('notes', d.notes);

  wireInlineEdits(body, {
    getValue: (f) => d[f],
    options: (f) => {
      if (f === 'status') return designStatusOptions();
      if (f === 'assetType') return assetTypeOptions();
      return null;
    },
    save: (f, v) => saveDesignField(p.id, d.id, f, v)
  });
  wireDesignFiles(body, p, d);
  wireDesignQA(body, p, d);
  wirePriority(body, { editable: isBoss(), save: (v) => saveDesignField(p.id, d.id, 'priority', v) });
  wireLogSections(body, {
    save: async (area, text) => {
      try {
        const res = await api('addDesignLog', { projectId: p.id, designId: d.id, area, text });
        if (res.obj) mergeEntity('project', res.obj);
        else { d[area] = d[area] || []; d[area].push({ date: new Date().toISOString(), user: S.user, text }); }
        toast('נשמר ✓', 'success');
        renderDesignPanel();
      } catch (e) { toast(friendlyError(e.code), 'error'); }
    }
  });

  $('#design-panel-footer').innerHTML = '<button class="btn-danger" id="dp-delete">🗑 מחק עיצוב</button>';
  $('#dp-delete').onclick = () => deleteDesignFlow(p.id, d.id);
}

async function saveDesignField(projectId, designId, field, value) {
  const p = getProject(projectId);
  const d = p && (p.designs || []).find(x => x.id === designId);
  if (!d) return;
  const old = d[field];
  d[field] = field === 'priority' ? Number(value) : value;
  renderDesignPanel();
  renderCurrentView();
  try {
    const res = await api('updateDesignField', { projectId, designId, field, value: d[field] });
    if (res.obj) mergeEntity('project', res.obj);
    toast(res.queued ? 'נשמר במכשיר ⏳' : 'נשמר ✓', res.queued ? '' : 'success');
  } catch (e) {
    d[field] = old;
    renderDesignPanel();
    toast(friendlyError(e.code), 'error');
  }
}

/* ---- קבצי עיצוב (הדמיות, קבצי מקור) ---- */

function designFiles(d) { return d.files || []; }

function designFilesHtml(p, d) {
  const files = designFiles(d);
  let gallery;
  if (IS_DEMO) {
    gallery = '<div class="doc-empty">📎 העלאת קבצים תעבוד אחרי חיבור לשרת האמיתי</div>';
  } else if (!files.length) {
    gallery = '<div class="doc-empty">אין עדיין קבצים לעיצוב הזה.</div>';
  } else {
    gallery = '<div class="idea-gallery">' + files.map(f => {
      const isImg = String(f.mimeType || '').indexOf('image/') === 0;
      return '<div class="idea-img" data-file-id="' + esc(f.id) + '">' +
        (isImg
          ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img src="https://drive.google.com/thumbnail?id=' + esc(f.fileId) + '&sz=w400" alt="' + esc(f.name) + '" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'idea-img-fallback\',textContent:\'📎 ' + esc(f.name).replace(/'/g, '') + '\'}))"></a>'
          : '<a class="idea-img-fallback" href="' + esc(f.url) + '" target="_blank" rel="noopener">' + fileIcon(f.mimeType) + ' ' + esc(f.name) + '</a>') +
        '<button class="idea-img-del" data-file-id="' + esc(f.id) + '" title="הסר">✕</button>' +
      '</div>';
    }).join('') + '</div>';
  }
  return (
    '<div class="log-section-title" style="margin-top:1.1rem">🎨 קבצי העיצוב</div>' +
    gallery +
    (IS_DEMO ? '' : '<div class="upload-row"><input type="file" id="design-file-input" style="display:none"><button class="btn-secondary" id="design-file-upload">⬆ העלה קובץ עיצוב</button></div>')
  );
}

function wireDesignFiles(body, p, d) {
  const input = body.querySelector('#design-file-input');
  const btn = body.querySelector('#design-file-upload');
  if (btn && input) {
    btn.onclick = () => { input.value = ''; input.click(); };
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) { toast('הקובץ גדול מדי — עד 20MB', 'error'); return; }
      await uploadDesignFile(p, d, file);
    };
  }
  body.querySelectorAll('.idea-img-del').forEach(b => {
    b.onclick = () => deleteDesignFileEntry(p, d, b.dataset.fileId);
  });
}

async function uploadDesignFile(project, design, file) {
  showSpinner(true);
  try {
    if (!project.folderId) {
      const fr = await api('ensureFolder', { entity: 'project', id: project.id }, { noQueue: true });
      if (fr.folderId) project.folderId = fr.folderId; else throw { code: fr.error || 'folder_failed' };
    }
    const res = await api('uploadFile', { folderId: project.folderId, filename: 'עיצוב ' + design.name + ' — ' + file.name, base64: await fileToBase64(file), mimeType: file.type }, { noQueue: true });
    const f = res.file;
    const entry = { id: uid(), fileId: f.id, name: f.name, url: f.url, mimeType: f.mimeType, size: f.size, date: new Date().toISOString(), user: S.user };
    design.files = designFiles(design).concat([entry]);
    const r2 = await api('updateDesignField', { projectId: project.id, designId: design.id, field: 'files', value: design.files });
    if (r2.obj) mergeEntity('project', r2.obj);
    toast('הקובץ הועלה ✓', 'success');
    renderDesignPanel();
  } catch (e) {
    toast(e.code === 'network' ? 'העלאת קבצים דורשת חיבור לאינטרנט' : friendlyError(e.code), 'error');
  } finally {
    showSpinner(false);
  }
}

function deleteDesignFileEntry(project, design, fileEntryId) {
  const f = designFiles(design).find(x => x.id === fileEntryId);
  if (!f) return;
  confirmModal({ title: 'הסרת קובץ', message: 'להסיר את "' + f.name + '"? הקובץ יעבור לסל האשפה ב-Drive.', btnLabel: 'הסר' }).then(async ok => {
    if (!ok) return;
    design.files = designFiles(design).filter(x => x.id !== fileEntryId);
    renderDesignPanel();
    try {
      const r2 = await api('updateDesignField', { projectId: project.id, designId: design.id, field: 'files', value: design.files });
      if (r2.obj) mergeEntity('project', r2.obj);
      if (f.fileId) api('deleteFile', { fileId: f.fileId }, { noQueue: true }).catch(() => {});
      toast('הקובץ הוסר ✓', 'success');
    } catch (e) { toast(friendlyError(e.code), 'error'); }
  });
}

function deleteDesignFlow(projectId, designId) {
  const p = getProject(projectId);
  const d = p && (p.designs || []).find(x => x.id === designId);
  if (!d) return;
  confirmModal({ title: 'מחיקת עיצוב', message: 'למחוק את העיצוב "' + d.name + '"?', btnLabel: 'מחק' }).then(ok => {
    if (!ok) return;
    const idx = p.designs.indexOf(d);
    doWithUndo({
      message: 'העיצוב נמחק',
      apply: () => { p.designs.splice(idx, 1); closePanel('design-panel'); renderProjectPanel(); renderCurrentView(); },
      commit: async () => {
        const res = await api('deleteDesign', { projectId, designId });
        if (res.obj) mergeEntity('project', res.obj);
      },
      revert: () => { p.designs.splice(idx, 0, d); renderProjectPanel(); }
    });
  });
}

/* ================= סיום / החזרה / מחיקה של פרויקט ================= */

function completeProjectFlow(id) {
  const p = getProject(id);
  if (!p) return;
  confirmModal({ title: 'סיום פרויקט', message: 'לסמן את "' + p.name + '" כפרויקט שהסתיים? (אפשר תמיד להחזיר)', btnLabel: '✅ סיים', danger: false }).then(ok => {
    if (!ok) return;
    doWithUndo({
      message: 'הפרויקט הועבר להסתיימו',
      apply: () => { p.completed = true; closePanel('project-panel'); renderCurrentView(); updateNavCounts(); },
      commit: async () => { const res = await api('completeProject', { id }); if (res.obj) mergeEntity('project', res.obj); },
      revert: () => { p.completed = false; updateNavCounts(); }
    });
  });
}

function restoreProjectFlow(id) {
  const p = getProject(id);
  if (!p) return;
  doWithUndo({
    message: 'הפרויקט חזר לפעילים',
    apply: () => { p.completed = false; closePanel('project-panel'); renderCurrentView(); updateNavCounts(); },
    commit: async () => { const res = await api('restoreProject', { id }); if (res.obj) mergeEntity('project', res.obj); },
    revert: () => { p.completed = true; updateNavCounts(); }
  });
}

function deleteProjectFlow(id) {
  const p = getProject(id);
  if (!p) return;
  confirmModal({
    title: 'מחיקה לצמיתות',
    message: 'למחוק לגמרי את "' + p.name + '"? הפרויקט ייעלם מהמערכת (הקבצים ב-Drive נשארים).',
    btnLabel: '🗑 מחק לצמיתות'
  }).then(ok => {
    if (!ok) return;
    const idx = S.projects.indexOf(p);
    doWithUndo({
      message: 'הפרויקט נמחק',
      apply: () => { S.projects.splice(idx, 1); closePanel('project-panel'); renderCurrentView(); updateNavCounts(); },
      commit: () => api('delete', { entity: 'project', id }),
      revert: () => { S.projects.splice(idx, 0, p); updateNavCounts(); }
    });
  });
}

/* ================= הוספת פרויקט ================= */

function openAddProjectModal(presets = {}) {
  const statusOpts = S.statuses.map((s, i) => '<option value="' + esc(s) + '"' + (i === 0 ? ' selected' : '') + '>' + esc(s) + '</option>').join('');
  const clientOpts = S.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'))
    .map(c => '<option value="' + esc(c.id) + '"' + (presets.clientId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');

  openModal({
    title: 'פרויקט חדש',
    bodyHtml:
      '<div class="form-group"><label class="form-label">שם הפרויקט *</label>' +
        '<input type="text" id="ap-name" class="form-input" value="' + esc(presets.name || '') + '"></div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label class="form-label">לקוח</label>' +
          '<select id="ap-client" class="form-select"><option value="">— ללא —</option>' + clientOpts + '<option value="__new__">+ לקוח חדש...</option></select></div>' +
        '<div class="form-group"><label class="form-label">סוג</label>' +
          '<select id="ap-type" class="form-select"><option value="client">פרויקט לקוח</option><option value="office">פרויקט משרד</option></select></div>' +
      '</div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label class="form-label">סטטוס</label><select id="ap-status" class="form-select">' + statusOpts + '</select></div>' +
        '<div class="form-group"><label class="form-label">דדליין</label><input type="date" id="ap-deadline" class="form-input"></div>' +
      '</div>',
    footerHtml: '<button class="btn-gold" id="ap-submit">הוסף פרויקט</button><button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      attachHebrewHint(back.querySelector('#ap-deadline'));
      back.querySelector('#ap-client').addEventListener('change', (e) => {
        if (e.target.value === '__new__') {
          openAddClientModal((newId) => {
            const sel = back.querySelector('#ap-client');
            const opt = document.createElement('option');
            const c = getClient(newId);
            opt.value = newId; opt.textContent = c ? c.name : 'לקוח חדש'; opt.selected = true;
            sel.insertBefore(opt, sel.lastElementChild);
          });
          e.target.value = '';
        }
      });
      back.querySelector('#ap-submit').onclick = async () => {
        const name = back.querySelector('#ap-name').value.trim();
        if (!name) { toast('חסר שם לפרויקט', 'error'); return; }
        const obj = {
          id: uid(), name,
          clientId: back.querySelector('#ap-client').value === '__new__' ? '' : back.querySelector('#ap-client').value,
          type: back.querySelector('#ap-type').value,
          status: back.querySelector('#ap-status').value,
          deadline: back.querySelector('#ap-deadline').value,
          priority: 0, notes: presets.notes || [], importantInfo: [], designs: [],
          completed: false, folderId: '', supplierId: ''
        };
        close();
        S.projects.push(obj);
        renderCurrentView(); updateNavCounts();
        try {
          const res = await api('create', { entity: 'project', obj });
          if (res.obj) mergeEntity('project', res.obj);
          toast(res.queued ? 'נשמר במכשיר ⏳' : 'הפרויקט נוסף ✓', res.queued ? '' : 'success');
          renderCurrentView();
          if (presets.afterCreate) presets.afterCreate(res.obj || obj);
        } catch (e) {
          removeEntity('project', obj.id);
          renderCurrentView(); updateNavCounts();
          toast(friendlyError(e.code), 'error');
        }
      };
    }
  });
}
