/* ================================================================
   כלי עזר — שיאים 2.0
   ================================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
  if (deadline < today) return { key: 'overdue', cls: 'tag-deadline-overdue', label: '⚠️ עבר — ' + fmtDate(deadline) };
  const week = new Date(Date.now() + 7 * 86400000);
  const weekStr = week.getFullYear() + '-' + String(week.getMonth() + 1).padStart(2, '0') + '-' + String(week.getDate()).padStart(2, '0');
  if (deadline <= weekStr) return { key: 'soon', cls: 'tag-deadline-soon', label: '⏰ ' + fmtDate(deadline) };
  return { key: 'future', cls: '', label: '📅 ' + fmtDate(deadline) };
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
