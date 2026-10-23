"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowsOut, CalendarPlus, CaretLeft, CaretRight, ListChecks, Plus, X } from "@phosphor-icons/react";
import { addActionItem } from "@/lib/actions";
import { activePeople } from "@/lib/queries";
import { COL_META, COLS, type BoardCard, type Col } from "@/lib/board";
import { importantItems, projectTree } from "@/lib/queries";
import { sprintRangeLabel, weekLabel } from "@/lib/sprint";
import type { Project } from "@/lib/types";
import { setUI } from "@/lib/ui-store";
import { showToast } from "../Toaster";
import { RichText } from "../RichText";
import { Avatar, ColIcon, DueChip, firstName, Logo, pc, SizeDots } from "../ui";
import { MultiSelect } from "../fields";
import { ActionItems, AgendaItem, DateForm } from "./Side";
import { useBoard } from "./useBoard";

/** One column of a project slide: tasks as plain headings with a card count, and each person's line under them. */
function TaskColumn({ col, cards, tasks }: { col: Col; cards: BoardCard[]; tasks: Record<string, { title: string }> }) {
  const { db } = useBoard();
  const groups: { id: string; cards: BoardCard[] }[] = [];
  for (const c of [...cards].sort((a, b) => (tasks[a.u.task_id]?.title ?? "").localeCompare(tasks[b.u.task_id]?.title ?? ""))) {
    const g = groups.find((x) => x.id === c.u.task_id);
    if (g) g.cards.push(c);
    else groups.push({ id: c.u.task_id, cards: [c] });
  }
  return (
    <div className="pt-col">
      {groups.length === 0 && <p className="pt-empty">{COL_META[col].empty}</p>}
      {groups.map((g) => (
        <section className="pt-task" key={g.id}>
          <h3>{tasks[g.id]?.title}</h3>
          <ul>
            {g.cards.map(({ u }) => {
              const help = u.help_from_person_id ? db.people[u.help_from_person_id]?.name : u.help_from_text;
              return (
                <li key={u.id}>
                  <Avatar person={db.people[u.person_id]} size={30} />
                  <div className="pt-line">
                    <b>{firstName(db.people[u.person_id]?.name)}</b>
                    {u.text && (
                      <span className="pt-text">
                        <RichText text={u.text} />
                      </span>
                    )}
                    <span className="pt-meta">
                      {u.size && <SizeDots size={u.size} />}
                      <DueChip due={u.due_date} done={col === "done"} />
                      {col === "blocked" && <span className="pill pill-danger">Needs {help || "a hand"}</span>}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

type Slide = { k: "dates" | "blockers"; t: string } | { k: "project"; t: string; p: Project & { children: Project[] } };

/** Full-screen slides for the Tuesday check-in. Updates live as people edit. */
export function Present() {
  const { db, me, n, cards } = useBoard();
  const projects = projectTree(db, { includeArchived: true }).filter((p) =>
    cards.some((c) => (c.u.project_id === p.id || p.children.some((ch) => ch.id === c.u.project_id))),
  );
  const slides: Slide[] = [
    { k: "dates", t: "Important dates/info" },
    ...projects.map((p) => ({ k: "project" as const, t: p.name, p })),
    { k: "blockers", t: "Blockers" },
  ];
  const [i, setI] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addingDate, setAddingDate] = useState(false);
  const [text, setText] = useState("");
  const [owners, setOwners] = useState<string[]>(me ? [me] : []);
  // Esc closes an open pop-up first; only with none open does it leave Present.
  const popup = useRef(false);
  useEffect(() => {
    popup.current = adding || addingDate;
  }, [adding, addingDate]);
  const idx = Math.min(i, slides.length - 1);
  const s = slides[idx];

  const go = (d: number) => {
    setI((x) => Math.max(0, Math.min(slides.length - 1, x + d)));
  };

  // Keys should drive the slides, not whatever field had focus on the board.
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = e.target instanceof Element && !!e.target.closest("input, textarea, select");
      if (e.key === "Escape") {
        if (popup.current) {
          e.preventDefault();
          setAdding(false);
          setAddingDate(false);
        } else if (!inField) setUI({ present: false });
        return;
      }
      if (inField) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        setI((x) => Math.min(slides.length - 1, x + 1));
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        setI((x) => Math.max(0, x - 1));
      } else if (e.key.toLowerCase() === "a" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAddingDate(false);
        setAdding(true);
      } else if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAdding(false);
        setAddingDate(true);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [slides.length]);

  const blocked = cards.filter((c) => c.col === "blocked" && !c.u.resolved);

  return (
    <div className="present" role="dialog" aria-modal="true" aria-label="Present mode">
      <div className="present-top">
        {weekLabel(n)} · {sprintRangeLabel(n)}{" "}
        <span className="tab">
          {idx + 1} / {slides.length}
        </span>
        <span style={{ marginLeft: "auto" }} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => (setAdding(false), setAddingDate(true))}>
          <CalendarPlus /> Important dates <kbd>D</kbd>
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => (setAddingDate(false), setAdding(true))}>
          <Plus /> Action item <kbd>A</kbd>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Full screen"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen?.().catch(() => {});
          }}
        >
          <ArrowsOut />
        </button>
        <button type="button" className="icon-btn" aria-label="Close Present mode" onClick={() => setUI({ present: false })}>
          <X />
        </button>
      </div>

      <div className="present-stage" key={idx}>
        {s.k === "dates" && (
          <>
            <p className="label">First up</p>
            <div className="first-grid">
              <section>
                <h1>
                  <Logo size={52} /> Important dates/info
                </h1>
                <div className="panel" style={{ padding: 8 }}>
              {importantItems(db, n).map((d) => (
                    <AgendaItem key={d.id} d={d} big />
                  ))}
                  {importantItems(db, n).length === 0 && <p className="panel-empty">Nothing coming up.</p>}
                </div>
              </section>
              <section>
                <h1>
                  <Logo icon={ListChecks} size={52} /> Action items
                </h1>
                <ActionItems big />
              </section>
            </div>
          </>
        )}
        {s.k === "project" && (
          <>
            <p className="label">Project</p>
            <h1>
              <Logo project={s.p} size={60} />
              {s.p.name}
            </h1>
            <p className="pt-summary">
              {(() => {
                const mine = cards.filter((c) => [s.p, ...s.p.children].some((p) => p.id === c.u.project_id));
                const tasks = new Set(mine.map((c) => c.u.task_id)).size;
                return `${tasks} ${tasks === 1 ? "task" : "tasks"} · ${mine.length} ${mine.length === 1 ? "card" : "cards"}`;
              })()}
            </p>
            <div className="pt" style={pc(s.p.color)}>
              <div className="pt-heads">
                {COLS.map((col) => (
                  <div className="pt-head" key={col}>
                    <ColIcon col={col} size={26} />
                    <b>{COL_META[col].label}</b>
                    <span className="meta">{COL_META[col].sub}</span>
                  </div>
                ))}
              </div>
              {[s.p, ...s.p.children].map((p) => {
                const list = cards.filter((c) => c.u.project_id === p.id);
                if (!list.length) return null;
                return (
                  <div key={p.id} className="pt-block">
                    {p.id !== s.p.id && (
                      <h2 className="pt-sub" style={pc(p.color ?? s.p.color)}>
                        <Logo project={p} size={30} />
                        {p.name}
                      </h2>
                    )}
                    <div className="pt-grid">
                      {COLS.map((col) => (
                        <TaskColumn key={col} col={col} cards={list.filter((c) => c.col === col)} tasks={db.tasks} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {s.k === "blockers" && (
          <>
            <p className="label">Wrap-up</p>
            <h1>
              <ColIcon col="blocked" size={48} /> Blockers
            </h1>
            {blocked.length ? (
              <div className="big-list">
                {blocked.map(({ u }) => {
                  const help = u.help_from_person_id ? db.people[u.help_from_person_id]?.name : u.help_from_text;
                  return (
                    <div className="big-item" key={u.id}>
                      <Avatar person={db.people[u.person_id]} size={44} />
                      <div style={{ flex: 1 }}>
                        <p className="meta">
                          {db.projects[u.project_id]?.short_name || db.projects[u.project_id]?.name} · {db.tasks[u.task_id]?.title}
                        </p>
                        {u.text || db.tasks[u.task_id]?.title}
                        <div className="help">{help ? `Needs ${help}` : "Needs a hand"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 28, fontWeight: 900 }}>No blockers this week</p>
            )}
          </>
        )}
      </div>

      {addingDate && (
        <div className="present-add present-date" onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setAddingDate(false))}>
          <DateForm onDone={() => setAddingDate(false)} />
        </div>
      )}

      {adding && (
        <form
          className="present-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            addActionItem(text, owners, null, n);
            setText("");
            showToast("Action item added");
          }}
          onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setAdding(false))}
        >
          <input
            className="field"
            style={{ height: 44, fontSize: 16, fontWeight: 700, flex: "1 1 260px", width: "auto" }}
            autoFocus
            placeholder="New action item, then Enter"
            aria-label="New action item"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <MultiSelect
            label="Who is it for?"
            placeholder="Add people"
            value={owners}
            onChange={setOwners}
            style={{ flex: "0 1 200px", width: "auto" }}
            options={activePeople(db).map((p) => ({ value: p.id, label: p.id === me ? `${firstName(p.name)} (you)` : firstName(p.name), lead: <Avatar person={p} size={20} /> }))}
          />
          <button className="btn btn-primary" style={{ height: 44 }}>
            Add
          </button>
          <button type="button" className="icon-btn" style={{ height: 44, width: 44 }} aria-label="Close" onClick={() => setAdding(false)}>
            <X />
          </button>
        </form>
      )}

      <div className="present-nav">
        <button type="button" className="icon-btn" aria-label="Previous slide" disabled={idx === 0} onClick={() => go(-1)}>
          <CaretLeft />
        </button>
        <div className="dots">
          {slides.map((x, j) => (
            <button
              key={j}
              type="button"
              aria-label={x.t}
              title={x.t}
              aria-current={j === idx}
              onClick={() => {
                setI(j);
              }}
            />
          ))}
        </div>
        <button type="button" className="icon-btn" aria-label="Next slide" disabled={idx === slides.length - 1} onClick={() => go(1)}>
          <CaretRight />
        </button>
      </div>
      <div className="keys">← → move · A add action item · D important dates · Esc close</div>
    </div>
  );
}
