/* ================================================================
   מחשבון ייבוא — מהמפעל בסין ועד מחיר ליחידה בארץ (₪)
   ----------------------------------------------------------------
   עלות מוצר + נפח/משקל × כמות → עלות הובלה → עמילות מכס + מע"מ
   → עלות כוללת ליחידה בדולר ובשקל (שער דולר ניתן לשינוי).
   הנתונים נשמרים בתוך הפרויקט (p.importCalc).
   ================================================================ */

const RATE_KEY = 'shiaim2_usd_ils';       // שער דולר-שקל אחרון בשימוש (ברירת מחדל למכשיר)
const DEFAULT_RATE = 3.7;
const DEFAULT_VAT = 18;                     // מע"מ בישראל (2025)

function defaultRate() {
  const saved = parseFloat(localStorage.getItem(RATE_KEY));
  return (saved && saved > 0) ? saved : DEFAULT_RATE;
}

const CAP20_DEFAULT = 28;   // קיבולת טעינה מעשית למכולת 20 רגל (CBM)
const CAP40_DEFAULT = 67;   // קיבולת טעינה למכולת 40 רגל (CBM)

function getCalc(p) {
  const c = Object.assign({
    productCostUSD: 0, dimMode: 'dims',
    lengthCm: 0, widthCm: 0, heightCm: 0, unitVolumeCBM: 0,
    unitWeightKg: 0, quantity: 0,
    shipMethod: 'container', containerType: '40',
    cap20: CAP20_DEFAULT, cap40: CAP40_DEFAULT,
    price20: 0, price40: 0, priceLCL: 0, shipRateKg: 0, shipTotalUSD: 0,
    customsUSD: 0, vatPercent: DEFAULT_VAT, exchangeRate: defaultRate()
  }, p.importCalc || {});
  // תאימות לאחור לגרסה הישנה (shipMode/shipRateCBM)
  if (p.importCalc && p.importCalc.shipMethod === undefined && p.importCalc.shipMode) {
    if (p.importCalc.shipMode === 'cbm') { c.shipMethod = 'lcl'; c.priceLCL = p.importCalc.shipRateCBM || 0; }
    else if (p.importCalc.shipMode === 'kg') c.shipMethod = 'kg';
    else if (p.importCalc.shipMode === 'total') c.shipMethod = 'total';
  }
  if (!c.exchangeRate) c.exchangeRate = defaultRate();
  if (!num(c.cap20)) c.cap20 = CAP20_DEFAULT;
  if (!num(c.cap40)) c.cap40 = CAP40_DEFAULT;
  return c;
}

function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

