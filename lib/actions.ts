// Domain-level writes. Each returns an undo function where it makes sense.

import { deleteRow, getCurrentPersonId, insertRow, newId, patchRow, useStore } from "./store";
import type { Size, Update, UpdateType } from "./types";

const db = () => useStore.getState().db;

/** Find a task in a project by title (case-insensitive), or create it. */
export function findOrCreateTask(projectId: string, title: string): string {
  const clean = title.trim();
  const existing = Object.values(db().tasks).find(
    (t) => t.project_id === projectId && t.title.trim().toLowerCase() === clean.toLowerCase(),
  );
  if (existing) {
    if (existing.archived) patchRow("tasks", existing.id, { archived: false });
    return existing.id;
  }
  return insertRow("tasks", { id: newId(), project_id: projectId, title: clean, description: null, archived: false }).id;
}

export function addUpdate(input: {
  sprint: number;
  projectId: string;
  taskId: string;
  type: UpdateType;
  text: string;
  size: Size | null;
  due: string | null;
  helpFromPersonId?: string | null;
  helpFromText?: string | null;
  images?: string[];
}): Update {
  const me = getCurrentPersonId()!;
  return insertRow("updates", {
    id: newId(),
    sprint_number: input.sprint,
    project_id: input.projectId,
    task_id: input.taskId,
    person_id: me,
    type: input.type,
    text: input.text,
    size: input.size,
    due_date: input.due,
    status: input.type === "planned" ? "not_started" : null,
    help_from_person_id: input.type === "blocker" ? (input.helpFromPersonId ?? null) : null,
    help_from_text: input.type === "blocker" ? (input.helpFromText ?? null) : null,
    resolved: false,
    resolved_at: null,
    carried_from_id: null,
    carry_count: 0,
    // Only sent when there are pictures, so cards still save on a database that hasn't added the column yet.
    ...(input.images?.length ? { images: input.images } : {}),
  });
}

export function setBlockerResolved(u: Update, resolved: boolean) {
  patchRow("updates", u.id, { resolved, resolved_at: resolved ? new Date().toISOString() : null });
}

export function toggleReaction(targetType: "update" | "date", targetId: string, emoji: string) {
  const me = getCurrentPersonId();
  if (!me) return;
  const existing = Object.values(db().reactions).find(
    (r) => r.target_id === targetId && r.emoji === emoji && r.person_id === me,
  );
  if (existing) deleteRow("reactions", existing.id);
  else insertRow("reactions", { id: newId(), target_type: targetType, target_id: targetId, emoji, person_id: me });
}

export function addActionItem(text: string, ownerIds: string[], due: string | null, sprint: number) {
  return insertRow("action_items", {
    id: newId(),
    text: text.trim(),
    owner_ids: ownerIds,
    due_date: due,
    sprint_number: sprint,
    done: false,
    done_at: null,
  });
}

export function setActionDone(id: string, done: boolean) {
  patchRow("action_items", id, { done, done_at: done ? new Date().toISOString() : null });
}
