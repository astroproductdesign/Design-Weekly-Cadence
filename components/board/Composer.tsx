"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { addUpdate, findOrCreateTask } from "@/lib/actions";
import { COL_META, TYPE_OF, type Col } from "@/lib/board";
import { sprintDates } from "@/lib/sprint";
import { activePeople, projectsInOrder, tasksForProject, usualProjectIds } from "@/lib/queries";
import { setUI } from "@/lib/ui-store";
import type { Size } from "@/lib/types";
import { Combobox, DatePicker, Select } from "../fields";
import { Avatar, Logo, Sizes } from "../ui";
import { useBoard } from "./useBoard";

/** Inline "add a card" form. Enter adds and keeps the form open for the next one. */
export function Composer({ lane, col, task: presetTask }: { lane: string; col: Col; task?: string }) {
  const { db, me, n, current } = useBoard();
  const byProject = !!db.projects[lane];
  const [projectId, setProjectId] = useState(() => (byProject ? lane : usualProjectIds(db, me, n)[0] ?? projectsInOrder(db)[0]?.id ?? ""));
  const [task, setTask] = useState(() => {
    if (presetTask) return presetTask;
    const mineHere = Object.values(db.updates).filter((u) => u.person_id === me && u.project_id === projectId && u.sprint_number === n && u.text);
    return mineHere.length ? db.tasks[mineHere[mineHere.length - 1].task_id]?.title ?? "" : "";
  });
  const [text, setText] = useState("");
  const [size, setSize] = useState<Size | null>(null);
  const [due, setDue] = useState("");
  const [help, setHelp] = useState("");
  const [added, setAdded] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ta.current?.focus();
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = task.trim();
    const body = text.trim();
    if (!t && !body) {
      ta.current?.focus();
      return;
    }
    // No task given: the first line becomes the task, the rest is the note.
    const title = t || body.split("\n")[0].slice(0, 120);
    const note = t ? body : body.split("\n").slice(1).join("\n").trim();
    const helpPerson = help && db.people[help] ? help : null;
    const u = addUpdate({
      sprint: n,
      projectId,
      taskId: findOrCreateTask(projectId, title),
      type: TYPE_OF[col],
      text: note,
      size,
      due: due || null,
      helpFromPersonId: helpPerson,
      helpFromText: help && !helpPerson ? help : null,
    });
    setUI({ fresh: u.id });
    setText("");
    setSize(null);
    setDue("");
    setHelp("");
    setAdded((a) => a + 1);
    ta.current?.focus();
  };

  return (
    <form className="composer" onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && setUI({ composer: null })}>
      {!byProject && (
        <Select
          size="sm"
          label="Project"
          value={projectId}
          onChange={setProjectId}
          options={projectsInOrder(db).map((p) => ({
            value: p.id,
            label: `${p.parent_id ? `${db.projects[p.parent_id]?.short_name || db.projects[p.parent_id]?.name} › ` : ""}${p.name}`,
            lead: <Logo project={p} size={22} />,
          }))}
        />
      )}
      <Combobox
        size="sm"
        className="task-in"
        label="Task (optional: pick one or type a new one)"
        placeholder="Task (optional)"
        value={task}
        onChange={setTask}
        suggestions={tasksForProject(db, projectId).map((t) => t.title)}
      />
      <textarea
        ref={ta}
        className="field"
        rows={4}
        aria-label={COL_META[col].prompt}
        placeholder={COL_META[col].prompt}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
        }}
      />
      <div className="composer-row">
        <Sizes value={size} onChange={setSize} />
        <DatePicker size="sm" near={n > current ? sprintDates(n).start_date : undefined} label="Due date (optional)" placeholder="Due date" value={due || null} onChange={(v) => setDue(v ?? "")} style={{ flex: "1 1 120px" }} />
        {col === "blocked" && (
          <Select
            size="sm"
            label="Need help from"
            placeholder="Help from…"
            value={help}
            onChange={setHelp}
            style={{ flex: "1 1 120px", width: "auto" }}
            options={[
              { value: "", label: "Nobody yet" },
              ...activePeople(db)
                .filter((p) => p.id !== me)
                .map((p) => ({ value: p.id, label: p.name, lead: <Avatar person={p} size={18} /> })),
              { value: "Eng team", label: "Eng team" },
            ]}
          />
        )}
      </div>
      <div className="composer-row">
        <button className="btn btn-primary btn-sm">
          <Plus weight="bold" /> Add card
        </button>
        <button type="button" className="icon-btn sm" aria-label="Close" onClick={() => setUI({ composer: null })}>
          <X />
        </button>
        <span className="composer-hint">{added ? `Added ${added}. Keep going, or Esc to close.` : "Enter adds · Shift+Enter new line"}</span>
      </div>
    </form>
  );
}
