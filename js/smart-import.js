/* ================================================================
   ייבוא חכם גלובלי — מסמך ספק אחד → כמה מוצרים
   ----------------------------------------------------------------
   כפתור במסך הראשי. זורקים מסמך ספק (אינווייס / פקינג ליסט / PI)
   שמכיל כמה מוצרים, המערכת מפרידה בין המוצרים, ולכל אחד בוחרים:
   פרויקט חדש או עדכון פרויקט קיים. כולם משויכים אוטומטית לאותו
   ספק ולאותה מכולה (כי הם נשלחים יחד).
   נשען על הפרסרים של import.js (importExtractFromFile) — לא משנה אותם.
   ================================================================ */

function openGlobalImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = async () => {
    const file = input.files[0];
    document.body.removeChild(input);
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('הקובץ גדול מדי — עד 20MB', 'error'); return; }
    if (typeof XLSX === 'undefined') { toast('ספריית האקסל לא נטענה — נסה לרענן', 'error'); return; }
    showSpinner(true);
    try {
      const ex = await importExtractFromFile(file);
      let supInfo = {};
      try { const wb = await importReadWorkbook(file); supInfo = siSupplierFromRows(importSheetRows(wb)); } catch (e) {}
      if (!supInfo.name && ex.supplier) supInfo.name = String(ex.supplier).slice(0, 80);
      showSpinner(false);
      if (!ex.items || !ex.items.length) {
        toast('לא זוהו מוצרים נפרדים במסמך. נסה מסמך עם טבלת פריטים.', 'error');
        return;
      }
      openMultiImportModal(file, ex, supInfo);
    } catch (e) {
      showSpinner(false);
      toast('שגיאה בקריאת הקובץ — ודא שזה אקסל/CSV תקין', 'error');
    }
  };
  input.click();
}

/** חילוץ פרטי הספק מהמסמך: שם, מייל, אתר, נמל ייצוא, כתובת, טלפון, WeChat */
function siSupplierFromRows(rows) {
  const text = rows.map(r => r.join(' | ')).join('\n');
  const info = {};
  info.name = (importFindVal(rows, /发货人|supplier|seller|exporter|manufacturer|公司名称|shipper/i) || '').slice(0, 80);
  const em = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i); if (em) info.email = em[0];
  let ws = text.match(/((?:https?:\/\/)?www\.[a-z0-9.\-]+\.[a-z]{2,}[^\s|]*)/i) || text.match(/((?:https?:\/\/)[a-z0-9.\-]+\.[a-z]{2,}[^\s|]*)/i);
  if (ws && !/\.(png|jpg|jpeg|gif)$/i.test(ws[1])) info.website = ws[1];
  info.exportPort = (importFindVal(rows, /port\s*of\s*loading|loading\s*port|装运港|起运港|port\s*of\s*departure/i) || '').slice(0, 40);
  if (!info.exportPort) {
    const pm = text.match(/\b(Ningbo|Shenzhen|Shanghai|Yiwu|Qingdao|Guangzhou|Xiamen|Tianjin|Dalian|Foshan|Zhongshan)\b/i);
    if (pm) info.exportPort = pm[1];
  }
  info.address = (importFindVal(rows, /^address|地址|company\s*address/i) || '').slice(0, 120);
  info.phone = (importFindVal(rows, /^tel|phone|电话|手机|mobile/i) || '').slice(0, 40);
  info.wechat = (importFindVal(rows, /wechat|微信/i) || '').slice(0, 40);
  return info;
}

/** ניחוש התאמה לספק קיים לפי שם */
function siMatchSupplier(name) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return S.suppliers.find(s => s.name && (
    s.name.toLowerCase() === n || s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase())
  )) || null;
}

/** ניחוש התאמה לפרויקט קיים לפי שם המוצר */
function miMatchExisting(name) {
  if (!name) return null;
  const n = String(name).trim().toLowerCase();
  return S.projects.find(p => !p.completed && p.name && (
    p.name.toLowerCase() === n ||
    p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase())
  )) || null;
}