/** נפח כולל של פרויקט (מ״ק) לפי מחשבון הייבוא שלו — לסנכרון מכולות */
function projectVolume(p) {
  const ic = p && p.importCalc;
  if (!ic) return 0;
  const unitVol = ic.dimMode === 'volume'
    ? num(ic.unitVolumeCBM)
    : (num(ic.lengthCm) * num(ic.widthCm) * num(ic.heightCm)) / 1000000;
  return unitVol * num(ic.quantity);
}
function money(n, symbol) { return symbol + (Math.round(n * 100) / 100).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/** כל החישובים במקום אחד */
function computeCalc(c) {
  const qty = num(c.quantity) || 0;
  const unitVolume = c.dimMode === 'dims'
    ? (num(c.lengthCm) * num(c.widthCm) * num(c.heightCm)) / 1000000   // ס"מ³ → מ"ק
    : num(c.unitVolumeCBM);
  const unitWeight = num(c.unitWeightKg);
  const totalVolume = unitVolume * qty;
  const totalWeight = unitWeight * qty;

  const cap20 = num(c.cap20) || CAP20_DEFAULT;
  const cap40 = num(c.cap40) || CAP40_DEFAULT;

  // עלות ההובלה לפי השיטה שנבחרה
  let shipTotal = 0, containersNeeded = 0, containerCap = 0, containerFill = 0;
  if (c.shipMethod === 'container') {
    containerCap = c.containerType === '20' ? cap20 : cap40;
    const price = c.containerType === '20' ? num(c.price20) : num(c.price40);
    containersNeeded = (totalVolume > 0 && containerCap > 0) ? Math.ceil(totalVolume / containerCap) : 0;
    shipTotal = containersNeeded * price;
    containerFill = (containersNeeded > 0 && containerCap > 0) ? totalVolume / (containersNeeded * containerCap) : 0;
  } else if (c.shipMethod === 'lcl') {
    shipTotal = totalVolume * num(c.priceLCL);
  } else if (c.shipMethod === 'kg') {
    shipTotal = num(c.shipRateKg) * totalWeight;
  } else if (c.shipMethod === 'total') {
    shipTotal = num(c.shipTotalUSD);
  }

  // השוואת אפשרויות שילוח — לפי המחירים שהוזנו
  const options = [];
  if (totalVolume > 0) {
    if (num(c.price20) > 0) { const n = Math.ceil(totalVolume / cap20); options.push({ key: '20', label: "מכולה 20'", n: n, cost: n * num(c.price20), detail: n + " × 20' · ניצול " + Math.round(totalVolume / (n * cap20) * 100) + '%' }); }
    if (num(c.price40) > 0) { const n = Math.ceil(totalVolume / cap40); options.push({ key: '40', label: "מכולה 40'", n: n, cost: n * num(c.price40), detail: n + " × 40' · ניצול " + Math.round(totalVolume / (n * cap40) * 100) + '%' }); }
    if (num(c.priceLCL) > 0) { options.push({ key: 'lcl', label: 'LCL חלקי', n: 0, cost: totalVolume * num(c.priceLCL), detail: (Math.round(totalVolume * 100) / 100) + ' CBM × $' + num(c.priceLCL) }); }
  }
  let cheapest = null;
  options.forEach(o => { if (!cheapest || o.cost < cheapest.cost) cheapest = o; });

  const shipPerUnit = qty ? shipTotal / qty : 0;
  const productPerUnit = num(c.productCostUSD);
  const customsPerUnit = qty ? num(c.customsUSD) / qty : 0;

  const basePerUnitUSD = productPerUnit + shipPerUnit + customsPerUnit; // לפני מע"מ
  const vatPerUnitUSD = basePerUnitUSD * (num(c.vatPercent) / 100);
  const totalPerUnitUSD = basePerUnitUSD + vatPerUnitUSD;

  const rate = num(c.exchangeRate) || defaultRate();
  return {
    qty, unitVolume, unitWeight, totalVolume, totalWeight,
    shipTotal, shipPerUnit, productPerUnit, customsPerUnit,
    basePerUnitUSD, vatPerUnitUSD, totalPerUnitUSD,
    totalPerUnitILS: totalPerUnitUSD * rate,
    totalOrderUSD: totalPerUnitUSD * qty,
    totalOrderILS: totalPerUnitUSD * qty * rate,
    rate,
    shipMethod: c.shipMethod, containerType: c.containerType,
    containersNeeded, containerCap, containerFill, options, cheapest
  };
}

function renderProjectCalculatorTab(body, p) {
  const c = getCalc(p);

  body.innerHTML =
    '<div class="calc-wrap">' +
      '<div class="calc-group-title">📦 המוצר</div>' +
      calcField('productCostUSD', 'עלות מהמפעל ליחידה ($)', c.productCostUSD, '$') +
      '<div class="calc-dim-toggle">' +
        '<label><input type="radio" name="dimMode" value="dims"' + (c.dimMode !== 'volume' ? ' checked' : '') + '> לפי מידות (ס״מ)</label>' +
        '<label><input type="radio" name="dimMode" value="volume"' + (c.dimMode === 'volume' ? ' checked' : '') + '> נפח ישיר (מ״ק)</label>' +
      '</div>' +
      '<div id="calc-dims" class="' + (c.dimMode === 'volume' ? 'hidden' : '') + '">' +
        '<div class="calc-row3">' +
          calcField('lengthCm', 'אורך', c.lengthCm, '', 'ס״מ') +
          calcField('widthCm', 'רוחב', c.widthCm, '', 'ס״מ') +
          calcField('heightCm', 'גובה', c.heightCm, '', 'ס״מ') +
        '</div>' +
      '</div>' +
      '<div id="calc-vol" class="' + (c.dimMode === 'volume' ? '' : 'hidden') + '">' +
        calcField('unitVolumeCBM', 'נפח ליחידה (מ״ק)', c.unitVolumeCBM, '', 'מ״ק') +
      '</div>' +
      calcField('unitWeightKg', 'משקל ליחידה (ק״ג)', c.unitWeightKg, '', 'ק״ג') +
      calcField('quantity', 'מספר יחידות בהזמנה', c.quantity, '', 'יח׳') +

      '<div class="calc-group-title">הובלה</div>' +
      '<div class="calc-ship-toggle">' +
        '<label><input type="radio" name="shipMethod" value="container"' + (c.shipMethod === 'container' ? ' checked' : '') + '> מכולה מלאה</label>' +
        '<label><input type="radio" name="shipMethod" value="lcl"' + (c.shipMethod === 'lcl' ? ' checked' : '') + '> LCL (חלקי)</label>' +
        '<label><input type="radio" name="shipMethod" value="kg"' + (c.shipMethod === 'kg' ? ' checked' : '') + '> לפי משקל</label>' +
        '<label><input type="radio" name="shipMethod" value="total"' + (c.shipMethod === 'total' ? ' checked' : '') + '> סכום קבוע</label>' +
      '</div>' +

      '<div id="ship-container" class="' + (c.shipMethod === 'container' ? '' : 'hidden') + '">' +
        '<div class="calc-ship-toggle">' +
          '<label><input type="radio" name="containerType" value="20"' + (c.containerType === '20' ? ' checked' : '') + '> מכולה 20 רגל</label>' +
          '<label><input type="radio" name="containerType" value="40"' + (c.containerType === '40' ? ' checked' : '') + '> מכולה 40 רגל</label>' +
        '</div>' +
        calcField('price20', "מחיר מכולת 20' ($)", c.price20, '$') +
        calcField('price40', "מחיר מכולת 40' ($)", c.price40, '$') +
        '<details class="calc-advanced"><summary>קיבולת מכולות (לעריכה)</summary>' +
          calcField('cap20', "קיבולת 20' (מ״ק)", c.cap20, '', 'מ״ק') +
          calcField('cap40', "קיבולת 40' (מ״ק)", c.cap40, '', 'מ״ק') +
        '</details>' +
        '<div class="calc-hint">💡 מזין את מחיר שתי המכולות — המערכת תמליץ מה חסכוני יותר להזמנה הזו.</div>' +
      '</div>' +
      '<div id="ship-lcl" class="' + (c.shipMethod === 'lcl' ? '' : 'hidden') + '">' + calcField('priceLCL', 'מחיר LCL למ״ק ($)', c.priceLCL, '$') + '</div>' +
      '<div id="ship-kg" class="' + (c.shipMethod === 'kg' ? '' : 'hidden') + '">' + calcField('shipRateKg', 'מחיר הובלה לק״ג ($)', c.shipRateKg, '$') + '</div>' +
      '<div id="ship-total" class="' + (c.shipMethod === 'total' ? '' : 'hidden') + '">' + calcField('shipTotalUSD', 'עלות הובלה כוללת ($)', c.shipTotalUSD, '$') + '</div>' +
      '<div class="calc-hint">💡 מכולה מלאה = שלך לבד. LCL = משלוח חלקי משותף, משלמים לפי נפח. אווירי = לפי משקל.</div>' +

      '<div class="calc-group-title">🛃 עלויות נוספות</div>' +
      calcField('customsUSD', 'עמילות מכס — סכום להזמנה ($)', c.customsUSD, '$') +
      calcField('vatPercent', 'מע״מ (%)', c.vatPercent, '', '%') +

      '<div class="calc-group-title">💱 שער דולר</div>' +
      calcField('exchangeRate', 'שער דולר → שקל', c.exchangeRate, '₪') +
      '<div class="calc-hint">שנה כאן את השער לפי המחיר היציג העדכני. הערך נזכר לפעם הבאה.</div>' +

      '<div id="calc-ship-reco"></div>' +
      '<div id="calc-result" class="calc-result"></div>' +
    '</div>';

  bindCalc(body, p, c);
  renderCalcResult(body, c);
}

function calcField(field, label, value, prefix, suffix) {
  return (
    '<div class="calc-field">' +
      '<label class="calc-label">' + esc(label) + '</label>' +
      '<div class="calc-input-wrap">' +
        (prefix ? '<span class="calc-affix">' + esc(prefix) + '</span>' : '') +
        '<input type="number" inputmode="decimal" step="any" min="0" class="calc-input" data-field="' + field + '" value="' + (value || value === 0 ? esc(value) : '') + '">' +
        (suffix ? '<span class="calc-affix">' + esc(suffix) + '</span>' : '') +
      '</div>' +
    '</div>'
  );
}

let calcSaveTimer = null;

function bindCalc(body, p, c) {
  // שדות מספריים
  body.querySelectorAll('.calc-input').forEach(inp => {
    inp.addEventListener('input', () => {
      c[inp.dataset.field] = inp.value;
      if (inp.dataset.field === 'exchangeRate') {
        const r = num(inp.value); if (r > 0) localStorage.setItem(RATE_KEY, r);
      }
      renderCalcResult(body, c);
      scheduleCalcSave(p, c);
    });
  });
  // מצב מידות/נפח
  body.querySelectorAll('input[name="dimMode"]').forEach(r => r.addEventListener('change', () => {
    c.dimMode = r.value;
    body.querySelector('#calc-dims').classList.toggle('hidden', r.value === 'volume');
    body.querySelector('#calc-vol').classList.toggle('hidden', r.value !== 'volume');
    renderCalcResult(body, c); scheduleCalcSave(p, c);
  }));
  // שיטת הובלה
  body.querySelectorAll('input[name="shipMethod"]').forEach(r => r.addEventListener('change', () => {
    c.shipMethod = r.value;
    body.querySelector('#ship-container').classList.toggle('hidden', r.value !== 'container');
    body.querySelector('#ship-lcl').classList.toggle('hidden', r.value !== 'lcl');
    body.querySelector('#ship-kg').classList.toggle('hidden', r.value !== 'kg');
    body.querySelector('#ship-total').classList.toggle('hidden', r.value !== 'total');
    renderCalcResult(body, c); scheduleCalcSave(p, c);
  }));
  // סוג מכולה
  body.querySelectorAll('input[name="containerType"]').forEach(r => r.addEventListener('change', () => {
    c.containerType = r.value;
    renderCalcResult(body, c); scheduleCalcSave(p, c);
  }));
}

function scheduleCalcSave(p, c) {
  clearTimeout(calcSaveTimer);
  calcSaveTimer = setTimeout(async () => {
    p.importCalc = c;
    try { await api('updateField', { entity: 'project', id: p.id, field: 'importCalc', value: c }); }
    catch (e) { /* יסונכרן בהמשך */ }
  }, 900);
}

function shipRecoHtml(r) {
  if (!r.options || r.options.length < 1) return '';
  const rows = r.options.map(o =>
    '<div class="ship-opt' + (r.cheapest && o.key === r.cheapest.key ? ' best' : '') + '">' +
      '<span class="ship-opt-label">' + esc(o.label) +
        (r.cheapest && o.key === r.cheapest.key && r.options.length > 1 ? ' <span class="ship-best-tag">מומלץ ✓</span>' : '') + '</span>' +
      '<span class="ship-opt-detail">' + esc(o.detail) + '</span>' +
      '<span class="ship-opt-cost">' + money(o.cost, '$') + '</span>' +
    '</div>').join('');
  return '<div class="ship-reco"><div class="ship-reco-title">' + icon('truck') + ' השוואת אפשרויות שילוח</div>' + rows + '</div>';
}

function renderCalcResult(body, c) {
  const r = computeCalc(c);
  const reco = body.querySelector('#calc-ship-reco');
  if (reco) reco.innerHTML = shipRecoHtml(r);
  const el = body.querySelector('#calc-result');
  if (!el) return;
  let shipLine;
  if (r.shipMethod === 'container' && r.containersNeeded) {
    shipLine = calcLine('הובלה — ' + r.containersNeeded + ' × מכולת ' + r.containerType + "'",
      money(r.shipTotal, '$') + '  (ניצול ' + Math.round(r.containerFill * 100) + '%)');
  } else {
    shipLine = calcLine('הובלה ליחידה', money(r.shipPerUnit, '$') + '  (סה״כ ' + money(r.shipTotal, '$') + ')');
  }
  el.innerHTML =
    '<div class="calc-result-title">סיכום עלויות</div>' +
    calcLine('נפח ליחידה', (Math.round(r.unitVolume * 10000) / 10000) + ' מ״ק') +
    calcLine('נפח כולל להזמנה', (Math.round(r.totalVolume * 1000) / 1000) + ' מ״ק (' + r.qty + ' יח׳)') +
    calcLine('משקל כולל', (Math.round(r.totalWeight * 100) / 100) + ' ק״ג') +
    '<div class="calc-sep"></div>' +
    calcLine('עלות מוצר ליחידה', money(r.productPerUnit, '$')) +
    shipLine +
    calcLine('הובלה ליחידה', money(r.shipPerUnit, '$')) +
    calcLine('עמילות מכס ליחידה', money(r.customsPerUnit, '$')) +
    calcLine('מע״מ ליחידה', money(r.vatPerUnitUSD, '$')) +
    '<div class="calc-sep"></div>' +
    '<div class="calc-total">' +
      '<div class="calc-total-row"><span>עלות כוללת ליחידה</span><b>' + money(r.totalPerUnitUSD, '$') + '</b></div>' +
      '<div class="calc-total-row calc-total-ils"><span>מחיר ליחידה בארץ</span><b>' + money(r.totalPerUnitILS, '₪') + '</b></div>' +
      '<div class="calc-total-order">סה״כ להזמנה: ' + money(r.totalOrderUSD, '$') + ' · ' + money(r.totalOrderILS, '₪') + ' (שער ' + r.rate + ')</div>' +
    '</div>';
}

function calcLine(label, val) {
  return '<div class="calc-line"><span>' + esc(label) + '</span><span>' + esc(val) + '</span></div>';
}
