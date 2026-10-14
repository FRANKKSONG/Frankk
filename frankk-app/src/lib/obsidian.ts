export const FIXTURE_VAULT_NAME = 'FRANKK VAULT - AI Hub';

/** Official Obsidian URI for opening a note. Milestone 1 only *builds* it; nothing is launched. */
export function obsidianUri(notePath: string, vault = FIXTURE_VAULT_NAME): string {
  const file = notePath.replace(/\.md$/i, '');
  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file)}`;
}

/** Collision-safe note path for a new fixture task (never reuses an existing path). */
export function uniqueNotePath(title: string, existing: Set<string>): string {
  const safe = title.replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim() || 'Untitled task';
  let candidate = `Planning/Tasks/${safe}.md`;
  let n = 2;
  while (existing.has(candidate)) candidate = `Planning/Tasks/${safe} ${n++}.md`;
  return candidate;
}
