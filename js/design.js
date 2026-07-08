/* ================================================================
   מודול עיצוב מוצר — שיאים | שלב א'
   ----------------------------------------------------------------
   הרחבת נכסי העיצוב: סוג נכס, מי מטפל, פרומפט AI, סטטוס עיצוב,
   וצ'קליסט בדיקת איכות לדפוס. + מפרט מוצר ואריזה בטאב פרטים.
   הכל נשמר בשדות של הפרויקט/העיצוב — אפס שינויי שרת.
   תאימות לאחור: עיצובים ישנים בלי השדות החדשים ממשיכים לעבוד.
   ================================================================ */

// סטטוסי עיצוב — רשימה נפרדת מסטטוסי הפרויקט
const DESIGN_STATUSES = [
  'ממתין למפרט', 'בהדמיית AI', 'אצל גרפיקאית', 'בבדיקת איכות',
  'אושר', 'נשלח למפעל', 'אושר לדפוס'
];

// סוגי נכס עיצוב
const ASSET_TYPES = [
  'הדמיית אריזה', 'קלפים', 'הוראות הפעלה', 'מדבקה',
  'פוסטר', 'פרסומת', 'סרטון מוצר', 'לוגו', 'אחר'
];

// פריטי צ'קליסט בדיקת איכות לדפוס (הבעיות שחוזרות אצלנו)
const QA_ITEMS = [
  { key: 'vector', label: 'קובץ וקטורי' },
  { key: 'bleed', label: 'בליד (Bleed)' },
  { key: 'cropMarks', label: 'סימני חיתוך' },
  { key: 'dpi', label: 'DPI מתאים לגודל' },
  { key: 'text', label: 'טקסט קריא' },
  { key: 'importer', label: 'פרטי יבואן ברורים' },
  { key: 'barcode', label: 'ברקוד תקין' }
];

function assetTypeOptions() { return ASSET_TYPES.map(t => ({ value: t, label: t })); }
function designStatusOptions() { return DESIGN_STATUSES.map(s => ({ value: s, label: s })); }

/* ---- שמירת שדה בתוך אובייקט מקונן בפרויקט (productSpec / packaging) ---- */
async function saveNestedField(p, objName, field, value) {
  const obj = Object.assign({}, p[objName] || {});
  obj[field] = value;
  p[objName] = obj;
  try {
    const res = await api('updateField', { entity: 'project', id: p.id, field: objName, value: obj });
    if (res.obj) mergeEntity('project', res.obj);
    toast(res.queued ? 'נשמר במכשיר ⏳' : 'נשמר ✓', res.queued ? '' : 'success');
    renderProjectPanel();
  } catch (e) { toast(friendlyError(e.code), 'error'); }
}

/* ================= מפרט מוצר + אריזה (בטאב פרטים) ================= */

function productSpecRows(p) {
  const s = p.productSpec || {};
  const has = s.fullDesc || s.dims || s.contents || s.audience || s.notes;
  return (
    '<details class="spec-details"' + (has ? ' open' : '') + '>' +
      '<summary>📋 מפרט מוצר</summary>' +
      '<div class="spec-block">' +
        fieldRowHtml({ label: 'תיאור מלא', field: 'spec.fullDesc', value: s.fullDesc, type: 'textarea' }) +
        fieldRowHtml({ label: 'מידות מוצר', field: 'spec.dims', value: s.dims }) +
        fieldRowHtml({ label: 'תכולה', field: 'spec.contents', value: s.contents }) +
        fieldRowHtml({ label: 'קהל יעד', field: 'spec.audience', value: s.audience }) +
        fieldRowHtml({ label: 'הערות מפרט', field: 'spec.notes', value: s.notes, type: 'textarea' }) +
        '<div class="form-hint">קבצי רפרנס (תמונות/וידאו מהספק) — בטאב מסמכים ← מסמכי מוצר</div>' +
      '</div>' +
    '</details>'
  );
}

