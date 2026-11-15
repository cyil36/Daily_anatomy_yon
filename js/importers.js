/* Importers: images, PDF pages, Excel (A=image, B=answer, C-E=wrong choices), JSON */
function imageSize(blob) {
  return new Promise(res => {
    const u = URL.createObjectURL(blob); const i = new Image();
    i.onload = () => { res([i.naturalWidth, i.naturalHeight]); URL.revokeObjectURL(u); };
    i.onerror = () => { res([0, 0]); URL.revokeObjectURL(u); };
    i.src = u;
  });
}
async function makePhotoItem(blob, name, answer, wrong) {
  const img = await storeImage(blob);
  const [w, hgt] = await imageSize(blob);
  const labels = answer ? [{ id: uid('l'), answer, boxes: [], wrong: wrong || [] }] : [];
  return addItem({ type: 'photo', img, w, h: hgt, name, labels });
}

/* ---- images ---- */
async function importImages() {
  const files = await pickFile('image/*', true);
  if (!files.length) return;
  const rows = [];
  const list = h('div', { class: 'imp-list' });
  for (const f of files) {
    const ans = h('input', { class: 'input', placeholder: '정답 (선택) — 비우면 나중에 ? 상자를 그려요' });
    const u = URL.createObjectURL(f);
    rows.push({ f, ans });
    list.append(h('div', { class: 'imp-row' }, h('img', { src: u }), h('div', { class: 'grow' }, h('div', { class: 'sm muted' }, f.name), ans)));
  }
  const m = modal(`사진 ${files.length}장 넣기`, h('div', { class: 'form' },
    h('p', { class: 'muted sm pre' }, '• 이미 ? 가 그려진 사진이면 정답만 적으면 바로 문제가 돼요.\n• 깨끗한 사진이면 비워두고, 넣은 뒤 사진 위에 ? 상자를 그려요 (한 사진에 여러 이름 가능).'),
    list,
    h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: async e => {
      e.target.disabled = true; e.target.textContent = '넣는 중…';
      let first = null;
      for (const r of rows) {
        const it = await makePhotoItem(r.f, r.f.name.replace(/\.[^.]+$/, ''), r.ans.value.trim());
        first = first || it;
      }
      save(); m.close(); toast(rows.length + '장을 넣었어요'); rerender();
      if (first && !first.labels.length) openPhotoEditor(first.id);
    } }, '넣기'))), { wide: true });
}

