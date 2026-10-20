import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { reducer, type Action } from './reducer';
import { load, save, starter } from './storage';
import type { Data } from './model';
import { todayISO } from '../lib/dates';

interface Store {
  data: Data;
  dispatch: Dispatch<Action>;
  today: string;
  /** Undo the most recent change (Ctrl+Z or the toast's Undo), up to the last 50. */
  undo: () => void;
  canUndo: boolean;
  startFresh: () => void;
}

const Ctx = createContext<Store | null>(null);
const HISTORY = 50;

interface Hist { data: Data; past: Data[] }
type HAction = Action | { type: 'undo' };

function historyReducer(h: Hist, a: HAction): Hist {
  if (a.type === 'undo') return h.past.length ? { data: h.past[h.past.length - 1], past: h.past.slice(0, -1) } : h;
  const next = reducer(h.data, a);
  return next === h.data ? h : { data: next, past: [...h.past.slice(-(HISTORY - 1)), h.data] };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const today = useMemo(() => todayISO(), []);
  const [h, dispatchH] = useReducer(historyReducer, undefined, () => ({ data: load(today), past: [] }));
  // Saved on every change, and on first load too, so tasks brought over from the earlier Esther are kept under the new key.
  useEffect(() => { save(h.data); }, [h.data]);

  const dispatch = useCallback((a: Action) => dispatchH(a), []);
  const undo = useCallback(() => dispatchH({ type: 'undo' }), []);
  const value = useMemo<Store>(() => ({
    data: h.data, dispatch, today, undo, canUndo: h.past.length > 0,
    startFresh: () => dispatchH({ type: 'replace', data: starter(today) }),
  }), [h, dispatch, today, undo]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}