function packagingRows(p) {
  const k = p.packaging || {};
  const has = k.packType || k.boxType || k.frontSize || k.backSize || k.sideSize || k.barcode || k.notes;
  return (
    '<details class="spec-details"' + (has ? ' open' : '') + '>' +
      '<summary>📦 אריזה</summary>' +
      '<div class="spec-block">' +
        fieldRowHtml({ label: 'סוג אריזה', field: 'pkg.packType', value: k.packType, type: 'select' }) +
        fieldRowHtml({ label: 'סוג קופסה', field: 'pkg.boxType', value: k.boxType, type: 'select' }) +
        fieldRowHtml({ label: 'מידות חזית', field: 'pkg.frontSize', value: k.frontSize }) +
        fieldRowHtml({ label: 'מידות גב', field: 'pkg.backSize', value: k.backSize }) +
        fieldRowHtml({ label: 'מידות צד', field: 'pkg.sideSize', value: k.sideSize }) +
        fieldRowHtml({ label: 'קובץ פריסה מהמפעל', field: 'pkg.dieCut', value: k.dieCut, type: 'select' }) +
        fieldRowHtml({ label: 'ברקוד', field: 'pkg.barcode', value: k.barcode }) +
        fieldRowHtml({ label: 'הערות אריזה', field: 'pkg.notes', value: k.notes, type: 'textarea' }) +
      '</div>' +
    '</details>'
  );
}

/** אפשרויות select לשדות המקוננים */
function nestedFieldOptions(f) {
  if (f === 'pkg.packType') return [{ value: 'אריזת מקור', label: 'אריזת מקור' }, { value: 'אריזה מותאמת', label: 'אריזה מותאמת' }];
  if (f === 'pkg.boxType') return ['קופסת צבע', 'מארז', 'אלומיניום', 'שקית', 'בליסטר', 'אחר'].map(x => ({ value: x, label: x }));
  if (f === 'pkg.dieCut') return [{ value: 'התקבל', label: 'התקבל מהמפעל' }, { value: 'ממתין', label: 'ממתין' }, { value: 'לא נדרש', label: 'לא נדרש' }];
  return null;
}

/* ================= צ'קליסט בדיקת איכות לדפוס ================= */

function designQAHtml(d) {
  const qa = d.printQA || {};
  return (
    '<div class="log-section-title" style="margin-top:1.1rem">✅ בדיקת איכות לדפוס</div>' +
    '<div class="qa-block">' +
      QA_ITEMS.map(it => {
        const v = qa[it.key] || '';
        return '<div class="qa-row"><span class="qa-label">' + esc(it.label) + '</span>' +
          '<div class="qa-states" data-qa="' + it.key + '">' +
            '<button class="qa-st' + (v === 'ok' ? ' on ok' : '') + '" data-v="ok" title="תקין">✓</button>' +
            '<button class="qa-st' + (v === 'no' ? ' on no' : '') + '" data-v="no" title="לא תקין">✗</button>' +
            '<button class="qa-st' + (v === 'na' ? ' on na' : '') + '" data-v="na" title="לא רלוונטי">—</button>' +
          '</div></div>';
      }).join('') +
    '</div>'
  );
}

function wireDesignQA(body, project, design) {
  body.querySelectorAll('.qa-states').forEach(row => {
    const key = row.dataset.qa;
    row.querySelectorAll('.qa-st').forEach(btn => {
      btn.onclick = async () => {
        const qa = Object.assign({}, design.printQA || {});
        qa[key] = (qa[key] === btn.dataset.v) ? '' : btn.dataset.v;  // לחיצה חוזרת = ביטול
        design.printQA = qa;
        try {
          const r = await api('updateDesignField', { projectId: project.id, designId: design.id, field: 'printQA', value: qa });
          if (r.obj) mergeEntity('project', r.obj);
        } catch (e) { toast(friendlyError(e.code), 'error'); }
        renderDesignPanel();
      };
    });
  });
}

/** סיכום קצר של סטטוס ה-QA (לכרטיס העיצוב) */
function qaSummary(d) {
  const qa = d.printQA || {};
  let ok = 0, no = 0, done = 0;
  QA_ITEMS.forEach(it => { const v = qa[it.key]; if (v) done++; if (v === 'ok') ok++; if (v === 'no') no++; });
  if (!done) return '';
  return no ? '⚠️ ' + no + ' בעיות' : (done === QA_ITEMS.length ? '✅ QA תקין' : 'QA ' + ok + '/' + QA_ITEMS.length);
}

/* ================================================================
   אזור העיצובים — מסך נפרד מפרויקטי הייבוא
   פרויקט עיצוב = ישות project עם kind:'design'. אפשר לקשר לפרויקט
   ייבוא אחד; נכסים בסטטוס "אושר לדפוס" מסתנכרנים כקבצים סופיים לשם.
   ================================================================ */