/* ---- PDF ---- */
function pdfReady() {
  if (!window.pdfjsLib) { toast('PDF 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요'); return false; }
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return true;
}
async function importPDF() {
  if (!pdfReady()) return;
  const [file] = await pickFile('application/pdf');
  if (!file) return;
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({ data });
  task.onPassword = (update, reason) => {
    // The password is typed by the user in their own browser and only used locally to open the file.
    passwordBox(reason === 2 ? '비밀번호가 틀렸어요. 다시 입력해 주세요.' : '이 PDF는 비밀번호가 걸려 있어요.').then(p => {
      if (p == null) task.destroy(); else update(p);
    });
  };
  let pdf;
  try { pdf = await task.promise; } catch (e) { if (e && e.name !== 'PasswordException') toast('PDF를 열지 못했어요: ' + (e.message || e)); return; }

  const baseName = file.name.replace(/\.pdf$/i, '');
  const picked = new Set();
  const grid = h('div', { class: 'pdf-grid' });
  const count = h('span', { class: 'muted' });
  const updCount = () => count.textContent = `${picked.size} / ${pdf.numPages}쪽 선택`;
  for (let p = 1; p <= pdf.numPages; p++) {
    picked.add(p);
    const cv = h('canvas');
    const cell = h('div', { class: 'pdf-cell on', onclick: () => { picked.has(p) ? picked.delete(p) : picked.add(p); cell.classList.toggle('on'); updCount(); } }, cv, h('div', { class: 'sm' }, p + '쪽'));
    grid.append(cell);
  }
  updCount();
  // lazy thumbnails
  (async () => {
    for (let p = 1; p <= pdf.numPages; p++) {
      if (!grid.isConnected && p > 1) return;
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const sc = 160 / vp.width; const v2 = page.getViewport({ scale: sc });
      const cv = grid.children[p - 1].querySelector('canvas');
      cv.width = v2.width; cv.height = v2.height;
      await page.render({ canvasContext: cv.getContext('2d'), viewport: v2 }).promise;
    }
  })();
  const folderName = h('input', { class: 'input', value: baseName });
  const split = h('select', { class: 'input' },
    h('option', { value: '1' }, '한 쪽 = 사진 1장'),
    h('option', { value: 'v2' }, '한 쪽을 위/아래 2장으로 나누기'),
    h('option', { value: 'h2' }, '한 쪽을 왼/오른 2장으로 나누기'));
  const m = modal('PDF에서 가져오기', h('div', { class: 'form' },
    h('p', { class: 'muted sm' }, '가져올 쪽을 고르세요 (누르면 빠져요). 각 쪽이 사진 자료가 되고, 그 위에 ? 상자를 그려 문제를 만들어요.'),
    h('div', { class: 'grid2' },
      h('div', null, h('label', { class: 'lbl' }, '새 폴더 이름'), folderName),
      h('div', null, h('label', { class: 'lbl' }, '자르기'), split)),
    h('div', { class: 'row between' }, count, h('div', { class: 'row gap' },
      h('button', { class: 'btn ghost sm', onclick: () => { for (let p = 1; p <= pdf.numPages; p++) picked.add(p); grid.querySelectorAll('.pdf-cell').forEach(c => c.classList.add('on')); updCount(); } }, '전체 선택'),
      h('button', { class: 'btn ghost sm', onclick: () => { picked.clear(); grid.querySelectorAll('.pdf-cell').forEach(c => c.classList.remove('on')); updCount(); } }, '전체 해제'))),
    grid,
    h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: async e => {
      if (!picked.size) return toast('쪽을 골라주세요');
      const btn = e.target; btn.disabled = true;
      const fid = uid('f');
      S.folders.push({ id: fid, name: folderName.value.trim() || baseName, parent: Lib.folder });
      const pages = [...picked].sort((a, b) => a - b);
      let n = 0;
      for (const p of pages) {
        btn.textContent = `가져오는 중… ${++n}/${pages.length}`;
        const page = await pdf.getPage(p);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = Math.min(3, 1800 / vp1.width);
        const vp = page.getViewport({ scale });
        const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const parts = split.value === '1' ? [[0, 0, 1, 1]] : split.value === 'v2' ? [[0, 0, 1, .5], [0, .5, 1, .5]] : [[0, 0, .5, 1], [.5, 0, .5, 1]];
        for (const [pi, r] of parts.entries()) {
          const c2 = document.createElement('canvas');
          c2.width = Math.round(cv.width * r[2]); c2.height = Math.round(cv.height * r[3]);
          c2.getContext('2d').drawImage(cv, cv.width * r[0], cv.height * r[1], c2.width, c2.height, 0, 0, c2.width, c2.height);
          const blob = await new Promise(r2 => c2.toBlob(r2, 'image/jpeg', 0.85));
          const it = await makePhotoItem(blob, `${p}쪽` + (parts.length > 1 ? '-' + (pi + 1) : ''));
          it.folder = fid;
        }
      }
      save(); m.close(); Lib.folder = fid; toast(`${pages.length}쪽을 가져왔어요. 사진을 눌러 ? 상자를 그려요`); rerender();
    } }, '가져오기'))), { wide: true });
}
function passwordBox(msg) {
  return new Promise(res => {
    let done = false;
    const inp = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: 'PDF 비밀번호' });
    const ok = () => { done = true; m.close(); res(inp.value); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    const m = modal('PDF 비밀번호', h('div', null, h('p', { class: 'muted sm' }, msg + ' 비밀번호는 이 브라우저에서 파일을 여는 데만 쓰이고 저장되지 않아요.'), inp,
      h('div', { class: 'row end' }, h('button', { class: 'btn ghost', onclick: () => { done = true; m.close(); res(null); } }, '취소'), h('button', { class: 'btn primary', onclick: ok }, '열기'))),
      { onClose: () => { if (!done) res(null); } });
    setTimeout(() => inp.focus(), 30);
  });
}

