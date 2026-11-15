/* 설정 tab: cheer, auto-next, shortcuts, backup, guide */
const KEY_NAMES = { reveal: '정답 확인 / 빈칸 열기', wrong: '틀림 (✕)', right: '맞음 (✓)', prev: '이전 문제', next: '다음 문제', expl: '해설 열기·닫기' };
const keyLabel = k => k === ' ' ? 'Space' : k.startsWith('Arrow') ? { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[k] : k.length === 1 ? k.toUpperCase() : k;

function renderSettings(root) {
  const st = S.settings;
  const toggle = (key, label, desc) => h('div', { class: 'set-row' },
    h('div', null, h('b', null, label), h('div', { class: 'muted sm' }, desc)),
    h('button', { class: 'switch' + (st[key] ? ' on' : ''), onclick: () => { st[key] = !st[key]; save(); rerender(); if (key === 'cheer' && st.cheer) cheer('hi'); } }, h('span')));

  const keys = h('div', { class: 'keys' }, Object.entries(KEY_NAMES).map(([k, label]) => {
    const b = h('button', { class: 'keycap' }, keyLabel(st.keys[k]));
    b.onclick = () => {
      b.textContent = '키를 누르세요'; b.classList.add('wait');
      const fn = e => {
        e.preventDefault(); e.stopPropagation();
        document.removeEventListener('keydown', fn, true);
        if (e.key !== 'Escape') {
          const nk = e.key.length === 1 ? e.key.toLowerCase() : e.key;
          if (/^[0-9]$/.test(nk)) { toast('숫자 키는 보기 고르기에 쓰여서 바꿀 수 없어요'); }
          else {
            const other = Object.keys(st.keys).find(x => x !== k && st.keys[x] === nk);
            if (other) st.keys[other] = st.keys[k]; // swap
            st.keys[k] = nk; save();
          }
        }
        rerender();
      };
      document.addEventListener('keydown', fn, true);
    };
    return h('div', { class: 'set-row' }, h('span', null, label), b);
  }));

  const total = Object.keys(S.items).length;
  const qn = Object.values(S.items).reduce((a, it) => a + itemQids(it).length, 0);
  const days = Object.keys(S.log).sort();
  const last7 = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); return [k.slice(5), S.log[k] || 0]; });
  const mx = Math.max(1, ...last7.map(x => x[1]));

  root.append(
    h('h2', null, '설정'),
    h('section', { class: 'card' },
      h('h3', null, '이번 주 학습'),
      h('div', { class: 'week' }, last7.map(([d, n]) => h('div', { class: 'wk' }, h('div', { class: 'wk-bar', style: { height: (n / mx * 60 + 2) + 'px' }, title: n + '문제' }), h('span', { class: 'xs muted' }, d), h('span', { class: 'xs' }, n || '')))),
      h('p', { class: 'muted sm' }, `자료 ${total}개 · 문제 ${qn}개 · 학습한 날 ${days.length}일`)),
    h('section', { class: 'card' },
      h('h3', null, '푸는 방식'),
      toggle('cheer', '캐릭터 응원', '맞히거나 틀릴 때, 연속으로 맞힐 때, 절반쯤 지날 때 캐릭터가 응원해 줘요.'),
      st.cheer ? h('div', { class: 'set-row' }, h('span', null, '응원 캐릭터'), h('div', { class: 'row gap' },
        [['bone', '뼈다귀'], ['heart', '심장이']].map(([id, nm]) => h('button', { class: 'char' + (st.char === id ? ' on' : ''), onclick: () => { st.char = id; save(); rerender(); cheer('happy'); }, html: mascotSVG('happy', id) + `<span class="xs">${nm}</span>` })))) : null,
      toggle('autoNext', '답 고르면 다음 문제로 자동으로', '객관식·주관식·R-type·문족에서 맞히면 잠깐 뒤 다음 문제로 넘어가요. 틀리면 넘어가지 않아요.'),
      h('div', { class: 'set-row' }, h('span', null, '기본 카드 색'), h('div', { class: 'row gap wrap' }, Object.entries(CARD_COLORS).map(([k, v]) =>
        h('button', { class: 'swatch sm' + (st.cardColor === k ? ' on' : ''), style: { background: v }, onclick: () => { st.cardColor = k; save(); rerender(); } })))),
      h('div', { class: 'set-row' }, h('span', null, '화면 테마'), h('select', { class: 'input auto', onchange: e => { st.theme = e.target.value; save(); applyTheme(); } },
        [['auto', '기기 설정 따르기'], ['light', '밝게'], ['dark', '어둡게']].map(([v, l]) => h('option', { value: v, selected: st.theme === v }, l))))),
    h('section', { class: 'card' },
      h('h3', null, '키보드 단축키 (PC)'),
      h('p', { class: 'muted sm' }, '키 칸을 누르고 원하는 키를 누르면 바뀌어요 (Esc 취소). 이미 쓰는 키를 고르면 두 키가 서로 바뀌어요. 보기는 숫자 키로 골라요.'),
      keys,
      h('button', { class: 'btn ghost sm', onclick: () => { st.keys = { ...DEFAULT_KEYS }; save(); rerender(); } }, '기본으로')),
    driveSection(),
    h('section', { class: 'card' },
      h('h3', null, '백업'),
      h('p', { class: 'muted sm' }, '모든 자료·사진·학습 기록은 이 브라우저에만 저장돼요. 다른 기기로 옮기거나 브라우저 데이터를 지우기 전에 백업 파일로 내보내세요.'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn primary sm', onclick: exportBackup }, '백업 파일로 내보내기'),
        h('button', { class: 'btn ghost sm', onclick: importBackup }, '백업 파일 불러오기'),
        h('button', { class: 'btn danger sm', onclick: wipeAll }, '모두 지우기'))),
    h('section', { class: 'card' },
      h('h3', null, '사용설명서'),
      h('button', { class: 'btn ghost sm', onclick: showGuide }, '사용설명서 보기')));
}

