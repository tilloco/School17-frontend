/* School17 Teacher (Windows). Plain JS, no build step. All network calls go through the main process (window.desk). */
const root = document.getElementById('app');
const state = { token: null, me: null, classes: [], view: { type: 'none' }, uploads: [], alsoPost: true, cfg: null };
let uploadSeq = 0;

// ---------- tiny DOM helper ----------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const k in props || {}) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const $ = (sel, el = document) => el.querySelector(sel);
function fmtBytes(n) {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}
function toast(msg, bad) {
  const el = h('div', { class: 'toast' + (bad ? ' bad' : '') }, msg);
  document.body.append(el);
  setTimeout(() => el.remove(), 4500);
}
function errText(e) {
  if (!e) return t('errGeneric');
  const map = { NETWORK: 'errNetwork', TIMEOUT: 'errTimeout', VIDEO_URL_NOT_ALLOWED: 'urlBad', DUPLICATE_VIDEO: 'dup', TOO_MANY_VIDEOS: 'tooMany', CONTACT_INFO_NOT_ALLOWED: 'noContacts', TYPE_NOT_ALLOWED: 'typeNotAllowed', QUOTA_EXCEEDED: 'quota' };
  return (map[e.code] && t(map[e.code])) || e.message || t('errGeneric');
}

// ---------- API ----------
async function call(method, path, body) {
  const r = await window.desk.api({ method, path, body, token: state.token });
  if (!r.ok && r.status === 401 && state.token) { await logout(true); }
  return r;
}
const get = (p) => call('GET', p);
const post = (p, b) => call('POST', p, b || {});

// ---------- session ----------
async function logout(expired) {
  state.token = null; state.me = null; state.classes = []; state.view = { type: 'none' };
  await window.desk.setSession(null);
  renderLogin();
  if (expired === true) toast(t('signIn'), true);
}

async function enter(token) {
  state.token = token;
  const me = await get('/me');
  if (!me.ok) { state.token = null; return me; }
  if (me.data.role !== 'TEACHER') { state.token = null; return { ok: false, error: { message: t('teachersOnly') } }; }
  state.me = me.data;
  await window.desk.setSession(token);
  renderShell();
  await loadClasses();
  return { ok: true };
}

async function loadClasses() {
  const r = await get('/classes/mine');
  if (r.ok) state.classes = (r.data || []).filter((c) => c.status !== 'CANCELLED');
  else toast(errText(r.error), true);
  renderSidebar();
  if (state.view.type === 'none' && state.classes.length) openClass(state.classes[0].id);
  else if (state.view.type === 'none') renderMain();
}

// ---------- login ----------
function langSwitch() {
  return h('div', { class: 'langs' }, ['uz', 'ru', 'en'].map((l) => h('button', { class: 'chip' + (LANG === l ? ' on' : ''), onClick: async () => {
    setLang(l); const p = await window.desk.getPrefs(); p.lang = l; await window.desk.setPrefs(p);
    state.token ? (renderShell(), renderSidebar(), renderMain()) : renderLogin();
  } }, l.toUpperCase())));
}

