/* ================================================================
   אולפן הדמיה — שיאים | מחולל בריף ופרומפט להדמיות אריזה
   ----------------------------------------------------------------
   בתוך כל נכס עיצוב: טופס נתוני מוצר → סידור בריף מדויק →
   טיוטת פרומפט אוטומטית + עריכה + היסטוריית גרסאות, קבצי רפרנס,
   ו-Master Prompt קבוע (הפרומפט-מומחה) שניתן לעריכה ושיפור.
   הכל נשמר בשדות של נכס העיצוב (updateDesignField) — אפס שינויי שרת.
   ================================================================ */

/* ---- Master Prompt קבוע (ניתן לעריכה, נשמר במכשיר) ---- */

const MASTER_PROMPT_KEY = 'shiaim.masterPrompt';

const DEFAULT_MASTER_PROMPT =
`# Role & Objective
You are an expert Packaging Designer, Brand Strategist, and Localization Specialist inside a leading Israeli design agency. Your goal is to guide and assist the design team through the end-to-end process of taking an international product and adapting its packaging for the Israeli market.

# The Project Context & Workflow
We receive an international product that does not yet exist in Israel. We need to completely rethink and redesign its packaging so it feels native, compliant, and highly appealing to the Israeli consumer.

Our exact agency workflow:
1. Product Selection: Client picks an international product.
2. Dieline Sourcing: We get the official structural packaging dieline (dimensions & layout) from the manufacturing factory.
3. Localization & Design Strategy: We redesign the package (Front, Back, Sides) by adapting the product name, visual language, and cultural nuances for Israel.
4. Compliance & Assets: We integrate mandatory elements (Client Logo, Barcode, Importer Details, SKU, Warnings, and Regulatory Icons).
5. Structural Adjustments (Optional): If needed, we alter the box dimensions and request updated dielines from the factory.
6. Pre-Press Vectorization: The finalized design is handed to a production graphic designer to create factory-ready vector files for print.

# Instructions for Your Output
When I give you the specific details of our current product, analyze the request and provide a comprehensive Packaging Localization Guide covering:

### 1. Cultural Adaptation & Copywriting
- Naming Suggestions: 3-5 creative, catchy Hebrew names that capture the original brand essence but sound natural to Israelis.
- Tone of Voice: how the product should speak to the Israeli consumer (premium, casual, family-oriented, tech-focused...).
- Visual Language Recommendations: color palettes, typography styles, and imagery/illustrations that fit the local market vibes for this category.

### 2. Packaging Layout Mapping
- Front Panel (חזית): main messaging, hero elements, branding.
- Back Panel (גב): storytelling, instructions, main legal texts.
- Side Panels (צדדים): technical details, nutritional/safety info, barcodes.

### 3. Compliance & Technical Checklist
- Client Logo placement.
- Local Importer details (פרטי יבואן) and SKU (מק"ט).
- Israeli regulatory warnings, text adjustments, and matching visual icons.
- Barcode allocation.

### 4. Structural Verification Check
Remind the team to review whether the physical size needs adjustments, and provide a standard note we can send back to the factory if we need a modified dielines file due to sizing changes.

Also provide, at the end, a ready-to-use AI image-generation prompt (English) for rendering the packaging mockup based on this guide.`;

function getMasterPrompt() {
  try { return localStorage.getItem(MASTER_PROMPT_KEY) || DEFAULT_MASTER_PROMPT; }
  catch (e) { return DEFAULT_MASTER_PROMPT; }
}
function setMasterPrompt(text) { try { localStorage.setItem(MASTER_PROMPT_KEY, text); } catch (e) {} }
function resetMasterPrompt() { try { localStorage.removeItem(MASTER_PROMPT_KEY); } catch (e) {} }
function isMasterCustomized() { try { return !!localStorage.getItem(MASTER_PROMPT_KEY); } catch (e) { return false; } }

/* ---- שדות נתוני המוצר (טקסט חופשי) ---- */

const PRODUCT_DATA_FIELDS = [
  { key: 'origin', label: 'ארץ מקור', type: 'text' },
  { key: 'category', label: 'קטגוריה', type: 'text' },
  { key: 'audience', label: 'קהל יעד', type: 'textarea' },
  { key: 'clientRequests', label: 'בקשות לקוח', type: 'textarea' },
  { key: 'packType', label: 'סוג אריזה', type: 'text' },
  { key: 'panels', label: 'פאנלים לעיצוב', type: 'text' },
  { key: 'dieline', label: 'מידות / Dieline', type: 'textarea' },
  { key: 'visualLang', label: 'שפה ויזואלית רצויה', type: 'textarea' },
  { key: 'mustHave', label: 'נכסי חובה / תאימות', type: 'textarea' },
  { key: 'notes', label: 'הערות נוספות', type: 'textarea' }
];

