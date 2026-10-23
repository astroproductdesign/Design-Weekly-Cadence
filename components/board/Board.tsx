"use client";

import { Plus } from "@phosphor-icons/react";
import { COL_META, COLS, type BoardCard } from "@/lib/board";
import { activePeople, projectTree } from "@/lib/queries";
import type { DB } from "@/lib/types";
import { isFiltering, setUI, useUI } from "@/lib/ui-store";
import { Avatar, ColIcon, firstName, Logo } from "../ui";
import { PersonLane, ProjectLane, type Section } from "./Lanes";
import { useBoard, useVisibleCards } from "./useBoard";

/** Ids of the lanes on screen for the current grouping (for collapse / expand all). */
export function laneKeys(db: DB, group: "project" | "person"): string[] {
  return group === "person" ? activePeople(db).map((p) => p.id) : projectTree(db, { includeArchived: true }).map((p) => p.id);
}

const FIRST_LANE = 3; // reveal order: header, board surface, column titles, then lanes

export function Board() {
  const { db, me, history, cards } = useBoard();
  const visible = useVisibleCards(cards);
  const group = useUI((s) => s.group);
  const persons = useUI((s) => s.persons);
  const filtering = useUI(isFiltering);
  const composerLane = useUI((s) => s.composer?.lane);

  const lanes: React.ReactNode[] = [];
  const quiet: { id: string; label: string; lead: React.ReactNode; canAdd: boolean }[] = [];

  if (group === "person") {
    activePeople(db)
      .filter((p) => !persons.length || persons.includes(p.id))
      .forEach((p) => {
        const mine = visible.filter((c) => c.u.person_id === p.id);
        if (mine.length || composerLane === p.id) {
          lanes.push(<PersonLane key={p.id} person={p} cards={mine} index={FIRST_LANE + lanes.length} />);
        } else if (!filtering) {
          quiet.push({ id: p.id, label: firstName(p.name), lead: <Avatar person={p} size={22} />, canAdd: p.id === me });
        }
      });
  } else {
    const byProject = (id: string) => visible.filter((c) => c.u.project_id === id);
    for (const top of projectTree(db, { includeArchived: true })) {
      const all = [top, ...top.children];
      const sections: Section[] = all
        .map((p) => ({ project: p, cards: byProject(p.id) }))
        .filter((s) => s.cards.length || composerLane === s.project.id || (s.project.id === top.id && top.pinned && !top.archived && !filtering));
      // Archived projects only appear where they still have cards (history).
      if (!sections.length) {
        if (!filtering && !top.archived) quiet.push({ id: top.id, label: top.short_name || top.name, lead: <Logo project={top} size={22} />, canAdd: true });
        continue;
      }
      const quietChildren = filtering ? [] : top.children.filter((c) => !c.archived && !sections.some((s) => s.project.id === c.id));
      lanes.push(<ProjectLane key={top.id} top={top} sections={sections} quiet={quietChildren} index={FIRST_LANE + lanes.length} />);
    }
  }

  return (
    <div className="board">
      <ColumnHeads cards={visible} />
      {lanes}
      {!lanes.length && (
        <div className="panel reveal" style={{ textAlign: "center", padding: 40, ["--i" as string]: FIRST_LANE }}>
          <h2 style={{ fontSize: 16, lineHeight: "22px", fontWeight: 800 }}>{filtering ? "No cards match these filters" : "No cards yet"}</h2>
          <p className="meta" style={{ marginTop: 4 }}>
            {filtering ? "Try removing a filter or clearing the search." : "Add the first card on any project below."}
          </p>
          {filtering && (
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => setUI({ persons: [], projects: [], flags: [], q: "" })}>
              Clear all
            </button>
          )}
        </div>
      )}
      {quiet.length > 0 && !history && (
        <div className="quiet reveal" style={{ ["--i" as string]: FIRST_LANE + lanes.length }}>
          <span className="label">No cards yet</span>
          {quiet.map((q) =>
            q.canAdd ? (
              <button
                key={q.id}
                type="button"
                className="quiet-chip"
                title="Add a card"
                onClick={() => setUI({ composer: { lane: q.id, col: "doing" }, collapsed: { ...useUI.getState().collapsed, [q.id]: false } })}
              >
                {q.lead}
                {q.label}
                <span className="plus">
                  <Plus />
                </span>
              </button>
            ) : (
              <span key={q.id} className="quiet-chip" style={{ cursor: "default" }}>
                {q.lead}
                {q.label}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ColumnHeads({ cards }: { cards: BoardCard[] }) {
  return (
    <div className="colheads reveal" style={{ ["--i" as string]: 2 }} aria-hidden>
      {COLS.map((col) => (
        <div className="colhead" key={col}>
          <ColIcon col={col} />
          <b>{COL_META[col].label}</b>
          <span className="meta">{COL_META[col].sub}</span>
          <span className="n tab">{cards.filter((c) => c.col === col).length}</span>
        </div>
      ))}
    </div>
  );
}
