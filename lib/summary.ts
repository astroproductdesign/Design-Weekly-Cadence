// Plain-text summaries of a sprint. Pure functions over the DB, so the same
// output can be copied to the clipboard today and posted to a Slack webhook
// later (Monday reminder, post-meeting summary) without touching the UI.

import { boardCards, COL_META, COLS, type BoardCard } from "./board";
import { actionItemsForSprint, ageInDays, firstName, personName, projectLabel, projectsInOrder, importantItems } from "./queries";
import { currentSprintNumber, dayMonth, sprintRangeLabel, weekLabel } from "./sprint";
import type { DB } from "./types";

function cardLine(db: DB, c: BoardCard): string {
  const u = c.u;
  const who = firstName(personName(db, u.person_id));
  const task = db.tasks[u.task_id]?.title ?? "";
  const text = (u.text.trim() || task).replace(/\n+/g, "; ").replace(/^[-*•]\s+/gm, "");
  const extra = [u.size ? `[${u.size}]` : "", u.due_date ? `(due ${dayMonth(u.due_date)})` : ""].filter(Boolean).join(" ");
  const help = u.help_from_person_id ? personName(db, u.help_from_person_id) : u.help_from_text;
  const blocker = c.col === "blocked" ? ` → needs ${help || "a hand"}, open ${ageInDays(u.created_at)} days` : "";
  return `    • ${who}: ${text}${extra ? ` ${extra}` : ""}${blocker}`;
}

/** Full sprint summary as Markdown (Slack-friendly). */
export function buildSprintSummary(db: DB, n: number, opts: { appUrl?: string } = {}): string {
  const lines: string[] = [`*Design Cadence · ${weekLabel(n)} · ${sprintRangeLabel(n)}*`, ""];

  const dates = importantItems(db, n);
  if (dates.length) {
    lines.push("*Important dates/info*");
    for (const d of dates) {
      const proj = d.project_id ? db.projects[d.project_id] : null;
      lines.push(
        `  • ${d.priority === "urgent" ? "🔴 " : ""}${d.date ? `${dayMonth(d.date)} · ` : ""}${d.title}${proj ? ` (${proj.short_name || proj.name})` : ""}${d.note ? ` · ${d.note}` : ""}`,
      );
    }
    lines.push("");
  }

  const cards = boardCards(db, n, currentSprintNumber()).filter((c) => !c.toSort && !(c.col === "blocked" && c.u.resolved));
  for (const p of projectsInOrder(db, { includeArchived: true })) {
    const mine = cards.filter((c) => c.u.project_id === p.id);
    if (!mine.length) continue;
    lines.push(`*${projectLabel(db, p)}*`);
    for (const col of COLS) {
      const list = mine.filter((c) => c.col === col);
      if (!list.length) continue;
      lines.push(`  _${COL_META[col].label}_`);
      for (const c of list) lines.push(cardLine(db, c));
    }
    lines.push("");
  }

  const actions = actionItemsForSprint(db, n).filter((a) => !a.done);
  if (actions.length) {
    lines.push("*Action items*");
    for (const a of actions) {
      lines.push(
        `  ☐ ${a.text}${a.owner_ids.length ? ` · ${a.owner_ids.map((id) => firstName(personName(db, id))).join(", ")}` : ""}${a.due_date ? ` · due ${dayMonth(a.due_date)}` : ""}`,
      );
    }
    lines.push("");
  }

  if (opts.appUrl) lines.push(`Open the board: ${opts.appUrl}`);
  return lines.join("\n").trim() + "\n";
}

/** Friendly nudge for someone who hasn't updated yet (for a Monday reminder later). */
export function buildReminderMessage(db: DB, personId: string, n: number, link: string): string {
  const name = firstName(personName(db, personId));
  return `Hi ${name}! Quick nudge to add your Design Cadence cards for ${weekLabel(n)} (${sprintRangeLabel(n)}) before Tuesday's check-in. Takes 2 minutes: ${link}`;
}
