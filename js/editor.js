/* Editors: photo (draw ? boxes), 문족 question, 빈칸 card */
const LABEL_COLORS = ['#ef4444', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d'];

function openEditor(id) {
  const it = S.items[id];
  if (!it) return;
  if (it.type === 'photo') return openPhotoEditor(id);
  if (it.type === 'jokbo') return openJokboEditor(id);
  if (it.type === 'cloze') return openClozeEditor(id);
}

function photoSiblings(it) {
  return Object.values(S.items).filter(o => o.type === 'photo' && (o.folder || null) === (it.folder || null))
    .sort((a, b) => (a.created || 0) - (b.created || 0));
}

async function openPhotoEditor(id) {
  const it = S.items[id];
  let selLabel = it.labels[0] ? it.labels[0].id : null;
  let addMode = false;

  const sibs = photoSiblings(it);
  const idx = sibs.findIndex(o => o.id === id);
  const go = d => { const n = sibs[idx + d]; if (n) { m.close(); openPhotoEditor(n.id); } };

  const nameIn = h('input', { class: 'input', value: it.name || '', placeholder: '자료 이름 (비우면 “사진”)' });
  nameIn.oninput = () => { it.name = nameIn.value; save(); };

  const img = h('img', { class: 'stage-img', draggable: 'false', alt: '' });
  img.src = await imgURL(it.img);
  const overlay = h('div', { class: 'stage-ov' });
  const stage = h('div', { class: 'stage edit' }, img, overlay);
  const labelList = h('div', { class: 'label-list' });
  const hint = h('div', { class: 'hint' });

  function color(l) { return LABEL_COLORS[it.labels.indexOf(l) % LABEL_COLORS.length]; }
  function drawBoxes() {
    overlay.innerHTML = '';
    it.labels.forEach((l, li) => l.boxes.forEach((b, bi) => {
      const on = l.id === selLabel;
      const el = h('div', {
        class: 'ebox' + (on ? ' on' : ''),
        style: { left: b[0] * 100 + '%', top: b[1] * 100 + '%', width: b[2] * 100 + '%', height: b[3] * 100 + '%', borderColor: color(l), background: on ? color(l) + '33' : 'transparent' },
        onpointerdown: e => { e.stopPropagation(); selLabel = l.id; addMode = false; refresh(); focusLabel(); }
      }, h('span', { class: 'enum', style: { background: color(l) } }, li + 1),
        on ? h('button', { class: 'ebox-x', title: '상자 지우기', onpointerdown: e => { e.stopPropagation(); }, onclick: e => { e.stopPropagation(); l.boxes.splice(bi, 1); save(); refresh(); } }, '×') : null);
      overlay.append(el);
    }));
  }
  function focusLabel() {
    const inp = labelList.querySelector(`[data-l="${selLabel}"] .ans`);
    inp && inp.focus();
  }
  function drawList() {
    labelList.innerHTML = '';
    if (!it.labels.length) labelList.append(h('div', { class: 'muted pre' }, '사진 위를 끌어서 ? 상자를 그리면 여기에 이름 칸이 생겨요.\n상자 없이 사진 전체를 문제로 쓰려면 아래 “상자 없이 정답만”을 누르세요.'));
    it.labels.forEach((l, li) => {
      const ans = h('input', { class: 'input ans', value: l.answer || '', placeholder: '정답 (예: Biceps brachii)' });
      ans.oninput = () => { l.answer = ans.value; save(); };
      ans.onfocus = () => { if (selLabel !== l.id) { selLabel = l.id; addMode = false; drawBoxes(); markSel(); } };
      ans.onkeydown = e => { if (e.key === 'Enter') { const n = it.labels[li + 1]; if (n) { selLabel = n.id; refresh(); focusLabel(); } } };
      const wrong = h('input', { class: 'input sm', value: (l.wrong || []).join(', '), placeholder: '객관식 오답 보기 (쉼표로 구분, 비우면 자동)' });
      wrong.oninput = () => { l.wrong = wrong.value.split(',').map(s => s.trim()).filter(Boolean); save(); };
      labelList.append(h('div', { class: 'label-row' + (l.id === selLabel ? ' on' : ''), 'data-l': l.id },
        h('span', { class: 'enum big', style: { background: color(l) } }, li + 1),
        h('div', { class: 'grow' }, ans, wrong,
          h('div', { class: 'muted sm' }, l.boxes.length ? `상자 ${l.boxes.length}개` : '상자 없음 (사진 전체가 문제)')),
        h('div', { class: 'col' },
          h('button', { class: 'btn ghost xs', title: '이 이름에 상자 더하기', onclick: () => { selLabel = l.id; addMode = true; refresh(); } }, '+상자'),
          h('button', { class: 'btn ghost xs', disabled: li === 0, onclick: () => { it.labels.splice(li, 1); it.labels.splice(li - 1, 0, l); save(); refresh(); } }, '↑'),
          h('button', { class: 'btn danger xs', onclick: () => { it.labels.splice(li, 1); if (selLabel === l.id) selLabel = null; save(); refresh(); } }, '삭제'))));
    });
  }
  function markSel() { labelList.querySelectorAll('.label-row').forEach(r => r.classList.toggle('on', r.dataset.l === selLabel)); }
  function refresh() {
    drawBoxes(); drawList();
    hint.textContent = addMode ? '지금 그리는 상자는 선택한 이름에 더해져요 (같은 이름이 여러 곳일 때).' : '사진 위를 끌어서 ? 상자를 그려요. 상자를 누르면 선택돼요.';
  }

  // drawing
  let start = null, temp = null;
  const norm = e => {
    const r = img.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    start = norm(e); stage.setPointerCapture(e.pointerId);
    temp = h('div', { class: 'ebox temp' }); overlay.append(temp);
  });
  stage.addEventListener('pointermove', e => {
    if (!start) return;
    const p = norm(e);
    const x = Math.min(p[0], start[0]), y = Math.min(p[1], start[1]);
    Object.assign(temp.style, { left: x * 100 + '%', top: y * 100 + '%', width: Math.abs(p[0] - start[0]) * 100 + '%', height: Math.abs(p[1] - start[1]) * 100 + '%' });
  });
  stage.addEventListener('pointerup', e => {
    if (!start) return;
    const p = norm(e);
    const box = [Math.min(p[0], start[0]), Math.min(p[1], start[1]), Math.abs(p[0] - start[0]), Math.abs(p[1] - start[1])].map(v => +v.toFixed(4));
    start = null; temp && temp.remove(); temp = null;
    if (box[2] < 0.008 || box[3] < 0.008) return;
    const cur = it.labels.find(l => l.id === selLabel);
    if (addMode && cur) cur.boxes.push(box);
    else { const l = { id: uid('l'), answer: '', boxes: [box], wrong: [] }; it.labels.push(l); selLabel = l.id; }
    addMode = false; save(); refresh(); focusLabel();
  });

  const body = h('div', { class: 'peditor' },
    h('div', { class: 'pe-left' }, stage, hint),
    h('div', { class: 'pe-right' },
      h('label', { class: 'lbl' }, '자료 이름'), nameIn,
      h('div', { class: 'row between' }, h('label', { class: 'lbl' }, '이름 (정답)'),
        h('button', { class: 'btn ghost xs', onclick: () => { const l = { id: uid('l'), answer: '', boxes: [], wrong: [] }; it.labels.push(l); selLabel = l.id; save(); refresh(); focusLabel(); } }, '상자 없이 정답만')),
      labelList));
  const title = h('div', { class: 'row gap' },
    h('button', { class: 'icon-btn', disabled: idx <= 0, title: '이전 사진', onclick: () => go(-1) }, '◀'),
    h('span', null, `사진 고치기 ${idx + 1}/${sibs.length}`),
    h('button', { class: 'icon-btn', disabled: idx >= sibs.length - 1, title: '다음 사진', onclick: () => go(1) }, '▶'));
  const m = modal(title, body, { full: true, onClose: () => rerender() });
  refresh();
}

