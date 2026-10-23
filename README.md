# Design Cadence

The design team's weekly check-in board. It replaces the FigJam board where someone duplicated a page every week.

Everything is on one page:

- **The board**: one lane per project (sub-projects sit inside their parent), split into **Done** (last week), **Doing** (this week) and **Blocked**. Everyone's cards are visible; you add your own right where they belong.
- **Important dates/info**, **Open blockers** and **Action items** in the panel on the right. Fold it into a slim rail (the icon at its top) when you want more room for the board.
- **Present** for the Tuesday meeting, and **Settings** for projects and people.

> ⚠️ **Anyone with the link can see and edit everything.** There are no accounts or passwords. Share the link only inside the team (for example a pinned Slack message) and never post it publicly.

---

## How it works (for the team)

1. Open the link and tap your name (or **Add person** if you're new). The device remembers you. Tap your face in the top right to switch.
2. On any project, click **Add a card** under Done, Doing or Blocked. Type a line and press **Enter**; the form stays open for the next one. A task name, size (S/M/L) and due date are optional.
   - S = under a day, M = a few days, L = most of the week or more.
   - Sub-projects (like Astro › Boxless) have their own title row. Hover it to add a card there.
   - Hover a **task name** (the bold line above its cards) and click **Add card** to add another card to that same task.
3. **Drag cards** between columns, projects or tasks. Drop a card onto another task's name or cards to re-file it under that task. On a phone, drag by the dotted handle. Every move can be undone. To re-file your own card without dragging, open it and change its **Task**.
4. The first time you open the board each week, a **Last week check-in** asks how your unfinished cards went: **Done**, **Keep** for this week, or **Drop**. Closing it with **Later** is fine; the same cards sit in **Doing** marked "From Oct Week 3" with the same buttons.
5. Click a project's header to collapse or expand it. **Collapse all / Expand all** sits in the filter bar.
6. Filter by **Person**, **Project** or **Status** (overdue, due soon, stuck, from last sprint, blocked), or use **Only me** and the search box.
7. On Tuesday, open **Present** on the big screen. Arrow keys move between slides, **A** adds an action item, **Esc** closes.

Weeks run **Wednesday to Tuesday** and are named by month, like **Oct Week 4 (21–27 Oct)**. A week belongs to the month that holds most of its days, so 30 Sep – 6 Oct is Oct Week 1. A week opens on its Tuesday check-in day, so cards can be added before or during the meeting.

- The app always opens on **this week**.
- Use the Prev and Next buttons (or the ← → arrow keys) or the week picker in the top bar to look back. Click the month name in the picker to jump between months and years. Past weeks are read-only.
- You can **plan up to two weeks ahead**: add cards to next week or the week after, and they'll be waiting when that week starts.
- Nobody has to create anything: weeks are set up automatically. (Under the hood they're still numbered, with Sprint 86 = Oct Week 4 2026.)

---

## Setting it up (one time, about 15 minutes)

You need free accounts on [Supabase](https://supabase.com) (the database) and [Vercel](https://vercel.com) (hosting), plus [Node.js](https://nodejs.org) 20 or newer to run it on your computer.

### 1. Create the database

1. In Supabase, click **New project**. Pick a region close to the team (Singapore).
2. When it's ready, open **SQL Editor → New query**, paste everything from [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates the tables and turns on live updates.
3. Open **Project Settings → API** and copy the **Project URL**, the **anon public** key, and (for loading sample data once) the **service_role** key.

### 2. Add the keys

Copy `.env.example` to a new file called `.env.local` and fill it in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Run it on your computer

```bash
npm install
```

```bash
npm run seed
```

`npm run seed` loads the team, projects and the Sprint 86 cards migrated from FigJam. It's safe to run again. Skip it to start empty and add people and projects in Settings.

```bash
npm run dev
```

Then open http://localhost:3000.

**No Supabase yet?** Run `npm run dev` without a `.env.local`. The app starts in **demo mode** with the Sprint 86 data, kept in your browser only (other tabs on the same computer update live). Settings has a "Reset sample data" button.

### 4. Put it online (Vercel)

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project**, pick the repository, keep the defaults.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Click **Deploy** and share the link with the team.

---

## Good to know

- **Live updates**: everyone's changes appear as they happen (the dot in the top bar says **Live**). Cards are separate rows, and edits only send the fields that changed, so two people working at once don't overwrite each other's cards. If the connection drops, the app catches up as soon as it's back.
- **Who changed what**: every card records who added it and who last changed it (open a card to see).
- **Colour** only means something: green = done, blue = in progress, amber = needs attention, red = blocked or overdue. Each project's own colour fills its avatar and shows as a band on its title card; pick it in Settings.
- **Logos and photos** are shrunk to a small image and saved with the project or person, so there's no file storage to set up.
- **Important dates/info**: add a date (it shows until its day has passed, then drops off) or leave the date empty to add a note for the week you're viewing. Notes without a date stay in that week and aren't brought over to the next one. Past weeks show what was still ahead at the time.
- **Roles and Settings**: only the design lead (Ryann) and admins (Elaine and Tasha) see the Settings gear. Change someone's role in Settings → People. This keeps everyday users away from project and people management; it is not a security lock, because there are still no accounts and anyone with the link can edit the data.
- **Your colour**: click your face in the top right to pick your blob's colour, or to switch person.
- **Action items** can have several owners.
- **Ongoing projects**: pin a project in Settings (the pin icon) and it always has a lane on the board, even in a week with no cards. KULT Campaigns & Projects, Collabrium, Astro Universe, Portals and Ad hoc are pinned. Unpinned projects with no cards show as small "No cards yet" chips.
- **Adding and removing**: Settings has an **Add** form for projects and people. **Remove** hides a project or person; their cards stay in past weeks, and you can restore them from the **Removed** list. Something with no cards at all can be deleted for good.
- **Copy summary** copies the sprint as text for Slack or email.

## For developers

- Next.js (App Router) + TypeScript, plain CSS in `app/globals.css` built on the Collabrium design tokens (`app/collabrium-tokens.css`), Mulish, Phosphor icons.
- Form controls follow the Collabrium DLS: `Select`, `Combobox` and `DatePicker` in `components/fields.tsx`, drawn in a shared `Popover` that renders above everything. Don't use native `<select>` or `<input type="date">`.
- Data goes through `lib/store.ts` → a small backend interface in `lib/backend/` (Supabase with realtime, or the browser-only demo). Screens never call Supabase directly.
- `lib/board.ts` turns updates into board cards and holds the move/carry logic. View state (filters, collapsed lanes, open card) lives in `lib/ui-store.ts`.
- **Later: Slack.** `buildSprintSummary()` and `buildReminderMessage()` in `lib/summary.ts` are pure functions; a scheduled route can post them to a Slack webhook.
- **Later: real sign-in.** "Who am I" comes only from `getCurrentPersonId()` / `setCurrentPerson()` in `lib/store.ts`. Replace those with the signed-in user and tighten the Row Level Security policies in `supabase/schema.sql`.
- Checks: `npm run typecheck`, `npm run lint`, `npm run build`.
