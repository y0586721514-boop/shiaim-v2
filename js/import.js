/* ================================================================
   ייבוא חכם — שיאים 2.0
   ----------------------------------------------------------------
   זורקים קובץ אקסל מהספק (פקינג ליסט / חשבונית / PI) והמערכת:
   1. מזהה לבד איזה סוג מסמך זה
   2. שולפת: כמויות, מחיר ליחידה, קרטונים, משקל, נפח (CBM),
      קודי HS, הצהרת סוללה, תנאי סחר, פרטי ספק
   3. מציגה הכל לאישור (אפשר לתקן ידנית)
   4. מעדכנת את מחשבון הייבוא של הפרויקט, מעלה את הקובץ
      ל-Drive לקטגוריה הנכונה, ורושמת סיכום בהערות

   דרישות: ספריית SheetJS (נטענת ב-index.html), והקבצים הקיימים
   של המערכת (util.js, api.js, calculator.js, documents.js).
   ================================================================ */

/* ================= קריאת הקובץ לגיליון ================= */

function importReadWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(XLSX.read(new Uint8Array(reader.result), { type: 'array' })); }
      catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/** כל הגיליון כמערך שורות של טקסט (תא ריק = '') */
function importSheetRows(wb) {
  let best = null;
  wb.SheetNames.forEach(name => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    const filled = rows.reduce((s, r) => s + r.filter(c => String(c).trim()).length, 0);
    if (!best || filled > best.filled) best = { rows, filled };
  });
  return (best ? best.rows : []).map(r => r.map(c => String(c ?? '').trim()));
}

function importNum(v) {
  const n = parseFloat(String(v).replace(/[,$₪\s]/g, ''));
  return isNaN(n) ? 0 : n;
}
function importRound(n, d) { const f = Math.pow(10, d); return Math.round(n * f) / f; }

/* ================= זיהוי סוג המסמך ================= */

function importDetectType(rows, filename) {
  const all = (rows.map(r => r.join(' ')).join(' ') + ' ' + (filename || '')).toLowerCase();
  if (all.includes('packing list') || all.includes('装箱单')) return 'packing';
  if (all.includes('proforma') || /\bpi\b/.test(all) && all.includes('invoice')) return 'pi';
  if (all.includes('invoice') || all.includes('发票')) return 'invoice';
  if (/hs\s*code/.test(all) && /carton|cbm/.test(all)) return 'packing';
  return 'unknown';
}

/* ================= עזרי חילוץ ================= */

/** מוצא בשורות תא שתואם לתווית, ומחזיר את התא הבא שאינו ריק באותה שורה */
function importFindVal(rows, labelRe) {
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      if (labelRe.test(row[i])) {
        for (let j = i + 1; j < row.length; j++) {
          if (row[j]) return row[j];
        }
      }
    }
  }
  return '';
}

/** חיפוש תבנית בטקסט המלא של הקובץ */
function importFindText(rows, re) {
  const m = rows.map(r => r.join(' | ')).join('\n').match(re);
  return m ? (m[1] !== undefined ? m[1] : m[0]).trim() : '';
}

/** מיפוי עמודות לפי שורת כותרת */
function importMapCols(headerRow, map) {
  const cols = {};
  headerRow.forEach((cell, i) => {
    for (const key in map) {
      if (cols[key] === undefined && map[key].test(cell)) cols[key] = i;
    }
  });
  return cols;
}

/* ================= פרסר פקינג ליסט ================= */