const DESIGN_FINAL_STATUS = 'אושר לדפוס';   // נכס בסטטוס זה = קובץ סופי שמסתנכרן לייבוא
const DESIGN_STALE_DAYS = 4;                // התראה על פרויקט עיצוב בלי עדכון

function designProjectStatusOptions() { return DESIGN_STATUSES.map(s => ({ value: s, label: s })); }

/** אפשרויות קישור לפרויקט ייבוא */
function importProjectOptions() {
  return [{ value: '', label: '— ללא קישור —' }]
    .concat(importProjects().filter(p => !p.completed)
      .sort((a, b) => a.name.localeCompare(b.name, 'he'))
      .map(p => ({ value: p.id, label: p.name })));
}

/** מספר הימים מאז העדכון האחרון של פרויקט העיצוב */
function designStaleDays(p) {
  const t = p.updatedAt || p.createdAt;
  if (!t) return 0;
  const ms = Date.now() - new Date(t).getTime();
  return ms > 0 ? Math.floor(ms / 86400000) : 0;
}

/** כל הקבצים הסופיים (נכסים "אושר לדפוס") מפרויקטי העיצוב המקושרים לפרויקט ייבוא */
function syncedFinalFilesFor(importProjectId) {
  const out = [];
  designProjects().filter(dp => dp.linkedProjectId === importProjectId).forEach(dp => {
    (dp.designs || []).forEach(d => {
      if (d.status === DESIGN_FINAL_STATUS) {
        (d.files || []).forEach(f => out.push({ file: f, assetName: d.name, dpId: dp.id, dpName: dp.name }));
      }
    });
  });
  return out;
}

/* ---- מסך רשימת פרויקטי העיצוב ---- */

function renderDesignProjectsView() {
  const container = $('#view-container');
  const all = designProjects();
  const list = all.filter(p => !!p.completed === S.showCompleted)
    .sort((a, b) => {
      const pr = (b.priority || 0) - (a.priority || 0);
      if (pr) return pr;
      if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });
  const activeCount = all.filter(p => !p.completed).length;
  const doneCount = all.filter(p => p.completed).length;
  const stale = all.filter(p => !p.completed && designStaleDays(p) >= DESIGN_STALE_DAYS);

  container.innerHTML =
    '<div class="page-header">' +
      '<div class="page-header-text">' +
        '<span class="page-title">' + (S.showCompleted ? 'עיצובים שהסתיימו' : 'פרויקטי עיצוב') + '</span>' +
        '<span class="page-meta">' + list.length + ' פרויקטים · ניהול נפרד מהייבוא</span>' +
      '</div>' +
      '<div class="page-actions">' +
        '<button class="btn-secondary" id="dp-toggle-completed">' +
          (S.showCompleted ? '← חזרה לפעילים (' + activeCount + ')' : 'הסתיימו (' + doneCount + ')') +
        '</button>' +
        '<button class="btn-gold" id="dp-add">+ פרויקט עיצוב</button>' +
      '</div>' +
    '</div>' +
    (!S.showCompleted && stale.length
      ? '<div class="dp-stale-strip">⏳ ' + stale.length + ' פרויקטי עיצוב בלי עדכון ' + DESIGN_STALE_DAYS + '+ ימים</div>'
      : '') +
    '<main class="card-list dp-list">' +
      (list.length ? list.map(designProjectCardHtml).join('')
        : '<div class="empty-state"><div class="big">🎨</div>אין עדיין פרויקטי עיצוב</div>') +
    '</main>';

  $('#dp-toggle-completed').onclick = () => { S.showCompleted = !S.showCompleted; renderDesignProjectsView(); };
  $('#dp-add').onclick = () => openAddDesignProjectModal();
  container.querySelectorAll('.dp-card').forEach(card => {
    card.onclick = () => openDesignProjectPanel(card.dataset.id);
  });
}

