/* Small DOM + dialog helpers */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// **bold** and line breaks
const rich = s => esc(s).replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

let _toastT;
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.remove('show'), ms);
}

const _modals = [];
function modal(title, body, { wide = false, full = false, fit = false, onClose } = {}) {
  const box = h('div', { class: 'modal' + (wide ? ' wide' : '') + (full ? ' full' : '') },
    h('div', { class: 'modal-head' }, h('div', { class: 'modal-title' }, title),
      h('button', { class: 'icon-btn', 'aria-label': '닫기', onclick: () => close() }, '✕')),
    h('div', { class: 'modal-body' + (fit ? ' fit' : '') }, body));
  const back = h('div', { class: 'backdrop', onclick: e => { if (e.target === back && !full) close(); } }, box);
  $('#modal-root').append(back);
  const m = { el: box, close };
  _modals.push(m);
  function close() {
    back.remove();
    const i = _modals.indexOf(m); if (i >= 0) _modals.splice(i, 1);
    onClose && onClose();
  }
  return m;
}
function topModalOpen() { return _modals.length > 0; }
function closeTopModal() { const m = _modals[_modals.length - 1]; m && m.close(); }

function confirmBox(msg, okText = '확인', danger = false) {
  return new Promise(res => {
    let done = false;
    const m = modal('확인', h('div', null,
      h('p', { class: 'pre' }, msg),
      h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: () => { done = true; m.close(); res(false); } }, '취소'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { done = true; m.close(); res(true); } }, okText))),
      { onClose: () => { if (!done) res(false); } });
  });
}
function promptBox(title, value = '', placeholder = '') {
  return new Promise(res => {
    let done = false;
    const inp = h('input', { class: 'input', value, placeholder });
    const ok = () => { done = true; m.close(); res(inp.value.trim()); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    const m = modal(title, h('div', null, inp,
      h('div', { class: 'row end' },
        h('button', { class: 'btn ghost', onclick: () => { done = true; m.close(); res(null); } }, '취소'),
        h('button', { class: 'btn primary', onclick: ok }, '확인'))),
      { onClose: () => { if (!done) res(null); } });
    setTimeout(() => inp.focus(), 30);
  });
}
function menu(anchor, items) {
  document.querySelectorAll('.popmenu').forEach(x => x.remove());
  const r = anchor.getBoundingClientRect();
  const m = h('div', { class: 'popmenu' }, items.filter(Boolean).map(([label, fn, cls]) =>
    h('button', { class: cls || '', onclick: e => { e.stopPropagation(); m.remove(); fn(); } }, label)));
  document.body.append(m);
  const mw = m.offsetWidth;
  m.style.top = (r.bottom + window.scrollY + 4) + 'px';
  m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + 'px';
  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
}
function pickFile(accept, multiple = false) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, multiple, style: 'display:none' });
    i.onchange = () => { res([...i.files]); i.remove(); };
    document.body.append(i); i.click();
  });
}
function progressBar(right, wrong, total) {
  const p = v => total ? (v / total * 100) + '%' : '0';
  return h('div', { class: 'pbar' },
    h('span', { class: 'ok', style: { width: p(right) } }),
    h('span', { class: 'no', style: { width: p(wrong) } }));
}