function importParsePacking(rows) {
  const out = { type: 'packing', items: [], hsCodes: [], hasBattery: false };

  // שורת הכותרת של טבלת הפריטים
  const hIdx = rows.findIndex(r =>
    r.some(c => /hs\s*code|商品编码/i.test(c)) ||
    (r.some(c => /total\s*pcs|总数量/i.test(c)) && r.some(c => /carton/i.test(c))) ||
    (r.some(c => /goods\s*name/i.test(c)) && r.some(c => /cbm/i.test(c))));
  if (hIdx === -1) return out;

  const cols = importMapCols(rows[hIdx], {
    model:    /item|产品|goods\s*name/i,
    desc:     /desc|规格|specification|goods\s*name/i,
    material: /material|材质/i,
    hs:       /hs\s*code|商品编码/i,
    battery:  /battery|带电/i,
    totalPcs: /total\s*pcs|总数量|^qty|数量$/i,
    pcsCtn:   /pcs\s*\/?\s*ctn/i,
    cartons:  /cartons|件数|pkgs/i,
    totalGW:  /total\s*[\s\S]{0,4}g\.?\s*w|总毛重/i,
    totalNW:  /total\s*[\s\S]{0,4}n\.?\s*w|总净重/i,
    size:     /carton\s*size|外箱尺寸|packing\s*size/i,
    cbmTotal: /total\s*cbm|总立方/i,
    cbmUnit:  /^cbm$|立方/i
  });
  // "total CBM" עדיף על עמודת CBM ליחידה
  cols.cbm = cols.cbmTotal !== undefined ? cols.cbmTotal : cols.cbmUnit;

  // שורות הפריטים — עד שורת ה-Total
  let totalsRow = null;
  for (let i = hIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const joined = row.join(' ');
    if (!joined.trim()) continue;
    if (/^total|总计|totals/i.test(row.find(c => c) || '')) { totalsRow = row; break; }
    // שורה שכולה מספרים (בלי שום טקסט) = שורת סיכום בלי כותרת "Total"
    const nonEmpty = row.filter(c => c);
    if (nonEmpty.length && nonEmpty.every(c => importNum(c) !== 0 || /^[\d.,\s]+$/.test(c))) { totalsRow = row; break; }

    const pcs = cols.totalPcs !== undefined ? importNum(row[cols.totalPcs]) : 0;
    const cbm = cols.cbm !== undefined ? importNum(row[cols.cbm]) : 0;
    if (!pcs && !cbm) continue; // שורת המשך (צבע נוסף וכו') בלי נתונים — מדלגים

    const item = {
      model:    cols.model    !== undefined ? row[cols.model]    : '',
      desc:     cols.desc     !== undefined ? row[cols.desc]     : '',
      material: cols.material !== undefined ? row[cols.material] : '',
      hs:       cols.hs       !== undefined ? row[cols.hs]       : '',
      battery:  cols.battery  !== undefined ? /yes|是/i.test(row[cols.battery]) : false,
      pcs,
      cartons:  cols.cartons  !== undefined ? importNum(row[cols.cartons]) : 0,
      gw:       cols.totalGW  !== undefined ? importNum(row[cols.totalGW]) : 0,
      nw:       cols.totalNW  !== undefined ? importNum(row[cols.totalNW]) : 0,
      cbm
    };
    out.items.push(item);
    if (item.hs && out.hsCodes.indexOf(item.hs) === -1) out.hsCodes.push(item.hs);
    if (item.battery) out.hasBattery = true;
  }

  // סיכומים — משורת Total, ואם אין: סכימת הפריטים
  const sum = (k) => out.items.reduce((s, it) => s + (it[k] || 0), 0);
  if (totalsRow) {
    out.totalPcs     = cols.totalPcs !== undefined ? importNum(totalsRow[cols.totalPcs]) : 0;
    out.totalCartons = cols.cartons  !== undefined ? importNum(totalsRow[cols.cartons])  : 0;
    out.totalGW      = cols.totalGW  !== undefined ? importNum(totalsRow[cols.totalGW])  : 0;
    out.totalNW      = cols.totalNW  !== undefined ? importNum(totalsRow[cols.totalNW])  : 0;
    out.totalCBM     = cols.cbm      !== undefined ? importNum(totalsRow[cols.cbm])      : 0;
  }
  if (!out.totalPcs)     out.totalPcs     = sum('pcs');
  if (!out.totalCartons) out.totalCartons = sum('cartons');
  if (!out.totalGW)      out.totalGW      = sum('gw');
  if (!out.totalNW)      out.totalNW      = sum('nw');
  if (!out.totalCBM)     out.totalCBM     = sum('cbm');

  out.supplier = importFindVal(rows, /发货人\s*supplier|supplier|sellers?\s*[::]?/i);
  out.docNo    = importFindText(rows, /invoice no\.?\s*[::]?\s*([A-Za-z0-9.\-\/]+)/i);
  return out;
}

