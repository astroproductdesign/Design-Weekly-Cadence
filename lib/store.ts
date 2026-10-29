"use client";

import { create } from "zustand";
import { createDemoBackend } from "./backend/demo";
import { createSupabaseBackend } from "./backend/supabase";
import type { AuthApi, Backend, Change } from "./backend/types";
import { currentSprintNumber, makeSprint, WEEKS_AHEAD } from "./sprint";
import { setUI, useUI } from "./ui-store";
import { emptyDB, type DB, type Person, type TableName, type Tables } from "./types";

const PERSON_KEY = "cadence-person";

const AUDITED = new Set<TableName>(["people", "projects", "tasks", "updates", "important_dates", "action_items"]);

type State = {
  ready: boolean;
  loadError: string | null;
  mode: Backend["mode"] | null;
  /** Email sign-in is on (the person comes from the session, not a tapped name). */
  authOn: boolean;
  /** Sign-in is on and this device has no session yet: show the sign-in screen. */
  needsLogin: boolean;
  db: DB;
  /** Sprint number the user is browsing on This Week (null = current). */
  viewSprint: number | null;
  currentPersonId: string | null;
  pendingWrites: number;
  lastSavedAt: number | null;
  saveError: string | null;
  /** Live link to everyone else's changes. */
  connection: "connecting" | "live" | "offline";
};

let backend: Backend | null = null;
let unsubscribe: (() => void) | null = null;

export const useStore = create<State>(() => ({
  ready: false,
  loadError: null,
  mode: null,
  authOn: false,
  needsLogin: false,
  db: emptyDB(),
  viewSprint: null,
  currentPersonId: null,
  pendingWrites: 0,
  lastSavedAt: null,
  saveError: null,
  connection: "connecting",
}));

const set = useStore.setState;
const get = useStore.getState;

function applyChange(change: Change) {
  set((s) => {
    const table = { ...s.db[change.table] } as Record<string, unknown>;
    if (change.type === "upsert") table[(change.row as { id: string }).id] = change.row;
    else delete table[change.id];
    return { db: { ...s.db, [change.table]: table } };
  });
}

// Rows with a save still in flight. Their local copy is the truth until the
// save lands, so live echoes and reloads can't roll them back.
const pending = new Map<string, number>();
const key = (table: TableName, id: string) => `${table}:${id}`;

type Stamped = { id: string; updated_at?: string; updated_by?: string | null };

/**
 * A change made somewhere else (another person, another tab). Everyone's
 * edits apply as they arrive; the only thing skipped is a late echo of my own
 * older save, which would briefly undo a newer one.
 */
function applyRemote(change: Change) {
  const id = change.type === "upsert" ? (change.row as Stamped).id : change.id;
  if (pending.has(key(change.table, id))) return;
  const local = get().db[change.table][id] as Stamped | undefined;
  if (change.type === "upsert") {
    const row = change.row as Stamped;
    const me = getCurrentPersonId();
    if (local?.updated_at && row.updated_at && row.updated_by === me && local.updated_by === me && Date.parse(row.updated_at) < Date.parse(local.updated_at)) return;
    // Someone else's new card: give it a little pop as it lands.
    if (!local && change.table === "updates" && row.updated_by !== me) flash(id);
  }
  applyChange(change);
}

function flash(id: string) {
  setUI({ arrived: { ...useUI.getState().arrived, [id]: true } });
  setTimeout(() => {
    const rest = { ...useUI.getState().arrived };
    delete rest[id];
    setUI({ arrived: rest });
  }, 1600);
}

/** Reload everything (after a dropped connection or a failed save), keeping saves still in flight. */
async function resync() {
  if (!backend) return;
  try {
    const fresh = await backend.loadAll();
    const local = get().db;
    for (const k of pending.keys()) {
      const [table, id] = k.split(":") as [TableName, string];
      const rows = fresh[table] as Record<string, unknown>;
      const mine = (local[table] as Record<string, unknown>)[id];
      if (mine) rows[id] = mine;
      else delete rows[id];
    }
    if (await removedFromTeam(fresh)) return;
    set({ db: fresh, saveError: null });
  } catch {
    // Still offline; the next reconnect tries again.
  }
}

