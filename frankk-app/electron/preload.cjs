// The only things the page can ask of the desktop: show/hide, its own size, a few settings and updates.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('estherDesktop', {
  state: () => ipcRenderer.invoke('esther:state'),
  set: (p) => ipcRenderer.invoke('esther:set', p),
  hide: () => ipcRenderer.send('esther:hide'),
  /** Which card this window is (header, tasks, calendar, week or settings). */
  card: new URLSearchParams(location.search).get('card') || '',
  openSettings: () => ipcRenderer.send('esther:settings'),
  closeSettings: () => ipcRenderer.send('esther:settings-close'),
  resetLayout: () => ipcRenderer.send('esther:reset-layout'),
  quit: () => ipcRenderer.send('esther:quit'),
  size: (width, height) => ipcRenderer.send('esther:size', { width, height }),
  updates: {
    status: () => ipcRenderer.invoke('esther:update-status'),
    check: () => ipcRenderer.send('esther:update-check'),
    install: () => ipcRenderer.send('esther:update-install'),
    /** Calls back whenever the update status changes; returns a function that stops listening. */
    on: (cb) => { const h = (_e, st) => cb(st); ipcRenderer.on('esther:update', h); return () => ipcRenderer.removeListener('esther:update', h); },
  },
});
