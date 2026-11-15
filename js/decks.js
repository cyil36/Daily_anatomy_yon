/* 학습 / 퀴즈 lists, create & manage */
const DECK_TYPES = {
  study: [
    ['photo', '사진 학습', '빨간 ? 로 가려진 이름을 속으로 말해 보고, 정답을 확인한 뒤 ✓ 아는 것 / ✕ 모르는 것으로 나눠요.'],
    ['cloze', '빈칸 학습', '빈칸을 눌러 답을 하나씩 확인하고, 다 맞혔으면 ✓, 하나라도 틀렸으면 ✕.'],
    ['jokbo', '문족 학습', '족보 문제를 풀고 해설을 봐요. 보기를 고르면 바로 채점돼요.']
  ],
  quiz: [
    ['mcq', '객관식 (보기 4개)', '사진 문제를 보기 4개 중에서 골라요. 한 번 고른 답은 바꿀 수 없어요.'],
    ['typed', '주관식 (직접 입력)', '정답을 직접 입력해요. 대소문자·띄어쓰기는 상관없어요.'],
    ['rtype', 'R-type (이름 목록)', '그 사진에 적힌 이름 전부가 알파벳 순 번호 목록으로 나와요. 번호를 골라요.'],
    ['jokbo', '문족 퀴즈', '족보 문제를 제한시간 안에 풀어요.']
  ]
};
const typeName = (kind, t) => { const f = DECK_TYPES[kind].find(x => x[0] === t); return f ? f[1] : t; };
const itemTypeFor = t => t === 'cloze' ? 'cloze' : t === 'jokbo' ? 'jokbo' : 'photo';
const CARD_COLORS = { blue: '#2563eb', mint: '#0d9488', yellow: '#ca8a04', lavender: '#7c3aed', apricot: '#ea580c', sky: '#0284c7', pink: '#db2777', gray: '#475569' };

function syncQs(d, reset = false) {
  const all = d.src.flatMap(id => itemQids(S.items[id]));
  if (d.fixed) {
    const set = new Set(all);
    d.qs = (d.qs || []).filter(q => set.has(q));
  } else if (reset || !d.qs || !d.qs.length) {
    d.qs = d.sample > 0 ? shuffle(all).slice(0, d.sample) : all;
  } else {
    const set = new Set(all);
    d.qs = d.qs.filter(q => set.has(q));
    if (!d.sample) { const have = new Set(d.qs); for (const q of all) if (!have.has(q)) d.qs.push(q); }
  }
  for (const k of Object.keys(d.rec)) if (!d.qs.includes(k)) delete d.rec[k];
}
function deckStats(d) {
  let r = 0, w = 0;
  for (const q of d.qs) { if (d.rec[q] === 1) r++; else if (d.rec[q] === -1) w++; }
  return { r, w, n: d.qs.length, u: d.qs.length - r - w };
}

