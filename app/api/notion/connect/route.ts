import { clients, NOT_SET_UP, reply } from "@/lib/server/otp";
import { authorizeUrl, caller, canManage, makeState, notionConfig, NOTION_NOT_SET_UP, removeConnection } from "@/lib/server/notion";

const notAllowed = () => reply({ error: "Only the design lead or an admin can connect Notion." }, 403);

/** Start connecting: hands back the Notion page where the admin picks the leave calendar. */
export async function POST(request: Request) {
  const c = clients();
  if (!c) return NOT_SET_UP();
  const cfg = notionConfig();
  if (!cfg) return NOTION_NOT_SET_UP();
  const me = await caller(request, c.admin);
  if (!canManage(me)) return notAllowed();
  const redirect = new URL("/api/notion/callback", request.url).toString();
  return reply({ url: authorizeUrl(cfg.clientId, redirect, makeState(me!.id)) });
}

/** Disconnect: forget the stored Notion keys. */
export async function DELETE(request: Request) {
  const c = clients();
  if (!c) return NOT_SET_UP();
  if (!canManage(await caller(request, c.admin))) return notAllowed();
  return (await removeConnection(c.admin)) ? reply({ ok: true }) : reply({ error: "Couldn't disconnect. Try again." }, 500);
}
