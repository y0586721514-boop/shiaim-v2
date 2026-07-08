/* ================================================================
   מסמכים — חשבוניות, מסמכי מוצר, מכס, תקן, שטר מטען, קטלוג
   ----------------------------------------------------------------
   כל מסמך מועלה לתיקיית ה-Drive של הפרויקט, ומתויג לקטגוריה.
   הרשומות נשמרות בתוך הפרויקט (p.documents) ומסתנכרנות רגיל.
   מסמכי תקן כוללים גם אזור הערות "מה חסר ונדרש להשלים".
   ================================================================ */

const DOC_SECTIONS = [
  {
    key: 'order', title: '🧾 חשבוניות ומסמכי הזמנה',
    hint: 'פרטי ההזמנה, הזמנה ללקוח, חשבוניות תשלום, אישור העברה',
    slots: ['פרטי ההזמנה', 'הזמנה ללקוח', 'חשבונית מקדמה', 'חשבונית תשלום', 'חשבונית סיום תשלום', 'אישור העברה בנקאית'],
    addLabel: '+ הוסף חשבונית / מסמך'
  },
  {
    key: 'product', title: '📦 מסמכי מוצר',
    hint: 'אריזה, הוראות הפעלה, תמונות מוצר, הדמיה',
    slots: ['אריזה', 'הוראות הפעלה', 'תמונות מוצר', 'הדמיה'],
    addLabel: '+ הוסף מסמך מוצר'
  },
  {
    key: 'customs', title: '🛃 תיק מוצר למכס',
    hint: 'אינווייס + פקינג ליסט, אישור העברה בנקאית',
    slots: ['אינווייס + פקינג ליסט', 'אישור העברה בנקאית', 'פקינג ליסט'],
    addLabel: '+ הוסף מסמך מכס'
  },
  {
    key: 'standards', title: '✅ מסמכי תקן',
    hint: 'מסמכי תקן — וגם רישום מה חסר ונדרש להשלים',
    slots: [],
    addLabel: '+ הוסף מסמך תקן',
    notes: true
  },
  {
    key: 'bol', title: '🚢 שטר מטען',
    hint: '', slots: ['שטר מטען'], addLabel: '+ הוסף שטר מטען'
  },
  {
    key: 'catalog', title: '📖 קטלוג מוצר',
    hint: '', slots: ['קטלוג מוצר'], addLabel: '+ הוסף קטלוג'
  }
];

function projectDocuments(p) { return p.documents || []; }
function docsOf(p, section, label) {
  return projectDocuments(p).filter(d => d.section === section && (label === undefined || d.label === label));
}
function customDocsOf(p, section) {
  const slots = (DOC_SECTIONS.find(s => s.key === section) || {}).slots || [];
  return projectDocuments(p).filter(d => d.section === section && slots.indexOf(d.label) === -1);
}

function renderProjectDocumentsTab(body, p) {
  if (!p.folderId && !IS_DEMO) {
    body.innerHTML = '<div class="empty-state">לפרויקט הזה עדיין אין תיקיית Drive. פרויקטים חדשים מקבלים תיקייה אוטומטית.</div>';
    return;
  }
  if (IS_DEMO) {
    body.innerHTML = '<div class="empty-state">📁 העלאת מסמכים תעבוד אחרי חיבור לשרת האמיתי (כאן זה מצב הדגמה, בלי Drive).</div>' +
      docSectionsPreviewHtml();
    return;
  }

  body.innerHTML =
    (p.folderId ? '<div style="text-align:center;margin-bottom:.8rem"><a class="phone-link" style="color:var(--navy-light)" target="_blank" rel="noopener" href="https://drive.google.com/drive/folders/' + esc(p.folderId) + '">📁 פתח את תיקיית הפרויקט ב-Drive</a></div>' : '') +
    DOC_SECTIONS.map(s => docSectionHtml(p, s)).join('');

  wireDocSections(body, p);
}

