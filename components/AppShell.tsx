"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { CalendarPlus, Clock, GearSix, X } from "@phosphor-icons/react";
import { currentSprintNumber, dayMs, sprintRangeLabel, todayKL, weekLabel } from "@/lib/sprint";
import { initStore, useStore } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui-store";
import { MeMenu } from "./MeMenu";
import { Settings } from "./Settings";
import { Toaster } from "./Toaster";
import { goToWeek, WeekNav } from "./WeekNav";
import { WhoAreYou } from "./WhoAreYou";
import { cx } from "./ui";

export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="2" y="2" width="13" height="13" rx="4" fill="var(--primary)" />
      <rect x="18" y="3" width="11" height="11" rx="3.5" fill="none" stroke="var(--primary)" strokeWidth="2" />
      <rect x="3" y="18" width="11" height="11" rx="3.5" fill="none" stroke="var(--primary)" strokeWidth="2" />
      <rect x="17" y="17" width="13" height="13" rx="4" fill="var(--primary)" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const ready = useStore((s) => s.ready);
  const loadError = useStore((s) => s.loadError);
  const mode = useStore((s) => s.mode);
  const me = useStore((s) => (s.currentPersonId ? s.db.people[s.currentPersonId] : null));
  const connection = useStore((s) => s.connection);
  const saving = useStore((s) => s.pendingWrites > 0);
  const saveError = useStore((s) => s.saveError);
  const viewSprint = useStore((s) => s.viewSprint);
  const settingsOpen = useUI((s) => s.settings);
  const [tueDismissed, setTueDismissed] = useState(false);
  // False during server render and hydration, true afterwards.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    void initStore();
  }, []);

  if (!mounted || (!ready && !loadError)) {
    return (
      <div className="center-screen">
        <div className="loading">
          <BrandMark size={28} /> Loading the board…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="center-screen">
        <div className="error-box">
          <BrandMark size={32} />
          <h1>Can&apos;t reach the database</h1>
          <p className="meta" style={{ fontSize: 14, lineHeight: "20px" }}>
            Check your internet connection and refresh. If this is a new setup, make sure supabase/schema.sql has been run (see the README).
          </p>
          <pre>{loadError}</pre>
        </div>
      </div>
    );
  }

  if (!me || !me.active) {
    return (
      <>
        <WhoAreYou />
        <Toaster />
      </>
    );
  }

  const current = currentSprintNumber();
  const n = viewSprint ?? current;
  // Settings are for the design lead and admins. (A tidy-up gate, not security: there are no accounts.)
  // Tuesday is the meeting day: the board already opens on the week that starts tomorrow.
  const isCheckInDay = new Date(dayMs(todayKL())).getUTCDay() === 2;
  const canManage = me.role === "lead" || me.role === "admin";
  const status = saveError
    ? { cls: "bad", text: "Not saved", title: `${saveError}. Reloading what's saved…` }
    : connection === "offline"
      ? { cls: "warn", text: "Reconnecting…", title: "Lost the live link. Your changes are kept and will sync when it's back." }
      : saving
        ? { cls: "", text: "Saving…", title: "Saving your change" }
        : mode === "demo"
          ? { cls: "warn", text: "Demo mode", title: "No database connected: data stays in this browser and syncs live between its tabs. See the README to connect Supabase." }
          : { cls: "ok", text: "Live", title: "Everyone's changes appear here as they happen" };

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand">
            <BrandMark />
            <span>Design Cadence</span>
          </div>
          <WeekNav n={n} current={current} />
          <div className="topbar-actions">
            <span className={cx("live-pill", status.cls)} title={status.title} role="status">
              <i />
              <span className="hide-sm">{status.text}</span>
            </span>
            {canManage && (
              <button type="button" className="icon-btn" aria-label="Settings" title="Settings" onClick={() => setUI({ settings: true })}>
                <GearSix />
              </button>
            )}
            <MeMenu me={me} />
          </div>
        </div>
      </header>
      {n !== current && (
        <div className={cx("week-banner", n > current && "ahead")}>
          <div className="wrap">
            {n < current ? <Clock /> : <CalendarPlus />}
            {n < current
              ? `Looking back at ${weekLabel(n)} (${sprintRangeLabel(n)}). Cards are read-only here.`
              : `Planning ahead for ${weekLabel(n)} (${sprintRangeLabel(n)}). Add what you already know; it'll be waiting when the week starts.`}
            <button type="button" onClick={() => goToWeek(current, current)}>
              Back to this week
            </button>
          </div>
        </div>
      )}
      {n === current && isCheckInDay && !tueDismissed && (
        <div className="week-banner ahead">
          <div className="wrap">
            <CalendarPlus />
            It&apos;s check-in day, so the board has moved on to {weekLabel(current)} ({sprintRangeLabel(current)}).
            <button type="button" onClick={() => goToWeek(current - 1, current)}>
              See {weekLabel(current - 1)}
            </button>
            <button type="button" className="banner-x" aria-label="Dismiss" onClick={() => setTueDismissed(true)}>
              <X />
            </button>
          </div>
        </div>
      )}
      {children}
      {settingsOpen && canManage && <Settings />}
      <Toaster />
    </>
  );
}
