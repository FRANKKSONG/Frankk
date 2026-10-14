import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './Icons';
import { DateCell } from './DateCell';
import { ProgressCell } from './ProgressBar';
import { Popover } from './Popover';
import { Editable, MiniSelect } from './Editable';
import { useStore } from '../data/store';
import { useUi } from '../ui';
import { checklistProgress } from '../lib/progress';
import type { Priority, Task } from '../data/types';
import type { Columns } from '../hooks/useColumns';

const PRIORITIES: { id: Priority; label: string }[] = [{ id: 'high', label: 'High' }, { id: 'normal', label: 'Normal' }, { id: 'low', label: 'Low' }];
const WORKSTREAMS = [{ id: '', label: '—' }, { id: 'content', label: 'Content queue' }, { id: 'backend', label: 'Backend' }, { id: 'brand', label: 'Brand work' }];

/* ---------- table wrapper + header with resizable columns ---------- */

export function Table({ cols, label, children }: { cols: Columns; label: string; children: ReactNode }) {
  return (
    <div className="table" role="table" aria-label={label} style={{ minWidth: cols.minWidth }}>
      <TableHeader cols={cols} />
      {children}
    </div>
  );
}

export function TableHeader({ cols }: { cols: Columns }) {
  return (
    <div className="trow thead" style={{ gridTemplateColumns: cols.template }} role="row">
      <span /><span />
      {cols.visible.map((c) => (
        <span key={c.id} className="th" role="columnheader">
          <span className="th-label">{c.label}</span>
          <ResizeHandle label={c.label} value={cols.width(c.id)} onChange={(w) => cols.setWidth(c.id, w)} onReset={() => cols.resetWidth(c.id)} />
        </span>
      ))}
      <span /><span />
    </div>
  );
}

