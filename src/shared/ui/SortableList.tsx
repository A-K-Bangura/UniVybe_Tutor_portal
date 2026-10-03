import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
export function SortableList<T>({
  items,
  id,
  render,
  onChange,
  disabled = false,
}: {
  items: T[];
  id: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  onChange: (items: T[]) => void;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id)
          onChange(
            arrayMove(
              items,
              items.findIndex((x) => id(x) === active.id),
              items.findIndex((x) => id(x) === over.id),
            ),
          );
      }}
    >
      <SortableContext
        items={items.map(id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item, index) => (
          <SortableItem key={id(item)} id={id(item)} disabled={disabled}>
            {render(item, index)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
function SortableItem({
  id,
  children,
  disabled,
}: {
  id: string;
  children: ReactNode;
  disabled: boolean;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
        transition: transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="sortable-row"
    >
      <button
        className="drag-handle"
        aria-label="Reorder item: press Space then arrow keys"
        {...attributes}
        {...listeners}
        disabled={disabled}
      >
        <GripVertical size={17} />
      </button>
      <div>{children}</div>
    </div>
  );
}