function pickBackend(): Backend {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === "true";
  return url && key ? createSupabaseBackend(url, key, requireLogin) : createDemoBackend();
}

/** The sign-in calls, when email sign-in is on. */
export function getAuth(): AuthApi | undefined {
  return backend?.auth;
}

/**
 * Signed in, but no longer on the team (removed in Settings): the database now
 * shows them nothing. Sign them out so they land on the sign-in screen.
 */
async function removedFromTeam(db: DB): Promise<boolean> {
  const me = get().currentPersonId;
  if (!backend?.auth || !me || db.people[me]?.active) return false;
  await backend.auth.signOut();
  location.reload();
  return true;
}

/** Make sure every week up to two ahead exists. No cron needed. */
async function ensureSprints(db: DB) {
  const current = currentSprintNumber();
  const numbers = Object.values(db.sprints).map((s) => s.number);
  const latest = numbers.length ? Math.max(...numbers) : current - 1;
  for (let n = Math.max(latest + 1, current - 52); n <= current + WEEKS_AHEAD; n++) {
    const sprint = makeSprint(n);
    applyChange({ table: "sprints", type: "upsert", row: sprint });
    await backend!.upsert("sprints", sprint, { ignoreDuplicates: true });
  }
}

export async function initStore() {
  if (backend) return;
  backend = pickBackend();
  let personId: string | null = null;
  try {
    personId = localStorage.getItem(PERSON_KEY);
  } catch {}
  set({ mode: backend.mode, authOn: !!backend.auth, currentPersonId: personId });
  try {
    if (backend.auth) {
      // With sign-in on, who you are comes from the session, never from a saved name.
      personId = await backend.auth.currentPerson();
      set({ currentPersonId: personId });
      if (!personId) {
        // Before signing in, the database only shares names, roles and colours.
        const db = emptyDB();
        const t = new Date().toISOString();
        (await backend.auth.loginPeople()).forEach((p, i) => {
          db.people[p.id] = { id: p.id, name: p.name, role: p.role as Person["role"], blob_color: p.blob_color as Person["blob_color"], avatar_url: null, active: true, sort_order: i, created_at: t, updated_at: t, created_by: null, updated_by: null };
        });
        set({ db, needsLogin: true, ready: true });
        return;
      }
    }
    const db = await backend.loadAll();
    if (await removedFromTeam(db)) return;
    set({ db });
    let wasLive = false;
    unsubscribe = backend.subscribe(applyRemote, (status) => {
      set({ connection: status });
      // Back after a drop: fetch whatever changed while we weren't listening.
      if (status === "live" && wasLive) void resync();
      if (status === "live") wasLive = true;
    });
    await ensureSprints(db);
    set({ ready: true });
    let hiddenAt = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30_000) void resync();
    });
    addEventListener("online", () => void resync());
  } catch (e) {
    set({ loadError: e instanceof Error ? e.message : String(e) });
  }
}

export function teardownStore() {
  unsubscribe?.();
  unsubscribe = null;
  backend = null;
}

// Identity -------------------------------------------------------------------

/** The one place that knows who "I" am. Swap this for real sign-in later. */
export function getCurrentPersonId(): string | null {
  return get().currentPersonId;
}

/** Sign out. With sign-in on this ends the session; otherwise it just forgets the saved name. */
export async function signOut() {
  if (backend?.auth) {
    await backend.auth.signOut();
    location.reload();
  } else setCurrentPerson(null);
}

export function setCurrentPerson(id: string | null) {
  try {
    if (id) localStorage.setItem(PERSON_KEY, id);
    else localStorage.removeItem(PERSON_KEY);
  } catch {}
  set({ currentPersonId: id });
}

export function setViewSprint(n: number | null) {
  set({ viewSprint: n });
}