function designProjectCardHtml(p) {
  const linked = p.linkedProjectId ? getProject(p.linkedProjectId) : null;
  const assets = p.designs || [];
  const qaIssues = assets.reduce((n, d) => n + ((qaSummary(d) || '').indexOf('בעיות') > -1 ? 1 : 0), 0);
  const finals = assets.filter(d => d.status === DESIGN_FINAL_STATUS).length;
  const dl = deadlineInfo(p.deadline);
  const stale = !p.completed && designStaleDays(p) >= DESIGN_STALE_DAYS;
  // מטפלים ייחודיים (ברמת הפרויקט + הנכסים)
  const handlers = {};
  if (p.assignedTo) handlers[p.assignedTo] = true;
  assets.forEach(d => { if (d.assignedTo) handlers[d.assignedTo] = true; });
  const handlerList = Object.keys(handlers);

  return (
    '<div class="entity-card dp-card pri-' + (p.priority || 0) + '" data-id="' + esc(p.id) + '">' +
      '<div class="entity-card-top">' +
        '<span class="entity-icn">' + icon('design') + '</span>' +
        '<span class="entity-name">' + esc(p.name) + '</span>' +
        (p.priority ? '<span class="priority-stars">' + stars(p.priority) + '</span>' : '') +
        (p.status ? '<span class="tag tag-status">' + esc(p.status) + '</span>' : '') +
        (dl.label ? '<span class="tag ' + dl.cls + '">' + esc(dl.label) + '</span>' : '') +
      '</div>' +
      '<div class="entity-meta">' +
        (linked ? '<span class="dp-linked">🔗 ' + esc(linked.name) + '</span>' : '<span class="dp-unlinked">ללא קישור</span>') +
        '<span>' + assets.length + ' נכסים</span>' +
        (finals ? '<span>✅ ' + finals + ' סופיים</span>' : '') +
        (qaIssues ? '<span class="dp-qa-warn">⚠️ ' + qaIssues + ' QA</span>' : '') +
        (handlerList.length ? '<span>👤 ' + esc(handlerList.join(', ')) + '</span>' : '') +
        (stale ? '<span class="dp-stale">⏳ ' + designStaleDays(p) + ' ימים</span>' : '') +
      '</div>' +
    '</div>'
  );
}

/* ---- פאנל פרויקט עיצוב ---- */

function openDesignProjectPanel(id) {
  currentProjectId = id;
  renderDesignProjectPanel();
  openPanel('design-project-panel');
}

function renderDesignProjectPanel() {
  const p = getProject(currentProjectId);
  if (!p || !isDesignProject(p)) { closePanel('design-project-panel'); return; }

  $('#design-project-panel .panel-title').textContent = 'עיצוב — ' + p.name;
  const body = $('#design-project-panel-body');
  const linked = p.linkedProjectId ? getProject(p.linkedProjectId) : null;

  body.innerHTML =
    fieldRowHtml({ label: 'שם', field: 'name', value: p.name }) +
    fieldRowHtml({ label: 'סטטוס עיצוב', field: 'status', value: p.status, type: 'select' }) +
    fieldRowHtml({ label: 'מי מטפל', field: 'assignedTo', value: p.assignedTo }) +
    fieldRowHtml({ label: 'מקושר לפרויקט ייבוא', field: 'linkedProjectId', value: p.linkedProjectId, display: linked ? linked.name : '', type: 'select' }) +
    fieldRowHtml({ label: 'דדליין', field: 'deadline', value: p.deadline, display: p.deadline ? fmtDateBoth(p.deadline) : '', type: 'date' }) +
    priorityRowHtml(p.priority, isBoss()) +
    productSpecRows(p) +
    packagingRows(p) +
    projectRefsHtml(p) +
    designAssetsListHtml(p) +
    filesSectionHtml(p) +
    logSectionHtml('importantInfo', p.importantInfo) +
    logSectionHtml('notes', p.notes);

  wireInlineEdits(body, {
    getValue: (f) => {
      if (f.indexOf('spec.') === 0) return (p.productSpec || {})[f.slice(5)];
      if (f.indexOf('pkg.') === 0) return (p.packaging || {})[f.slice(4)];
      return p[f];
    },
    options: (f) => {
      if (f === 'status') return designProjectStatusOptions();
      if (f === 'linkedProjectId') return importProjectOptions();
      if (f.indexOf('pkg.') === 0) return nestedFieldOptions(f);
      return null;
    },
    save: async (f, v) => {
      if (f.indexOf('spec.') === 0) return saveNestedField(p, 'productSpec', f.slice(5), v);
      if (f.indexOf('pkg.') === 0) return saveNestedField(p, 'packaging', f.slice(4), v);
      return saveDesignProjectField(p.id, f, v);
    }
  });
  wireProjectRefs(body, p);
  wireDesignAssets(body, p);
  wireFilesSection(body, p);
  wirePriority(body, { editable: isBoss(), save: (v) => saveDesignProjectField(p.id, 'priority', v) });
  wireLogSections(body, {
    save: async (area, text) => {
      try {
        const res = await api('addLog', { entity: 'project', id: p.id, area, text });
        if (res.obj) mergeEntity('project', res.obj);
        else { p[area] = p[area] || []; p[area].push({ date: new Date().toISOString(), user: S.user, text }); }
        toast(res.queued ? 'נשמר במכשיר ⏳' : 'נשמר ✓', res.queued ? '' : 'success');
        renderDesignProjectPanel();
      } catch (e) { toast(friendlyError(e.code), 'error'); }
    }
  });

  const footer = $('#design-project-panel-footer');
  footer.innerHTML = p.completed
    ? '<button class="btn-secondary" id="dpp-restore">↩ החזר לפעילים</button>' +
      (isBoss() ? '<button class="btn-danger" id="dpp-delete">🗑 מחק</button>' : '')
    : '<button class="btn-gold" id="dpp-complete">✅ סיים עיצוב</button>' +
      (isBoss() ? '<button class="btn-danger" id="dpp-delete">🗑 מחק</button>' : '');

  const bc = $('#dpp-complete'), br = $('#dpp-restore'), bd = $('#dpp-delete');
  if (bc) bc.onclick = () => designProjectComplete(p);
  if (br) br.onclick = () => designProjectRestore(p);
  if (bd) bd.onclick = () => designProjectDelete(p);
}

