// The board model: every update shown as a card in one of three columns.
// Pure reads plus the writes behind drag and drop and the quick actions.

import { findOrCreateTask } from "./actions";
import { isOpenPlanned } from "./queries";
import { dueState } from "./sprint";
import { deleteRow, insertRow, patchRow, revertFields, stableId } from "./store";
import type { DB, Update, UpdateType } from "./types";

export type Col = "done" | "doing" | "blocked";
export const COLS: Col[] = ["done", "doing", "blocked"];

export const COL_META: Record<Col, { label: string; sub: string; prompt: string; empty: string }> = {
  done: { label: "Done", sub: "Last week", prompt: "What did you get done?", empty: "Nothing done yet" },
  doing: { label: "Doing", sub: "This week", prompt: "What are you working on?", empty: "Nothing planned yet" },
  blocked: { label: "Blocked", sub: "Needs a hand", prompt: "What's in the way?", empty: "No blockers" },
};

const COL_OF: Record<UpdateType, Col> = { done: "done", planned: "doing", blocker: "blocked" };
export const TYPE_OF: Record<Col, UpdateType> = { done: "done", doing: "planned", blocked: "blocker" };

export type BoardCard = {
  u: Update;
  col: Col;
  /** Planned in an earlier sprint and still open: the owner sorts it (Done / Keep / Drop). */
  toSort: boolean;
  /** Row belongs to an earlier sprint (moving it copies it into this one). */
  older: boolean;
};

/** Cards for sprint n. `current` is the live sprint (only it shows cards to sort). */
export function boardCards(db: DB, n: number, current: number): BoardCard[] {
  const all = Object.values(db.updates);
  const successors = new Set(all.map((u) => u.carried_from_id).filter(Boolean));
  const out: BoardCard[] = [];
  for (const u of all) {
    if (u.sprint_number === n) {
      if (u.type === "planned" && u.status === "dropped") continue;
      out.push({ u, col: COL_OF[u.type], toSort: false, older: false });
    } else if (u.sprint_number < n && !successors.has(u.id)) {
      if (u.type === "planned" && u.sprint_number === n - 1 && u.status === "done") {
        out.push({ u, col: "done", toSort: false, older: true });
      } else if (n === current && isOpenPlanned(u)) {
        out.push({ u, col: "doing", toSort: true, older: true });
      } else if (u.type === "blocker" && !u.resolved) {
        // Unresolved blockers stay visible every sprint until someone resolves them.
        out.push({ u, col: "blocked", toSort: false, older: true });
      }
    }
  }
  return out;
}

export type Flag = { id: string; label: string; test: (c: BoardCard) => boolean };

export const FLAGS: Flag[] = [
  { id: "overdue", label: "Overdue", test: (c) => c.col !== "done" && !!c.u.due_date && dueState(c.u.due_date) === "overdue" },
  { id: "soon", label: "Due in 3 days", test: (c) => c.col !== "done" && !!c.u.due_date && dueState(c.u.due_date) === "soon" },
  { id: "carried", label: "From last week, to sort", test: (c) => c.toSort },
  { id: "stuck", label: "Stuck (carried 2+ weeks)", test: (c) => c.col === "doing" && c.u.carry_count >= 2 },
  { id: "blocked", label: "Open blockers", test: (c) => c.col === "blocked" && !c.u.resolved },
];

function stripAudit(u: Update) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { created_at, updated_at, created_by, updated_by, ...rest } = u;
  return rest;
}

/**
 * Move a card to another column and/or project. Cards from this sprint are
 * updated in place; cards from an earlier sprint are copied into this sprint
 * (the original is closed) so history stays intact. Returns an undo.
 */
export function moveCard(db: DB, card: BoardCard, col: Col, projectId: string | null, sprint: number, taskOverride?: string): () => void {
  const u = card.u;
  const type = TYPE_OF[col];
  const project = projectId ?? u.project_id;
  const taskId = taskOverride ?? (project === u.project_id ? u.task_id : findOrCreateTask(project, db.tasks[u.task_id]?.title ?? "Untitled"));
  const prev = { ...u };
  const moved: (keyof Update)[] = ["type", "project_id", "task_id", "status", "resolved", "resolved_at"];

  if (!card.older) {
    patchRow("updates", u.id, {
      type,
      project_id: project,
      task_id: taskId,
      status: type === "planned" ? (u.status && u.status !== "done" ? u.status : "in_progress") : null,
      resolved: type === "blocker" ? false : u.resolved,
      resolved_at: type === "blocker" ? null : u.resolved_at,
    });
    return () => revertFields("updates", prev, moved);
  }

  if (u.type === "planned") patchRow("updates", u.id, { status: col === "done" ? "done" : "carried_over" });
  else if (u.type === "blocker") patchRow("updates", u.id, { resolved: true, resolved_at: new Date().toISOString() });
  const copy = insertRow("updates", {
    ...stripAudit(u),
    // Same id on every device: if two people carry this card at once, it lands once.
    id: stableId("carry", u.id, sprint),
    sprint_number: sprint,
    type,
    project_id: project,
    task_id: taskId,
    status: type === "planned" ? "in_progress" : null,
    resolved: false,
    resolved_at: null,
    carried_from_id: u.id,
    carry_count: type === "planned" ? u.carry_count + 1 : u.carry_count,
  });
  return () => {
    deleteRow("updates", copy.id);
    revertFields("updates", prev, moved);
  };
}

/** "Drop" on a card from last sprint: it's no longer happening. */
export function dropCard(u: Update): () => void {
  const prev = { ...u };
  patchRow("updates", u.id, { status: "dropped" });
  return () => revertFields("updates", prev, ["status"]);
}
