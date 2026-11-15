/* Google Drive sync: state + images in the user's own Drive "appDataFolder" (hidden app folder).
   Merge is 3-way (base = last synced snapshot on this device), so edits made on PC and phone are combined. */

/* ---------- pure merge ---------- */
function stable(v) {
  if (v === undefined) return '~';
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}
function merge3(b, l, r, both) {
  const sb = stable(b), lc = stable(l) !== sb, rc = stable(r) !== sb;
  if (!lc && !rc) return l;
  if (lc && !rc) return l;
  if (!lc && rc) return r;
  if (l !== undefined && r !== undefined) return both ? both(l, r, b) : l;
  return l !== undefined ? l : r; // one side deleted, other edited → keep the edit
}
function mergeMap(b = {}, l = {}, r = {}, both) {
  const out = {};
  for (const id of new Set([...Object.keys(l), ...Object.keys(r), ...Object.keys(b)])) {
    const v = merge3(b[id], l[id], r[id], both);
    if (v !== undefined) out[id] = v;
  }
  return out;
}
function mergeList(b = [], l = [], r = [], both) {
  const m = arr => Object.fromEntries(arr.map(x => [x.id, x]));
  const merged = mergeMap(m(b), m(l), m(r), both);
  const order = [...l.map(x => x.id), ...r.map(x => x.id)];
  return [...new Set(order)].filter(id => merged[id]).map(id => merged[id]);
}
function mergeDeck(l, r) {
  const d = JSON.parse(JSON.stringify(l));
  d.rec = Object.assign({}, r.rec || {}, l.rec || {});
  const qs = new Set(d.qs || []);
  for (const q of r.qs || []) if (!qs.has(q)) d.qs.push(q);
  const at = new Set((d.hist || []).map(x => x.at));
  d.hist = (d.hist || []).concat((r.hist || []).filter(x => !at.has(x.at))).sort((a, b) => a.at - b.at);
  d.pos = Math.max(l.pos || 0, r.pos || 0);
  return d;
}
function mergeStates(base, local, remote) {
  if (!remote) return JSON.parse(JSON.stringify(local));
  base = base || {};
  const out = {};
  out.v = 1;
  out.items = mergeMap(base.items, local.items, remote.items);
  out.folders = mergeList(base.folders, local.folders, remote.folders);
  out.decks = mergeList(base.decks, local.decks, remote.decks, mergeDeck);
  out.log = {};
  for (const day of new Set([...Object.keys(local.log || {}), ...Object.keys(remote.log || {})])) {
    const bv = (base.log || {})[day] || 0, lv = (local.log || {})[day] || 0, rv = (remote.log || {})[day] || 0;
    out.log[day] = Math.max(lv, rv, lv + rv - bv);
  }
  out.settings = merge3(base.settings, local.settings, remote.settings) || local.settings;
  // drop dangling folder refs
  const fids = new Set(out.folders.map(f => f.id));
  for (const f of out.folders) if (f.parent && !fids.has(f.parent)) f.parent = null;
  for (const it of Object.values(out.items)) if (it.folder && !fids.has(it.folder)) it.folder = null;
  return out;
}
function usedImages(st) {
  const s = new Set();
  for (const it of Object.values(st.items || {})) { if (it.img) s.add(it.img); (it.imgs || []).forEach(x => s.add(x)); }
  return s;
}

