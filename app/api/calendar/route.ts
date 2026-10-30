import { clients, NOT_SET_UP, reply } from "@/lib/server/otp";
import { holidayMatcher, klHolidays } from "@/lib/server/holidays";
import { caller, calendarEntries, isConnected, loginRequired, notionConfig } from "@/lib/server/notion";

const PERSONAL = ["🏠", "🏡", "🌴", "✈️", "✈"];
const day = /^\d{4}-\d{2}-\d{2}$/;

/** Weekly Schedule for from..to: Notion leave calendar entries plus KL public holidays. Team members only. */
export async function GET(request: Request) {
  const c = clients();
  if (!c) return NOT_SET_UP();
  const q = new URL(request.url).searchParams;
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  if (!day.test(from) || !day.test(to) || from > to) return reply({ error: "Bad dates." }, 400);
  if (loginRequired() && !(await caller(request, c.admin))) return reply({ error: "Sign in to see the calendar." }, 401);

  const cfg = notionConfig();
  const holidays = await klHolidays(from, to);
  if (!cfg) return reply({ connected: false, setUp: false, holidays, entries: [] });
  if (!(await isConnected(c.admin))) return reply({ connected: false, setUp: true, holidays, entries: [] });

  const res = await calendarEntries(c.admin, from, to);
  if ("error" in res) return reply({ connected: res.error !== "no-access", setUp: true, problem: res.error, holidays, entries: [], notionUrl: cfg.calendarUrl });
  // A holiday the team typed into Notion (e.g. a replacement day) counts as a public holiday.
  const isHoliday = await holidayMatcher();
  const entries = res.entries.map((e) => (!PERSONAL.includes(e.icon ?? "") && isHoliday(e.title) ? { ...e, icon: "🎉" } : e));
  return reply({ connected: true, setUp: true, holidays, entries, notionUrl: cfg.calendarUrl });
}
