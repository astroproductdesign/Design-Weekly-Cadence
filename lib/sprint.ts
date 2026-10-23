// Sprint maths. All "today" calculations happen in Asia/Kuala_Lumpur (UTC+8, no DST).
// A sprint runs Wednesday → Tuesday. Sprint 86 = Wed 21 Oct 2026 → Tue 27 Oct 2026.

import type { Sprint } from "./types";

export const TIME_ZONE = "Asia/Kuala_Lumpur";
const ANCHOR_NUMBER = 86;
const ANCHOR_START = "2026-10-21"; // a Wednesday
const DAY = 86_400_000;

/** yyyy-mm-dd → UTC-midnight epoch ms (date-only arithmetic, no time zone drift). */
export function dayMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return isoFromMs(dayMs(iso) + n * DAY);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((dayMs(toIso) - dayMs(fromIso)) / DAY);
}

/** Today's date in Kuala Lumpur as yyyy-mm-dd. */
export function todayKL(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

export function sprintForDate(iso: string): number {
  return ANCHOR_NUMBER + Math.floor(daysBetween(ANCHOR_START, iso) / 7);
}

export function sprintDates(number: number) {
  const start_date = addDays(ANCHOR_START, (number - ANCHOR_NUMBER) * 7);
  return {
    start_date,
    end_date: addDays(start_date, 6),
    meeting_date: addDays(start_date, -1),
  };
}

/**
 * The sprint people are checking in for. It opens on its meeting day (the
 * Tuesday before it starts), so updates can be written before and during the
 * meeting; from Wednesday 00:00 it is also the sprint "by date".
 */
export function currentSprintNumber(now: Date = new Date()): number {
  return sprintForDate(addDays(todayKL(now), 1));
}

/** Deterministic id per sprint number so every device creates the same row. */
export function sprintId(number: number): string {
  return `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
}

export function makeSprint(number: number): Sprint {
  return { id: sprintId(number), number, ...sprintDates(number), created_at: new Date().toISOString() };
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "21–27 Oct" or "28 Oct – 3 Nov" */
export function sprintRangeLabel(number: number): string {
  const { start_date, end_date } = sprintDates(number);
  const s = new Date(dayMs(start_date));
  const e = new Date(dayMs(end_date));
  if (s.getUTCMonth() === e.getUTCMonth()) {
    return `${s.getUTCDate()}–${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]}`;
  }
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]} – ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]}`;
}

/** "Thu 22 Oct" */
export function shortDate(iso: string): string {
  const d = new Date(dayMs(iso));
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "22 Oct" */
export function dayMonth(iso: string): string {
  const d = new Date(dayMs(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export type DueState = "overdue" | "soon" | "later";

/** Overdue = past due; soon = due within the next 3 days. */
export function dueState(due: string, today: string = todayKL()): DueState {
  const diff = daysBetween(today, due);
  if (diff < 0) return "overdue";
  if (diff <= 3) return "soon";
  return "later";
}

export function relativeDay(iso: string, today: string = todayKL()): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff < 0) return `${-diff} days ago`;
  if (diff < 14) return `in ${diff} days`;
  return `in ${Math.round(diff / 7)} weeks`;
}

// Weeks by month --------------------------------------------------------------
// People think in "Oct Week 4", not sprint numbers. A week belongs to the
// month holding most of its days (its middle day, Saturday), so 30 Sep – 6 Oct
// is "Oct Week 1". Sprint numbers stay as the stable id underneath.

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** How many weeks ahead people can plan (this week + this many). */
export const WEEKS_AHEAD = 2;

export function sprintMonth(number: number): { year: number; month: number; week: number } {
  const mid = new Date(dayMs(addDays(sprintDates(number).start_date, 3)));
  return { year: mid.getUTCFullYear(), month: mid.getUTCMonth(), week: Math.ceil(mid.getUTCDate() / 7) };
}

/** "Oct Week 4" */
export function weekLabel(number: number): string {
  const { month, week } = sprintMonth(number);
  return `${MONTHS[month]} Week ${week}`;
}

/** "Oct Week 4 · 21–27 Oct" */
export function weekTitle(number: number): string {
  return `${weekLabel(number)} · ${sprintRangeLabel(number)}`;
}

/** Sprint numbers whose week belongs to a given month, oldest first. */
export function sprintsInMonth(year: number, month: number): number[] {
  const first = sprintForDate(isoFromMs(Date.UTC(year, month, 1)));
  const out: number[] = [];
  for (let n = first - 1; n <= first + 5; n++) {
    const m = sprintMonth(n);
    if (m.year === year && m.month === month) out.push(n);
  }
  return out;
}

/** "This week", "Next week", "Last week", "In 2 weeks", "3 weeks ago" */
export function weekRelative(number: number, current: number): string {
  const d = number - current;
  if (d === 0) return "This week";
  if (d === 1) return "Next week";
  if (d === -1) return "Last week";
  return d > 0 ? `In ${d} weeks` : `${-d} weeks ago`;
}
