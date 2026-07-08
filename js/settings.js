/* ================================================================
   הגדרות — סיסמה, סטטוסים, גיבוי, ייבוא, נגישות | שיאים 2.0
   ================================================================ */

const BIG_TEXT_KEY = 'shiaim2_bigtext';

function applyBigText() {
  document.documentElement.classList.toggle('big-text', localStorage.getItem(BIG_TEXT_KEY) === '1');
}

function renderSettingsView() {
  const container = $('#view-container');
  const bigText = localStorage.getItem(BIG_TEXT_KEY) === '1';

  container.innerHTML =
    '<div class="page-header"><div class="page-header-text">' +
      '<span class="page-title">⚙️ הגדרות</span>' +
    '</div></div>' +

    (IS_DEMO ?
      '<div class="settings-card" style="border-color:var(--gold);background:var(--amber-bg)">' +
        '<h3>🧪 מצב הדגמה</h3>' +
        '<p>המערכת רצה כרגע על נתוני דוגמה בדפדפן בלבד. כדי לחבר לשרת האמיתי — עוקבים אחרי docs/מדריך-התקנה.md ומדביקים את כתובת השרת ב-js/config.js.</p>' +
        '<div class="settings-actions"><button class="btn-secondary" id="btn-reset-demo">אפס נתוני הדגמה</button></div>' +
      '</div>' : '') +

    '<div class="settings-card">' +
      '<h3>👤 החשבון שלי</h3>' +
      '<p>מחובר כ<b>' + esc(S.displayName) + '</b> (' + (isBoss() ? 'מנהל' : 'משתמש') + '). שינוי סיסמה תקף מיד בכל המכשירים.</p>' +
      '<div class="settings-actions"><button class="btn-primary" id="btn-change-password">🔑 שינוי סיסמה</button></div>' +
    '</div>' +

    '<div class="settings-card">' +
      '<h3>👁 תצוגה</h3>' +
      '<div class="toggle-row"><span>מצב טקסט גדול — מגדיל את כל הכתב באפליקציה</span>' +
        '<label class="switch"><input type="checkbox" id="big-text-toggle"' + (bigText ? ' checked' : '') + '><span class="slider"></span></label>' +
      '</div>' +
    '</div>' +

    (isBoss() ?
      '<div class="settings-card">' +
        '<h3>🏷 סטטוסים של פרויקטים</h3>' +
        '<p>שינוי שם סטטוס יעדכן אוטומטית את כל הפרויקטים שמשתמשים בו. אפשר לגרור ⠿ כדי לשנות סדר.</p>' +
        '<div class="settings-actions"><button class="btn-primary" id="btn-manage-statuses">ניהול סטטוסים</button></div>' +
      '</div>' : '') +

    '<div class="settings-card">' +
      '<h3>💾 גיבוי</h3>' +
      '<p>מוריד קובץ עם כל הנתונים — פרויקטים, רעיונות, לקוחות, ספקים ויומן השינויים.</p>' +
      '<div class="settings-actions">' +
        '<button class="btn-primary" id="btn-backup-json">הורד גיבוי מלא (JSON)</button>' +
        '<button class="btn-secondary" id="btn-backup-csv">הורד לאקסל (CSV)</button>' +
      '</div>' +
    '</div>' +

    (isBoss() && !IS_DEMO ?
      '<div class="settings-card">' +
        '<h3>📥 ייבוא מהמערכת הישנה</h3>' +
        '<p>מייבא את כל הפרויקטים, הסטטוסים ויומן השינויים מהמערכת הקודמת, והופך אוטומטית את שמות הלקוחות לכרטיסי לקוח. בטוח להריץ פעם אחת בלבד.</p>' +
        '<div class="settings-actions"><button class="btn-secondary" id="btn-migrate">התחל ייבוא</button></div>' +
      '</div>' : '') +

    '<div class="settings-card">' +
      '<h3>ℹ️ על המערכת</h3>' +
      '<p>התנהלות שוטפת — שיאים · גרסה ' + esc(APP_VERSION) + '</p>' +
    '</div>';

  $('#btn-change-password').onclick = openChangePasswordModal;
  $('#big-text-toggle').onchange = (e) => {
    localStorage.setItem(BIG_TEXT_KEY, e.target.checked ? '1' : '0');
    applyBigText();
    toast(e.target.checked ? 'טקסט גדול הופעל' : 'חזרנו לגודל רגיל', 'success');
  };
  const bS = $('#btn-manage-statuses');
  if (bS) bS.onclick = openStatusesModal;
  $('#btn-backup-json').onclick = () => exportBackup('json');
  $('#btn-backup-csv').onclick = () => exportBackup('csv');
  const bM = $('#btn-migrate');
  if (bM) bM.onclick = openMigrationModal;
  const bR = $('#btn-reset-demo');
  if (bR) bR.onclick = async () => {
    const ok = await confirmModal({ title: 'איפוס הדגמה', message: 'להחזיר את נתוני הדוגמה למצב ההתחלתי?', btnLabel: 'אפס' });
    if (ok) { localStorage.removeItem('shiaim2_demo_db'); location.reload(); }
  };
}