function renderDecks(root, kind) {
  const decks = S.decks.filter(d => d.kind === kind);
  decks.forEach(d => syncQs(d));
  decks.sort((a, b) => (b.fav - a.fav) || (a.order_ ?? a.created) - (b.order_ ?? b.created));
  const nItems = Object.keys(S.items).length;
  root.append(h('div', { class: 'section-head' },
    h('h2', null, kind === 'study' ? '학습' : '퀴즈'),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost sm', onclick: () => createMany(kind) }, '여러 개 한번에'),
      decks.length > 1 ? h('button', { class: 'btn ghost sm', onclick: () => mergeDecks(kind) }, '모아서 만들기') : null,
      h('button', { class: 'btn primary sm', onclick: () => editDeck(null, kind) }, kind === 'study' ? '+ 새 학습' : '+ 새 퀴즈'))));
  root.append(h('p', { class: 'muted sm intro' }, kind === 'study'
    ? '보고 → 떠올리고 → 정답 확인 → ✓/✕. 기록이 저장되고, 모르는 것만 골라 복습할 수 있어요.'
    : '객관식·주관식·R-type·문족으로 실력을 확인해요. 다 풀면 결과가 나오고, 틀린 문제만 다시 풀 수 있어요.'));
  if (!decks.length) {
    root.append(h('div', { class: 'empty' }, nItems
      ? `아직 만든 ${kind === 'study' ? '학습' : '퀴즈'}이 없어요.\n위의 ‘+ 새 ${kind === 'study' ? '학습' : '퀴즈'}’를 눌러 자료를 골라요.`
      : '먼저 ‘자료’ 탭에서 사진·PDF·엑셀·문족·빈칸 자료를 넣어 주세요.'));
    return;
  }
  const grid = h('div', { class: 'deck-grid' });
  for (const d of decks) {
    const st = deckStats(d);
    const pct = st.r + st.w ? Math.round(st.r / (st.r + st.w) * 100) : 0;
    const col = CARD_COLORS[d.color || S.settings.cardColor] || CARD_COLORS.blue;
    grid.append(h('div', { class: 'deck-card', style: { '--c': col }, onclick: () => startMenu(d) },
      h('div', { class: 'row between' },
        h('span', { class: 'chip' }, typeName(d.kind, d.type)),
        h('div', { class: 'row' },
          d.fav ? h('span', { class: 'star' }, '★') : null,
          h('button', { class: 'icon-btn dots', onclick: e => { e.stopPropagation(); deckMenu(e.currentTarget, d); } }, '···'))),
      h('div', { class: 'deck-name' }, d.name),
      h('div', { class: 'muted sm' }, `${st.n}문제` + (d.order === 'random' ? ' · 랜덤 순서' : '') + (d.time ? ` · 문제당 ${d.time}초` : '') + (d.sample ? ` · ${d.sample}개 랜덤` : '')),
      progressBar(st.r, st.w, st.n),
      h('div', { class: 'row between sm' },
        h('span', null, h('b', { class: 'okc' }, st.r), ' 맞음 · ', h('b', { class: 'noc' }, st.w), ' 틀림 · ', st.u, ' 안 품'),
        h('span', { class: 'muted' }, st.r + st.w ? pct + '%' : ''))));
  }
  root.append(grid);
}

