import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { FixtureRepository } from './repository';
import { reducer, type Action } from './reducer';
import type { AppData } from './types';
import { todayISO } from '../lib/dates';

interface Store {
  data: AppData;
  dispatch: Dispatch<Action>;
  today: string;
  undo: () => void;
  canUndo: boolean;
  resetSampleData: () => void;
}

const Ctx = createContext<Store | null>(null);
const repo = new FixtureRepository();
const HISTORY = 50;

interface Hist { data: AppData; past: AppData[] }
type HAction = Action | { type: 'undo' };

/** Every change is undoable (Ctrl+Z or the Undo button), up to the last 50 changes. */
function historyReducer(h: Hist, a: HAction): Hist {
  if (a.type === 'undo') return h.past.length ? { data: h.past[h.past.length - 1], past: h.past.slice(0, -1) } : h;
  if (a.type === 'replace') return { data: a.data, past: [] };
  const next = reducer(h.data, a);
  return next === h.data ? h : { data: next, past: [...h.past.slice(-(HISTORY - 1)), h.data] };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [h, dispatchH] = useReducer(historyReducer, undefined, () => ({ data: repo.load(), past: [] }));
  const today = useMemo(() => todayISO(), []);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    repo.save(h.data);
  }, [h.data]);

  const dispatch = useCallback((a: Action) => dispatchH(a), []);
  const undo = useCallback(() => dispatchH({ type: 'undo' }), []);

  const value = useMemo<Store>(() => ({
    data: h.data, dispatch, today, undo, canUndo: h.past.length > 0,
    resetSampleData: () => dispatchH({ type: 'replace', data: repo.reset() }),
  }), [h, dispatch, today, undo]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}