/* ---------- cheer mascot (original SVG character) ---------- */
const CHEER_LINES = {
  hi: ['오늘도 같이 해 보자!', '왔구나! 시작해 볼까?', '천천히, 하나씩!'],
  happy: ['정답!', '좋아!', '바로 그거야!', '맞혔다!'],
  great: ['연속 정답! 대단해!', '멈출 수가 없네!', '완전 불붙었어!'],
  sad: ['괜찮아, 다음엔 맞힐 거야', '틀린 건 더 오래 기억나!', '실수도 공부야'],
  fight: ['반 왔어! 조금만 더!', '마지막 한 문제!', '거의 다 왔어!'],
  party: ['다 풀었어! 수고했어!', '끝까지 푼 게 대단해!', '짝짝짝!']
};
function mascotSVG(mood, char) {
  const body = char === 'heart'
    ? '<path d="M50 88 C10 60 8 30 28 22 C40 17 48 26 50 32 C52 26 60 17 72 22 C92 30 90 60 50 88Z" fill="#f87171"/>'
    : '<rect x="38" y="16" width="24" height="68" rx="12" fill="#fef3c7" stroke="#d6a74a" stroke-width="3"/><circle cx="36" cy="18" r="11" fill="#fef3c7" stroke="#d6a74a" stroke-width="3"/><circle cx="64" cy="18" r="11" fill="#fef3c7" stroke="#d6a74a" stroke-width="3"/><circle cx="36" cy="82" r="11" fill="#fef3c7" stroke="#d6a74a" stroke-width="3"/><circle cx="64" cy="82" r="11" fill="#fef3c7" stroke="#d6a74a" stroke-width="3"/><rect x="40" y="20" width="20" height="60" fill="#fef3c7"/>';
  const eyes = mood === 'sad'
    ? '<path d="M41 46 l6 3 M59 46 l-6 3" stroke="#333" stroke-width="3" stroke-linecap="round"/>'
    : mood === 'great' || mood === 'party'
      ? '<path d="M40 48 q4 -6 8 0 M52 48 q4 -6 8 0" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>'
      : '<circle cx="44" cy="47" r="3.2" fill="#333"/><circle cx="56" cy="47" r="3.2" fill="#333"/>';
  const mouth = mood === 'sad'
    ? '<path d="M44 62 q6 -5 12 0" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>'
    : mood === 'fight'
      ? '<path d="M44 58 h12" stroke="#333" stroke-width="3" stroke-linecap="round"/>'
      : '<path d="M43 57 q7 8 14 0" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/>';
  const extra = mood === 'party' ? '<text x="78" y="26" font-size="18">🎉</text>' : mood === 'great' ? '<text x="78" y="26" font-size="18">✨</text>' : '';
  return `<svg viewBox="0 0 100 100" width="64" height="64">${body}<circle cx="38" cy="54" r="3" fill="#fca5a5" opacity=".7"/><circle cx="62" cy="54" r="3" fill="#fca5a5" opacity=".7"/>${eyes}${mouth}${extra}</svg>`;
}
let _cheerT;
function cheer(mood) {
  if (!S.settings.cheer) return;
  const lines = CHEER_LINES[mood] || CHEER_LINES.happy;
  const el = $('#cheer');
  el.innerHTML = mascotSVG(mood, S.settings.char) + `<div class="bubble">${esc(lines[Math.floor(Math.random() * lines.length)])}</div>`;
  el.classList.remove('hidden');
  clearTimeout(_cheerT); _cheerT = setTimeout(() => el.classList.add('hidden'), 1600);
}

/* In-place zoom for a photo stage: wheel / pinch / double-tap to zoom, drag to pan.
   The stage is fitted inside the pane; zoom state survives redraws with the same key. */
