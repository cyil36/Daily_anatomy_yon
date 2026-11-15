/* Solving screen for every deck type */
let SESS = null;
const norm = s => String(s || '').toLowerCase().replace(/[\s\-_.,·'’()]/g, '');
function answerVariants(a) {
  const v = new Set([norm(a), norm(a.replace(/\([^)]*\)/g, ''))]);
  a.split(/\s*[\/;]\s*/).forEach(x => x && v.add(norm(x)));
  v.delete('');
  return v;
}

function startMenu(d) {
  syncQs(d);
  const st = deckStats(d);
  if (!st.n) return toast('문제가 없어요. ··· › 설정 바꾸기에서 자료를 넣어 주세요');
  const wrong = d.qs.filter(q => d.rec[q] === -1);
  const unsolved = d.qs.filter(q => !d.rec[q]);
  const opt = (label, sub, fn, dis) => h('button', { class: 'start-opt', disabled: dis, onclick: () => { m.close(); fn(); } }, h('b', null, label), h('span', { class: 'muted sm' }, sub));
  const canResume = d.pos > 0 && d.pos < d.qs.length && d.order !== 'random';
  const m = modal(d.name, h('div', { class: 'start-menu' },
    progressBar(st.r, st.w, st.n),
    h('p', { class: 'muted sm' }, `${st.n}문제 · 맞음 ${st.r} · 틀림 ${st.w} · 안 푼 문제 ${st.u}`),
    canResume ? opt(`지난번 하던 곳부터 (${d.pos + 1}번 문제)`, '이어서 풀어요', () => runSession(d, d.qs, 'all', d.pos)) : null,
    opt('전체 풀기', `${st.n}문제` + (d.order === 'random' ? ' · 랜덤 순서' : ''), () => runSession(d, d.qs, 'all', 0)),
    opt('안 푼 문제만 풀기', unsolved.length ? `${unsolved.length}문제` : '안 푼 문제가 없어요', () => runSession(d, unsolved, 'unsolved', 0), !unsolved.length),
    opt('틀린 문제만 풀기', wrong.length ? `${wrong.length}문제 · 다시 맞히면 ✓로 바뀌어요` : '틀린 문제가 없어요', () => runSession(d, wrong, 'wrong', 0), !wrong.length),
    itemTypeFor(d.type) === 'photo' ? opt('넘겨보기 (채점 없이)', '사진과 정답을 보면서 ◀ ▶로 넘겨요. 기록은 남지 않아요.', () => viewDeck(d)) : null,
    h('div', { class: 'row between' },
      h('button', { class: 'btn ghost sm', onclick: () => { m.close(); openQList(d); } }, '문제 목록'),
      h('button', { class: 'btn ghost sm', onclick: async () => { m.close(); if (await confirmBox(`‘${d.name}’의 기록을 모두 지우고 처음부터 다시 풀까요?`, '초기화', true)) { d.rec = {}; d.pos = 0; if (d.sample) syncQs(d, true); save(); rerender(); startMenu(d); } } }, '기록 지우고 처음부터'))));
}

function runSession(d, qs, mode, startAt, keepOrder) {
  let list = qs.slice();
  if (d.order === 'random' && !startAt && !keepOrder) list = shuffle(list);
  SESS = { d, list, mode, i: startAt || 0, run: {}, picked: new Set(), choices: {}, typed: {}, blanks: new Set(), revealed: false, showEx: false, streak: 0, t0: Date.now(), timer: null, tLeft: 0, half: false, quarter: false };
  const root = h('div', { class: 'sess' });
  SESS.root = root;
  SESS.modal = modal(h('span', { class: 'sess-title' }, d.name), root, { full: true, onClose: endSession });
  document.addEventListener('keydown', sessKey);
  cheer('hi');
  drawQ();
}
function endSession() {
  document.removeEventListener('keydown', sessKey);
  if (SESS) clearInterval(SESS.timer);
  SESS = null; save(); rerender();
}

const isAuto = d => d.kind === 'quiz' || d.type === 'jokbo';
function curQ() { return SESS.list[SESS.i]; }

function record(v) {
  const q = curQ(), d = SESS.d;
  if (SESS.run[q] !== undefined && d.kind === 'quiz') return;
  const first = SESS.run[q] === undefined;
  SESS.run[q] = v; d.rec[q] = v;
  if (first) { S.log[today()] = (S.log[today()] || 0) + 1; }
  if (SESS.mode === 'all' && d.order !== 'random') d.pos = Math.min(SESS.i + 1, SESS.list.length);
  clearInterval(SESS.timer);
  save();
  const done = Object.keys(SESS.run).length, n = SESS.list.length;
  if (v === 1) {
    SESS.streak++;
    if (SESS.streak >= 3 && SESS.streak % 3 === 0) cheer('great');
    else if (Math.random() < 0.3) cheer('happy');
  } else { SESS.streak = 0; if (Math.random() < 0.5) cheer('sad'); }
  if (!SESS.half && n >= 6 && done >= n / 2 && done < n) { SESS.half = true; setTimeout(() => cheer('fight'), 700); }
  if (n > 3 && done === n - 1) setTimeout(() => cheer('fight'), 700);
}
function go(delta) {
  const n = SESS.list.length;
  const ni = SESS.i + delta;
  if (ni < 0) return;
  if (ni >= n) return showResult();
  SESS.i = ni;
  SESS.revealed = false; SESS.picked = new Set(); SESS.blanks = new Set(); SESS.showEx = false;
  drawQ();
}
function next() { go(1); }

/* ---------- drawing ---------- */
async function drawQ() {
  const s = SESS; if (!s) return;
  clearInterval(s.timer);
  const q = curQ();
  const r = resolveQ(q);
  const root = s.root;
  root.innerHTML = '';
  if (!r) { next(); return; }
  const d = s.d;
  const answered = s.run[q] !== undefined;

  // gauge
  const gauge = h('div', { class: 'gauge' }, s.list.map((qq, i) => h('span', {
    class: (s.run[qq] === 1 || (s.run[qq] === undefined && d.rec[qq] === 1 && s.mode === 'all') ? 'ok' : (s.run[qq] === -1 || (s.run[qq] === undefined && d.rec[qq] === -1 && s.mode === 'all')) ? 'no' : '') + (i === s.i ? ' cur' : ''),
    title: (i + 1) + '번', onclick: () => go(i - s.i)
  })));
  const timerEl = h('span', { class: 'timer' });
  const here = itemTitle(r.item);
  const where = folderPath(r.item.folder).map(f => f.name).slice(-2).join(' › ');
  root.append(h('div', { class: 'sess-top' },
    h('span', { class: 'qcount' }, `${s.i + 1} / ${s.list.length}`), gauge, timerEl,
    h('button', { class: 'btn ghost xs', title: '문제 목록에서 원하는 위치로 이동', onclick: () => openQList(s.d, {
      list: s.list, current: s.i, run: s.run, inSession: true,
      onPick: i => { closeTopModal(); go(i - s.i); }
    }) }, '☰ 목록')));
  root.append(h('div', { class: 'sess-where muted sm' }, [here, where].filter(Boolean).join(' · ')));

  const main = h('div', { class: 'sess-main' });
  const foot = h('div', { class: 'sess-foot' });
  root.append(main, foot);

  const t = d.type;
  if (t === 'photo') await drawPhotoStudy(r, main, foot, answered);
  else if (t === 'mcq' || t === 'rtype') await drawPhotoChoice(r, main, foot, answered);
  else if (t === 'typed') await drawPhotoTyped(r, main, foot, answered);
  else if (t === 'cloze') drawCloze(r, main, foot, answered);
  else if (t === 'jokbo') await drawJokbo(r, main, foot, answered);

  foot.append(h('div', { class: 'navrow' },
    h('button', { class: 'btn ghost', disabled: s.i === 0, onclick: () => go(-1) }, '◀ 이전'),
    h('span', { class: 'muted xs keyhint' }, keyHint()),
    h('button', { class: 'btn ghost', onclick: () => next() }, s.i === s.list.length - 1 ? '결과 ▶' : '다음 ▶')));

  // timer
  if (d.time && !answered && !s.revealed) {
    s.tLeft = d.time;
    timerEl.textContent = s.tLeft + '초';
    s.timer = setInterval(() => {
      s.tLeft--; timerEl.textContent = s.tLeft + '초';
      timerEl.classList.toggle('low', s.tLeft <= 3);
      if (s.tLeft <= 0) { clearInterval(s.timer); timeUp(); }
    }, 1000);
  }
}
function keyHint() {
  const k = S.settings.keys; const n = x => x === ' ' ? 'Space' : x.replace('Arrow', '');
  const t = SESS.d.type;
  if (t === 'photo' || t === 'cloze') return `${n(k.reveal)} 정답 · ${n(k.wrong).toUpperCase()} 틀림 · ${n(k.right).toUpperCase()} 맞음 · ${n(k.prev)}/${n(k.next)} 이동`;
  if (t === 'typed') return `Enter 제출 · ${n(k.next)} 다음`;
  return `숫자 키로 고르기 · ${n(k.expl).toUpperCase()} 해설 · ${n(k.prev)}/${n(k.next)} 이동`;
}
function timeUp() {
  const s = SESS; if (!s) return;
  const t = s.d.type;
  if (t === 'photo' || t === 'cloze' || (t === 'jokbo' && !resolveQ(curQ()).item.choices.length)) {
    s.revealed = true; if (t === 'cloze') { const it = resolveQ(curQ()).item; (it.text.match(/\[\[.+?\]\]/g) || []).forEach((_, i) => s.blanks.add(i)); }
    toast('시간 초과! 정답을 확인하고 ✕ / ✓를 기록해 주세요'); drawQ();
  } else {
    toast('시간 초과!'); record(-1); drawQ();
  }
}

async function photoStage(item, label, revealed) {
  const img = h('img', { class: 'stage-img', alt: '', draggable: 'false' });
  img.src = await imgURL(item.img);
  const ov = h('div', { class: 'stage-ov' });
  for (const l of item.labels) for (const b of l.boxes) {
    const cur = label && l.id === label.id;
    ov.append(h('div', {
      class: 'qbox' + (cur ? ' cur' : '') + (cur && revealed ? ' open' : ''),
      style: { left: b[0] * 100 + '%', top: b[1] * 100 + '%', width: b[2] * 100 + '%', height: b[3] * 100 + '%' }
    }));
  }
  const st = h('div', { class: 'stage' }, img, ov);
  const vh = SESS && SESS.d.type === 'photo' ? 56 : SESS && SESS.d.type === 'rtype' ? 36 : 44;
  if (item.w && item.h) st.style.maxWidth = `min(760px, calc(${vh}vh * ${(item.w / item.h).toFixed(4)}))`;
  st.addEventListener('click', () => zoomStage(st));
  return st;
}
function zoomStage(st) {
  const c = st.cloneNode(true); c.classList.add('zoomed'); c.style.maxWidth = 'none';
  let z = 1;
  const wrap = h('div', { class: 'zoom-wrap' }, c);
  const setZ = v => { z = Math.max(1, Math.min(4, v)); c.style.width = (z * 100) + '%'; };
  modal(h('div', { class: 'row gap' }, '크게 보기',
    h('button', { class: 'btn ghost xs', onclick: () => setZ(z - 0.5) }, '－'),
    h('button', { class: 'btn ghost xs', onclick: () => setZ(z + 0.5) }, '＋')), wrap, { full: true });
  c.addEventListener('dblclick', () => setZ(z >= 2 ? 1 : 2.5));
}
function selfGradeRow(answered) {
  const v = SESS.run[curQ()];
  return h('div', { class: 'grade-row' },
    h('button', { class: 'btn big no' + (v === -1 ? ' on' : ''), onclick: () => grade(-1) }, '✕ 모름'),
    h('button', { class: 'btn big ok' + (v === 1 ? ' on' : ''), onclick: () => grade(1) }, '✓ 앎'));
}
function grade(v) {
  if (!SESS.revealed && SESS.d.type !== 'cloze') { SESS.revealed = true; }
  record(v);
  next();
}

async function drawPhotoStudy(r, main, foot, answered) {
  const s = SESS;
  const rev = s.revealed || answered;
  main.append(h('p', { class: 'muted sm center' }, r.label.boxes.length ? '빨간 상자의 이름을 떠올린 뒤 [정답 확인]을 눌러요.' : '사진 속 ? 의 이름을 떠올린 뒤 [정답 확인]을 눌러요.'),
    await photoStage(r.item, r.label, rev));
  main.append(h('div', { class: 'answer' + (rev ? ' show' : '') }, rev ? r.label.answer : ' '));
  if (!rev) foot.append(h('button', { class: 'btn big primary wide', onclick: () => { s.revealed = true; drawQ(); } }, '정답 확인'));
  else foot.append(selfGradeRow(answered));
}

function buildChoices(r) {
  const s = SESS, q = curQ();
  if (s.choices[q]) return s.choices[q];
  let opts;
  if (s.d.type === 'rtype') {
    opts = [...new Set(r.item.labels.map(l => (l.answer || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  } else {
    const ans = r.label.answer.trim();
    const used = new Set([norm(ans)]);
    const pick = [];
    for (const w of shuffle(r.label.wrong || [])) { if (pick.length < 3 && !used.has(norm(w))) { pick.push(w); used.add(norm(w)); } }
    const sibling = r.item.labels.map(l => l.answer);
    const pool = shuffle([...new Set(s.d.qs.map(qq => { const x = resolveQ(qq); return x && x.label ? x.label.answer.trim() : null; }).filter(Boolean))]);
    for (const w of [...shuffle(sibling), ...pool]) { if (pick.length >= 3) break; if (w && !used.has(norm(w))) { pick.push(w.trim()); used.add(norm(w)); } }
    opts = shuffle([ans, ...pick]);
  }
  return (s.choices[q] = opts);
}
async function drawPhotoChoice(r, main, foot, answered) {
  const s = SESS, q = curQ();
  const opts = buildChoices(r);
  const ans = r.label.answer.trim();
  main.append(h('p', { class: 'muted sm center' }, s.d.type === 'rtype' ? '빨간 상자의 이름을 번호 목록에서 골라요.' : '빨간 상자의 이름을 골라요.'),
    await photoStage(r.item, r.label, answered));
  const picked = s.typed[q];
  const box = h('div', { class: s.d.type === 'rtype' ? 'choices rlist' : 'choices' });
  opts.forEach((o, i) => {
    const isAns = norm(o) === norm(ans);
    let cls = 'choice';
    if (answered) { if (isAns) cls += ' right'; else if (picked === i) cls += ' wrong'; }
    box.append(h('button', { class: cls, disabled: answered, onclick: () => pickChoice(i) }, h('span', { class: 'cn' }, i + 1), o));
  });
  main.append(box);
  if (answered) main.append(h('div', { class: 'answer show ' + (s.run[q] === 1 ? 'okc' : 'noc') }, s.run[q] === 1 ? '정답!' : '정답: ' + ans));
}
function pickChoice(i) {
  const s = SESS, q = curQ(); if (s.run[q] !== undefined) return;
  const r = resolveQ(q);
  const t = s.d.type;
  if (t === 'jokbo') return pickJokbo(i);
  const opts = s.choices[q];
  if (!opts || i >= opts.length) return;
  s.typed[q] = i;
  const ok = norm(opts[i]) === norm(r.label.answer);
  record(ok ? 1 : -1);
  drawQ();
  if (ok && S.settings.autoNext) setTimeout(() => { if (SESS && curQ() === q) next(); }, 700);
}

async function drawPhotoTyped(r, main, foot, answered) {
  const s = SESS, q = curQ();
  main.append(h('p', { class: 'muted sm center' }, '빨간 상자의 이름을 입력해요. 대소문자·띄어쓰기는 상관없어요.'),
    await photoStage(r.item, r.label, answered));
  const inp = h('input', { class: 'input big', placeholder: '정답을 입력하세요', value: s.typed[q] || '', disabled: answered, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const submit = () => {
    if (s.run[q] !== undefined) return next();
    const v = inp.value.trim(); if (!v) return toast('정답을 입력해 주세요');
    s.typed[q] = v;
    const ok = answerVariants(r.label.answer).has(norm(v));
    record(ok ? 1 : -1); drawQ();
    if (ok && S.settings.autoNext) setTimeout(() => { if (SESS && curQ() === q) next(); }, 700);
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); } });
  main.append(h('div', { class: 'row gap typed' }, inp, h('button', { class: 'btn primary', onclick: submit }, answered ? '다음' : '제출')));
  if (answered) {
    main.append(h('div', { class: 'answer show ' + (s.run[q] === 1 ? 'okc' : 'noc') }, s.run[q] === 1 ? '정답! ' + r.label.answer : '정답: ' + r.label.answer));
    if (s.run[q] === -1) main.append(h('div', { class: 'center' }, h('button', { class: 'btn ghost xs', onclick: () => { s.run[q] = 1; s.d.rec[q] = 1; save(); drawQ(); } }, '오타였어요 · 맞음으로 바꾸기')));
    setTimeout(() => { const b = main.querySelector('.typed .btn'); b && b.focus(); }, 30);
  } else setTimeout(() => inp.focus(), 30);
}

function drawCloze(r, main, foot, answered) {
  const s = SESS;
  const n = (r.item.text.match(/\[\[.+?\]\]/g) || []).length;
  if (answered && s.blanks.size < n) for (let i = 0; i < n; i++) s.blanks.add(i);
  const card = h('div', { class: 'cloze-card', html: clozeHTML(r.item.text, false, s.blanks) });
  card.addEventListener('click', e => {
    const b = e.target.closest('.blank'); if (!b) return;
    const i = +b.dataset.b; s.blanks.has(i) ? s.blanks.delete(i) : s.blanks.add(i);
    s.revealed = s.blanks.size === n; drawQ();
  });
  if (r.item.lecture) main.append(h('div', { class: 'muted sm center' }, r.item.lecture));
  main.append(card);
  foot.append(h('div', { class: 'row center gap wrap' },
    h('button', { class: 'btn ghost sm', onclick: () => revealNextBlank() }, '빈칸 하나 열기'),
    h('button', { class: 'btn ghost sm', onclick: () => { for (let i = 0; i < n; i++) s.blanks.add(i); s.revealed = true; drawQ(); } }, '빈칸 전부 보기'),
    h('button', { class: 'btn ghost sm', disabled: !s.blanks.size, onclick: () => { const last = [...s.blanks].pop(); s.blanks.delete(last); s.revealed = false; drawQ(); } }, '하나 다시 덮기')));
  foot.append(selfGradeRow(answered));
}
function revealNextBlank() {
  const s = SESS; const it = resolveQ(curQ()).item;
  const n = (it.text.match(/\[\[.+?\]\]/g) || []).length;
  for (let i = 0; i < n; i++) if (!s.blanks.has(i)) { s.blanks.add(i); break; }
  s.revealed = s.blanks.size === n; drawQ();
}

const CIRC = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
async function drawJokbo(r, main, foot, answered) {
  const s = SESS, q = curQ(), it = r.item;
  const meta = [it.lecture, it.year ? (it.year > 0 ? it.year + '년' : it.year) : '', it.prof ? it.prof + ' 교수님' : ''].filter(Boolean).join(' · ');
  main.append(h('div', { class: 'jk' },
    meta ? h('div', { class: 'muted sm' }, meta) : null,
    it.note ? h('div', { class: 'jk-note' }, it.note) : null,
    h('div', { class: 'jk-stem', html: rich(it.stem) }),
    it.data ? h('div', { class: 'jk-data', html: rich(it.data) }) : null));
  for (const im of it.imgs || []) {
    const u = await imgURL(im);
    if (u) { const st = h('div', { class: 'stage' }, h('img', { class: 'stage-img', src: u })); st.onclick = () => zoomStage(st); main.append(st); }
  }
  const multi = (it.answers || []).length > 1;
  if (it.choices && it.choices.length) {
    if (multi && !answered) main.append(h('div', { class: 'muted sm' }, `${it.answers.length}개를 모두 고르세요`));
    const picked = answered ? (s.typed[q] || []) : [...s.picked];
    const box = h('div', { class: 'choices' });
    it.choices.forEach((c, i) => {
      const n = i + 1; let cls = 'choice';
      if (answered) { if (it.answers.includes(n)) cls += ' right'; else if (picked.includes(n)) cls += ' wrong'; }
      else if (picked.includes(n)) cls += ' picked';
      box.append(h('button', { class: cls, disabled: answered, onclick: () => pickJokbo(i) }, h('span', { class: 'cn' }, CIRC[i] || n), c));
    });
    main.append(box);
    if (multi && !answered) foot.append(h('button', { class: 'btn big primary wide', onclick: submitJokbo }, '제출'));
  } else {
    const rev = s.revealed || answered;
    if (rev) main.append(h('div', { class: 'answer show' }, it.atext || '해설 참조'));
    if (!rev) foot.append(h('button', { class: 'btn big primary wide', onclick: () => { s.revealed = true; drawQ(); } }, '정답 확인'));
    else foot.append(selfGradeRow(answered));
  }
  if (answered && it.choices && it.choices.length) main.append(h('div', { class: 'answer show ' + (s.run[q] === 1 ? 'okc' : 'noc') }, s.run[q] === 1 ? '정답!' : '정답: ' + it.answers.map(a => CIRC[a - 1]).join(' ')));
  if (it.ex && (answered || s.revealed)) {
    main.append(h('button', { class: 'btn ghost sm', onclick: () => { s.showEx = !s.showEx; drawQ(); } }, s.showEx ? '해설 닫기 · W' : '해설 보기 · W'));
    if (s.showEx) main.append(h('div', { class: 'jk-ex', html: rich(it.ex) }));
  }
}
function pickJokbo(i) {
  const s = SESS, q = curQ(); if (s.run[q] !== undefined) return;
  const it = resolveQ(q).item; if (!it.choices || i >= it.choices.length) return;
  const n = i + 1;
  if ((it.answers || []).length > 1) { s.picked.has(n) ? s.picked.delete(n) : s.picked.add(n); drawQ(); return; }
  s.picked = new Set([n]); submitJokbo();
}
function submitJokbo() {
  const s = SESS, q = curQ(); const it = resolveQ(q).item;
  if (!s.picked.size) return toast('답을 골라 주세요');
  const p = [...s.picked].sort((a, b) => a - b);
  s.typed[q] = p;
  const ok = p.length === it.answers.length && p.every((x, i) => x === [...it.answers].sort((a, b) => a - b)[i]);
  record(ok ? 1 : -1);
  if (!ok && it.ex) s.showEx = true;
  drawQ();
  if (ok && S.settings.autoNext) setTimeout(() => { if (SESS && curQ() === q) next(); }, 900);
}

/* ---------- result ---------- */
function showResult() {
  const s = SESS; clearInterval(s.timer);
  const d = s.d;
  const vals = s.list.map(q => s.run[q]);
  const r = vals.filter(v => v === 1).length, w = vals.filter(v => v === -1).length, n = s.list.length;
  const ms = Date.now() - s.t0;
  if (r + w) { d.hist = d.hist || []; d.hist.push({ at: Date.now(), r, w, n, ms }); }
  if (s.mode === 'all' && d.order !== 'random' && r + w === n) d.pos = 0;
  save();
  cheer(r === n ? 'party' : r / Math.max(1, n) >= 0.7 ? 'great' : 'fight');
  const wrongQs = s.list.filter(q => s.run[q] === -1);
  const pct = n ? Math.round(r / n * 100) : 0;
  const root = s.root; root.innerHTML = '';
  const min = Math.floor(ms / 60000), sec = Math.round(ms / 1000) % 60;
  root.append(h('div', { class: 'result' },
    h('div', { class: 'big-score' }, pct + '%'),
    h('p', null, `${n}문제 중 ${r}개 맞힘 · 틀림 ${w} · 안 품 ${n - r - w}`),
    h('p', { class: 'muted sm' }, `걸린 시간 ${min ? min + '분 ' : ''}${sec}초`),
    progressBar(r, w, n),
    h('div', { class: 'row center gap wrap' },
      wrongQs.length ? h('button', { class: 'btn primary', onclick: () => { const dd = s.d; s.modal.close(); runSession(dd, wrongQs, 'wrong', 0); } }, `틀린 문제만 다시 (${wrongQs.length})`) : null,
      h('button', { class: 'btn ghost', onclick: () => { const dd = s.d, l = s.list, md = s.mode; s.modal.close(); runSession(dd, l, md, 0); } }, '한 번 더 풀기'),
      h('button', { class: 'btn ghost', onclick: () => s.modal.close() }, '목록으로')),
    wrongQs.length ? h('div', { class: 'wrong-list' }, h('h3', null, '틀린 문제'), wrongQs.map(q => {
      const x = resolveQ(q); if (!x) return null;
      const txt = x.label ? x.label.answer : x.item.type === 'jokbo' ? (x.item.stem || '').slice(0, 80) + ' → ' + (x.item.choices.length ? x.item.answers.map(a => x.item.choices[a - 1]).join(', ') : x.item.atext) : x.item.text.replace(/\[\[(.+?)\]\]/g, '【$1】');
      return h('div', { class: 'list-row' }, h('span', { class: 'qn no' }, '✕'), h('span', { class: 'grow' }, txt));
    })) : null));
}

/* ---------- keyboard ---------- */
function sessKey(e) {
  if (!SESS) return;
  if (_modals[_modals.length - 1] !== SESS.modal) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  const k = S.settings.keys, key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const s = SESS, t = s.d.type, q = curQ();
  if (!q) return;
  const answered = s.run[q] !== undefined;
  const hit = name => key === k[name];
  if (hit('prev')) { e.preventDefault(); return go(-1); }
  if (hit('next')) { e.preventDefault(); return next(); }
  if (t === 'photo' || t === 'cloze' || (t === 'jokbo' && !resolveQ(q).item.choices.length)) {
    if (hit('reveal')) { e.preventDefault(); if (t === 'cloze') revealNextBlank(); else if (!s.revealed) { s.revealed = true; drawQ(); } return; }
    if (hit('wrong') && (s.revealed || answered || t === 'cloze')) { e.preventDefault(); return grade(-1); }
    if (hit('right') && (s.revealed || answered || t === 'cloze')) { e.preventDefault(); return grade(1); }
  }
  if (hit('expl') && t === 'jokbo') { s.showEx = !s.showEx; return drawQ(); }
  if (/^[1-9]$/.test(e.key) && (t === 'mcq' || t === 'rtype' || t === 'jokbo')) { e.preventDefault(); return pickChoice(+e.key - 1); }
  if (e.key === 'Enter' && t === 'jokbo' && s.picked.size && !answered) { e.preventDefault(); return submitJokbo(); }
  if (e.key === 'Enter' && answered) { e.preventDefault(); return next(); }
}
