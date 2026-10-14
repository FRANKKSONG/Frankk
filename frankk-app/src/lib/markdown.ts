/**
 * Small, safe Markdown renderer for notes (headings, emphasis, lists, task lists, quotes,
 * code, links and Obsidian [[wikilinks]]). Input is escaped first; only our own tags are emitted.
 */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string, known: Set<string>): string {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, alias?: string) => {
    const t = target.trim();
    return `<a class="wikilink${known.has(t.toLowerCase()) ? '' : ' unresolved'}" data-wikilink="${t}" href="#">${alias ?? t}</a>`;
  });
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, '$1<span class="md-tag">#$2</span>');
  return out;
}

export function renderMarkdown(src: string, knownTitles: string[] = []): string {
  const known = new Set(knownTitles.map((t) => t.toLowerCase()));
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let code = false;
  const close = () => { if (list) { html.push(`</${list}>`); list = null; } };
  for (const line of lines) {
    if (line.startsWith('```')) { close(); html.push(code ? '</code></pre>' : '<pre><code>'); code = !code; continue; }
    if (code) { html.push(esc(line)); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { close(); html.push(`<h${m[1].length}>${inline(m[2], known)}</h${m[1].length}>`); continue; }
    if ((m = line.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)$/i))) {
      if (list !== 'ul') { close(); html.push('<ul class="tasklist">'); list = 'ul'; }
      html.push(`<li class="${m[1].toLowerCase() === 'x' ? 'done' : ''}"><span class="md-box">${m[1].toLowerCase() === 'x' ? '✓' : ''}</span>${inline(m[2], known)}</li>`); continue;
    }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { if (list !== 'ul') { close(); html.push('<ul>'); list = 'ul'; } html.push(`<li>${inline(m[1], known)}</li>`); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (list !== 'ol') { close(); html.push('<ol>'); list = 'ol'; } html.push(`<li>${inline(m[1], known)}</li>`); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { close(); html.push(`<blockquote>${inline(m[1], known)}</blockquote>`); continue; }
    if (!line.trim()) { close(); continue; }
    close();
    html.push(`<p>${inline(line, known)}</p>`);
  }
  close();
  if (code) html.push('</code></pre>');
  return html.join('\n');
}

export function wikilinksIn(src: string): string[] {
  return [...src.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map((m) => m[1].trim());
}