function renderLogin(mode = 'phone', step = 'enter', phone = '') {
  const msg = h('div', { class: 'msg', role: 'alert' });
  const show = (m, bad = true) => { msg.textContent = m || ''; msg.className = 'msg' + (bad ? ' bad' : ''); };
  const busy = (btn, on) => { btn.disabled = on; btn.classList.toggle('busy', on); };

  const card = h('div', { class: 'card login' },
    h('img', { class: 'logo', src: 'logo.png', alt: '' }),
    h('h1', null, t('appName')),
    h('div', { class: 'tabs' },
      h('button', { class: mode === 'phone' ? 'on' : '', onClick: () => renderLogin('phone') }, t('phone')),
      h('button', { class: mode === 'email' ? 'on' : '', onClick: () => renderLogin('email') }, t('email'))),
  );

  if (mode === 'email') {
    const em = h('input', { type: 'email', placeholder: t('email'), autocomplete: 'username' });
    const pw = h('input', { type: 'password', placeholder: t('password'), autocomplete: 'current-password' });
    const go = h('button', { class: 'primary' }, t('signIn'));
    const submit = async () => {
      busy(go, true); show('');
      const r = await window.desk.api({ method: 'POST', path: '/auth/email/login', body: { email: em.value.trim(), password: pw.value } });
      if (!r.ok) { busy(go, false); return show(r.status === 401 || r.status === 400 ? t('errBadLogin') : errText(r.error)); }
      const e = await enter(r.data.accessToken);
      if (!e.ok) { busy(go, false); show(errText(e.error)); }
    };
    go.addEventListener('click', submit);
    pw.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    card.append(em, pw, go);
    setTimeout(() => em.focus());
  } else if (step === 'enter') {
    const ph = h('input', { type: 'tel', placeholder: t('phoneHint'), value: phone || '+998', autocomplete: 'tel' });
    const go = h('button', { class: 'primary' }, t('sendCode'));
    const submit = async () => {
      busy(go, true); show('');
      const num = ph.value.replace(/[^\d+]/g, '');
      const r = await window.desk.api({ method: 'POST', path: '/auth/phone/request', body: { phone: num } });
      busy(go, false);
      if (!r.ok) return show(errText(r.error));
      renderLogin('phone', 'code', num);
    };
    go.addEventListener('click', submit);
    ph.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    card.append(ph, go);
    setTimeout(() => { ph.focus(); ph.setSelectionRange(ph.value.length, ph.value.length); });
  } else {
    const cd = h('input', { type: 'text', inputmode: 'numeric', maxlength: '6', placeholder: t('code'), autocomplete: 'one-time-code', class: 'code' });
    const go = h('button', { class: 'primary' }, t('verify'));
    const submit = async () => {
      if (!/^\d{6}$/.test(cd.value.trim())) return;
      busy(go, true); show('');
      const r = await window.desk.api({ method: 'POST', path: '/auth/phone/verify', body: { phone, code: cd.value.trim() } });
      if (!r.ok) { busy(go, false); return show(errText(r.error)); }
      if (!r.data.accessToken) { busy(go, false); return show(t('needProfile')); }
      const e = await enter(r.data.accessToken);
      if (!e.ok) { busy(go, false); show(errText(e.error)); }
    };
    go.addEventListener('click', submit);
    cd.addEventListener('input', () => { if (cd.value.trim().length === 6) submit(); });
    cd.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    card.append(h('div', { class: 'hint' }, t('codeSent') + ' ' + phone), cd, go, h('button', { class: 'link', onClick: () => renderLogin('phone', 'enter', phone) }, t('back')));
    setTimeout(() => cd.focus());
  }
  card.append(msg);
  const srv = h('div', { class: 'srv' }, h('button', { class: 'link', onClick: () => {
    const i = h('input', { type: 'url', value: state.cfg.api, placeholder: 'https://...' });
    const ok = h('button', { class: 'small', onClick: async () => { const r = await window.desk.setServer(i.value); if (r.ok) { state.cfg.api = r.api; toast(r.api); renderLogin(mode, step, phone); } else toast('URL?', true); } }, t('save'));
    srv.replaceChildren(h('div', { class: 'row-in' }, i, ok));
  } }, t('server') + ': ' + state.cfg.api.replace(/^https?:\/\//, '')));
  root.replaceChildren(h('div', { class: 'center' }, card, langSwitch(), srv));
}

// ---------- shell ----------
function renderShell() {
  root.replaceChildren(h('div', { class: 'shell' },
    h('aside', { id: 'side' }),
    h('main', { id: 'main' }),
  ));
  renderSidebar();
  renderMain();
}

function initials(name) { return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); }
function hue(s) { let x = 0; for (const c of s || '') x = (x * 31 + c.charCodeAt(0)) % 360; return x; }
function avatar(text, size = 46) { return h('div', { class: 'avatar', style: `width:${size}px;height:${size}px;background:hsl(${hue(text)} 45% 42%)` }, initials(text)); }

function renderSidebar() {
  const side = $('#side'); if (!side) return;
  const v = state.view;
  side.replaceChildren(
    h('div', { class: 'me' }, avatar(state.me && state.me.name, 40), h('div', { class: 'grow' }, h('div', { class: 'name' }, state.me && state.me.name || ''), h('div', { class: 'sub' }, t('appName'))),
      h('button', { class: 'icon', title: t('reload'), onClick: loadClasses }, '↻'),
      h('button', { class: 'icon', title: t('logout'), onClick: () => logout() }, '⏻')),
    h('div', { class: 'list' },
      h('div', { class: 'section' }, t('myClasses')),
      state.classes.length ? state.classes.map((c) => h('button', { class: 'row' + (v.type === 'class' && v.id === c.id ? ' on' : ''), onClick: () => openClass(c.id) },
        avatar(c.title), h('div', { class: 'grow' }, h('div', { class: 'name' }, c.title), h('div', { class: 'sub' }, [c.subject, c.enrolled != null ? `${c.enrolled}/${c.capacity} ${t('pupils')}` : ''].filter(Boolean).join(' · '))),
        busyDot(c.id)))
        : h('div', { class: 'empty small' }, t('noClasses')),
      h('div', { class: 'section' }, t('topicVideos')),
      h('button', { class: 'row' + (v.type === 'topics' || v.type === 'topic' ? ' on' : ''), onClick: openTopics },
        h('div', { class: 'avatar', style: 'width:46px;height:46px;background:#c0392b' }, '▶'),
        h('div', { class: 'grow' }, h('div', { class: 'name' }, t('topicVideos')), h('div', { class: 'sub' }, t('topicVideosSub')))),
    ),
    h('div', { class: 'side-foot' }, langSwitch()),
  );
}
function busyDot(classId) { return state.uploads.some((u) => u.classId === classId && (u.status === 'up' || u.status === 'wait')) ? h('span', { class: 'dot' }) : null; }

function renderMain() {
  const main = $('#main'); if (!main) return;
  const v = state.view;
  if (v.type === 'class') return renderClass(main);
  if (v.type === 'topics') return renderTopics(main);
  if (v.type === 'topic') return renderTopic(main);
  main.replaceChildren(h('div', { class: 'empty' }, h('img', { class: 'logo', src: 'logo.png', alt: '' }), state.classes.length ? '' : t('noClasses')));
}

// ---------- class: upload + list ----------
async function openClass(id) {
  state.view = { type: 'class', id, files: null, error: null };
  renderSidebar(); renderMain();
  await refreshFiles();
}
async function refreshFiles() {
  const v = state.view; if (v.type !== 'class') return;
  const id = v.id;
  const r = await get(`/classes/${id}/files`);
  if (state.view.type !== 'class' || state.view.id !== id) return;
  if (r.ok) { v.files = r.data; v.error = null; } else { v.error = errText(r.error); }
  renderMain();
  // pages for non-video files are rendered in the background: look again shortly
  if (r.ok && r.data.some((f) => f.renderStatus === 'PREPARING')) setTimeout(() => { if (state.view === v) refreshFiles(); }, 4000);
}

function isMedia(f) { return /^(video|audio)\//.test(f.mime || '') || /\.(mp4|mov|mkv|webm|avi|m4v|mp3|m4a|wav)$/i.test(f.name || ''); }

function renderClass(main) {
  const v = state.view;
  const cls = state.classes.find((c) => c.id === v.id) || {};
  const input = h('input', { type: 'file', multiple: true, accept: 'video/*,audio/*', class: 'hidden' });
  const drop = h('div', { class: 'drop', tabindex: '0', role: 'button', onClick: async () => { const ps = await window.desk.pick(); addPaths(ps); } },
    h('div', { class: 'drop-ico' }, '⇧'), h('div', { class: 'drop-t' }, t('dropTitle')), h('div', { class: 'sub' }, t('dropSub')));
  drop.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && drop.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addPaths([...e.dataTransfer.files].map((f) => window.desk.pathOf(f))); });

  const ups = state.uploads.filter((u) => u.classId === v.id && u.status !== 'gone');
  const files = v.files;
  main.replaceChildren(
    h('header', { class: 'top' }, avatar(cls.title || '', 40), h('div', { class: 'grow' }, h('div', { class: 'name' }, cls.title || ''), h('div', { class: 'sub' }, cls.subject || ''))),
    h('div', { class: 'content' },
      drop,
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.alsoPost, onChange: (e) => { state.alsoPost = e.target.checked; } }), t('alsoPost')),
      ups.length ? h('div', { class: 'ups' }, ups.map(uploadRow)) : null,
      h('div', { class: 'section' }, t('videos'), files ? ` (${files.length})` : ''),
      v.error ? h('div', { class: 'msg bad' }, v.error, ' ', h('button', { class: 'link', onClick: refreshFiles }, t('retryLoad')))
        : !files ? h('div', { class: 'empty small' }, t('loading'))
        : !files.length ? h('div', { class: 'empty small' }, t('noVideos'))
        : h('div', { class: 'files' }, files.map(fileRow)),
    ),
  );
}