/* ---------- 문족 editor ---------- */
async function openJokboEditor(id) {
  const isNew = !id;
  const it = isNew ? { type: 'jokbo', stem: '', data: '', imgs: [], choices: ['', '', '', '', ''], answers: [], atext: '', ex: '', lecture: '', year: '', prof: '', note: '' } : JSON.parse(JSON.stringify(S.items[id]));
  const f = {};
  const inp = (k, ph, cls = 'input') => { const e = h('input', { class: cls, value: it[k] ?? '', placeholder: ph }); f[k] = e; return e; };
  const ta = (k, ph, rows = 3) => { const e = h('textarea', { class: 'input', rows, placeholder: ph }); e.value = it[k] ?? ''; f[k] = e; return e; };

  const choiceBox = h('div', { class: 'choices-edit' });
  function drawChoices() {
    choiceBox.innerHTML = '';
    it.choices.forEach((c, i) => {
      const on = it.answers.includes(i + 1);
      const ci = h('input', { class: 'input', value: c, placeholder: '보기 ' + (i + 1) });
      ci.oninput = () => it.choices[i] = ci.value;
      choiceBox.append(h('div', { class: 'row gap' },
        h('button', { class: 'circle' + (on ? ' on' : ''), title: '정답 표시', onclick: () => { on ? it.answers = it.answers.filter(a => a !== i + 1) : it.answers.push(i + 1); it.answers.sort(); drawChoices(); } }, i + 1),
        ci, h('button', { class: 'icon-btn', onclick: () => { it.choices.splice(i, 1); it.answers = it.answers.filter(a => a !== i + 1).map(a => a > i + 1 ? a - 1 : a); drawChoices(); } }, '✕')));
    });
    choiceBox.append(h('button', { class: 'btn ghost sm', onclick: () => { it.choices.push(''); drawChoices(); } }, '+ 보기 추가'));
  }
  drawChoices();

  const imgBox = h('div', { class: 'row wrap gap' });
  async function drawImgs() {
    imgBox.innerHTML = '';
    for (const [i, im] of it.imgs.entries()) {
      const u = await imgURL(im);
      imgBox.append(h('div', { class: 'imgchip' }, h('img', { src: u }), h('button', { class: 'icon-btn', onclick: () => { it.imgs.splice(i, 1); drawImgs(); } }, '✕')));
    }
    imgBox.append(h('button', { class: 'btn ghost sm', onclick: async () => {
      const files = await pickFile('image/*', true);
      for (const file of files) it.imgs.push(await storeImage(file));
      drawImgs();
    } }, '+ 사진'));
  }
  drawImgs();

  const body = h('div', { class: 'form' },
    h('div', { class: 'grid3' },
      h('div', null, h('label', { class: 'lbl' }, '강의명'), inp('lecture', '예: 상지 근육')),
      h('div', null, h('label', { class: 'lbl' }, '연도'), inp('year', '예: 2023 (글도 가능)')),
      h('div', null, h('label', { class: 'lbl' }, '교수님'), inp('prof', '모르면 비워두세요'))),
    h('label', { class: 'lbl' }, '문제 (발문)'), ta('stem', '예: 다음 중 근피신경의 지배를 받는 근육은?', 3),
    h('label', { class: 'lbl' }, '상자 글 (선택)'), ta('data', '검사 결과·보기 목록 등 상자 안에 보일 글', 2),
    h('label', { class: 'lbl' }, '문제 사진'), imgBox,
    h('label', { class: 'lbl' }, '보기 · 정답 (동그라미를 눌러 정답 표시, 여러 개면 모두 골라야 맞음)'), choiceBox,
    h('label', { class: 'lbl' }, '글 정답 (보기 없는 문제만)'), inp('atext', '예: Musculocutaneous nerve'),
    h('label', { class: 'lbl' }, '해설 (**굵게** 가능)'), ta('ex', '해설', 4),
    h('label', { class: 'lbl' }, '메모 (번호 위에 작게 보이는 글)'), inp('note', '예: 중간평가 A-type'),
    h('div', { class: 'row end' },
      !isNew ? h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('이 문제를 삭제할까요?', '삭제', true)) { await deleteItems([id]); m.close(); } } }, '삭제') : null,
      h('button', { class: 'btn primary', onclick: () => {
        for (const k of Object.keys(f)) it[k] = f[k].value.trim();
        it.choices = it.choices.map(c => c.trim());
        while (it.choices.length && !it.choices[it.choices.length - 1]) it.choices.pop();
        if (!it.stem && !it.imgs.length) return toast('문제 글이나 사진을 넣어주세요');
        if (it.choices.some(c => !c)) return toast('빈 보기가 있어요. 내용을 적거나 지워주세요');
        if (it.choices.length && !it.answers.length) return toast('정답을 골라주세요');
        if (!it.choices.length && !it.atext) return toast('보기가 없으면 글 정답을 적어주세요');
        if (/^\d{4}$/.test(it.year)) it.year = +it.year;
        if (isNew) { addItem(it); toast('문제를 추가했어요'); } else { S.items[id] = it; toast('문제를 고쳤어요'); }
        save(); m.close();
      } }, isNew ? '추가' : '저장')));
  const m = modal(isNew ? '새 문족 문제' : '문족 문제 고치기', body, { wide: true, onClose: () => rerender() });
}