const ZOOM_MEM = { key: null, z: 1, x: 0, y: 0 };
function zoomPane(stage, key, { aspect, onSwipe } = {}) {
  if (ZOOM_MEM.key !== key) Object.assign(ZOOM_MEM, { key, z: 1, x: 0, y: 0 });
  const mem = ZOOM_MEM;
  const pane = h('div', { class: 'zpane' });
  const btn = (txt, title, fn) => h('button', { title, onclick: e => { e.stopPropagation(); fn(); } }, txt);
  const ctl = h('div', { class: 'zctl' },
    btn('－', '축소', () => zoomAt(mem.z / 1.5)),
    btn('＋', '확대', () => zoomAt(mem.z * 1.5)),
    btn('⟲', '원래 크기', () => zoomAt(1)));
  stage.classList.add('zstage');
  pane.append(stage, ctl);
  const img = stage.querySelector('img');
  let pw = 0, ph = 0, sw = 0, sh = 0;
  function measure() {
    pw = pane.clientWidth; ph = pane.clientHeight;
    if (!pw || !ph) return false;
    const a = aspect || (img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : 1.4);
    sw = Math.min(pw, ph * a); sh = sw / a;
    stage.style.width = sw + 'px'; stage.style.height = sh + 'px';
    return true;
  }
  function fit() { if (measure()) apply(); }
  function apply() {
    if (!sw && !measure()) return;
    const mx = Math.max(0, (sw * mem.z - pw) / 2), my = Math.max(0, (sh * mem.z - ph) / 2);
    mem.x = Math.max(-mx, Math.min(mx, mem.x)); mem.y = Math.max(-my, Math.min(my, mem.y));
    stage.style.transform = `translate(${mem.x}px, ${mem.y}px) scale(${mem.z})`;
    pane.classList.toggle('zoomed', mem.z > 1.01);
  }
  function zoomAt(z, cx = 0, cy = 0) { // cx, cy: offset from the pane centre
    z = Math.max(1, Math.min(6, z));
    const px = (cx - mem.x) / mem.z, py = (cy - mem.y) / mem.z;
    mem.z = z; mem.x = cx - z * px; mem.y = cy - z * py;
    if (z === 1) { mem.x = 0; mem.y = 0; }
    apply();
  }
  const rel = (x, y) => { const r = pane.getBoundingClientRect(); return [x - r.left - r.width / 2, y - r.top - r.height / 2]; };
  new ResizeObserver(fit).observe(pane);
  if (img && !aspect) img.addEventListener('load', fit);

  pane.addEventListener('wheel', e => {
    e.preventDefault();
    const [x, y] = rel(e.clientX, e.clientY);
    zoomAt(mem.z * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : e.ctrlKey ? 0.01 : 0.0018)), x, y);
  }, { passive: false });

  const pts = new Map();
  let start = null, moved = false, pinch = null, pinched = false, eat = false, lastTap = null;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  pane.addEventListener('pointerdown', e => {
    if (e.target.closest('.zctl') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { start = { x: e.clientX, y: e.clientY, t: Date.now(), mx: mem.x, my: mem.y }; moved = false; pinched = false; }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: dist(a, b) || 1, z: mem.z, mid: mid(a, b), mx: mem.x, my: mem.y };
      moved = pinched = true;
      for (const id of pts.keys()) try { pane.setPointerCapture(id); } catch { }
    }
  });
  pane.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2 && pinch) {
      const [a, b] = [...pts.values()], m = mid(a, b);
      const [cx, cy] = rel(pinch.mid.x, pinch.mid.y);
      mem.z = pinch.z; mem.x = pinch.mx; mem.y = pinch.my;
      zoomAt(pinch.z * dist(a, b) / pinch.d, cx, cy);
      mem.x += m.x - pinch.mid.x; mem.y += m.y - pinch.mid.y; apply();
    } else if (pts.size === 1 && start) {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) > 6) { moved = true; try { pane.setPointerCapture(e.pointerId); } catch { } }
      if (moved && mem.z > 1.01) { mem.x = start.mx + dx; mem.y = start.my + dy; apply(); }
    }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 1) { // one finger left after a pinch: keep panning from there
      const [p] = [...pts.values()]; pinch = null;
      start = { x: p.x, y: p.y, t: Date.now(), mx: mem.x, my: mem.y };
      return;
    }
    if (pts.size || !start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && e.type === 'pointerup') {
      const now = Date.now();
      if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        const [x, y] = rel(e.clientX, e.clientY);
        mem.z > 1.01 ? zoomAt(1) : zoomAt(2.5, x, y);
        eat = true; lastTap = null;
      } else lastTap = { t: now, x: e.clientX, y: e.clientY };
    } else if (moved && !pinched && mem.z <= 1.01 && onSwipe && Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy) && Date.now() - start.t < 800) {
      onSwipe(dx < 0 ? 1 : -1);
    }
    start = null; pinch = null;
  };
  pane.addEventListener('pointerup', up);
  pane.addEventListener('pointercancel', up);
  pane.addEventListener('click', e => { if (e.target.closest('.zctl')) return; if (moved || eat) { e.stopPropagation(); e.preventDefault(); eat = false; } }, true);
  return pane;
}