function ResizeHandle({ label, value, onChange, onReset }: { label: string; value: number; onChange: (w: number) => void; onReset: () => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const end = () => { start.current = null; document.body.classList.remove('col-resizing'); };
  return (
    <span className="col-resizer no-drag" role="separator" aria-orientation="vertical" tabIndex={0}
      aria-label={`Resize ${label} column (double-click to reset)`} aria-valuenow={value} title="Drag to resize · double-click to reset"
      onPointerDown={(e) => {
        e.preventDefault(); e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: value };
        document.body.classList.add('col-resizing');
      }}
      onPointerMove={(e) => { if (start.current) onChange(start.current.w + e.clientX - start.current.x); }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onDoubleClick={onReset}
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
        {tasks.map((t, i) => (
          <TaskRow key={t.id} task={t} cols={cols} manual={manual} open={expanded.has(t.id)} onToggleOpen={() => toggleOpen(t.id)} onNudge={nudge}
            first={i === 0} last={i === tasks.length - 1} />
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
  const { dispatch, data } = useStore();
  const { openTask, openNote } = useUi();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !manual });
  const prog = checklistProgress(task.steps);
  const update = (patch: Partial<Task>) => dispatch({ type: 'task/update', id: task.id, patch });

  const cell = (id: string): ReactNode => {
    switch (id) {
      case 'title':
        return (
          <div key={id} className="cell title-cell">
            <button className={`chev${open ? ' open' : ''}`} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} steps of ${task.title}`} onClick={onToggleOpen}>
              <Icon name="chevronR" size={12} />
            </button>
            <Editable className="task-title" label="Task name" value={task.title} onSave={(v) => update({ title: v })} lang={task.brand?.startsWith('sundey') ? 'lo' : undefined} />
            {task.priority === 'high' && !task.done && !cols.visible.some((c) => c.id === 'priority') && <span className="prio" title="High priority">!</span>}
          </div>
        );
      case 'progress': return <div key={id} className="cell"><ProgressCell p={prog} done={task.done} /></div>;
      case 'plan': return <div key={id} className="cell"><DateCell kind="plan" label={`Task date of ${task.title}`} value={task.plan} done={task.done} onChange={(v) => update({ plan: v })} /></div>;
      case 'due': return <div key={id} className="cell"><DateCell kind="due" label={`Due date of ${task.title}`} value={task.due} done={task.done} onChange={(v) => update({ due: v })} /></div>;
      case 'priority': return <div key={id} className="cell"><MiniSelect label={`Priority of ${task.title}`} value={task.priority} options={PRIORITIES} onChange={(v) => update({ priority: v })} /></div>;
      case 'list': return <div key={id} className="cell"><Editable label={`List of ${task.title}`} value={task.list ?? ''} allowEmpty placeholder="+ list" onSave={(v) => update({ list: v.trim() || undefined })} /></div>;
      case 'workstream': return <div key={id} className="cell"><MiniSelect label={`Workstream of ${task.title}`} value={task.workstream ?? ''} options={WORKSTREAMS} onChange={(v) => update({ workstream: (v || undefined) as Task['workstream'] })} /></div>;
      case 'brand': return <div key={id} className="cell"><MiniSelect label={`Brand of ${task.title}`} value={task.brand ?? ''} options={data.brands.map((b) => ({ id: b, label: b }))} onChange={(v) => update({ brand: v })} /></div>;
      default: return <div key={id} className="cell" />;
    }
  };

  return (
    <div ref={setNodeRef} className={`task${isDragging ? ' dragging' : ''}${task.done ? ' is-done' : ''}${open ? ' is-open' : ''}`} data-task={task.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className="trow" style={{ gridTemplateColumns: cols.template }} role="row">
        <button className={`row-grip${manual ? '' : ' off'}`} aria-label={`Reorder ${task.title}. Space to pick up, arrows to move, or Alt+Up and Alt+Down`}
          title={manual ? 'Drag to reorder' : 'Switch sort to “Manual order” to drag rows'}
          {...(manual ? attributes : {})} {...(manual ? listeners : {})}
          onKeyDown={(e) => {
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && manual) { e.preventDefault(); onNudge(task.id, e.key === 'ArrowUp' ? -1 : 1); return; }
            if (manual) (listeners as { onKeyDown?: (e: React.KeyboardEvent) => void } | undefined)?.onKeyDown?.(e);
          }}>
          <Icon name="grip" size={13} />
        </button>
        <label className="check no-drag">
          <input type="checkbox" checked={task.done} aria-label={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`}
            onChange={() => dispatch({ type: 'task/toggle', id: task.id })} />
          <span className="box" />
        </label>
        {cols.visible.map((c) => cell(c.id))}
        <span />
        <Popover align="right" trigger={({ toggle, ref }) => (
          <button ref={ref} className="icon-btn tiny" aria-label={`Actions for ${task.title}`} aria-haspopup="menu" onClick={toggle}><Icon name="more" size={14} /></button>
        )}>
          {(close) => (
            <>
              <button role="menuitem" onClick={() => { close(); openTask(task.id); }}>Open details</button>
              <button role="menuitem" onClick={() => { close(); onToggleOpen(); }}>{open ? 'Hide steps' : 'Show steps'}</button>
              <button role="menuitem" onClick={() => { close(); openNote(task.notePath); }}><Icon name="external" size={13} /> Open in Obsidian</button>
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
  const { openTask, say } = useUi();
  const [text, setText] = useState('');
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
          <Editable className="step-text" label="Step" value={s.text} onSave={(v) => dispatch({ type: 'step/rename', taskId: task.id, stepId: s.id, text: v })} />
          <button className="icon-btn tiny hover-only" aria-label={`Remove step ${s.text}`} title="Remove step"
            onClick={() => { dispatch({ type: 'step/remove', taskId: task.id, stepId: s.id }); say(`Removed “${s.text}”.`, true); }}>
            <Icon name="close" size={11} />
          </button>
        </div>
      ))}
      <div className="step add">
        <Icon name="plus" size={12} />
        <input className="step-input" placeholder="Add step, press Enter" aria-label={`Add step to ${task.title}`} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <button className="link-btn" onClick={() => openTask(task.id)}>Details</button>
      </div>
    </div>
  );
}
