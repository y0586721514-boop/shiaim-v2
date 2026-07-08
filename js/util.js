/* ================================================================
   כלי עזר — שיאים 2.0
   ================================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ================= אייקונים — SVG בקו אחיד, נקי ומקצועי ================= */

const ICON_PATHS = {
  today:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  projects:  '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  ideas:     '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
  clients:   '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  suppliers: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  settings:  '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  more:      '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  alert:     '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  calendar:  '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  bell:      '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  truck:     '<path d="M3 7h11v8H3z"/><path d="M14 10h4l3 3v2h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>',
  check:     '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  pause:     '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
  logout:    '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  note:      '<path d="M21 15a2 2 0 0 1-2 2H8l-4 3V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/>',
  info:      '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  design:    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L6 20"/>',
  paperclip: '<path d="M21 8l-9.5 9.5a4 4 0 0 1-5.7-5.7L14 4a2.5 2.5 0 0 1 3.5 3.5L9 16"/>',
  search:    '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
  user:      '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
};

/** מחזיר SVG של אייקון בקו אחיד. name מתוך ICON_PATHS. */
function icon(name, cls) {
  const p = ICON_PATHS[name];
  if (!p) return '';
  return '<svg class="icn' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** מוסיף https:// לכתובת אתר אם חסר, לקישור תקין */
function normalizeUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : 'https://' + u;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

/** המרת מספר לגימטריה עברית עם גרש/גרשיים. למשל 27→כ״ז, 786→תשפ״ו */
function gematria(num) {
  num = num % 1000; // בשנים משמיטים את האלפים (5786 → תשפ״ו)
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  let s = hundreds[Math.floor(num / 100)];
  let rem = num % 100;
  if (rem === 15) s += 'טו';
  else if (rem === 16) s += 'טז';
  else { s += tens[Math.floor(rem / 10)]; s += ones[rem % 10]; }
  if (!s) return '';
  if (s.length === 1) return s + '׳';                       // גרש לאות בודדת
  return s.slice(0, -1) + '״' + s.slice(-1);                // גרשיים לפני האות האחרונה
}

/** תאריך עברי בגימטריה. למשל: "כ״ז בתמוז תשפ״ו" */
function hebrewDate(iso) {
  if (!iso) return '';
  const d = (iso instanceof Date) ? iso : new Date(iso);
  if (isNaN(d)) return '';
  try {
    const parts = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(d);
    return parts.map(p => {
      if (p.type === 'day') return gematria(parseInt(p.value, 10));
      if (p.type === 'year') return gematria(parseInt(p.value, 10));
      return p.value; // שמות חודשים ורווחים נשארים כמו שהם
    }).join('');
  } catch (e) { return ''; }
}

/** לועזי + עברי יחד. למשל: "15.7.2026 · כ״ז בתמוז תשפ״ו" */
function fmtDateBoth(iso) {
  const g = fmtDate(iso);
  if (!g) return '';
  const h = hebrewDate(iso);
  return h ? g + ' · ' + h : g;
}

/** HTML עם הלועזי מודגש והעברי מעומעם — לתצוגות מפורטות */
function dateBothHtml(iso) {
  const g = fmtDate(iso);
  if (!g) return '';
  const h = hebrewDate(iso);
  return esc(g) + (h ? ' <span class="date-heb">' + esc(h) + '</span>' : '');
}

/**
 * מחבר תווית תאריך עברי חיה לשדה תאריך: כשמזינים תאריך לועזי,
 * מתעדכן אוטומטית התאריך העברי לצידו.
 */
function attachHebrewHint(input) {
  if (!input) return;
  let hint = input.parentNode.querySelector('.date-heb-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'date-heb-hint';
    input.parentNode.appendChild(hint);
  }
  const update = () => {
    const h = input.value ? hebrewDate(input.value) : '';
    hint.textContent = h ? '📅 ' + h : '';
  };
  input.addEventListener('input', update);
  input.addEventListener('change', update);
  update();
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) + ' ' +
         d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

/** זמן יחסי בעברית: "לפני 5 דקות", "לפני שעתיים", "אתמול" */
function relTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'ממש עכשיו';
  if (min === 1) return 'לפני דקה';
  if (min < 60) return 'לפני ' + min + ' דקות';
  const hr = Math.floor(min / 60);
  if (hr === 1) return 'לפני שעה';
  if (hr === 2) return 'לפני שעתיים';
  if (hr < 24) return 'לפני ' + hr + ' שעות';
  const days = Math.floor(hr / 24);
  if (days === 1) return 'אתמול';
  if (days === 2) return 'שלשום';
  if (days < 30) return 'לפני ' + days + ' ימים';
  return fmtDate(iso);
}

