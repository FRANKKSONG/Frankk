import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Area } from './data/types';

interface Ui {
  drawerTaskId: string | null;
  openTask: (id: string | null) => void;
  noteDialog: string | null;
  openNote: (path: string | null) => void;
  toast: { msg: string; undo: boolean } | null;
  say: (msg: string, undo?: boolean) => void;
  paletteOpen: boolean;
  setPalette: (v: boolean) => void;
  focusArea: Area | null;
  setFocusArea: (a: Area | null) => void;
  /** Ask a panel to expand a specific row (used by search). */
  reveal: { kind: 'task' | 'project'; id: string; n: number } | null;
  revealRow: (kind: 'task' | 'project', id: string) => void;
  projectDialog: boolean;
  setProjectDialog: (v: boolean) => void;
}

const Ctx = createContext<Ui | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [drawerTaskId, openTask] = useState<string | null>(null);
  const [noteDialog, openNote] = useState<string | null>(null);
  const [toast, setToast] = useState<Ui['toast']>(null);
  const [paletteOpen, setPalette] = useState(false);
  const [focusArea, setFocusArea] = useState<Area | null>(null);
  const [reveal, setReveal] = useState<Ui['reveal']>(null);
  const [projectDialog, setProjectDialog] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const n = useRef(0);

  const say = useCallback((msg: string, undo = false) => {
    setToast({ msg, undo });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), undo ? 6500 : 4200);
  }, []);
  const revealRow = useCallback((kind: 'task' | 'project', id: string) => setReveal({ kind, id, n: ++n.current }), []);

  const value = useMemo<Ui>(() => ({
    drawerTaskId, openTask, noteDialog, openNote, toast, say, paletteOpen, setPalette, focusArea, setFocusArea,
    reveal, revealRow, projectDialog, setProjectDialog,
  }), [drawerTaskId, noteDialog, toast, say, paletteOpen, focusArea, reveal, revealRow, projectDialog]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi(): Ui {
  const v = useContext(Ctx);
  if (!v) throw new Error('UiProvider missing');
  return v;
}