function docSectionHtml(p, s) {
  let rows = '';
  // סלוטים קבועים
  s.slots.forEach(label => {
    const files = docsOf(p, s.key, label);
    rows += docRowHtml(s.key, label, files);
  });
  // מסמכים מותאמים (נוספו ידנית)
  customDocsOf(p, s.key).forEach(d => {
    rows += docRowHtml(s.key, d.label, [d], true);
  });

  return (
    '<div class="doc-section" data-section="' + s.key + '">' +
      '<div class="doc-section-title">' + s.title + '</div>' +
      (s.hint ? '<div class="doc-section-hint">' + esc(s.hint) + '</div>' : '') +
      '<div class="doc-rows">' + rows + '</div>' +
      '<button class="btn-secondary doc-add-btn" data-section="' + s.key + '">' + esc(s.addLabel) + '</button>' +
      sectionNotesHtml(p, s.key) +
    '</div>'
  );
}

function docRowHtml(section, label, files, isCustom) {
  const filesHtml = (files || []).map(f =>
    '<span class="doc-file">' + fileIcon(f.mimeType) +
      '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' +
      '<button class="doc-file-del" data-doc-id="' + esc(f.id) + '" title="הסר">✕</button>' +
    '</span>'
  ).join('');
  return (
    '<div class="doc-row">' +
      '<div class="doc-row-head">' +
        '<span class="doc-label">' + esc(label) + '</span>' +
        '<button class="doc-upload-btn" data-section="' + esc(section) + '" data-label="' + esc(label) + '">⬆ העלה</button>' +
      '</div>' +
      (filesHtml ? '<div class="doc-files">' + filesHtml + '</div>' : '<div class="doc-empty">— אין עדיין קובץ —</div>') +
    '</div>'
  );
}

/** הערות "מה חסר / נדרש להשלים" — לכל קטגוריית מסמכים */
function getSectionNotes(p, key) {
  if (p.docNotes && p.docNotes[key] !== undefined) return p.docNotes[key];
  if (key === 'standards' && p.standardsNotes) return p.standardsNotes; // תאימות לאחור
  return '';
}

function sectionNotesHtml(p, key) {
  const val = getSectionNotes(p, key);
  const hasContent = val && val.trim();
  return (
    '<div class="doc-notes' + (hasContent ? '' : ' doc-notes-empty') + '">' +
      '<div class="doc-notes-title">📝 מה חסר / נדרש להשלים</div>' +
      '<textarea class="form-textarea" data-notes="' + esc(key) + '" placeholder="רשום כאן אילו מסמכים עדיין חסרים ומה צריך להשיג...">' + esc(val) + '</textarea>' +
      '<button class="btn-secondary" data-save-notes="' + esc(key) + '" style="margin-top:.5rem">שמור הערות</button>' +
    '</div>'
  );
}

function docSectionsPreviewHtml() {
  return DOC_SECTIONS.map(s =>
    '<div class="doc-section"><div class="doc-section-title">' + s.title + '</div>' +
    (s.hint ? '<div class="doc-section-hint">' + esc(s.hint) + '</div>' : '') +
    (s.slots.length ? '<div class="doc-section-hint">כולל: ' + s.slots.map(esc).join(' · ') + '</div>' : '') +
    '</div>'
  ).join('');
}

