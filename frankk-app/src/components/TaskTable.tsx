import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './Icons';
import { DateCell } from './DateCell';
import { ProgressCell } from './ProgressBar';
import { Popover } from './Popover';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { checklistProgress } from '../lib/progress';
import type { Task } from '../data/types';
import type { Columns } from '../hooks/useColumns';

/* ---------- header with independently resizable columns ---------- */

export function TableHeader({ cols }: { cols: Columns }) {
  return (
    <div className="trow thead" style={{ gridTemplateColumns: cols.template }} role="row">
      <span /><span />
      {cols.visible.map((c) => (
        <span key={c.id} className="th" role="columnheader">
          {c.label}
          <ResizeHandle label={c.label} value={cols.width(c.id)} onChange={(w) => cols.setWidth(c.id, w)} />
        </span>
      ))}
      <span />
    </div>
  );
}

function ResizeHandle({ label, value, onChange }: { label: string; value: number; onChange: (w: number) => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  return (
    <span className="col-resizer no-drag" role="separator" aria-orientation="vertical" tabIndex={0}
      aria-label={`Resize ${label} column`} aria-valuenow={value}
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); start.current = { x: e.clientX, w: value }; }}
      onPointerMove={(e) => { if (start.current) onChange(start.current.w + e.clientX - start.current.x); }}
      onPointerUp={() => { start.current = null; }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          onChange(value + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 32 : 8));
        }
      }} />
  );
}

/* ---------- rows ---------- */

interface RowsProps {
  tasks: Task[];
  cols: Columns;
  /** Manual order: drag handles active. Otherwise the list is sorted and handles explain why they're off. */
  manual: boolean;
  empty?: ReactNode;
  billRows?: ReactNode;
}

export function TaskRows({ tasks, cols, manual, empty }: RowsProps) {
  const { dispatch } = useStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { reveal } = useUi();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (reveal?.kind === 'task' && tasks.some((t) => t.id === reveal.id)) {
      setExpanded((s) => new Set(s).add(reveal.id));
      requestAnimationFrame(() => document.querySelector(`[data-task="${reveal.id}"]`)?.scrollIntoView({ block: 'nearest' }));
    }
  }, [reveal, tasks]);

  const toggleOpen = (id: string) => setExpanded((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n; });
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) dispatch({ type: 'task/move', id: String(e.active.id), overId: String(e.over.id) });
  };
  const nudge = (id: string, dir: -1 | 1) => {
    const i = tasks.findIndex((t) => t.id === id);
    const over = tasks[i + dir];
    if (over) dispatch({ type: 'task/move', id, overId: over.id });
  };

  if (tasks.length === 0) return <div className="empty">{empty ?? 'Nothing here.'}</div>;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} cols={cols} manual={manual} open={expanded.has(t.id)} onToggleOpen={() => toggleOpen(t.id)} onNudge={nudge}
            first={tasks[0].id === t.id} last={tasks[tasks.length - 1].id === t.id} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

interface RowProps {
  task: Task; cols: Columns; manual: boolean; open: boolean; onToggleOpen: () => void;
  onNudge: (id: string, d: -1 | 1) => void; first: boolean; last: boolean;
}

