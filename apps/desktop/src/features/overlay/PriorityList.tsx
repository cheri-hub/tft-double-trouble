import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { CatalogEntry } from '../../../../../packages/domain/src';

type PriorityListProps = {
  title: string;
  ids: string[];
  catalog: readonly CatalogEntry[];
  editable: boolean;
  onRemove?: (id: string) => void;
  onReorder?: (ids: string[]) => void;
};

type SortableEntryProps = {
  id: string;
  index: number;
  name: string;
  ids: string[];
  onRemove?: (id: string) => void;
  onReorder?: (ids: string[]) => void;
};

function SortableEntry({ id, index, name, ids, onRemove, onReorder }: SortableEntryProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const move = (offset: -1 | 1) => {
    const destination = index + offset;
    if (destination >= 0 && destination < ids.length) {
      onReorder?.(arrayMove(ids, index, destination));
    }
  };

  return (
    <li ref={setNodeRef} style={style} className={isDragging ? 'priority-entry is-dragging' : 'priority-entry'}>
      <button
        type="button"
        className="drag-handle"
        aria-label={`Arrastar ${name}`}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
      <span className="priority-name">{index + 1}. {name}</span>
      <span className="priority-actions">
        <button
          type="button"
          aria-label={`Mover ${name} para cima`}
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Mover ${name} para baixo`}
          disabled={index === ids.length - 1}
          onClick={() => move(1)}
        >
          ↓
        </button>
        <button type="button" aria-label={`Remover ${name}`} onClick={() => onRemove?.(id)}>
          Remover
        </button>
      </span>
    </li>
  );
}
export function PriorityList({ title, ids, catalog, editable, onRemove, onReorder }: PriorityListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const names = new Map(catalog.map((entry) => [entry.id, entry.name]));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const previousIndex = ids.indexOf(String(active.id));
    const nextIndex = ids.indexOf(String(over.id));
    if (previousIndex >= 0 && nextIndex >= 0) {
      onReorder?.(arrayMove(ids, previousIndex, nextIndex));
    }
  };

  const entries = ids.map((id, index) => {
    const name = names.get(id) ?? id;
    return editable ? (
      <SortableEntry
        key={id}
        id={id}
        index={index}
        name={name}
        ids={ids}
        onRemove={onRemove}
        onReorder={onReorder}
      />
    ) : (
      <li className="priority-entry" key={id}>{index + 1}. {name}</li>
    );
  });

  const list = (
    <ol className="priority-list" aria-label={title}>
      {entries}
      {Array.from({ length: Math.max(0, 10 - ids.length) }, (_, index) => {
        const position = ids.length + index + 1;
        return <li className="priority-entry priority-entry-empty" key={`empty-${position}`}>{position}. Vazio</li>;
      })}
    </ol>
  );

  return (
    <section className="priority-card">
      <h2>{title}</h2>
      {ids.length === 0 && <p className="empty-state">Nenhuma prioridade adicionada.</p>}
      {editable ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>{list}</SortableContext>
        </DndContext>
      ) : list}
    </section>
  );
}
