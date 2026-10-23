"use client";

import { CaretDown, Plus } from "@phosphor-icons/react";
import { COL_META, COLS, type BoardCard, type Col } from "@/lib/board";
import type { Person, Project } from "@/lib/types";
import { setUI, useUI } from "@/lib/ui-store";
import { Avatar, ColIcon, cx, Logo, pc } from "../ui";
import { Card } from "./Card";
import { Composer } from "./Composer";
import { useBoard } from "./useBoard";

/** One column of a lane: cards grouped by task, then "Add a card". */
export function Cell({ lane, col, cards, big, canAdd }: { lane: string; col: Col; cards: BoardCard[]; big?: boolean; canAdd: boolean }) {
  const { db, history } = useBoard();
  const group = useUI((s) => s.group);
  const composing = useUI((s) => s.composer?.lane === lane && s.composer.col === col);
  const composerTask = useUI((s) => (s.composer?.lane === lane && s.composer.col === col ? s.composer.task : undefined));
  const title = (c: BoardCard) => db.tasks[c.u.task_id]?.title ?? "";
  const sorted = [...cards].sort((a, b) => title(a).localeCompare(title(b)) || a.u.person_id.localeCompare(b.u.person_id));
  const groups: { taskId: string; cards: BoardCard[] }[] = [];
  for (const c of sorted) {
    const g = groups.find((x) => x.taskId === c.u.task_id);
    if (g) g.cards.push(c);
    else groups.push({ taskId: c.u.task_id, cards: [c] });
  }
  const showTask = group === "project" || big;
  // "Add a card" from a task's own title puts the form right under that task.
  const forGroup = composerTask ? groups.find((g) => (db.tasks[g.taskId]?.title ?? "").toLowerCase() === composerTask.toLowerCase()) : undefined;

  return (
    <div className="cell" data-cell data-col={col} data-lane={lane}>
      <div className="cell-mhead">
        <ColIcon col={col} size={18} />
        {COL_META[col].label} <span className="meta">· {cards.length}</span>
      </div>
      {groups.map((g) => (
        <div className="task-group" key={g.taskId} data-task={group === "project" ? g.taskId : undefined}>
          {showTask && (g.cards.length > 1 || g.cards.some((c) => c.u.text)) && (
            <div className="task-label">
              <span className="task-name">{db.tasks[g.taskId]?.title}</span>
              {new Set(g.cards.map((c) => c.u.person_id)).size > 1 && <span className="shared">shared</span>}
              {canAdd && !big && !history && (
                <button
                  type="button"
                  className="task-add"
                  aria-label={`Add a card to ${db.tasks[g.taskId]?.title}`}
                  onClick={() => setUI({ composer: { lane, col, task: db.tasks[g.taskId]?.title }, open: null })}
                >
                  <Plus weight="bold" /> Add card
                </button>
              )}
            </div>
          )}
          {g.cards.map((c) => (
            <Card key={c.u.id} card={c} big={big} />
          ))}
          {forGroup === g && <Composer key={`${lane}-${col}-${composerTask}`} lane={lane} col={col} task={composerTask} />}
        </div>
      ))}
      {!cards.length && !composing && <div className="cell-empty">{COL_META[col].empty}</div>}
      {canAdd &&
        (composing ? (
          forGroup ? null : <Composer key={`${lane}-${col}`} lane={lane} col={col} task={composerTask} />
        ) : (
          <button type="button" className="add-card" onClick={() => setUI({ composer: { lane, col }, open: null })}>
            <Plus /> Add a card
          </button>
        ))}
    </div>
  );
}

export function Cells({ lane, cards, big, canAdd }: { lane: string; cards: BoardCard[]; big?: boolean; canAdd: boolean }) {
  return (
    <div className="lane-body">
      {COLS.map((col) => (
        <Cell key={col} lane={lane} col={col} cards={cards.filter((c) => c.col === col)} big={big} canAdd={canAdd} />
      ))}
    </div>
  );
}

export function Counts({ cards }: { cards: BoardCard[] }) {
  const n = COLS.map((col) => cards.filter((c) => c.col === col).length);
  return (
    <span className="lane-count tab" aria-label={COLS.map((col, i) => `${n[i]} ${COL_META[col].label}`).join(", ")}>
      {COLS.map((col, i) => (
        <span key={col}>
          <ColIcon col={col} size={13} />
          {n[i]}
        </span>
      ))}
    </span>
  );
}

const openComposer = (lane: string, laneKey: string) => {
  const s = useUI.getState();
  setUI({ composer: { lane, col: "doing" }, collapsed: { ...s.collapsed, [laneKey]: false }, open: null });
};

