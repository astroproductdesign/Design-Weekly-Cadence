// Sample data for a fresh install. Used by `npm run seed` (Supabase) and by
// demo mode (browser-only) the first time it loads.

import { makeSprint } from "./sprint";
import type {
  DB,
  ImportantDate,
  Person,
  Project,
  ProjectColor,
  Setting,
  Task,
  Update,
  UpdateType,
} from "./types";
import { emptyDB, DEFAULT_THRESHOLDS } from "./types";

/** Stable uuid-shaped id from a string, so re-seeding is idempotent. */
export function seedId(key: string): string {
  const parts: string[] = [];
  for (let seed = 0; seed < 4; seed++) {
    let h = 0x811c9dc5 ^ (seed * 0x9e3779b9);
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    parts.push((h >>> 0).toString(16).padStart(8, "0"));
  }
  const hex = parts.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function buildSeed(): DB {
  const db = emptyDB();
  const LEAD = seedId("person:ryann");
  const audit = (at: string, by: string | null = LEAD) => ({
    created_at: at,
    updated_at: at,
    created_by: by,
    updated_by: by,
  });

  // People ------------------------------------------------------------------
  // Ryann is the design lead; Elaine and Tasha are admins. (Tasha's id keeps its
  // old key so a re-seed renames her instead of adding a second person.)
  const people: [string, "member" | "lead" | "admin", idKey?: string][] = [
    ["Moon", "member"],
    ["Lutfi", "member"],
    ["Tasha", "admin", "antasha"],
    ["Yen", "member"],
    ["Jia Yi Gan", "member"],
    ["Elaine", "admin"],
    ["Ryann", "lead"],
  ];
  const P: Record<string, string> = {};
  people.forEach(([name, role, idKey], i) => {
    const id = seedId(`person:${idKey ?? name.split(" ")[0].toLowerCase()}`);
    P[name.split(" ")[0]] = id;
    const row: Person = {
      id,
      name,
      avatar_url: null,
      blob_color: null,
      role,
      active: true,
      sort_order: i,
      ...audit("2026-10-01T09:00:00+08:00"),
    };
    db.people[id] = row;
  });

  // Projects ----------------------------------------------------------------
  // The ongoing projects (pinned) always have a lane on the board.
  const PINNED = new Set(["kult", "collabrium", "astro", "portals", "adhoc"]);
  const projects: [key: string, name: string, short: string, color: ProjectColor, parent?: string][] = [
    ["kult", "KULT Campaigns & Projects", "KULT", "amber"],
    ["collabrium", "Collabrium Digital Platform", "Collabrium", "navy"],
    ["kult-studio", "KULT Studio", "KULT Studio", "purple"],
    ["astro", "Astro Universe", "Astro", "salmon"],
    ["boxless", "Boxless", "Boxless", "salmon", "astro"],
    ["cms", "CMS Migration", "CMS", "salmon", "astro"],
    ["portals", "Portals", "Portals", "turquoise"],
    ["agentic", "Agentic / Agent automation", "Agentic", "grey"],
    ["adhoc", "AD HOC & Others", "Ad hoc", "neutral"],
  ];
  const PR: Record<string, string> = {};
  projects.forEach(([key, name, short, color, parent], i) => {
    const id = seedId(`project:${key}`);
    PR[key] = id;
    const row: Project = {
      id,
      name,
      short_name: short,
      logo_url: null,
      color,
      parent_id: parent ? seedId(`project:${parent}`) : null,
      sort_order: i,
      archived: false,
      pinned: PINNED.has(key),
      ...audit("2026-10-01T09:00:00+08:00"),
    };
    db.projects[id] = row;
  });

  // Sprints -----------------------------------------------------------------
  // Only Sprint 86 so far: migrated from the FigJam board (20 Oct 2026).
  for (const n of [86]) {
    const s = makeSprint(n);
    s.created_at = `${s.start_date}T00:00:00+08:00`;
    db.sprints[s.id] = s;
  }

  // Cards: one per sticky note. The sticky's bold first line is the task, the
  // rest is the card text. "The Past" is Done, "The Future" is Doing.
  type Sticky = { who: string; task: string; text?: string };
  const board: Record<string, { done: Sticky[]; doing: Sticky[] }> = {
    kult: {
      done: [
        { who: "Moon", task: "Unifi banners", text: "Shared FA on 13 Oct" },
        { who: "Moon", task: "Mirinda x 7UP CNY Raya", text: "deck visuals support" },
        { who: "Moon", task: "KWC Raya", text: "deck support" },
        { who: "Yen", task: "Mirinda", text: "Work on CNY idea revision" },
        { who: "Lutfi", task: "Mirinda x 7UP CNY Raya", text: "deck visuals support" },
        { who: "Tasha", task: "7UP x Mirinda", text: "- Sync up with client for new theme\n- Finalised with AMS on deliveries & roll out plan\n- Further reworking the idea" },
        { who: "Tasha", task: "KWC Raya", text: "- Reviewed with bryan and submitted first round to jonis (19/10)" },
        { who: "Yen", task: "KWC", text: "Work on deck" },
      ],
      doing: [
        { who: "Moon", task: "Mirinda x 7UP CNY Raya", text: "deck visuals support" },
        { who: "Lutfi", task: "BYT", text: "Bryan ask to find more intense chapter from novel. to make one more episode." },
        { who: "Moon", task: "KWC Raya", text: "deck visuals support" },
        { who: "Tasha", task: "7UP x Mirinda", text: "- Sample script\n- Finalise deck\n- Present thursday" },
      ],
    },
    collabrium: {
      done: [
        { who: "Jia", task: "Collabrium DLS Migration", text: "- Aligned with Elaine on migration plan" },
        { who: "Elaine", task: "CollabInfluence", text: "90 days plan items\n- Influencer view workflow" },
        { who: "Tasha", task: "CollabSales", text: "- Downtime email & newsletter" },
        { who: "Jia", task: "CollabSales", text: "- Downtime Friday and Monday email newsletter - emails successfully sent out on Friday and yesterday" },
        { who: "Elaine", task: "CollabSales", text: "- Usability bug testing for Sales platform\n\nJia Yi, Elaine, Tasha" },
      ],
      doing: [
        { who: "Jia", task: "Collabrium DLS Migration", text: "- Next steps - migration + sanity testing" },
        {
          who: "Elaine",
          task: "CollabInfluence",
          text: "90 days plan items\n- Testing - Influencer view workflow\n- Brief to influencer listing\n\nTeam Feedback\n- Influencer requirements - One influencer multi platform\n- Deliverables - 2 live links output\n\nMigration\n- Retargeting 22 Oct to switch to new link",
        },
        { who: "Jia", task: "CollabInfluence", text: "- Prepare for CollabInfluence emails + feedback form" },
      ],
    },
    astro: {
      done: [
        { who: "Jia", task: "Brownfield - Grooming", text: "- Users who owe money flow\n- Channel Logo\n- View more modal\n- Launch Promo green banner\n\nSubscription page" },
        { who: "Jia", task: "Greenfield", text: "- Coin animation" },
        { who: "Tasha", task: "Brownfield", text: "- Chatbot redirection messages (1/2)" },
      ],
      doing: [
        { who: "Jia", task: "Dev Queries", text: "- Post-grooming queries" },
        {
          who: "Tasha",
          task: "Brownfield",
          text: "- Chatbot redirection messages (2/2)\n- Blocker page copies for prepaid AF\n- Blocker page copy for prepaid Rewards\n- Promotions error copy",
        },
      ],
    },
  };

  const T: Record<string, string> = {};
  const addTask = (project: string, title: string) => {
    const key = `${project}:${title}`;
    if (T[key]) return T[key];
    const id = seedId(`task:${key}`);
    T[key] = id;
    const row: Task = { id, project_id: PR[project], title, description: null, archived: false, ...audit("2026-10-20T10:00:00+08:00") };
    db.tasks[id] = row;
    return id;
  };
  let n = 0;
  for (const [project, cols] of Object.entries(board)) {
    for (const [col, list] of Object.entries(cols) as [string, Sticky[]][]) {
      for (const st of list) {
        const id = seedId(`update:s86:${n++}`);
        const type: UpdateType = col === "done" ? "done" : "planned";
        const by = P[st.who];
        const row: Update = {
          id,
          sprint_number: 86,
          project_id: PR[project],
          task_id: addTask(project, st.task),
          person_id: by,
          type,
          text: st.text ?? "",
          size: null,
          due_date: null,
          status: type === "planned" ? "in_progress" : null,
          help_from_person_id: null,
          help_from_text: null,
          resolved: false,
          resolved_at: null,
          carried_from_id: null,
          carry_count: 0,
          ...audit("2026-10-20T11:00:00+08:00", by),
        };
        db.updates[id] = row;
      }
    }
  }

  // Important dates/info ----------------------------------------------------
  // From the FigJam "Upcoming / Important events or dates" strip. Dated ones
  // show until their day passes; notes with no date belong to Sprint 86 only.
  const dates: Omit<ImportantDate, keyof ReturnType<typeof audit> | "id">[] = [
    { title: "Compliance Training deadline", date: "2026-11-30", sprint_number: null, project_id: null, note: null, priority: "urgent" },
    { title: "7UP x Mirinda presentation", date: "2026-10-22", sprint_number: null, project_id: PR.kult, note: "Presentation @ client office", priority: "normal" },
    { title: "SPLater", date: null, sprint_number: 86, project_id: PR.kult, note: "- Gates looking into CNY event", priority: "normal" },
    { title: "Eversoft", date: null, sprint_number: 86, project_id: PR.kult, note: "- No news yet", priority: "normal" },
    {
      title: "Collab Mothership",
      date: null,
      sprint_number: 86,
      project_id: PR.collabrium,
      note: "- Ryann updating mothership based on B and stakeholder feedback\nhttps://app-shell-intro.vercel.app/pages/landing-v4.html",
      priority: "normal",
    },
    { title: "Collabrium DLS", date: null, sprint_number: 86, project_id: PR.collabrium, note: "- Sync up and alignment", priority: "normal" },
    { title: "Awani", date: null, sprint_number: 86, project_id: null, note: "- Setup the DLS for Awani", priority: "normal" },
  ];
  dates.forEach((d, i) => {
    const id = seedId(`date:${i}`);
    db.important_dates[id] = { id, ...d, ...audit("2026-10-20T09:30:00+08:00") };
  });

  // Settings ----------------------------------------------------------------
  const thresholds: Setting = {
    id: "load_thresholds",
    value: DEFAULT_THRESHOLDS,
    updated_at: "2026-10-01T09:00:00+08:00",
    updated_by: LEAD,
  };
  db.settings[thresholds.id] = thresholds;

  return db;
}
