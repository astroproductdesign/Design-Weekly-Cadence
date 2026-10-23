"use client";

import { useState } from "react";
import { CalendarBlank, CheckCircle, Megaphone, Circle, ListChecks, PencilSimple, Plus, SidebarSimple, Trash, WarningOctagon } from "@phosphor-icons/react";
import { addActionItem, setActionDone } from "@/lib/actions";
import { confetti } from "@/lib/confetti";
import { actionItemsForSprint, activePeople, ageInDays, importantItems, projectsInOrder } from "@/lib/queries";
import { dayMs, daysBetween, relativeDay, todayKL, weekLabel } from "@/lib/sprint";
import { deleteRow, insertRow, newId, patchRow, restoreRow } from "@/lib/store";
import type { ActionItem, ImportantDate } from "@/lib/types";
import { setSideCollapsed, setUI, useUI } from "@/lib/ui-store";
import { DatePicker, MultiSelect, Select } from "../fields";
import { RichText } from "../RichText";
import { showToast } from "../Toaster";
import { Avatar, ColIcon, cx, DueChip, firstName, Logo, pc } from "../ui";
import { useBoard } from "./useBoard";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Right-hand panel: important dates, open blockers, action items. Folds down to a slim rail. */
export function Side() {
  const collapsed = useUI((s) => s.sideCollapsed);
  if (collapsed) return <SideRail />;
  return (
    <aside className="side" aria-label="Important dates/info, blockers and action items">
      <div className="side-top">
        <span className="label">Overview</span>
        <button type="button" className="icon-btn sm" aria-label="Collapse side panel" title="Collapse panel for more board space" onClick={() => setSideCollapsed(true)}>
          <SidebarSimple className="flip-x" />
        </button>
      </div>
      <ImportantDates />
      <Blockers />
      <ActionItems />
    </aside>
  );
}

/** The collapsed panel: one button per section, with counts. Any of them opens the panel at that section. */
function SideRail() {
  const { db, n, cards } = useBoard();
  const dates = importantItems(db, n).length;
  const blockers = cards.filter((c) => c.col === "blocked" && !c.u.resolved).length;
  const actions = actionItemsForSprint(db, n).filter((a) => !a.done).length;
  const open = (id?: string) => {
    setSideCollapsed(false);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 320);
  };
  const items = [
    { id: "dates-h", label: "Important dates/info", icon: <CalendarBlank />, n: dates, danger: false },
    { id: "blk-h", label: "Open blockers", icon: <ColIcon col="blocked" />, n: blockers, danger: true },
    { id: "act-h", label: "Action items", icon: <ListChecks />, n: actions, danger: false },
  ];
  return (
    <aside className="side-rail" aria-label="Side panel (collapsed)">
      <button type="button" className="rail-btn" aria-label="Expand side panel" title="Expand panel" onClick={() => open()}>
        <SidebarSimple className="flip-x" />
      </button>
      <hr />
      {items.map((it) => (
        <button key={it.id} type="button" className="rail-btn" aria-label={`${it.label}: ${it.n}`} title={it.label} onClick={() => open(it.id)}>
          {it.icon}
          {it.n > 0 && <span className={cx("badge tab", it.danger && "danger")}>{it.n}</span>}
        </button>
      ))}
    </aside>
  );
}

