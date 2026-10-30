// Weekly Schedule: turns Notion leave-calendar entries and public holidays into
// the Mon–Fri grid in the Overview. Pure functions, no fetching.

import { addDays, sprintDates } from "./sprint";
import type { Person } from "./types";

export type CalendarEntry = { id: string; title: string; icon: string | null; start: string; end: string };
export type Holiday = { date: string; name: string };

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** Mon–Fri of the week a board week starts in (board weeks start on a Wednesday). */
export function calendarDays(sprintNumber: number): string[] {
  const monday = addDays(sprintDates(sprintNumber).start_date, -2);
  return WEEKDAYS.map((_, i) => addDays(monday, i));
}

export type OtherRow = { key: string; title: string; holiday: boolean; days: boolean[]; range: string };
export type CalendarWeek = {
  wfh: string[][]; // person ids per weekday
  leave: string[][];
  others: OtherRow[];
  holidayDays: boolean[];
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const WFH_ICONS = ["🏠", "🏡"];
const LEAVE_ICONS = ["🌴", "✈️", "✈", "🏖️", "🏝️", "🤒"];
const HOLIDAY_ICONS = ["🎉"];

/** The board person a title is about ("Jiayi WFH" → Jia Yi), matched on the start of the title. */
function personFor(title: string, people: Person[]): Person | null {
  const t = squash(title);
  let best: { p: Person; len: number } | null = null;
  for (const p of people) {
    for (const cand of [squash(p.name), squash(p.name.split(" ")[0])]) {
      if (cand.length >= 2 && t.startsWith(cand) && (!best || cand.length > best.len)) best = { p, len: cand.length };
    }
  }
  return best?.p ?? null;
}

/** "Dani at bootcamp", "Dani AL": reads like it's about one person. */
const looksPersonal = (title: string) => /^[A-Z][\w'-]*\s+(at|@|on|in|-|–|al|wfh|leave|mc)\b/i.test(title.trim());

function kindOf(e: CalendarEntry): "wfh" | "leave" | "holiday" | "other" {
  const icon = e.icon ?? "";
  if (WFH_ICONS.includes(icon) || /\bwfh\b/i.test(e.title)) return "wfh";
  if (LEAVE_ICONS.includes(icon) || /\b(leave|al|mc|el|off)\b/i.test(e.title)) return "leave";
  if (HOLIDAY_ICONS.includes(icon) || /\b(ph|public holiday)\b/i.test(e.title)) return "holiday";
  return "other";
}

const short = (d: string[]) => (d.length === 1 ? d[0] : `${d[0]}–${d[d.length - 1]}`);

export function buildWeek(days: string[], entries: CalendarEntry[], holidays: Holiday[], people: Person[]): CalendarWeek {
  const covers = (start: string, end: string) => days.map((d) => d >= start && d <= end);
  const wfh: string[][] = days.map(() => []);
  const leave: string[][] = days.map(() => []);
  const others = new Map<string, OtherRow>();
  const addOther = (key: string, title: string, holiday: boolean, on: boolean[]) => {
    const row = others.get(key) ?? { key, title, holiday, days: days.map(() => false), range: "" };
    row.days = row.days.map((v, i) => v || on[i]);
    others.set(key, row);
  };

  for (const h of holidays) addOther(`ph:${h.date}`, h.name, true, covers(h.date, h.date));

  for (const e of entries) {
    const on = covers(e.start, e.end);
    if (!on.some(Boolean)) continue; // weekend only
    const kind = kindOf(e);
    if (kind === "holiday") {
      // Already in the public list for that day? Keep one.
      const dup = days.some((d, i) => on[i] && others.has(`ph:${d}`));
      if (!dup) addOther(`ph:${e.id}`, e.title.replace(/^\s*(ph|public holiday)\s*[:\-–·]?\s*/i, "") || "Public holiday", true, on);
      continue;
    }
    const person = personFor(e.title, people);
    if (kind === "wfh" || kind === "leave") {
      if (!person) continue; // not on the board
      const list = kind === "wfh" ? wfh : leave;
      on.forEach((v, i) => v && !list[i].includes(person.id) && list[i].push(person.id));
      continue;
    }
    if (!person && looksPersonal(e.title)) continue; // about someone not on the board
    addOther(`ev:${squash(e.title)}`, e.title, false, on);
  }

  const order = (p: Person) => people.indexOf(p);
  const byBoardOrder = (ids: string[]) => ids.sort((a, b) => order(people.find((p) => p.id === a)!) - order(people.find((p) => p.id === b)!));
  wfh.forEach(byBoardOrder);
  leave.forEach(byBoardOrder);

  const rows = [...others.values()]
    .map((r) => ({ ...r, range: short(WEEKDAYS.filter((_, i) => r.days[i])) }))
    .sort((a, b) => Number(b.holiday) - Number(a.holiday) || a.days.indexOf(true) - b.days.indexOf(true) || a.title.localeCompare(b.title));
  const holidayDays = days.map((_, i) => rows.some((r) => r.holiday && r.days[i]));
  return { wfh, leave, others: rows, holidayDays };
}

/** One letter per person (two where first letters clash), e.g. E, J, L … or JY, JO. */
export function letters(people: Person[]): Record<string, string> {
  const first = (p: Person) => p.name.trim()[0]?.toUpperCase() ?? "?";
  const count = new Map<string, number>();
  for (const p of people) count.set(first(p), (count.get(first(p)) ?? 0) + 1);
  return Object.fromEntries(people.map((p) => [p.id, count.get(first(p))! > 1 ? squash(p.name).slice(0, 2).toUpperCase() : first(p)]));
}