function miItemName(it) { return (it.model || it.desc || '').trim() || 'מוצר'; }

function miExistingSelectHtml(idx, preId) {
  const opts = S.projects.filter(p => !p.completed)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'))
    .map(p => '<option value="' + esc(p.id) + '"' + (p.id === preId ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
  return '<select class="form-select mi-existing" data-idx="' + idx + '"><option value="">— בחר פרויקט —</option>' + opts + '</select>';
}

function openMultiImportModal(file, ex, supInfo) {
  supInfo = supInfo || {};
  const items = ex.items;
  const shipOpts = shipmentOptions().map(o => '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>').join('');

  // בורר ספק — עם התאמה אוטומטית / יצירה מהמסמך
  const matchSup = siMatchSupplier(supInfo.name);
  let supOpts = '<option value="">— בחר ספק —</option>';
  S.suppliers.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).forEach(s => {
    supOpts += '<option value="' + esc(s.id) + '"' + (matchSup && matchSup.id === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>';
  });
  if (supInfo.name && !matchSup) supOpts += '<option value="__new_from_doc__" selected>➕ צור: ' + esc(supInfo.name) + ' (מהמסמך)</option>';
  supOpts += '<option value="__new__">+ ספק חדש (ידני)...</option>';

  const infoBits = [];
  if (supInfo.exportPort) infoBits.push('נמל: ' + supInfo.exportPort);
  if (supInfo.email) infoBits.push('מייל: ' + supInfo.email);
  if (supInfo.website) infoBits.push('אתר: ' + supInfo.website);
  if (supInfo.address) infoBits.push('כתובת: ' + String(supInfo.address).slice(0, 50));
  const supInfoBox = (supInfo.name || infoBits.length)
    ? '<div class="form-hint" style="background:var(--surface-2);padding:.5rem .7rem;border-radius:8px">🏭 זוהה מהמסמך: <b>' + esc(supInfo.name || '') + '</b>' + (infoBits.length ? ' · ' + infoBits.map(esc).join(' · ') : '') + '</div>'
    : '';

  const rows = items.map((it, idx) => {
    const match = miMatchExisting(miItemName(it));
    const isSpare = /spare|备件|配件|accessor|spare\s*part/i.test(miItemName(it) + ' ' + (it.desc || ''));
    const qty = ex.type === 'packing' ? (it.pcs || 0) : (it.qty || 0);
    return (
      '<div class="mi-row" data-idx="' + idx + '">' +
        '<div class="mi-row-main">' +
          '<input type="text" class="form-input mi-name" data-idx="' + idx + '" value="' + esc(miItemName(it)) + '">' +
          '<div class="mi-nums">' +
            (qty ? '<span>' + qty + ' יח׳</span>' : '') +
            (it.price ? '<span>$' + it.price + '</span>' : '') +
            (it.cbm ? '<span>' + it.cbm + ' מ״ק</span>' : '') +
            (it.hs ? '<span>HS ' + esc(it.hs) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="mi-target">' +
          '<label><input type="radio" name="mi-t-' + idx + '" value="new"' + (!match && !isSpare ? ' checked' : '') + '> חדש</label>' +
          '<label><input type="radio" name="mi-t-' + idx + '" value="existing"' + (match && !isSpare ? ' checked' : '') + '> קיים</label>' +
          '<label title="יצורף לחלקי החילוף של המוצר שמעליו"><input type="radio" name="mi-t-' + idx + '" value="spare"' + (isSpare ? ' checked' : '') + '> חלק חילוף</label>' +
          '<label><input type="radio" name="mi-t-' + idx + '" value="skip"> דלג</label>' +
          miExistingSelectHtml(idx, match ? match.id : '') +
        '</div>' +
      '</div>'
    );
  }).join('');

  openModal({
    title: '🪄 ייבוא חכם — ' + (IMPORT_TYPE_LABELS[ex.type] || ex.type) + ' · ' + items.length + ' מוצרים',
    maxWidth: '640px',
    bodyHtml:
      '<div class="form-hint" style="margin-bottom:.6rem">קובץ: ' + esc(file.name) + (ex.docNo ? ' · מסמך ' + esc(ex.docNo) : '') + '</div>' +
      supInfoBox +
      '<div class="form-grid">' +
        '<div class="form-group"><label class="form-label">ספק / מפעל (לכל המוצרים)</label><select id="mi-supplier" class="form-select">' + supOpts + '</select></div>' +
        '<div class="form-group"><label class="form-label">מכולה / משלוח (לכל המוצרים)</label><select id="mi-shipment" class="form-select">' + shipOpts + '</select>' +
          '<input type="text" id="mi-shipment-new" class="form-input hidden" placeholder="שם המכולה החדשה" value="' + esc(ex.docNo || '') + '"></div>' +
      '</div>' +
      (infoBits.length ? '<label style="display:block;margin:.2rem 0 .4rem"><input type="checkbox" id="mi-update-sup" checked> למלא את פרטי הספק (נמל/מייל/אתר/כתובת) מהמסמך</label>' : '') +
      '<label style="display:block;margin:.2rem 0 .4rem"><input type="checkbox" id="mi-translate" checked> 🌐 תרגם שמות מוצרים ופרטי ספק לעברית</label>' +
      '<div class="calc-group-title">מוצרים שזוהו — בחר לכל אחד יעד</div>' +
      '<div class="mi-list">' + rows + '</div>' +
      (ex.hsCodes && ex.hsCodes.length ? '<div class="form-hint">HS Codes: ' + ex.hsCodes.map(esc).join(', ') + '</div>' : '') +
      (ex.hasBattery ? '<div class="form-hint">🔋 המשלוח מכיל מוצרים עם סוללה</div>' : '') +
      '<label style="display:block;margin:.6rem 0 .2rem"><input type="checkbox" id="mi-upload" checked> להעלות את המסמך לכל פרויקט (ל-Drive)</label>',
    footerHtml: '<button class="btn-gold" id="mi-apply">✓ בצע ייבוא</button><button class="btn-secondary btn-modal-close">ביטול</button>',
    onOpen(back, close) {
      const supSel = back.querySelector('#mi-supplier');
      const shipSel = back.querySelector('#mi-shipment');
      const shipNew = back.querySelector('#mi-shipment-new');
      const toggleShipNew = () => shipNew.classList.toggle('hidden', shipSel.value !== '__new__');
      shipSel.addEventListener('change', toggleShipNew);
      // ספק חדש ידני — עם פרטים מהמסמך כברירת מחדל
      supSel.addEventListener('change', () => {
        if (supSel.value === '__new__') {
          openAddSupplierModal(supInfo, (newId) => {
            const opt = document.createElement('option');
            const ns = getSupplier(newId);
            opt.value = newId; opt.textContent = ns ? ns.name : 'ספק חדש'; opt.selected = true;
            supSel.insertBefore(opt, supSel.querySelector('option[value="__new__"]'));
          });
          supSel.value = matchSup ? matchSup.id : (supInfo.name ? '__new_from_doc__' : '');
        }
      });

      back.querySelector('#mi-apply').onclick = async () => {
        const supplierChoice = supSel.value;
        const updateSup = back.querySelector('#mi-update-sup') ? back.querySelector('#mi-update-sup').checked : false;
        const translate = back.querySelector('#mi-translate') ? back.querySelector('#mi-translate').checked : false;
        let shipmentName = shipSel.value;
        if (shipmentName === '__new__') shipmentName = (shipNew.value || '').trim();
        else if (shipmentName === '') shipmentName = '';

        const doUpload = back.querySelector('#mi-upload').checked;

        const plan = items.map((it, idx) => {
          const t = (back.querySelector('input[name="mi-t-' + idx + '"]:checked') || {}).value || 'skip';
          const name = (back.querySelector('.mi-name[data-idx="' + idx + '"]') || {}).value || miItemName(it);
          const exId = (back.querySelector('.mi-existing[data-idx="' + idx + '"]') || {}).value || '';
          return { it, target: t, name: name.trim(), existingId: exId };
        }).filter(r => r.target !== 'skip');

        if (!plan.length) { toast('לא נבחר אף מוצר לייבוא', 'error'); return; }
        close();
        await applyMultiImport(file, ex, plan, { supplierChoice, supInfo, updateSup, translate, shipmentName, doUpload });
      };
    }
  });
}

/** בונה נתוני מחשבון ייבוא מפריט בודד (על בסיס מחשבון קיים אם יש) */
function miItemToCalc(it, docType, base) {
  const c = Object.assign(
    (typeof getCalc === 'function') ? getCalc({ importCalc: base || {} }) : (base || {}),
    {}
  );
  const qty = docType === 'packing' ? importNum(it.pcs) : importNum(it.qty);
  if (qty) c.quantity = qty;
  if (docType !== 'packing' && importNum(it.price)) c.productCostUSD = importNum(it.price);
  if (docType === 'packing') {
    if (importNum(it.cbm) && qty) { c.dimMode = 'volume'; c.unitVolumeCBM = importRound(importNum(it.cbm) / qty, 6); }
    if (importNum(it.gw) && qty) c.unitWeightKg = importRound(importNum(it.gw) / qty, 4);
  }
  return c;
}

async function applyMultiImport(file, ex, plan, opts) {
  showSpinner(true);
  let created = 0, updated = 0, uploaded = 0, base64 = null;
  const target = importDocTarget(ex.type);
  const supInfo = opts.supInfo || {};
  try {
    // --- פתרון הספק: יצירה מהמסמך / עדכון פרטים ---
    let supplierId = opts.supplierChoice;
    if (supplierId === '__new_from_doc__') {
      const so = {
        id: uid(), name: supInfo.name || 'ספק', field: '', contactName: '',
        wechat: supInfo.wechat || '', phone: supInfo.phone || '', email: supInfo.email || '',
        website: supInfo.website || '', exportPort: supInfo.exportPort || '', address: supInfo.address || '', notes: ''
      };
      S.suppliers.push(so);
      try { const r = await api('create', { entity: 'supplier', obj: so }); if (r.obj) mergeEntity('supplier', r.obj); } catch (e) {}
      supplierId = so.id;
    } else if (supplierId === '__new__' || !supplierId) {
      supplierId = '';
    }
    // מילוי פרטי ספק קיים מהמסמך (רק שדות ריקים)
    if (supplierId && opts.updateSup) {
      const sup = getSupplier(supplierId);
      if (sup) {
        for (const k of ['exportPort', 'email', 'website', 'address', 'phone', 'wechat']) {
          if (supInfo[k] && !sup[k]) { sup[k] = supInfo[k]; try { await api('updateField', { entity: 'supplier', id: sup.id, field: k, value: supInfo[k] }); } catch (e) {} }
        }
      }
    }
    opts.supplierId = supplierId;

    // --- תרגום לעברית ---
    if (opts.translate) {
      // שמות מוצרים חדשים
      const newRows = plan.filter(r => r.target === 'new');
      if (newRows.length) {
        const heNames = await translateToHebrew(newRows.map(r => r.name));
        newRows.forEach((r, i) => { r.nameOriginal = r.name; r.name = (heNames[i] || r.name); });
      }
      // שם + כתובת ספק
      if (supplierId) {
        const sup = getSupplier(supplierId);
        if (sup) {
          const toTr = [];
          if (sup.name && !sup.nameHe) toTr.push(['nameHe', sup.name]);
          if (sup.address && !sup.addressHe) toTr.push(['addressHe', sup.address]);
          if (toTr.length) {
            const trs = await translateToHebrew(toTr.map(t => t[1]));
            for (let i = 0; i < toTr.length; i++) {
              sup[toTr[i][0]] = trs[i];
              try { await api('updateField', { entity: 'supplier', id: sup.id, field: toTr[i][0], value: trs[i] }); } catch (e) {}
            }
          }
        }
      }
    }

    if (opts.doUpload && !IS_DEMO) { try { base64 = await fileToBase64(file); } catch (e) { base64 = null; } }

    let lastProject = null;
    for (const row of plan) {
      // חלק חילוף — מצורף למוצר הקודם
      if (row.target === 'spare') {
        if (lastProject) {
          const it = row.it;
          const bits = [row.name];
          const q = ex.type === 'packing' ? it.pcs : it.qty;
          if (q) bits.push(q + ' יח׳');
          if (it.hs) bits.push('HS ' + it.hs);
          const line = bits.join(' · ');
          lastProject.spareParts = (lastProject.spareParts ? lastProject.spareParts + '\n' : '') + line;
          try { await api('updateField', { entity: 'project', id: lastProject.id, field: 'spareParts', value: lastProject.spareParts }); } catch (e) {}
        }
        continue;
      }

      let project;
      if (row.target === 'existing' && row.existingId) {
        project = getProject(row.existingId);
        if (!project) continue;
        const c = miItemToCalc(row.it, ex.type, project.importCalc);
        project.importCalc = c;
        await api('updateField', { entity: 'project', id: project.id, field: 'importCalc', value: c });
        if (opts.supplierId && !project.supplierId) await api('updateField', { entity: 'project', id: project.id, field: 'supplierId', value: opts.supplierId });
        if (opts.shipmentName && !project.shipmentName) await api('updateField', { entity: 'project', id: project.id, field: 'shipmentName', value: opts.shipmentName });
        if (opts.supplierId) project.supplierId = project.supplierId || opts.supplierId;
        if (opts.shipmentName) project.shipmentName = project.shipmentName || opts.shipmentName;
        updated++;
      } else {
        const obj = {
          id: uid(), name: row.name, nameOriginal: row.nameOriginal || '', type: 'client',
          status: (S.statuses && S.statuses[0]) || 'בתכנון',
          clientId: '', deadline: '', priority: 0,
          notes: [], importantInfo: [], designs: [], documents: [],
          supplierId: opts.supplierId || '', shipmentName: opts.shipmentName || '',
          importCalc: miItemToCalc(row.it, ex.type, null),
          completed: false, folderId: ''
        };
        const res = await api('create', { entity: 'project', obj });
        project = res.obj || obj;
        mergeEntity('project', project);
        created++;
      }
      lastProject = project;

      // העלאת המסמך לפרויקט
      if (opts.doUpload && base64 && !IS_DEMO) {
        try {
          if (!project.folderId) {
            const fr = await api('ensureFolder', { entity: 'project', id: project.id }, { noQueue: true });
            if (fr.folderId) project.folderId = fr.folderId;
          }
          if (project.folderId) {
            const up = await api('uploadFile', { folderId: project.folderId, filename: target.label + ' — ' + file.name, base64: base64, mimeType: file.type }, { noQueue: true });
            const f = up.file;
            const entry = { id: uid(), section: target.section, label: target.label, fileId: f.id, name: f.name, url: f.url, mimeType: f.mimeType, size: f.size, date: new Date().toISOString(), user: S.user };
            project.documents = (project.documents || []).concat([entry]);
            await api('updateField', { entity: 'project', id: project.id, field: 'documents', value: project.documents });
            uploaded++;
          }
        } catch (e) { /* העלאה נכשלה — לא עוצרים את השאר */ }
      }
    }

    updateNavCounts();
    renderCurrentView();
    toast('ייבוא הושלם: ' + created + ' נוצרו · ' + updated + ' עודכנו' + (uploaded ? ' · ' + uploaded + ' קבצים' : ''), 'success', { duration: 5000 });
  } catch (e) {
    toast(e.code === 'network' ? 'צריך חיבור לאינטרנט לייבוא' : friendlyError(e.code), 'error');
  } finally {
    showSpinner(false);
  }
}
