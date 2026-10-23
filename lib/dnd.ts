"use client";

// Pointer-based drag and drop for cards. Works with mouse and pen anywhere on
// the card, and with touch from the card's drag handle (so phones can still
// scroll). Drop targets are elements with data-cell, data-col and data-lane.

export type DropTarget = { col: string; lane: string; task: string };
type Options = {
  canDrop: (t: DropTarget) => boolean;
  onDrop: (t: DropTarget, point: { x: number; y: number }) => void;
  onRefused: () => void;
};

type Drag = Options & {
  el: HTMLElement;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  w: number;
  on: boolean;
  lx?: number;
  ghost?: HTMLElement;
  target: HTMLElement | null;
  task: HTMLElement | null;
};

let drag: Drag | null = null;
let suppressClick = false;

/** True right after a drag ended, so the card's click handler can ignore it. */
export const justDragged = () => suppressClick;

export function startDrag(e: React.PointerEvent<HTMLElement>, opts: Options) {
  if (e.button > 0) return;
  const t = e.target as HTMLElement;
  if (t.closest("button, input, textarea, select, a, [data-nodrag]")) return;
  if (e.pointerType !== "mouse" && !t.closest("[data-handle]")) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  drag = { ...opts, el, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, on: false, target: null, task: null };
  addEventListener("pointermove", move, { passive: false });
  addEventListener("pointerup", end);
  addEventListener("pointercancel", cancel);
}

function dataOf(el: HTMLElement, task?: HTMLElement | null): DropTarget {
  return { col: el.dataset.col ?? "", lane: el.dataset.lane ?? "", task: task && el.contains(task) ? (task.dataset.task ?? "") : "" };
}

function move(e: PointerEvent) {
  if (!drag) return;
  if (!drag.on) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.on = true;
    const g = drag.el.cloneNode(true) as HTMLElement;
    Object.assign(g.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: `${drag.w}px`,
      zIndex: "100",
      pointerEvents: "none",
      margin: "0",
      opacity: "0.97",
      transition: "transform .12s cubic-bezier(.16,.84,.24,1)",
    });
    g.classList.add("is-ghost");
    document.body.appendChild(g);
    drag.ghost = g;
    drag.el.classList.add("ghost-src");
    document.body.classList.add("is-dragging");
  }
  e.preventDefault();
  const tilt = Math.max(-6, Math.min(6, (e.clientX - (drag.lx ?? e.clientX)) * 0.6));
  drag.lx = e.clientX;
  drag.ghost!.style.transform = `translate(${e.clientX - drag.ox}px, ${e.clientY - drag.oy}px) rotate(${2.5 + tilt}deg) scale(1.03)`;
  const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  const cell = under?.closest<HTMLElement>("[data-cell]") ?? null;
  // Over a task's group inside the cell: dropping there files the card under that task.
  const task = cell ? (under?.closest<HTMLElement>("[data-task]") ?? null) : null;
  if (task !== drag.task) {
    drag.task?.classList.remove("drop-task");
    drag.task = task && cell?.contains(task) ? task : null;
    drag.task?.classList.add("drop-task");
  }
  if (cell !== drag.target) {
    drag.target?.classList.remove("drop", "no");
    drag.target = cell;
    if (cell) {
      cell.classList.add("drop");
      if (!drag.canDrop(dataOf(cell, drag.task))) cell.classList.add("no");
    }
  }
  if (e.clientY < 110) scrollBy(0, -14);
  else if (e.clientY > innerHeight - 70) scrollBy(0, 14);
}

function cleanup() {
  removeEventListener("pointermove", move);
  removeEventListener("pointerup", end);
  removeEventListener("pointercancel", cancel);
  if (!drag) return;
  drag.ghost?.remove();
  drag.el.classList.remove("ghost-src");
  drag.target?.classList.remove("drop", "no");
  drag.task?.classList.remove("drop-task");
  document.body.classList.remove("is-dragging");
}

function end(e: PointerEvent) {
  const d = drag;
  cleanup();
  drag = null;
  if (!d || !d.on) return;
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 0);
  if (!d.target) return;
  const t = dataOf(d.target, d.task);
  if (!d.canDrop(t)) d.onRefused();
  else d.onDrop(t, { x: e.clientX, y: e.clientY });
}

function cancel() {
  cleanup();
  drag = null;
}