function deckMenu(anchor, d) {
  menu(anchor, [
    [d.fav ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가', () => { d.fav = !d.fav; save(); rerender(); }],
    ['설정 바꾸기 · 자료 넣고 빼기', () => editDeck(d.id, d.kind)],
    ['문제 목록 보기', () => openQList(d)],
    ['카드 색 바꾸기', () => pickColor(d)],
    ['복제', () => { const c = JSON.parse(JSON.stringify(d)); c.id = uid('d'); c.name += ' (복제)'; c.rec = {}; c.pos = 0; c.created = Date.now(); c.hist = []; S.decks.push(c); save(); toast('복제했어요'); rerender(); }],
    ['초기화 (기록 지우기)', async () => { if (await confirmBox(`‘${d.name}’의 맞음·틀림 기록을 모두 지울까요? 자료는 그대로예요.`, '초기화', true)) { d.rec = {}; d.pos = 0; if (d.sample) syncQs(d, true); save(); toast('초기화했어요'); rerender(); } }],
    ['삭제', async () => { if (await confirmBox(`‘${d.name}’를 삭제할까요? 기록도 지워지고 자료는 남아요.`, '삭제', true)) { S.decks = S.decks.filter(x => x !== d); save(); rerender(); } }, 'danger']
  ]);
}
function pickColor(d) {
  const m = modal('카드 색', h('div', { class: 'row wrap gap' }, Object.entries(CARD_COLORS).map(([k, v]) =>
    h('button', { class: 'swatch' + ((d.color || S.settings.cardColor) === k ? ' on' : ''), style: { background: v }, onclick: () => { d.color = k; save(); m.close(); rerender(); } }))));
}

/* create / edit */
function editDeck(id, kind) {
  const d = id ? S.decks.find(x => x.id === id) : null;
  const st = { type: d ? d.type : DECK_TYPES[kind][0][0], name: d ? d.name : '', order: d ? d.order : 'seq', time: d ? d.time : 0, sample: d ? d.sample : 0, src: new Set(d ? d.src : []) };
  const body = h('div', { class: 'form' });
  const m = modal(d ? '설정 바꾸기' : (kind === 'study' ? '새 학습 만들기' : '새 퀴즈 만들기'), body, { wide: true });

  function draw() {
    body.innerHTML = '';
    const nameIn = h('input', { class: 'input', value: st.name, placeholder: kind === 'study' ? '예: 상지 근육 복습' : '예: 흉부 중간고사' });
    nameIn.oninput = () => st.name = nameIn.value;
    const types = h('div', { class: 'type-grid' }, DECK_TYPES[kind].map(([t, label, desc]) =>
      h('button', { class: 'type-card' + (st.type === t ? ' on' : ''), disabled: !!d && itemTypeFor(d.type) !== itemTypeFor(t), onclick: () => {
        if (itemTypeFor(t) !== itemTypeFor(st.type)) st.src.clear();
        st.type = t; draw();
      } }, h('b', null, label), h('span', { class: 'sm muted' }, desc))));
    const order = h('select', { class: 'input', onchange: e => st.order = e.target.value },
      h('option', { value: 'seq', selected: st.order === 'seq' }, '순서대로'),
      h('option', { value: 'random', selected: st.order === 'random' }, '풀 때마다 랜덤'));
    const time = h('input', { class: 'input', type: 'number', min: 0, max: 600, value: st.time || '', placeholder: '없음' });
    time.oninput = () => st.time = Math.max(0, +time.value || 0);
    const sample = h('input', { class: 'input', type: 'number', min: 0, value: st.sample || '', placeholder: '전부' });
    sample.oninput = () => st.sample = Math.max(0, +sample.value || 0);
    const cnt = h('span', { class: 'muted sm' });
    const updCnt = () => { const n = [...st.src].reduce((a, id) => a + itemQids(S.items[id]).length, 0); cnt.textContent = `자료 ${st.src.size}개 · 문제 ${n}개`; };
    body.append(
      h('label', { class: 'lbl' }, '이름'), nameIn,
      h('label', { class: 'lbl' }, kind === 'study' ? '학습 유형' : '퀴즈 유형'), types,
      h('div', { class: 'grid3' },
        h('div', null, h('label', { class: 'lbl' }, '문제 순서'), order),
        h('div', null, h('label', { class: 'lbl' }, '문제당 제한시간 (초)'), time),
        h('div', null, h('label', { class: 'lbl' }, 'ㅇㅇ개만 랜덤으로'), sample)),
      h('div', { class: 'row between' }, h('label', { class: 'lbl' }, '자료 고르기 (폴더를 체크하면 통째로)'), cnt),
      itemPicker(itemTypeFor(st.type), st.src, updCnt),
      h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => {
        const n = [...st.src].reduce((a, id) => a + itemQids(S.items[id]).length, 0);
        if (!n) return toast('문제가 있는 자료를 골라주세요');
        if (st.time && (st.time < 3 || st.time > 600)) return toast('제한시간은 3초에서 600초 사이로 적어주세요');
        const name = st.name.trim() || typeName(kind, st.type) + ' ' + (S.decks.filter(x => x.kind === kind).length + 1);
        if (d) {
          const sampleChanged = d.sample !== st.sample;
          Object.assign(d, { name, type: st.type, order: st.order, time: st.time, sample: st.sample, src: [...st.src] });
          syncQs(d, sampleChanged);
          toast('고쳤어요');
        } else {
          const nd = { id: uid('d'), kind, type: st.type, name, order: st.order, time: st.time, sample: st.sample, src: [...st.src], qs: [], rec: {}, pos: 0, fav: false, created: Date.now(), hist: [] };
          syncQs(nd, true); S.decks.push(nd);
          toast(`‘${name}’을 만들었어요`);
        }
        save(); m.close(); rerender();
      } }, d ? '저장' : '만들기')));
    updCnt();
  }
  draw();
}

