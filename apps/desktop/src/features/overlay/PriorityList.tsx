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
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { rankHeat } from '../../lib/rank-heat';

type PriorityListProps = {
  title: string;
  ids: string[];
  catalog: readonly CatalogEntry[];
  editable: boolean;
  cap?: number;
  onRemove?: (id: string) => void;
  onReorder?: (ids: string[]) => void;
};

type SortableEntryProps = {
  id: string;
  index: number;
  name: string;
  icon: string;
  ids: string[];
  onRemove?: (id: string) => void;
  onReorder?: (ids: string[]) => void;
};

const HEAT_BAR = 'w-[3px] shrink-0 self-stretch rounded-full my-[3px]';

function SortableEntry({ id, index, name, icon, ids, onRemove, onReorder }: SortableEntryProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const move = (offset: -1 | 1) => {
    const destination = index + offset;
    if (destination >= 0 && destination < ids.length) {
      onReorder?.(arrayMove(ids, index, destination));
    }
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'priority-entry flex items-center gap-1.5 rounded-md bg-raise/50 pr-1 transition-colors',
        isDragging && 'is-dragging relative z-10 shadow-lg shadow-black/40',
      )}
    >
      <span className={HEAT_BAR} style={{ background: rankHeat(index) }} aria-hidden="true" />
      <button
        type="button"
        className="drag-handle flex h-8 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-ink-dim hover:text-ink"
        aria-label={`Arrastar ${name}`}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true" className="text-[11px] leading-none tracking-tighter">
          ⋮⋮
        </span>
      </button>
      <img className="size-5 shrink-0 rounded object-cover" src={icon} alt="" loading="lazy" />
      <span className="priority-name min-w-0 flex-1 truncate text-xs text-ink">
        {index + 1}. {name}
      </span>
      <span className="flex shrink-0 items-center">
        <Button
          variant="icon"
          size="icon"
          className="size-6 text-sm"
          aria-label={`Mover ${name} para cima`}
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          ↑
        </Button>
        <Button
          variant="icon"
          size="icon"
          className="size-6 text-sm"
          aria-label={`Mover ${name} para baixo`}
          disabled={index === ids.length - 1}
          onClick={() => move(1)}
        >
          ↓
        </Button>
        <Button
          variant="icon"
          size="icon"
          className="size-6 text-base hover:text-danger"
          aria-label={`Remover ${name}`}
          onClick={() => onRemove?.(id)}
        >
          <span aria-hidden="true">×</span>
        </Button>
      </span>
    </li>
  );
}

export function PriorityList({
  title,
  ids,
  catalog,
  editable,
  cap,
  onRemove,
  onReorder,
}: PriorityListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const entriesById = new Map(catalog.map((entry) => [entry.id, entry]));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const previousIndex = ids.indexOf(String(active.id));
    const nextIndex = ids.indexOf(String(over.id));
    if (previousIndex >= 0 && nextIndex >= 0) {
      onReorder?.(arrayMove(ids, previousIndex, nextIndex));
    }
  };

  const entries = ids.map((id, index) => {
    const entry = entriesById.get(id);
    const name = entry?.name ?? id;
    const icon = entry?.icon ?? '';
    return editable ? (
      <SortableEntry
        key={id}
        id={id}
        index={index}
        name={name}
        icon={icon}
        ids={ids}
        onRemove={onRemove}
        onReorder={onReorder}
      />
    ) : (
      <li
        className="priority-entry flex items-center gap-2 rounded-md pr-1 transition-colors hover:bg-raise"
        key={id}
      >
        <span
          className={HEAT_BAR}
          style={{ background: rankHeat(index) }}
          aria-hidden="true"
        />
        {icon && <img className="size-5 shrink-0 rounded object-cover" src={icon} alt="" loading="lazy" />}
        <span className="priority-name min-w-0 flex-1 truncate py-1.5 text-xs leading-none text-ink">
          {index + 1}. {name}
        </span>
      </li>
    );
  });

  const list = (
    <ol className="priority-list m-0 grid list-none gap-1 p-0" aria-label={title}>
      {entries}
    </ol>
  );

  return (
    <section className="priority-card grid gap-1.5">
      <h2 className="flex items-baseline justify-between font-display text-[13px] font-semibold tracking-widest text-ink-dim uppercase">
        <span>{title}</span>
        {cap != null && (
          <span className="tabular-nums text-[11px] tracking-normal">
            {ids.length}/{cap}
          </span>
        )}
      </h2>
      {ids.length === 0 && (
        <p className="empty-state text-[11px] text-ink-dim">Nenhuma prioridade adicionada.</p>
      )}
      {editable ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
        </DndContext>
      ) : (
        list
      )}
    </section>
  );
}
