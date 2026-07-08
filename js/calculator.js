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

function getCalc(p) {
  const c = Object.assign({
    productCostUSD: 0, dimMode: 'dims',
    lengthCm: 0, widthCm: 0, heightCm: 0, unitVolumeCBM: 0,
    unitWeightKg: 0, quantity: 0,
    shipMode: 'cbm', shipTotalUSD: 0, shipRateCBM: 0, shipRateKg: 0,
    customsUSD: 0, vatPercent: DEFAULT_VAT, exchangeRate: defaultRate()
  }, p.importCalc || {});
  if (!c.exchangeRate) c.exchangeRate = defaultRate();
  return c;
}

function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
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

  let shipTotal = 0;
  if (c.shipMode === 'total') shipTotal = num(c.shipTotalUSD);
  else if (c.shipMode === 'cbm') shipTotal = num(c.shipRateCBM) * totalVolume;
  else if (c.shipMode === 'kg') shipTotal = num(c.shipRateKg) * totalWeight;

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
    rate
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

      '<div class="calc-group-title">🚢 הובלה</div>' +
      '<div class="calc-ship-toggle">' +
        '<label><input type="radio" name="shipMode" value="cbm"' + (c.shipMode === 'cbm' ? ' checked' : '') + '> לפי נפח ($ למ״ק)</label>' +
        '<label><input type="radio" name="shipMode" value="kg"' + (c.shipMode === 'kg' ? ' checked' : '') + '> לפי משקל ($ לק״ג)</label>' +
        '<label><input type="radio" name="shipMode" value="total"' + (c.shipMode === 'total' ? ' checked' : '') + '> סכום קבוע ($)</label>' +
      '</div>' +
      '<div id="ship-cbm" class="' + (c.shipMode === 'cbm' ? '' : 'hidden') + '">' + calcField('shipRateCBM', 'מחיר הובלה למ״ק ($)', c.shipRateCBM, '$') + '</div>' +
      '<div id="ship-kg" class="' + (c.shipMode === 'kg' ? '' : 'hidden') + '">' + calcField('shipRateKg', 'מחיר הובלה לק״ג ($)', c.shipRateKg, '$') + '</div>' +
      '<div id="ship-total" class="' + (c.shipMode === 'total' ? '' : 'hidden') + '">' + calcField('shipTotalUSD', 'עלות הובלה כוללת ($)', c.shipTotalUSD, '$') + '</div>' +
      '<div class="calc-hint">💡 הובלה ימית מחושבת בד״כ לפי נפח (מ״ק), הובלה אווירית לפי משקל (ק״ג). בחר את מה שמתאים למשלוח.</div>' +

      '<div class="calc-group-title">🛃 עלויות נוספות</div>' +
      calcField('customsUSD', 'עמילות מכס — סכום להזמנה ($)', c.customsUSD, '$') +
      calcField('vatPercent', 'מע״מ (%)', c.vatPercent, '', '%') +

      '<div class="calc-group-title">💱 שער דולר</div>' +
      calcField('exchangeRate', 'שער דולר → שקל', c.exchangeRate, '₪') +
      '<div class="calc-hint">שנה כאן את השער לפי המחיר היציג העדכני. הערך נזכר לפעם הבאה.</div>' +

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
  // מצב הובלה
  body.querySelectorAll('input[name="shipMode"]').forEach(r => r.addEventListener('change', () => {
    c.shipMode = r.value;
    body.querySelector('#ship-cbm').classList.toggle('hidden', r.value !== 'cbm');
    body.querySelector('#ship-kg').classList.toggle('hidden', r.value !== 'kg');
    body.querySelector('#ship-total').classList.toggle('hidden', r.value !== 'total');
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

function renderCalcResult(body, c) {
  const r = computeCalc(c);
  const el = body.querySelector('#calc-result');
  if (!el) return;
  el.innerHTML =
    '<div class="calc-result-title">📊 סיכום עלויות</div>' +
    calcLine('נפח ליחידה', (Math.round(r.unitVolume * 10000) / 10000) + ' מ״ק') +
    calcLine('נפח כולל להזמנה', (Math.round(r.totalVolume * 1000) / 1000) + ' מ״ק (' + r.qty + ' יח׳)') +
    calcLine('משקל כולל', (Math.round(r.totalWeight * 100) / 100) + ' ק״ג') +
    '<div class="calc-sep"></div>' +
    calcLine('עלות מוצר ליחידה', money(r.productPerUnit, '$')) +
    calcLine('הובלה ליחידה', money(r.shipPerUnit, '$') + '  (סה״כ ' + money(r.shipTotal, '$') + ')') +
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
