import type { Announcements, KeyboardCoordinateGetter, CollisionDetection } from "@dnd-kit/core";
import { closestCenter, KeyboardCode, pointerWithin } from "@dnd-kit/core";

/** Pointer: whatever slot is under the pointer. Keyboard (no pointer): nearest slot centre. */
export const collision: CollisionDetection = (args) => {
  if (args.pointerCoordinates) {
    const hits = pointerWithin(args);
    if (hits.length) return hits;
    return [];
  }
  return closestCenter(args);
};

let lastTarget: string | number | null = null;

/** Call when a drag starts so arrow navigation begins from the item's own position. */
export function resetKeyboardTarget() {
  lastTarget = null;
}

/**
 * Arrow keys jump between drop targets (this course's section slots, then the
 * tray) instead of nudging the item pixel by pixel. Targets are ordered by
 * day column, then by time.
 */
export const slotKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const forward = [KeyboardCode.Right, KeyboardCode.Down].includes(event.code as KeyboardCode);
  const backward = [KeyboardCode.Left, KeyboardCode.Up].includes(event.code as KeyboardCode);
  if (!forward && !backward) return undefined;
  event.preventDefault();

  const { droppableRects, droppableContainers, collisionRect, over } = context;
  if (!collisionRect) return undefined;
  const targets = droppableContainers
    .getEnabled()
    .map((c) => ({ id: c.id, rect: droppableRects.get(c.id) }))
    .filter((t): t is { id: typeof t.id; rect: NonNullable<typeof t.rect> } => !!t.rect)
    .sort((a, b) => (String(a.id) === "tray" ? 1 : String(b.id) === "tray" ? -1 : a.rect.left - b.rect.left || a.rect.top - b.rect.top));
  if (targets.length === 0) return undefined;

  // Track our own last target: `over` can lag a frame behind after the page scrolls.
  const i = targets.findIndex((t) => t.id === (lastTarget ?? over?.id));
  const next = i < 0 ? (forward ? 0 : targets.length - 1) : (i + (forward ? 1 : -1) + targets.length) % targets.length;
  lastTarget = targets[next].id;
  const r = targets[next].rect;
  return {
    x: r.left + r.width / 2 - collisionRect.width / 2,
    y: r.top + r.height / 2 - collisionRect.height / 2,
  };
};

export const screenReaderInstructions = {
  draggable:
    "กด Space หรือ Enter เพื่อหยิบวิชา ใช้ปุ่มลูกศรเลือกตอนเรียนที่จะวาง กด Space หรือ Enter อีกครั้งเพื่อวาง หรือกด Esc เพื่อยกเลิก",
};

export function announcements(name: (id: string | number) => string): Announcements {
  return {
    onDragStart: ({ active }) => `หยิบ ${name(active.id)} แล้ว ใช้ลูกศรเลือกตอนเรียน`,
    onDragOver: ({ over }) => {
      if (!over) return "ไม่ได้อยู่เหนือตอนเรียนใด";
      if (over.id === "tray") return "ปล่อยตรงนี้เพื่อเอาออกจากตาราง";
      const d = over.data.current as { label?: string; clash?: boolean } | undefined;
      return `${d?.label ?? ""}${d?.clash ? " ชนกับวิชาอื่น" : ""}`;
    },
    onDragEnd: ({ active, over }) => {
      if (!over) return `วาง ${name(active.id)} ไม่สำเร็จ ตารางไม่เปลี่ยน`;
      if (over.id === "tray") return `เอา ${name(active.id)} ออกจากตารางแล้ว`;
      const d = over.data.current as { label?: string } | undefined;
      return `วาง ${name(active.id)} ที่${d?.label ?? "ตอนที่เลือก"}แล้ว`;
    },
    onDragCancel: ({ active }) => `ยกเลิกการย้าย ${name(active.id)}`,
  };
}
