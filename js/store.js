/* Storage: one JSON state blob + image blobs, both in IndexedDB. */
const DB_NAME = 'anat-daily';
let _db = null;

function idb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('img')) d.createObjectStore('img');
    };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
function idbOp(store, mode, fn) {
  return idb().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req && req.result);
    tx.onerror = () => rej(tx.error);
  }));
}
const kvGet = k => idbOp('kv', 'readonly', s => s.get(k));
const kvSet = (k, v) => idbOp('kv', 'readwrite', s => s.put(v, k));
const imgGet = k => idbOp('img', 'readonly', s => s.get(k));
const imgPut = (k, blob) => idbOp('img', 'readwrite', s => s.put(blob, k));
const imgDel = k => idbOp('img', 'readwrite', s => s.delete(k));
const imgKeys = () => idbOp('img', 'readonly', s => s.getAllKeys());

const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const DEFAULT_KEYS = {
  reveal: ' ', wrong: 'z', right: 'c', prev: 'ArrowLeft', next: 'ArrowRight', expl: 'w'
};
function defaultState() {
  return {
    v: 1,
    folders: [],            // {id, name, parent}
    items: {},              // id -> item
    decks: [],              // study / quiz sets
    log: {},                // 'YYYY-MM-DD' -> answered count
    settings: {
      cheer: true, char: 'bone', autoNext: false, cardColor: 'blue',
      keys: { ...DEFAULT_KEYS }, theme: 'auto'
    }
  };
}

let S = defaultState();
let _saveTimer = null;
function save(fromSync) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => kvSet('state', JSON.stringify(S)).catch(e => toast('저장하지 못했어요: ' + e.message)), 250);
  if (!fromSync && window.Sync) Sync.schedule();
}
async function loadState() {
  try {
    const raw = await kvGet('state');
    if (raw) {
      const d = JSON.parse(raw);
      S = Object.assign(defaultState(), d);
      S.settings = Object.assign(defaultState().settings, d.settings || {});
      S.settings.keys = Object.assign({ ...DEFAULT_KEYS }, (d.settings || {}).keys || {});
      migrateState();
      return false;
    }
  } catch (e) { console.error(e); }
  return true; // first run
}

/* older versions marked demo data with `sample: true`, which clashed with a deck's "N개만 랜덤" count */
function migrateState() {
  const fix = o => { if (o && o.sample === true) { o.demo = true; delete o.sample; } };
  S.folders.forEach(fix); Object.values(S.items).forEach(fix);
  S.decks.forEach(d => { if (d.sample === true) { d.demo = true; d.sample = 0; d.qs = []; } });
}

/* image object-URL cache */
const _urls = {};
async function imgURL(id) {
  if (!id) return '';
  if (_urls[id]) return _urls[id];
  const b = await imgGet(id);
  if (!b) return '';
  return (_urls[id] = URL.createObjectURL(b));
}
async function storeImage(blob) {
  const id = uid('i');
  await imgPut(id, blob);
  return id;
}

/* ---------- item / question helpers ---------- */
// Item types: photo {img, w, h, labels:[{id, answer, boxes:[[x,y,w,h] normalized], wrong:[]}]}
//             jokbo {stem, data, imgs:[], choices:[], answers:[1-based], atext, ex, lecture, year, prof, note}
//             cloze {text with [[blank]], lecture}
function itemQids(it) {
  if (!it) return [];
  if (it.type === 'photo') return it.labels.filter(l => (l.answer || '').trim()).map(l => it.id + '#' + l.id);
  return [it.id];
}
function resolveQ(qid) {
  const [iid, lid] = qid.split('#');
  const it = S.items[iid];
  if (!it) return null;
  if (lid) {
    const label = it.labels.find(l => l.id === lid);
    if (!label) return null;
    return { item: it, label };
  }
  return { item: it };
}
function folderChildren(fid) { return S.folders.filter(f => (f.parent || null) === (fid || null)); }
function folderItems(fid) { return Object.values(S.items).filter(i => (i.folder || null) === (fid || null)); }
function folderDescItems(fid) {
  let out = folderItems(fid);
  for (const c of folderChildren(fid)) out = out.concat(folderDescItems(c.id));
  return out;
}
function folderPath(fid) {
  const p = []; let f = S.folders.find(x => x.id === fid);
  while (f) { p.unshift(f); f = S.folders.find(x => x.id === f.parent); }
  return p;
}
function itemTitle(it) {
  if (it.name) return it.name;
  if (it.type === 'jokbo') return (it.stem || '').slice(0, 40) || '문족 문제';
  if (it.type === 'cloze') return (it.text || '').replace(/\[\[|\]\]/g, '').slice(0, 40) || '빈칸 카드';
  return '사진';
}
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
async function deleteItems(ids) {
  for (const id of ids) {
    const it = S.items[id];
    if (!it) continue;
    const imgs = it.type === 'photo' ? [it.img] : (it.imgs || []);
    delete S.items[id];
    for (const im of imgs) if (im && !Object.values(S.items).some(o => o.img === im || (o.imgs || []).includes(im))) imgDel(im);
    for (const d of S.decks) {
      d.src = d.src.filter(x => x !== id);
      d.qs = d.qs.filter(q => q.split('#')[0] !== id);
    }
  }
  save();
}