/* ================= פרסר חשבונית / PI ================= */

function importParseInvoice(rows, type) {
  const out = { type, items: [], hsCodes: [] };

  const hIdx = rows.findIndex(r =>
    r.some(c => /unit\s*price|EXW\s*price|FOB.*price/i.test(c)) &&
    r.some(c => /q'?ty|quantity/i.test(c)));

  if (hIdx !== -1) {
    const cols = importMapCols(rows[hIdx], {
      model:  /model|item/i,
      desc:   /desc|specification|name/i,
      qty:    /q'?ty|quantity/i,
      price:  /unit\s*price|EXW\s*price|price/i,
      amount: /total\s*(price|amount)|amount/i
    });
    for (let i = hIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const first = row.find(c => c) || '';
      const nonEmpty = row.filter(c => c);
      const allNumeric = nonEmpty.length && nonEmpty.every(c => /^[\d.,\s]+$/.test(c));
      if (/^total|总计/i.test(first) || allNumeric) {
        // שורת סיכום (עם או בלי כותרת Total) — הסכום הוא המספר הגדול בה
        const nums = row.map(importNum).filter(n => n > 0);
        if (nums.length) out.totalAmount = Math.max.apply(null, nums);
        break;
      }
      const qty = cols.qty !== undefined ? importNum(row[cols.qty]) : 0;
      const price = cols.price !== undefined ? importNum(row[cols.price]) : 0;
      if (!qty && !price) continue;
      out.items.push({
        model:  cols.model  !== undefined ? row[cols.model]  : '',
        desc:   cols.desc   !== undefined ? row[cols.desc]   : '',
        qty, price,
        amount: cols.amount !== undefined ? importNum(row[cols.amount]) : qty * price
      });
    }
  }

  const sumQty = out.items.reduce((s, it) => s + it.qty, 0);
  const sumAmt = out.items.reduce((s, it) => s + it.amount, 0);
  out.totalPcs = sumQty;
  if (!out.totalAmount) out.totalAmount = sumAmt;
  // מחיר משוקלל ליחידה
  out.unitPrice = sumQty ? importRound(out.totalAmount / sumQty, 4) : (out.items[0] ? out.items[0].price : 0);

  out.tradeTerm = importFindText(rows, /\b((?:EXW|FOB|CIF|DDP)[^|\n]{0,25})/i);
  out.docNo     = importFindText(rows, /(?:invoice|pi)\s*no\.?\s*[::]?\s*([A-Za-z0-9.\-\/]+)/i);
  out.date      = importFindText(rows, /date\s*[::]?\s*([0-9A-Za-z ,.\/\-]+)/i);
  out.payment   = importFindText(rows, /([0-9]{1,2}\s*%\s*deposit[^|\n]{0,80})/i) ||
                  importFindText(rows, /(deposit[^|\n]{0,80})/i);
  out.supplier  = (rows.find(r => r.some(c => c && c.length > 4)) || []).find(c => c) || '';
  const hsAll = rows.map(r => r.join(' ')).join(' ').match(/HS\s*CODE\s*[::]?\s*([0-9]{6,10})/gi);
  if (hsAll) out.hsCodes = hsAll.map(s => s.replace(/[^0-9]/g, ''));
  return out;
}

/* ================= החילוץ המרכזי ================= */

async function importExtractFromFile(file) {
  const wb = await importReadWorkbook(file);
  const rows = importSheetRows(wb);
  const type = importDetectType(rows, file.name);
  if (type === 'packing') return importParsePacking(rows);
  if (type === 'invoice' || type === 'pi') return importParseInvoice(rows, type);
  // לא זוהה — ננסה את שניהם ונחזיר את מה שמצא יותר
  const asPacking = importParsePacking(rows);
  const asInvoice = importParseInvoice(rows, 'invoice');
  return asPacking.items.length >= asInvoice.items.length ? asPacking : asInvoice;
}

/* ================= מסך האישור ================= */

const IMPORT_TYPE_LABELS = { packing: '📦 פקינג ליסט', invoice: '🧾 חשבונית', pi: '🧾 חשבון עסקה (PI)', unknown: '❓ לא זוהה' };

/** לאיזו קטגוריית מסמכים יעלה הקובץ ב-Drive */
function importDocTarget(type) {
  if (type === 'packing') return { section: 'customs', label: 'פקינג ליסט' };
  if (type === 'pi')      return { section: 'order',   label: 'פרטי ההזמנה' };
  return { section: 'order', label: 'חשבונית תשלום' };
}

function importField(id, label, value, suffix) {
  return '<div class="calc-field"><label class="calc-label">' + esc(label) + '</label>' +
    '<div class="calc-input-wrap">' +
    '<input type="text" class="calc-input" id="' + id + '" value="' + esc(value ?? '') + '">' +
    (suffix ? '<span class="calc-affix">' + esc(suffix) + '</span>' : '') +
    '</div></div>';
}

function openImportPreviewModal(p, file, ex) {
  const qty = ex.totalPcs || 0;
  const unitPrice = ex.unitPrice || 0;
  const itemsHtml = (ex.items || []).slice(0, 12).map(it =>
    '<div class="calc-line"><span>' + esc((it.model || it.desc || '').slice(0, 40)) + '</span><span>' +
    (it.qty || it.pcs ? (it.qty || it.pcs) + ' יח׳' : '') +
    (it.price ? ' · $' + it.price : '') +
    (it.cbm ? ' · ' + it.cbm + ' מ״ק' : '') +
    (it.hs ? ' · HS ' + esc(it.hs) : '') +
    '</span></div>').join('');

  const target = importDocTarget(ex.type);

  openModal({
    title: '🪄 ייבוא חכם — ' + (IMPORT_TYPE_LABELS[ex.type] || ex.type),
    maxWidth: '560px',
    bodyHtml:
      '<div class="form-hint" style="margin-bottom:.6rem">קובץ: ' + esc(file.name) + (ex.docNo ? ' · מסמך ' + esc(ex.docNo) : '') + (ex.supplier ? ' · ספק: ' + esc(String(ex.supplier).slice(0, 50)) : '') + '</div>' +
      (itemsHtml ? '<div class="calc-result" style="margin-bottom:.8rem"><div class="calc-result-title">פריטים שזוהו (' + ex.items.length + ')</div>' + itemsHtml + '</div>' : '') +

      '<div class="calc-group-title">נתונים לעדכון — אפשר לתקן לפני שמירה</div>' +
      importField('imp-qty', 'סה״כ יחידות', qty, 'יח׳') +
      (ex.type !== 'packing' ? importField('imp-price', 'מחיר ליחידה (משוקלל)', unitPrice, '$') : '') +
      (ex.totalCBM ? importField('imp-cbm', 'נפח כולל', ex.totalCBM, 'מ״ק') : '') +
      (ex.totalGW ? importField('imp-gw', 'משקל ברוטו כולל', ex.totalGW, 'ק״ג') : '') +
      (ex.totalCartons ? importField('imp-cartons', 'קרטונים', ex.totalCartons, '') : '') +
      (ex.tradeTerm ? importField('imp-trade', 'תנאי סחר', ex.tradeTerm, '') : '') +
      (ex.totalAmount ? importField('imp-amount', 'סה״כ לתשלום', ex.totalAmount, '$') : '') +
      (ex.hsCodes && ex.hsCodes.length ? '<div class="form-hint">HS Codes: ' + ex.hsCodes.map(esc).join(', ') + '</div>' : '') +
      (ex.hasBattery ? '<div class="form-hint">🔋 המשלוח מכיל מוצרים עם סוללה</div>' : '') +
      (ex.payment ? '<div class="form-hint">תנאי תשלום: ' + esc(ex.payment) + '</div>' : '') +

      '<div class="calc-group-title" style="margin-top:.8rem">מה לעשות</div>' +
      '<label style="display:block;margin:.3rem 0"><input type="checkbox" id="imp-do-calc" checked> לעדכן את מחשבון הייבוא (כמות' + (ex.type !== 'packing' ? ', מחיר' : '') + (ex.totalCBM ? ', נפח' : '') + (ex.totalGW ? ', משקל' : '') + ')</label>' +
      '<label style="display:block;margin:.3rem 0"><input type="checkbox" id="imp-do-upload" checked> להעלות את הקובץ למסמכים: ' + esc(target.label) + '</label>' +
      '<label style="display:block;margin:.3rem 0"><input type="checkbox" id="imp-do-note" checked> לרשום סיכום בהערות הפרויקט</label>',
    footerHtml: '<button class="btn-gold" id="imp-apply">✓ שמור לפרויקט</button><button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      back.querySelector('#imp-apply').onclick = async () => {
        const val = (id) => { const el = back.querySelector('#' + id); return el ? el.value : ''; };
        const doCalc = back.querySelector('#imp-do-calc').checked;
        const doUpload = back.querySelector('#imp-do-upload').checked;
        const doNote = back.querySelector('#imp-do-note').checked;
        close();
        await applyImport(p, file, ex, {
          qty: importNum(val('imp-qty')),
          unitPrice: importNum(val('imp-price')),
          totalCBM: importNum(val('imp-cbm')),
          totalGW: importNum(val('imp-gw')),
          totalCartons: importNum(val('imp-cartons')),
          tradeTerm: val('imp-trade'),
          totalAmount: importNum(val('imp-amount')),
          doCalc, doUpload, doNote
        });
      };
    }
  });
}