/** כמה ימים עברו מאז תאריך (ISO) */
function daysSince(iso) {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** מצב דדליין: overdue / soon (השבוע) / future / none */
function deadlineInfo(deadline) {
  if (!deadline) return { key: 'none', cls: '', label: '' };
  const today = todayStr();
  if (deadline < today) return { key: 'overdue', cls: 'tag-deadline-overdue', label: 'עבר · ' + fmtDateBoth(deadline) };
  const week = new Date(Date.now() + 7 * 86400000);
  const weekStr = week.getFullYear() + '-' + String(week.getMonth() + 1).padStart(2, '0') + '-' + String(week.getDate()).padStart(2, '0');
  if (deadline <= weekStr) return { key: 'soon', cls: 'tag-deadline-soon', label: 'השבוע · ' + fmtDateBoth(deadline) };
  return { key: 'future', cls: '', label: fmtDateBoth(deadline) };
}

function stars(priority) {
  const p = Number(priority) || 0;
  if (!p) return '';
  return '★'.repeat(p) + '☆'.repeat(5 - p);
}

/* ================= Toast (כולל כפתור ביטול) ================= */

function toast(msg, type = '', opts = {}) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = '<span>' + esc(msg) + '</span>';
  const duration = opts.duration || (opts.undo ? 10000 : 2600);

  if (opts.undo) {
    const btn = document.createElement('button');
    btn.className = 'toast-undo';
    btn.textContent = 'בטל';
    btn.onclick = () => { el.remove(); opts.undo(); };
    el.appendChild(btn);
  }
  $('#toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, duration);
  return el;
}

function showSpinner(show) {
  $('#spinner').classList.toggle('hidden', !show);
}

/** הודעת שגיאה ידידותית בעברית */
function friendlyError(err) {
  const map = {
    unauthorized: 'החיבור פג — צריך להתחבר מחדש',
    bad_credentials: 'שם המשתמש או הסיסמה לא נכונים',
    bad_current_password: 'הסיסמה הנוכחית לא נכונה',
    password_too_short: 'הסיסמה קצרה מדי — צריך לפחות 4 תווים',
    forbidden: 'אין לך הרשאה לפעולה הזו — רק יעקב יכול',
    not_found: 'הפריט לא נמצא — אולי נמחק בינתיים',
    file_too_big: 'הקובץ גדול מדי — עד 20MB',
    missing_name: 'חסר שם — אי אפשר לשמור בלי שם',
    network: 'אין חיבור לאינטרנט — השינוי יישמר ברגע שיחזור החיבור',
    already_setup: 'המערכת כבר הוקמה — אפשר פשוט להתחבר'
  };
  return map[err] || 'משהו השתבש — נסה שוב עוד רגע';
}

/* ================= מודלים גנריים ================= */

/**
 * פותח מודל. מקבל {title, bodyHtml, footerHtml, onOpen}.
 * מחזיר את אלמנט המודל. סגירה: כפתורי .btn-modal-close או קליק על הרקע.
 */
function openModal({ title, bodyHtml, footerHtml, onOpen, maxWidth }) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML =
    '<div class="modal-box"' + (maxWidth ? ' style="max-width:' + maxWidth + '"' : '') + '>' +
      '<div class="modal-header"><span class="modal-title">' + esc(title) + '</span>' +
      '<button class="btn-modal-close">✕</button></div>' +
      '<div class="modal-body">' + bodyHtml + '</div>' +
      (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') +
    '</div>';
  $('#modal-root').appendChild(back);
  const close = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.querySelectorAll('.btn-modal-close').forEach(b => b.onclick = close);
  back.close = close;
  if (onOpen) onOpen(back, close);
  const firstInput = back.querySelector('input, textarea, select');
  if (firstInput && window.matchMedia('(min-width: 720px)').matches) firstInput.focus();
  return back;
}

/** מודל אישור לפעולה הרסנית */
function confirmModal({ title, message, btnLabel, danger = true }) {
  return new Promise((resolve) => {
    openModal({
      title: title || 'אישור',
      maxWidth: '360px',
      bodyHtml: '<p class="confirm-message">' + esc(message) + '</p>',
      footerHtml:
        '<button class="' + (danger ? 'btn-danger' : 'btn-primary') + '" data-act="ok">' + esc(btnLabel || 'אישור') + '</button>' +
        '<button class="btn-secondary btn-modal-close">ביטול</button>',
      onOpen(back, close) {
        back.querySelector('[data-act="ok"]').onclick = () => { close(); resolve(true); };
        back.addEventListener('click', (e) => { if (e.target === back) resolve(false); });
        back.querySelectorAll('.btn-modal-close').forEach(b => {
          const orig = b.onclick;
          b.onclick = () => { if (orig) orig(); resolve(false); };
        });
      }
    });
  });
}

/* ================= קבצים ================= */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function fileIcon(mimeType) {
  const m = String(mimeType || '');
  if (m.startsWith('image/')) return '🖼️';
  if (m.includes('pdf')) return '📕';
  if (m.includes('sheet') || m.includes('excel')) return '📊';
  if (m.includes('word') || m.includes('document')) return '📄';
  if (m.includes('zip') || m.includes('rar')) return '🗜️';
  return '📎';
}

/** הורדת קובץ מהדפדפן */
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
