// Pure read helpers over the in-memory DB. No React, no I/O.

import { currentSprintNumber, daysBetween, todayKL, addDays, sprintDates } from "./sprint";
import type { ActionItem, DB, ImportantDate, Person, Project, Size, Task, Update } from "./types";
import { DEFAULT_THRESHOLDS, type LoadThresholds } from "./types";

export const byOrder = <T extends { sort_order: number; name?: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || (a.name ?? "").localeCompare(b.name ?? "");

export function activePeople(db: DB): Person[] {
  return Object.values(db.people).filter((p) => p.active).sort(byOrder);
}

export function allPeople(db: DB): Person[] {
  return Object.values(db.people).sort(byOrder);
}

export type ProjectNode = Project & { children: Project[] };

/** Top-level projects in order, each with its sub-projects. */
export function projectTree(db: DB, opts: { includeArchived?: boolean } = {}): ProjectNode[] {
  const all = Object.values(db.projects).filter((p) => opts.includeArchived || !p.archived);
  const ids = new Set(all.map((p) => p.id));
  const tops = all.filter((p) => !p.parent_id || !ids.has(p.parent_id)).sort(byOrder);
  return tops.map((t) => ({
    ...t,
    children: all.filter((c) => c.parent_id === t.id).sort(byOrder),
  }));
}

/** Projects flattened in display order (parent, then its children). */
export function projectsInOrder(db: DB, opts: { includeArchived?: boolean } = {}): Project[] {
  return projectTree(db, opts).flatMap(({ children, ...p }) => [p as Project, ...children]);
}

export function projectLabel(db: DB, p: Project): string {
  const parent = p.parent_id ? db.projects[p.parent_id] : null;
  return parent ? `${parent.short_name || parent.name} › ${p.name}` : p.name;
}

/** Tasks that at least one card sits under. A task left empty after cards moved away isn't offered. */
export function tasksForProject(db: DB, projectId: string): Task[] {
  const used = new Set(Object.values(db.updates).map((u) => u.task_id));
  return Object.values(db.tasks)
    .filter((t) => t.project_id === projectId && !t.archived && used.has(t.id))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function updatesForSprint(db: DB, n: number): Update[] {
  return Object.values(db.updates).filter((u) => u.sprint_number === n);
}

/**
 * "Last week" for sprint n: done notes written at this check-in, plus planned
 * items from the previous sprint that were ticked done (via the carry list or
 * during the week) without a separate done note.
 */
export function lastWeekItems(db: DB, n: number): Update[] {
  const all = Object.values(db.updates);
  const successors = new Set(all.filter((u) => u.carried_from_id).map((u) => u.carried_from_id));
  return all.filter(
    (u) =>
      (u.type === "done" && u.sprint_number === n) ||
      (u.type === "planned" && u.sprint_number === n - 1 && u.status === "done" && !successors.has(u.id)),
  );
}

export type SprintBoard = Record<string, { done: Update[]; planned: Update[]; blocker: Update[] }>;

/** Everything shown on This Week / Present for sprint n, bucketed by project. */
export function sprintBoard(db: DB, n: number, filter?: { personId?: string | null }): SprintBoard {
  const board: SprintBoard = {};
  const keep = (u: Update) => !filter?.personId || u.person_id === filter.personId;
  const bucket = (pid: string) => (board[pid] ??= { done: [], planned: [], blocker: [] });
  for (const u of lastWeekItems(db, n)) if (keep(u)) bucket(u.project_id).done.push(u);
  for (const u of plannedItems(db, n)) if (keep(u)) bucket(u.project_id).planned.push(u);
  for (const u of blockersForSprint(db, n)) if (keep(u)) bucket(u.project_id).blocker.push(u);
  return board;
}

export function plannedItems(db: DB, n: number): Update[] {
  return Object.values(db.updates).filter((u) => u.type === "planned" && u.sprint_number === n && u.status !== "dropped");
}

/** Blockers to show for sprint n: raised this sprint, or still open from before. */
export function blockersForSprint(db: DB, n: number): Update[] {
  return Object.values(db.updates).filter(
    (u) =>
      u.type === "blocker" &&
      (u.sprint_number === n ||
        (u.sprint_number < n && (!u.resolved || (u.resolved_at && sprintOfTimestamp(u.resolved_at) >= n)))),
  );
}

export function openBlockers(db: DB): Update[] {
  return Object.values(db.updates)
    .filter((u) => u.type === "blocker" && !u.resolved)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function ageInDays(createdAt: string, today = todayKL()): number {
  return Math.max(0, daysBetween(todayKL(new Date(createdAt)), today));
}

/** Which check-in sprint a timestamp falls in. */
export function sprintOfTimestamp(iso: string): number {
  return currentSprintNumber(new Date(iso));
}

export function points(size: Size | null): number {
  return size === "L" ? 3 : size === "M" ? 2 : 1;
}

export function sumPoints(items: Update[]): number {
  return items.reduce((t, u) => t + points(u.size), 0);
}

/** Projects a person posted in over the previous `lookback` sprints. */
export function usualProjectIds(db: DB, personId: string, n: number, lookback = 4): string[] {
  const counts = new Map<string, number>();
  for (const u of Object.values(db.updates)) {
    if (u.person_id !== personId || u.sprint_number >= n || u.sprint_number < n - lookback) continue;
    counts.set(u.project_id, (counts.get(u.project_id) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

export function actionItemsForSprint(db: DB, n: number): ActionItem[] {
  return Object.values(db.action_items)
    .filter((a) => a.sprint_number <= n && (!a.done || (a.done_at && sprintOfTimestamp(a.done_at) >= n)))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
}

/** Important dates from `from` for the next `days` days; urgent ones always show. */
export function upcomingDates(db: DB, from: string, days = 28): ImportantDate[] {
  const until = addDays(from, days);
  return Object.values(db.important_dates)
    .filter((d): d is ImportantDate & { date: string } => !!d.date && d.date >= from && (d.date <= until || d.priority === "urgent"))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Everything for the Important dates/info panel in week n: dates still ahead
 * (they drop off once passed), then the undated notes written for this week
 * only. Notes are not carried into the next week.
 */
export function importantItems(db: DB, n: number): ImportantDate[] {
  const notes = Object.values(db.important_dates)
    .filter((d) => !d.date && d.sprint_number === n)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return [...upcomingDates(db, datesWindowStart(n)), ...notes];
}

/** The window the This Week strip starts from: today for the live sprint, else the sprint's meeting day. */
export function datesWindowStart(n: number): string {
  const today = todayKL();
  const { meeting_date, end_date } = sprintDates(n);
  return today >= meeting_date && today <= end_date ? today : meeting_date;
}

export function loadThresholds(db: DB): LoadThresholds {
  const v = db.settings["load_thresholds"]?.value as Partial<LoadThresholds> | undefined;
  return { ...DEFAULT_THRESHOLDS, ...(v ?? {}) };
}

export function loadLevel(pts: number, t: LoadThresholds): "light" | "normal" | "heavy" {
  if (pts <= t.lightMax) return "light";
  if (pts >= t.heavyMin) return "heavy";
  return "normal";
}

/** Group updates by task, keeping task order by first appearance. */
export function groupByTask(updates: Update[]): Map<string, Update[]> {
  const sorted = [...updates].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const map = new Map<string, Update[]>();
  for (const u of sorted) {
    if (!map.has(u.task_id)) map.set(u.task_id, []);
    map.get(u.task_id)!.push(u);
  }
  // Within a task, keep each person's notes together (first contributor first).
  for (const [taskId, list] of map) {
    const order = [...new Set(list.map((u) => u.person_id))];
    map.set(taskId, [...list].sort((a, b) => order.indexOf(a.person_id) - order.indexOf(b.person_id)));
  }
  return map;
}

export function personName(db: DB, id: string | null | undefined): string {
  if (!id) return "someone";
  return db.people[id]?.name ?? "someone";
}

export function firstName(name: string): string {
  return name.split(" ")[0];
}
