// Server-only: Kuala Lumpur public holidays, from Google's public Malaysia
// holiday calendar. Keeps national holidays and regional ones that include KL;
// drops observances and other states' days.

const FEED = "https://calendar.google.com/calendar/ical/en.malaysia%23holiday%40group.v.calendar.google.com/public/basic.ics";
const KEEP_MS = 12 * 60 * 60_000;

export type Holiday = { date: string; name: string };

let cached: { at: number; list: Holiday[] } | null = null;

/** Names as Malaysians say them. */
const RENAME: Record<string, string> = { Diwali: "Deepavali" };

export function parseKLHolidays(ics: string): Holiday[] {
  const text = ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, ""); // unfold long lines
  const out: Holiday[] = [];
  for (const ev of text.split("BEGIN:VEVENT").slice(1)) {
    const field = (k: string) => ev.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, "m"))?.[1] ?? "";
    const desc = field("DESCRIPTION").replace(/\\n/g, "\n").replace(/\\,/g, ",");
    const firstLine = desc.split("\n")[0].trim();
    if (firstLine !== "Public holiday" && !(firstLine.startsWith("Public holiday in") && firstLine.includes("Kuala Lumpur"))) continue;
    const d = field("DTSTART").trim();
    if (!/^\d{8}$/.test(d)) continue;
    const name = field("SUMMARY").replace(/\\,/g, ",").replace(/\s*\(regional holiday\)\s*$/i, "").trim();
    out.push({ date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, name: RENAME[name] ?? name });
  }
  return out;
}

async function load() {
  if (!cached || Date.now() - cached.at > KEEP_MS) {
    try {
      const res = await fetch(FEED, { cache: "no-store" });
      if (res.ok) cached = { at: Date.now(), list: parseKLHolidays(await res.text()) };
    } catch {
      // Keep whatever we had; holidays are a nice-to-have.
    }
  }
  return cached?.list ?? [];
}

/** KL public holidays from..to (inclusive). An empty list if the feed can't be reached. */
export async function klHolidays(from: string, to: string): Promise<Holiday[]> {
  return (await load()).filter((h) => h.date >= from && h.date <= to);
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const FILLER = new Set(["day", "holiday", "observed", "the", "of", "s"]);
/** "Christmas Day" → "christmas", "Hari Raya Haji" → "hariraya haji" squashed, "Deepavali" → "deepavali". */
const keyOf = (name: string) => name.split(/[\s']+/).map(squash).filter((w) => w && !FILLER.has(w)).join("");

/** Whether a calendar title names a KL public holiday ("Deepavali", "Merry christmas"). */
export async function holidayMatcher(): Promise<(title: string) => boolean> {
  const keys = new Set((await load()).map((h) => keyOf(h.name)).filter((k) => k.length >= 5));
  return (title) => [...keys].some((k) => squash(title).includes(k));
}
