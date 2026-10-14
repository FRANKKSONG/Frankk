/**
 * Undo for things that aren't data, like the Tasks board layout.
 * Ctrl+Z undoes whichever happened last: a data change (store history) or one of these.
 */
const stack: { at: number; label: string; undo: () => void }[] = [];

export function pushUiUndo(label: string, undo: () => void) {
  stack.push({ at: Date.now(), label, undo });
  if (stack.length > 50) stack.shift();
}

export const lastUiAt = () => stack[stack.length - 1]?.at ?? 0;
export const popUi = () => stack.pop();
export const hasUiUndo = () => stack.length > 0;
