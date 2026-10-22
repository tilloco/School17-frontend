const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('desk', {
  api: (a) => ipcRenderer.invoke('api', a),
  setServer: (u) => ipcRenderer.invoke('server:set', u),
  config: () => ipcRenderer.invoke('config'),
  getSession: () => ipcRenderer.invoke('session:get'),
  setSession: (t) => ipcRenderer.invoke('session:set', t),
  getPrefs: () => ipcRenderer.invoke('prefs:get'),
  setPrefs: (p) => ipcRenderer.invoke('prefs:set', p),
  pick: () => ipcRenderer.invoke('pick'),
  pathOf: (file) => webUtils.getPathForFile(file),
  fileInfo: (p) => ipcRenderer.invoke('fileinfo', p),
  upload: (a) => ipcRenderer.invoke('upload', a),
  cancelUpload: (id) => ipcRenderer.invoke('upload:cancel', id),
  onProgress: (fn) => ipcRenderer.on('upload:progress', (_e, m) => fn(m)),
  openExternal: (u) => ipcRenderer.invoke('open-external', u),
});
