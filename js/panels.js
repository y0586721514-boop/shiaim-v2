/* ================================================================
   פאנלים, עריכה inline ויומן שינויים — שיאים 2.0
   ================================================================ */

/* ================= פתיחה/סגירה של פאנלים ================= */

const openPanels = [];

function openPanel(id) {
  const el = $('#' + id);
  el.classList.add('open');
  if (!openPanels.includes(id)) openPanels.push(id);
  $('#overlay').classList.remove('hidden');
}

function closePanel(id) {
  $('#' + id).classList.remove('open');
  const i = openPanels.indexOf(id);
  if (i !== -1) openPanels.splice(i, 1);
  if (!openPanels.length) $('#overlay').classList.add('hidden');
}

function closeAllPanels() {
  openPanels.slice().forEach(closePanel);
}

function wirePanelChrome() {
  $$('.btn-panel-close').forEach(btn => {
    btn.addEventListener('click', () => closePanel(btn.dataset.close));
  });
  $('#overlay').addEventListener('click', () => {
    if (openPanels.length) closePanel(openPanels[openPanels.length - 1]);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openPanels.length && !document.querySelector('.inline-input')) {
      closePanel(openPanels[openPanels.length - 1]);
    }
  });
}

/* ================= בניית שדות עם עריכה inline =================
   לחיצה על ערך → נפתח שדה עריכה → שמירה ב-Enter או ביציאה.
   אפשר גם לרוקן שדה (תיקון באג 13). Escape מבטל. */

function fieldRowHtml({ label, field, value, type = 'text', display, editable = true, options = [] }) {
  const shown = display !== undefined ? display : value;
  const isEmpty = shown === '' || shown === null || shown === undefined;
  return (
    '<div class="field-row" data-field="' + esc(field) + '" data-type="' + esc(type) + '">' +
      '<span class="field-label">' + esc(label) + '</span>' +
      '<span class="field-value ' + (isEmpty ? 'empty' : '') + (editable ? '' : ' readonly') + '" ' +
        (editable ? 'title="לחץ לעריכה"' : '') + '>' +
        (isEmpty ? 'לחץ להוספה' : esc(shown)) +
      '</span>' +
    '</div>'
  );
}

/**
 * מחבר עריכה inline לכל שורות השדות בתוך container.
 * cfg: { getValue(field), save(field, value) → Promise, options(field) → [{value,label}] או null }
 */
function wireInlineEdits(container, cfg) {
  container.querySelectorAll('.field-row').forEach(row => {
    const valEl = row.querySelector('.field-value');
    if (!valEl || valEl.classList.contains('readonly')) return;
    valEl.addEventListener('click', () => startInlineEdit(row, cfg));
  });
}

function startInlineEdit(row, cfg) {
  if (row.querySelector('.inline-input')) return;
  const field = row.dataset.field;
  const type = row.dataset.type;
  const valEl = row.querySelector('.field-value');
  const current = cfg.getValue(field);
  const opts = cfg.options ? cfg.options(field) : null;

  let input;
  if (opts) {
    input = document.createElement('select');
    input.className = 'inline-input';
    opts.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value; opt.textContent = o.label;
      if (String(o.value) === String(current ?? '')) opt.selected = true;
      input.appendChild(opt);
    });
  } else if (type === 'textarea') {
    input = document.createElement('textarea');
    input.className = 'inline-input';
    input.rows = 3;
    input.value = current ?? '';
  } else {
    input = document.createElement('input');
    input.className = 'inline-input';
    input.type = type === 'date' ? 'date' : (type === 'tel' ? 'tel' : 'text');
    input.value = current ?? '';
  }

  valEl.style.display = 'none';
  row.appendChild(input);
  input.focus();
  if (input.select && type !== 'date') try { input.select(); } catch (e) {}

  let finished = false;
  const finish = async (save) => {
    if (finished) return;
    finished = true;
    const newVal = input.value; // גם ערך ריק — מותר!
    input.remove();
    valEl.style.display = '';
    if (save && String(newVal) !== String(current ?? '')) {
      await cfg.save(field, newVal);
    }
  };

  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
  });
  if (opts) input.addEventListener('change', () => finish(true));
}

/* ================= דחיפות (כוכבים) ================= */

function priorityRowHtml(value, editable) {
  let starsHtml = '';
  for (let i = 1; i <= 5; i++) {
    starsHtml += '<span class="star' + (i <= (Number(value) || 0) ? ' on' : '') + '" data-val="' + i + '">★</span>';
  }
  return (
    '<div class="field-row" data-field="priority">' +
      '<span class="field-label">דחיפות</span>' +
      '<span class="priority-edit' + (editable ? '' : ' readonly') + '" ' +
        (editable ? 'title="לחץ לשינוי דחיפות"' : 'title="רק יעקב יכול לשנות דחיפות"') + '>' +
        starsHtml +
      '</span>' +
    '</div>'
  );
}

