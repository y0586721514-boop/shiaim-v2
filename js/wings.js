/* ================================================================
   האגפים — היום · רעיונות · לקוחות · ספקים | שיאים 2.0
   ================================================================ */

/* ================= מסך "היום" =================
   התשובה ל"מה דורש אותי עכשיו?" בפחות מדקה. */

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

function todayDateLabel() {
  const now = new Date();
  let greg;
  try { greg = now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch (e) { greg = fmtDate(now.toISOString()); }
  const heb = hebrewDate(now);
  return heb ? greg + ' · ' + heb : greg;
}

function renderTodayView() {
  const container = $('#view-container');
  const today = todayStr();
  const active = S.projects.filter(p => !p.completed);

  const overdue = active.filter(p => p.deadline && p.deadline < today).sort((a, b) => a.deadline < b.deadline ? -1 : 1);
  const stuck = active.filter(p => !p.deadline && daysSince(p.updatedAt) >= 7);
  const waitingIdeas = S.ideas.filter(i => !i.archived && daysSince(i.updatedAt) >= 30);
  const attention = overdue.length + stuck.length + waitingIdeas.length;

  const week = new Date(Date.now() + 7 * 86400000);
  const weekStr = week.getFullYear() + '-' + String(week.getMonth() + 1).padStart(2, '0') + '-' + String(week.getDate()).padStart(2, '0');
  const thisWeek = active.filter(p => p.deadline && p.deadline >= today && p.deadline <= weekStr).sort((a, b) => a.deadline < b.deadline ? -1 : 1);

  // הגעות צפויות (14 יום)
  const twoWeeks = new Date(Date.now() + 14 * 86400000);
  const twoWeeksStr = twoWeeks.getFullYear() + '-' + String(twoWeeks.getMonth() + 1).padStart(2, '0') + '-' + String(twoWeeks.getDate()).padStart(2, '0');
  const arrivals = active.filter(p => p.etaIsrael && p.etaIsrael >= today && p.etaIsrael <= twoWeeksStr).sort((a, b) => a.etaIsrael < b.etaIsrael ? -1 : 1);

  const newChanges = unseenChanges().slice(0, 8);
  const monthStart = today.slice(0, 8) + '01';
  const doneThisMonth = S.projects.filter(p => p.completed && p.completedAt && p.completedAt.slice(0, 10) >= monthStart).length;
  const openIdeas = S.ideas.filter(i => !i.archived).length;
  const upcomingArrivals = active.filter(p => p.etaIsrael && p.etaIsrael >= today).length;

  let html =
    '<div class="dash-head">' +
      '<div class="dash-head-text">' +
        '<div class="dash-greet">' + esc(greetingByHour()) + (S.displayName ? ', ' + esc(S.displayName) : '') + '</div>' +
        '<div class="dash-date">' + esc(todayDateLabel()) + '</div>' +
      '</div>' +
      '<button class="btn-gold dash-import-btn" id="global-import-btn">🪄 ייבוא חכם מקובץ ספק</button>' +
    '</div>' +

    '<div class="kpi-row">' +
      kpiCard('projects', active.length, 'פרויקטים פעילים', 'ink', 'projects-active') +
      kpiCard('alert', attention, 'דורשים טיפול', attention ? 'red' : 'ink', 'attention') +
      kpiCard('truck', upcomingArrivals, 'הגעות צפויות', 'gold', 'containers') +
      kpiCard('check', doneThisMonth, 'הסתיימו החודש', 'green', 'projects-done') +
    '</div>';

  // דורש תשומת לב
  html += '<div id="dash-attention"></div>';
  html += dashSection('alert', 'דורש תשומת לב', attention ? attention + '' : '');
  if (!attention) {
    html += '<div class="dash-empty">' + icon('check') + '<span>הכל בשליטה — אין פרויקטים באיחור או תקועים</span></div>';
  } else {
    html += '<div class="dash-list">';
    html += overdue.map(p => attnCard(p.id, 'project', 'red', p.name, clientName(p.clientId), 'הדדליין עבר · ' + fmtDateBoth(p.deadline), 'clock')).join('');
    html += stuck.map(p => attnCard(p.id, 'project', 'amber', p.name, clientName(p.clientId), 'ללא דדליין · ' + daysSince(p.updatedAt) + ' ימים בלי עדכון', 'pause')).join('');
    html += waitingIdeas.map(i => attnCard(i.id, 'idea', 'amber', i.name, '', 'רעיון מחכה להחלטה · ' + daysSince(i.createdAt) + ' ימים', 'ideas')).join('');
    html += '</div>';
  }

  // השבוע — דדליינים + הגעות
  const weekItems = thisWeek.length || arrivals.length;
  html += dashSection('calendar', 'השבוע', weekItems ? (thisWeek.length + arrivals.length) + '' : '');
  if (!weekItems) {
    html += '<div class="dash-empty">' + icon('calendar') + '<span>אין דדליינים או הגעות בשבוע הקרוב</span></div>';
  } else {
    html += '<div class="dash-list">';
    html += thisWeek.map(p => attnCard(p.id, 'project', 'ink', p.name, p.status, 'דדליין · ' + fmtDateBoth(p.deadline), 'clock')).join('');
    html += arrivals.map(p => attnCard(p.id, 'project', 'gold', p.name, clientName(p.clientId), 'צפי הגעה לישראל · ' + fmtDateBoth(p.etaIsrael), 'truck')).join('');
    html += '</div>';
  }

  // עדכונים אחרונים — עם כפתור "נקה"
  html += '<div class="dash-section-head">' + icon('bell') + '<span>עדכונים אחרונים</span>' +
    (newChanges.length ? '<span class="dash-count">' + newChanges.length + '</span><button class="dash-clear-btn" id="clear-updates">נקה</button>' : '') + '</div>';
  if (!newChanges.length) {
    html += '<div class="dash-empty">' + icon('check') + '<span>אין עדכונים חדשים — הכל מעודכן</span></div>';
  } else {
    html += '<div class="dash-list">';
    html += newChanges.map(c =>
      '<div class="dash-card upd" data-kind="change" data-entity-type="' + esc(c.entityType) + '" data-id="' + esc(c.entityId) + '">' +
        '<span class="dash-card-icn">' + icon('bell') + '</span>' +
        '<div class="dash-card-body">' +
          '<div class="dash-card-title">' + esc((ENTITY_LABELS[c.entityType] || '') + ' ' + c.entityName) + '</div>' +
          '<div class="dash-card-meta">' + esc(userDisplay(c.user) + ' · ' + changeTypeText(c.changeType) + ' · ' + relTime(c.ts)) + '</div>' +
        '</div>' +
      '</div>').join('');
    html += '</div>';
  }

  container.innerHTML = html;

  const importBtn = container.querySelector('#global-import-btn');
  if (importBtn) importBtn.onclick = () => { if (typeof openGlobalImport === 'function') openGlobalImport(); };

  // כרטיסי KPI לחיצים
  container.querySelectorAll('.kpi-card2[data-nav]').forEach(c => {
    c.addEventListener('click', () => {
      const nav = c.dataset.nav;
      if (nav === 'projects-active') { S.showCompleted = false; setView('projects'); }
      else if (nav === 'projects-done') { S.showCompleted = true; setView('projects'); }
      else if (nav === 'containers') { setView('containers'); }
      else if (nav === 'attention') { const el = document.querySelector('#dash-attention'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // ניקוי עדכונים — מסמן הכל כנצפה
  const clearBtn = container.querySelector('#clear-updates');
  if (clearBtn) clearBtn.onclick = () => {
    S.lastSeen = new Date().toISOString();
    api('updateLastSeen', { ts: S.lastSeen }).catch(() => {});
    updateChangesBadge();
    renderTodayView();
  };

  container.querySelectorAll('.dash-card').forEach(card => {
    card.addEventListener('click', () => {
      const kind = card.dataset.kind, id = card.dataset.id;
      if (kind === 'project') openProjectPanel(id);
      else if (kind === 'idea') openIdeaPanel(id);
      else if (kind === 'change') {
        const et = card.dataset.entityType;
        if (et === 'project' && getProject(id)) openProjectPanel(id);
        else if (et === 'idea' && getIdea(id)) openIdeaPanel(id);
        else if (et === 'client' && getClient(id)) openClientPanel(id);
        else if (et === 'supplier' && getSupplier(id)) openSupplierPanel(id);
        else openChangesPanel();
      }
    });
  });
}

function kpiCard(iconName, value, label, tone, nav) {
  return (
    '<div class="kpi-card2 kpi-' + tone + (nav ? ' kpi-clickable' : '') + '"' + (nav ? ' data-nav="' + nav + '"' : '') + '>' +
      '<span class="kpi-icn">' + icon(iconName) + '</span>' +
      '<span class="kpi-num">' + value + '</span>' +
      '<span class="kpi-lbl">' + esc(label) + '</span>' +
    '</div>'
  );
}

function dashSection(iconName, title, count) {
  return '<div class="dash-section-head">' + icon(iconName) + '<span>' + esc(title) + '</span>' +
    (count ? '<span class="dash-count">' + esc(count) + '</span>' : '') + '</div>';
}

function attnCard(id, kind, tone, title, sub, meta, iconName) {
  return (
    '<div class="dash-card tone-' + tone + '" data-kind="' + kind + '" data-id="' + esc(id) + '">' +
      '<span class="dash-card-icn">' + icon(iconName) + '</span>' +
      '<div class="dash-card-body">' +
        '<div class="dash-card-title">' + esc(title) + (sub ? ' <span class="dash-card-sub">· ' + esc(sub) + '</span>' : '') + '</div>' +
        '<div class="dash-card-meta">' + esc(meta) + '</div>' +
      '</div>' +
      '<span class="dash-card-chev">' + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>' + '</span>' +
    '</div>'
  );
}

/* ================= מסך מכולות ומשלוחים =================
   תמונת-על של כל המכולות המשותפות: מה נכנס לכל מכולה, נפח וקיבולת. */

const CONT_CAP20 = 28, CONT_CAP40 = 67;

function renderContainersView() {
  const container = $('#view-container');
  const active = S.projects.filter(p => !p.completed);

  const groups = {};
  active.forEach(p => { if (p.shipmentName) { (groups[p.shipmentName] = groups[p.shipmentName] || []).push(p); } });
  const names = Object.keys(groups).sort();
  const unassigned = active.filter(p => !p.shipmentName && projectVolume(p) > 0);

  let html =
    '<div class="page-header"><div class="page-header-text">' +
      '<span class="page-title">' + icon('truck') + 'מכולות ומשלוחים</span>' +
      '<span class="page-meta">' + names.length + ' מכולות פעילות</span>' +
    '</div></div>';

  if (!names.length) {
    html += '<div class="empty-state"><div class="big">🚢</div>אין עדיין מכולות משותפות. שייך פרויקטים למכולה דרך שדה "שיוך למכולה" בטאב פרטים של הפרויקט.</div>';
  } else {
    html += '<div class="card-list">' + names.map(n => containerGroupCard(n, groups[n])).join('') + '</div>';
  }

  if (unassigned.length) {
    html += '<div class="dash-section-head" style="margin-top:1.6rem">' + icon('alert') + '<span>מוצרים עם נפח שטרם שויכו למכולה</span><span class="dash-count">' + unassigned.length + '</span></div>';
    html += '<div class="dash-list">' + unassigned.map(p =>
      '<div class="dash-card tone-amber" data-kind="project" data-id="' + esc(p.id) + '">' +
        '<span class="dash-card-icn">' + icon('projects') + '</span>' +
        '<div class="dash-card-body"><div class="dash-card-title">' + esc(p.name) + '</div>' +
          '<div class="dash-card-meta">' + (Math.round(projectVolume(p) * 100) / 100) + ' מ״ק · טרם משויך למכולה</div></div>' +
        '<span class="dash-card-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></span>' +
      '</div>').join('') + '</div>';
  }

  container.innerHTML = html;
  container.querySelectorAll('[data-kind="project"]').forEach(el => {
    el.addEventListener('click', () => openProjectPanel(el.dataset.id));
  });
}

function containerGroupCard(name, projects) {
  const total = projects.reduce((s, p) => s + projectVolume(p), 0);
  const fill40 = total / CONT_CAP40;
  const pct40 = Math.round(fill40 * 100);
  const pctBar = Math.min(100, pct40);
  const over = total > CONT_CAP40;
  const barTone = over ? 'red' : (fill40 > 0.85 ? 'amber' : 'gold');

  const items = projects.map(p =>
    '<div class="cont-item" data-kind="project" data-id="' + esc(p.id) + '">' +
      '<span class="cont-item-name">' + esc(p.name) + '</span>' +
      (p.status ? '<span class="tag tag-status">' + esc(p.status) + '</span>' : '') +
      '<span class="cont-item-vol">' + (Math.round(projectVolume(p) * 100) / 100) + ' מ״ק</span>' +
    '</div>').join('');

  let advice;
  if (over) advice = '<div class="ship-grp-warn">⚠️ חורג ממכולת 40׳ — צריך מכולה נוספת או לפצל את המשלוח</div>';
  else if (total > CONT_CAP20) advice = '<div class="ship-grp-ok">✓ נכנס במכולת 40׳ (' + pct40 + '% מנוצל)</div>';
  else if (total > 0) advice = '<div class="ship-grp-ok">✓ נכנס במכולת 20׳ (' + Math.round(total / CONT_CAP20 * 100) + '% מנוצל)</div>';
  else advice = '<div class="cont-note">הזן נפח במחשבון של כל מוצר כדי לראות ניצול</div>';

  return (
    '<div class="cont-card">' +
      '<div class="cont-head">' + icon('truck') + '<span class="cont-name">' + esc(name) + '</span>' +
        '<span class="cont-count">' + projects.length + ' מוצרים</span></div>' +
      '<div class="cont-bar"><div class="cont-bar-fill tone-' + barTone + '" style="width:' + pctBar + '%"></div></div>' +
      '<div class="cont-stats"><b>' + (Math.round(total * 100) / 100) + ' מ״ק</b> · ' + pct40 + '% ממכולת 40׳ (' + CONT_CAP40 + ' מ״ק)</div>' +
      '<div class="cont-items">' + items + '</div>' +
      advice +
    '</div>'
  );
}

/* ================= אגף רעיונות =================
   "כל רעיון שדובר — חייב להופיע במערכת. אין רעיונות נעלמים." */

let showIdeasArchive = false;

function renderIdeasView() {
  const container = $('#view-container');
  const list = S.ideas.filter(i => !!i.archived === showIdeasArchive)
    .sort((a, b) => (b.createdAt || '') < (a.createdAt || '') ? -1 : 1);
  const openCount = S.ideas.filter(i => !i.archived).length;
  const archCount = S.ideas.filter(i => i.archived).length;

  container.innerHTML =
    '<div class="page-header"><div class="page-header-text">' +
      '<span class="page-title">' + icon('ideas') + (showIdeasArchive ? 'ארכיון רעיונות' : 'רעיונות') + '</span>' +
      '<span class="page-meta">' + list.length + ' רעיונות</span>' +
    '</div><div class="page-actions">' +
      '<button class="btn-secondary" id="toggle-idea-archive">' + (showIdeasArchive ? '← חזרה לרעיונות (' + openCount + ')' : 'ארכיון (' + archCount + ')') + '</button>' +
      (showIdeasArchive ? '' : '<button class="btn-gold" id="btn-add-idea">+ רעיון חדש</button>') +
    '</div></div>' +
    '<div class="card-list">' +
      (list.length ? list.map(ideaCardHtml).join('') :
        '<div class="empty-state"><div class="big">💡</div>' + (showIdeasArchive ? 'הארכיון ריק' : 'כל רעיון שעולה בשיחה — נכנס לכאן. שלא יאבד!') + '</div>') +
    '</div>';

  $('#toggle-idea-archive').onclick = () => { showIdeasArchive = !showIdeasArchive; renderIdeasView(); };
  const addBtn = $('#btn-add-idea');
  if (addBtn) addBtn.onclick = openAddIdeaModal;
  container.querySelectorAll('.entity-card').forEach(card => {
    card.onclick = () => openIdeaPanel(card.dataset.id);
  });
}

function ideaCardHtml(i) {
  const waiting = !i.archived && daysSince(i.updatedAt) >= 30;
  return (
    '<div class="entity-card" data-id="' + esc(i.id) + '">' +
      '<div class="entity-card-top">' +
        '<span class="entity-icn">' + icon('ideas') + '</span>' +
        '<span class="entity-name">' + esc(i.name) + '</span>' +
        (waiting ? '<span class="tag tag-waiting">מחכה להחלטה</span>' : '') +
        (i.archived ? '<span class="tag tag-archived">בארכיון</span>' : '') +
      '</div>' +
      (i.description ? '<div class="entity-meta">' + esc(i.description) + '</div>' : '') +
      '<div class="entity-meta">' +
        (clientName(i.clientId) ? '<span>👤 ' + esc(clientName(i.clientId)) + '</span>' : '') +
        '<span>נוסף ' + relTime(i.createdAt) + ' ע"י ' + esc(userDisplay(i.createdBy)) + '</span>' +
        (i.archived && i.archiveReason ? '<span>סיבת דחייה: ' + esc(i.archiveReason) + '</span>' : '') +
      '</div>' +
    '</div>'
  );
}

let currentIdeaId = null;

function openIdeaPanel(id) {
  currentIdeaId = id;
  renderIdeaPanel();
  openPanel('idea-panel');
}

function renderIdeaPanel() {
  const i = getIdea(currentIdeaId);
  if (!i) { closePanel('idea-panel'); return; }
  $('#idea-panel .panel-title').innerHTML = icon('ideas') + ' ' + esc(i.name);

  const body = $('#idea-panel-body');
  body.innerHTML =
    fieldRowHtml({ label: 'שם', field: 'name', value: i.name }) +
    fieldRowHtml({ label: 'תיאור', field: 'description', value: i.description, type: 'textarea' }) +
    fieldRowHtml({ label: 'לקוח', field: 'clientId', value: i.clientId, display: clientName(i.clientId), type: 'select' }) +
    '<div class="field-row"><span class="field-label">נוסף</span><span class="field-value readonly">' +
      esc(fmtDate(i.createdAt) + ' ע"י ' + userDisplay(i.createdBy)) + '</span></div>' +
    (i.archived ? '<div class="field-row"><span class="field-label">בארכיון</span><span class="field-value readonly">' +
      esc((i.archiveReason || 'ללא סיבה') + ' · ' + fmtDate(i.archivedAt)) + '</span></div>' : '') +
    ideaImagesHtml(i) +
    logSectionHtml('notes', i.notes);

  wireInlineEdits(body, {
    getValue: (f) => i[f],
    options: (f) => f === 'clientId' ? clientOptions() : null,
    save: async (f, v) => {
      if (f === 'clientId' && v === '__new__') { openAddClientModal((newId) => updateFieldOptimistic('idea', i.id, 'clientId', newId, renderIdeaPanel)); renderIdeaPanel(); return; }
      await updateFieldOptimistic('idea', i.id, f, v, () => { renderIdeaPanel(); renderCurrentView(); });
    }
  });
  wireLogSections(body, {
    save: async (area, text) => {
      try {
        const res = await api('addLog', { entity: 'idea', id: i.id, area, text });
        if (res.obj) mergeEntity('idea', res.obj);
        else { i.notes = i.notes || []; i.notes.push({ date: new Date().toISOString(), user: S.user, text }); }
        toast('נשמר ✓', 'success');
        renderIdeaPanel();
      } catch (e) { toast(friendlyError(e.code), 'error'); }
    }
  });
  wireIdeaImages(body, i);

  const footer = $('#idea-panel-footer');
  footer.innerHTML = i.archived
    ? '<button class="btn-secondary" id="ip-restore">↩ החזר מהארכיון</button>' +
      (isBoss() ? '<button class="btn-danger" id="ip-delete">🗑 מחק לצמיתות</button>' : '')
    : '<button class="btn-gold" id="ip-convert">🚀 הפוך לפרויקט פעיל</button>' +
      '<button class="btn-secondary" id="ip-archive">📥 דחה לארכיון</button>';

  const bC = $('#ip-convert'), bA = $('#ip-archive'), bR = $('#ip-restore'), bD = $('#ip-delete');
  if (bC) bC.onclick = () => convertIdeaFlow(i.id);
  if (bA) bA.onclick = () => archiveIdeaFlow(i.id);
  if (bR) bR.onclick = () => restoreIdeaFlow(i.id);
  if (bD) bD.onclick = () => deleteIdeaFlow(i.id);
}

/* ---- תמונות והדמיות של הרעיון ---- */

function ideaImages(i) { return i.images || []; }

function ideaImagesHtml(i) {
  const imgs = ideaImages(i);
  let gallery;
  if (IS_DEMO) {
    gallery = '<div class="doc-empty">🖼️ העלאת תמונות תעבוד אחרי חיבור לשרת האמיתי</div>';
  } else if (!imgs.length) {
    gallery = '<div class="doc-empty">אין עדיין תמונות. העלה הדמיה או תמונה של הרעיון/המוצר.</div>';
  } else {
    gallery = '<div class="idea-gallery">' + imgs.map(f => {
      const isImg = String(f.mimeType || '').indexOf('image/') === 0;
      return '<div class="idea-img" data-img-id="' + esc(f.id) + '">' +
        (isImg
          ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img src="https://drive.google.com/thumbnail?id=' + esc(f.fileId) + '&sz=w400" alt="' + esc(f.name) + '" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'idea-img-fallback\',textContent:\'🖼️ ' + esc(f.name).replace(/'/g, '') + '\'}))"></a>'
          : '<a class="idea-img-fallback" href="' + esc(f.url) + '" target="_blank" rel="noopener">' + fileIcon(f.mimeType) + ' ' + esc(f.name) + '</a>') +
        '<button class="idea-img-del" data-img-id="' + esc(f.id) + '" title="הסר">✕</button>' +
      '</div>';
    }).join('') + '</div>';
  }
  return (
    '<div class="log-section-title" style="margin-top:1.1rem">🖼️ תמונות והדמיות</div>' +
    gallery +
    (IS_DEMO ? '' : '<div class="upload-row"><input type="file" accept="image/*,application/pdf" id="idea-img-input" style="display:none"><button class="btn-secondary" id="idea-img-upload">⬆ העלה תמונה / הדמיה</button></div>')
  );
}

function wireIdeaImages(body, i) {
  const input = body.querySelector('#idea-img-input');
  const btn = body.querySelector('#idea-img-upload');
  if (btn && input) {
    btn.onclick = () => { input.value = ''; input.click(); };
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) { toast('הקובץ גדול מדי — עד 20MB', 'error'); return; }
      await uploadIdeaImage(i, file);
    };
  }
  body.querySelectorAll('.idea-img-del').forEach(b => {
    b.onclick = () => deleteIdeaImage(i, b.dataset.imgId);
  });
}

async function uploadIdeaImage(idea, file) {
  showSpinner(true);
  try {
    // ודא שלרעיון יש תיקיית Drive (נוצרת בעת הצורך)
    if (!idea.folderId) {
      const fr = await api('ensureFolder', { entity: 'idea', id: idea.id }, { noQueue: true });
      if (fr.folderId) idea.folderId = fr.folderId;
      else throw { code: fr.error || 'folder_failed' };
    }
    const res = await api('uploadFile', { folderId: idea.folderId, filename: file.name, base64: await fileToBase64(file), mimeType: file.type }, { noQueue: true });
    const f = res.file;
    const entry = { id: uid(), fileId: f.id, name: f.name, url: f.url, mimeType: f.mimeType, size: f.size, date: new Date().toISOString(), user: S.user };
    const images = ideaImages(idea).concat([entry]);
    idea.images = images;
    await api('updateField', { entity: 'idea', id: idea.id, field: 'images', value: images });
    toast('התמונה הועלתה ✓', 'success');
    renderIdeaPanel();
  } catch (e) {
    toast(e.code === 'network' ? 'העלאת תמונות דורשת חיבור לאינטרנט' : friendlyError(e.code), 'error');
  } finally {
    showSpinner(false);
  }
}

function deleteIdeaImage(idea, imgId) {
  const img = ideaImages(idea).find(x => x.id === imgId);
  if (!img) return;
  confirmModal({ title: 'הסרת תמונה', message: 'להסיר את "' + img.name + '"? הקובץ יעבור לסל האשפה ב-Drive.', btnLabel: 'הסר' }).then(async ok => {
    if (!ok) return;
    const images = ideaImages(idea).filter(x => x.id !== imgId);
    idea.images = images;
    renderIdeaPanel();
    try {
      await api('updateField', { entity: 'idea', id: idea.id, field: 'images', value: images });
      if (img.fileId) api('deleteFile', { fileId: img.fileId }, { noQueue: true }).catch(() => {});
      toast('התמונה הוסרה ✓', 'success');
    } catch (e) { toast(friendlyError(e.code), 'error'); }
  });
}

/** רעיון → פרויקט בלחיצה אחת: מעביר שם, לקוח והערות */
function convertIdeaFlow(id) {
  const i = getIdea(id);
  if (!i) return;
  const notes = (i.notes || []).slice();
  if (i.description) notes.unshift({ date: i.createdAt, user: i.createdBy, text: 'מהרעיון: ' + i.description });
  closePanel('idea-panel');
  openAddProjectModal({
    name: i.name,
    clientId: i.clientId,
    notes,
    afterCreate: async () => {
      // הרעיון עובר לארכיון עם ציון שהפך לפרויקט — לא נמחק
      try {
        const res = await api('archiveIdea', { id: i.id, reason: 'הפך לפרויקט פעיל 🚀' });
        if (res.obj) mergeEntity('idea', res.obj);
        else { i.archived = true; i.archiveReason = 'הפך לפרויקט פעיל 🚀'; }
        updateNavCounts();
        renderCurrentView();
      } catch (e) { /* לא קריטי */ }
    }
  });
}

/** דחיית רעיון — עובר לארכיון עם סיבה. אין מחיקה שקטה. */
function archiveIdeaFlow(id) {
  const i = getIdea(id);
  if (!i) return;
  openModal({
    title: 'דחיית רעיון לארכיון',
    maxWidth: '380px',
    bodyHtml:
      '<p class="confirm-message">"' + esc(i.name) + '" יעבור לארכיון הרעיונות — לא יימחק.</p>' +
      '<div class="form-group" style="margin-top:.8rem"><label class="form-label">סיבת הדחייה</label>' +
      '<input type="text" id="archive-reason" class="form-input" placeholder="למה מוותרים על הרעיון?"></div>',
    footerHtml: '<button class="btn-primary" id="archive-ok">📥 העבר לארכיון</button><button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      back.querySelector('#archive-ok').onclick = () => {
        const reason = back.querySelector('#archive-reason').value.trim();
        close();
        doWithUndo({
          message: 'הרעיון עבר לארכיון',
          apply: () => { i.archived = true; i.archiveReason = reason; i.archivedAt = new Date().toISOString(); closePanel('idea-panel'); renderCurrentView(); updateNavCounts(); },
          commit: async () => { const res = await api('archiveIdea', { id, reason }); if (res.obj) mergeEntity('idea', res.obj); },
          revert: () => { i.archived = false; i.archiveReason = ''; updateNavCounts(); }
        });
      };
    }
  });
}

function restoreIdeaFlow(id) {
  const i = getIdea(id);
  if (!i) return;
  doWithUndo({
    message: 'הרעיון חזר לרשימה',
    apply: () => { i.archived = false; closePanel('idea-panel'); renderCurrentView(); updateNavCounts(); },
    commit: async () => { const res = await api('restoreIdea', { id }); if (res.obj) mergeEntity('idea', res.obj); },
    revert: () => { i.archived = true; updateNavCounts(); }
  });
}

function deleteIdeaFlow(id) {
  const i = getIdea(id);
  if (!i) return;
  confirmModal({ title: 'מחיקה לצמיתות', message: 'למחוק לגמרי את הרעיון "' + i.name + '"?', btnLabel: '🗑 מחק לצמיתות' }).then(ok => {
    if (!ok) return;
    const idx = S.ideas.indexOf(i);
    doWithUndo({
      message: 'הרעיון נמחק',
      apply: () => { S.ideas.splice(idx, 1); closePanel('idea-panel'); renderCurrentView(); updateNavCounts(); },
      commit: () => api('delete', { entity: 'idea', id }),
      revert: () => { S.ideas.splice(idx, 0, i); updateNavCounts(); }
    });
  });
}

function openAddIdeaModal() {
  const clientOpts = S.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'))
    .map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('');
  openModal({
    title: 'רעיון חדש',
    bodyHtml:
      '<div class="form-group"><label class="form-label">שם הרעיון *</label><input type="text" id="ai-name" class="form-input" placeholder="מה הרעיון?"></div>' +
      '<div class="form-group"><label class="form-label">תיאור קצר</label><textarea id="ai-desc" class="form-textarea" placeholder="כמה מילים כדי שנזכור במה מדובר"></textarea></div>' +
      '<div class="form-group"><label class="form-label">לקוח (אם יש)</label><select id="ai-client" class="form-select"><option value="">— ללא —</option>' + clientOpts + '</select></div>',
    footerHtml: '<button class="btn-gold" id="ai-submit">💡 הוסף רעיון</button><button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      back.querySelector('#ai-submit').onclick = async () => {
        const name = back.querySelector('#ai-name').value.trim();
        if (!name) { toast('חסר שם לרעיון', 'error'); return; }
        const obj = {
          id: uid(), name,
          description: back.querySelector('#ai-desc').value.trim(),
          clientId: back.querySelector('#ai-client').value,
          notes: [], archived: false, archiveReason: ''
        };
        close();
        S.ideas.push(obj);
        renderCurrentView(); updateNavCounts();
        try {
          const res = await api('create', { entity: 'idea', obj });
          if (res.obj) mergeEntity('idea', res.obj);
          toast('הרעיון נשמר ✓ — לא ילך לאיבוד', 'success');
          renderCurrentView();
        } catch (e) {
          removeEntity('idea', obj.id);
          renderCurrentView(); updateNavCounts();
          toast(friendlyError(e.code), 'error');
        }
      };
    }
  });
}

/* ================= אגף לקוחות ================= */

function renderClientsView() {
  const container = $('#view-container');
  const list = S.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'));
  container.innerHTML =
    '<div class="page-header"><div class="page-header-text">' +
      '<span class="page-title">' + icon('clients') + 'לקוחות</span>' +
      '<span class="page-meta">' + list.length + ' לקוחות</span>' +
    '</div><div class="page-actions">' +
      '<button class="btn-gold" id="btn-add-client">+ לקוח חדש</button>' +
    '</div></div>' +
    '<div class="card-list">' +
      (list.length ? list.map(clientCardHtml).join('') :
        '<div class="empty-state"><div class="big">👤</div>אין עדיין לקוחות</div>') +
    '</div>';

  $('#btn-add-client').onclick = () => openAddClientModal();
  container.querySelectorAll('.entity-card').forEach(card => {
    card.onclick = (e) => { if (e.target.closest('.phone-link')) return; openClientPanel(card.dataset.id); };
  });
}

function clientCardHtml(c) {
  const projCount = projectsOfClient(c.id).filter(p => !p.completed).length;
  const ideaCount = ideasOfClient(c.id).filter(i => !i.archived).length;
  return (
    '<div class="entity-card" data-id="' + esc(c.id) + '">' +
      '<div class="entity-card-top">' +
        '<span class="entity-icn">' + icon('clients') + '</span>' +
        '<span class="entity-name">' + esc(c.name) + '</span>' +
        (projCount ? '<span class="tag tag-status">' + projCount + ' פרויקטים פעילים</span>' : '') +
        (ideaCount ? '<span class="tag tag-waiting">' + ideaCount + ' רעיונות</span>' : '') +
      '</div>' +
      '<div class="entity-meta">' +
        (c.contactName ? '<span>איש קשר: ' + esc(c.contactName) + '</span>' : '') +
        (c.phone ? '<a class="phone-link" href="tel:' + esc(c.phone.replace(/[^\d+]/g, '')) + '">📞 ' + esc(c.phone) + '</a>' : '') +
        (c.email ? '<a class="phone-link" style="color:var(--navy-light)" href="mailto:' + esc(String(c.email).trim()) + '">✉️ ' + esc(c.email) + '</a>' : '') +
      '</div>' +
    '</div>'
  );
}

let currentClientId = null;

function openClientPanel(id) {
  currentClientId = id;
  renderClientPanel();
  openPanel('client-panel');
}

function renderClientPanel() {
  const c = getClient(currentClientId);
  if (!c) { closePanel('client-panel'); return; }
  $('#client-panel .panel-title').innerHTML = icon('clients') + ' ' + esc(c.name);

  const projects = projectsOfClient(c.id).sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
  const ideas = ideasOfClient(c.id);

  const body = $('#client-panel-body');
  body.innerHTML =
    fieldRowHtml({ label: 'שם', field: 'name', value: c.name }) +
    fieldRowHtml({ label: 'איש קשר', field: 'contactName', value: c.contactName }) +
    fieldRowHtml({ label: 'טלפון', field: 'phone', value: c.phone, type: 'tel' }) +
    (c.phone ? '<div class="field-row"><span class="field-label"></span><a class="phone-link" href="tel:' + esc(String(c.phone).replace(/[^\d+]/g, '')) + '">📞 חייג עכשיו</a></div>' : '') +
    fieldRowHtml({ label: 'אימייל', field: 'email', value: c.email, type: 'email' }) +
    (c.email ? '<div class="field-row"><span class="field-label"></span><a class="phone-link" style="color:var(--navy-light)" href="mailto:' + esc(String(c.email).trim()) + '">✉️ שלח מייל ללקוח</a></div>' : '') +
    fieldRowHtml({ label: 'הערות', field: 'notes', value: c.notes, type: 'textarea' }) +
    '<div class="log-section-title" style="margin-top:1.1rem">📋 פרויקטים (' + projects.length + ')</div>' +
    '<div class="related-list">' +
      (projects.length ? projects.map(p =>
        '<div class="related-item" data-kind="project" data-id="' + esc(p.id) + '">' +
          (p.completed ? '✅' : '📋') + ' <b>' + esc(p.name) + '</b>' +
          (p.status && !p.completed ? '<span class="tag tag-status">' + esc(p.status) + '</span>' : '') +
          (p.completed ? '<span class="tag tag-archived">הסתיים</span>' : '') +
        '</div>').join('') : '<div style="color:var(--text-muted)">אין פרויקטים ללקוח זה</div>') +
    '</div>' +
    '<div class="log-section-title" style="margin-top:1.1rem">💡 רעיונות (' + ideas.length + ')</div>' +
    '<div class="related-list">' +
      (ideas.length ? ideas.map(i =>
        '<div class="related-item" data-kind="idea" data-id="' + esc(i.id) + '">💡 <b>' + esc(i.name) + '</b>' +
          (i.archived ? '<span class="tag tag-archived">בארכיון</span>' : '') +
        '</div>').join('') : '<div style="color:var(--text-muted)">אין רעיונות ללקוח זה</div>') +
    '</div>';

  wireInlineEdits(body, {
    getValue: (f) => c[f],
    options: () => null,
    save: (f, v) => updateFieldOptimistic('client', c.id, f, v, () => { renderClientPanel(); renderCurrentView(); })
  });
  body.querySelectorAll('.related-item').forEach(item => {
    item.onclick = () => {
      if (item.dataset.kind === 'project') openProjectPanel(item.dataset.id);
      else openIdeaPanel(item.dataset.id);
    };
  });

  $('#client-panel-footer').innerHTML =
    '<button class="btn-gold" id="cp-add-project">+ פרויקט ללקוח</button>' +
    (isBoss() ? '<button class="btn-danger" id="cp-delete">🗑 מחק לקוח</button>' : '');
  $('#cp-add-project').onclick = () => openAddProjectModal({ clientId: c.id });
  const bD = $('#cp-delete');
  if (bD) bD.onclick = () => deleteClientFlow(c.id);
}

function deleteClientFlow(id) {
  const c = getClient(id);
  if (!c) return;
  const projCount = projectsOfClient(id).length;
  confirmModal({
    title: 'מחיקת לקוח',
    message: 'למחוק את "' + c.name + '"?' + (projCount ? ' יש לו ' + projCount + ' פרויקטים — הם יישארו, בלי שיוך ללקוח.' : ''),
    btnLabel: '🗑 מחק לקוח'
  }).then(ok => {
    if (!ok) return;
    const idx = S.clients.indexOf(c);
    doWithUndo({
      message: 'הלקוח נמחק',
      apply: () => { S.clients.splice(idx, 1); closePanel('client-panel'); renderCurrentView(); },
      commit: () => api('delete', { entity: 'client', id }),
      revert: () => { S.clients.splice(idx, 0, c); }
    });
  });
}

/** הוספת לקוח מהירה. onDone(newId) — נקרא אחרי יצירה (לשיוך מיידי). */
function openAddClientModal(onDone) {
  openModal({
    title: 'לקוח חדש',
    bodyHtml:
      '<div class="form-group"><label class="form-label">שם הלקוח *</label><input type="text" id="ac-name" class="form-input"></div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label class="form-label">איש קשר</label><input type="text" id="ac-contact" class="form-input"></div>' +
        '<div class="form-group"><label class="form-label">טלפון</label><input type="tel" id="ac-phone" class="form-input"></div>' +
        '<div class="form-group"><label class="form-label">אימייל</label><input type="email" id="ac-email" class="form-input" placeholder="לשליחת מיילים ללקוח"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">הערות</label><input type="text" id="ac-notes" class="form-input"></div>',
    footerHtml: '<button class="btn-gold" id="ac-submit">הוסף לקוח</button><button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      back.querySelector('#ac-submit').onclick = async () => {
        const name = back.querySelector('#ac-name').value.trim();
        if (!name) { toast('חסר שם ללקוח', 'error'); return; }
        const obj = {
          id: uid(), name,
          contactName: back.querySelector('#ac-contact').value.trim(),
          phone: back.querySelector('#ac-phone').value.trim(),
          email: back.querySelector('#ac-email').value.trim(),
          notes: back.querySelector('#ac-notes').value.trim()
        };
        close();
        S.clients.push(obj);
        try {
          const res = await api('create', { entity: 'client', obj });
          if (res.obj) mergeEntity('client', res.obj);
          toast('הלקוח נוסף ✓', 'success');
          renderCurrentView();
          if (onDone) onDone(obj.id);
        } catch (e) {
          removeEntity('client', obj.id);
          renderCurrentView();
          toast(friendlyError(e.code), 'error');
        }
      };
    }
  });
}