/* ================= שינוי סיסמה ================= */

function openChangePasswordModal() {
  openModal({
    title: 'שינוי סיסמה',
    maxWidth: '380px',
    bodyHtml:
      '<div class="form-group"><label class="form-label">סיסמה נוכחית</label><input type="password" id="cp-current" class="form-input"></div>' +
      '<div class="form-group"><label class="form-label">סיסמה חדשה</label><input type="password" id="cp-new" class="form-input" placeholder="לפחות 4 תווים"></div>' +
      '<div class="form-group"><label class="form-label">אימות סיסמה חדשה</label><input type="password" id="cp-confirm" class="form-input"></div>' +
      '<div class="form-hint">הסיסמה מתעדכנת בשרת — תעבוד מיד מכל מכשיר.</div>',
    footerHtml: '<button class="btn-primary" id="cp-submit">עדכן סיסמה</button><button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      back.querySelector('#cp-submit').onclick = async () => {
        const current = back.querySelector('#cp-current').value;
        const np = back.querySelector('#cp-new').value;
        const confirm = back.querySelector('#cp-confirm').value;
        if (np.length < 4) { toast('הסיסמה החדשה קצרה מדי — לפחות 4 תווים', 'error'); return; }
        if (np !== confirm) { toast('אימות הסיסמה לא תואם', 'error'); return; }
        try {
          await api('changePassword', { current, newPassword: np }, { noQueue: true });
          close();
          toast('הסיסמה עודכנה ✓ תקפה מעכשיו בכל המכשירים', 'success');
        } catch (e) { toast(friendlyError(e.code), 'error'); }
      };
    }
  });
}

/* ================= ניהול סטטוסים (בוס) =================
   כולל גרירת סדר ⠿ ועדכון פרויקטים בשינוי שם. */