function uploadRow(u) {
  const pct = Math.round((u.frac || 0) * 100);
  const label = u.status === 'up' ? `${t('uploading')} ${pct}%` : u.status === 'wait' ? t('preparing') : u.status === 'done' ? t('done') : u.status === 'cancel' ? t('cancelled') : `${t('failed')}: ${u.error || ''}`;
  return h('div', { class: 'up ' + u.status },
    h('div', { class: 'grow' }, h('div', { class: 'name' }, u.name, h('span', { class: 'sub' }, ' ' + fmtBytes(u.size))), h('div', { class: 'bar' }, h('i', { style: `width:${u.status === 'done' ? 100 : pct}%` })), h('div', { class: 'sub' }, label)),
    (u.status === 'up' || u.status === 'wait') ? h('button', { class: 'small', onClick: () => cancelUpload(u) }, t('cancel'))
      : (u.status === 'fail' || u.status === 'cancel') ? [h('button', { class: 'small', onClick: () => startUpload(u) }, t('retry')), h('button', { class: 'icon', onClick: () => dismiss(u) }, '✕')]
      : h('button', { class: 'icon', onClick: () => dismiss(u) }, '✕'));
}
function dismiss(u) { u.status = 'gone'; state.uploads = state.uploads.filter((x) => x !== u); renderMain(); }