/* ================= החלה על הפרויקט ================= */

async function applyImport(p, file, ex, v) {
  showSpinner(true);
  try {
    // 1. מחשבון ייבוא
    if (v.doCalc) {
      const c = getCalc(p);
      if (v.qty) c.quantity = v.qty;
      if (v.unitPrice) c.productCostUSD = v.unitPrice;
      if (v.totalCBM && v.qty) { c.dimMode = 'volume'; c.unitVolumeCBM = importRound(v.totalCBM / v.qty, 6); }
      if (v.totalGW && v.qty) c.unitWeightKg = importRound(v.totalGW / v.qty, 4);
      p.importCalc = c;
      await api('updateField', { entity: 'project', id: p.id, field: 'importCalc', value: c });
    }

    // 2. העלאת הקובץ ל-Drive לקטגוריה הנכונה
    if (v.doUpload && !IS_DEMO) {
      if (!p.folderId) {
        const fr = await api('ensureFolder', { entity: 'project', id: p.id }, { noQueue: true });
        if (fr.folderId) p.folderId = fr.folderId;
      }
      if (p.folderId) {
        const target = importDocTarget(ex.type);
        const res = await api('uploadFile', { folderId: p.folderId, filename: target.label + ' — ' + file.name, base64: await fileToBase64(file), mimeType: file.type }, { noQueue: true });
        const f = res.file;
        const entry = { id: uid(), section: target.section, label: target.label, fileId: f.id, name: f.name, url: f.url, mimeType: f.mimeType, size: f.size, date: new Date().toISOString(), user: S.user };
        p.documents = (p.documents || []).concat([entry]);
        await api('updateField', { entity: 'project', id: p.id, field: 'documents', value: p.documents });
      }
    }

    // 3. סיכום בהערות
    if (v.doNote) {
      const parts = ['🪄 ייבוא חכם מ"' + file.name + '" (' + (IMPORT_TYPE_LABELS[ex.type] || '') + ')'];
      if (v.qty) parts.push(v.qty + ' יח׳');
      if (v.totalCartons) parts.push(v.totalCartons + ' קרטונים');
      if (v.totalCBM) parts.push(v.totalCBM + ' מ״ק');
      if (v.totalGW) parts.push(v.totalGW + ' ק״ג');
      if (v.unitPrice) parts.push('$' + v.unitPrice + ' ליחידה');
      if (v.totalAmount) parts.push('סה״כ $' + v.totalAmount);
      if (v.tradeTerm) parts.push(v.tradeTerm);
      if (ex.hsCodes && ex.hsCodes.length) parts.push('HS: ' + ex.hsCodes.join(', '));
      if (ex.hasBattery) parts.push('🔋 מכיל סוללות');
      if (ex.payment) parts.push('תשלום: ' + ex.payment);
      const text = parts.join(' · ');
      try {
        const res = await api('addLog', { entity: 'project', id: p.id, area: 'notes', text });
        if (res.obj) mergeEntity('project', res.obj);
        else { p.notes = (p.notes || []); p.notes.push({ date: new Date().toISOString(), user: S.user, text }); }
      } catch (e) { /* לא קריטי */ }
    }

    toast('הנתונים נשמרו לפרויקט ✓', 'success');
    renderProjectPanel();
    renderCurrentView();
  } catch (e) {
    toast(e.code === 'network' ? 'צריך חיבור לאינטרנט לייבוא' : friendlyError(e.code), 'error');
  } finally {
    showSpinner(false);
  }
}

