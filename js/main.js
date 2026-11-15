/* App shell: tabs, rendering, first-run sample data */
let TAB = 'study';
try { TAB = localStorage.getItem('anat-tab') || 'study'; } catch { }

function rerender() {
  const v = $('#view');
  const y = window.scrollY;
  v.innerHTML = '';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === TAB));
  if (TAB === 'study') renderDecks(v, 'study');
  else if (TAB === 'quiz') renderDecks(v, 'quiz');
  else if (TAB === 'library') renderLibrary(v);
  else renderSettings(v);
  window.scrollTo(0, y);
}
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  TAB = b.dataset.tab;
  try { localStorage.setItem('anat-tab', TAB); } catch { }
  window.scrollTo(0, 0); rerender();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && topModalOpen()) { e.preventDefault(); closeTopModal(); }
});

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 700" width="600" height="700">
<rect width="600" height="700" fill="#fbfaf7"/>
<g stroke="#b9a27a" stroke-linecap="round" fill="#f3ead8">
<path d="M110 92 Q200 70 300 84" stroke-width="16" fill="none"/>
<polygon points="140,112 262,104 190,268" stroke-width="4"/>
<rect x="202" y="108" width="30" height="236" rx="15" stroke-width="4"/>
<path d="M206 356 L188 566" stroke-width="18"/>
<path d="M234 356 L254 566" stroke-width="16"/>
<circle cx="200" cy="588" r="10" stroke-width="3"/><circle cx="222" cy="584" r="10" stroke-width="3"/><circle cx="244" cy="588" r="10" stroke-width="3"/><circle cx="212" cy="606" r="9" stroke-width="3"/><circle cx="234" cy="606" r="9" stroke-width="3"/>
<path d="M196 620 L188 690 M212 622 L208 692 M228 622 L230 692 M244 620 L252 688 M258 612 L284 660" stroke-width="8"/>
</g>
<g stroke="#64748b" stroke-width="1.5">
<line x1="260" y1="86" x2="410" y2="90"/><line x1="200" y1="190" x2="410" y2="170"/><line x1="232" y1="260" x2="410" y2="300"/>
<line x1="198" y1="470" x2="410" y2="450"/><line x1="250" y1="520" x2="410" y2="500"/><line x1="246" y1="590" x2="410" y2="590"/><line x1="252" y1="672" x2="410" y2="660"/>
</g>
<g font-family="Arial, sans-serif" font-size="22" fill="#1f2937">
<text x="418" y="98">Clavicle</text><text x="418" y="178">Scapula</text><text x="418" y="308">Humerus</text>
<text x="418" y="458">Ulna</text><text x="418" y="508">Radius</text><text x="418" y="598">Carpal bones</text><text x="418" y="668">Phalanges</text>
</g>
<text x="24" y="40" font-family="Arial, sans-serif" font-size="18" fill="#94a3b8">예시 그림 · 오른쪽 위팔 뼈대 (단순화)</text>
</svg>`;

async function seedSample() {
  const fid = uid('f');
  S.folders.push({ id: fid, name: '예시 자료 (지워도 돼요)', parent: null });
  const blob = new Blob([SAMPLE_SVG], { type: 'image/svg+xml' });
  const img = await storeImage(blob);
  const ys = [[90, 'Clavicle'], [170, 'Scapula'], [300, 'Humerus'], [450, 'Ulna'], [500, 'Radius'], [590, 'Carpal bones'], [660, 'Phalanges']];
  const photo = addItem({
    type: 'photo', img, w: 600, h: 700, name: '상지 뼈대 예시', folder: fid,
    labels: ys.map(([y, a]) => ({ id: uid('l'), answer: a, boxes: [[+(410 / 600).toFixed(4), +((y - 24) / 700).toFixed(4), +(180 / 600).toFixed(4), +(34 / 700).toFixed(4)]], wrong: [] }))
  });
  const j1 = addItem({ type: 'jokbo', folder: fid, lecture: '상지 신경 (예시)', year: '', prof: '', note: '예시 A-type',
    stem: '다음 중 근피신경(musculocutaneous nerve)의 지배를 받는 근육은?', data: '', imgs: [],
    choices: ['Triceps brachii', 'Biceps brachii', 'Deltoid', 'Brachioradialis', 'Supinator'], answers: [2], atext: '',
    ex: '근피신경은 팔 앞칸의 **굽힘근**(coracobrachialis, biceps brachii, brachialis)을 지배해요.\n삼두근·위팔노근·뒤침근은 요골신경, 어깨세모근은 겨드랑신경이에요.' });
  const j2 = addItem({ type: 'jokbo', folder: fid, lecture: '어깨 (예시)', year: '', prof: '', note: '예시 R-type',
    stem: '돌림근띠(rotator cuff)를 이루는 근육을 모두 고르시오.', data: '', imgs: [],
    choices: ['Supraspinatus', 'Teres major', 'Infraspinatus', 'Teres minor', 'Subscapularis'], answers: [1, 3, 4, 5], atext: '',
    ex: '돌림근띠는 **SITS**: Supraspinatus, Infraspinatus, Teres minor, Subscapularis.\nTeres major는 포함되지 않아요.' });
  const cl = [
    '상완이두근은 [[근피신경]]의 지배를 받고, 주된 작용은 팔꿈치 굽힘과 [[뒤침(supination)]]이다',
    '위팔뼈 [[외과목(surgical neck)]] 골절 시 [[겨드랑신경]]이 손상될 수 있다',
    '손목굴(carpal tunnel)을 지나는 신경은 [[정중신경]]이다'
  ].map(text => addItem({ type: 'cloze', folder: fid, text, lecture: '상지 (예시)' }));
  const mk = (kind, type, name, src) => { const d = { id: uid('d'), kind, type, name, order: 'seq', time: 0, sample: 0, src, qs: [], rec: {}, pos: 0, fav: false, created: Date.now(), hist: [] }; syncQs(d, true); S.decks.push(d); };
  mk('study', 'photo', '예시 · 상지 뼈대 사진 학습', [photo.id]);
  mk('study', 'cloze', '예시 · 상지 빈칸 학습', cl.map(c => c.id));
  mk('quiz', 'mcq', '예시 · 상지 뼈대 객관식', [photo.id]);
  mk('quiz', 'jokbo', '예시 · 상지 문족 퀴즈', [j1.id, j2.id]);
  // mark sample data so a new device joining Drive sync doesn't duplicate it
  S.folders.find(f => f.id === fid).demo = true;
  Object.values(S.items).forEach(i => i.demo = true);
  S.decks.forEach(d => d.demo = true);
  save();
}

(async function init() {
  const first = await loadState();
  if (first) await seedSample();
  applyTheme();
  rerender();
  Sync.init();
  // ask the browser not to evict this site's data (esp. mobile)
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { }
  // backup reminder when not synced to Drive
  const last = LS.get('last-backup') || LS.get('first-run') || (LS.set('first-run', Date.now()), Date.now());
  if (!Sync.linked() && Object.keys(S.items).length > 8 && Date.now() - last > 7 * 86400000) {
    setTimeout(() => toast('마지막 백업 뒤 일주일이 지났어요. 설정 › 백업이나 Google 드라이브 연결을 권해요', 5000), 1500);
  }
})();