function fileRow(f) {
  const media = isMedia(f);
  return h('div', { class: 'file' },
    h('div', { class: 'thumb' }, media ? '▶' : '☰'),
    h('div', { class: 'grow' }, h('div', { class: 'name' }, f.name), h('div', { class: 'sub' }, [fmtBytes(f.sizeBytes), f.renderStatus === 'PREPARING' && !media ? t('preparing') : ''].filter(Boolean).join(' · '))),
    media ? h('button', { class: 'small', onClick: () => playFile(f) }, t('play')) : null,
    h('label', { class: 'check inline', title: t('allowDl') }, h('input', { type: 'checkbox', checked: f.allowDownload, onChange: async (e) => {
      const r = await call('PATCH', `/classes/${state.view.id}/files/${f.id}`, { allowDownload: e.target.checked });
      if (!r.ok) { toast(errText(r.error), true); e.target.checked = !e.target.checked; } else f.allowDownload = e.target.checked;
    } }), t('allowDl')),
    h('button', { class: 'small danger', onClick: async () => {
      if (!confirm(t('confirmRemove') + '\n' + f.name)) return;
      const r = await call('DELETE', `/classes/${state.view.id}/files/${f.id}`);
      if (!r.ok) return toast(errText(r.error), true);
      refreshFiles();
    } }, t('remove')));
}

