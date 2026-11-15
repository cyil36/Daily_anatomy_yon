/* 자료 tab: folders + items (사진 / 문족 / 빈칸) */
const Lib = { folder: null, select: false, sel: new Set(), q: '', sort: 'created' };

const TYPE_LABEL = { photo: '사진', jokbo: '문족', cloze: '빈칸' };

async function renderLibrary(root) {
  const q = Lib.q.trim().toLowerCase();
  const path = folderPath(Lib.folder);
  const head = h('div', { class: 'section-head' },
    h('div', { class: 'crumbs' },
      h('button', { class: 'crumb', onclick: () => { Lib.folder = null; rerender(); } }, '전체 자료'),
      path.map(f => [h('span', { class: 'sep' }, '›'), h('button', { class: 'crumb', onclick: () => { Lib.folder = f.id; rerender(); } }, f.name)])),
    h('div', { class: 'row' },
      h('button', { class: 'btn ghost sm', onclick: () => { Lib.select = !Lib.select; Lib.sel.clear(); rerender(); } }, Lib.select ? '선택 끝' : '선택'),
      h('button', { class: 'btn ghost sm', onclick: newFolder }, '+ 새 폴더'),
      h('button', { class: 'btn primary sm', onclick: e => newItemMenu(e.currentTarget) }, '+ 새 자료')));

  const search = h('input', { class: 'input search', placeholder: '자료 검색 (예: aortic valve)', value: Lib.q });
  search.addEventListener('input', () => { Lib.q = search.value; clearTimeout(search._t); search._t = setTimeout(() => { rerender(); const s = $('.search'); s && (s.focus(), s.setSelectionRange(s.value.length, s.value.length)); }, 200); });

  let folders = q ? [] : folderChildren(Lib.folder);
  let items = q
    ? Object.values(S.items).filter(it => searchText(it).includes(q))
    : folderItems(Lib.folder);
  items.sort(Lib.sort === 'name' ? (a, b) => itemTitle(a).localeCompare(itemTitle(b), 'ko', { numeric: true }) : (a, b) => (a.created || 0) - (b.created || 0));
  folders.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));

  const bar = Lib.select ? h('div', { class: 'selbar' },
    h('span', null, Lib.sel.size + '개 선택됨'),
    h('button', { class: 'btn ghost sm', onclick: () => { items.forEach(i => Lib.sel.add(i.id)); rerender(); } }, '전체 선택'),
    h('button', { class: 'btn ghost sm', disabled: !Lib.sel.size, onclick: () => moveItems([...Lib.sel]) }, '이동'),
    h('button', { class: 'btn ghost sm', disabled: !Lib.sel.size, onclick: () => dupItems([...Lib.sel]) }, '복제'),
    h('button', { class: 'btn danger sm', disabled: !Lib.sel.size, onclick: async () => {
      if (await confirmBox(Lib.sel.size + '개를 삭제할까요? 자료를 삭제하면 학습·퀴즈에서도 빠져요.', '삭제', true)) {
        await deleteItems([...Lib.sel]); Lib.sel.clear(); toast('삭제했어요'); rerender();
      }
    } }, '삭제')) : null;

  const list = h('div', { class: 'lib-grid' });
  for (const f of folders) {
    const n = folderDescItems(f.id).length;
    list.append(h('div', { class: 'lib-card folder', onclick: () => { Lib.folder = f.id; rerender(); } },
      h('div', { class: 'thumb fthumb' }, '📁'),
      h('div', { class: 'lib-meta' }, h('div', { class: 'lib-name' }, f.name), h('div', { class: 'muted sm' }, n + '개')),
      h('button', { class: 'icon-btn dots', onclick: e => { e.stopPropagation(); folderMenu(e.currentTarget, f); } }, '···')));
  }
  for (const it of items) {
    const th = h('div', { class: 'thumb' });
    if (it.type === 'photo') imgURL(it.img).then(u => { if (u) th.style.backgroundImage = `url("${u}")`; });
    else th.append(h('span', { class: 'tbadge ' + it.type }, TYPE_LABEL[it.type]));
    const sub = it.type === 'photo'
      ? (it.labels.length ? it.labels.length + '개 이름' : '상자 없음 · 눌러서 추가')
      : [it.lecture, it.year && it.year > 0 ? it.year : ''].filter(Boolean).join(' · ') || TYPE_LABEL[it.type];
    const card = h('div', {
      class: 'lib-card' + (Lib.sel.has(it.id) ? ' sel' : '') + (it.type === 'photo' && !itemQids(it).length ? ' warn' : ''),
      onclick: () => {
        if (Lib.select) { Lib.sel.has(it.id) ? Lib.sel.delete(it.id) : Lib.sel.add(it.id); rerender(); }
        else openEditor(it.id);
      }
    }, th,
      h('div', { class: 'lib-meta' }, h('div', { class: 'lib-name' }, itemTitle(it)), h('div', { class: 'muted sm' }, sub)),
      Lib.select ? h('span', { class: 'check' + (Lib.sel.has(it.id) ? ' on' : '') }, '✓') :
        h('button', { class: 'icon-btn dots', onclick: e => { e.stopPropagation(); itemMenu(e.currentTarget, it); } }, '···'));
    list.append(card);
  }
  const empty = !folders.length && !items.length
    ? h('div', { class: 'empty' }, q ? `‘${Lib.q}’가 들어간 자료가 없어요.` : '빈 폴더예요.\n‘+ 새 자료’로 사진·PDF·엑셀을 넣거나 ‘+ 새 폴더’를 만드세요.')
    : null;

  root.append(head,
    h('div', { class: 'row gap' }, search,
      h('select', { class: 'input sel-sort', onchange: e => { Lib.sort = e.target.value; rerender(); } },
        h('option', { value: 'created', selected: Lib.sort === 'created' }, '만든 순'),
        h('option', { value: 'name', selected: Lib.sort === 'name' }, '이름순'))),
    ...[bar, list, empty].filter(Boolean));
}

