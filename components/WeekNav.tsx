"use client";

import { useRef, useState } from "react";
import { CalendarBlank, CaretDown, CaretLeft, CaretRight, Check } from "@phosphor-icons/react";
import { MONTH_NAMES, MONTHS, sprintMonth, sprintRangeLabel, sprintsInMonth, weekLabel, weekRelative, WEEKS_AHEAD } from "@/lib/sprint";
import { setViewSprint, useStore } from "@/lib/store";
import { setUI } from "@/lib/ui-store";
import { Popover } from "./Popover";
import { cx } from "./ui";

/** Go to a week. The live week is stored as null so the app always reopens on it. */
export function goToWeek(n: number, current: number) {
  setViewSprint(n === current ? null : n);
  setUI({ open: null, composer: null, dateForm: null });
}

/**
 * Week switcher for the top bar: "Oct Week 4 · 21–27 Oct" with arrows, and a
 * month-by-month picker (click the month title for a year of months) so it
 * stays quick to get around as the history grows.
 */
export function WeekNav({ n, current }: { n: number; current: number }) {
  const earliest = useStore((s) => Math.min(current, ...Object.values(s.db.sprints).map((x) => x.number)));
  const counts = useStore((s) => {
    const c: Record<number, number> = {};
    for (const u of Object.values(s.db.updates)) c[u.sprint_number] = (c[u.sprint_number] ?? 0) + 1;
    return JSON.stringify(c);
  });
  const latest = current + WEEKS_AHEAD;
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => sprintMonth(n));
  const [months, setMonths] = useState(false);
  const inRange = (x: number) => x >= earliest && x <= latest;
  const go = (x: number) => {
    goToWeek(x, current);
    setOpen(false);
  };
  const shift = (d: number) => setView((v) => ({ ...v, year: v.year + Math.floor((v.month + d) / 12), month: (((v.month + d) % 12) + 12) % 12 }));
  const firstM = sprintMonth(earliest);
  const lastM = sprintMonth(latest);
  const ym = (y: number, m: number) => y * 12 + m;
  const monthOpen = (y: number, m: number) => ym(y, m) >= ym(firstM.year, firstM.month) && ym(y, m) <= ym(lastM.year, lastM.month);
  const perWeek = JSON.parse(counts) as Record<number, number>;
  const here = sprintMonth(n);
  const now = sprintMonth(current);

  return (
    <div className="week-nav" role="group" aria-label="Week">
      <button type="button" className="wk-step" aria-label="Previous week" title="Previous week (←)" disabled={n <= earliest} onClick={() => goToWeek(n - 1, current)}>
        <CaretLeft weight="bold" />
        <span className="hide-sm">Prev</span>
      </button>
      <button
        ref={trigger}
        type="button"
        className={cx("week-trigger", open && "open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Pick a week. Or use the ← → arrow keys."
        onClick={() => {
          setView(sprintMonth(n));
          setMonths(false);
          setOpen(!open);
        }}
      >
        <CalendarBlank weight="fill" />
        <b>{weekLabel(n)}</b>
        <span className="hide-sm">{sprintRangeLabel(n)}</span>
        <CaretDown weight="bold" className="chev" />
      </button>
      <button type="button" className="wk-step" aria-label="Next week" title="Next week (→)" disabled={n >= latest} onClick={() => goToWeek(n + 1, current)}>
        <span className="hide-sm">Next</span>
        <CaretRight weight="bold" />
      </button>
      {n !== current && (
        <button type="button" className="this-week" onClick={() => goToWeek(current, current)}>
          This week
        </button>
      )}

      {open && (
        <Popover anchor={trigger} onClose={() => setOpen(false)} label="Pick a week" className="c-weekpick">
          <div onKeyDown={(e) => e.key === "Escape" && (setOpen(false), trigger.current?.focus())}>
            <div className="c-dp-head">
              <button
                type="button"
                className="icon-btn"
                aria-label={months ? "Previous year" : "Previous month"}
                disabled={months ? view.year <= firstM.year : ym(view.year, view.month) <= ym(firstM.year, firstM.month)}
                onClick={() => (months ? setView((v) => ({ ...v, year: v.year - 1 })) : shift(-1))}
              >
                <CaretLeft />
              </button>
              <button type="button" className="month-title" aria-label={months ? "Show weeks" : "Show all months"} onClick={() => setMonths(!months)}>
                {months ? view.year : `${MONTH_NAMES[view.month]} ${view.year}`}
                <CaretDown className={cx("chev", months && "up")} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={months ? "Next year" : "Next month"}
                disabled={months ? view.year >= lastM.year : ym(view.year, view.month) >= ym(lastM.year, lastM.month)}
                onClick={() => (months ? setView((v) => ({ ...v, year: v.year + 1 })) : shift(1))}
              >
                <CaretRight />
              </button>
            </div>

            {months ? (
              <div className="month-grid">
                {MONTHS.map((label, m) => (
                  <button
                    key={label}
                    type="button"
                    disabled={!monthOpen(view.year, m)}
                    className={cx("month-cell", here.year === view.year && here.month === m && "selected", now.year === view.year && now.month === m && "today")}
                    onClick={() => {
                      setView({ ...view, month: m });
                      setMonths(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <ul className="c-dd-list week-list" role="listbox" aria-label={`Weeks in ${MONTH_NAMES[view.month]}`}>
                {sprintsInMonth(view.year, view.month).map((x) => {
                  const ok = inRange(x);
                  const cards = perWeek[x] ?? 0;
                  return (
                    <li key={x} role="option" aria-selected={x === n} aria-disabled={!ok}>
                      <button type="button" className={cx("c-dd-row week-row", x === n && "selected", x === current && "is-now")} disabled={!ok} onClick={() => go(x)}>
                        <span className="wk">
                          <b>Week {sprintMonth(x).week}</b>
                          <span className="meta">{sprintRangeLabel(x)}</span>
                        </span>
                        <span className="wk-end">
                          {x >= current - 1 && x <= latest ? (
                            <span className={cx("pill", x === current ? "pill-ok" : "pill-muted")}>{weekRelative(x, current)}</span>
                          ) : ok ? (
                            <span className="meta tab">{cards ? `${cards} card${cards === 1 ? "" : "s"}` : "No cards"}</span>
                          ) : (
                            <span className="meta">{x > latest ? "Not open yet" : "Before this board"}</span>
                          )}
                          <Check className="c-dd-check" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="c-weekpick-foot">
              <span className="meta">You can plan up to {WEEKS_AHEAD} weeks ahead.</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={n === current} onClick={() => go(current)}>
                This week
              </button>
            </div>
          </div>
        </Popover>
      )}
    </div>
  );
}
