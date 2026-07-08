/* ================================================================
   האגפים — היום · רעיונות · לקוחות · ספקים | שיאים 2.0
   ================================================================ */

/* ================= מסך "היום" =================
   התשובה ל"מה דורש אותי עכשיו?" בפחות מדקה. */

function renderTodayView() {
  const container = $('#view-container');
  const today = todayStr();
  const active = S.projects.filter(p => !p.completed);

  // דורש תשומת לב
  const overdue = active.filter(p => p.deadline && p.deadline < today)
    .sort((a, b) => a.deadline < b.deadline ? -1 : 1);
  const stuck = active.filter(p => !p.deadline && daysSince(p.updatedAt) >= 7);
  const waitingIdeas = S.ideas.filter(i => !i.archived && daysSince(i.updatedAt) >= 30);

  // דדליינים השבוע
  const week = new Date(Date.now() + 7 * 86400000);
  const weekStr = week.getFullYear() + '-' + String(week.getMonth() + 1).padStart(2, '0') + '-' + String(week.getDate()).padStart(2, '0');
  const thisWeek = active.filter(p => p.deadline && p.deadline >= today && p.deadline <= weekStr)
    .sort((a, b) => a.deadline < b.deadline ? -1 : 1);

  // מה השתנה מאז הביקור האחרון
  const newChanges = unseenChanges().slice(0, 8);

  // שורת סיכום
  const monthStart = today.slice(0, 8) + '01';
  const doneThisMonth = S.projects.filter(p => p.completed && p.completedAt && p.completedAt.slice(0, 10) >= monthStart).length;
  const openIdeas = S.ideas.filter(i => !i.archived).length;

  const hello = S.displayName ? 'שלום, ' + S.displayName : 'שלום';

  let html =
    '<div class="page-header"><div class="page-header-text">' +
      '<span class="page-title">☀️ ' + esc(hello) + '</span>' +
    '</div></div>' +
    '<div class="summary-line">📋 <b>' + active.length + '</b> פרויקטים פעילים · 💡 <b>' + openIdeas + '</b> רעיונות פתוחים · ✅ <b>' + doneThisMonth + '</b> הסתיימו החודש</div>';

  // --- דורש תשומת לב ---
  html += '<div class="today-section"><div class="today-section-title">🚨 דורש תשומת לב</div>';
  if (!overdue.length && !stuck.length && !waitingIdeas.length) {
    html += '<div class="today-empty">✅ הכל בשליטה — אין פרויקטים תקועים או באיחור</div>';
  } else {
    html += overdue.map(p =>
      '<div class="today-card urgent" data-kind="project" data-id="' + esc(p.id) + '">' +
        '<b>' + esc(p.name) + '</b>' +
        (clientName(p.clientId) ? '<span class="reason">👤 ' + esc(clientName(p.clientId)) + '</span>' : '') +
        '<span class="tag tag-deadline-overdue">⚠️ הדדליין עבר — ' + fmtDate(p.deadline) + '</span>' +
      '</div>').join('');
    html += stuck.map(p =>
      '<div class="today-card warn" data-kind="project" data-id="' + esc(p.id) + '">' +
        '<b>' + esc(p.name) + '</b>' +
        '<span class="reason">😴 בלי דדליין ובלי עדכון ' + daysSince(p.updatedAt) + ' ימים</span>' +
      '</div>').join('');
    html += waitingIdeas.map(i =>
      '<div class="today-card warn" data-kind="idea" data-id="' + esc(i.id) + '">' +
        '<b>💡 ' + esc(i.name) + '</b>' +
        '<span class="tag tag-waiting">רעיון מחכה להחלטה — ' + daysSince(i.createdAt) + ' ימים</span>' +
      '</div>').join('');
  }
  html += '</div>';

  // --- דדליינים השבוע ---
  html += '<div class="today-section"><div class="today-section-title">📅 דדליינים השבוע</div>';
  html += thisWeek.length ? thisWeek.map(p =>
    '<div class="today-card info" data-kind="project" data-id="' + esc(p.id) + '">' +
      '<b>' + esc(p.name) + '</b>' +
      (p.status ? '<span class="tag tag-status">' + esc(p.status) + '</span>' : '') +
      '<span class="tag tag-deadline-soon">⏰ ' + fmtDate(p.deadline) + '</span>' +
    '</div>').join('')
    : '<div class="today-empty">אין דדליינים השבוע</div>';
  html += '</div>';

  // --- מה השתנה מאז הביקור האחרון ---
  html += '<div class="today-section"><div class="today-section-title">🔔 מה חדש מאז הביקור האחרון</div>';
  html += newChanges.length ? newChanges.map(c =>
    '<div class="today-card" data-kind="change" data-entity-type="' + esc(c.entityType) + '" data-id="' + esc(c.entityId) + '">' +
      '<b>' + esc(userDisplay(c.user)) + '</b>' +
      '<span class="reason">' + esc((ENTITY_LABELS[c.entityType] || '') + ' "' + c.entityName + '" — ' + changeTypeText(c.changeType)) + '</span>' +
      '<span class="reason">' + relTime(c.ts) + '</span>' +
    '</div>').join('')
    : '<div class="today-empty">אין עדכונים חדשים — הכל מעודכן</div>';
  html += '</div>';

  container.innerHTML = html;

  container.querySelectorAll('.today-card').forEach(card => {
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
      '<span class="page-title">💡 ' + (showIdeasArchive ? 'ארכיון רעיונות' : 'רעיונות') + '</span>' +
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
        '<span class="entity-name">💡 ' + esc(i.name) + '</span>' +
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
  $('#idea-panel .panel-title').textContent = '💡 ' + i.name;

  const body = $('#idea-panel-body');
  body.innerHTML =
    fieldRowHtml({ label: 'שם', field: 'name', value: i.name }) +
    fieldRowHtml({ label: 'תיאור', field: 'description', value: i.description, type: 'textarea' }) +
    fieldRowHtml({ label: 'לקוח', field: 'clientId', value: i.clientId, display: clientName(i.clientId), type: 'select' }) +
    '<div class="field-row"><span class="field-label">נוסף</span><span class="field-value readonly">' +
      esc(fmtDate(i.createdAt) + ' ע"י ' + userDisplay(i.createdBy)) + '</span></div>' +
    (i.archived ? '<div class="field-row"><span class="field-label">בארכיון</span><span class="field-value readonly">' +
      esc((i.archiveReason || 'ללא סיבה') + ' · ' + fmtDate(i.archivedAt)) + '</span></div>' : '') +
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
      '<span class="page-title">👤 לקוחות</span>' +
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
  $('#client-panel .panel-title').textContent = '👤 ' + c.name;

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
      '<span class="page-title">📦 מוצרים וספקים</span>' +
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
  $('#supplier-panel .panel-title').textContent = '📦 ' + s.name;

  const projects = projectsOfSupplier(s.id);
  const body = $('#supplier-panel-body');
  body.innerHTML =
    fieldRowHtml({ label: 'שם המפעל', field: 'name', value: s.name }) +
    fieldRowHtml({ label: 'תחום', field: 'field', value: s.field }) +
    fieldRowHtml({ label: 'איש קשר', field: 'contactName', value: s.contactName }) +
    fieldRowHtml({ label: 'WeChat', field: 'wechat', value: s.wechat }) +
    fieldRowHtml({ label: 'טלפון', field: 'phone', value: s.phone, type: 'tel' }) +
    fieldRowHtml({ label: 'הערות', field: 'notes', value: s.notes, type: 'textarea' }) +
    '<div class="form-hint">כדאי לשמור כאן: מחירים אחרונים, איכות, זמני ייצור</div>' +
    '<div class="log-section-title" style="margin-top:1.1rem">📋 פרויקטים שיוצרו אצלו (' + projects.length + ')</div>' +
    '<div class="related-list">' +
      (projects.length ? projects.map(p =>
        '<div class="related-item" data-id="' + esc(p.id) + '">' + (p.completed ? '✅' : '📋') + ' <b>' + esc(p.name) + '</b>' +
        (clientName(p.clientId) ? '<span style="color:var(--text-muted)">' + esc(clientName(p.clientId)) + '</span>' : '') +
        '</div>').join('') : '<div style="color:var(--text-muted)">עדיין לא שויכו פרויקטים לספק זה (משייכים דרך שדה "ספק" בפרויקט)</div>') +
    '</div>';

  wireInlineEdits(body, {
    getValue: (f) => s[f],
    options: () => null,
    save: (f, v) => updateFieldOptimistic('supplier', s.id, f, v, () => { renderSupplierPanel(); renderCurrentView(); })
  });
  body.querySelectorAll('.related-item').forEach(item => {
    item.onclick = () => openProjectPanel(item.dataset.id);
  });

  $('#supplier-panel-footer').innerHTML =
    (isBoss() ? '<button class="btn-danger" id="sp-delete">🗑 מחק ספק</button>' : '');
  const bD = $('#sp-delete');
  if (bD) bD.onclick = () => deleteSupplierFlow(s.id);
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

function openAddSupplierModal() {
  openModal({
    title: 'ספק / מפעל חדש',
    bodyHtml:
      '<div class="form-group"><label class="form-label">שם המפעל *</label><input type="text" id="as-name" class="form-input"></div>' +
      '<div class="form-grid">' +
        '<div class="form-group"><label class="form-label">תחום</label><input type="text" id="as-field" class="form-input" placeholder="צעצועים / אקריליק / אריזות..."></div>' +
        '<div class="form-group"><label class="form-label">איש קשר</label><input type="text" id="as-contact" class="form-input"></div>' +
        '<div class="form-group"><label class="form-label">WeChat</label><input type="text" id="as-wechat" class="form-input"></div>' +
        '<div class="form-group"><label class="form-label">טלפון</label><input type="tel" id="as-phone" class="form-input"></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">הערות</label><textarea id="as-notes" class="form-textarea" placeholder="מחירים, איכות, זמני ייצור..."></textarea></div>',
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
          notes: back.querySelector('#as-notes').value.trim()
        };
        close();
        S.suppliers.push(obj);
        try {
          const res = await api('create', { entity: 'supplier', obj });
          if (res.obj) mergeEntity('supplier', res.obj);
          toast('הספק נוסף ✓', 'success');
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
