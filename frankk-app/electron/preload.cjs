// The only things the page can ask of the desktop: show/hide, its own size, a few settings and updates.
const { contextBridge, ipcRenderer } = require('electron');

// The backdrop can arrive before the page is listening, so keep the latest and hand it over when it starts.
let lastBackdrop = null;
ipcRenderer.on('esther:backdrop', (_e, b) => { lastBackdrop = b; });

contextBridge.exposeInMainWorld('estherDesktop', {
  state: () => ipcRenderer.invoke('esther:state'),
  set: (p) => ipcRenderer.invoke('esther:set', p),
  hide: () => ipcRenderer.send('esther:hide'),
  /** Which card this window is (header, tasks, calendar, week or settings). */
  card: new URLSearchParams(location.search).get('card') || '',
  /** 'native': Windows draws the glass (acrylic or mica); 'esther': Esther draws it. */
  glass: new URLSearchParams(location.search).get('glass') || 'esther',
  openSettings: () => ipcRenderer.send('esther:settings'),
  closeSettings: () => ipcRenderer.send('esther:settings-close'),
  resetLayout: () => ipcRenderer.send('esther:reset-layout'),
  /** The wallpaper behind this card and where the card sits, for Esther's own blur. Returns a function that stops listening. */
  onBackdrop: (cb) => { const h = (_e, b) => cb(b); ipcRenderer.on('esther:backdrop', h); if (lastBackdrop) cb(lastBackdrop); return () => ipcRenderer.removeListener('esther:backdrop', h); },
  onPlace: (cb) => { const h = (_e, b) => cb(b); ipcRenderer.on('esther:place', h); return () => ipcRenderer.removeListener('esther:place', h); },
  /** Something in the desktop settings changed (e.g. a card was turned on or off from the tray). */
  onChanged: (cb) => { const h = () => cb(); ipcRenderer.on('esther:changed', h); return () => ipcRenderer.removeListener('esther:changed', h); },
  /** Esther's own call-up and fade-out. */
  onEnter: (cb) => { const h = (_e, p) => cb(p); ipcRenderer.on('esther:enter', h); return () => ipcRenderer.removeListener('esther:enter', h); },
  onLeave: (cb) => { const h = (_e, p) => cb(p || {}); ipcRenderer.on('esther:leave', h); return () => ipcRenderer.removeListener('esther:leave', h); },
  show: () => ipcRenderer.send('esther:show'),
  /** The Esther bubble on the desktop was clicked. */
  bubbleClick: () => ipcRenderer.send('esther:bubble'),
  /** The mouse wheel over the big bubble makes it bigger or smaller. */
  bubbleWheel: (deltaY) => ipcRenderer.send('esther:bubble-wheel', deltaY),
  /** What the guides window should draw while a card is dragged. */
  onGuides: (cb) => { const h = (_e, g) => cb(g); ipcRenderer.on('esther:guides', h); return () => ipcRenderer.removeListener('esther:guides', h); },
  /** Move the card (or resize it from its corner) with the mouse, from now until the button is let go. */
  track: (kind, phase, edge) => ipcRenderer.send('esther:track', { kind, phase, edge }),
  /** Shift and Alt while resizing (where Esther can't read the keyboard itself). */
  trackMods: (shift, alt) => ipcRenderer.send('esther:track', { phase: 'mods', shift, alt }),
  saveLog: () => ipcRenderer.invoke('esther:save-log'),
  /** Your tasks, shared in a file with the native Tasks card: save them there, and hear when it changed them. */
  saveData: (text) => ipcRenderer.send('esther:data-save', text),
  onData: (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on('esther:data', h); return () => ipcRenderer.removeListener('esther:data', h); },
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