/* ================= אגף מוצרים וספקים =================
   הזיכרון הארגוני: "איפה ייצרנו את זה בפעם הקודמת?" */

function renderSuppliersView() {
  const container = $('#view-container');
  const list = S.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'he'));
  container.innerHTML =
    '<div class="page-header"><div class="page-header-text">' +
      '<span class="page-title">' + icon('suppliers') + 'מוצרים וספקים</span>' +
      '<span class="page-meta">' + list.length + ' ספקים</span>' +
    '</div><div class="page-actions">' +
      '<button class="btn-gold" id="btn-add-supplier">+ ספק חדש</button>' +
    '</div></div>' +
    '<div class="card-list">' +
      (list.length ? list.map(supplierCardHtml).join('') :
        '<div class="empty-state"><div class="big">📦</div>כאן שומרים את המפעלים בסין — שלא נשכח איפה ייצרנו</div>') +
    '</div>';

  $('#btn-add-supplier').onclick = () => openAddSupplierModal();
  container.querySelectorAll('.entity-card').forEach(card => {
    card.onclick = () => openSupplierPanel(card.dataset.id);
  });
}

function supplierCardHtml(s) {
  const projCount = projectsOfSupplier(s.id).length;
  return (
    '<div class="entity-card" data-id="' + esc(s.id) + '">' +
      '<div class="entity-card-top">' +
        '<span class="entity-icn">' + icon('suppliers') + '</span>' +
        '<span class="entity-name">' + esc(s.name) + '</span>' +
        (s.field ? '<span class="tag">' + esc(s.field) + '</span>' : '') +
        (projCount ? '<span class="tag tag-status">' + projCount + ' פרויקטים</span>' : '') +
      '</div>' +
      '<div class="entity-meta">' +
        (s.contactName ? '<span>איש קשר: ' + esc(s.contactName) + '</span>' : '') +
        (s.wechat ? '<span>WeChat: ' + esc(s.wechat) + '</span>' : '') +
      '</div>' +
    '</div>'
  );
}