function wirePriority(container, { editable, save }) {
  const el = container.querySelector('.priority-edit');
  if (!el || !editable) return;
  el.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const val = Number(star.dataset.val);
      const currentOn = el.querySelectorAll('.star.on').length;
      save(val === currentOn ? 0 : val); // לחיצה על אותו כוכב — איפוס
    });
  });
}

/* ================= אזורי הערות / מידע חשוב ================= */

function logEntriesHtml(entries, important) {
  if (!entries || !entries.length) {
    return '<div class="log-entry" style="color:var(--text-muted)">אין עדיין רשומות</div>';
  }
  return entries.slice().reverse().map(e =>
    '<div class="log-entry' + (important ? ' important' : '') + '">' +
      '<div class="log-entry-meta">' + esc(userDisplay(e.user)) + ' · ' + relTime(e.date) + '</div>' +
      '<div>' + esc(e.text) + '</div>' +
    '</div>'
  ).join('');
}

function logSectionHtml(area, entries) {
  const isImportant = area === 'importantInfo';
  return (
    '<div class="log-section" data-area="' + area + '">' +
      '<div class="log-section-title">' + (isImportant ? 'ℹ️ מידע חשוב' : '💬 הערות') + '</div>' +
      '<div class="log-entries">' + logEntriesHtml(entries, isImportant) + '</div>' +
      '<div class="log-add">' +
        '<input type="text" placeholder="' + (isImportant ? 'הוסף מידע חשוב...' : 'הוסף הערה...') + '">' +
        '<button class="btn-primary">הוסף</button>' +
      '</div>' +
    '</div>'
  );
}

/** cfg: { save(area, text) → Promise } */
function wireLogSections(container, cfg) {
  container.querySelectorAll('.log-section').forEach(section => {
    const area = section.dataset.area;
    const input = section.querySelector('.log-add input');
    const btn = section.querySelector('.log-add button');
    const submit = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      await cfg.save(area, text);
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  });
}

/* ================= יומן השינויים (פעמון) ================= */

const CHANGE_ICONS = {
  created: '✨', deleted: '🗑️', completed: '✅', restored: '↩️',
  status: '🔄', priority: '⭐', field: '✏️', note: '💬', archived: '📥'
};

const ENTITY_LABELS = { project: 'פרויקט', idea: 'רעיון', client: 'לקוח', supplier: 'ספק', system: '' };

let changesSeenAtOpen = '';

function openChangesPanel() {
  changesSeenAtOpen = S.lastSeen;
  renderChangesList();
  openPanel('changes-panel');
  // מעכשיו — הכל נחשב "נראה"
  S.lastSeen = new Date().toISOString();
  updateChangesBadge();
  api('updateLastSeen', { ts: S.lastSeen }).catch(() => {});
}

function changeItemHtml(c) {
  const isNew = c.user !== S.user && (!changesSeenAtOpen || c.ts > changesSeenAtOpen);
  const icon = CHANGE_ICONS[c.changeType] || '✏️';
  const entityLabel = ENTITY_LABELS[c.entityType] ?? c.entityType;
  return (
    '<div class="change-item' + (isNew ? ' new' : '') + '">' +
      '<div class="change-item-head">' +
        '<span>' + icon + '</span>' +
        '<span class="who">' + esc(userDisplay(c.user)) + '</span>' +
        '<span>' + relTime(c.ts) + '</span>' +
      '</div>' +
      '<div><span class="change-entity">' + esc(entityLabel ? entityLabel + ' "' + c.entityName + '"' : c.entityName) + '</span> — ' +
        esc(changeTypeText(c.changeType)) + '</div>' +
      (c.details ? '<div class="change-details">' + esc(c.details) + '</div>' : '') +
    '</div>'
  );
}

function changeTypeText(t) {
  return {
    created: 'נוצר', deleted: 'נמחק', completed: 'הסתיים', restored: 'הוחזר',
    status: 'שינוי סטטוס', priority: 'שינוי דחיפות', field: 'עדכון', note: 'הערה', archived: 'הועבר לארכיון'
  }[t] || 'עדכון';
}

function renderChangesList() {
  const list = $('#changes-list');
  if (!S.changes.length) {
    list.innerHTML = '<div class="empty-state">אין עדיין שינויים</div>';
    $('#changes-more').classList.add('hidden');
    return;
  }
  list.innerHTML = S.changes.map(changeItemHtml).join('');
  // pagination: כפתור "טען עוד" אם ייתכן שיש עוד בהיסטוריה
  $('#changes-more').classList.toggle('hidden', S.changes.length < 50);
}

async function loadMoreChanges() {
  const oldest = S.changes[S.changes.length - 1];
  if (!oldest) return;
  const btn = $('#changes-more');
  btn.disabled = true; btn.textContent = 'טוען...';
  try {
    const res = await api('getChanges', { beforeId: oldest.id, limit: 50 });
    const more = res.changes || [];
    S.changes = S.changes.concat(more);
    renderChangesList();
    if (more.length < 50) btn.classList.add('hidden');
  } catch (e) {
    toast(friendlyError(e.code), 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'טען עוד';
  }
}
