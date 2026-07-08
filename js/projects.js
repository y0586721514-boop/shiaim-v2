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
  let list = S.projects.filter(p => !!p.completed === S.showCompleted);
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
  const activeCount = S.projects.filter(p => !p.completed).length;
  const doneCount = S.projects.filter(p => p.completed).length;

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
      '<div class="search-wrap"><span class="search-ico">🔍</span>' +
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
    ((p.notes || []).length ? '💬' : '') +
    ((p.importantInfo || []).length ? 'ℹ️' : '') +
    ((p.designs || []).length ? '🎨' : '');
  const designRows = (p.designs || []).map(d => {
    const ddl = deadlineInfo(d.deadline);
    return '<div class="design-subrow" data-design-id="' + esc(d.id) + '">' +
      '<span>🎨</span><span class="design-name">' + esc(d.name) + '</span>' +
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
        (cName ? '<span>👤 ' + esc(cName) + '</span>' : '') +
        '<span class="tag tag-type-' + esc(p.type) + '">' + (p.type === 'office' ? 'משרד' : 'לקוח') + '</span>' +
        (dl.label ? '<span class="tag ' + dl.cls + '">' + dl.label + '</span>' : '') +
        (indicators ? '<span class="row-indicators">' + indicators + '</span>' : '') +
      '</div>' +
      (designRows ? '<div class="design-subrows">' + designRows + '</div>' : '') +
    '</div>'
  );
}

/* ================= פאנל פרויקט ================= */

function openProjectPanel(id, tab) {
  currentProjectId = id;
  currentProjectTab = tab || 'details';
  renderProjectPanel();
  openPanel('project-panel');
}

function renderProjectPanel() {
  const p = getProject(currentProjectId);
  if (!p) { closePanel('project-panel'); return; }

  $('#project-panel .panel-title').textContent = p.name;
  $$('#project-tabs .panel-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === currentProjectTab);
    t.onclick = () => { currentProjectTab = t.dataset.tab; renderProjectPanel(); };
  });

  const body = $('#project-panel-body');
  if (currentProjectTab === 'details') renderProjectDetailsTab(body, p);
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
    fieldRowHtml({ label: 'לקוח', field: 'clientId', value: p.clientId, display: clientName(p.clientId), type: 'select' }) +
    fieldRowHtml({ label: 'סוג', field: 'type', value: p.type, display: p.type === 'office' ? 'פרויקט משרד' : 'פרויקט לקוח', type: 'select' }) +
    fieldRowHtml({ label: 'סטטוס', field: 'status', value: p.status, type: 'select' }) +
    fieldRowHtml({ label: 'דדליין', field: 'deadline', value: p.deadline, display: p.deadline ? fmtDate(p.deadline) : '', type: 'date' }) +
    priorityRowHtml(p.priority, isBoss()) +
    fieldRowHtml({ label: 'ספק', field: 'supplierId', value: p.supplierId, display: supplierName(p.supplierId), type: 'select' }) +
    '<div class="field-row"><span class="field-label">נוצר</span><span class="field-value readonly">' +
      esc(fmtDate(p.createdAt) + ' ע"י ' + userDisplay(p.createdBy)) + '</span></div>' +
    filesSectionHtml(p);

  wireInlineEdits(body, {
    getValue: (f) => p[f],
    options: (f) => {
      if (f === 'clientId') return clientOptions();
      if (f === 'supplierId') return supplierOptions();
      if (f === 'type') return [{ value: 'client', label: 'פרויקט לקוח' }, { value: 'office', label: 'פרויקט משרד' }];
      if (f === 'status') return S.statuses.map(s => ({ value: s, label: s }));
      return null;
    },
    save: async (f, v) => {
      if (f === 'clientId' && v === '__new__') { openAddClientModal((newId) => saveProjectField(p.id, 'clientId', newId)); renderProjectPanel(); return; }
      await saveProjectField(p.id, f, v);
    }
  });
  wirePriority(body, { editable: isBoss(), save: (v) => saveProjectField(p.id, 'priority', v) });
  wireFilesSection(body, p);
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

/* ================= טאב עיצובים + קבצים ================= */

function renderProjectDesignsTab(body, p) {
  const designs = p.designs || [];
  body.innerHTML =
    '<div class="log-section-title">🎨 עיצובים</div>' +
    '<div class="card-list">' +
      (designs.length ? designs.map(d => {
        const dl = deadlineInfo(d.deadline);
        return '<div class="entity-card" data-design-id="' + esc(d.id) + '">' +
          '<div class="entity-card-top"><span class="entity-name">' + esc(d.name) + '</span>' +
          (d.status ? '<span class="tag tag-status">' + esc(d.status) + '</span>' : '') +
          (d.priority ? '<span class="priority-stars">' + stars(d.priority) + '</span>' : '') +
          (dl.label ? '<span class="tag ' + dl.cls + '">' + dl.label + '</span>' : '') +
          '</div></div>';
      }).join('') : '<div class="empty-state">אין עדיין עיצובים</div>') +
    '</div>' +
    '<div class="log-add" style="margin-top:.9rem">' +
      '<input type="text" id="new-design-name" placeholder="שם עיצוב חדש...">' +
      '<button class="btn-gold" id="btn-add-design">+ הוסף</button>' +
    '</div>';

  body.querySelectorAll('.entity-card').forEach(card => {
    card.onclick = () => openDesignPanel(p.id, card.dataset.designId);
  });
  const addDesign = async () => {
    const name = $('#new-design-name').value.trim();
    if (!name) return;
    try {
      const res = await api('addDesign', { projectId: p.id, design: { name } });
      if (res.obj) mergeEntity('project', res.obj);
      else { p.designs = p.designs || []; p.designs.push({ id: uid(), name, status: '', deadline: '', priority: 0, notes: [], importantInfo: [] }); }
      toast('העיצוב נוסף ✓', 'success');
      renderProjectPanel();
      renderCurrentView();
    } catch (e) { toast(friendlyError(e.code), 'error'); }
  };
  $('#btn-add-design').onclick = addDesign;
  $('#new-design-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') addDesign(); });
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
    fieldRowHtml({ label: 'סטטוס', field: 'status', value: d.status, type: 'select' }) +
    fieldRowHtml({ label: 'דדליין', field: 'deadline', value: d.deadline, display: d.deadline ? fmtDate(d.deadline) : '', type: 'date' }) +
    priorityRowHtml(d.priority, isBoss()) +
    logSectionHtml('importantInfo', d.importantInfo) +
    logSectionHtml('notes', d.notes);

  wireInlineEdits(body, {
    getValue: (f) => d[f],
    options: (f) => f === 'status' ? S.statuses.map(s => ({ value: s, label: s })) : null,
    save: (f, v) => saveDesignField(p.id, d.id, f, v)
  });
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
