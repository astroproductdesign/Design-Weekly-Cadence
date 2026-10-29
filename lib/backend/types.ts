import type { DB, TableName, Tables } from "../types";

export type Change =
  | { table: TableName; type: "upsert"; row: Tables[TableName] }
  | { table: TableName; type: "delete"; id: string };

/** What the sign-in screen may know about a person before they sign in. */
export type LoginPerson = { id: string; name: string; role: string; blob_color: string | null };

/** Present only when email sign-in is switched on. */
export interface AuthApi {
  /** The person this device is signed in as, or null. */
  currentPerson(): Promise<string | null>;
  loginPeople(): Promise<LoginPerson[]>;
  useSession(access: string, refresh: string): Promise<void>;
  accessToken(): Promise<string | null>;
  signOut(): Promise<void>;
}

/**
 * Everything the app needs from storage. Kept deliberately tiny so the
 * Supabase and in-browser demo implementations can't drift apart.
 */
export interface Backend {
  mode: "supabase" | "demo";
  auth?: AuthApi;
  loadAll(): Promise<DB>;
  upsert<T extends TableName>(table: T, row: Tables[T], opts?: { ignoreDuplicates?: boolean }): Promise<void>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  /** Changes made by anyone else (other people, other tabs), plus whether the live link is up. */
  subscribe(onChange: (change: Change) => void, onStatus: (status: "live" | "offline") => void): () => void;
}