export function AgendaItem({ d, big }: { d: ImportantDate; big?: boolean }) {
  const { db } = useBoard();
  const p = d.project_id ? db.projects[d.project_id] : null;
  const parent = p?.parent_id ? db.projects[p.parent_id] : null;
  const dd = d.date ? new Date(dayMs(d.date)) : null;
  const soon = d.date ? daysBetween(todayKL(), d.date) <= 3 : false;
  const urgent = d.priority === "urgent";
  const rel = d.date ? relativeDay(d.date) : "";
  return (
    <button
      type="button"
      className={cx("agenda-item", urgent && "urgent")}
      style={pc(p?.color ?? parent?.color)}
      onClick={() => !big && setUI({ dateForm: d.id })}
      aria-label={big ? d.title : `Edit ${d.title}`}
    >
      {dd ? (
        <span className="cal">
          <small>{MON[dd.getUTCMonth()]}</small>
          <b className="tab">{dd.getUTCDate()}</b>
        </span>
      ) : (
        <span className="cal info" aria-hidden>
          <Megaphone weight="fill" />
        </span>
      )}
      <span className="agenda-body">
        <b>{d.title}</b>
        {d.note && (
          <span className="note">
            <RichText text={d.note} />
          </span>
        )}
        <span className="agenda-flags">
          {urgent && (
            <span className="pill pill-danger">
              <WarningOctagon weight="fill" /> Urgent
            </span>
          )}
          {dd ? (
            <span className={soon && !urgent ? "pill pill-warn" : "meta"}>
              {WD[dd.getUTCDay()]} · {rel[0].toUpperCase() + rel.slice(1)}
            </span>
          ) : null}
          <span className="meta">
            {dd ? "· " : ""}
            {p ? p.short_name || p.name : "General"}
          </span>
        </span>
      </span>
    </button>
  );
}

