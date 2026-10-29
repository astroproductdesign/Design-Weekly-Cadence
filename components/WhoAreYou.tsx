"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle, CircleHalf, Presentation, Prohibit, X } from "@phosphor-icons/react";
import { activePeople, allPeople } from "@/lib/queries";
import { requestCode, verifyCode, type Who } from "@/lib/auth-client";
import { insertRow, newId, setCurrentPerson, useStore } from "@/lib/store";
import { currentSprintNumber, sprintRangeLabel, weekLabel } from "@/lib/sprint";
import { Blob } from "./Blob";
import type { Person } from "@/lib/types";
import { BrandMark } from "./AppShell";

/** First visit on a device: pick your name (or add yourself). */
export function WhoAreYou() {
  const db = useStore((s) => s.db);
  const authOn = useStore((s) => s.authOn);
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
            {authOn ? (
              <CodeSignIn people={people} />
            ) : people.length === 0 ? (
              <>
                <h2 id="signin-h">Welcome! Who are you?</h2>
                <p className="sub">Nobody is on the team yet. Add yourself to get started.</p>
                <form className="signin-form" onSubmit={add}>
                  <input className="field" autoFocus aria-label="Your name" placeholder="First and last name" value={name} onChange={(e) => setName(e.target.value)} />
                  <button className="btn btn-primary" disabled={!name.trim()}>
                    Join
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 id="signin-h">Who&apos;s checking in?</h2>
                <p className="sub">Tap your name. This device will remember you.</p>
                <PeopleGrid people={people} onPick={(p) => setCurrentPerson(p.id)} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PeopleGrid({ people, onPick }: { people: Person[]; onPick: (p: Person) => void }) {
  return (
    <div className="people-grid">
      {people.map((p) => (
        <button key={p.id} type="button" className="person-tile" onClick={() => onPick(p)}>
          <Blob id={p.id} pose={p.role === "lead" ? "wave" : "idle"} size={72} />
          <b>{p.name}</b>
          <span className="label" style={p.role === "member" ? { visibility: "hidden" } : undefined}>
            {p.role === "admin" ? "Admin" : "Design lead"}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Tap your name, then enter the 6-digit code sent to your work email. */
function CodeSignIn({ people }: { people: Person[] }) {
  const [who, setWho] = useState<Who | null>(null);
  const [masked, setMasked] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [wait, setWait] = useState(0);
  const codeField = useRef<HTMLInputElement>(null);

  // The field is disabled while the email goes out or a code is being checked; give focus back after.
  useEffect(() => {
    if (!busy) codeField.current?.focus();
  }, [busy]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const back = () => {
    setWho(null);
    setCode("");
    setError(null);
  };

  const send = async (target: Who) => {
    // Move to the code screen at once; the email takes a few seconds to go out.
    setWho(target);
    setMasked(null);
    setSending(true);
    setBusy(true);
    setError(null);
    const r = await requestCode(target);
    setBusy(false);
    setSending(false);
    if (r.error) {
      setWho(null);
      return setError(r.error);
    }
    setMasked(r.masked ?? null);
    setCode("");
    setWait(60);
  };

  const check = async (value: string) => {
    if (!who || busy) return;
    setBusy(true);
    setError(null);
    const problem = await verifyCode(who, value);
    // On success the page reloads into the board, so only a failure comes back here.
    if (problem) {
      setError(problem);
      setCode("");
      setBusy(false);
    }
  };

  if (who) {
    const person = people.find((p) => p.id === who.personId);
    return (
      <>
        <button type="button" className="signin-back" onClick={back}>
          <ArrowLeft /> Back
        </button>
        <h2 id="signin-h">Check your email</h2>
        <p className="sub">
          {sending ? (
            <>{person && <b>{person.name}, </b>}sending a 6-digit code to your work email…</>
          ) : (
            <>{person && <b>{person.name}, </b>}we sent a 6-digit code to {masked ? <b>{masked}</b> : "your work email"}.</>
          )}
        </p>
        <form
          className="signin-form"
          onSubmit={(e) => {
            e.preventDefault();
            void check(code);
          }}
        >
          <input
            ref={codeField}
            className="field code-input"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-label="6-digit code"
            placeholder="······"
            value={code}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              if (v.length === 6) void check(v);
            }}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary" disabled={busy || code.length !== 6}>
            {sending ? "Sending code…" : busy ? "Checking…" : "Sign in"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy || wait > 0} onClick={() => void send(who)}>
            {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <h2 id="signin-h">Who&apos;s checking in?</h2>
      <p className="sub">Tap your name. We&apos;ll email you a 6-digit code.</p>
      <PeopleGrid people={people} onPick={(p) => void send({ personId: p.id })} />
      {error && (
        <p className="field-error" role="alert" style={{ textAlign: "center" }}>
          {error}
        </p>
      )}
    </>
  );
}