/* ---- Excel ---- */
const colIdx = ref => { const m = /^([A-Z]+)(\d+)$/.exec(ref); let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return [c - 1, +m[2] - 1]; };
const xmlDoc = s => new DOMParser().parseFromString(s, 'application/xml');
const byTag = (d, t) => [...d.getElementsByTagName('*')].filter(e => e.localName === t);
function relsMap(xml) {
  const m = {}; if (!xml) return m;
  for (const r of byTag(xmlDoc(xml), 'Relationship')) m[r.getAttribute('Id')] = r.getAttribute('Target');
  return m;
}
const resolvePath = (base, t) => {
  if (t.startsWith('/')) return t.slice(1);
  const parts = base.split('/'); parts.pop();
  for (const seg of t.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
  return parts.join('/');
};
async function importExcel() {
  if (!window.JSZip) return toast('엑셀 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요');
  const [file] = await pickFile('.xlsx');
  if (!file) return;
  let zip;
  try { zip = await JSZip.loadAsync(file); } catch { return toast('엑셀 파일을 읽지 못했어요. .xlsx 파일인지 확인해주세요.'); }
  const txt = p => zip.file(p) ? zip.file(p).async('string') : Promise.resolve(null);
  // first sheet
  const wb = xmlDoc(await txt('xl/workbook.xml'));
  const wbRels = relsMap(await txt('xl/_rels/workbook.xml.rels'));
  const firstSheet = byTag(wb, 'sheet')[0];
  const rid = firstSheet.getAttribute('r:id') || [...firstSheet.attributes].find(a => a.localName === 'id').value;
  const sheetPath = resolvePath('xl/workbook.xml', wbRels[rid]);
  const sheet = xmlDoc(await txt(sheetPath));
  const sst = await txt('xl/sharedStrings.xml');
  const strings = sst ? byTag(xmlDoc(sst), 'si').map(si => byTag(si, 't').map(t => t.textContent).join('')) : [];
  const rows = {}; // r -> {texts:{c:val}, vm}
  for (const c of byTag(sheet, 'c')) {
    const [col, row] = colIdx(c.getAttribute('r'));
    const R = rows[row] = rows[row] || { t: {}, img: null };
    const t = c.getAttribute('t');
    const v = byTag(c, 'v')[0];
    let val = '';
    if (t === 's' && v) val = strings[+v.textContent] || '';
    else if (t === 'inlineStr') val = byTag(c, 't').map(x => x.textContent).join('');
    else if (v && t !== 'e') val = v.textContent;
    if (val) R.t[col] = val.trim();
    if (c.getAttribute('vm') && col === 0) R.vm = +c.getAttribute('vm');
  }
  // floating images (drawing anchors)
  const sheetRels = relsMap(await txt(sheetPath.replace(/([^/]+)$/, '_rels/$1.rels')));
  for (const d of byTag(sheet, 'drawing')) {
    const did = [...d.attributes].find(a => a.localName === 'id').value;
    const dpath = resolvePath(sheetPath, sheetRels[did]);
    const ddoc = xmlDoc(await txt(dpath));
    const drels = relsMap(await txt(dpath.replace(/([^/]+)$/, '_rels/$1.rels')));
    for (const anc of [...byTag(ddoc, 'twoCellAnchor'), ...byTag(ddoc, 'oneCellAnchor')]) {
      const from = byTag(anc, 'from')[0]; if (!from) continue;
      const row = +byTag(from, 'row')[0].textContent;
      const blip = byTag(anc, 'blip')[0]; if (!blip) continue;
      const emb = [...blip.attributes].find(a => a.localName === 'embed').value;
      const R = rows[row] = rows[row] || { t: {}, img: null };
      if (!R.img) R.img = resolvePath(dpath, drels[emb]);
    }
  }
  // "place in cell" images (rich values)
  if (Object.values(rows).some(r => r.vm)) {
    try {
      const rv = xmlDoc(await txt('xl/richData/rdrichvalue.xml'));
      const rvRels = relsMap(await txt('xl/richData/_rels/richValueRel.xml.rels'));
      const relDoc = xmlDoc(await txt('xl/richData/richValueRel.xml'));
      const relIds = byTag(relDoc, 'rel').map(r => [...r.attributes].find(a => a.localName === 'id').value);
      const values = byTag(rv, 'rv').map(r => +byTag(r, 'v')[0].textContent);
      for (const R of Object.values(rows)) if (R.vm && !R.img) {
        const relIndex = values[R.vm - 1];
        const target = rvRels[relIds[relIndex]];
        if (target) R.img = resolvePath('xl/richData/richValueRel.xml', target);
      }
    } catch (e) { console.warn('richData', e); }
  }
  const header = /^(사진|정답|이름|photo|image|answer|name)$/i;
  let added = 0; const skipped = [];
  const fid = uid('f');
  const keys = Object.keys(rows).map(Number).sort((a, b) => a - b);
  for (const r of keys) {
    const R = rows[r];
    const ans = R.t[1] || '';
    if (!R.img && header.test(R.t[0] || '') ) continue;
    if (!R.img && !ans) continue;
    if (!R.img) { skipped.push(`${r + 1}행(사진 없음)`); continue; }
    if (!ans) { skipped.push(`${r + 1}행(정답 없음)`); continue; }
    const f = zip.file(R.img);
    if (!f) { skipped.push(`${r + 1}행(사진 읽기 실패)`); continue; }
    const ext = R.img.split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) { skipped.push(`${r + 1}행(사진 형식)`); continue; }
    const blob = new Blob([await f.async('uint8array')], { type: 'image/' + (ext === 'jpg' ? 'jpeg' : ext) });
    const wrong = [R.t[2], R.t[3], R.t[4]].filter(Boolean);
    const it = await makePhotoItem(blob, ans, ans, wrong);
    it.folder = fid; added++;
  }
  if (!added) return toast('추가된 문제가 없어요. A열에 사진, B열에 정답이 있는지 확인해주세요.', 4000);
  S.folders.push({ id: fid, name: file.name.replace(/\.xlsx$/i, ''), parent: Lib.folder });
  save(); Lib.folder = fid; rerender();
  toast(`${added}개를 넣었어요` + (skipped.length ? `\n건너뛴 줄: ${skipped.slice(0, 6).join(', ')}${skipped.length > 6 ? ' 외 ' + (skipped.length - 6) : ''}` : ''), 5000);
}

