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
