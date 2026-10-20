// A short log of what the windows did (shown, hidden, focused, put back on the desktop…), kept in memory and in
// esther-log.txt next to the settings, so a flicker or a card that won't come up can be looked into.
// It never holds tasks, settings values or anything personal.
const fs = require('node:fs');
const path = require('node:path');

const lines = [];
let file = null, timer = null;
function diag(msg) {
  lines.push(`${new Date().toISOString().slice(11, 23)} ${msg}`);
  if (lines.length > 600) lines.splice(0, lines.length - 600);
  if (file && !timer) timer = setTimeout(() => { timer = null; try { fs.writeFileSync(file, lines.join('\n') + '\n'); } catch { /* read-only profile */ } }, 1000);
}
diag.start = (dir) => { file = path.join(dir, 'esther-log.txt'); };
diag.text = () => lines.join('\n') + '\n';
module.exports = { diag };
