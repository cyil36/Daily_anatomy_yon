/* 넘겨보기: flip through photos with answers, no grading.
   Modes: 'show' = numbered markers + answer list, 'hide' = boxes masked, tap a box / list row to reveal. */
let VIEW = null;

function openViewer(items, start = 0, title = '넘겨보기') {
  items = items.filter(i => i && i.type === 'photo');
  if (!items.length) return toast('넘겨볼 사진이 없어요');
  let mode = 'show';
  try { mode = localStorage.getItem('anat-view-mode') || 'show'; } catch { }
  VIEW = { items, i: Math.min(start, items.length - 1), mode, open: new Set(), hl: null };
  const root = h('div', { class: 'viewer' });
  VIEW.root = root;
  VIEW.modal = modal(title, root, { full: true, onClose: () => { document.removeEventListener('keydown', viewKey); VIEW = null; rerender(); } });
  document.addEventListener('keydown', viewKey);
  drawView();
}

function viewGo(d) {
  const v = VIEW; if (!v) return;
  const n = v.i + d;
  if (n < 0 || n >= v.items.length) return toast(n < 0 ? '첫 사진이에요' : '마지막 사진이에요');
  v.i = n; v.open = new Set(); v.hl = null; drawView();
}
function viewMode(m) {
  VIEW.mode = m; VIEW.open = new Set();
  try { localStorage.setItem('anat-view-mode', m); } catch { }
  drawView();
}

async function drawView() {
  const v = VIEW; if (!v) return;
  const it = v.items[v.i];
  const labels = it.labels.filter(l => (l.answer || '').trim());
  const root = v.root; root.innerHTML = '';
  const where = folderPath(it.folder).map(f => f.name).slice(-2).join(' › ');

  root.append(h('div', { class: 'view-top' },
    h('span', { class: 'qcount' }, `${v.i + 1} / ${v.items.length}`),
    h('div', { class: 'grow view-title' }, h('b', null, itemTitle(it)), where ? h('span', { class: 'muted sm' }, ' · ' + where) : null),
    h('div', { class: 'seg' },
      h('button', { class: v.mode === 'show' ? 'on' : '', onclick: () => viewMode('show') }, '정답 보기'),
      h('button', { class: v.mode === 'hide' ? 'on' : '', onclick: () => viewMode('hide') }, '가리고 떠올리기')),
    h('button', { class: 'btn ghost xs', onclick: () => { const id = it.id; VIEW.modal.close(); openEditor(id); } }, '고치기')));

  const img = h('img', { class: 'stage-img', alt: '', draggable: 'false' });
  img.src = await imgURL(it.img);
  if (VIEW !== v || v.items[v.i] !== it) return;
  const ov = h('div', { class: 'stage-ov' });
  labels.forEach((l, li) => l.boxes.forEach(b => {
    const shown = v.mode === 'show' || v.open.has(l.id);
    ov.append(h('div', {
      class: 'vbox' + (shown ? ' shown' : '') + (v.hl === l.id ? ' hl' : ''),
      style: { left: b[0] * 100 + '%', top: b[1] * 100 + '%', width: b[2] * 100 + '%', height: b[3] * 100 + '%' },
      onclick: e => { e.stopPropagation(); toggleLabel(l.id); }
    }, h('span', { class: 'vnum' }, li + 1)));
  }));
  const stage = h('div', { class: 'stage' }, img, ov);
  if (it.w && it.h) stage.style.maxWidth = `min(900px, calc(62vh * ${(it.w / it.h).toFixed(4)}))`;

  const list = h('div', { class: 'vlist' }, labels.map((l, li) => {
    const shown = v.mode === 'show' || v.open.has(l.id);
    return h('button', { class: 'vrow' + (v.hl === l.id ? ' hl' : '') + (shown ? '' : ' hidden'), onclick: () => toggleLabel(l.id) },
      h('span', { class: 'vnum big' }, li + 1), h('span', null, shown ? l.answer : '눌러서 보기'));
  }));
  if (!labels.length) list.append(h('div', { class: 'muted sm' }, '이 사진에는 아직 정답이 없어요. ‘고치기’에서 상자를 그려 주세요.'));

  root.append(h('div', { class: 'view-main' }, stage, list));
  root.append(h('div', { class: 'navrow view-nav' },
    h('button', { class: 'btn ghost', disabled: v.i === 0, onclick: () => viewGo(-1) }, '◀ 이전'),
    h('span', { class: 'muted xs keyhint' }, '← → 넘기기 · Space 가리기/보기 · 사진을 누르면 크게'),
    h('button', { class: 'btn ghost', disabled: v.i === v.items.length - 1, onclick: () => viewGo(1) }, '다음 ▶')));
  stage.addEventListener('click', () => zoomStage(stage));
  // swipe
  let sx = null;
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 60) viewGo(dx < 0 ? 1 : -1);
  });
}

function toggleLabel(id) {
  const v = VIEW;
  if (v.mode === 'hide') { v.open.has(id) ? v.open.delete(id) : v.open.add(id); }
  v.hl = v.hl === id && v.mode === 'show' ? null : id;
  drawView();
}

function viewKey(e) {
  if (!VIEW || _modals[_modals.length - 1] !== VIEW.modal) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  const k = S.settings.keys;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === k.prev || key === 'ArrowLeft') { e.preventDefault(); viewGo(-1); }
  else if (key === k.next || key === 'ArrowRight') { e.preventDefault(); viewGo(1); }
  else if (key === ' ' || key === k.reveal) {
    e.preventDefault();
    const it = VIEW.items[VIEW.i];
    if (VIEW.mode === 'hide') {
      const ls = it.labels.filter(l => (l.answer || '').trim());
      const next = ls.find(l => !VIEW.open.has(l.id));
      if (next) { VIEW.open.add(next.id); VIEW.hl = next.id; drawView(); } else viewGo(1);
    } else viewMode('hide');
  }
}

/* entry helpers */
function viewFolder(fid) {
  const items = folderDescItems(fid).filter(i => i.type === 'photo')
    .sort((a, b) => (a.created || 0) - (b.created || 0));
  const f = S.folders.find(x => x.id === fid);
  openViewer(items, 0, (f ? f.name : '전체 자료') + ' · 넘겨보기');
}
function viewDeck(d) {
  const seen = new Set(), items = [];
  for (const q of d.qs) { const id = q.split('#')[0]; if (!seen.has(id)) { seen.add(id); items.push(S.items[id]); } }
  openViewer(items, 0, d.name + ' · 넘겨보기');
}
