import type { DB, TableName, Tables } from "../types";

export type Change =
  | { table: TableName; type: "upsert"; row: Tables[TableName] }
  | { table: TableName; type: "delete"; id: string };

/**
 * Everything the app needs from storage. Kept deliberately tiny so the
 * Supabase and in-browser demo implementations can't drift apart.
 */
export interface Backend {
  mode: "supabase" | "demo";
  loadAll(): Promise<DB>;
  upsert<T extends TableName>(table: T, row: Tables[T], opts?: { ignoreDuplicates?: boolean }): Promise<void>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  /** Changes made by anyone else (other people, other tabs), plus whether the live link is up. */
  subscribe(onChange: (change: Change) => void, onStatus: (status: "live" | "offline") => void): () => void;
}
