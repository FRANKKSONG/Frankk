import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ISODate } from './lib/dates';

/** 'all' shows every list in one table. */
export type Tab = 'all' | string;

interface Ui {
  tab: Tab;
  setTab: (t: Tab) => void;
  /** The task whose subtasks are showing. */
  openTaskId: string | null;
  setOpenTask: (id: string | null) => void;
  /** A day picked on the calendar: the table shows only that day. */
  day: ISODate | null;
  setDay: (d: ISODate | null) => void;
  /** Show a task in the table: switch to its list, open it and scroll to it. */
  reveal: (taskId: string, listId: string) => void;
  toast: { msg: string; undo: boolean } | null;
  say: (msg: string, undo?: boolean) => void;
}

const Ctx = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('all');
  const [openTaskId, setOpenTask] = useState<string | null>(null);
  const [day, setDay] = useState<ISODate | null>(null);
  const [toast, setToast] = useState<Ui['toast']>(null);
  const timer = useRef<number | undefined>(undefined);
  const say = useCallback((msg: string, undo = false) => {
    setToast({ msg, undo });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), undo ? 6000 : 3000);
  }, []);
  const reveal = useCallback((taskId: string, listId: string) => {
    setTab((t) => (t === 'all' ? t : listId));
    setDay(null);
    setOpenTask(taskId);
    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector(`[data-task="${taskId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })));
  }, []);
  const value = useMemo(() => ({ tab, setTab, openTaskId, setOpenTask, day, setDay, reveal, toast, say }), [tab, openTaskId, day, reveal, toast, say]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi(): Ui {
  const v = useContext(Ctx);
  if (!v) throw new Error('UiProvider missing');
  return v;
}