function driveSection() {
  const linked = Sync.linked();
  const hasId = !!Sync.clientId();
  const builtIn = typeof GOOGLE_CLIENT_ID !== 'undefined' && GOOGLE_CLIENT_ID;
  const idIn = h('input', { class: 'input sm', placeholder: '1234567890-xxxx.apps.googleusercontent.com', value: LS.get('client-id') || '' });
  return h('section', { class: 'card' },
    h('h3', null, 'Google 드라이브 동기화'),
    h('p', { class: 'muted sm' }, '내 구글 드라이브의 숨김 앱 폴더에 자료·사진·기록을 저장해요. PC와 폰에서 같은 계정으로 연결하면 서로 이어서 할 수 있고, 양쪽에서 바꾼 내용은 합쳐져요. 이 앱은 드라이브의 다른 파일을 볼 수 없어요.'),
    linked
      ? h('div', null,
          h('div', { class: 'set-row' }, h('div', null, h('b', null, '연결됨'), h('div', { class: 'muted sm' }, (LS.get('drive-email') || '') + (Sync.lastAt ? ' · 마지막 동기화 ' + timeAgo(Sync.lastAt) : ''))),
            h('div', { class: 'row gap' },
              h('button', { class: 'btn primary sm', onclick: () => Sync.tap() }, '지금 동기화'),
              h('button', { class: 'btn ghost sm', onclick: () => Sync.unlink() }, '연결 끊기'))),
          Sync.status === 'error' ? h('p', { class: 'sm noc' }, '마지막 동기화 실패: ' + Sync.err) : null)
      : h('div', null,
          !builtIn ? h('div', null,
            h('label', { class: 'lbl' }, 'Google OAuth 클라이언트 ID'), idIn,
            h('button', { class: 'btn ghost sm', style: { marginTop: '8px' }, onclick: () => { LS.set('client-id', idIn.value.trim()); toast('저장했어요'); rerender(); } }, '클라이언트 ID 저장')) : null,
          h('button', { class: 'btn primary sm', style: { marginTop: '10px' }, disabled: !hasId, onclick: () => Sync.link() }, 'Google 계정으로 연결')));
}

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function exportBackup() {
  toast('백업 파일을 만드는 중…', 5000);
  const keys = await imgKeys();
  const used = new Set();
  for (const it of Object.values(S.items)) { if (it.img) used.add(it.img); (it.imgs || []).forEach(x => used.add(x)); }
  const images = {};
  for (const k of keys) if (used.has(k)) { const b = await imgGet(k); if (b) images[k] = await blobToDataURL(b); }
  const blob = new Blob([JSON.stringify({ app: 'anat-daily', v: 1, at: new Date().toISOString(), state: S, images })], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `해부데일리_백업_${today()}.json` });
  document.body.append(a); a.click(); a.remove();
  LS.set('last-backup', Date.now());
  toast('내보냈어요');
}
async function importBackup() {
  const [f] = await pickFile('.json,application/json');
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch { return toast('백업 파일을 읽지 못했어요'); }
  if (data.app !== 'anat-daily' || !data.state) return toast('이 앱의 백업 파일이 아니에요');
  if (!await confirmBox('지금 있는 자료와 기록을 백업 파일 내용으로 바꿀까요?', '바꾸기', true)) return;
  for (const [k, u] of Object.entries(data.images || {})) { const b = await (await fetch(u)).blob(); await imgPut(k, b); }
  S = Object.assign(defaultState(), data.state);
  S.settings = Object.assign(defaultState().settings, data.state.settings || {});
  S.settings.keys = Object.assign({ ...DEFAULT_KEYS }, S.settings.keys || {});
  save(); applyTheme(); toast('불러왔어요'); rerender();
}
async function wipeAll() {
  if (!await confirmBox('모든 자료·사진·학습·기록을 지울까요? 되돌릴 수 없어요. 먼저 백업을 권해요.' + (Sync.linked() ? '\nGoogle 드라이브가 연결되어 있어서 드라이브와 다른 기기에서도 지워져요.' : ''), '모두 지우기', true)) return;
  for (const k of await imgKeys()) await imgDel(k);
  S = defaultState(); save(); applyTheme(); rerender(); toast('모두 지웠어요');
}

