// Server-only helpers for email sign-in codes. The browser never sees anyone's
// email: it only sends a person's id (or typed email) and a 6-digit code, and
// these routes do the lookups with the service key.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Person = { id: string; name: string; email: string; auth_user_id: string | null };

export function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function clients(): { admin: SupabaseClient; anon: SupabaseClient } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return null;
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  return { admin: createClient(url, service, opts), anon: createClient(url, anon, opts) };
}

export const NOT_SET_UP = () => reply({ error: "Sign-in isn't set up on the server yet." }, 503);

export const cleanCode = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");

/** "e*****@astro.com.my": enough to recognise your own inbox, not enough to learn anyone's address. */
export function mask(email: string) {
  const [user, host] = email.split("@");
  return `${user[0]}*****@${host}`;
}

/** The active person for a tapped name, or null. */
export async function findPerson(admin: SupabaseClient, personId: unknown): Promise<Person | null> {
  if (typeof personId !== "string") return null;
  const { data } = await admin.from("people").select("id, name, email, auth_user_id").eq("active", true).not("email", "is", null).eq("id", personId).maybeSingle();
  return (data as Person | null) ?? null;
}

/** Send a 6-digit code to the address (creating its sign-in account first, already confirmed). */
export async function sendCode({ admin, anon }: { admin: SupabaseClient; anon: SupabaseClient }, email: string) {
  // "Already registered" is expected after the first time, so the error is ignored.
  await admin.auth.admin.createUser({ email, email_confirm: true });
  const { error } = await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  return error;
}

/** Check a code. Returns the session (tokens and account id) or null. */
export async function checkCode(anon: SupabaseClient, email: string, code: string) {
  if (code.length !== 6) return null;
  const { data, error } = await anon.auth.verifyOtp({ email, token: code, type: "email" });
  return error || !data.session || !data.user ? null : { session: data.session, userId: data.user.id };
}

export const tokens = (s: { access_token: string; refresh_token: string }) => ({ access_token: s.access_token, refresh_token: s.refresh_token });
