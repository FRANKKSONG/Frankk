import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { FixtureRepository } from './repository';
import { reducer, type Action } from './reducer';
import type { AppData } from './types';
import { todayISO } from '../lib/dates';

interface Store {
  data: AppData;
  dispatch: Dispatch<Action>;
  today: string;
  resetSampleData: () => void;
}

const Ctx = createContext<Store | null>(null);
const repo = new FixtureRepository();

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, () => repo.load());
  const today = useMemo(() => todayISO(), []);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    repo.save(data);
  }, [data]);

  const value = useMemo<Store>(
    () => ({ data, dispatch, today, resetSampleData: () => dispatch({ type: 'replace', data: repo.reset() }) }),
    [data, today],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}