let currentSupplierId = null;

function openSupplierPanel(id) {
  currentSupplierId = id;
  renderSupplierPanel();
  openPanel('supplier-panel');
}

function renderSupplierPanel() {
  const s = getSupplier(currentSupplierId);
  if (!s) { closePanel('supplier-panel'); return; }
  $('#supplier-panel .panel-title').innerHTML = icon('suppliers') + ' ' + esc(s.name);

  const projects = projectsOfSupplier(s.id);
  const body = $('#supplier-panel-body');
  body.innerHTML =
    fieldRowHtml({ label: 'שם המפעל', field: 'name', value: s.name }) +
    (s.nameHe ? '<div class="field-row"><span class="field-label"></span><span class="field-value readonly date-heb">🌐 ' + esc(s.nameHe) + '</span></div>' : '') +
    fieldRowHtml({ label: 'תחום', field: 'field', value: s.field }) +
    fieldRowHtml({ label: 'איש קשר', field: 'contactName', value: s.contactName }) +
    fieldRowHtml({ label: 'WeChat', field: 'wechat', value: s.wechat }) +
    fieldRowHtml({ label: 'טלפון', field: 'phone', value: s.phone, type: 'tel' }) +
    fieldRowHtml({ label: 'אימייל', field: 'email', value: s.email, type: 'email' }) +
    (s.email ? '<div class="field-row"><span class="field-label"></span><a class="phone-link" style="color:var(--navy-light)" href="mailto:' + esc(String(s.email).trim()) + '">✉️ שלח מייל</a></div>' : '') +
    fieldRowHtml({ label: 'אתר', field: 'website', value: s.website }) +
    (s.website ? '<div class="field-row"><span class="field-label"></span><a class="phone-link" style="color:var(--navy-light)" href="' + esc(normalizeUrl(s.website)) + '" target="_blank" rel="noopener">🌐 פתח אתר</a></div>' : '') +
    fieldRowHtml({ label: 'כתובת', field: 'address', value: s.address, type: 'textarea' }) +
    (s.addressHe ? '<div class="field-row"><span class="field-label"></span><span class="field-value readonly date-heb">🌐 ' + esc(s.addressHe) + '</span></div>' : '') +
    fieldRowHtml({ label: 'נמל ייצוא', field: 'exportPort', value: s.exportPort }) +
    ((s.name || s.address) && !IS_DEMO ? '<div class="field-row"><span class="field-label"></span><button class="btn-secondary" id="sup-translate" style="padding:.3rem .8rem">🌐 תרגם שם וכתובת לעברית</button></div>' : '') +
    fieldRowHtml({ label: 'הערות', field: 'notes', value: s.notes, type: 'textarea' }) +
    '<div class="form-hint">כדאי לשמור כאן: מחירים אחרונים, איכות, זמני ייצור</div>' +
    supplierProductsHtml(projects);

  wireInlineEdits(body, {
    getValue: (f) => s[f],
    options: () => null,
    save: (f, v) => updateFieldOptimistic('supplier', s.id, f, v, () => { renderSupplierPanel(); renderCurrentView(); })
  });
  const trBtn = body.querySelector('#sup-translate');
  if (trBtn) trBtn.onclick = async () => {
    trBtn.disabled = true; trBtn.textContent = 'מתרגם...';
    const items = [], keys = [];
    if (s.name) { items.push(s.name); keys.push('nameHe'); }
    if (s.address) { items.push(s.address); keys.push('addressHe'); }
    try {
      const tr = await translateToHebrew(items);
      for (let i = 0; i < keys.length; i++) { s[keys[i]] = tr[i]; await api('updateField', { entity: 'supplier', id: s.id, field: keys[i], value: tr[i] }); }
      toast('תורגם ✓', 'success');
    } catch (e) { toast('התרגום נכשל — נסה שוב', 'error'); }
    renderSupplierPanel();
  };
  body.querySelectorAll('.related-item').forEach(item => {
    item.onclick = () => openProjectPanel(item.dataset.id);
  });

  $('#supplier-panel-footer').innerHTML =
    (isBoss() ? '<button class="btn-danger" id="sp-delete">🗑 מחק ספק</button>' : '');
  const bD = $('#sp-delete');
  if (bD) bD.onclick = () => deleteSupplierFlow(s.id);
}

