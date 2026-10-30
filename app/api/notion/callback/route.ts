import { clients } from "@/lib/server/otp";
import { canSeeCalendar, exchangeCode, notionConfig, readState, removeConnection, saveConnection } from "@/lib/server/notion";

/** Notion sends the admin back here after they approve. Store the keys, then return to the board. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (result: string) => Response.redirect(new URL(`/?notion=${result}`, url), 303);

  const c = clients();
  if (!c || !notionConfig()) return back("error");
  if (url.searchParams.get("error")) return back("cancelled");
  const personId = readState(url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  if (!personId || !code) return back("error");

  // Re-check: the person who started this must still be the design lead or an admin.
  const { data: person } = await c.admin.from("people").select("role").eq("id", personId).eq("active", true).maybeSingle();
  if (!person || !["lead", "admin"].includes((person as { role: string }).role)) return back("error");

  const tokens = await exchangeCode(code, new URL("/api/notion/callback", url).toString());
  if (!tokens || !(await saveConnection(c.admin, tokens, personId))) return back("error");
  if (!(await canSeeCalendar(c.admin))) {
    await removeConnection(c.admin);
    return back("no-calendar");
  }
  return back("connected");
}
