// Demo mode: used when no Supabase keys are configured. Data lives in this
// browser's localStorage and syncs live between tabs on the same device, so
// the app can be tried (and Present mode rehearsed) with zero setup.

import { buildSeed } from "../seed-data";
import type { DB, TableName, Tables } from "../types";
import type { Backend, Change } from "./types";

const KEY = "cadence-demo-db-v7";

function read(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DB;
  } catch {
    // fall through to a fresh seed
  }
  const db = buildSeed();
  write(db);
  return db;
}

function write(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // storage full or blocked: the session still works in memory
  }
}

export function resetDemoData() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function createDemoBackend(): Backend {
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("cadence-demo") : null;
  let db: DB | null = null;
  const current = () => (db ??= read());

  const commit = (change: Change) => {
    const d = current();
    const table = d[change.table] as Record<string, unknown>;
    if (change.type === "upsert") table[(change.row as { id: string }).id] = change.row;
    else delete table[change.id];
    write(d);
    channel?.postMessage(change);
  };

  return {
    mode: "demo",
    async loadAll() {
      db = read();
      return structuredClone(db);
    },
    async upsert<T extends TableName>(table: T, row: Tables[T], opts?: { ignoreDuplicates?: boolean }) {
      if (opts?.ignoreDuplicates && current()[table][(row as { id: string }).id]) return;
      commit({ table, type: "upsert", row });
    },
    async update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>) {
      const existing = current()[table][id];
      if (!existing) return;
      commit({ table, type: "upsert", row: { ...existing, ...patch } as Tables[T] });
    },
    async remove(table: TableName, id: string) {
      commit({ table, type: "delete", id });
    },
    subscribe(onChange, onStatus) {
      onStatus("live");
      if (!channel) return () => {};
      const handler = (e: MessageEvent<Change>) => {
        // Another tab wrote it; keep our cached copy in step.
        const d = current();
        const table = d[e.data.table] as Record<string, unknown>;
        if (e.data.type === "upsert") table[(e.data.row as { id: string }).id] = e.data.row;
        else delete table[e.data.id];
        onChange(e.data);
      };
      channel.addEventListener("message", handler);
      return () => channel.removeEventListener("message", handler);
    },
  };
}
