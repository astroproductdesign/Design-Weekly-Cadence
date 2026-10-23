"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowsInLineVertical, ArrowsOutLineVertical, CaretDown, Check, Kanban, MagnifyingGlass, Users, X } from "@phosphor-icons/react";
import { FLAGS } from "@/lib/board";
import { activePeople, projectTree } from "@/lib/queries";
import { setUI, useUI } from "@/lib/ui-store";
import { Avatar, cx, Logo } from "../ui";
import { laneKeys } from "./Board";
import { useBoard } from "./useBoard";

type Dim = "persons" | "projects" | "flags";
type Option = { id: string; label: string; lead?: ReactNode; n?: number };

/** DLS Filter trigger: checkbox list; nothing applies until Done, clicking away cancels. */
function FilterTrigger({ dim, label, options }: { dim: Dim; label: string; options: Option[] }) {
  const applied = useUI((s) => s[dim]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string[]>(applied);
  const [right, setRight] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  // Flip to right-aligned if the panel would run off the screen.
  useLayoutEffect(() => {
    if (!open || !panel.current || !wrap.current) return;
    const w = panel.current.getBoundingClientRect().width;
    setRight(wrap.current.getBoundingClientRect().left + w > innerWidth - 12);
  }, [open]);

  const flip = (id: string) => setPending((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div className="c-filter-wrap" ref={wrap}>
      <button
        type="button"
        className={cx("c-filter-trigger", applied.length > 0 && "active", open && "is-open")}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          setPending(applied);
          setOpen(!open);
        }}
      >
        {label}
        {applied.length > 0 && <span className="count tab">{applied.length}</span>}
        <span className="chev">
          <CaretDown />
        </span>
      </button>
      {open && (
        <div className={cx("c-filter-panel", right && "is-right")} ref={panel} role="dialog" aria-label={`${label} filter`}>
          <p className="c-filter-panel-title">{label}</p>
          <div className="c-filter-options">
            {options.map((o) => {
              const on = pending.includes(o.id);
              return (
                <button key={o.id} type="button" className="c-filter-option" role="checkbox" aria-checked={on} onClick={() => flip(o.id)}>
                  <span className={cx("c-checkbox-box", on && "on")}>{on && <Check weight="bold" />}</span>
                  {o.lead}
                  <span className="lbl">{o.label}</span>
                  {o.n != null && <span className="n tab">{o.n}</span>}
                </button>
              );
            })}
          </div>
          <div className="c-filter-footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPending([])}>
              Clear
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setUI({ [dim]: pending });
                setOpen(false);
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Filters() {
  const { db, me, cards } = useBoard();
  const { persons, projects, flags, q, group, collapsed } = useUI();
  const onlyMe = persons.length === 1 && persons[0] === me;
  const keys = laneKeys(db, group);
  const allCollapsed = keys.length > 0 && keys.every((k) => collapsed[k]);

  const personOpts: Option[] = activePeople(db).map((p) => ({
    id: p.id,
    label: p.id === me ? `${p.name} (you)` : p.name,
    lead: <Avatar person={p} size={22} />,
    n: cards.filter((c) => c.u.person_id === p.id).length,
  }));
  const projectOpts: Option[] = projectTree(db).map((p) => ({
    id: p.id,
    label: p.name,
    lead: <Logo project={p} size={22} />,
    n: cards.filter((c) => c.u.project_id === p.id || db.projects[c.u.project_id]?.parent_id === p.id).length,
  }));
  const flagOpts: Option[] = FLAGS.map((f) => ({ id: f.id, label: f.label, n: cards.filter(f.test).length }));

  const chips = [
    ...persons.map((id) => ({ dim: "persons" as Dim, id, label: db.people[id]?.name ?? "Someone" })),
    ...projects.map((id) => ({ dim: "projects" as Dim, id, label: db.projects[id]?.name ?? "Project" })),
    ...flags.map((id) => ({ dim: "flags" as Dim, id, label: FLAGS.find((f) => f.id === id)?.label ?? id })),
  ];

  return (
    <div className="board-toolbar">
      <div className="c-filterbar" role="toolbar" aria-label="Filters">
        <div className="c-filter-search">
          <span className="lead">
            <MagnifyingGlass />
          </span>
          <input type="search" aria-label="Search cards" placeholder="Search cards" value={q} onChange={(e) => setUI({ q: e.target.value })} />
          {q && (
            <button type="button" className="clear" aria-label="Clear search" onClick={() => setUI({ q: "" })}>
              <X />
            </button>
          )}
        </div>
        <span className="c-filter-divider" />
        <FilterTrigger dim="persons" label="Person" options={personOpts} />
        <FilterTrigger dim="projects" label="Project" options={projectOpts} />
        <FilterTrigger dim="flags" label="Status" options={flagOpts} />
        <button type="button" className="c-chip-filter" aria-pressed={onlyMe} onClick={() => setUI({ persons: onlyMe ? [] : [me] })}>
          Only me
        </button>
        <div className="bar-end">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setUI({ collapsed: allCollapsed ? {} : Object.fromEntries(keys.map((k) => [k, true])) })}
          >
            {allCollapsed ? <ArrowsOutLineVertical /> : <ArrowsInLineVertical />}
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
          <div className="seg" role="group" aria-label="Show lanes by">
            <button type="button" aria-pressed={group === "project"} onClick={() => setUI({ group: "project", composer: null })}>
              <Kanban /> Projects
            </button>
            <button type="button" aria-pressed={group === "person"} onClick={() => setUI({ group: "person", composer: null })}>
              <Users /> People
            </button>
          </div>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="c-filter-tray" aria-label="Applied filters">
          {chips.map((ch) => (
            <span className="c-chip-input" key={ch.dim + ch.id}>
              {ch.label}
              <button
                type="button"
                className="c-chip-remove"
                aria-label={`Remove ${ch.label}`}
                onClick={() => setUI({ [ch.dim]: useUI.getState()[ch.dim].filter((x) => x !== ch.id) })}
              >
                <X />
              </button>
            </span>
          ))}
          <button type="button" className="btn btn-link" style={{ marginLeft: 16 }} onClick={() => setUI({ persons: [], projects: [], flags: [] })}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