/** Lane header: click anywhere on it to expand or collapse. */
function LaneHead({
  laneKey,
  collapsed,
  lead,
  title,
  kicker,
  people,
  cards,
  onAdd,
}: {
  laneKey: string;
  collapsed: boolean;
  lead: React.ReactNode;
  title: string;
  kicker?: string;
  people: Person[];
  cards: BoardCard[];
  onAdd?: () => void;
}) {
  const toggle = () => setUI({ collapsed: { ...useUI.getState().collapsed, [laneKey]: !collapsed } });
  return (
    <div
      className="lane-head"
      role="button"
      tabIndex={0}
      aria-expanded={!collapsed}
      aria-label={`${title}: ${collapsed ? "expand" : "collapse"}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        toggle();
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          toggle();
        }
      }}
    >
      {lead}
      <span className="lane-title">
        {kicker && <span className="label">{kicker}</span>}
        <b>
          {title}
        </b>
      </span>
      {!collapsed && people.length > 0 && (
        <span className="stack">
          {people.map((p) => (
            <Avatar key={p.id} person={p} size={24} />
          ))}
        </span>
      )}
      <div className="lane-meta">
        <Counts cards={cards} />
        {onAdd && (
          <button type="button" className="icon-btn" aria-label={`Add a card to ${title}`} title="Add a card" onClick={onAdd}>
            <Plus />
          </button>
        )}
        <button type="button" className="icon-btn" aria-label={collapsed ? "Expand" : "Collapse"} onClick={toggle}>
          <span className="caret">
            <CaretDown />
          </span>
        </button>
      </div>
    </div>
  );
}

const peopleOf = (cards: BoardCard[], people: Record<string, Person>) =>
  [...new Set(cards.map((c) => c.u.person_id))].map((id) => people[id]).filter(Boolean);

export type Section = { project: Project; cards: BoardCard[] };

/** A top-level project. Sub-projects are sections inside it with their own title row. */
export function ProjectLane({ top, sections, quiet, index }: { top: Project; sections: Section[]; quiet: Project[]; index: number }) {
  const { db, history } = useBoard();
  const collapsed = useUI((s) => !!s.collapsed[top.id]);
  const composerLane = useUI((s) => s.composer?.lane);
  const all = sections.flatMap((s) => s.cards);
  const own = sections.find((s) => s.project.id === top.id);
  const children = sections.filter((s) => s.project.id !== top.id);
  const showOwn = (own && own.cards.length > 0) || composerLane === top.id || (!!own && top.pinned && children.length === 0);

  return (
    <section className={cx("lane reveal", collapsed && "collapsed")} style={{ "--i": index, ...pc(top.color) } as React.CSSProperties} aria-label={top.name}>
      <LaneHead
        laneKey={top.id}
        collapsed={collapsed}
        lead={<Logo project={top} size={32} />}
        title={top.name}
        people={peopleOf(all, db.people)}
        cards={all}
        onAdd={history ? undefined : () => openComposer(top.id, top.id)}
      />
      {!collapsed && (
        <>
          {showOwn && <Cells lane={top.id} cards={own?.cards ?? []} canAdd={!history} />}
          {children.map((s) => (
            <div key={s.project.id}>
              <div className="sub-head">
                <b>{s.project.name}</b>
                {!history && (
                  <button type="button" className="sub-add" onClick={() => openComposer(s.project.id, top.id)}>
                    <Plus weight="bold" /> Add a card
                  </button>
                )}
                <Counts cards={s.cards} />
              </div>
              <Cells lane={s.project.id} cards={s.cards} canAdd={!history} />
            </div>
          ))}
          {quiet.length > 0 && !history && (
            <div className="sub-quiet">
              <span className="label">No cards yet</span>
              {quiet.map((p) => (
                <button key={p.id} type="button" className="quiet-chip" onClick={() => openComposer(p.id, top.id)} title={`Add a card to ${p.name}`}>
                  <span style={{ marginLeft: 4, display: "inline-flex" }}>
                    <Logo project={p} size={22} />
                  </span>
                  {p.name}
                  <span className="plus">
                    <Plus />
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** "People" view: one lane per person. */
export function PersonLane({ person, cards, index }: { person: Person; cards: BoardCard[]; index: number }) {
  const { me, history } = useBoard();
  const collapsed = useUI((s) => !!s.collapsed[person.id]);
  const mine = person.id === me;
  return (
    <section className={cx("lane reveal", collapsed && "collapsed")} style={{ "--i": index } as React.CSSProperties} aria-label={person.name}>
      <LaneHead
        laneKey={person.id}
        collapsed={collapsed}
        lead={<Avatar person={person} size={32} />}
        title={person.name}
        kicker={person.role === "lead" ? "Design lead" : person.role === "admin" ? "Admin" : undefined}
        people={[]}
        cards={cards}
        onAdd={mine && !history ? () => openComposer(person.id, person.id) : undefined}
      />
      {!collapsed && <Cells lane={person.id} cards={cards} canAdd={mine && !history} />}
    </section>
  );
}
