# Design Cadence

The design team's weekly check-in board. It replaces the FigJam board where someone duplicated a page every week.

Everything is on one page:

- **The board**: one lane per project (sub-projects sit inside their parent), split into **Done** (last week), **Doing** (this week) and **Blocked**. Everyone's cards are visible; you add your own right where they belong. Done, Doing and Blocked have solid coloured headers over tinted columns, and each task is one card with everyone's items listed inside it.
- **Important dates/info**, **Open blockers** and **Action items** in the panel on the right. Fold it into a slim rail (the icon at its top) when you want more room for the board.
- **Present** for the Tuesday meeting, and **Settings** for projects and people.

> ⚠️ **Until secure sign-in is switched on (see below), anyone with the link can see and edit everything.** Share the link only inside the team and never post it publicly. With secure sign-in on, only people on the team list can get in.

---

## How it works (for the team)

1. Open the link and tap your name. With secure sign-in on, a 6-digit code is emailed to you; enter it and the device remembers you. New to the team? Ask the design lead or an admin to add you in Settings → People (with your work email). Tap your face in the top right and choose **Sign out** to leave.
2. On any project, click **Add a card** under Done, Doing or Blocked. Type a **task name** (required: pick an existing one as you type, or type a new name and it's created), add the details if you like, and press **Enter**; the form stays open for the next one. Details, size (S/M/L) and due date are optional.
   - S = under a day, M = a few days, L = most of the week or more.
   - Sub-projects (like Astro › Boxless) have their own title row. Hover it to add a card there.
   - Hover a **task name** (the bold line above its cards) and click **Add card** to add another card to that same task.
3. **Drag cards** between columns, projects or tasks. Drop a card onto another task's name or cards to re-file it under that task. On a phone, drag by the dotted handle. Every move can be undone. To re-file your own card without dragging, open it and change its **Task**.
4. Each week starts with a clean board: nothing is brought over automatically from the week before. Add what you're working on in **Doing**. The only thing that carries forward is a **blocker** nobody has marked resolved, which stays on the board until someone does.
5. Click a project's header to collapse or expand it. **Collapse all / Expand all** sits in the filter bar.
6. Filter by **Person**, **Project** or **Status** (overdue, due in 3 days, open blockers), or use **Only me** and the search box.
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

## Pictures on cards

Cards can carry up to 6 pictures: tap **+ Add** in the add-card form (or in a card you own), drag files onto the form, or paste a screenshot. They're shrunk to 800px and stored in the card itself, so there's no file storage to set up. Click a thumbnail to open the viewer (← → and Esc). Only the card's owner adds or removes pictures; anyone can view.

**One-time database step:** run `supabase/schema.sql` again in the Supabase SQL Editor (it adds an `images` column). Until you do, cards still save, but adding pictures fails.

Keep an eye on size: every card loads for everyone, and each picture adds roughly 40 to 100 KB. If the board ever feels slow after months of picture cards, the fix is to move pictures to Supabase Storage.

## Secure sign-in (emailed 6-digit code)

Off by default, so nothing changes until you switch it on. When on: you tap your name, a 6-digit code goes to your work email, and only people on the team list get in. The database itself is locked to signed-in team members, not just the screen. Do these in order:

1. **Add the columns and helpers.** Supabase → SQL Editor → run `supabase/schema.sql` again (safe to repeat).
2. **Load everyone's email.** Run `supabase/emails.local.sql` (kept out of GitHub; copy `supabase/emails.example.sql` to make your own).
3. **Let Supabase send the emails.** Supabase's built-in sender allows only a few emails an hour, so connect your own (for example a free Resend account): Project Settings → Authentication → SMTP Settings. Then Authentication → Email Templates → **Magic Link**, and put `{{ .Token }}` in the message so the code shows, for example: `Your Design Cadence code is {{ .Token }}`. Under Authentication → Sign In / Providers → Email, set the **OTP expiry to 600** (10 minutes) and **OTP length to 6**.
4. **Add the server key.** In Vercel → Settings → Environment Variables add `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API → `service_role`; keep it secret, never put it in the browser) and `NEXT_PUBLIC_REQUIRE_LOGIN` = `true`. Redeploy.
5. **Sign in once** as the design lead or an admin on the live site.
6. **Lock the database.** Run `supabase/lock-down.sql`. It refuses to run until an admin or lead has signed in, so you can't lock everyone out. After this, nobody without a code can read or change anything.

Changing someone's email: only the design lead or an admin can, in Settings → People (pencil icon, then Save). That signs the person out; their next code goes to the new address. Removing someone in Settings blocks them straight away.

Rules of thumb: only `@astro.com.my` addresses are accepted (change with `ALLOWED_EMAIL_DOMAIN`). Never run `npm run seed` with the anon key after step 6; it needs the service key.

## Good to know

- **Live updates**: everyone's changes appear as they happen (the dot in the top bar says **Live**). Cards are separate rows, and edits only send the fields that changed, so two people working at once don't overwrite each other's cards. If the connection drops, the app catches up as soon as it's back.
- **Who changed what**: every card records who added it and who last changed it (open a card to see).
- **Colour** only means something: green = done, blue = in progress, amber = needs attention, red = blocked or overdue. Each project's own colour fills its avatar and shows as a band on its title card; pick it in Settings.
- **Logos and photos** are shrunk to a small image and saved with the project or person, so there's no file storage to set up.
- **Important dates/info**: add a date (it shows until its day has passed, then drops off) or leave the date empty to add a note for the week you're viewing. Notes without a date stay in that week and aren't brought over to the next one. Past weeks show what was still ahead at the time.
- **Roles and Settings**: only the design lead (Ryann) and admins (Elaine and Tasha) see the Settings gear. Change someone's role in Settings → People. This keeps everyday users away from project and people management; with secure sign-in on, the database also enforces it: only the design lead and admins can add people or change roles.
- **Your colour**: click your face in the top right to pick your blob's colour, or to sign out.
- **Action items** can have several owners.
- **Ongoing projects**: pin a project in Settings (the pin icon) and it always has a lane on the board, even in a week with no cards. KULT Campaigns & Projects, Collabrium, Astro Universe, Portals and Ad hoc are pinned. Unpinned projects with no cards show as small "No cards yet" chips.
- **Adding and removing**: Settings has an **Add** form for projects and people. **Remove** hides a project or person; their cards stay in past weeks, and you can restore them from the **Removed** list. Something with no cards at all can be deleted for good.
- **Copy summary** copies the sprint as text for Slack or email.

## For developers

- Next.js (App Router) + TypeScript, plain CSS in `app/globals.css` built on the Collabrium design tokens (`app/collabrium-tokens.css`), Mulish, Phosphor icons.
- Form controls follow the Collabrium DLS: `Select`, `Combobox` and `DatePicker` in `components/fields.tsx`, drawn in a shared `Popover` that renders above everything. Don't use native `<select>` or `<input type="date">`.
- Data goes through `lib/store.ts` → a small backend interface in `lib/backend/` (Supabase with realtime, or the browser-only demo). Screens never call Supabase directly.
- `lib/board.ts` turns updates into board cards and holds the move logic. View state (filters, collapsed lanes, open card) lives in `lib/ui-store.ts`.
- **Later: Slack.** `buildSprintSummary()` and `buildReminderMessage()` in `lib/summary.ts` are pure functions; a scheduled route can post them to a Slack webhook.
- **Later: real sign-in.** "Who am I" comes only from `getCurrentPersonId()` / `setCurrentPerson()` in `lib/store.ts`. Replace those with the signed-in user and tighten the Row Level Security policies in `supabase/schema.sql`.
- Checks: `npm run typecheck`, `npm run lint`, `npm run build`.