/* ---- 자료 묶음 (.zip: manifest.json + images) ----
   manifest: {format:'anat-bundle', name, folders:[{key,name,parent}], items:[{id,folder,name,img,w,h,labels:[{id,answer,boxes}]}]}
   Folders merge by name under the same parent; items with an existing id are updated (answers/boxes), not duplicated. */
async function importBundle() {
  if (!window.JSZip) return toast('압축 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요');
  const [file] = await pickFile('.zip');
  if (!file) return;
  let zip, man;
  try {
    zip = await JSZip.loadAsync(file);
    man = JSON.parse(await zip.file('manifest.json').async('string'));
  } catch { return toast('자료 묶음 파일이 아니에요 (manifest.json 없음)'); }
  if (man.format !== 'anat-bundle') return toast('자료 묶음 파일이 아니에요');
  const nNew = man.items.filter(i => !S.items[i.id]).length;
  if (!await confirmBox(`‘${man.name || file.name}’\n폴더 ${man.folders.length}개, 사진 ${man.items.length}장 (새로 ${nNew}장)을 넣을까요?\n이미 있는 사진은 정답·상자만 새로 고쳐요.`, '넣기')) return;
  const prog = h('div', { class: 'muted' }, '준비 중…');
  const m = modal('자료 묶음 넣는 중', h('div', null, prog, h('p', { class: 'muted sm' }, '창을 닫지 말고 기다려 주세요.')));
  const fmap = {};
  for (const f of man.folders) {
    const parent = f.parent ? fmap[f.parent] : null;
    let ex = S.folders.find(x => x.name === f.name && (x.parent || null) === (parent || null));
    if (!ex) { ex = { id: uid('f'), name: f.name, parent }; S.folders.push(ex); }
    fmap[f.key] = ex.id;
  }
  let done = 0, added = 0, updated = 0; const t0 = Date.now();
  for (const it of man.items) {
    const folder = fmap[it.folder] || null;
    const labels = it.labels.map(l => ({ id: l.id, answer: l.answer, boxes: l.boxes, wrong: l.wrong || [] }));
    const ex = S.items[it.id];
    if (ex) {
      ex.labels = labels; ex.name = it.name; ex.folder = folder; updated++;
    } else {
      const f = zip.file(it.img);
      if (!f) { done++; continue; }
      const ext = it.img.split('.').pop().toLowerCase();
      const blob = new Blob([await f.async('uint8array')], { type: ext === 'png' ? 'image/png' : 'image/jpeg' });
      const img = await storeImage(blob);
      S.items[it.id] = { id: it.id, type: 'photo', img, w: it.w, h: it.h, name: it.name, folder, labels, created: t0 + done };
      added++;
    }
    if (++done % 20 === 0) prog.textContent = `${done} / ${man.items.length}`;
  }
  save(); m.close(); rerender();
  toast(`넣었어요: 새 사진 ${added}장${updated ? `, 고친 사진 ${updated}장` : ''}`, 4000);
}

/* ---- JSON (문족 / 빈칸 bulk) ---- */
async function importJSONItems() {
  const [file] = await pickFile('.json,application/json');
  if (!file) return;
  let arr;
  try { arr = JSON.parse(await file.text()); } catch { return toast('JSON을 읽지 못했어요'); }
  if (!Array.isArray(arr)) arr = arr.items || arr.questions || [];
  let n = 0;
  for (const q of arr) {
    if (q.text && /\[\[.+?\]\]/.test(q.text)) { addItem({ type: 'cloze', text: q.text, lecture: q.lecture || '' }); n++; }
    else if (q.stem || q.choices) {
      addItem({ type: 'jokbo', stem: q.stem || '', data: q.data || '', imgs: [], choices: q.choices || [], answers: q.answers || [],
        atext: q.atext || '', ex: Array.isArray(q.ex) ? q.ex.map(e => e.v || e).join('\n\n') : (q.ex || ''),
        lecture: q.lecture || '', year: q.year || '', prof: q.prof || '', note: q.note || '' });
      n++;
    }
  }
  save(); rerender(); toast(n ? n + '개를 넣었어요' : '넣을 수 있는 항목이 없어요');
}