function saveDesignProjectField(id, field, value) {
  return updateFieldOptimistic('project', id, field, value, renderDesignProjectPanel);
}

function designProjectComplete(p) {
  confirmModal({ title: 'סיום עיצוב', message: 'לסמן את "' + p.name + '" כהושלם? (אפשר להחזיר)', btnLabel: '✅ סיים', danger: false }).then(ok => {
    if (!ok) return;
    doWithUndo({
      message: 'פרויקט העיצוב הועבר להסתיימו',
      apply: () => { p.completed = true; closePanel('design-project-panel'); renderCurrentView(); updateNavCounts(); },
      commit: async () => { const r = await api('completeProject', { id: p.id }); if (r.obj) mergeEntity('project', r.obj); },
      revert: () => { p.completed = false; updateNavCounts(); }
    });
  });
}

function designProjectRestore(p) {
  doWithUndo({
    message: 'פרויקט העיצוב חזר לפעילים',
    apply: () => { p.completed = false; closePanel('design-project-panel'); renderCurrentView(); updateNavCounts(); },
    commit: async () => { const r = await api('restoreProject', { id: p.id }); if (r.obj) mergeEntity('project', r.obj); },
    revert: () => { p.completed = true; updateNavCounts(); }
  });
}

function designProjectDelete(p) {
  confirmModal({ title: 'מחיקה לצמיתות', message: 'למחוק לגמרי את פרויקט העיצוב "' + p.name + '"? (הקבצים ב-Drive נשארים)', btnLabel: '🗑 מחק לצמיתות' }).then(ok => {
    if (!ok) return;
    const idx = S.projects.indexOf(p);
    doWithUndo({
      message: 'פרויקט העיצוב נמחק',
      apply: () => { S.projects.splice(idx, 1); closePanel('design-project-panel'); renderCurrentView(); updateNavCounts(); },
      commit: () => api('delete', { entity: 'project', id: p.id }),
      revert: () => { S.projects.splice(idx, 0, p); updateNavCounts(); }
    });
  });
}

/* ---- רשימת נכסי עיצוב בתוך פרויקט עיצוב ---- */