function showGuide() {
  modal('사용설명서', h('div', { class: 'guide' }, h('div', { html: `
<h3>1. 자료 넣기 (자료 탭)</h3>
<ul>
<li><b>PDF에서 가져오기</b>: 족보·플래시카드 PDF를 열고 쪽을 고르면 쪽마다 사진 자료가 돼요. 비밀번호가 걸린 PDF는 비밀번호를 물어봐요. 비밀번호는 저장되지 않아요.</li>
<li><b>사진 올리기</b>: 이미 ? 가 그려진 사진이면 정답만 적고, 깨끗한 사진이면 넣은 뒤 ? 상자를 그려요.</li>
<li><b>? 상자 그리기</b>: 사진 자료를 누르고, 가릴 이름 위를 끌어서 상자를 그린 다음 정답을 적어요. 한 사진에 이름 여러 개도 되고, 같은 이름이 두 곳이면 <b>+상자</b>로 더해요. ◀ ▶로 다음 쪽으로 넘어가며 이어서 그릴 수 있어요.</li>
<li><b>엑셀로 한꺼번에</b>: A열에 사진, B열에 정답을 한 줄에 하나씩 적어요. C·D·E열에 객관식 오답 보기를 적어도 돼요. 사진은 “셀 위에 올려두기”와 “셀에 배치” 둘 다 읽어요.</li>
<li><b>문족 문제</b> / <b>빈칸 카드</b>: 직접 만들어요. 빈칸 카드는 가릴 부분을 <code>[[ ]]</code>로 감싸고, 한 줄에 카드 하나씩 적어요.</li>
<li>폴더로 정리하고, ··· 버튼이나 [선택]으로 이동·복제·삭제해요.</li>
</ul>
<h3>2. 학습</h3>
<ul>
<li><b>+ 새 학습</b>에서 유형(사진/빈칸/문족)과 자료를 골라요. 폴더를 체크하면 통째로 들어가요.</li>
<li>빨간 상자의 이름을 속으로 말해 보고 → [정답 확인] → 바로 떠올렸으면 ✓, 몰랐거나 헷갈렸으면 ✕.</li>
<li>같은 사진의 다른 이름은 회색으로 가려져요. 사진을 누르면 크게 볼 수 있어요.</li>
<li>다음에는 <b>틀린 문제만</b>, <b>안 푼 문제만</b>, <b>지난번 하던 곳부터</b> 풀 수 있어요.</li>
</ul>
<h3>3. 퀴즈</h3>
<ul>
<li>객관식(보기 4개), 주관식(직접 입력), R-type(그 사진 이름 전부가 알파벳 순 목록), 문족 퀴즈.</li>
<li>순서(순서대로/랜덤), 문제당 제한시간, “ㅇㅇ개만 랜덤으로 뽑기”를 정할 수 있어요.</li>
<li>다 풀면 결과가 나오고, 틀린 문제만 다시 풀 수 있어요. <b>모아서 만들기</b>로 여러 퀴즈의 오답만 모을 수 있어요.</li>
</ul>
<h3>4. PC 단축키</h3>
<p>Space = 정답 확인 · Z = 틀림 · C = 맞음 · ← → = 이동 · 숫자 = 보기 고르기 · W = 해설. 설정에서 바꿀 수 있어요.</p>
<h3>5. 기록</h3>
<p>모든 것은 이 브라우저에 저장돼요. 기기를 바꿀 때는 설정 › 백업을 쓰세요.</p>` })), { wide: true });
}