function itemPicker(itype, sel, onChange) {
  const box = h('div', { class: 'picker' });
  const open = new Set();
  const compat = fid => folderDescItems(fid).filter(i => i.type === itype && itemQids(i).length);
  function draw() {
    box.innerHTML = '';
    const walk = (fid, depth) => {
      for (const f of folderChildren(fid).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }))) {
        const its = compat(f.id);
        if (!its.length) continue;
        const nOn = its.filter(i => sel.has(i.id)).length;
        const state = nOn === 0 ? '' : nOn === its.length ? 'on' : 'part';
        box.append(h('div', { class: 'pk-row', style: { paddingLeft: 8 + depth * 18 + 'px' } },
          h('button', { class: 'cb ' + state, onclick: () => { const all = state !== 'on'; its.forEach(i => all ? sel.add(i.id) : sel.delete(i.id)); draw(); onChange(); } }, state === 'on' ? '✓' : state === 'part' ? '–' : ''),
          h('button', { class: 'pk-name', onclick: () => { open.has(f.id) ? open.delete(f.id) : open.add(f.id); draw(); } }, (open.has(f.id) ? '▾ ' : '▸ ') + '📁 ' + f.name),
          h('span', { class: 'muted sm' }, `${nOn}/${its.length}`)));
        if (open.has(f.id)) walk(f.id, depth + 1);
      }
      const its = folderItems(fid).filter(i => i.type === itype && itemQids(i).length)
        .sort((a, b) => (a.created || 0) - (b.created || 0));
      for (const it of its) {
        const on = sel.has(it.id);
        box.append(h('div', { class: 'pk-row', style: { paddingLeft: 8 + depth * 18 + 'px' } },
          h('button', { class: 'cb ' + (on ? 'on' : ''), onclick: () => { on ? sel.delete(it.id) : sel.add(it.id); draw(); onChange(); } }, on ? '✓' : ''),
          h('span', { class: 'pk-item' }, itemTitle(it)),
          h('span', { class: 'muted sm' }, itemQids(it).length + '문제')));
      }
    };
    walk(null, 0);
    if (!box.children.length) box.append(h('div', { class: 'empty sm' }, itype === 'photo' ? '이름(정답)이 들어간 사진 자료가 없어요. 자료 탭에서 사진을 넣고 ? 상자를 그려 주세요.' : itype === 'cloze' ? '빈칸 자료가 없어요. 자료 탭 › + 새 자료 › 빈칸 카드 만들기' : '문족 자료가 없어요. 자료 탭 › + 새 자료 › 문족 문제 만들기'));
  }
  draw();
  return box;
}

