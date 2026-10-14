import type { TypeDef, ViewDef } from '../data/schema';

const LAYOUT: Record<ViewDef['layout'], string> = { table: 'table', list: 'list', gallery: 'cards', board: 'table', calendar: 'table' };

/**
 * Draft of the Obsidian Bases file (.base) that the Esther Bridge plugin would write for a saved view,
 * so the same view also works inside Obsidian. Board and calendar layouts need a community Bases view
 * and fall back to a table here. Verify against your Obsidian version before relying on it.
 */
export function toBaseFile(view: ViewDef, type: TypeDef): string {
  const filters = [`    - file.inFolder("${type.folder || '/'}")`];
  for (const f of view.filters) {
    if (f.op === 'is') filters.push(`    - ${f.field} == ${JSON.stringify(f.value)}`);
    if (f.op === 'is-not') filters.push(`    - ${f.field} != ${JSON.stringify(f.value)}`);
    if (f.op === 'contains') filters.push(`    - ${f.field}.contains(${JSON.stringify(f.value)})`);
    if (f.op === 'not-empty') filters.push(`    - ${f.field}`);
  }
  const order = ['file.name', ...view.fields].map((k) => `      - ${k}`).join('\n');
  const sort = view.sort ? `\n    sort:\n      - property: ${view.sort.field}\n        direction: ${view.sort.dir.toUpperCase()}` : '';
  const group = view.layout === 'board' && view.groupBy ? `\n    groupBy:\n      property: ${view.groupBy}` : '';
  return `filters:\n  and:\n${filters.join('\n')}\nviews:\n  - type: ${LAYOUT[view.layout]}\n    name: ${JSON.stringify(view.name)}\n    order:\n${order}${sort}${group}\n`;
}
