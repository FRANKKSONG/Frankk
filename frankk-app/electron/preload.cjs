// The only things the page can ask of the desktop: show/hide, its own size, and a few settings.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('estherDesktop', {
  state: () => ipcRenderer.invoke('esther:state'),
  set: (p) => ipcRenderer.invoke('esther:set', p),
  hide: () => ipcRenderer.send('esther:hide'),
  quit: () => ipcRenderer.send('esther:quit'),
  size: (width, height) => ipcRenderer.send('esther:size', { width, height }),
});