/* Create one deck per checked folder in one go (e.g. every "0번/1번/2번 자료" folder, or every 세부목차). */
const shortFolderName = (f, i, path) => i === 0 && /^\d+차\s/.test(f.name) && path.length > 1 ? f.name.split(' ')[0] : f.name.replace(/\s*\((Flash card|Rohen 모음)\)\s*$/, '');
function folderDeckName(fid) {
  const path = folderPath(fid);
  return path.map((f, i) => shortFolderName(f, i, path)).join(' · ');
}
function createMany(kind) {
  const st = { type: DECK_TYPES[kind][0][0], order: 'seq', time: 0, sample: 0, sel: new Set() };
  const body = h('div', { class: 'form' });
  const m = modal(kind === 'study' ? '학습 여러 개 한번에 만들기' : '퀴즈 여러 개 한번에 만들기', body, { wide: true });
  const itype = () => itemTypeFor(st.type);
  const itemsOf = fid => folderDescItems(fid).filter(i => i.type === itype() && itemQids(i).length);
  const depth = fid => folderPath(fid).length;
  function draw() {
    body.innerHTML = '';
    const usable = S.folders.filter(f => itemsOf(f.id).length);
    for (const id of [...st.sel]) if (!usable.some(f => f.id === id)) st.sel.delete(id);
    const maxDepth = Math.max(0, ...usable.map(f => depth(f.id)));
    const depthName = d => ({ 1: '맨 위 폴더(시험)별', 2: '두 번째(부위)별', 3: '세 번째(자료)별', 4: '네 번째(세부목차)별' }[d] || `${d}단계 폴더별`);
    const types = h('div', { class: 'type-grid' }, DECK_TYPES[kind].map(([t, label, desc]) =>
      h('button', { class: 'type-card' + (st.type === t ? ' on' : ''), onclick: () => { st.type = t; draw(); } }, h('b', null, label), h('span', { class: 'sm muted' }, desc))));
    const order = h('select', { class: 'input', onchange: e => st.order = e.target.value },
      h('option', { value: 'seq', selected: st.order === 'seq' }, '순서대로'),
      h('option', { value: 'random', selected: st.order === 'random' }, '풀 때마다 랜덤'));
    const time = h('input', { class: 'input', type: 'number', min: 0, max: 600, value: st.time || '', placeholder: '없음' });
    time.oninput = () => st.time = Math.max(0, +time.value || 0);
    const sample = h('input', { class: 'input', type: 'number', min: 0, value: st.sample || '', placeholder: '전부' });
    sample.oninput = () => st.sample = Math.max(0, +sample.value || 0);
    const list = h('div', { class: 'picker' });
    const walk = (pid, d) => {
      for (const f of folderChildren(pid).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }))) {
        const n = itemsOf(f.id).reduce((a, i) => a + itemQids(i).length, 0);
        if (!n) continue;
        const on = st.sel.has(f.id);
        list.append(h('div', { class: 'pk-row', style: { paddingLeft: 8 + d * 18 + 'px' } },
          h('button', { class: 'cb ' + (on ? 'on' : ''), onclick: () => { on ? st.sel.delete(f.id) : st.sel.add(f.id); draw(); } }, on ? '✓' : ''),
          h('span', { class: 'pk-item' }, '📁 ' + f.name),
          h('span', { class: 'muted sm' }, n + '문제')));
        walk(f.id, d + 1);
      }
    };
    walk(null, 0);
    if (!list.children.length) list.append(h('div', { class: 'empty sm' }, '이 유형에 맞는 자료가 든 폴더가 없어요.'));
    const names = [...st.sel].map(folderDeckName);
    body.append(
      h('label', { class: 'lbl' }, '유형'), types,
      h('div', { class: 'grid3' },
        h('div', null, h('label', { class: 'lbl' }, '문제 순서'), order),
        h('div', null, h('label', { class: 'lbl' }, '문제당 제한시간 (초)'), time),
        h('div', null, h('label', { class: 'lbl' }, 'ㅇㅇ개만 랜덤으로'), sample)),
      h('label', { class: 'lbl' }, '체크한 폴더마다 하나씩 만들어요'),
      h('div', { class: 'row wrap gap' },
        [...Array(maxDepth)].map((_, i) => h('button', { class: 'btn ghost xs', onclick: () => { st.sel = new Set(usable.filter(f => depth(f.id) === i + 1).map(f => f.id)); draw(); } }, depthName(i + 1) + ' 모두')),
        h('button', { class: 'btn ghost xs', onclick: () => { st.sel.clear(); draw(); } }, '모두 해제')),
      list,
      h('p', { class: 'muted sm' }, st.sel.size ? `${st.sel.size}개 만들어요 · 예: ${names.slice(0, 2).join(', ')}${names.length > 2 ? ' …' : ''}` : '폴더를 체크하세요.'),
      h('div', { class: 'row end' }, h('button', { class: 'btn primary', disabled: !st.sel.size, onclick: () => {
        if (st.time && (st.time < 3 || st.time > 600)) return toast('제한시간은 3초에서 600초 사이로 적어주세요');
        const plan = [...st.sel].map(fid => ({ fid, name: folderDeckName(fid), key: folderPath(fid).map(f => f.name).join('/'),
          src: itemsOf(fid).sort((a, b) => (a.created || 0) - (b.created || 0)).map(i => i.id) }))
          .sort((a, b) => a.key.localeCompare(b.key, 'ko', { numeric: true }));
        let made = 0, upd = 0; const t0 = Date.now();
        for (const p of plan) {
          const ex = S.decks.find(d => d.kind === kind && d.type === st.type && d.name === p.name);
          if (ex) { ex.src = p.src; syncQs(ex); upd++; continue; }
          const d = { id: uid('d'), kind, type: st.type, name: p.name, order: st.order, time: st.time, sample: st.sample, src: p.src, qs: [], rec: {}, pos: 0, fav: false, created: t0 + made, hist: [] };
          syncQs(d, true); S.decks.push(d); made++;
        }
        save(); m.close(); rerender();
        toast(`${made}개를 만들었어요` + (upd ? ` · 이미 있던 ${upd}개는 자료만 새로 맞췄어요` : ''), 3500);
      } }, '만들기')));
  }
  draw();
}

