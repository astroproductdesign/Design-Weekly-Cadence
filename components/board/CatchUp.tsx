"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowBendDownRight, ArrowCounterClockwise, Check, CheckCircle, X } from "@phosphor-icons/react";
import { dropCard, moveCard, type BoardCard } from "@/lib/board";
import { confetti } from "@/lib/confetti";
import { weekLabel } from "@/lib/sprint";
import { useStore } from "@/lib/store";
import { setUI } from "@/lib/ui-store";
import { RichText } from "../RichText";
import { cx, Logo, pc } from "../ui";
import { useBoard } from "./useBoard";

const seenKey = (me: string, week: number) => `cadence-catchup-${me}-${week}`;

/** Remember that this person has been asked about this week, so it only pops up once. */
export function markCatchUpSeen(me: string, week: number) {
  try {
    localStorage.setItem(seenKey(me, week), "1");
  } catch {}
}
export function catchUpSeen(me: string, week: number) {
  try {
    return localStorage.getItem(seenKey(me, week)) === "1";
  } catch {
    return true;
  }
}

/**
 * The start-of-week question: "last week you planned these, how did they go?"
 * One row per unfinished card. Done / Keep / Drop. Nothing is lost by closing:
 * the same buttons stay on the cards in Doing.
 */
export function CatchUp() {
  const { db, me, current, cards } = useBoard();
  const mine = cards.filter((c) => c.toSort && c.u.person_id === me);
  const [total] = useState(mine.length);
  const [undo, setUndo] = useState<{ label: string; run: () => void } | null>(null);
  const celebrated = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => setUI({ catchUp: false });
  const week = mine[0] ? weekLabel(mine[0].u.sprint_number) : "last week";

  useEffect(() => {
    panel.current?.focus();
  }, []);
  useEffect(() => {
    if (!mine.length && total && !celebrated.current) {
      celebrated.current = true;
      confetti(innerWidth / 2, innerHeight / 3);
    }
  }, [mine.length, total]);

  const act = (card: BoardCard, kind: "done" | "keep" | "drop", point?: { x: number; y: number }) => {
    const state = useStore.getState().db;
    const label = card.u.text.split("\n")[0] || state.tasks[card.u.task_id]?.title || "card";
    let run: () => void;
    if (kind === "drop") run = dropCard(card.u);
    else run = moveCard(state, card, kind === "done" ? "done" : "doing", null, current);
    if (kind === "done" && point) confetti(point.x, point.y);
    setUndo({ label: `${kind === "done" ? "Marked done" : kind === "keep" ? "Kept for this week" : "Dropped"}: ${label.slice(0, 40)}`, run });
  };
  const all = (kind: "done" | "keep") => {
    const state = useStore.getState().db;
    for (const c of mine) moveCard(state, c, kind === "done" ? "done" : "doing", null, current);
    setUndo(null);
  };

  const byProject = new Map<string, BoardCard[]>();
  for (const c of mine) byProject.set(c.u.project_id, [...(byProject.get(c.u.project_id) ?? []), c]);

  return (
    <>
      <div className="scrim" onClick={close} />
      <div
        ref={panel}
        tabIndex={-1}
        className="catchup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catchup-h"
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        <div className="catchup-head">
          <div>
            <p className="label">Last week check-in</p>
            <h2 id="catchup-h">{mine.length ? "How did last week go?" : "All sorted. Nice work!"}</h2>
            <p className="meta">
              {mine.length
                ? `You planned ${total === 1 ? "this" : `these ${total}`} in ${week} and ${mine.length === 1 ? "it isn't" : "they aren't"} marked done yet.`
                : "Anything you kept is in Doing for this week."}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={close}>
            <X />
          </button>
        </div>

        {mine.length > 0 && (
          <div className="catchup-body">
            {[...byProject.entries()].map(([pid, list]) => {
              const p = db.projects[pid];
              const parent = p?.parent_id ? db.projects[p.parent_id] : null;
              return (
                <section key={pid} style={pc(p?.color ?? parent?.color)}>
                  <p className="catchup-proj">
                    <Logo project={p} size={22} />
                    {parent ? `${parent.short_name || parent.name} › ` : ""}
                    {p?.name}
                  </p>
                  {list.map((c) => (
                    <div className="catchup-row" key={c.u.id}>
                      <div className="catchup-text">
                        <b>{db.tasks[c.u.task_id]?.title}</b>
                        {c.u.text && <RichText text={c.u.text} />}
                        {c.u.carry_count >= 1 && <span className="meta">Already carried over {c.u.carry_count}×</span>}
                      </div>
                      <div className="catchup-actions">
                        <button type="button" className="mini go" onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          act(c, "done", { x: r.left + r.width / 2, y: r.top });
                        }}>
                          <Check weight="bold" /> Done
                        </button>
                        <button type="button" className="mini" onClick={() => act(c, "keep")}>
                          <ArrowBendDownRight /> Keep
                        </button>
                        <button type="button" className="mini" aria-label="Drop this card" title="Not happening anymore" onClick={() => act(c, "drop")}>
                          <X /> Drop
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        )}

        {!mine.length && (
          <div className="catchup-done">
            <CheckCircle weight="fill" />
          </div>
        )}

        <div className="catchup-foot">
          {undo ? (
            <button type="button" className="btn btn-link" onClick={() => (undo.run(), setUndo(null))} title={undo.label}>
              <ArrowCounterClockwise /> Undo: {undo.label}
            </button>
          ) : mine.length > 1 ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => all("keep")}>
                Keep all
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => all("done")}>
                All done
              </button>
            </>
          ) : (
            <span />
          )}
          <button type="button" className={cx("btn btn-sm", mine.length ? "btn-secondary" : "btn-primary")} onClick={close}>
            {mine.length ? "Later" : "Back to the board"}
          </button>
        </div>
      </div>
    </>
  );
}