function TaskRow({ task, cols, manual, open, onToggleOpen, onNudge, first, last }: RowProps) {
  const { dispatch } = useStore();
  const { openTask, openNote } = useUi();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !manual });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const prog = checklistProgress(task.steps);

  const startEdit = () => { setDraft(task.title); setEditing(true); };
  const save = () => { dispatch({ type: 'task/update', id: task.id, patch: { title: draft } }); setEditing(false); };

  return (
    <div ref={setNodeRef} className={`task${isDragging ? ' dragging' : ''}${task.done ? ' is-done' : ''}`} data-task={task.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className="trow" style={{ gridTemplateColumns: cols.template }} role="row">
        <button className={`row-grip${manual ? '' : ' off'}`} aria-label={`Reorder ${task.title}. Space to pick up, arrows to move, or Alt+Up and Alt+Down`}
          title={manual ? 'Drag to reorder' : 'Switch sort to “Manual order” to drag rows'}
          {...(manual ? attributes : {})} {...(manual ? listeners : {})}
          onKeyDown={(e) => {
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && manual) { e.preventDefault(); onNudge(task.id, e.key === 'ArrowUp' ? -1 : 1); return; }
            if (manual) (listeners as { onKeyDown?: (e: React.KeyboardEvent) => void } | undefined)?.onKeyDown?.(e);
          }}>
          <Icon name="grip" size={14} />
        </button>
        <label className="check no-drag">
          <input type="checkbox" checked={task.done} aria-label={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`}
            onChange={() => dispatch({ type: 'task/toggle', id: task.id })} />
          <span className="box" />
        </label>
        {cols.visible.map((c) => {
          switch (c.id) {
            case 'title':
              return (
                <div key={c.id} className="cell title-cell">
                  <button className={`chev${open ? ' open' : ''}`} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} steps of ${task.title}`} onClick={onToggleOpen}>
                    <Icon name="chevronR" size={13} />
                  </button>
                  {editing ? (
                    <span className="inline-edit">
                      <input autoFocus value={draft} aria-label="Task title" onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
                      <button className="icon-btn tiny ok" aria-label="Save title" onClick={save}><Icon name="check" size={13} /></button>
                      <button className="icon-btn tiny" aria-label="Cancel editing" onClick={() => setEditing(false)}><Icon name="close" size={13} /></button>
                    </span>
                  ) : (
                    <>
                      <span className="tt">
                        <span className="task-title" onClick={onToggleOpen} onDoubleClick={startEdit} title="Click for steps · double-click to rename">{task.title}</span>
                        {task.workstream && task.workstream !== 'brand' && <span className="ws" title={task.workstream === 'content' ? 'Content queue' : 'Backend development'}>{task.workstream === 'content' ? 'Content queue' : 'Backend'}</span>}
                      </span>
                      {task.priority === 'high' && !task.done && <span className="prio" title="High priority">!</span>}
                      <button className="icon-btn tiny hover-only" aria-label={`Rename ${task.title}`} onClick={startEdit}><Icon name="pencil" size={12} /></button>
                    </>
                  )}
                </div>
              );
            case 'progress':
              return <div key={c.id} className="cell"><ProgressCell p={prog} done={task.done} /></div>;
            case 'plan':
              return <div key={c.id} className="cell"><DateCell kind="plan" label={`Task date of ${task.title}`} value={task.plan} done={task.done} onChange={(v) => dispatch({ type: 'task/update', id: task.id, patch: { plan: v } })} /></div>;
            case 'due':
              return <div key={c.id} className="cell"><DateCell kind="due" label={`Due date of ${task.title}`} value={task.due} done={task.done} onChange={(v) => dispatch({ type: 'task/update', id: task.id, patch: { due: v } })} /></div>;
            default:
              return <div key={c.id} className="cell" />;
          }
        })}
        <Popover align="right" trigger={({ toggle, ref }) => (
          <button ref={ref} className="icon-btn tiny" aria-label={`Actions for ${task.title}`} aria-haspopup="menu" onClick={toggle}><Icon name="more" size={14} /></button>
        )}>
          {(close) => (
            <>
              <button role="menuitem" onClick={() => { close(); openTask(task.id); }}>Open details</button>
              <button role="menuitem" onClick={() => { close(); openNote(task.notePath); }}><Icon name="external" size={13} /> Open in Obsidian</button>
              <button role="menuitem" onClick={() => { close(); startEdit(); }}>Rename</button>
              <button role="menuitem" disabled={!manual || first} onClick={() => { close(); onNudge(task.id, -1); }}><Icon name="up" size={13} /> Move up</button>
              <button role="menuitem" disabled={!manual || last} onClick={() => { close(); onNudge(task.id, 1); }}><Icon name="down" size={13} /> Move down</button>
              {!manual && <p className="menu-note">Moving needs “Manual order” sort.</p>}
            </>
          )}
        </Popover>
      </div>
      {open && <Steps task={task} />}
    </div>
  );
}

function Steps({ task }: { task: Task }) {
  const { dispatch } = useStore();
  const { openTask } = useUi();
  const [text, setText] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const add = () => { if (text.trim()) { dispatch({ type: 'step/add', taskId: task.id, text }); setText(''); } };
  return (
    <div className="steps">
      {task.steps.length === 0 && <p className="steps-empty">No steps yet. Add the first one below.</p>}
      {task.steps.map((s) => (
        <div key={s.id} className={`step${s.done ? ' done' : ''}`}>
          <label className="check no-drag">
            <input type="checkbox" checked={s.done} aria-label={s.text} onChange={() => dispatch({ type: 'step/toggle', taskId: task.id, stepId: s.id })} />
            <span className="box" />
          </label>
          {editId === s.id ? (
            <input autoFocus className="step-input" value={draft} aria-label="Step text" onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { dispatch({ type: 'step/rename', taskId: task.id, stepId: s.id, text: draft }); setEditId(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDraft(s.text); setEditId(null); } }} />
          ) : (
            <span className="step-text" onDoubleClick={() => { setEditId(s.id); setDraft(s.text); }} title="Double-click to edit">{s.text}</span>
          )}
        </div>
      ))}
      <div className="step add">
        <Icon name="plus" size={13} />
        <input className="step-input" placeholder="Add step" aria-label={`Add step to ${task.title}`} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        {text.trim() && <button className="btn small" onClick={add}>Add</button>}
        <button className="link-btn" onClick={() => openTask(task.id)}>Details</button>
      </div>
    </div>
  );
}