function designAssetsListHtml(p) {
  const designs = p.designs || [];
  return (
    '<div class="log-section-title" style="margin-top:1.1rem">' + icon('design') + ' נכסי עיצוב</div>' +
    '<div class="card-list" id="da-list">' +
      (designs.length ? designs.map(d => {
        const dl = deadlineInfo(d.deadline);
        const qa = qaSummary(d);
        return '<div class="entity-card" data-design-id="' + esc(d.id) + '">' +
          '<div class="entity-card-top">' +
          '<span class="entity-icn">' + icon('design') + '</span>' +
          '<span class="entity-name">' + esc(d.name) + '</span>' +
          (d.assetType ? '<span class="tag">' + esc(d.assetType) + '</span>' : '') +
          (d.status ? '<span class="tag tag-status">' + esc(d.status) + '</span>' : '') +
          (dl.label ? '<span class="tag ' + dl.cls + '">' + dl.label + '</span>' : '') +
          '</div>' +
          ((d.assignedTo || qa || d.priority) ? '<div class="entity-meta">' +
            (d.assignedTo ? '<span>👤 ' + esc(d.assignedTo) + '</span>' : '') +
            (d.priority ? '<span class="priority-stars">' + stars(d.priority) + '</span>' : '') +
            (qa ? '<span>' + esc(qa) + '</span>' : '') +
          '</div>' : '') +
          '</div>';
      }).join('') : '<div class="empty-state">אין עדיין נכסי עיצוב</div>') +
    '</div>' +
    '<div class="log-add" style="margin-top:.9rem">' +
      '<input type="text" id="new-design-name" placeholder="שם נכס עיצוב חדש...">' +
      '<button class="btn-gold" id="btn-add-design">+ הוסף</button>' +
    '</div>'
  );
}

function wireDesignAssets(body, p) {
  body.querySelectorAll('#da-list .entity-card').forEach(card => {
    card.onclick = () => openDesignPanel(p.id, card.dataset.designId);
  });
  const inp = body.querySelector('#new-design-name');
  const addDesign = async () => {
    const name = inp.value.trim();
    if (!name) return;
    try {
      const res = await api('addDesign', { projectId: p.id, design: { name } });
      if (res.obj) mergeEntity('project', res.obj);
      else { p.designs = p.designs || []; p.designs.push({ id: uid(), name, status: '', deadline: '', priority: 0, notes: [], importantInfo: [] }); }
      toast('הנכס נוסף ✓', 'success');
      renderDesignProjectPanel();
      renderCurrentView();
    } catch (e) { toast(friendlyError(e.code), 'error'); }
  };
  const btn = body.querySelector('#btn-add-design');
  if (btn) btn.onclick = addDesign;
  if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addDesign(); });
}

/* ---- הוספת פרויקט עיצוב ---- */

function openAddDesignProjectModal(presets = {}) {
  const linkOpts = importProjectOptions()
    .map(o => '<option value="' + esc(o.value) + '"' + (presets.linkedProjectId === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
  openModal({
    title: 'פרויקט עיצוב חדש',
    bodyHtml:
      '<div class="form-group"><label class="form-label">שם *</label>' +
        '<input type="text" id="adp-name" class="form-input" value="' + esc(presets.name || '') + '"></div>' +
      '<div class="form-group"><label class="form-label">מקושר לפרויקט ייבוא</label>' +
        '<select id="adp-link" class="form-select">' + linkOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">מי מטפל</label>' +
        '<input type="text" id="adp-assigned" class="form-input" placeholder="יעקב / אהרון / גרפיקאית..."></div>' +
      '<label class="dp-copy-check"><input type="checkbox" id="adp-copy"' + (presets.linkedProjectId ? ' checked' : '') + '> העתק מפרט ואריזה מפרויקט הייבוא המקושר</label>',
    footerHtml: '<button class="btn-gold" id="adp-submit">צור</button><button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      back.querySelector('#adp-submit').onclick = async () => {
        const name = back.querySelector('#adp-name').value.trim();
        if (!name) { toast('חסר שם', 'error'); return; }
        const link = back.querySelector('#adp-link').value;
        const assigned = back.querySelector('#adp-assigned').value.trim();
        const copy = back.querySelector('#adp-copy').checked && link;
        const src = copy ? getProject(link) : null;
        const obj = {
          id: uid(), name, kind: 'design', linkedProjectId: link, assignedTo: assigned,
          status: DESIGN_STATUSES[0], type: 'office', priority: 0, deadline: '',
          productSpec: (src && src.productSpec) ? Object.assign({}, src.productSpec) : {},
          packaging: (src && src.packaging) ? Object.assign({}, src.packaging) : {},
          designs: [], notes: [], importantInfo: [], completed: false,
          folderId: '', supplierId: '', clientId: ''
        };
        close();
        S.projects.push(obj);
        S.view = 'design'; S.showCompleted = false;
        renderCurrentView(); updateNavCounts();
        try {
          const res = await api('create', { entity: 'project', obj });
          if (res.obj) mergeEntity('project', res.obj);
          toast(res.queued ? 'נשמר במכשיר ⏳' : 'פרויקט העיצוב נוצר ✓', res.queued ? '' : 'success');
          renderCurrentView();
          openDesignProjectPanel((res.obj && res.obj.id) || obj.id);
        } catch (e) {
          removeEntity('project', obj.id);
          renderCurrentView(); updateNavCounts();
          toast(friendlyError(e.code), 'error');
        }
      };
    }
  });
}