function openStatusesModal() {
  // עותק עבודה: [{original, current}] — כדי לזהות שינויי שם
  let working = S.statuses.map(s => ({ original: s, current: s }));

  const modal = openModal({
    title: 'ניהול סטטוסים',
    bodyHtml: '<div class="statuses-list" id="statuses-list"></div>' +
      '<button class="btn-secondary btn-block" id="btn-add-status">+ הוסף סטטוס</button>' +
      '<button class="btn-secondary btn-block" id="btn-add-shipping-statuses">🚢 הוסף שלבי ייצור ומשלוח מומלצים</button>' +
      '<div class="form-hint">גרור ⠿ לשינוי סדר · שינוי שם מעדכן את כל הפרויקטים</div>',
    footerHtml: '<button class="btn-primary" id="btn-save-statuses">שמור</button><button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      const listEl = back.querySelector('#statuses-list');

      function renderList() {
        listEl.innerHTML = working.map((w, i) =>
          '<div class="status-edit-row" draggable="true" data-idx="' + i + '">' +
            '<span class="drag-handle">⠿</span>' +
            '<input type="text" value="' + esc(w.current) + '">' +
            '<button class="status-del" title="הסר">✕</button>' +
          '</div>'
        ).join('');

        let dragIdx = null;
        listEl.querySelectorAll('.status-edit-row').forEach(row => {
          const idx = Number(row.dataset.idx);
          row.querySelector('input').addEventListener('input', (e) => { working[idx].current = e.target.value; });
          row.querySelector('.status-del').onclick = () => { working.splice(idx, 1); renderList(); };

          // גרירה — עכבר
          row.addEventListener('dragstart', () => { dragIdx = idx; row.classList.add('dragging'); });
          row.addEventListener('dragend', () => { row.classList.remove('dragging'); });
          row.addEventListener('dragover', (e) => e.preventDefault());
          row.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dragIdx === null || dragIdx === idx) return;
            const [moved] = working.splice(dragIdx, 1);
            working.splice(idx, 0, moved);
            renderList();
          });

          // גרירה — מגע (נייד): כפתורי מעלה/מטה בלחיצה על הידית
          row.querySelector('.drag-handle').addEventListener('click', () => {
            if (idx > 0) { const [m] = working.splice(idx, 1); working.splice(idx - 1, 0, m); renderList(); }
          });
        });
      }
      renderList();

      back.querySelector('#btn-add-status').onclick = () => {
        working.push({ original: null, current: '' });
        renderList();
        const inputs = listEl.querySelectorAll('input');
        inputs[inputs.length - 1].focus();
      };

      back.querySelector('#btn-add-shipping-statuses').onclick = () => {
        const recommended = ['סיים ייצור', 'יצא למשלוח', 'במשלוח אוניה', 'במשלוח אוויר', 'הגיע לנמל בישראל', 'שוחרר', 'סיום תהליך'];
        let added = 0;
        recommended.forEach(name => {
          if (!working.some(w => w.current.trim() === name)) { working.push({ original: null, current: name }); added++; }
        });
        renderList();
        toast(added ? 'נוספו ' + added + ' שלבים — לחץ שמור לסיום' : 'כל השלבים כבר קיימים', added ? 'success' : '');
      };

      back.querySelector('#btn-save-statuses').onclick = async () => {
        const statuses = working.map(w => w.current.trim()).filter(Boolean);
        if (!statuses.length) { toast('חייב להישאר לפחות סטטוס אחד', 'error'); return; }
        // מיפוי שינויי שם: ישן → חדש
        const renames = {};
        working.forEach(w => {
          if (w.original && w.current.trim() && w.original !== w.current.trim()) renames[w.original] = w.current.trim();
        });
        try {
          const res = await api('updateStatuses', { statuses, renames });
          S.statuses = statuses;
          // עדכון מקומי של הפרויקטים לפי שינויי השם
          S.projects.forEach(p => {
            if (renames[p.status]) p.status = renames[p.status];
            (p.designs || []).forEach(d => { if (renames[d.status]) d.status = renames[d.status]; });
          });
          close();
          toast(res.queued ? 'נשמר במכשיר ⏳' : 'הסטטוסים נשמרו ✓', res.queued ? '' : 'success');
          renderCurrentView();
        } catch (e) { toast(friendlyError(e.code), 'error'); }
      };
    }
  });
  return modal;
}

/* ================= גיבוי ================= */

