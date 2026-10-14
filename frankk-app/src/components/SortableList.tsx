import type { CSSProperties, ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './Icons';

/** Drag-to-reorder list: each item gets a grip handle (mouse, touch or Space + arrow keys). */
export function SortableList<T extends { id: string }>({ items, onMove, children, label }: {
  items: T[];
  onMove: (id: string, overId: string) => void;
  children: (item: T, grip: ReactNode) => ReactNode;
  label: (item: T) => string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => { if (e.over && e.active.id !== e.over.id) onMove(String(e.active.id), String(e.over.id)); };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((it) => <Row key={it.id} item={it} label={label(it)}>{children}</Row>)}
      </SortableContext>
    </DndContext>
  );
}

function Row<T extends { id: string }>({ item, label, children }: { item: T; label: string; children: (item: T, grip: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 5 : undefined };
  const grip = (
    <button type="button" className="drag-grip" aria-label={`Reorder ${label}. Space to pick up, arrow keys to move`} title="Drag to reorder" {...attributes} {...listeners}>
      <Icon name="grip" size={12} />
    </button>
  );
  return <div ref={setNodeRef} style={style} className={`sortable-row${isDragging ? ' dragging' : ''}`}>{children(item, grip)}</div>;
}