// Writes ---------------------------------------------------------------------

async function track(table: TableName, id: string, work: () => Promise<void>) {
  const k = key(table, id);
  pending.set(k, (pending.get(k) ?? 0) + 1);
  set((s) => ({ pendingWrites: s.pendingWrites + 1, saveError: null }));
  const done = () => {
    const left = (pending.get(k) ?? 1) - 1;
    if (left > 0) pending.set(k, left);
    else pending.delete(k);
  };
  try {
    await work();
    done();
    set((s) => ({ pendingWrites: s.pendingWrites - 1, lastSavedAt: Date.now() }));
  } catch (e) {
    done();
    set((s) => ({
      pendingWrites: s.pendingWrites - 1,
      saveError: e instanceof Error ? e.message : "Couldn't save",
    }));
    // Show what's really saved rather than a change that didn't stick.
    setTimeout(() => void resync(), 1500);
  }
}

type NewRow<T extends TableName> = Omit<Tables[T], "created_at" | "updated_at" | "created_by" | "updated_by"> &
  Partial<Pick<Tables[T] & { created_at: string }, "created_at">>;

export function newId(): string {
  return crypto.randomUUID();
}

/**
 * The same uuid for the same inputs on every device. Used where two people
 * might do the same thing at once (like carrying a card into this week), so
 * both saves land on one row instead of making a duplicate.
 */
export function stableId(...parts: (string | number)[]): string {
  const text = parts.join("|");
  let hex = "";
  for (let seed = 0; seed < 4; seed++) {
    let h = 0x811c9dc5 ^ seed;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    hex += (h >>> 0).toString(16).padStart(8, "0");
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Insert a row. Audit fields (who/when) are filled in automatically. */
export function insertRow<T extends TableName>(table: T, row: NewRow<T>): Tables[T] {
  const now = new Date().toISOString();
  const me = getCurrentPersonId();
  const full = (
    AUDITED.has(table)
      ? { created_at: now, ...row, updated_at: now, created_by: me, updated_by: me }
      : { created_at: now, ...row }
  ) as Tables[T];
  applyChange({ table, type: "upsert", row: full });
  void track(table, (full as { id: string }).id, () => backend!.upsert(table, full));
  return full;
}

/** Update fields on a row; records who changed it and when. */
export function patchRow<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>) {
  const existing = get().db[table][id];
  if (!existing) return;
  const stamped: Partial<Tables[T]> =
    AUDITED.has(table) || table === "settings"
      ? { ...patch, updated_at: new Date().toISOString(), updated_by: getCurrentPersonId() }
      : patch;
  applyChange({ table, type: "upsert", row: { ...existing, ...stamped } as Tables[T] });
  // Only the changed fields are sent, so two people editing different parts
  // of the same row don't overwrite each other.
  void track(table, id, () => backend!.update(table, id, stamped));
}

export function deleteRow(table: TableName, id: string) {
  applyChange({ table, type: "delete", id });
  void track(table, id, () => backend!.remove(table, id));
}

/** Put back an exact row (used by Undo after a delete). */
export function restoreRow<T extends TableName>(table: T, row: Tables[T]) {
  applyChange({ table, type: "upsert", row });
  void track(table, (row as { id: string }).id, () => backend!.upsert(table, row));
}

/** Put back just these fields as they were (Undo after an edit or move), leaving anyone else's later edits alone. */
export function revertFields<T extends TableName>(table: T, before: Tables[T], fields: (keyof Tables[T])[]) {
  const patch: Partial<Tables[T]> = {};
  for (const f of fields) patch[f] = before[f];
  patchRow(table, (before as { id: string }).id, patch);
}

/** Insert-or-replace for key/value settings. */
export function saveSetting(id: string, value: unknown) {
  const row = { id, value, updated_at: new Date().toISOString(), updated_by: getCurrentPersonId() };
  applyChange({ table: "settings", type: "upsert", row });
  void track("settings", id, () => backend!.upsert("settings", row));
}