function searchText(it) {
  const parts = [itemTitle(it), it.lecture, it.prof, it.stem, it.data, it.text, it.atext, (it.choices || []).join(' ')];
  if (it.type === 'photo') parts.push(it.labels.map(l => l.answer).join(' '));
  return parts.filter(Boolean).join(' ').toLowerCase();
}

async function newFolder() {
  const name = await promptBox('새 폴더', '', '폴더 이름 (예: Upper limb)');
  if (!name) return;
  S.folders.push({ id: uid('f'), name, parent: Lib.folder });
  save(); toast(`‘${name}’ 폴더를 만들었어요`); rerender();
}
function newItemMenu(anchor) {
  menu(anchor, [
    ['🖼  사진 올리기 (여러 장)', () => importImages()],
    ['📄  PDF에서 가져오기', () => importPDF()],
    ['📊  엑셀(.xlsx)로 한꺼번에', () => importExcel()],
    ['📝  문족 문제 만들기', () => openJokboEditor(null)],
    ['▢  빈칸 카드 만들기 (여러 줄)', () => openClozeBulk()],
    ['📦  자료 묶음(.zip) 가져오기', () => importBundle()],
    ['⬇  JSON 자료 가져오기', () => importJSONItems()]
  ]);
}
function folderMenu(anchor, f) {
  menu(anchor, [
    ['이름 변경', async () => { const n = await promptBox('이름 변경', f.name); if (n) { f.name = n; save(); rerender(); } }],
    ['이동', () => moveFolder(f)],
    ['삭제', async () => {
      const its = folderDescItems(f.id);
      if (!await confirmBox(`‘${f.name}’ 폴더와 안의 자료 ${its.length}개를 삭제할까요?`, '삭제', true)) return;
      await deleteItems(its.map(i => i.id));
      const kill = new Set([f.id]); let grew = true;
      while (grew) { grew = false; for (const x of S.folders) if (kill.has(x.parent) && !kill.has(x.id)) { kill.add(x.id); grew = true; } }
      S.folders = S.folders.filter(x => !kill.has(x.id));
      save(); rerender();
    }, 'danger']
  ]);
}
function itemMenu(anchor, it) {
  menu(anchor, [
    ['고치기', () => openEditor(it.id)],
    ['이름 변경', async () => { const n = await promptBox('이름 변경', itemTitle(it)); if (n != null) { it.name = n; save(); rerender(); } }],
    ['이동', () => moveItems([it.id])],
    ['복제', () => dupItems([it.id])],
    ['삭제', async () => { if (await confirmBox(`‘${itemTitle(it)}’를 삭제할까요?`, '삭제', true)) { await deleteItems([it.id]); rerender(); } }, 'danger']
  ]);
}
function folderPicker(title, exclude) {
  return new Promise(res => {
    let done = false;
    const rows = [h('button', { class: 'list-row', onclick: () => fin(null) }, '📁 전체 자료 (맨 위)')];
    const walk = (pid, depth) => {
      for (const f of folderChildren(pid).sort((a, b) => a.name.localeCompare(b.name, 'ko'))) {
        if (exclude && exclude.has(f.id)) continue;
        rows.push(h('button', { class: 'list-row', style: { paddingLeft: (12 + depth * 18) + 'px' }, onclick: () => fin(f.id) }, '📁 ' + f.name));
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    const m = modal(title, h('div', { class: 'list' }, rows), { onClose: () => { if (!done) res(undefined); } });
    function fin(v) { done = true; m.close(); res(v); }
  });
}
async function moveItems(ids) {
  const to = await folderPicker('어느 폴더로 옮길까요?');
  if (to === undefined) return;
  ids.forEach(id => { if (S.items[id]) S.items[id].folder = to; });
  Lib.sel.clear(); save(); toast('옮겼어요'); rerender();
}
async function moveFolder(f) {
  const ex = new Set([f.id]); let grew = true;
  while (grew) { grew = false; for (const x of S.folders) if (ex.has(x.parent) && !ex.has(x.id)) { ex.add(x.id); grew = true; } }
  const to = await folderPicker('어느 폴더로 옮길까요?', ex);
  if (to === undefined) return;
  f.parent = to; save(); rerender();
}
function dupItems(ids) {
  for (const id of ids) {
    const it = S.items[id]; if (!it) continue;
    const c = JSON.parse(JSON.stringify(it));
    c.id = uid('t'); c.created = Date.now(); c.name = itemTitle(it) + ' (복제)';
    if (c.labels) c.labels.forEach(l => l.id = uid('l'));
    S.items[c.id] = c;
  }
  Lib.sel.clear(); save(); toast('복제했어요'); rerender();
}
function addItem(it) {
  it.id = it.id || uid('t');
  it.created = it.created || Date.now();
  if (it.folder === undefined) it.folder = Lib.folder;
  S.items[it.id] = it;
  return it;
}
