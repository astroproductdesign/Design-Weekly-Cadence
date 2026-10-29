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
import { ImageRow, useImages } from "../Images";
import { Avatar, Logo, Sizes } from "../ui";
import { useBoard } from "./useBoard";

/** Inline "add a card" form. Enter adds and keeps the form open for the next one. */
export function Composer({ lane, col, task: presetTask }: { lane: string; col: Col; task?: string }) {
  const { db, me, n, current } = useBoard();
  const byProject = !!db.projects[lane];
  const [projectId, setProjectId] = useState(() => (byProject ? lane : usualProjectIds(db, me, n)[0] ?? projectsInOrder(db)[0]?.id ?? ""));
  // The task is required and starts empty (unless you came from a task's own "Add card"): pick one that exists or type a new name.
  const [task, setTask] = useState(presetTask ?? "");
  const [invalid, setInvalid] = useState(false);
  const [text, setText] = useState("");
  const [size, setSize] = useState<Size | null>(null);
  const [due, setDue] = useState("");
  const [help, setHelp] = useState("");
  const [added, setAdded] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const imgs = useImages(images, setImages);
  const ta = useRef<HTMLTextAreaElement>(null);
  const taskBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (presetTask) ta.current?.focus();
  }, [presetTask]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = task.trim();
    const body = text.trim();
    if (!t) {
      setInvalid(true);
      taskBox.current?.querySelector("input")?.focus();
      return;
    }
    const title = t.slice(0, 120);
    const note = body;
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
      images,
    });
    setUI({ fresh: u.id });
    setText("");
    setSize(null);
    setImages([]);
    setDue("");
    setHelp("");
    setAdded((a) => a + 1);
    ta.current?.focus();
  };

  return (
    <form className="composer" onSubmit={submit} {...imgs.bind} onKeyDown={(e) => e.key === "Escape" && setUI({ composer: null })}>
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
      <div className="task-field" ref={taskBox}>
        <label className="label">Task name</label>
        <Combobox
          size="sm"
          chevron={false}
          invalid={invalid}
          autoFocus={!presetTask}
          label="Task name (required). Pick an existing task or type a new one."
          placeholder="Type a task name, or pick one"
          value={task}
          onChange={(v) => {
            setTask(v);
            setInvalid(false);
          }}
          suggestions={tasksForProject(db, projectId).map((t) => t.title)}
        />
        {invalid ? (
          <p className="field-error" role="alert">
            Add a task name. Type a new one or pick an existing task.
          </p>
        ) : (
          <p className="composer-hint">Start typing to see existing tasks, or enter a new name.</p>
        )}
      </div>
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
      <ImageRow images={images} onChange={setImages} imgs={imgs} />
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