/** תצוגה מרוכזת של כל המוצרים מהספק — לפי מכולה, עם נפח כולל */
function supplierProductsHtml(projects) {
  const active = projects.filter(p => !p.completed);
  if (!projects.length) {
    return '<div class="log-section-title" style="margin-top:1.1rem">📦 מוצרים מהספק</div>' +
      '<div style="color:var(--text-muted)">עדיין לא שויכו מוצרים לספק זה (משייכים דרך שדה "ספק" בפרויקט, או בייבוא חכם).</div>';
  }
  const totalVol = active.reduce((s, p) => s + projectVolume(p), 0);

  // קיבוץ לפי מכולה
  const groups = {};
  active.forEach(p => { const key = p.shipmentName || '__none__'; (groups[key] = groups[key] || []).push(p); });
  const done = projects.filter(p => p.completed);

  const groupHtml = (title, list, showShip) =>
    '<div class="sup-grp">' +
      (title ? '<div class="sup-grp-title">' + icon('truck') + esc(title) + '</div>' : '') +
      list.map(p =>
        '<div class="related-item" data-id="' + esc(p.id) + '">' +
          '<b>' + esc(p.name) + '</b>' +
          (p.status ? '<span class="tag tag-status">' + esc(p.status) + '</span>' : '') +
          '<span class="sup-vol">' + (Math.round(projectVolume(p) * 100) / 100) + ' מ״ק</span>' +
        '</div>').join('') +
    '</div>';

  let html =
    '<div class="log-section-title" style="margin-top:1.1rem">📦 מוצרים מהספק (' + active.length + ' פעילים)</div>' +
    '<div class="sup-summary">נפח כולל פעיל: <b>' + (Math.round(totalVol * 100) / 100) + ' מ״ק</b></div>';

  Object.keys(groups).sort().forEach(key => {
    if (key === '__none__') return;
    html += groupHtml('מכולה: ' + key, groups[key], true);
  });
  if (groups['__none__']) html += groupHtml('ללא שיוך למכולה', groups['__none__'], false);
  if (done.length) html += '<div class="sup-grp-title" style="margin-top:.6rem;color:var(--text-muted)">הסתיימו (' + done.length + ')</div>' +
    done.map(p => '<div class="related-item" data-id="' + esc(p.id) + '">✅ <b>' + esc(p.name) + '</b></div>').join('');

  return html;
}