/* ---- צ'קליסט קבצי רפרנס ---- */

const REF_ITEMS = [
  { key: 'logo', label: 'לוגו לקוח (וקטורי)' },
  { key: 'productPhoto', label: 'תמונת מוצר מהספק' },
  { key: 'existingPack', label: 'אריזת מקור קיימת' },
  { key: 'dieline', label: 'קובץ פריסה / Dieline' },
  { key: 'barcode', label: 'ברקוד / מק"ט' },
  { key: 'brand', label: 'מיתוג / גרפיקה קיימת' }
];

/* ---- העתקה ללוח ---- */

function copyToClipboard(text, okMsg) {
  const done = () => toast(okMsg || 'הועתק ✓', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => studioFallbackCopy(text, done));
  } else {
    studioFallbackCopy(text, done);
  }
}
function studioFallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); done(); }
  catch (e) { toast('לא הצלחתי להעתיק — סמן והעתק ידנית', 'error'); }
  ta.remove();
}

/* ---- בניית בריף מסודר ---- */

function buildBrief(p, d) {
  const pd = d.productData || {};
  const L = (label, val) => val ? '- ' + label + ': ' + val + '\n' : '';
  const refsOn = REF_ITEMS.filter(it => (d.refs || {})[it.key]).map(it => it.label).join(', ');
  const refsMissing = REF_ITEMS.filter(it => !(d.refs || {})[it.key]).map(it => it.label).join(', ');
  return (
    '# בריף מוצר לעיצוב אריזה\n\n' +
    '## מוצר\n' +
    L('שם המוצר (פרויקט)', p.name) +
    L('נכס עיצוב', d.name + (d.assetType ? ' (' + d.assetType + ')' : '')) +
    L('ארץ מקור', pd.origin) +
    L('קטגוריה', pd.category) +
    L('קהל יעד', pd.audience) +
    L('בקשות לקוח', pd.clientRequests) +
    '\n## אריזה ומבנה\n' +
    L('סוג אריזה', pd.packType) +
    L('פאנלים לעיצוב', pd.panels || 'חזית, גב, צדדים') +
    L('מידות / Dieline', pd.dieline) +
    '\n## שפה ויזואלית\n' +
    L('סגנון / צבעים רצויים', pd.visualLang) +
    '\n## תאימות ונכסי חובה\n' +
    L('דרישות', pd.mustHave || 'לוגו לקוח, פרטי יבואן, מק"ט, ברקוד, אזהרות ואייקוני רגולציה ישראליים') +
    '\n## קבצי רפרנס\n' +
    (refsOn ? '- מצורפים: ' + refsOn + '\n' : '') +
    (refsMissing ? '- עדיין חסרים: ' + refsMissing + '\n' : '') +
    (pd.notes ? '\n## הערות\n- ' + pd.notes + '\n' : '')
  );
}

/* ---- טיוטת פרומפט אוטומטית להדמיה ---- */

function buildDraftPrompt(p, d) {
  const pd = d.productData || {};
  const parts = [];
  parts.push('Photorealistic packaging mockup for the Israeli retail market, shelf-ready.');
  parts.push('Product: ' + (p.name || '') + (pd.category ? ' — ' + pd.category : '') + (pd.origin ? ' (originally from ' + pd.origin + ')' : '') + '.');
  if (pd.audience) parts.push('Target audience: ' + pd.audience + '.');
  parts.push('Show panels: ' + (pd.panels || 'front, back, sides') + '. Packaging type: ' + (pd.packType || 'printed color box') + '.');
  if (pd.dieline) parts.push('Follow the structural dieline / dimensions: ' + pd.dieline + '.');
  if (pd.visualLang) parts.push('Visual language: ' + pd.visualLang + '.');
  parts.push('All on-pack text in Hebrew (right-to-left). Must include: Hebrew product name, importer details (פרטי יבואן), SKU (מק"ט), barcode, Israeli regulatory warnings and matching icons, and the client logo.');
  if (pd.clientRequests) parts.push('Client requests: ' + pd.clientRequests + '.');
  parts.push('Use the attached reference files (logo vector, product photo, existing packaging, dieline) as ground truth for shapes, colors and proportions — do not invent the logo.');
  parts.push('Style: clean, premium, native Israeli retail feel, studio lighting, high detail, neutral background, front hero angle.');
  return parts.join(' ');
}

/* ---- HTML של האולפן ---- */

