"use client";

import { getAuth } from "./store";

type Reply = { ok?: boolean; error?: string; masked?: string | null; access_token?: string; refresh_token?: string };

async function post(path: string, body: unknown, bearer?: string | null): Promise<Reply> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Reply;
    return res.ok ? data : { error: data.error || "Something went wrong. Try again." };
  } catch {
    return { error: "Can't reach the server. Check your connection and try again." };
  }
}

/** Who is signing in: a tapped name. */
export type Who = { personId: string };

/** Ask for a 6-digit code. `masked` is how to show where it went. */
export const requestCode = (who: Who) => post("/api/auth/request", who);

/** Check the code, keep the session on this device and reload into the board. */
export async function verifyCode(who: Who, code: string): Promise<string | null> {
  const r = await post("/api/auth/verify", { ...who, code });
  return finish(r);
}

async function finish(r: Reply): Promise<string | null> {
  if (r.error || !r.access_token || !r.refresh_token) return r.error || "That didn't work. Try again.";
  try {
    await getAuth()?.useSession(r.access_token, r.refresh_token);
  } catch (e) {
    return e instanceof Error ? e.message : "Couldn't sign in. Try again.";
  }
  location.reload();
  return null;
}