function deleteSupplierFlow(id) {
  const s = getSupplier(id);
  if (!s) return;
  confirmModal({ title: 'מחיקת ספק', message: 'למחוק את "' + s.name + '"?', btnLabel: '🗑 מחק ספק' }).then(ok => {
    if (!ok) return;
    const idx = S.suppliers.indexOf(s);
    doWithUndo({
      message: 'הספק נמחק',
      apply: () => { S.suppliers.splice(idx, 1); closePanel('supplier-panel'); renderCurrentView(); },
      commit: () => api('delete', { entity: 'supplier', id }),
      revert: () => { S.suppliers.splice(idx, 0, s); }
    });
  });
}

function openAddSupplierModal(prefill, onDone) {
  prefill = prefill || {};
  const pv = (k) => esc(prefill[k] || '');
  openModal({
    title: 'ספק / מפעל חדש',
    bodyHtml:
      '<div class="form-group"><label class="form-label">שם המפעל *</label><input type="text" id="as-name" class="form-input" value="' + pv('name') + '"></div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label class="form-label">תחום</label><input type="text" id="as-field" class="form-input" placeholder="צעצועים / אקריליק / אריזות..." value="' + pv('field') + '"></div>' +
        '<div class="form-group"><label class="form-label">איש קשר</label><input type="text" id="as-contact" class="form-input" value="' + pv('contactName') + '"></div>' +
        '<div class="form-group"><label class="form-label">WeChat</label><input type="text" id="as-wechat" class="form-input" value="' + pv('wechat') + '"></div>' +
        '<div class="form-group"><label class="form-label">טלפון</label><input type="tel" id="as-phone" class="form-input" value="' + pv('phone') + '"></div>' +
        '<div class="form-group"><label class="form-label">אימייל</label><input type="email" id="as-email" class="form-input" value="' + pv('email') + '"></div>' +
        '<div class="form-group"><label class="form-label">אתר</label><input type="text" id="as-website" class="form-input" value="' + pv('website') + '"></div>' +
        '<div class="form-group"><label class="form-label">נמל ייצוא בסין</label><input type="text" id="as-port" class="form-input" placeholder="Ningbo / Shenzhen..." value="' + pv('exportPort') + '"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">כתובת</label><textarea id="as-address" class="form-textarea">' + pv('address') + '</textarea></div>' +
      '<div class="form-group"><label class="form-label">הערות</label><textarea id="as-notes" class="form-textarea" placeholder="מחירים, איכות, זמני ייצור...">' + pv('notes') + '</textarea></div>',
    footerHtml: '<button class="btn-gold" id="as-submit">הוסף ספק</button><button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      back.querySelector('#as-submit').onclick = async () => {
        const name = back.querySelector('#as-name').value.trim();
        if (!name) { toast('חסר שם לספק', 'error'); return; }
        const obj = {
          id: uid(), name,
          field: back.querySelector('#as-field').value.trim(),
          contactName: back.querySelector('#as-contact').value.trim(),
          wechat: back.querySelector('#as-wechat').value.trim(),
          phone: back.querySelector('#as-phone').value.trim(),
          email: back.querySelector('#as-email').value.trim(),
          website: back.querySelector('#as-website').value.trim(),
          exportPort: back.querySelector('#as-port').value.trim(),
          address: back.querySelector('#as-address').value.trim(),
          notes: back.querySelector('#as-notes').value.trim()
        };
        close();
        S.suppliers.push(obj);
        try {
          const res = await api('create', { entity: 'supplier', obj });
          if (res.obj) mergeEntity('supplier', res.obj);
          toast('הספק נוסף ✓', 'success');
          if (typeof onDone === 'function') onDone(obj.id);
          renderCurrentView();
        } catch (e) {
          removeEntity('supplier', obj.id);
          renderCurrentView();
          toast(friendlyError(e.code), 'error');
        }
      };
    }
  });
}