function renderStudioHtml(p, d) {
  const pd = d.productData || {};
  const dataRows = PRODUCT_DATA_FIELDS.map(f =>
    fieldRowHtml({ label: f.label, field: 'pd.' + f.key, value: pd[f.key], type: f.type })
  ).join('');
  const versions = d.promptVersions || [];

  return (
    '<details class="spec-details studio-details" open>' +
      '<summary>🎬 אולפן הדמיה</summary>' +
      '<div class="spec-block">' +

        '<div class="studio-sub">נתוני מוצר</div>' +
        dataRows +

        '<div class="studio-sub" style="margin-top:.8rem">📎 קבצי רפרנס נדרשים</div>' +
        '<div class="ref-chips">' +
          REF_ITEMS.map(it => {
            const on = (d.refs || {})[it.key];
            return '<button type="button" class="ref-chip' + (on ? ' on' : '') + '" data-ref="' + it.key + '">' +
              (on ? '✓ ' : '') + esc(it.label) + '</button>';
          }).join('') +
        '</div>' +
        '<p class="form-hint">סמן מה כבר יש. את הקבצים עצמם מעלים למטה ב"קבצי העיצוב".</p>' +

        '<div class="studio-btns">' +
          '<button type="button" class="btn-secondary" id="studio-brief">📋 סדר בריף</button>' +
          '<button type="button" class="btn-secondary" id="studio-draft">✨ צור טיוטת פרומפט</button>' +
          '<button type="button" class="btn-secondary" id="studio-copy-master">📤 העתק Master + נתונים</button>' +
          '<button type="button" class="btn-secondary" id="studio-edit-master">⚙️ Master Prompt</button>' +
        '</div>' +

        '<div class="studio-sub" style="margin-top:.9rem">פרומפט הדמיה נוכחי</div>' +
        '<textarea id="studio-prompt" class="form-input studio-prompt" rows="8" placeholder="כאן נמצא הפרומפט. אפשר ליצור טיוטה אוטומטית, לערוך, או להדביק גרסה משופרת.">' + esc(d.aiPrompt || '') + '</textarea>' +
        '<div class="studio-btns">' +
          '<button type="button" class="btn-gold" id="studio-save-version">💾 שמור גרסה</button>' +
          '<button type="button" class="btn-secondary" id="studio-copy-prompt">📋 העתק פרומפט</button>' +
        '</div>' +

        (versions.length
          ? '<div class="studio-sub" style="margin-top:.9rem">היסטוריית גרסאות (' + versions.length + ')</div>' +
            '<div class="studio-versions">' +
              versions.map((v, i) =>
                '<div class="studio-ver" data-ver="' + esc(v.id) + '">' +
                  '<div class="studio-ver-head"><span>גרסה ' + (versions.length - i) + ' · ' + esc(fmtDateBoth(v.date)) + ' · ' + esc(userDisplay(v.user)) + '</span>' +
                    '<span class="studio-ver-actions">' +
                      '<button type="button" class="studio-ver-btn" data-act="view" data-ver="' + esc(v.id) + '">הצג</button>' +
                      '<button type="button" class="studio-ver-btn" data-act="restore" data-ver="' + esc(v.id) + '">שחזר</button>' +
                    '</span></div>' +
                  '<div class="studio-ver-preview">' + esc((v.text || '').slice(0, 120)) + ((v.text || '').length > 120 ? '…' : '') + '</div>' +
                '</div>'
              ).join('') +
            '</div>'
          : '') +

      '</div>' +
    '</details>'
  );
}

/* ---- חיווט האולפן ---- */

function wireStudio(body, p, d) {
  // צ'יפים של קבצי רפרנס
  body.querySelectorAll('.ref-chip').forEach(chip => {
    chip.onclick = async () => {
      const key = chip.dataset.ref;
      const refs = Object.assign({}, d.refs || {});
      refs[key] = !refs[key];
      d.refs = refs;
      try {
        const r = await api('updateDesignField', { projectId: p.id, designId: d.id, field: 'refs', value: refs });
        if (r.obj) mergeEntity('project', r.obj);
      } catch (e) { toast(friendlyError(e.code), 'error'); }
      renderDesignPanel();
    };
  });

  const briefBtn = body.querySelector('#studio-brief');
  if (briefBtn) briefBtn.onclick = () => showTextModal('בריף מסודר', buildBrief(p, d), 'העתק בריף');

  const draftBtn = body.querySelector('#studio-draft');
  if (draftBtn) draftBtn.onclick = () => {
    const ta = body.querySelector('#studio-prompt');
    ta.value = buildDraftPrompt(p, d);
    toast('נוצרה טיוטה — ערוך במידת הצורך ולחץ "שמור גרסה"', 'success');
  };

  const copyMaster = body.querySelector('#studio-copy-master');
  if (copyMaster) copyMaster.onclick = () =>
    copyToClipboard(getMasterPrompt() + '\n\n---\n\n' + buildBrief(p, d), 'Master + נתונים הועתקו ✓ — הדבק ל-Claude');

  const editMaster = body.querySelector('#studio-edit-master');
  if (editMaster) editMaster.onclick = () => openMasterPromptEditor();

  const saveVer = body.querySelector('#studio-save-version');
  if (saveVer) saveVer.onclick = () => saveStudioVersion(p, d);

  const copyPrompt = body.querySelector('#studio-copy-prompt');
  if (copyPrompt) copyPrompt.onclick = () => {
    const ta = body.querySelector('#studio-prompt');
    copyToClipboard(ta.value, 'הפרומפט הועתק ✓');
  };

  // גרסאות: הצג / שחזר
  body.querySelectorAll('.studio-ver-btn').forEach(btn => {
    btn.onclick = () => {
      const v = (d.promptVersions || []).find(x => x.id === btn.dataset.ver);
      if (!v) return;
      if (btn.dataset.act === 'view') {
        showTextModal('גרסת פרומפט', v.text || '', 'העתק');
      } else {
        const ta = body.querySelector('#studio-prompt');
        ta.value = v.text || '';
        toast('הגרסה נטענה לעורך — לחץ "שמור גרסה" כדי לקבע', 'success');
      }
    };
  });
}