/* ---------- Drive REST ---------- */
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GDrive = {
  token: null,
  async req(url, opt = {}) {
    const res = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + this.token, ...(opt.headers || {}) } });
    if (res.status === 401) { Sync.dropToken(); throw new Error('AUTH'); }
    if (!res.ok) throw new Error('Drive ' + res.status + ' ' + (await res.text()).slice(0, 200));
    return res;
  },
  async list() {
    const files = []; let page = '';
    do {
      const r = await (await this.req('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,modifiedTime)' + (page ? '&pageToken=' + page : ''))).json();
      files.push(...r.files); page = r.nextPageToken;
    } while (page);
    return files;
  },
  async download(id, asBlob) {
    const r = await this.req(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    return asBlob ? r.blob() : r.text();
  },
  async create(name, blob) {
    const meta = { name, parents: ['appDataFolder'] };
    const fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    fd.append('file', blob);
    return (await this.req('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body: fd })).json();
  },
  async update(id, blob) {
    return this.req(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream' } });
  },
  async remove(id) { return this.req(`https://www.googleapis.com/drive/v3/files/${id}`, { method: 'DELETE' }); },
  async email() {
    try { const r = await (await this.req('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)')).json(); return r.user.emailAddress; } catch { return ''; }
  }
};

/* ---------- controller ---------- */
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem('anat-' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('anat-' + k, JSON.stringify(v)); } catch { } }
};
const Sync = {
  status: 'off', lastAt: LS.get('sync-last') || 0, running: false, again: false, timer: null, client: null, err: '',
  clientId() { return (typeof GOOGLE_CLIENT_ID !== 'undefined' && GOOGLE_CLIENT_ID) || LS.get('client-id') || ''; },
  linked() { return !!LS.get('drive-linked'); },
  init() {
    const t = LS.get('drive-token');
    if (t && t.exp > Date.now() + 60000) GDrive.token = t.token;
    this.setStatus(!this.linked() ? 'off' : GDrive.token ? 'idle' : 'needtap');
    if (this.linked() && GDrive.token) this.run();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && this.dirty) this.run(); });
    setInterval(() => { if (this.linked() && GDrive.token && document.visibilityState === 'visible') this.run(); }, 5 * 60 * 1000);
    setInterval(() => { if (this.status === 'idle') this.setStatus('idle'); }, 60 * 1000);
    document.getElementById('sync-btn').addEventListener('click', () => this.tap());
  },
  dropToken() { GDrive.token = null; LS.set('drive-token', null); if (this.linked()) this.setStatus('needtap'); },
  setStatus(s, err) {
    this.status = s; this.err = err || '';
    const b = document.getElementById('sync-btn'); if (!b) return;
    const ago = this.lastAt ? timeAgo(this.lastAt) : '';
    const map = { off: '', idle: '☁ ' + (ago ? ago + ' 동기화' : '동기화됨'), busy: '☁ 동기화 중…', needtap: '☁ 눌러서 동기화', error: '⚠ 동기화 실패' };
    b.textContent = map[s] || '';
    b.className = 'sync-btn ' + s;
    b.hidden = s === 'off';
    b.title = this.err || '';
  },
  gisReady() { return !!(window.google && google.accounts && google.accounts.oauth2); },
  getToken(interactive) {
    return new Promise((res, rej) => {
      const id = this.clientId();
      if (!id) return rej(new Error('NOCLIENT'));
      if (!this.gisReady()) return rej(new Error('GIS'));
      const client = google.accounts.oauth2.initTokenClient({
        client_id: id, scope: DRIVE_SCOPE,
        callback: r => {
          if (r.error) return rej(new Error(r.error));
          GDrive.token = r.access_token;
          LS.set('drive-token', { token: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 });
          res(r.access_token);
        },
        error_callback: e => rej(new Error(e.type || 'popup'))
      });
      client.requestAccessToken({ prompt: interactive === 'consent' ? 'consent' : '', hint: LS.get('drive-email') || undefined });
    });
  },
  async link() {
    if (!this.clientId()) return toast('먼저 Google 클라이언트 ID를 넣어주세요 (설정 › Google 드라이브)');
    try {
      await this.getToken('consent');
      LS.set('drive-linked', true);
      LS.set('drive-email', await GDrive.email());
      toast('Google 드라이브에 연결했어요');
      await this.run(true);
    } catch (e) { this.linkError(e); }
    rerenderIfIdle();
  },
  linkError(e) {
    const m = String(e.message || e);
    if (m === 'GIS') toast('Google 로그인 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요');
    else if (m === 'popup_closed' || m === 'popup_failed_to_open') toast('로그인 창이 닫혔거나 막혔어요. 팝업을 허용해 주세요');
    else if (m === 'access_denied') toast('권한을 허용하지 않았어요');
    else toast('연결하지 못했어요: ' + m, 4000);
  },
  async unlink() {
    if (!await confirmBox('Google 드라이브 연결을 끊을까요? 이 기기의 자료와 드라이브에 저장된 자료는 그대로 남아요.', '연결 끊기')) return;
    try { if (GDrive.token && this.gisReady()) google.accounts.oauth2.revoke(GDrive.token, () => { }); } catch { }
    LS.set('drive-linked', false); LS.set('drive-email', null); this.dropToken();
    await kvSet('syncBase', null);
    this.setStatus('off'); rerenderIfIdle();
  },
  async tap() {
    if (this.status === 'busy') return;
    if (!GDrive.token) { try { await this.getToken(); } catch (e) { return this.linkError(e); } }
    this.run(true);
  },
  dirty: false,
  schedule() {
    if (!this.linked()) return;
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), 4000);
  },
  async run(manual) {
    if (!this.linked()) return;
    if (!GDrive.token) { this.setStatus('needtap'); return; }
    if (this.running) { this.again = true; return; }
    if (topModalOpen() && !manual) { clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), 3000); return; }
    this.running = true; this.setStatus('busy');
    try {
      await this.syncOnce();
      this.dirty = false;
      this.lastAt = Date.now(); LS.set('sync-last', this.lastAt);
      this.setStatus('idle');
      if (manual) toast('동기화했어요');
    } catch (e) {
      console.error(e);
      if (String(e.message) === 'AUTH') this.setStatus('needtap');
      else this.setStatus('error', String(e.message || e));
    } finally {
      this.running = false;
      if (this.again) { this.again = false; setTimeout(() => this.run(), 500); }
    }
  },
  async syncOnce() {
    const files = await GDrive.list();
    const byName = {}; for (const f of files) byName[f.name] = f;
    const stateFile = byName['state.json'];
    const remote = stateFile ? JSON.parse(await GDrive.download(stateFile.id)) : null;
    const baseRaw = await kvGet('syncBase');
    const base = baseRaw ? JSON.parse(baseRaw) : null;
    const localSnap = JSON.parse(JSON.stringify(S));
    let mine = localSnap;
    if (!base && remote && Object.keys(remote.items || {}).length) {
      // first sync on this device: don't push this device's untouched sample data into an existing Drive
      mine = JSON.parse(JSON.stringify(localSnap));
      for (const [id, it] of Object.entries(mine.items)) if (it.demo) delete mine.items[id];
      mine.folders = mine.folders.filter(f => !f.demo);
      mine.decks = mine.decks.filter(d => !d.demo);
    }
    const merged = mergeStates(base, mine, remote);

    // images: upload local ones Drive lacks, download ones this device lacks
    const need = usedImages(merged);
    const localKeys = new Set(await imgKeys());
    let n = 0;
    for (const id of need) {
      const name = 'img_' + id;
      const b0 = document.getElementById('sync-btn');
      if (b0 && need.size > 5 && ++n % 5 === 0) b0.textContent = `☁ 사진 맞추는 중 ${n}/${need.size}`;
      if (!byName[name] && localKeys.has(id)) {
        const b = await imgGet(id);
        if (b) byName[name] = await GDrive.create(name, b);
      } else if (byName[name] && !localKeys.has(id)) {
        const b = await GDrive.download(byName[name].id, true);
        await imgPut(id, b);
      }
    }
    // upload merged state
    const blob = new Blob([JSON.stringify(merged)], { type: 'application/json' });
    if (stateFile) await GDrive.update(stateFile.id, blob); else await GDrive.create('state.json', blob);
    await kvSet('syncBase', JSON.stringify(merged));
    // remove images nobody uses any more
    for (const f of files) if (f.name.startsWith('img_') && !need.has(f.name.slice(4))) { try { await GDrive.remove(f.id); } catch { } }

    // apply to this device only if something changed and the user isn't mid-edit
    if (stable(merged) !== stable(localSnap)) {
      if (stable(S) !== stable(localSnap)) { this.again = true; return; } // edited during sync → merge again next round
      S.items = merged.items; S.folders = merged.folders; S.decks = merged.decks; S.log = merged.log;
      S.settings = Object.assign(defaultState().settings, merged.settings || {});
      S.settings.keys = Object.assign({ ...DEFAULT_KEYS }, S.settings.keys || {});
      migrateState();
      save(true); applyTheme(); rerenderIfIdle();
    }
  }
};
function rerenderIfIdle() { if (!topModalOpen()) rerender(); }
function timeAgo(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전'; return Math.floor(s / 86400) + '일 전';
}