function mergeDecks(kind) {
  const decks = S.decks.filter(d => d.kind === kind);
  const sel = new Set();
  const what = { v: 'wrong' };
  const m = modal('모아서 만들기', h('div', { class: 'form' },
    h('p', { class: 'muted sm' }, '여러 개에서 문제만 모아 새로 만들어요. 겹치는 문제는 한 번만 들어가고, 기록은 새로 시작해요.'),
    h('select', { class: 'input', onchange: e => what.v = e.target.value },
      h('option', { value: 'wrong' }, '틀린 문제만 (오답 모음)'),
      h('option', { value: 'unsolved' }, '안 푼 문제만'),
      h('option', { value: 'all' }, '전체 문제')),
    h('div', { class: 'list' }, decks.map(d => {
      const b = h('button', { class: 'list-row', onclick: () => { sel.has(d) ? sel.delete(d) : sel.add(d); b.classList.toggle('on'); } }, d.name + ' · ' + typeName(kind, d.type));
      return b;
    })),
    h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => {
      if (!sel.size) return toast('고를 것이 없어요');
      const types = new Set([...sel].map(d => itemTypeFor(d.type)));
      if (types.size > 1) return toast('같은 종류(사진/빈칸/문족)끼리만 모을 수 있어요');
      const qs = [];
      for (const d of sel) for (const q of d.qs) {
        const r = d.rec[q];
        if (what.v === 'wrong' && r !== -1) continue;
        if (what.v === 'unsolved' && r) continue;
        if (!qs.includes(q)) qs.push(q);
      }
      if (!qs.length) return toast('고를 문제가 없어요');
      const first = [...sel][0];
      const nd = { id: uid('d'), kind, type: first.type, name: (what.v === 'wrong' ? '오답 모음' : what.v === 'unsolved' ? '안 푼 문제 모음' : '모음') + ' ' + new Date().toLocaleDateString('ko'), order: 'seq', time: first.time, sample: 0,
        src: [...new Set(qs.map(q => q.split('#')[0]))], qs, rec: {}, pos: 0, fav: false, created: Date.now(), hist: [], fixed: true };
      S.decks.push(nd); save(); m.close(); rerender(); toast(`${qs.length}문제로 만들었어요`);
    } }, '만들기'))), { wide: true });
}

/* Question list grouped by page (photo / card). Tap a page or a question to start from there.
   opts: {list, current, run (session results), onPick(i), inSession} */