/* ---- שמירת גרסת פרומפט ---- */

async function saveStudioVersion(p, d) {
  const ta = document.getElementById('studio-prompt');
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) { toast('אין פרומפט לשמור', 'error'); return; }
  d.aiPrompt = text;
  d.promptVersions = d.promptVersions || [];
  d.promptVersions.unshift({ id: uid(), text, date: new Date().toISOString(), user: S.user });
  if (d.promptVersions.length > 20) d.promptVersions = d.promptVersions.slice(0, 20);
  try {
    await api('updateDesignField', { projectId: p.id, designId: d.id, field: 'aiPrompt', value: text });
    const r = await api('updateDesignField', { projectId: p.id, designId: d.id, field: 'promptVersions', value: d.promptVersions });
    if (r.obj) mergeEntity('project', r.obj);
    toast('הגרסה נשמרה ✓', 'success');
    renderDesignPanel();
  } catch (e) { toast(friendlyError(e.code), 'error'); }
}

/* ---- שמירת שדה נתוני מוצר (מקונן) ---- */

async function saveDesignNested(p, d, objName, field, value) {
  const obj = Object.assign({}, d[objName] || {});
  obj[field] = value;
  d[objName] = obj;
  try {
    const r = await api('updateDesignField', { projectId: p.id, designId: d.id, field: objName, value: obj });
    if (r.obj) mergeEntity('project', r.obj);
    toast(r.queued ? 'נשמר במכשיר ⏳' : 'נשמר ✓', r.queued ? '' : 'success');
    renderDesignPanel();
  } catch (e) { toast(friendlyError(e.code), 'error'); }
}

/* ---- מודל טקסט לקריאה+העתקה ---- */

function showTextModal(title, text, copyLabel) {
  openModal({
    title,
    maxWidth: '640px',
    bodyHtml: '<textarea class="form-input" id="txt-modal-area" rows="16" readonly>' + esc(text) + '</textarea>',
    footerHtml: '<button class="btn-gold" id="txt-modal-copy">' + esc(copyLabel || 'העתק') + '</button><button class="btn-secondary btn-modal-close">סגור</button>',
    onOpen(back, close) {
      back.querySelector('#txt-modal-copy').onclick = () => { copyToClipboard(text); };
      const ta = back.querySelector('#txt-modal-area');
      if (ta) { ta.focus(); ta.select(); }
    }
  });
}

/* ---- עורך ה-Master Prompt ---- */

function openMasterPromptEditor() {
  openModal({
    title: 'Master Prompt — הפרומפט-מומחה',
    maxWidth: '680px',
    bodyHtml:
      '<p class="form-hint">זהו ה"מוח" הקבוע להדמיות. נשמר במכשיר זה. לכל מוצר מוסיפים רק את נתוני המוצר.</p>' +
      '<textarea class="form-input" id="master-area" rows="18">' + esc(getMasterPrompt()) + '</textarea>' +
      (isMasterCustomized() ? '<p class="form-hint">✓ נשמרה גרסה מותאמת אישית.</p>' : '<p class="form-hint">משתמש בברירת המחדל.</p>'),
    footerHtml:
      '<button class="btn-gold" id="master-save">שמור</button>' +
      '<button class="btn-secondary" id="master-reset">שחזר ברירת מחדל</button>' +
      '<button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      back.querySelector('#master-save').onclick = () => {
        const t = back.querySelector('#master-area').value.trim();
        if (!t) { toast('הפרומפט ריק', 'error'); return; }
        setMasterPrompt(t);
        toast('ה-Master Prompt נשמר ✓', 'success');
        close();
      };
      back.querySelector('#master-reset').onclick = () => {
        resetMasterPrompt();
        back.querySelector('#master-area').value = DEFAULT_MASTER_PROMPT;
        toast('שוחזרה ברירת המחדל ✓', 'success');
      };
    }
  });
}
