"use client";

import { useState } from "react";
import { ArrowsClockwise, Check, Clock, DotsSixVertical, HandWaving, Smiley, Trash, WarningOctagon, X, Circle, CheckCircle } from "@phosphor-icons/react";
import { findOrCreateTask, toggleReaction, setBlockerResolved } from "@/lib/actions";
import { COL_META, dropCard, type BoardCard } from "@/lib/board";
import { startDrag, justDragged } from "@/lib/dnd";
import { ageInDays, tasksForProject } from "@/lib/queries";
import { dayMonth, weekLabel } from "@/lib/sprint";
import { deleteRow, patchRow, restoreRow, useStore } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui-store";
import { Combobox, DatePicker } from "../fields";
import { RichText } from "../RichText";
import { showToast } from "../Toaster";
import { Avatar, cx, DueChip, firstName, pc, SizeDots, Sizes } from "../ui";
import { moveWithFeedback, useBoard } from "./useBoard";

const EMOJI = ["👍", "🎉", "👀", "🙌", "❤️", "🔥"];

export function Card({ card, big }: { card: BoardCard; big?: boolean }) {
  const { db, me, history } = useBoard();
  const group = useUI((s) => s.group);
  const open = useUI((s) => s.open === card.u.id);
  const fresh = useUI((s) => s.fresh === card.u.id);
  const arrived = useUI((s) => !!s.arrived[card.u.id]);
  const [picking, setPicking] = useState(false);
  const u = card.u;
  const project = db.projects[u.project_id];
  const parent = project?.parent_id ? db.projects[project.parent_id] : null;
  const person = db.people[u.person_id];
  const task = db.tasks[u.task_id];
  const mine = u.person_id === me;
  const blocked = card.col === "blocked";
  const help = u.help_from_person_id ? db.people[u.help_from_person_id]?.name : u.help_from_text;
  const reactions = new Map<string, string[]>();
  for (const r of Object.values(db.reactions))
    if (r.target_id === u.id) reactions.set(r.emoji, [...(reactions.get(r.emoji) ?? []), r.person_id]);

  const toggleOpen = () => setUI({ open: open ? null : u.id, composer: null });

  return (
    <article
      className={cx("card", blocked && "blocked", u.resolved && "resolved", open && "is-open", fresh && "is-new", arrived && "is-arrived", history && "readonly")}
      style={pc(project?.color ?? parent?.color)}
      data-card={u.id}
      tabIndex={0}
      aria-label={`${person?.name}: ${u.text || task?.title}. ${project?.name}. ${COL_META[card.col].label}. Press Enter to open.`}
      onPointerDown={(e) => {
        if (history || open) return;
        startDrag(e, {
          canDrop: (t) => !(group === "person" && t.lane !== u.person_id),
          onRefused: () => showToast("Cards stay with their owner. Switch to Projects to move between projects."),
          onDrop: (t, point) => moveWithFeedback(card, t.col as BoardCard["col"], group === "project" ? t.lane : null, point, t.task || undefined),
        });
      }}
      onClick={(e) => {
        if (justDragged() || (e.target as HTMLElement).closest("button, a, input, textarea, select, .editor")) return;
        toggleOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) toggleOpen();
        if (e.key === "Escape") setUI({ open: null });
      }}
    >
      {group === "person" && !big && (
        <div className="proj-tag meta">
          {project?.short_name || project?.name} · {task?.title}
        </div>
      )}
      {!history && (
        <span className="handle" data-handle title="Drag to move" aria-hidden>
          <DotsSixVertical />
        </span>
      )}
      <div className="card-text">{u.text ? <RichText text={u.text} /> : task?.title}</div>
      {blocked && help && (
        <div className="help">
          <HandWaving /> Needs {help}
        </div>
      )}
      <div className="card-foot">
        <span className="who">
          <Avatar person={person} size={big ? 26 : 20} />
          {firstName(person?.name)}
        </span>
        {u.size && <SizeDots size={u.size} />}
        <DueChip due={u.due_date} done={card.col === "done"} />
        {card.col === "doing" && u.carry_count >= 2 && (
          <span className="pill pill-danger" title={`Carried over ${u.carry_count} weeks in a row`}>
            <WarningOctagon weight="fill" /> Stuck {u.carry_count}×
          </span>
        )}
        {blocked && !u.resolved && (
          <span className="pill pill-danger tab" title="Days open">
            <Clock /> {ageInDays(u.created_at)}d
          </span>
        )}
        {!history && !big && (
          <button type="button" className="rx-add" aria-label="Add reaction" aria-expanded={picking} onClick={() => setPicking(!picking)}>
            <Smiley />
          </button>
        )}
      </div>
      {reactions.size > 0 && (
        <div className="rx">
          {[...reactions.entries()].map(([emoji, who]) => (
            <button
              key={emoji}
              type="button"
              className={who.includes(me) ? "mine" : ""}
              title={who.map((w) => db.people[w]?.name).join(", ")}
              onClick={() => !history && toggleReaction("update", u.id, emoji)}
            >
              {emoji}
              {who.length > 1 && <span className="tab">{who.length}</span>}
            </button>
          ))}
        </div>
      )}
      {card.toSort && (
        <div className="carry-bar">
          <span className="lbl">
            <ArrowsClockwise /> From {weekLabel(u.sprint_number)}
          </span>
          {mine && !big ? (
            <>
              <button
                type="button"
                className="mini go"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  moveWithFeedback(card, "done", null, { x: r.left + r.width / 2, y: r.top });
                }}
              >
                <Check weight="bold" /> Done
              </button>
              <button type="button" className="mini" onClick={() => moveWithFeedback(card, "doing", null)}>
                Keep
              </button>
              <button type="button" className="mini" aria-label="Drop this card" onClick={() => showToast("Dropped", dropCard(u))}>
                <X />
              </button>
            </>
          ) : (
            <span className="lbl" style={{ margin: 0 }}>
              Waiting for {firstName(person?.name)}
            </span>
          )}
        </div>
      )}
      {picking && (
        <div className="rx-pick" onMouseLeave={() => setPicking(false)}>
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React ${emoji}`}
              onClick={() => {
                toggleReaction("update", u.id, emoji);
                setPicking(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {open && <Editor card={card} mine={mine} history={history} />}
    </article>
  );
}

function Editor({ card, mine, history }: { card: BoardCard; mine: boolean; history: boolean }) {
  const db = useStore((s) => s.db);
  const u = card.u;
  const shown = u.text || "";
  const taskTitle = db.tasks[u.task_id]?.title ?? "";
  const [text, setText] = useState(shown);
  const [task, setTask] = useState(taskTitle);
  const commit = () => {
    const v = text.trim();
    if (v !== shown.trim()) patchRow("updates", u.id, { text: v });
    // Renaming the task re-files this card under that task (a new one if it doesn't exist yet).
    const t = task.trim();
    if (t && t.toLowerCase() !== taskTitle.trim().toLowerCase()) patchRow("updates", u.id, { task_id: findOrCreateTask(u.project_id, t) });
  };
  const close = () => {
    commit();
    setUI({ open: null });
  };
  const edited = u.updated_by && u.updated_at !== u.created_at ? ` · last change by ${firstName(db.people[u.updated_by]?.name)}` : "";

  return (
    <div className="editor" onClick={(e) => e.stopPropagation()}>
      {mine && !history ? (
        <>
          <div className="editor-field">
            <span className="label">Task</span>
            <Combobox
              size="sm"
              label="Task this card belongs to"
              placeholder="Task name"
              value={task}
              onChange={setTask}
              onBlur={commit}
              suggestions={tasksForProject(db, u.project_id).map((t) => t.title)}
            />
          </div>
          <textarea
            className="field"
            rows={3}
            placeholder="Details (optional)"
            aria-label="Card text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                close();
              }
            }}
          />
          <div className="editor-row">
            <Sizes value={u.size} onChange={(size) => patchRow("updates", u.id, { size })} />
            <DatePicker size="sm" label="Due date" placeholder="Due date" value={u.due_date} onChange={(due_date) => patchRow("updates", u.id, { due_date })} />
            {card.col === "blocked" && (
              <button type="button" className="mini" onClick={() => setBlockerResolved(u, !u.resolved)}>
                {u.resolved ? <CheckCircle weight="fill" /> : <Circle />} {u.resolved ? "Resolved" : "Mark resolved"}
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="meta">
          {history ? "Past weeks are read-only." : `Only ${firstName(db.people[u.person_id]?.name)} can edit the words. Anyone can drag it or react.`}
        </p>
      )}
      <div className="editor-row">
        {mine && !history && (
          <button
            type="button"
            className="mini"
            onClick={() => {
              deleteRow("updates", u.id);
              setUI({ open: null });
              showToast("Card deleted", () => restoreRow("updates", u));
            }}
          >
            <Trash /> Delete
          </button>
        )}
        <span className="audit">
          Added {dayMonth(u.created_at.slice(0, 10))} by {firstName(db.people[u.created_by ?? u.person_id]?.name)}
          {edited}
        </span>
        <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={close}>
          Done
        </button>
      </div>
    </div>
  );
}
