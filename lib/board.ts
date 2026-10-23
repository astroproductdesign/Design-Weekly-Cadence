// The board model: every update shown as a card in one of three columns.
// Pure reads plus the writes behind drag and drop and the quick actions.

import { findOrCreateTask } from "./actions";
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
  /** Row belongs to an earlier sprint (an unresolved blocker; moving it copies it into this one). */
  older: boolean;
};

/**
 * Cards for sprint n. Nothing from earlier weeks is brought over except
 * blockers nobody has resolved yet, which stay visible until someone does.
 */
export function boardCards(db: DB, n: number): BoardCard[] {
  const out: BoardCard[] = [];
  for (const u of Object.values(db.updates)) {
    if (u.sprint_number === n) {
      if (u.type === "planned" && u.status === "dropped") continue;
      out.push({ u, col: COL_OF[u.type], older: false });
    } else if (u.sprint_number < n && u.type === "blocker" && !u.resolved) {
      out.push({ u, col: "blocked", older: true });
    }
  }
  return out;
}

export type Flag = { id: string; label: string; test: (c: BoardCard) => boolean };

export const FLAGS: Flag[] = [
  { id: "overdue", label: "Overdue", test: (c) => c.col !== "done" && !!c.u.due_date && dueState(c.u.due_date) === "overdue" },
  { id: "soon", label: "Due in 3 days", test: (c) => c.col !== "done" && !!c.u.due_date && dueState(c.u.due_date) === "soon" },
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

  if (u.type === "blocker") patchRow("updates", u.id, { resolved: true, resolved_at: new Date().toISOString() });
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
  });
  return () => {
    deleteRow("updates", copy.id);
    revertFields("updates", prev, moved);
  };
}