/* ================= כפתור בטאב המסמכים ================= */

function injectSmartImportButton(body, p) {
  if (body.querySelector('#smart-import-btn')) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-bottom:1rem;text-align:center';
  wrap.innerHTML =
    '<input type="file" id="smart-import-input" accept=".xlsx,.xls,.csv" style="display:none">' +
    '<button class="btn-gold" id="smart-import-btn">🪄 ייבוא חכם מקובץ ספק</button>' +
    '<div class="form-hint" style="margin-top:.3rem">פקינג ליסט / חשבונית / PI באקסל — המערכת תשלוף את הנתונים לבד</div>';
  body.insertBefore(wrap, body.firstChild);

  const input = wrap.querySelector('#smart-import-input');
  wrap.querySelector('#smart-import-btn').onclick = () => { input.value = ''; input.click(); };
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('הקובץ גדול מדי — עד 20MB', 'error'); return; }
    if (typeof XLSX === 'undefined') { toast('ספריית האקסל לא נטענה — בדוק את index.html', 'error'); return; }
    showSpinner(true);
    try {
      const ex = await importExtractFromFile(file);
      showSpinner(false);
      if (!ex.items.length && !ex.totalPcs && !ex.totalCBM && !ex.totalAmount) {
        toast('לא זוהו נתונים בקובץ — נסה קובץ אקסל/CSV אחר של הספק', 'error');
        return;
      }
      openImportPreviewModal(p, file, ex);
    } catch (e) {
      showSpinner(false);
      toast('שגיאה בקריאת הקובץ — ודא שזה קובץ אקסל/CSV תקין', 'error');
    }
  };
}

/* ================= חיבור עצמאי לטאב המסמכים =================
   עוטף את renderProjectDocumentsTab הקיימת בלי לגעת בה: אחרי שהיא
   מציירת את קטגוריות המסמכים, מזריקים את כפתור הייבוא החכם בראש הטאב. */
(function () {
  if (typeof renderProjectDocumentsTab !== 'function') return;
  if (renderProjectDocumentsTab.__smartImportWrapped) return;
  var orig = renderProjectDocumentsTab;
  renderProjectDocumentsTab = function (body, p) {
    orig(body, p);
    try { if (typeof IS_DEMO === 'undefined' || !IS_DEMO) injectSmartImportButton(body, p); } catch (e) {}
  };
  renderProjectDocumentsTab.__smartImportWrapped = true;
})();
