import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type Page = 'home' | 'tasks' | 'settings';

interface Ui {
  page: Page;
  /** The list shown on the Tasks page. */
  listId: string | null;
  /** A task to show opened (its subtasks visible), e.g. after clicking it on Home. */
  openTaskId: string | null;
  go: (p: Page, opts?: { listId?: string; taskId?: string }) => void;
  setOpenTask: (id: string | null) => void;
  toast: { msg: string; undo: boolean } | null;
  say: (msg: string, undo?: boolean) => void;
}

const Ctx = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('home');
  const [listId, setListId] = useState<string | null>(null);
  const [openTaskId, setOpenTask] = useState<string | null>(null);
  const [toast, setToast] = useState<Ui['toast']>(null);
  const timer = useRef<number | undefined>(undefined);
  const say = useCallback((msg: string, undo = false) => {
    setToast({ msg, undo });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), undo ? 6000 : 3000);
  }, []);
  const go = useCallback((p: Page, opts?: { listId?: string; taskId?: string }) => {
    setPage(p);
    if (opts?.listId) setListId(opts.listId);
    setOpenTask(opts?.taskId ?? null);
  }, []);
  const value = useMemo(() => ({ page, listId, openTaskId, go, setOpenTask, toast, say }), [page, listId, openTaskId, go, toast, say]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi(): Ui {
  const v = useContext(Ctx);
  if (!v) throw new Error('UiProvider missing');
  return v;
}
