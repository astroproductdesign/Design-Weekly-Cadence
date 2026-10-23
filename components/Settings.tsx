"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowCounterClockwise, CaretDown, Kanban, Plus, PushPin, Trash, UploadSimple, Users, X } from "@phosphor-icons/react";
import { resetDemoData } from "@/lib/backend/demo";
import { PROJECT_COLORS } from "@/lib/colors";
import { imageToDataUrl } from "@/lib/image";
import { allPeople, byOrder } from "@/lib/queries";
import { deleteRow, getCurrentPersonId, insertRow, newId, patchRow, restoreRow, useStore } from "@/lib/store";
import type { DB, Person, Project, Role } from "@/lib/types";
import { setUI } from "@/lib/ui-store";
import { Select } from "./fields";
import { showToast } from "./Toaster";
import { Avatar, cx, firstName, Logo } from "./ui";

const ROLES = [
  { value: "member" as Role, label: "Member" },
  { value: "lead" as Role, label: "Design lead" },
  { value: "admin" as Role, label: "Admin" },
];

/** Click the tile to upload an image (shrunk and stored with the row). */
function ImageUpload({ label, round, onPick, children }: { label: string; round?: boolean; onPick: (url: string) => void; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={cx("up", round && "round")} aria-label={label} title={label} onClick={() => input.current?.click()}>
        {children}
        <span className="over">
          <UploadSimple />
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onPick(await imageToDataUrl(file, 128));
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Couldn't read that image");
          }
        }}
      />
    </>
  );
}

