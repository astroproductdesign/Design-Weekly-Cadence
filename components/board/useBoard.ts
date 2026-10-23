"use client";

import { useMemo } from "react";
import { boardCards, FLAGS, moveCard, COL_META, type BoardCard, type Col } from "@/lib/board";
import { confetti } from "@/lib/confetti";
import { currentSprintNumber } from "@/lib/sprint";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { showToast } from "../Toaster";
import { firstName } from "../ui";

/** Everything the board screens read, for the week being viewed. Past weeks are read-only; the next two can be planned. */
export function useBoard() {
  const db = useStore((s) => s.db);
  const me = useStore((s) => s.currentPersonId) ?? "";
  const current = currentSprintNumber();
  const n = useStore((s) => s.viewSprint) ?? current;
  const cards = useMemo(() => boardCards(db, n), [db, n]);
  return { db, me, current, n, history: n < current, future: n > current, cards };
}

/** Cards that pass the active filters and search. */
export function useVisibleCards(cards: BoardCard[]) {
  const db = useStore((s) => s.db);
  const { persons, projects, flags, q } = useUI();
  return useMemo(() => {
    const query = q.trim().toLowerCase();
    return cards.filter((c) => {
      const u = c.u;
      if (persons.length && !persons.includes(u.person_id)) return false;
      if (projects.length) {
        const parent = db.projects[u.project_id]?.parent_id;
        if (!projects.includes(u.project_id) && !(parent && projects.includes(parent))) return false;
      }
      if (flags.length && !FLAGS.some((f) => flags.includes(f.id) && f.test(c))) return false;
      if (query) {
        const hay = [u.text, db.tasks[u.task_id]?.title, db.people[u.person_id]?.name, db.projects[u.project_id]?.name].join(" ").toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [cards, db, persons, projects, flags, q]);
}

/** Move a card, then say what happened (with Undo) and celebrate a Done. */
export function moveWithFeedback(card: BoardCard, col: Col, projectId: string | null, point?: { x: number; y: number }, taskId?: string) {
  const { db, currentPersonId, viewSprint } = useStore.getState();
  const sprint = viewSprint ?? currentSprintNumber();
  const projectChanged = !!projectId && projectId !== card.u.project_id;
  const taskChanged = !!taskId && taskId !== card.u.task_id;
  if (col === card.col && !projectChanged && !taskChanged) return;
  const undo = moveCard(db, card, col, projectId, sprint, taskChanged ? taskId : undefined);
  const owner = card.u.person_id === currentPersonId ? "" : `${firstName(db.people[card.u.person_id]?.name)}'s card `;
  if (col === "done" && card.col !== "done") {
    showToast(`Nice! Moved ${owner}to Done`, undo);
    if (point) confetti(point.x, point.y);
  } else if (col !== card.col) showToast(`Moved ${owner}to ${COL_META[col].label}`, undo);
  else if (taskChanged && !projectChanged) showToast(`Moved ${owner}under “${db.tasks[taskId!]?.title}”`, undo);
  else if (projectChanged) showToast(`Moved ${owner}to ${db.projects[projectId!]?.short_name || db.projects[projectId!]?.name}`, undo);
  else showToast("Kept for this week", undo);
}
