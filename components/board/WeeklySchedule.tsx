"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowsClockwise, CalendarDots } from "@phosphor-icons/react";
import { buildWeek, calendarDays, letters, WEEKDAYS, type CalendarEntry, type Holiday } from "@/lib/calendar";
import { activePeople } from "@/lib/queries";
import { MONTHS } from "@/lib/sprint";
import { getAuth, useStore } from "@/lib/store";
import { showToast } from "../Toaster";
import { cx } from "../ui";
import { useBoard } from "./useBoard";

type Reply = { connected: boolean; setUp: boolean; problem?: string; holidays: Holiday[]; entries: CalendarEntry[]; notionUrl?: string };

const REFRESH_MS = 2 * 60_000;
const memo = new Map<string, { at: number; data: Reply }>();

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAuth()?.accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** The calendar for from..to: refetched every 2 minutes, and when you come back to the tab. */
function useCalendar(from: string, to: string) {
  const key = `${from}|${to}`;
  const [state, setState] = useState<{ key: string; data?: Reply; failed?: boolean }>(() => ({ key, data: memo.get(key)?.data }));
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar?from=${from}&to=${to}`, { headers: await authHeaders(), cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Reply;
      memo.set(key, { at: Date.now(), data });
      setState({ key, data });
    } catch {
      setState((s) => ({ key, data: s.key === key ? s.data : undefined, failed: true }));
    }
  }, [from, to, key]);

  useEffect(() => {
    const hit = memo.get(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show what we already have for this week straight away
    setState({ key, data: hit?.data });
    if (!hit || Date.now() - hit.at > REFRESH_MS) load();
    const t = setInterval(load, REFRESH_MS);
    const back = () => document.visibilityState === "visible" && Date.now() - (memo.get(key)?.at ?? 0) > 30_000 && load();
    document.addEventListener("visibilitychange", back);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", back);
    };
  }, [key, load]);

  return { data: state.key === key ? state.data : undefined, failed: state.key === key && !!state.failed, reload: load };
}

function rangeLabel(from: string, to: string) {
  const [, fm, fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  return fm === tm ? `${fd} – ${td} ${MONTHS[tm - 1]}` : `${fd} ${MONTHS[fm - 1]} – ${td} ${MONTHS[tm - 1]}`;
}

const NOTICES: Record<string, string> = {
  connected: "Notion connected. Weekly Schedule is now live.",
  cancelled: "Notion wasn't connected.",
  "no-calendar": "Connected, but the leave calendar wasn't shared. Connect again and tick the leave calendar.",
  error: "Couldn't connect Notion. Try again.",
};

/** Overview panel: who's WFH, on leave, and what else is on, Mon–Fri of the board's week, from the Notion leave calendar. */
export function WeeklySchedule() {
  const mode = useStore((s) => s.mode);
  const { db, me, n } = useBoard();
  const manager = ["lead", "admin"].includes(db.people[me]?.role ?? "");
  const days = useMemo(() => calendarDays(n), [n]);
  const { data, failed, reload } = useCalendar(days[0], days[4]);
  const people = useMemo(() => activePeople(db), [db]);
  const tags = useMemo(() => letters(people), [people]);
  const week = useMemo(() => (data ? buildWeek(days, data.entries, data.holidays, people) : null), [data, days, people]);

  // Coming back from Notion's approval page.
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("notion");
    if (!result) return;
    showToast(NOTICES[result] ?? NOTICES.error);
    url.searchParams.delete("notion");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (result === "connected") memo.clear();
  }, []);

  const connect = async () => {
    try {
      const res = await fetch("/api/notion/connect", { method: "POST", headers: await authHeaders() });
      const body = await res.json();
      if (!res.ok || !body.url) throw new Error(body.error);
      window.location.href = body.url;
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : NOTICES.error);
    }
  };

  if (mode !== "supabase") return null;

  let body: React.ReactNode;
  if (!data) {
    body = failed ? (
      <p className="panel-empty">
        Couldn&apos;t load the calendar.{" "}
        <button type="button" className="btn-link" onClick={reload}>
          Try again
        </button>
      </p>
    ) : (
      <p className="panel-empty">Loading…</p>
    );
  } else if (!data.connected || data.problem) {
    const lost = data.connected === false && data.setUp && data.problem === "no-access";
    body = (
      <div className="ocal-connect">
        <p>
          {manager
            ? lost
              ? "Notion can't see the leave calendar any more. Connect again and tick the leave calendar."
              : data.problem
                ? "Couldn't read the leave calendar from Notion just now."
                : "Show who's working from home or on leave, straight from the team's Notion leave calendar."
            : "WFH and leave will show here once the design lead or an admin connects Notion."}
        </p>
        {manager && data.problem && !lost ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>
            Try again
          </button>
        ) : manager ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={!data.setUp} onClick={connect}>
            Connect Notion
          </button>
        ) : null}
        {manager && !data.setUp && <span className="meta">Add the Notion keys to the server settings first.</span>}
      </div>
    );
  } else if (week) {
    const hcol = (i: number) => (week.holidayDays[i] ? "hcol" : undefined);
    const personRow = (label: string, emoji: string, lists: string[][], none: string, what: string, last?: boolean) => (
      <>
        <span className={cx("rl", last && "last")}>
          <span aria-hidden>{emoji}</span>
          <span className="t">{label}</span>
        </span>
        {lists.every((l) => !l.length) ? (
          <span className={cx("oc-cell none-row", last && "last")}>{none}</span>
        ) : (
          lists.map((ids, i) => (
            <span key={i} className={cx("oc-cell", hcol(i), last && "last")}>
              {ids.map((id) => (
                <span key={id} className="lt" tabIndex={0} data-tip={`${db.people[id]?.name} · ${what}`}>
                  {tags[id]}
                </span>
              ))}
            </span>
          ))
        )}
      </>
    );
    body = (
      <div className="ocal" role="table" aria-label={`Weekly Schedule, ${rangeLabel(days[0], days[4])}`}>
        <span className="corner" />
        {WEEKDAYS.map((d, i) => (
          <span key={d} className={cx("hd", hcol(i))}>
            {d}
            <small className="tab">{Number(days[i].slice(8))}</small>
          </span>
        ))}
        {personRow("WFH", "🏠", week.wfh, "No one WFH this week", "WFH")}
        {personRow("On leave", "🌴", week.leave, "No one on leave this week", "On leave", !week.others.length)}
        {week.others.length > 0 && (
          <>
            <span className="rl grp">
              <span aria-hidden>📌</span>
              <span className="t">Others</span>
            </span>
            {days.map((d, i) => (
              <span key={d} className={cx("oc-cell grp", hcol(i))} />
            ))}
            {week.others.map((r) => (
              <OtherRow key={r.key} row={r} hcol={hcol} />
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <section className="panel reveal" style={{ ["--i" as string]: 1 }} aria-labelledby="cal-h">
      <div className="panel-head">
        <span className="ico">
          <CalendarDots />
        </span>
        <h2 id="cal-h">Weekly Schedule</h2>
        <span className="end">
          {manager && data?.connected && (
            <button type="button" className="icon-btn sm" aria-label="Reconnect Notion" title="Reconnect Notion" onClick={connect}>
              <ArrowsClockwise />
            </button>
          )}
        </span>
      </div>
      <div className="panel-body">{body}</div>
      {data?.connected && data.notionUrl && (
        <div className="ocal-foot">
          <p className="meta">
            Information here are pulling live from{" "}
            <a href={data.notionUrl} target="_blank" rel="noopener noreferrer">
              Notion
            </a>
          </p>
        </div>
      )}
    </section>
  );
}

function OtherRow({ row, hcol }: { row: { title: string; holiday: boolean; days: boolean[]; range: string }; hcol: (i: number) => string | undefined }) {
  const tip = `${row.holiday ? "Public holiday · " : ""}${row.title} · ${row.range}`;
  return (
    <>
      <span className="rl sub">
        <span className="t">{row.title}</span>
      </span>
      {row.days.map((on, i) => (
        <span key={i} className={cx("oc-cell sub", hcol(i))}>
          {on &&
            (row.holiday ? (
              <span className="ph-mark" tabIndex={0} data-tip={tip}>
                PH
              </span>
            ) : (
              <span className="ev-dot" tabIndex={0} data-tip={tip} aria-label={tip} />
            ))}
        </span>
      ))}
    </>
  );
}