/** Saves on blur or Enter. */
function NameInput({ value, label, onSave, small }: { value: string; label: string; onSave: (v: string) => void; small?: boolean }) {
  return (
    <input
      key={value}
      className="name"
      aria-label={label}
      defaultValue={value}
      style={small ? { fontSize: 12, fontWeight: 600, color: "var(--muted)" } : undefined}
      onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== value && onSave(e.target.value.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** "Remove X?" strip under a row, so nothing disappears on a single stray click. */
function ConfirmRemove({ text, onCancel, onConfirm }: { text: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="set-confirm" role="alertdialog" aria-label={text}>
      <span>{text}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        Cancel
      </button>
      <button type="button" className="btn btn-danger btn-sm" autoFocus onClick={onConfirm}>
        Remove
      </button>
    </div>
  );
}

const cardsFor = (db: DB, test: (u: DB["updates"][string]) => boolean) => Object.values(db.updates).filter(test).length;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function Settings() {
  const db = useStore((s) => s.db);
  const mode = useStore((s) => s.mode);
  const [tab, setTab] = useState<"projects" | "people">("projects");
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const close = () => setUI({ settings: false });

  const tops = Object.values(db.projects).filter((p) => !p.parent_id).sort(byOrder);
  const childrenOf = (id: string) => Object.values(db.projects).filter((c) => c.parent_id === id).sort(byOrder);
  const liveProjects: Project[] = tops.filter((t) => !t.archived).flatMap((t) => [t, ...childrenOf(t.id).filter((c) => !c.archived)]);
  const removedProjects = Object.values(db.projects)
    .filter((p) => p.archived && !(p.parent_id && db.projects[p.parent_id]?.archived))
    .sort(byOrder);
  const people = allPeople(db);
  const livePeople = people.filter((p) => p.active);
  const removedPeople = people.filter((p) => !p.active);
  const removedCount = tab === "projects" ? removedProjects.length : removedPeople.length;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (tab === "projects") {
      const siblings = Object.values(db.projects).filter((p) => (p.parent_id ?? "") === parent);
      insertRow("projects", {
        id: newId(),
        name: clean,
        short_name: clean.split(/\s+/)[0],
        logo_url: null,
        color: parent ? (db.projects[parent]?.color ?? "neutral") : "neutral",
        parent_id: parent || null,
        sort_order: Math.max(0, ...siblings.map((p) => p.sort_order)) + 1,
        archived: false,
        pinned: false,
      });
      showToast(`${clean} added. Pick a colour and upload a logo.`);
    } else {
      insertRow("people", { id: newId(), name: clean, avatar_url: null, blob_color: null, role, active: true, sort_order: people.length + 1 });
      showToast(`${firstName(clean)} added`);
    }
    setName("");
  };

  // Removing hides a project or person but keeps their cards in past weeks.
  // Only something with no cards at all can be deleted for good.
  const removeProject = (p: Project) => {
    const family = [p, ...childrenOf(p.id).filter((c) => !c.archived)];
    for (const x of family) patchRow("projects", x.id, { archived: true });
    setConfirming(null);
    showToast(`Removed ${p.name}`, () => family.forEach((x) => patchRow("projects", x.id, { archived: false })));
  };
  const restoreProject = (p: Project) => {
    for (const x of [p, ...childrenOf(p.id)]) patchRow("projects", x.id, { archived: false });
    showToast(`${p.name} is back on the board`);
  };
  const deleteProject = (p: Project) => {
    const family = [p, ...childrenOf(p.id)];
    for (const x of family.slice().reverse()) deleteRow("projects", x.id);
    showToast(`Deleted ${p.name}`, () => family.forEach((x) => restoreRow("projects", x)));
  };
  const removePerson = (p: Person) => {
    patchRow("people", p.id, { active: false });
    setConfirming(null);
    showToast(`Removed ${firstName(p.name)}`, () => patchRow("people", p.id, { active: true }));
  };
  const deletePerson = (p: Person) => {
    deleteRow("people", p.id);
    showToast(`Deleted ${firstName(p.name)}`, () => restoreRow("people", p));
  };

  const projectCards = (p: Project) => cardsFor(db, (u) => u.project_id === p.id || db.projects[u.project_id]?.parent_id === p.id);

  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Settings" onKeyDown={(e) => e.key === "Escape" && !e.defaultPrevented && close()}>
        <div className="drawer-head">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" style={{ marginLeft: "auto" }} aria-label="Close settings" onClick={close}>
            <X />
          </button>
        </div>
        <div style={{ padding: "0 24px 12px" }}>
          <div className="seg">
            <button type="button" aria-pressed={tab === "projects"} onClick={() => setTab("projects")}>
              <Kanban /> Projects
            </button>
            <button type="button" aria-pressed={tab === "people"} onClick={() => setTab("people")}>
              <Users /> People
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <form className="set-add" onSubmit={add}>
            <p className="label">{tab === "projects" ? "Add a project" : "Add a person"}</p>
            <div className="set-add-row">
              <input
                className="field"
                style={{ flex: "2 1 160px" }}
                placeholder={tab === "projects" ? "Project name" : "Their name"}
                aria-label={tab === "projects" ? "New project name" : "New person's name"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {tab === "projects" ? (
                <Select
                  label="Part of"
                  value={parent}
                  onChange={setParent}
                  style={{ flex: "1 1 120px", width: "auto" }}
                  options={[
                    { value: "", label: "Top level" },
                    ...tops.filter((t) => !t.archived).map((t) => ({ value: t.id, label: `Inside ${t.short_name || t.name}`, lead: <Logo project={t} size={22} /> })),
                  ]}
                />
              ) : (
                <Select label="Role" value={role} onChange={setRole} options={ROLES} style={{ flex: "1 1 120px", width: "auto" }} />
              )}
              <button className="btn btn-primary" style={{ height: 40 }} disabled={!name.trim()}>
                <Plus weight="bold" /> Add
              </button>
            </div>
          </form>

          {tab === "projects" ? (
            <>
              <p className="meta" style={{ margin: "8px 0 4px" }}>
                Click a tile to upload a logo. The colour shows as a band on the side of each card. The pin keeps an ongoing project on the board even in weeks with no cards.
              </p>
              {liveProjects.map((p) => {
                const kids = p.parent_id ? 0 : childrenOf(p.id).filter((c) => !c.archived).length;
                const n = projectCards(p);
                return (
                  <div key={p.id} className="set-row" style={p.parent_id ? { marginLeft: 24 } : undefined}>
                    <div className="set-main">
                      <ImageUpload label={p.logo_url ? `Change logo for ${p.name}` : `Upload logo for ${p.name}`} onPick={(logo_url) => patchRow("projects", p.id, { logo_url })}>
                        <Logo project={p} size={40} />
                      </ImageUpload>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <NameInput value={p.name} label="Project name" onSave={(v) => patchRow("projects", p.id, { name: v })} />
                        <NameInput value={p.short_name ?? ""} label="Short name" small onSave={(v) => patchRow("projects", p.id, { short_name: v })} />
                      </div>
                      {p.logo_url && (
                        <button type="button" className="icon-btn sm" aria-label={`Remove logo for ${p.name}`} title="Remove logo" onClick={() => patchRow("projects", p.id, { logo_url: null })}>
                          <X />
                        </button>
                      )}
                      {!p.parent_id && (
                        <button
                          type="button"
                          className={cx("icon-btn sm pin", p.pinned && "on")}
                          aria-pressed={p.pinned}
                          aria-label={`Always show ${p.name} on the board`}
                          title={p.pinned ? "Ongoing: always on the board. Click to let it hide when empty." : "Mark as ongoing: always show on the board"}
                          onClick={() => patchRow("projects", p.id, { pinned: !p.pinned })}
                        >
                          <PushPin weight={p.pinned ? "fill" : "regular"} />
                        </button>
                      )}
                      <button type="button" className="icon-btn sm" aria-label={`Remove ${p.name}`} title="Remove project" onClick={() => setConfirming(p.id)}>
                        <Trash />
                      </button>
                    </div>
                    <div className="swatches" role="radiogroup" aria-label={`Colour for ${p.name}`}>
                      {PROJECT_COLORS.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          className="swatch"
                          role="radio"
                          aria-checked={p.color === c.key}
                          aria-label={c.label}
                          title={c.label}
                          style={{ ["--sw" as string]: `var(--p-${c.key})` }}
                          onClick={() => patchRow("projects", p.id, { color: c.key })}
                        />
                      ))}
                    </div>
                    {confirming === p.id && (
                      <ConfirmRemove
                        text={`Remove ${p.name}${kids ? ` and its ${plural(kids, "sub-project")}` : ""}? ${n ? `Its ${plural(n, "card")} stay in past weeks.` : "It has no cards yet."}`}
                        onCancel={() => setConfirming(null)}
                        onConfirm={() => removeProject(p)}
                      />
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            livePeople.map((p) => {
              const n = cardsFor(db, (u) => u.person_id === p.id);
              const isMe = p.id === getCurrentPersonId();
              return (
                <div key={p.id} className="set-row">
                  <div className="set-main">
                    <ImageUpload label={`Upload photo for ${p.name}`} round onPick={(avatar_url) => patchRow("people", p.id, { avatar_url })}>
                      <Avatar person={p} size={32} />
                    </ImageUpload>
                    <NameInput value={p.name} label="Name" onSave={(v) => patchRow("people", p.id, { name: v })} />
                    <Select size="sm" label={`Role for ${p.name}`} value={p.role} onChange={(r) => patchRow("people", p.id, { role: r })} options={ROLES} style={{ width: 140, flex: "none" }} />
                    <button type="button" className="icon-btn sm" aria-label={`Remove ${p.name}`} title="Remove person" onClick={() => setConfirming(p.id)}>
                      <Trash />
                    </button>
                  </div>
                  {confirming === p.id && (
                    <ConfirmRemove
                      text={`Remove ${firstName(p.name)}${isMe ? " (that's you)" : ""}? ${n ? `Their ${plural(n, "card")} stay in past weeks.` : "They have no cards yet."}`}
                      onCancel={() => setConfirming(null)}
                      onConfirm={() => removePerson(p)}
                    />
                  )}
                </div>
              );
            })
          )}

          {removedCount > 0 && (
            <div className="set-removed">
              <button type="button" className="set-removed-toggle" aria-expanded={showRemoved} onClick={() => setShowRemoved(!showRemoved)}>
                <CaretDown className={cx("caret", !showRemoved && "shut")} />
                Removed ({removedCount})
              </button>
              {showRemoved &&
                (tab === "projects"
                  ? removedProjects.map((p) => {
                      const n = projectCards(p);
                      return (
                        <div key={p.id} className="set-row off-row">
                          <div className="set-main">
                            <Logo project={p} size={32} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <b className="set-name">{p.parent_id ? `${db.projects[p.parent_id]?.short_name || db.projects[p.parent_id]?.name} › ` : ""}{p.name}</b>
                              <span className="meta">{n ? `${plural(n, "card")} in past weeks` : "No cards"}</span>
                            </div>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => restoreProject(p)}>
                              Restore
                            </button>
                            {!n && (
                              <button type="button" className="icon-btn sm" aria-label={`Delete ${p.name} for good`} title="Delete for good" onClick={() => deleteProject(p)}>
                                <Trash />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  : removedPeople.map((p) => {
                      const n = cardsFor(db, (u) => u.person_id === p.id);
                      return (
                        <div key={p.id} className="set-row off-row">
                          <div className="set-main">
                            <Avatar person={p} size={32} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <b className="set-name">{p.name}</b>
                              <span className="meta">{n ? `${plural(n, "card")} in past weeks` : "No cards"}</span>
                            </div>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => patchRow("people", p.id, { active: true })}>
                              Restore
                            </button>
                            {!n && (
                              <button type="button" className="icon-btn sm" aria-label={`Delete ${p.name} for good`} title="Delete for good" onClick={() => deletePerson(p)}>
                                <Trash />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }))}
            </div>
          )}

          <p className="meta" style={{ marginTop: 12 }}>
            Removing hides a project or person from the board and the name picker. Their cards stay in past weeks, and you can restore them any time.
          </p>
          {mode === "demo" && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ justifySelf: "start", marginTop: 8 }}
              onClick={() => {
                resetDemoData();
                window.location.reload();
              }}
            >
              <ArrowCounterClockwise /> Reset sample data
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
