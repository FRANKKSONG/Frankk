import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'esther.proto.v1.';

/** localStorage-backed state for view preferences (layout, widths, filters). Never touches notes. */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return initial && typeof initial === 'object' && !Array.isArray(initial) ? ({ ...initial, ...parsed } as T) : (parsed as T);
      }
    } catch { /* ignore */ }
    return initial;
  });
  // Every place that uses the same key sees a change straight away.
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<{ key: string; value: T }>).detail; if (d.key === key) setValue(d.value); };
    // ...and in Esther's other card windows (the browser tells them through 'storage').
    const other = (e: StorageEvent) => { if (e.key === PREFIX + key && e.newValue) { try { setValue(JSON.parse(e.newValue)); } catch { /* ignore */ } } };
    window.addEventListener('esther-pref', on);
    window.addEventListener('storage', other);
    return () => { window.removeEventListener('esther-pref', on); window.removeEventListener('storage', other); };
  }, [key]);
  const set = useCallback((v: T | ((p: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(next)); } catch { /* ignore */ }
      queueMicrotask(() => window.dispatchEvent(new CustomEvent('esther-pref', { detail: { key, value: next } })));
      return next;
    });
  }, [key]);
  return [value, set];
}

export function clearPrefs() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
