// Esther keeps itself up to date from the "esther-desktop" release on GitHub (see package.json → build.publish).
// It checks a minute after starting and then every 4 hours, downloads quietly, and installs when you choose
// "Restart to update" (or the next time Esther quits). Only the installed version updates; the portable .exe can't.
const CHECK_EVERY = 4 * 60 * 60 * 1000;

function setupUpdates({ app, send, log = () => {} }) {
  let status = { state: app.isPackaged ? 'idle' : 'dev', version: app.getVersion() };
  const set = (s) => { status = { ...status, ...s }; send(status); };
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_FILE) {
    if (process.env.PORTABLE_EXECUTABLE_FILE) status.state = 'portable';
    return { status: () => status, check() {}, install() {} };
  }
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { log(`updates unavailable: ${e.message}`); return { status: () => status, check() {}, install() {} }; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => set({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => set({ state: 'current', checkedAt: Date.now() }));
  autoUpdater.on('update-available', (i) => set({ state: 'downloading', next: i.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => set({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => set({ state: 'ready', next: i.version }));
  autoUpdater.on('error', (e) => set({ state: 'error', error: String(e?.message ?? e).split('\n')[0].slice(0, 160) }));
  const check = () => { autoUpdater.checkForUpdates().catch(() => {}); };
  setTimeout(check, 60 * 1000);
  setInterval(check, CHECK_EVERY);
  return {
    status: () => status,
    check,
    /** Quit, install the downloaded version silently, and open Esther again. */
    install() { if (status.state === 'ready') autoUpdater.quitAndInstall(true, true); },
  };
}

module.exports = { setupUpdates };
