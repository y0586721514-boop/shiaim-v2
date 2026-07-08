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
      showSpinner(false);
      if (!ex.items || !ex.items.length) {
        // אין פירוט פר-מוצר — נופלים חזרה לזרימה של מוצר בודד אם אפשר
        toast('לא זוהו מוצרים נפרדים במסמך. נסה מסמך עם טבלת פריטים.', 'error');
        return;
      }
      openMultiImportModal(file, ex);
    } catch (e) {
      showSpinner(false);
      toast('שגיאה בקריאת הקובץ — ודא שזה אקסל/CSV תקין', 'error');
    }
  };
  input.click();
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

function openMultiImportModal(file, ex) {
  const items = ex.items;
  const supOpts = supplierOptions().map(o => '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>').join('');
  const shipOpts = shipmentOptions().map(o => '<option value="' + esc(o.value) + '">' + esc(o.label) + '</option>').join('');

  const rows = items.map((it, idx) => {
    const match = miMatchExisting(miItemName(it));
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
          '<label><input type="radio" name="mi-t-' + idx + '" value="new"' + (match ? '' : ' checked') + '> חדש</label>' +
          '<label><input type="radio" name="mi-t-' + idx + '" value="existing"' + (match ? ' checked' : '') + '> קיים</label>' +
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
      '<div class="form-grid">' +
        '<div class="form-group"><label class="form-label">ספק / מפעל (לכל המוצרים)</label><select id="mi-supplier" class="form-select">' + supOpts + '</select></div>' +
        '<div class="form-group"><label class="form-label">מכולה / משלוח (לכל המוצרים)</label><select id="mi-shipment" class="form-select">' + shipOpts + '</select>' +
          '<input type="text" id="mi-shipment-new" class="form-input hidden" placeholder="שם המכולה החדשה" value="' + esc(ex.docNo || '') + '"></div>' +
      '</div>' +
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
      // ספק חדש דרך המודל הקיים
      supSel.addEventListener('change', () => {
        if (supSel.value === '__new__') {
          openAddSupplierModal();
          supSel.value = '';
        }
      });

      back.querySelector('#mi-apply').onclick = async () => {
        // ספק
        let supplierId = supSel.value === '__new__' ? '' : supSel.value;
        // מכולה
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
        await applyMultiImport(file, ex, plan, { supplierId, shipmentName, doUpload });
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
  try {
    if (opts.doUpload && !IS_DEMO) { try { base64 = await fileToBase64(file); } catch (e) { base64 = null; } }

    for (const row of plan) {
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
          id: uid(), name: row.name, type: 'client',
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
