import { checkCode, cleanCode, clients, findPerson, NOT_SET_UP, reply, tokens } from "@/lib/server/otp";

/** Check the 6-digit code and hand back a session. */
export async function POST(request: Request) {
  const c = clients();
  if (!c) return NOT_SET_UP();
  const body = await request.json().catch(() => ({}));
  const person = await findPerson(c.admin, body.personId);
  const bad = () => reply({ error: "That code didn't work. Check it and try again, or ask for a new one." }, 401);
  if (!person) return bad();

  const ok = await checkCode(c.anon, person.email, cleanCode(body.code));
  if (!ok) return bad();

  // Link this sign-in account to the person (first time, or after their email changed).
  if (person.auth_user_id !== ok.userId) {
    const { error } = await c.admin.from("people").update({ auth_user_id: ok.userId }).eq("id", person.id);
    if (error) return reply({ error: "Couldn't finish signing in. Try again." }, 500);
  }
  return reply({ ok: true, ...tokens(ok.session) });
}