export function DateForm({ d, onDone }: { d?: ImportantDate; onDone?: () => void }) {
  const { db, n } = useBoard();
  const [title, setTitle] = useState(d?.title ?? "");
  const [date, setDate] = useState(d?.date ?? "");
  const [projectId, setProjectId] = useState(d?.project_id ?? "");
  const [note, setNote] = useState(d?.note ?? "");
  const [urgent, setUrgent] = useState(d?.priority === "urgent");

  const done = () => (onDone ? onDone() : setUI({ dateForm: null }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    // No date: it's a note for the week being viewed, and stays there.
    const fields = { title: title.trim(), date: date || null, sprint_number: date ? null : (d?.sprint_number ?? n), project_id: projectId || null, note: note.trim() || null, priority: urgent ? ("urgent" as const) : ("normal" as const) };
    if (d) {
      // Send only what changed here, so someone else's edit to another field survives.
      const changed = Object.fromEntries(Object.entries(fields).filter(([k, v]) => d[k as keyof typeof fields] !== v));
      if (Object.keys(changed).length) patchRow("important_dates", d.id, changed);
    } else insertRow("important_dates", { id: newId(), ...fields });
    done();
    showToast(d ? "Updated" : date ? "Date added" : "Note added for this week");
  };

  return (
    <form className="date-form" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && !e.defaultPrevented && done()}>
      <input className="field sm" style={{ fontWeight: 800 }} autoFocus placeholder="Title, e.g. Design review or Eversoft update" aria-label="What's happening" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <DatePicker size="sm" label="Date (optional)" placeholder="No date (note)" value={date || null} onChange={(v) => setDate(v ?? "")} />
        <Select
          size="sm"
          label="Project"
          value={projectId}
          onChange={setProjectId}
          options={[
            { value: "", label: "General" },
            ...projectsInOrder(db).map((p) => ({ value: p.id, label: p.short_name || p.name, lead: <Logo project={p} size={22} /> })),
          ]}
        />
      </div>
      <textarea
        className="field sm-area"
        rows={3}
        placeholder="Description (optional). Enter for a new line; “- ” makes a bullet."
        aria-label="Description"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button type="button" className="switch" role="switch" aria-checked={urgent} aria-label="Urgent" onClick={() => setUrgent(!urgent)} />
        <span style={{ fontWeight: 700, fontSize: 12 }}>Urgent</span>
        {d ? (
          <button
            type="button"
            className="icon-btn sm"
            aria-label="Delete date"
            style={{ marginLeft: "auto" }}
            onClick={() => {
              deleteRow("important_dates", d.id);
              done();
              showToast(`Removed “${d.title}”`, () => restoreRow("important_dates", d));
            }}
          >
            <Trash />
          </button>
        ) : (
          <span style={{ marginLeft: "auto" }} />
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={done}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" disabled={!title.trim()}>
          {d ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}

function ImportantDates() {
  const { db, n, history } = useBoard();
  const dateForm = useUI((s) => s.dateForm);
  // Dates drop off once they've passed: this week shows what's still ahead of today,
  // other weeks what was (or will be) ahead as that week begins.
  const list = importantItems(db, n);
  return (
    <section className="panel reveal" style={{ ["--i" as string]: 1 }} aria-labelledby="dates-h">
      <div className="panel-head">
        <span className="ico">
          <CalendarBlank />
        </span>
        <h2 id="dates-h">Important dates/info</h2>
        <span className="count tab">{list.length}</span>
        <div className="end">
          {!history && (
            <button type="button" className="icon-btn sm" aria-label="Add a date or note" title="Add a date or note" onClick={() => setUI({ dateForm: "new" })}>
              <Plus />
            </button>
          )}
        </div>
      </div>
      <div className="panel-body">
        {dateForm === "new" && <DateForm />}
        {list.map((d) => (dateForm === d.id ? <DateForm key={d.id} d={d} /> : <AgendaItem key={d.id} d={d} />))}
        {!list.length && dateForm !== "new" && <p className="panel-empty">Nothing coming up. Add a date, or a note for this week.</p>}
      </div>
    </section>
  );
}

function Blockers() {
  const { db, cards } = useBoard();
  const group = useUI((s) => s.group);
  const list = cards.filter((c) => c.col === "blocked" && !c.u.resolved);
  const jump = (id: string, laneKey: string) => {
    setUI({ open: id, collapsed: { ...useUI.getState().collapsed, [laneKey]: false } });
    setTimeout(() => document.querySelector(`[data-card="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };
  return (
    <section className="panel reveal" style={{ ["--i" as string]: 2 }} aria-labelledby="blk-h">
      <div className="panel-head">
        <ColIcon col="blocked" />
        <h2 id="blk-h">Open blockers</h2>
        <span className="count tab">{list.length}</span>
      </div>
      <div className="panel-body">
        {list.length ? (
          list.map(({ u }) => {
            const p = db.projects[u.project_id];
            const laneKey = group === "person" ? u.person_id : (p?.parent_id ?? u.project_id);
            return (
              <button type="button" className="row" key={u.id} onClick={() => jump(u.id, laneKey)}>
                <Avatar person={db.people[u.person_id]} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="txt">{u.text || db.tasks[u.task_id]?.title}</div>
                  <div className="sub">
                    <span className="pill pill-danger tab">{ageInDays(u.created_at)} days</span>
                    <span className="meta">{p?.short_name || p?.name}</span>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <p className="panel-empty">No blockers right now.</p>
        )}
      </div>
    </section>
  );
}

function ActionEdit({ a, onDone }: { a: ActionItem; onDone: () => void }) {
  const { db, me } = useBoard();
  const [text, setText] = useState(a.text);
  const [owners, setOwners] = useState<string[]>(a.owner_ids);
  const [due, setDue] = useState(a.due_date);
  const save = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    const next = { text: clean, owner_ids: owners, due_date: due };
    // Only the fields changed here are sent, so a tick by someone else isn't undone.
    const changed = Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(a[k as keyof typeof next]) !== JSON.stringify(v)));
    if (Object.keys(changed).length) patchRow("action_items", a.id, changed);
    onDone();
  };
  return (
    <form className="action-edit" onSubmit={save} onKeyDown={(e) => e.key === "Escape" && !e.defaultPrevented && onDone()}>
      <input className="field sm" autoFocus aria-label="Action item" value={text} onChange={(e) => setText(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <MultiSelect size="sm" label="Owners" placeholder="No owner" value={owners} onChange={setOwners} options={activePeople(db).map((p) => ({ value: p.id, label: p.id === me ? `${firstName(p.name)} (you)` : firstName(p.name), lead: <Avatar person={p} size={18} /> }))} />
        <DatePicker size="sm" label="Due date" placeholder="Due date" value={due} onChange={setDue} />
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          type="button"
          className="icon-btn sm"
          aria-label="Remove action item"
          title="Remove"
          onClick={() => {
            deleteRow("action_items", a.id);
            onDone();
            showToast("Action item removed", () => restoreRow("action_items", a));
          }}
        >
          <Trash />
        </button>
        <span style={{ marginLeft: "auto" }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" disabled={!text.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}

export function ActionItems({ big }: { big?: boolean }) {
  const { db, me, n, history } = useBoard();
  const [text, setText] = useState("");
  const [owner, setOwner] = useState<string[]>(me ? [me] : []);
  const [editing, setEditing] = useState<string | null>(null);
  const list = actionItemsForSprint(db, n);

  const rows = list.map((a) => editing === a.id && !big ? <ActionEdit key={a.id} a={a} onDone={() => setEditing(null)} /> : (
    <div key={a.id} className={cx("row has-edit", a.done && "done")}>
      <button
        type="button"
        className={cx("tick", a.done && "on")}
        aria-label={a.done ? "Mark not done" : "Mark done"}
        disabled={history}
        onClick={(e) => {
          setActionDone(a.id, !a.done);
          if (!a.done) {
            const r = e.currentTarget.getBoundingClientRect();
            confetti(r.left + 10, r.top);
          }
        }}
      >
        {a.done ? <CheckCircle weight="fill" /> : <Circle />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="txt" style={big ? { fontSize: 18, lineHeight: "26px" } : undefined}>
          {a.text}
        </div>
        <div className="sub">
          {a.owner_ids.length > 0 && (
            <span className="who">
              <span className="stack">
                {a.owner_ids.map((id) => (
                  <Avatar key={id} person={db.people[id]} size={18} />
                ))}
              </span>
              {a.owner_ids.map((id) => firstName(db.people[id]?.name)).join(", ")}
            </span>
          )}
          <DueChip due={a.due_date} done={a.done} />
          {a.sprint_number < n && !a.done && <span className="meta">from {weekLabel(a.sprint_number)}</span>}
        </div>
      </div>
      {!history && !big && (
        <button type="button" className="icon-btn sm row-edit" aria-label={`Edit “${a.text}”`} title="Edit or remove" onClick={() => setEditing(a.id)}>
          <PencilSimple />
        </button>
      )}
    </div>
  ));

  if (big) return <div className="panel" style={{ padding: 8 }}>{rows.length ? rows : <p className="panel-empty">No action items.</p>}</div>;

  return (
    <section className="panel reveal" style={{ ["--i" as string]: 3 }} aria-labelledby="act-h">
      <div className="panel-head">
        <span className="ico">
          <ListChecks />
        </span>
        <h2 id="act-h">Action items</h2>
        <span className="count tab">{list.filter((a) => !a.done).length}</span>
      </div>
      <div className="panel-body">{rows.length ? rows : <p className="panel-empty">All clear.</p>}</div>
      {!history && (
        <form
          className="todo-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            addActionItem(text, owner, null, n);
            setText("");
          }}
        >
          <input className="field sm" placeholder="New action item" aria-label="New action item" value={text} onChange={(e) => setText(e.target.value)} />
          <div style={{ display: "flex", gap: 6 }}>
            <MultiSelect size="sm" label="Owners" placeholder="No owner" value={owner} onChange={setOwner} options={activePeople(db).map((p) => ({ value: p.id, label: p.id === me ? `${firstName(p.name)} (you)` : firstName(p.name), lead: <Avatar person={p} size={18} /> }))} />
            <button className="btn btn-primary btn-sm" disabled={!text.trim()}>
              <Plus weight="bold" /> Add
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