function wireDocSections(body, p) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.style.display = 'none';
  body.appendChild(fileInput);
  let pending = null; // {section, label}

  body.querySelectorAll('.doc-upload-btn').forEach(btn => {
    btn.onclick = () => { pending = { section: btn.dataset.section, label: btn.dataset.label }; fileInput.value = ''; fileInput.click(); };
  });

  body.querySelectorAll('.doc-add-btn').forEach(btn => {
    btn.onclick = () => {
      const section = btn.dataset.section;
      openModal({
        title: 'הוספת מסמך',
        maxWidth: '360px',
        bodyHtml: '<div class="form-group"><label class="form-label">שם המסמך</label><input type="text" id="doc-custom-label" class="form-input" placeholder="למשל: חשבונית תשלום 3"></div>',
        footerHtml: '<button class="btn-gold" id="doc-custom-ok">בחר קובץ להעלאה</button><button class="btn-secondary btn-modal-close">ביטול</button>',
        onOpen(back, close) {
          back.querySelector('#doc-custom-ok').onclick = () => {
            const label = back.querySelector('#doc-custom-label').value.trim();
            if (!label) { toast('צריך שם למסמך', 'error'); return; }
            close();
            pending = { section, label };
            fileInput.value = ''; fileInput.click();
          };
        }
      });
    };
  });

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file || !pending) return;
    if (file.size > 20 * 1024 * 1024) { toast('הקובץ גדול מדי — עד 20MB', 'error'); return; }
    await uploadDocument(p, pending.section, pending.label, file);
    pending = null;
  };

  body.querySelectorAll('.doc-file-del').forEach(btn => {
    btn.onclick = () => deleteDocument(p, btn.dataset.docId);
  });

  body.querySelectorAll('[data-save-notes]').forEach(btn => {
    btn.onclick = async () => {
      const key = btn.dataset.saveNotes;
      const ta = body.querySelector('[data-notes="' + key + '"]');
      const val = ta ? ta.value : '';
      const notes = Object.assign({}, p.docNotes || {});
      // מיגרציה חד-פעמית של הערות התקן הישנות
      if (p.standardsNotes && notes.standards === undefined) notes.standards = p.standardsNotes;
      notes[key] = val;
      p.docNotes = notes;
      btn.disabled = true; btn.textContent = 'שומר...';
      try {
        await api('updateField', { entity: 'project', id: p.id, field: 'docNotes', value: notes });
        toast('ההערות נשמרו ✓', 'success');
      } catch (e) {
        toast(friendlyError(e.code), 'error');
      } finally {
        btn.disabled = false; btn.textContent = 'שמור הערות';
      }
    };
  });
}

async function uploadDocument(p, section, label, file) {
  showSpinner(true);
  try {
    const res = await api('uploadFile', { folderId: p.folderId, filename: label + ' — ' + file.name, base64: await fileToBase64(file), mimeType: file.type }, { noQueue: true });
    const f = res.file;
    const entry = { id: uid(), section, label, fileId: f.id, name: f.name, url: f.url, mimeType: f.mimeType, size: f.size, date: new Date().toISOString(), user: S.user };
    const docs = projectDocuments(p).concat([entry]);
    p.documents = docs;
    await api('updateField', { entity: 'project', id: p.id, field: 'documents', value: docs });
    toast('המסמך הועלה ✓', 'success');
    renderProjectPanel();
  } catch (e) {
    toast(e.code === 'network' ? 'העלאת מסמכים דורשת חיבור לאינטרנט' : friendlyError(e.code), 'error');
  } finally {
    showSpinner(false);
  }
}

function deleteDocument(p, docId) {
  const doc = projectDocuments(p).find(d => d.id === docId);
  if (!doc) return;
  confirmModal({ title: 'הסרת מסמך', message: 'להסיר את "' + doc.label + '" (' + doc.name + ')? הקובץ יעבור לסל האשפה ב-Drive.', btnLabel: 'הסר' }).then(async ok => {
    if (!ok) return;
    const docs = projectDocuments(p).filter(d => d.id !== docId);
    p.documents = docs;
    renderProjectPanel();
    try {
      await api('updateField', { entity: 'project', id: p.id, field: 'documents', value: docs });
      if (doc.fileId) api('deleteFile', { fileId: doc.fileId }, { noQueue: true }).catch(() => {});
      toast('המסמך הוסר ✓', 'success');
    } catch (e) { toast(friendlyError(e.code), 'error'); }
  });
}
