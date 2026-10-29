import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { emptyDB, TABLES, type TableName, type Tables } from "../types";
import type { Backend, Change, LoginPerson } from "./types";

export function createSupabaseBackend(url: string, anonKey: string, requireLogin = false): Backend {
  const client: SupabaseClient = createClient(url, anonKey, {
    // With sign-in on, the session is kept on the device so people aren't asked for a code every visit.
    auth: { persistSession: requireLogin, autoRefreshToken: requireLogin },
    realtime: { params: { eventsPerSecond: 20 } },
  });

  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  return {
    mode: "supabase",

    auth: requireLogin
      ? {
          async currentPerson() {
            const { data } = await client.auth.getSession();
            if (!data.session) return null;
            const { data: id, error } = await client.rpc("current_person");
            return error ? null : ((id as string | null) ?? null);
          },
          async loginPeople() {
            const { data, error } = await client.rpc("login_people");
            fail("Loading names", error);
            return (data ?? []) as LoginPerson[];
          },
          async useSession(access, refresh) {
            const { error } = await client.auth.setSession({ access_token: access, refresh_token: refresh });
            fail("Signing in", error);
          },
          async accessToken() {
            const { data } = await client.auth.getSession();
            return data.session?.access_token ?? null;
          },
          async signOut() {
            await client.auth.signOut();
          },
        }
      : undefined,

    async loadAll() {
      const db = emptyDB();
      await Promise.all(
        TABLES.map(async (table) => {
          // Page through in case a table grows past the default 1000-row limit.
          const pageSize = 1000;
          for (let from = 0; ; from += pageSize) {
            const { data, error } = await client
              .from(table)
              .select("*")
              .range(from, from + pageSize - 1);
            fail(`Loading ${table}`, error);
            for (const row of data ?? []) (db[table] as Record<string, unknown>)[row.id] = row;
            if (!data || data.length < pageSize) break;
          }
        }),
      );
      return db;
    },

    async upsert<T extends TableName>(table: T, row: Tables[T], opts?: { ignoreDuplicates?: boolean }) {
      const { error } = await client
        .from(table)
        .upsert(row as never, { ignoreDuplicates: opts?.ignoreDuplicates ?? false });
      fail(`Saving ${table}`, error);
    },

    async update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>) {
      const { error } = await client.from(table).update(patch as never).eq("id", id);
      fail(`Saving ${table}`, error);
    },

    async remove(table: TableName, id: string) {
      const { error } = await client.from(table).delete().eq("id", id);
      fail(`Deleting from ${table}`, error);
    },

    subscribe(onChange: (change: Change) => void, onStatus: (status: "live" | "offline") => void) {
      const channel = client.channel("cadence-all");
      for (const table of TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) onChange({ table, type: "delete", id });
          } else {
            onChange({ table, type: "upsert", row: payload.new as Tables[TableName] });
          }
        });
      }
      // Supabase reconnects on its own; each time it's back we hear SUBSCRIBED.
      channel.subscribe((status) => onStatus(status === "SUBSCRIBED" ? "live" : "offline"));
      return () => {
        client.removeChannel(channel);
      };
    },
  };
}