function openQList(d, opts = {}) {
  if (!opts.list) syncQs(d);
  const qs = opts.list || d.qs;
  const run = opts.run || {};
  const pick = opts.onPick || (i => { m.close(); runSession(d, d.qs, 'all', i, true); });
  const status = q => run[q] !== undefined ? run[q] : d.rec[q];
  // consecutive groups by item
  const groups = [];
  qs.forEach((q, i) => {
    const r = resolveQ(q); if (!r) return;
    const g = groups[groups.length - 1];
    if (g && g.item.id === r.item.id) g.rows.push({ q, i, r });
    else groups.push({ item: r.item, rows: [{ q, i, r }] });
  });
  const curGroup = groups.findIndex(g => g.rows.some(x => x.i === opts.current));
  const open = new Set(qs.length <= 120 ? groups.map((_, gi) => gi) : (curGroup >= 0 ? [curGroup] : []));
  let filter = '';
  const box = h('div', { class: 'qgroups' });
  const search = h('input', { class: 'input', placeholder: '정답·페이지 이름으로 찾기 (예: Trapezius, p.54)' });
  search.oninput = () => { filter = search.value.trim().toLowerCase(); draw(); };

  function sub(item) {
    const p = folderPath(item.folder).map(f => f.name);
    return p.slice(-2).join(' › ');
  }
  function draw() {
    box.innerHTML = '';
    let shown = 0;
    groups.forEach((g, gi) => {
      const title = itemTitle(g.item);
      const rows = filter ? g.rows.filter(x => (x.r.label ? x.r.label.answer : '').toLowerCase().includes(filter) || title.toLowerCase().includes(filter)) : g.rows;
      if (!rows.length) return;
      shown++;
      const ok = g.rows.filter(x => status(x.q) === 1).length, no = g.rows.filter(x => status(x.q) === -1).length;
      const isOpen = filter || open.has(gi);
      const th = h('div', { class: 'qg-thumb' });
      if (g.item.type === 'photo') imgURL(g.item.img).then(u => { if (u) th.style.backgroundImage = `url("${u}")`; });
      else th.append(h('span', { class: 'tbadge ' + g.item.type }, TYPE_LABEL[g.item.type]));
      const head = h('div', { class: 'qg-head' + (gi === curGroup ? ' cur' : ''), onclick: () => { open.has(gi) ? open.delete(gi) : open.add(gi); draw(); } },
        th,
        h('div', { class: 'grow' },
          h('div', { class: 'qg-title' }, (isOpen ? '▾ ' : '▸ ') + title),
          h('div', { class: 'muted sm' }, [TYPE_LABEL[g.item.type] || '', sub(g.item), `${g.rows[0].i + 1}–${g.rows[g.rows.length - 1].i + 1}번 (${g.rows.length}문제)`].filter(Boolean).join(' · ')),
          progressBar(ok, no, g.rows.length)),
        h('button', { class: 'btn primary xs', onclick: e => { e.stopPropagation(); pick(g.rows[0].i); } }, '여기부터'));
      box.append(head);
      if (isOpen) {
        const rl = h('div', { class: 'qg-rows' });
        for (const x of rows) {
          const st = status(x.q);
          rl.append(h('div', { class: 'list-row qrow' + (x.i === opts.current ? ' cur' : ''), onclick: () => pick(x.i) },
            h('span', { class: 'qn ' + (st === 1 ? 'ok' : st === -1 ? 'no' : '') }, x.i + 1),
            h('span', { class: 'grow' }, x.r.label ? x.r.label.answer : itemTitle(x.r.item)),
            !opts.inSession ? h('button', { class: 'btn ghost xs', onclick: e => { e.stopPropagation(); m.close(); openEditor(x.r.item.id); } }, '고치기') : null,
            !opts.inSession && (d.fixed || d.sample) ? h('button', { class: 'btn ghost xs', onclick: e => { e.stopPropagation(); d.qs = d.qs.filter(y => y !== x.q); delete d.rec[x.q]; save(); m.close(); openQList(d); } }, '빼기') : null));
        }
        box.append(rl);
      }
    });
    if (!shown) box.append(h('div', { class: 'empty sm' }, '찾는 문제가 없어요.'));
  }
  draw();
  const body = h('div', null,
    h('div', { class: 'row gap' }, search,
      h('button', { class: 'btn ghost sm', onclick: () => { groups.forEach((_, gi) => open.add(gi)); draw(); } }, '모두 펼치기'),
      h('button', { class: 'btn ghost sm', onclick: () => { open.clear(); draw(); } }, '모두 접기')),
    h('p', { class: 'muted sm' }, `페이지 ${groups.length}개 · ${qs.length}문제 · 페이지의 ‘여기부터’나 문제를 누르면 그 위치부터 풀어요.`),
    box);
  const m = modal(`${d.name}`, body, { wide: true, onClose: () => { if (!opts.inSession) rerender(); } });
  setTimeout(() => { const c = box.querySelector('.qrow.cur') || box.querySelector('.qg-head.cur'); c && c.scrollIntoView({ block: 'center' }); }, 50);
}
