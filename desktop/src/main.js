const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell, Menu, session } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_API = 'https://mamun2appforuse.onrender.com';
const clean = (u) => String(u || '').trim().replace(/\/+$/, '');
let API = clean(process.env.SCHOOL17_API_URL) || DEFAULT_API;
const VIDEO_EXT = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'mp3', 'm4a', 'wav'];
const MIME = { mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', webm: 'video/webm', avi: 'video/x-msvideo', m4v: 'video/x-m4v', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav' };

let win;
const store = () => path.join(app.getPath('userData'), 'session.bin');
const prefsFile = () => path.join(app.getPath('userData'), 'prefs.json');
const deviceFile = () => path.join(app.getPath('userData'), 'device.txt');

function deviceId() {
  try { const s = fs.readFileSync(deviceFile(), 'utf8').trim(); if (/^[A-Za-z0-9_-]{16,64}$/.test(s)) return s; } catch { /* make a new one */ }
  const id = crypto.randomBytes(18).toString('hex');
  try { fs.writeFileSync(deviceFile(), id); } catch { /* not remembered */ }
  return id;
}

async function http(method, p, { body, token, headers, timeout = 60000 } = {}) {
  const h = { 'Content-Type': 'application/json', ...(headers || {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(API + p, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, signal: ctl.signal });
    const isJson = (res.headers.get('content-type') || '').includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : {};
    if (!res.ok) return { ok: false, status: res.status, error: { message: Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Error', code: data.code } };
    return { ok: true, data };
  } catch (e) {
    const code = e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    return { ok: false, status: 0, error: { message: code, code } };
  } finally { clearTimeout(timer); }
}

// the free server may be asleep: reads are tried again a few times
async function httpRetry(method, p, opts) {
  let r = await http(method, p, opts);
  for (let i = 0; i < 2 && !r.ok && r.status === 0 && method === 'GET'; i++) { await new Promise((s) => setTimeout(s, 1500)); r = await http(method, p, opts); }
  return r;
}

ipcMain.handle('api', (_e, a) => {
  const headers = a.path.startsWith('/auth/phone/request') ? { 'X-Device-Id': deviceId() } : undefined;
  return httpRetry(a.method || 'GET', a.path, { body: a.body, token: a.token, headers });
});

ipcMain.handle('config', () => ({ api: API, version: app.getVersion() }));
ipcMain.handle('server:set', (_e, url) => {
  const u = clean(url) || DEFAULT_API;
  if (!/^https?:\/\/[^\s/]+/i.test(u)) return { ok: false };
  API = u;
  try { const p = JSON.parse(fs.readFileSync(prefsFile(), 'utf8')); p.server = u; fs.writeFileSync(prefsFile(), JSON.stringify(p)); } catch { try { fs.writeFileSync(prefsFile(), JSON.stringify({ server: u })); } catch { /* ignore */ } }
  return { ok: true, api: API };
});

ipcMain.handle('session:get', () => {
  try {
    const raw = fs.readFileSync(store());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
  } catch { return null; }
});
ipcMain.handle('session:set', (_e, token) => {
  try {
    if (!token) { fs.rmSync(store(), { force: true }); return true; }
    fs.writeFileSync(store(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(token) : Buffer.from(token));
  } catch { /* not remembered */ }
  return true;
});
ipcMain.handle('prefs:get', () => { try { return JSON.parse(fs.readFileSync(prefsFile(), 'utf8')); } catch { return {}; } });
ipcMain.handle('prefs:set', (_e, p) => { try { fs.writeFileSync(prefsFile(), JSON.stringify(p)); } catch { /* ignore */ } return true; });

ipcMain.handle('pick', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Video', extensions: VIDEO_EXT }, { name: 'All', extensions: ['*'] }] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('open-external', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

ipcMain.handle('fileinfo', (_e, p) => {
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return null;
    return { path: p, name: path.basename(p), size: st.size };
  } catch { return null; }
});

const cancelled = new Set();
ipcMain.handle('upload:cancel', (_e, id) => { cancelled.add(id); });

// Chunked, resumable upload (same protocol as the phone app): init -> PUT 1 MiB pieces -> complete
ipcMain.handle('upload', async (e, { id, token, filePath, resumeFileId }) => {
  const send = (frac) => { try { e.sender.send('upload:progress', { id, frac }); } catch { /* window closed */ } };
  const err = (code, message, fileId) => ({ ok: false, error: { code, message }, fileId });
  let fd;
  try {
    const st = fs.statSync(filePath);
    if (!st.size) return err('EMPTY_FILE', 'The file is empty');
    const name = path.basename(filePath);
    const ext = path.extname(name).slice(1).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const init = resumeFileId
      ? await http('POST', `/files/${resumeFileId}/resume`, { token, body: {} })
      : await http('POST', '/files/init', { token, body: { purpose: 'CLASS_FILE', name, size: st.size, mime } });
    if (!init.ok) return err(init.error.code || 'INIT_FAILED', init.error.message);
    const info = init.data;
    const total = info.chunkCount;
    let done = total - info.parts.length;
    send(done / total);
    fd = await fs.promises.open(filePath, 'r');
    const queue = [...info.parts];
    let failed = null;
    const worker = async () => {
      while (queue.length && !failed) {
        if (cancelled.has(id)) { failed = err('CANCELLED', 'cancelled', info.fileId); return; }
        const part = queue.shift();
        const start = part.index * info.chunkSize;
        const len = Math.min(st.size - start, info.chunkSize);
        const buf = Buffer.alloc(len);
        await fd.read(buf, 0, len, start);
        let ok = false;
        for (let attempt = 0; attempt < 5 && !ok; attempt++) {
          try {
            const res = await fetch(API + part.url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: buf });
            ok = res.ok;
          } catch { /* network blink: try again */ }
          if (!ok) await new Promise((s) => setTimeout(s, 800 * (attempt + 1)));
        }
        if (!ok) { failed = err('CHUNK_FAILED', 'Upload interrupted', info.fileId); return; }
        send(++done / total);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (failed) {
      if (failed.error.code === 'CANCELLED') await http('POST', `/files/${info.fileId}/cancel`, { token, body: {} });
      return failed;
    }
    const fin = await http('POST', `/files/${info.fileId}/complete`, { token, body: {}, timeout: 600000 });
    if (!fin.ok) return err(fin.error.code || 'COMPLETE_FAILED', fin.error.message, info.fileId);
    return { ok: true, fileId: info.fileId };
  } catch (x) {
    return err('READ_FAILED', String((x && x.message) || x));
  } finally {
    cancelled.delete(id);
    if (fd) await fd.close().catch(() => undefined);
  }
});

function createWindow() {
  win = new BrowserWindow({
    width: 1120, height: 740, minWidth: 820, minHeight: 560, backgroundColor: '#17212b', title: 'School17 Teacher',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (ev, url) => { if (!url.startsWith('file:')) ev.preventDefault(); });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    try { const s = clean(JSON.parse(fs.readFileSync(prefsFile(), 'utf8')).server); if (s && !process.env.SCHOOL17_API_URL) API = s; } catch { /* no saved address */ }
    // The server marks recordings as download-only and same-origin; the player in this window needs them playable
    session.defaultSession.webRequest.onHeadersReceived({ urls: ['*://*/files/blob/*'] }, (d, cb) => {
      const h = {};
      for (const k of Object.keys(d.responseHeaders)) if (!/^(cross-origin-resource-policy|content-security-policy|content-disposition)$/i.test(k)) h[k] = d.responseHeaders[k];
      cb({ responseHeaders: h });
    });
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
