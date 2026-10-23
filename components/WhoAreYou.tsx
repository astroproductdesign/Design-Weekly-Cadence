"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, CircleHalf, Plus, Presentation, Prohibit, X } from "@phosphor-icons/react";
import { activePeople, allPeople } from "@/lib/queries";
import { insertRow, newId, setCurrentPerson, useStore } from "@/lib/store";
import { currentSprintNumber, sprintRangeLabel, weekLabel } from "@/lib/sprint";
import { Blob } from "./Blob";
import { BrandMark } from "./AppShell";

/** First visit on a device: pick your name (or add yourself). */
export function WhoAreYou() {
  const db = useStore((s) => s.db);
  const people = activePeople(db);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) dialog.current?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    setAdding(false);
  };
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

  const week = currentSprintNumber();
  const hero = people.slice(0, 3);

  return (
    <div className="welcome">
      <header className="welcome-bar">
        <span className="brand">
          <BrandMark />
          Design Cadence
        </span>
        <span className="welcome-week">
          {weekLabel(week)} · {sprintRangeLabel(week)}
        </span>
      </header>

      <section className="welcome-hero">
        <div className="hero-copy">
          <p className="label reveal">Your team&apos;s weekly check-in</p>
          <h1 className="reveal" style={{ ["--i" as string]: 1 }}>
            Welcome to Design Cadence
          </h1>
          <p className="lead reveal" style={{ ["--i" as string]: 2 }}>
            One board for the whole team: what got done, what everyone is working on, and what needs a hand. No more duplicating a page every week.
          </p>
          <ul className="hero-points reveal" style={{ ["--i" as string]: 3 }}>
            <li>
              <span style={{ color: "var(--ok)" }}>
                <CheckCircle weight="fill" />
              </span>
              <b>Done</b> what you finished last week
            </li>
            <li>
              <span style={{ color: "var(--info)" }}>
                <CircleHalf weight="fill" />
              </span>
              <b>Doing</b> what you&apos;re on this week
            </li>
            <li>
              <span style={{ color: "var(--danger)" }}>
                <Prohibit weight="fill" />
              </span>
              <b>Blocked</b> where you need a hand
            </li>
            <li>
              <span>
                <Presentation weight="fill" />
              </span>
              <b>Present</b> it all in Tuesday&apos;s check-in
            </li>
          </ul>
          <button type="button" className="btn btn-primary hero-cta reveal" style={{ ["--i" as string]: 4 }} onClick={() => setOpen(true)}>
            Sign in
          </button>
        </div>
        <div className="hero-art reveal" style={{ ["--i" as string]: 2 }} aria-hidden>
          <div className="hero-card hero-done">
            <CheckCircle weight="fill" /> Done
          </div>
          <div className="hero-card hero-doing">
            <CircleHalf weight="fill" /> Doing
          </div>
          <div className="hero-card hero-blocked">
            <Prohibit weight="fill" /> Blocked
          </div>
          <div className="hero-blobs">
            {hero.map((p, i) => (
              <Blob key={p.id} id={p.id} pose={(["wave", "cheer", "idle"] as const)[i]} size={i === 1 ? 120 : 96} className="idle" />
            ))}
          </div>
        </div>
      </section>

      {open && (
        <>
          <div className="scrim" onClick={close} />
          <div
            ref={dialog}
            tabIndex={-1}
            className="signin"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-h"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                if (adding) setAdding(false);
                else close();
              }
            }}
          >
            <button type="button" className="icon-btn signin-x" aria-label="Cancel" onClick={close}>
              <X />
            </button>
            <h2 id="signin-h">Who&apos;s checking in?</h2>
            <p className="sub">Tap your name. This device will remember you.</p>
            <div className="people-grid">
          {people.map((p) => (
            <button key={p.id} type="button" className="person-tile" onClick={() => setCurrentPerson(p.id)}>
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
            <button type="button" className="person-tile add" onClick={() => setAdding(true)}>
              <span style={{ fontSize: 34, color: "var(--muted)", display: "inline-flex" }}>
                <Plus />
              </span>
              <b>Add person</b>
              <span className="label">New to the team?</span>
            </button>
          )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
