import { clients, findPerson, mask, NOT_SET_UP, reply, sendCode } from "@/lib/server/otp";

/** Tap a name: send a 6-digit code to that person's email on file. */
export async function POST(request: Request) {
  const c = clients();
  if (!c) return NOT_SET_UP();
  const body = await request.json().catch(() => ({}));
  const person = await findPerson(c.admin, body.personId);
  if (!person) return reply({ error: "That name isn't on the list. Ask your design lead." }, 404);

  const error = await sendCode(c, person.email);
  if (error) {
    const wait = error.status === 429 || /rate|seconds/i.test(error.message);
    return reply({ error: wait ? "A code was just sent. Please wait a minute before asking for another." : "Couldn't send the code. Try again in a moment." }, wait ? 429 : 502);
  }
  return reply({ ok: true, masked: mask(person.email) });
}
