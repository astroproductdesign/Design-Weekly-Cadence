"use client";

import { ArrowsClockwise, PresentationChart } from "@phosphor-icons/react";
import { usualProjectIds } from "@/lib/queries";
import { sprintRangeLabel, weekLabel } from "@/lib/sprint";
import { setUI } from "@/lib/ui-store";
import { Blob } from "../Blob";
import { firstName } from "../ui";
import { useBoard } from "./useBoard";

export function PageHead() {
  const { db, me, n, current, history, future, cards } = useBoard();
  const person = db.people[me];
  if (!person) return null;

  const mine = cards.filter((c) => c.u.person_id === me && !c.toSort);
  const usual = usualProjectIds(db, me, current);
  const touched = new Set(mine.filter((c) => c.u.sprint_number === current).map((c) => c.u.project_id));
  const updated = usual.filter((id) => touched.has(id)).length;
  const toSort = cards.filter((c) => c.toSort && c.u.person_id === me).length;
  const caughtUp = usual.length ? updated >= usual.length && !toSort : mine.length > 0;
  const pct = usual.length ? Math.round((updated / usual.length) * 100) : mine.length ? 100 : 0;
  const total = cards.filter((c) => !c.toSort).length;
  const folks = new Set(cards.map((c) => c.u.person_id)).size;

  return (
    <header className="page-head reveal" style={{ ["--i" as string]: 0 }}>
      <div className="hello">
        <Blob id={person.id} pose={caughtUp ? "cheer" : "wave"} size={52} className="idle" />
        <div style={{ minWidth: 0 }}>
          <p className="label">
            {weekLabel(n)} · {sprintRangeLabel(n)} · {total} cards from {folks} {folks === 1 ? "person" : "people"}
          </p>
          <h1>
            {history
              ? `Looking back at ${weekLabel(n)}`
              : future
                ? `Planning ahead for ${weekLabel(n)}`
                : caughtUp
                ? `You're all caught up, ${firstName(person.name)}`
                : `Hi ${firstName(person.name)}, what's new this week?`}
          </h1>
          {!history && !future && (
            <div className="progress">
              <div className="meter" role="img" aria-label={`${pct}% of your usual projects updated`}>
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="meta">{usual.length ? `${updated} of ${usual.length} usual projects updated` : `${mine.length} cards so far`}</span>
              {toSort > 0 && (
                <button type="button" className="pill pill-warn" onClick={() => setUI({ catchUp: true, open: null, composer: null })}>
                  <ArrowsClockwise /> {toSort} from last week to sort
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="page-actions">
        <button type="button" className="btn btn-primary hide-sm" title="Present (⌘P)" onClick={() => setUI({ present: true, open: null, composer: null })}>
          <PresentationChart /> Present <kbd>⌘P</kbd>
        </button>
      </div>
    </header>
  );
}
