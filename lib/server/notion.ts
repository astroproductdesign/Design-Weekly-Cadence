// Server-only: the Notion connection behind "Weekly Schedule". The keys Notion
// hands back live in the notion_connection table, which only the service key
// can read; the browser only ever gets the calendar entries.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "../types";
import { addDays } from "../sprint";
import { reply } from "./otp";

const API = "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";

export type CalendarEntry = { id: string; title: string; icon: string | null; start: string; end: string };

export function notionConfig() {
  const clientId = process.env.NOTION_CLIENT_ID;
  const secret = process.env.NOTION_CLIENT_SECRET;
  const calendarId = process.env.NOTION_CALENDAR_ID?.replace(/-/g, "");
  if (!clientId || !secret || !calendarId) return null;
  return { clientId, secret, calendarId, calendarUrl: `https://www.notion.so/${calendarId}` };
}

export const NOTION_NOT_SET_UP = () => reply({ error: "Notion isn't set up on the server yet." }, 503);

export const loginRequired = () => process.env.NEXT_PUBLIC_REQUIRE_LOGIN === "true";

/** The signed-in person making the request (from the "Authorization: Bearer" session token), or null. */
export async function caller(request: Request, admin: SupabaseClient): Promise<{ id: string; role: Role } | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;
  const { data: person } = await admin.from("people").select("id, role").eq("auth_user_id", data.user.id).eq("active", true).maybeSingle();
  return (person as { id: string; role: Role } | null) ?? null;
}

export const canManage = (p: { role: Role } | null) => !!p && (p.role === "lead" || p.role === "admin");

// --- Connect: a signed, short-lived "state" ties Notion's redirect back to the admin who started it.

const stateKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const sign = (s: string) => createHmac("sha256", stateKey()).update(`notion:${s}`).digest("base64url");

export function makeState(personId: string) {
  const body = Buffer.from(JSON.stringify({ p: personId, x: Date.now() + 10 * 60_000, n: randomBytes(8).toString("hex") })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readState(state: string | null): string | null {
  const [body, sig] = (state ?? "").split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { p, x } = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof p === "string" && Date.now() < x ? p : null;
  } catch {
    return null;
  }
}

export function authorizeUrl(clientId: string, redirectUri: string, state: string) {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", owner: "user", state });
  return `${API}/oauth/authorize?${q}`;
}

type Tokens = { access_token: string; refresh_token?: string | null; bot_id?: string; workspace_id?: string; workspace_name?: string };

async function tokenRequest(body: Record<string, string>): Promise<Tokens | null> {
  const cfg = notionConfig();
  if (!cfg) return null;
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return res.ok ? ((await res.json()) as Tokens) : null;
}

export const exchangeCode = (code: string, redirectUri: string) => tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });

export async function saveConnection(admin: SupabaseClient, t: Tokens, personId: string | null) {
  const row = { id: 1, access_token: t.access_token, refresh_token: t.refresh_token ?? null, bot_id: t.bot_id ?? null, workspace_id: t.workspace_id ?? null, workspace_name: t.workspace_name ?? null, connected_by: personId, connected_at: new Date().toISOString() };
  const { error } = await admin.from("notion_connection").upsert(row);
  cache.clear();
  return !error;
}

export async function removeConnection(admin: SupabaseClient) {
  cache.clear();
  schema = null;
  const { error } = await admin.from("notion_connection").delete().eq("id", 1);
  return !error;
}

async function loadConnection(admin: SupabaseClient) {
  const { data } = await admin.from("notion_connection").select("access_token, refresh_token").eq("id", 1).maybeSingle();
  return (data as { access_token: string; refresh_token: string | null } | null) ?? null;
}

/** A Notion API call with the stored keys. An expired key is swapped for a fresh one once. */
async function notion(admin: SupabaseClient, path: string, init?: { method?: string; body?: unknown }): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const conn = await loadConnection(admin);
  if (!conn) return { ok: false, status: 0, data: {} };
  const call = (token: string) =>
    fetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  let res = await call(conn.access_token);
  if (res.status === 401 && conn.refresh_token) {
    const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: conn.refresh_token });
    if (fresh) {
      const { connected_by } = ((await admin.from("notion_connection").select("connected_by").eq("id", 1).maybeSingle()).data ?? {}) as { connected_by?: string };
      await saveConnection(admin, fresh, connected_by ?? null);
      res = await call(fresh.access_token);
    }
  }
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