/* ---------- 빈칸 editors ---------- */
function openClozeEditor(id) {
  const it = S.items[id];
  const t = h('textarea', { class: 'input', rows: 4 }); t.value = it.text;
  const lec = h('input', { class: 'input', value: it.lecture || '', placeholder: '강의명 (선택)' });
  const prev = h('div', { class: 'cloze-preview' });
  const upd = () => prev.innerHTML = clozeHTML(t.value, true);
  t.oninput = upd; upd();
  const m = modal('빈칸 카드 고치기', h('div', { class: 'form' },
    h('p', { class: 'muted sm' }, '가릴 부분을 [[ ]]로 감싸요. 예: 근피신경은 [[팔 앞칸]] 굽힘근을 지배한다'),
    t, prev, h('label', { class: 'lbl' }, '강의명'), lec,
    h('div', { class: 'row end' },
      h('button', { class: 'btn danger', onclick: async () => { if (await confirmBox('이 카드를 삭제할까요?', '삭제', true)) { await deleteItems([id]); m.close(); } } }, '삭제'),
      h('button', { class: 'btn primary', onclick: () => {
        if (!/\[\[.+?\]\]/.test(t.value)) return toast('[[ ]] 빈칸이 하나 이상 있어야 해요');
        it.text = t.value.trim(); it.lecture = lec.value.trim(); save(); m.close(); toast('고쳤어요');
      } }, '저장'))), { wide: true, onClose: () => rerender() });
}
function openClozeBulk() {
  const t = h('textarea', { class: 'input', rows: 10, placeholder: '한 줄에 카드 하나. 가릴 부분은 [[ ]]로 감싸요.\n예:\n상완이두근은 [[근피신경]]의 지배를 받는다\n[[Rotator cuff]]는 SITS 근육으로 이루어진다' });
  const lec = h('input', { class: 'input', placeholder: '강의명 (선택, 예: 상지 근육)' });
  const m = modal('빈칸 카드 만들기', h('div', { class: 'form' }, t, h('label', { class: 'lbl' }, '강의명'), lec,
    h('div', { class: 'row end' }, h('button', { class: 'btn primary', onclick: () => {
      const lines = t.value.split('\n').map(s => s.trim()).filter(s => /\[\[.+?\]\]/.test(s));
      if (!lines.length) return toast('[[ ]] 빈칸이 있는 줄이 없어요');
      lines.forEach(text => addItem({ type: 'cloze', text, lecture: lec.value.trim() }));
      save(); m.close(); toast(lines.length + '개를 넣었어요');
    } }, '만들기'))), { wide: true, onClose: () => rerender() });
}
function clozeHTML(text, showAll, revealed) {
  let i = -1;
  return esc(text).replace(/\[\[(.+?)\]\]/g, (_, a) => {
    i++;
    const open = showAll || (revealed && revealed.has(i));
    return `<button class="blank${open ? ' open' : ''}" data-b="${i}">${open ? a : '&nbsp;'.repeat(Math.min(14, Math.max(4, a.length)))}</button>`;
  }).replace(/\n/g, '<br>');
}