/* ---- חלון "עיצוב" בפרויקט ייבוא (לקריאה בלבד + קבצים סופיים מסונכרנים) ---- */

function renderImportProjectDesignWindow(body, p) {
  const linkedDesigns = designProjects().filter(dp => dp.linkedProjectId === p.id);
  const finals = syncedFinalFilesFor(p.id);
  const legacy = p.designs || [];

  body.innerHTML =
    '<div class="log-section-title">' + icon('design') + ' עיצוב מקושר</div>' +
    '<p class="form-hint">ניהול העיצוב מתבצע באזור "עיצובים" הנפרד. כאן רואים את הפרויקטים המקושרים ואת הקבצים הסופיים שסונכרנו.</p>' +
    (linkedDesigns.length
      ? '<div class="card-list">' + linkedDesigns.map(dp => {
          const assets = (dp.designs || []).length;
          const finalsN = (dp.designs || []).filter(d => d.status === DESIGN_FINAL_STATUS).length;
          return '<div class="entity-card dp-link" data-dp-id="' + esc(dp.id) + '">' +
            '<div class="entity-card-top">' +
            '<span class="entity-icn">' + icon('design') + '</span>' +
            '<span class="entity-name">' + esc(dp.name) + '</span>' +
            (dp.status ? '<span class="tag tag-status">' + esc(dp.status) + '</span>' : '') +
            '</div>' +
            '<div class="entity-meta"><span>' + assets + ' נכסים</span>' +
              (finalsN ? '<span>✅ ' + finalsN + ' סופיים</span>' : '') +
              (dp.assignedTo ? '<span>👤 ' + esc(dp.assignedTo) + '</span>' : '') +
            '</div></div>';
        }).join('') + '</div>'
      : '<div class="empty-state">אין פרויקט עיצוב מקושר</div>') +
    '<div class="log-add" style="margin-top:.7rem">' +
      '<button class="btn-gold btn-block" id="dp-create-link">+ פרויקט עיצוב מקושר</button>' +
    '</div>' +
    '<div class="log-section-title" style="margin-top:1.3rem">📎 קבצי עיצוב סופיים</div>' +
    (finals.length
      ? '<div class="files-list">' + finals.map(x => {
          const f = x.file;
          const isImg = String(f.mimeType || '').indexOf('image/') === 0;
          return '<div class="file-row">' +
            '<span>' + (isImg ? '🖼️' : fileIcon(f.mimeType)) + '</span>' +
            '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' +
            '<span class="file-size">' + esc(x.assetName) + '</span>' +
          '</div>';
        }).join('') + '</div>'
      : '<div style="color:var(--text-muted)">אין עדיין קבצים סופיים — יופיעו כאן כשנכס עיצוב יסומן בסטטוס "' + DESIGN_FINAL_STATUS + '"</div>') +
    (legacy.length
      ? '<div class="log-section-title" style="margin-top:1.3rem">עיצובים ישנים (לקריאה בלבד)</div>' +
        '<p class="form-hint">נוהלו כאן בעבר. מומלץ להעביר לפרויקט עיצוב באזור "עיצובים".</p>' +
        '<div class="card-list">' + legacy.map(d =>
          '<div class="entity-card"><div class="entity-card-top">' +
          '<span class="entity-name">' + esc(d.name) + '</span>' +
          (d.status ? '<span class="tag tag-status">' + esc(d.status) + '</span>' : '') +
          '</div></div>').join('') + '</div>'
      : '');

  body.querySelectorAll('.dp-link').forEach(c => {
    c.onclick = () => openDesignProjectPanel(c.dataset.dpId);
  });
  const cl = body.querySelector('#dp-create-link');
  if (cl) cl.onclick = () => openAddDesignProjectModal({ linkedProjectId: p.id, name: p.name });
}
