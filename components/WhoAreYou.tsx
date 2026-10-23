"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { activePeople, allPeople } from "@/lib/queries";
import { insertRow, newId, setCurrentPerson, useStore } from "@/lib/store";
import { Blob } from "./Blob";

/** First visit on a device: pick your name (or add yourself). */
export function WhoAreYou() {
  const db = useStore((s) => s.db);
  const people = activePeople(db);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    const id = newId();
    // Become this person first so the new row is recorded as created by them.
    setCurrentPerson(id);
    insertRow("people", { id, name: clean, avatar_url: null, blob_color: null, role: "member", active: true, sort_order: allPeople(db).length + 1 });
  };

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <h1 className="reveal">
          Welcome to Design Weekly Cadence
          <span>Who&apos;s checking in?</span>
        </h1>
        <p className="sub reveal" style={{ ["--i" as string]: 1 }}>
          Tap your name. This device will remember you.
        </p>
        <div className="people-grid">
          {people.map((p, i) => (
            <button key={p.id} type="button" className="person-tile reveal" style={{ ["--i" as string]: i + 2 }} onClick={() => setCurrentPerson(p.id)}>
              <Blob id={p.id} pose={p.role === "lead" ? "wave" : "idle"} size={72} />
              <b>{p.name}</b>
              <span className="label" style={p.role === "member" ? { visibility: "hidden" } : undefined}>
                {p.role === "admin" ? "Admin" : "Design lead"}
              </span>
            </button>
          ))}
          {adding ? (
            <form className="person-tile add" onSubmit={add} onKeyDown={(e) => e.key === "Escape" && setAdding(false)} style={{ gap: 8 }}>
              <label htmlFor="new-person">
                <b>Your name</b>
              </label>
              <input
                id="new-person"
                className="field"
                style={{ textAlign: "center" }}
                autoFocus
                placeholder="First and last name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div style={{ display: "flex", gap: 6, width: "100%" }}>
                <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setAdding(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={!name.trim()}>
                  Join
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="person-tile add reveal" style={{ ["--i" as string]: people.length + 2 }} onClick={() => setAdding(true)}>
              <span style={{ fontSize: 34, color: "var(--muted)", display: "inline-flex" }}>
                <Plus />
              </span>
              <b>Add person</b>
              <span className="label">New to the team?</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