async function exportBackup(format) {
  showSpinner(true);
  try {
    const res = await api('exportBackup', {}, { noQueue: true });
    const stamp = todayStr();
    if (format === 'json') {
      downloadFile('גיבוי-שיאים-' + stamp + '.json', JSON.stringify(res, null, 2), 'application/json');
    } else {
      // CSV עם BOM — נפתח יפה באקסל בעברית
      const rows = [['שם', 'לקוח', 'סוג', 'סטטוס', 'דדליין', 'דחיפות', 'הסתיים', 'ספק', 'נוצר', 'הערות אחרונות']];
      (res.projects || []).forEach(p => {
        rows.push([
          p.name, clientName(p.clientId) || p.client || '', p.type === 'office' ? 'משרד' : 'לקוח',
          p.status || '', p.deadline || '', p.priority || 0, p.completed ? 'כן' : 'לא',
          supplierName(p.supplierId) || '', (p.createdAt || '').slice(0, 10),
          ((p.notes || []).slice(-1)[0] || {}).text || ''
        ]);
      });
      rows.push([]); rows.push(['— רעיונות —']);
      rows.push(['שם', 'תיאור', 'לקוח', 'בארכיון', 'סיבה']);
      (res.ideas || []).forEach(i => rows.push([i.name, i.description || '', clientName(i.clientId), i.archived ? 'כן' : 'לא', i.archiveReason || '']));
      const csv = '﻿' + rows.map(r => r.map(cell => '"' + String(cell ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
      downloadFile('גיבוי-שיאים-' + stamp + '.csv', csv, 'text/csv;charset=utf-8');
    }
    toast('הגיבוי ירד למכשיר ✓', 'success');
  } catch (e) {
    toast(e.code === 'network' ? 'גיבוי דורש חיבור לאינטרנט' : friendlyError(e.code), 'error');
  } finally {
    showSpinner(false);
  }
}

/* ================= ייבוא מהמערכת הישנה (בוס) =================
   קורא מה-API הישן (getProjects/getStatuses/getChanges),
   הופך מחרוזות לקוח לישויות לקוח, ושולח לשרת החדש בבת אחת. */

function openMigrationModal() {
  openModal({
    title: 'ייבוא מהמערכת הישנה',
    bodyHtml:
      '<div class="form-group"><label class="form-label">כתובת ה-Apps Script של המערכת הישנה</label>' +
      '<input type="url" id="mig-url" class="form-input" placeholder="https://script.google.com/macros/s/..." dir="ltr"></div>' +
      '<div class="form-hint">הכתובת נמצאת אצל אהרון (זו שהודבקה פעם בכל מכשיר). הייבוא לא מוחק כלום במערכת הישנה.</div>' +
      '<div id="mig-status" style="margin-top:.8rem;color:var(--text-sec)"></div>',
    footerHtml: '<button class="btn-primary" id="mig-start">התחל ייבוא</button><button class="btn-secondary btn-modal-close">סגור</button>',
    onOpen(back, close) {
      const status = back.querySelector('#mig-status');
      back.querySelector('#mig-start').onclick = async () => {
        const url = back.querySelector('#mig-url').value.trim();
        if (!url.startsWith('https://script.google.com/')) { toast('זו לא נראית כתובת Apps Script תקינה', 'error'); return; }
        const btn = back.querySelector('#mig-start');
        btn.disabled = true;
        const oldApi = async (action, data = {}) => {
          const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(Object.assign({ action }, data)) });
          return r.json();
        };
        try {
          status.textContent = 'קורא נתונים מהמערכת הישנה...';
          const [projRes, statRes, changesRes] = await Promise.all([
            oldApi('getProjects'), oldApi('getStatuses'), oldApi('getChanges')
          ]);
          const oldProjects = projRes.projects || projRes.data || projRes || [];
          const oldStatuses = statRes.statuses || statRes.data || [];
          const oldChanges = changesRes.changes || changesRes.data || [];
          if (!Array.isArray(oldProjects) || !oldProjects.length) {
            status.textContent = 'לא נמצאו פרויקטים בכתובת הזו — בדקו את הכתובת.';
            btn.disabled = false;
            return;
          }

          status.textContent = 'ממיר ' + oldProjects.length + ' פרויקטים ובונה כרטיסי לקוח...';
          // מחרוזת לקוח → ישות לקוח
          const clientMap = {};   // שם → id
          S.clients.forEach(c => { clientMap[c.name.trim()] = c.id; });
          const newClients = [];
          const projects = oldProjects.map(p => {
            const cName = String(p.client || '').trim();
            let clientId = '';
            if (cName) {
              if (!clientMap[cName]) {
                const id = uid();
                clientMap[cName] = id;
                newClients.push({ id, name: cName, contactName: '', phone: '', notes: '' });
              }
              clientId = clientMap[cName];
            }
            return {
              id: p.id, name: p.name, clientId, type: p.type || 'client',
              status: p.status || '', deadline: p.deadline || '',
              priority: Number(p.priority) || 0,
              notes: p.notes || [], importantInfo: p.importantInfo || [],
              designs: (p.designs || []).map(d => Object.assign({ id: d.id || uid() }, d)),
              completed: !!p.completed, completedAt: p.completedAt || '',
              createdAt: p.createdAt || '', createdBy: p.createdBy || '',
              folderId: p.folderId || '', supplierId: ''
            };
          });

          status.textContent = 'שולח לשרת החדש...';
          const res = await api('importData', {
            projects, clients: newClients,
            statuses: oldStatuses.length ? oldStatuses : null,
            changes: oldChanges
          }, { noQueue: true });

          const c = res.counts || {};
          status.innerHTML = '✅ הייבוא הושלם: <b>' + (c.projects || 0) + '</b> פרויקטים, <b>' + (c.clients || 0) + '</b> לקוחות, <b>' + (c.changes || 0) + '</b> רשומות יומן.';
          toast('הייבוא הושלם ✓', 'success');
          await loadAll();
          renderCurrentView();
        } catch (e) {
          status.textContent = 'הייבוא נכשל: ' + friendlyError(e.code) + ' — אפשר לנסות שוב, שום דבר לא נמחק.';
        } finally {
          btn.disabled = false;
        }
      };
    }
  });
}
