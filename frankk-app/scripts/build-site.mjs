// Builds Esther into one self-contained page at ../docs/index.html, which GitHub Pages serves as the Esther website.
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
execSync('npx vite build --base ./', { stdio: 'inherit' });
const a = (ext) => readFileSync(`dist/assets/${readdirSync('dist/assets').find((f) => f.endsWith(ext))}`, 'utf8');
const v = JSON.parse(readFileSync('package.json', 'utf8')).version;
let h = readFileSync('dist/index.html', 'utf8')
  .replace(/<script type="module" crossorigin src="[^"]+"><\/script>\s*/, '')
  .replace(/<link rel="stylesheet" crossorigin href="[^"]+">/, () => `<style>${a('.css')}</style>`)
  .replace('<title>Esther</title>', `<title>Esther build ${v}</title>`)
  .replace('</body>', () => `<script type="module">${a('.js').replaceAll('</script', '<\\/script').replaceAll('\uFFFD', '\\uFFFD')}</script>\n</body>`);
mkdirSync('../docs', { recursive: true });
writeFileSync('../docs/index.html', h);
writeFileSync('../docs/.nojekyll', '');
console.log(`wrote ../docs/index.html (Esther build ${v}, ${h.length} bytes)`);
