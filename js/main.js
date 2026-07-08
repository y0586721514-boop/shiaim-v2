/* ================================================================
   אתחול, ניווט וכניסה — שיאים 2.0
   ================================================================ */

/* ================= ניווט ================= */

const VIEWS = {
  today: renderTodayView,
  projects: renderProjectsView,
  ideas: renderIdeasView,
  design: renderDesignProjectsView,
  clients: renderClientsView,
  suppliers: renderSuppliersView,
  containers: renderContainersView,
  settings: renderSettingsView
};

function renderCurrentView() {
  if (!S.loaded) return;
  (VIEWS[S.view] || renderTodayView)();
  updateNavHighlight();
  updateFab();
}

function setView(view) {
  if (view === 'more') { openMoreMenu(); return; }
  S.view = view;
  closeAllPanels();
  renderCurrentView();
  $('#workspace-body').scrollTop = 0;
  window.scrollTo(0, 0);
}

function updateNavHighlight() {
  $$('.sidebar-nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === S.view));
  $$('.bottom-nav-item').forEach(b => {
    const v = b.dataset.view;
    b.classList.toggle('active', v === S.view || (v === 'more' && (S.view === 'suppliers' || S.view === 'settings' || S.view === 'containers' || S.view === 'design')));
  });
}

/** תפריט "עוד" בנייד — ספקים והגדרות */
function openMoreMenu() {
  openModal({
    title: 'עוד',
    maxWidth: '320px',
    bodyHtml:
      '<button class="btn-secondary btn-block" data-goto="design">🎨 עיצובים</button>' +
      '<button class="btn-secondary btn-block" data-goto="suppliers">📦 מוצרים וספקים</button>' +
      '<button class="btn-secondary btn-block" data-goto="containers">🚢 מכולות</button>' +
      '<button class="btn-secondary btn-block" data-goto="settings">⚙️ הגדרות</button>',
    onOpen(back, close) {
      back.querySelectorAll('[data-goto]').forEach(b => {
        b.onclick = () => { close(); setView(b.dataset.goto); };
      });
    }
  });
}

/** כפתור ה-+ משתנה לפי המסך הנוכחי */
function updateFab() {
  const fab = $('#fab');
  const actions = {
    today: () => openAddProjectModal(),
    projects: () => openAddProjectModal(),
    ideas: () => openAddIdeaModal(),
    design: () => openAddDesignProjectModal(),
    clients: () => openAddClientModal(),
    suppliers: () => openAddSupplierModal(),
    containers: null,
    settings: null
  };
  const titles = {
    today: 'פרויקט חדש', projects: 'פרויקט חדש', ideas: 'רעיון חדש',
    design: 'פרויקט עיצוב חדש', clients: 'לקוח חדש', suppliers: 'ספק חדש'
  };
  const action = actions[S.view];
  fab.classList.toggle('hidden', !action);
  if (action) { fab.onclick = action; fab.title = titles[S.view] || 'הוספה'; }
}

/* ================= מסכים ================= */

function showScreen(id) {
  ['login-screen', 'setup-screen', 'app'].forEach(s => $('#' + s).classList.add('hidden'));
  $('#' + id).classList.remove('hidden');
}

function showLoginScreen(message) {
  showScreen('login-screen');
  if (message) $('#login-error').textContent = message;
}

function renderHeaderUser() {
  $('#user-name').textContent = S.displayName + (isBoss() ? ' · מנהל' : '');
}

/* ================= כניסה ויציאה ================= */

async function handleLogin(e) {
  e.preventDefault();
  const username = $('#login-username').value.trim();
  const password = $('#login-password').value;
  if (!username || !password) { $('#login-error').textContent = 'צריך למלא שם משתמש וסיסמה'; return; }
  $('#login-error').textContent = '';
  showSpinner(true);
  try {
    const res = await api('login', { username, password }, { noQueue: true });
    setToken(res.token);
    const session = { username: res.username, role: res.role, displayName: res.displayName };
    saveSession(session);
    S.user = res.username; S.role = res.role; S.displayName = res.displayName;
    await enterApp();
  } catch (err) {
    $('#login-error').textContent = friendlyError(err.code);
  } finally {
    showSpinner(false);
  }
}

async function handleSetup(e) {
  e.preventDefault();
  const yp = $('#setup-yakov').value, ap = $('#setup-aharon').value;
  if (yp.length < 4 || ap.length < 4) { $('#setup-error').textContent = 'כל סיסמה צריכה להיות לפחות 4 תווים'; return; }
  showSpinner(true);
  try {
    await api('setup', { yakovPassword: yp, aharonPassword: ap }, { noQueue: true });
    toast('המערכת הוקמה ✓ אפשר להתחבר', 'success');
    showScreen('login-screen');
  } catch (err) {
    $('#setup-error').textContent = friendlyError(err.code);
  } finally {
    showSpinner(false);
  }
}

async function handleLogout() {
  const ok = await confirmModal({ title: 'יציאה', message: 'לצאת מהמערכת?', btnLabel: 'יציאה', danger: false });
  if (!ok) return;
  try { await api('logout', {}, { noQueue: true }); } catch (e) {}
  setToken(''); saveSession(null);
  S.loaded = false;
  showLoginScreen();
}

async function enterApp() {
  showScreen('app');
  renderHeaderUser();
  showSpinner(true);
  try {
    await flushQueue();
    await loadAll();
    S.view = 'today';
    renderCurrentView();
    startSyncLoop();
  } catch (e) {
    toast('לא הצלחנו לטעון את הנתונים — בדקו את החיבור ונסו שוב', 'error');
  } finally {
    showSpinner(false);
  }
}

/* ================= אתחול ================= */

async function boot() {
  $('#version-label').textContent = APP_VERSION + (IS_DEMO ? ' · מצב הדגמה' : '');
  // אכלוס אייקוני הניווט (SVG בקו אחיד)
  $$('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
  applyBigText();
  wirePanelChrome();
  updateOfflineChip();

  // חיווט קבוע
  $('#login-form').addEventListener('submit', handleLogin);
  $('#setup-form').addEventListener('submit', handleSetup);
  $('#logout-btn').addEventListener('click', handleLogout);
  $('#changes-btn').addEventListener('click', openChangesPanel);
  $('#changes-more').addEventListener('click', loadMoreChanges);
  $$('.sidebar-nav-item, .bottom-nav-item').forEach(b => {
    b.addEventListener('click', () => setView(b.dataset.view));
  });
  $('.sidebar-brand').addEventListener('click', () => setView('today'));

  // במצב הדגמה — רמז לסיסמאות
  if (IS_DEMO) {
    $('#login-error').innerHTML = '<span style="color:var(--text-sec);font-weight:400">מצב הדגמה: משתמש <b>yakov</b> או <b>aharon</b>, סיסמה <b>1234</b></span>';
  }

  // Service Worker (PWA)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // שחזור התחברות קודמת
  const session = getSavedSession();
  if (session && getToken()) {
    S.user = session.username; S.role = session.role; S.displayName = session.displayName;
    await enterApp();
    return;
  }

  // בדיקה אם המערכת דורשת הקמה ראשונית
  try {
    const res = await api('ping', {}, { noQueue: true });
    if (res.needsSetup) { showScreen('setup-screen'); return; }
  } catch (e) { /* אין רשת — נשאיר את מסך הכניסה */ }
  showScreen('login-screen');
}

document.addEventListener('DOMContentLoaded', boot);