async function playFile(f) {
  const r = await post(`/classes/${state.view.id}/files/${f.id}/stream-url`);
  if (!r.ok) return toast(errText(r.error), true);
  const url = r.data.url.startsWith('/') ? state.cfg.api + r.data.url : r.data.url;
  const media = /^audio\//.test(r.data.mime || '') ? 'audio' : 'video';
  const el = h(media, { src: url, controls: true, autoplay: true });
  const close = () => { el.pause(); ov.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => e.key === 'Escape' && close();
  const ov = h('div', { class: 'overlay', onClick: (e) => e.target === ov && close() }, h('div', { class: 'player' }, h('div', { class: 'player-top' }, h('span', null, f.name), h('button', { class: 'small', onClick: close }, t('close'))), el));
  document.addEventListener('keydown', esc);
  document.body.append(ov);
}

function addPaths(paths) {
  const v = state.view; if (v.type !== 'class') return;
  (async () => {
    for (const p of paths) {
      const info = await window.desk.fileInfo(p);
      if (!info) continue;
      const u = { id: 'u' + (++uploadSeq), classId: v.id, path: info.path, name: info.name, size: info.size, frac: 0, status: 'wait' };
      state.uploads.push(u);
    }
    renderMain(); renderSidebar();
    pump();
  })();
}

// one upload runs at a time per app (simple and gentle on the connection)
let pumping = false;
async function pump() {
  if (pumping) return; pumping = true;
  try {
    for (let u; (u = state.uploads.find((x) => x.status === 'wait'));) await startUpload(u, true);
  } finally { pumping = false; }
}
async function startUpload(u, fromPump) {
  if (!fromPump && u.status !== 'fail' && u.status !== 'cancel') return;
  u.status = 'up'; u.error = ''; u.frac = u.frac || 0;
  renderMain(); renderSidebar();
  const r = await window.desk.upload({ id: u.id, token: state.token, filePath: u.path, resumeFileId: u.fileId });
  if (!r.ok) {
    if (r.fileId) u.fileId = r.fileId;
    if (r.error.code === 'CANCELLED') { u.status = 'cancel'; u.fileId = null; }
    else { u.status = 'fail'; u.error = errText(r.error); }
    renderMain(); renderSidebar();
    return;
  }
  u.fileId = r.fileId; u.frac = 1;
  const add = await post(`/classes/${u.classId}/files`, { fileId: r.fileId });
  if (!add.ok) { u.status = 'fail'; u.error = errText(add.error); renderMain(); renderSidebar(); return; }
  u.fileId = null;
  if (state.alsoPost) {
    const p = await post(`/classes/${u.classId}/channel`, { body: `▶ ${t('newVideo')}: ${u.name.replace(/\.[^.]+$/, '')}` });
    if (!p.ok) toast(errText(p.error), true);
  }
  u.status = 'done';
  if (!fromPump) pump();
  if (state.view.type === 'class' && state.view.id === u.classId) refreshFiles();
  renderSidebar();
  setTimeout(() => { if (u.status === 'done') dismiss(u); }, 6000);
}
function cancelUpload(u) {
  if (u.status === 'wait') { u.status = 'cancel'; renderMain(); return; }
  window.desk.cancelUpload(u.id);
}

// ---------- topic videos (links) ----------
async function openTopics() {
  state.view = { type: 'topics', q: '', subject: '', items: null, error: null };
  renderSidebar(); renderMain();
  await loadTopics();
}
async function loadTopics() {
  const v = state.view; if (v.type !== 'topics') return;
  const qs = new URLSearchParams(); if (v.q) qs.set('q', v.q); if (v.subject) qs.set('subject', v.subject);
  const r = await get('/topics?' + qs);
  if (state.view !== v) return;
  if (r.ok) { v.items = r.data; v.error = null; } else v.error = errText(r.error);
  renderTopicList();
}
let topicTimer;
function renderTopics(main) {
  const v = state.view;
  const search = h('input', { type: 'search', placeholder: t('search'), value: v.q, onInput: (e) => { v.q = e.target.value.trim(); clearTimeout(topicTimer); topicTimer = setTimeout(loadTopics, 350); } });
  main.replaceChildren(
    h('header', { class: 'top' }, h('div', { class: 'avatar', style: 'width:40px;height:40px;background:#c0392b' }, '▶'), h('div', { class: 'grow' }, h('div', { class: 'name' }, t('topicVideos')), h('div', { class: 'sub' }, t('topicVideosSub')))),
    h('div', { class: 'content' }, search, h('div', { id: 'subjects', class: 'chips' }), h('div', { id: 'topiclist', class: 'files' })),
  );
  renderTopicList();
  setTimeout(() => search.focus());
}
function renderTopicList() {
  const v = state.view; const list = $('#topiclist'); if (!list || v.type !== 'topics') return;
  const subjects = [...new Set((v.items || []).map((x) => x.subject))];
  if (!v.allSubjects || subjects.length > v.allSubjects.length) v.allSubjects = subjects;
  const chips = $('#subjects');
  if (chips) chips.replaceChildren(...(v.allSubjects.length > 1 ? [h('button', { class: 'chip' + (!v.subject ? ' on' : ''), onClick: () => { v.subject = ''; loadTopics(); } }, t('all')), ...v.allSubjects.map((s) => h('button', { class: 'chip' + (v.subject === s ? ' on' : ''), onClick: () => { v.subject = s; loadTopics(); } }, s))] : []));
  list.replaceChildren(...(v.error ? [h('div', { class: 'msg bad' }, v.error, ' ', h('button', { class: 'link', onClick: loadTopics }, t('retryLoad')))]
    : !v.items ? [h('div', { class: 'empty small' }, t('loading'))]
    : !v.items.length ? [h('div', { class: 'empty small' }, t('noTopics'))]
    : v.items.map((x) => h('button', { class: 'file click', onClick: () => openTopic(x.slug) },
      h('div', { class: 'thumb' }, '▶'), h('div', { class: 'grow' }, h('div', { class: 'name' }, x.title), h('div', { class: 'sub' }, `${x.subject} · ${x.videos} ${t('videos').toLowerCase()}`)), h('span', { class: 'sub' }, '›')))));
}

async function openTopic(slug) {
  state.view = { type: 'topic', slug, data: null, error: null, lang: LANG };
  renderSidebar(); renderMain();
  const r = await get('/topics/' + encodeURIComponent(slug));
  if (state.view.type !== 'topic' || state.view.slug !== slug) return;
  if (r.ok) state.view.data = r.data; else state.view.error = errText(r.error);
  renderMain();
}
function renderTopic(main) {
  const v = state.view; const d = v.data;
  const url = h('input', { type: 'url', placeholder: 'https://youtu.be/...' });
  const title = h('input', { type: 'text', maxlength: '120', placeholder: t('vTitle') });
  let lang = ['uz', 'ru', 'en'].includes(v.lang) ? v.lang : 'uz';
  const langRow = h('div', { class: 'chips' });
  const drawLang = () => langRow.replaceChildren(...['uz', 'ru', 'en'].map((l) => h('button', { class: 'chip' + (lang === l ? ' on' : ''), onClick: () => { lang = l; v.lang = l; drawLang(); } }, l.toUpperCase())));
  drawLang();
  const save = h('button', { class: 'primary' }, t('save'));
  const msg = h('div', { class: 'msg' });
  save.addEventListener('click', async () => {
    if (url.value.trim().length < 10 || title.value.trim().length < 3) { msg.className = 'msg bad'; msg.textContent = `${t('url')} / ${t('vTitle')}`; return; }
    save.disabled = true; msg.textContent = '';
    const r = await post(`/topics/${v.slug}/videos`, { url: url.value.trim(), title: title.value.trim(), lang });
    save.disabled = false;
    if (!r.ok) { msg.className = 'msg bad'; msg.textContent = r.status === 403 ? t('verifiedOnly') : errText(r.error); return; }
    toast(t('saved')); openTopic(v.slug);
  });
  main.replaceChildren(
    h('header', { class: 'top' }, h('button', { class: 'icon', title: t('back'), onClick: openTopics }, '←'), h('div', { class: 'grow' }, h('div', { class: 'name' }, d ? d.title : ''), h('div', { class: 'sub' }, d ? d.subject : ''))),
    h('div', { class: 'content' },
      h('div', { class: 'card form' }, h('div', { class: 'section nomargin' }, t('addVideo')), h('label', null, t('url'), url), h('label', null, t('vTitle'), title), h('label', null, t('vLang'), langRow), save, msg),
      h('div', { class: 'section' }, t('videos'), d ? ` (${d.videos.length})` : ''),
      v.error ? h('div', { class: 'msg bad' }, v.error)
        : !d ? h('div', { class: 'empty small' }, t('loading'))
        : !d.videos.length ? h('div', { class: 'empty small' }, t('noVideos'))
        : h('div', { class: 'files' }, d.videos.map((x) => h('div', { class: 'file' },
          h('div', { class: 'thumb' }, '▶'),
          h('div', { class: 'grow' }, h('div', { class: 'name' }, x.title), h('div', { class: 'sub' }, [x.lang.toUpperCase(), x.by && x.by.name, x.mine ? t('mine') : ''].filter(Boolean).join(' · '))),
          h('button', { class: 'small', onClick: () => window.desk.openExternal(x.url) }, t('open')),
          x.mine ? h('button', { class: 'small danger', onClick: async () => {
            if (!confirm(t('confirmRemove') + '\n' + x.title)) return;
            const r = await call('DELETE', `/topics/videos/${x.id}`);
            if (!r.ok) return toast(errText(r.error), true);
            openTopic(v.slug);
          } }, t('remove')) : null))),
    ),
  );
}

// ---------- start ----------
(async function init() {
  state.cfg = await window.desk.config();
  const prefs = await window.desk.getPrefs();
  setLang(prefs.lang || (/^ru/i.test(navigator.language) ? 'ru' : /^en/i.test(navigator.language) ? 'en' : 'uz'));
  window.desk.onProgress((m) => {
    const u = state.uploads.find((x) => x.id === m.id); if (!u) return;
    u.frac = m.frac;
    const row = state.view.type === 'class' && document.querySelectorAll('.up');
    if (row) renderMainThrottled();
  });
  root.replaceChildren(h('div', { class: 'center' }, h('img', { class: 'logo', src: 'logo.png', alt: '' }), h('div', { class: 'sub' }, t('loading'))));
  const saved = await window.desk.getSession();
  if (saved) {
    const e = await enter(saved);
    if (e.ok) return;
    if (e.error && (e.error.code === 'NETWORK' || e.error.code === 'TIMEOUT')) { renderLogin(); return toast(errText(e.error), true); }
    await window.desk.setSession(null);
  }
  renderLogin();
})();

let throttle = 0;
function renderMainThrottled() {
  const now = Date.now(); if (now - throttle < 250) return; throttle = now;
  const ups = $('.ups');
  if (!ups) return;
  const list = state.uploads.filter((u) => u.classId === state.view.id && u.status !== 'gone');
  ups.replaceChildren(...list.map(uploadRow));
}