// --- Reading the calendar

type Schema = { source: string; title: string; date: string };
let schema: Schema | null = null;

/** Find the calendar's data source and its title and date fields (whatever they're called). */
async function calendarSchema(admin: SupabaseClient, calendarId: string): Promise<Schema | { error: string }> {
  if (schema) return schema;
  const db = await notion(admin, `/databases/${calendarId}`);
  if (!db.ok) return { error: db.status === 404 || db.status === 403 ? "no-access" : "notion" };
  const sources = (db.data.data_sources as { id: string }[] | undefined) ?? [];
  if (!sources.length) return { error: "notion" };
  const ds = await notion(admin, `/data_sources/${sources[0].id}`);
  if (!ds.ok) return { error: "notion" };
  const props = Object.entries((ds.data.properties as Record<string, { type: string }>) ?? {});
  const title = props.find(([, p]) => p.type === "title")?.[0];
  // The calendar's own date field is usually "Date"; this one also has "Start Time" and "End Time", which aren't it.
  const dates = props.filter(([, p]) => p.type === "date").map(([k]) => k);
  const date = dates.find((k) => k.toLowerCase() === "date") ?? dates.find((k) => !/start|end|time/i.test(k)) ?? dates[0];
  if (!title || !date) return { error: "fields" };
  schema = { source: sources[0].id, title, date };
  return schema;
}

/** Whether the stored connection can see the leave calendar. */
export async function canSeeCalendar(admin: SupabaseClient) {
  const cfg = notionConfig();
  if (!cfg) return false;
  schema = null;
  return !("error" in (await calendarSchema(admin, cfg.calendarId)));
}

const LEADING_EMOJI = /^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*)\s*/u;

const cache = new Map<string, { at: number; entries: CalendarEntry[] }>();
const FRESH_MS = 5 * 60_000;

type Page = { id: string; url: string; icon?: { type: string; emoji?: string } | null; properties: Record<string, { title?: { plain_text: string }[]; date?: { start: string; end: string | null } | null }> };

/** Entries that touch from..to (inclusive), or why they couldn't be read. */
export async function calendarEntries(admin: SupabaseClient, from: string, to: string): Promise<{ entries: CalendarEntry[] } | { error: string }> {
  const cfg = notionConfig();
  if (!cfg) return { error: "not-set-up" };
  const key = `${from}|${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return { entries: hit.entries };

  const s = await calendarSchema(admin, cfg.calendarId);
  if ("error" in s) return s;
  // Long leave can start well before the week, so look back a couple of months and trim below.
  const filter = { and: [{ property: s.date, date: { on_or_before: to } }, { property: s.date, date: { on_or_after: addDays(from, -62) } }] };
  const entries: CalendarEntry[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion(admin, `/data_sources/${s.source}/query`, { method: "POST", body: { filter, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) } });
    if (!res.ok) {
      schema = null;
      return { error: res.status === 404 || res.status === 403 ? "no-access" : "notion" };
    }
    for (const page of (res.data.results as Page[]) ?? []) {
      const d = page.properties[s.date]?.date;
      if (!d?.start) continue;
      const start = d.start.slice(0, 10);
      const end = (d.end ?? d.start).slice(0, 10);
      if (end < from || start > to) continue;
      let title = (page.properties[s.title]?.title ?? []).map((t) => t.plain_text).join("").trim();
      let icon = page.icon?.type === "emoji" ? (page.icon.emoji ?? null) : null;
      // The team types the emoji into the name ("🏠 Ryann") rather than setting the page icon.
      const lead = title.match(LEADING_EMOJI);
      if (lead) {
        icon ??= lead[1];
        title = title.slice(lead[0].length).trim();
      }
      if (!title) continue;
      entries.push({ id: page.id, title, icon, start, end });
    }
    cursor = res.data.has_more ? (res.data.next_cursor as string) : undefined;
  } while (cursor);

  cache.set(key, { at: Date.now(), entries });
  return { entries };
}

export async function isConnected(admin: SupabaseClient) {
  return !!(await loadConnection(admin));
}
