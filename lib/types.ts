// Row shapes. These mirror supabase/schema.sql one-to-one.

export type Audit = {
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

/** Lead and admin can open Settings. Admins are the people who look after the board itself. */
export type Role = "member" | "lead" | "admin";

export type Person = Audit & {
  id: string;
  name: string;
  avatar_url: string | null;
  role: Role;
  /** Their blob character's colour (null = the one picked for them). */
  blob_color: ProjectColor | null;
  active: boolean;
  sort_order: number;
  /** Work email the sign-in code goes to. Only used when sign-in is switched on. */
  email?: string | null;
  /** The sign-in account linked to this person (set by the server on first sign-in). */
  auth_user_id?: string | null;
};

export type ProjectColor =
  | "amber"
  | "navy"
  | "purple"
  | "salmon"
  | "turquoise"
  | "grey"
  | "neutral"
  | "orange"
  | "green";

export type Project = Audit & {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  color: ProjectColor;
  parent_id: string | null;
  sort_order: number;
  archived: boolean;
  /** Ongoing project: always has a lane on the board, even with no cards this week. */
  pinned: boolean;
};

export type Sprint = {
  id: string;
  number: number;
  start_date: string; // yyyy-mm-dd (Wednesday)
  end_date: string; // yyyy-mm-dd (Tuesday)
  meeting_date: string; // yyyy-mm-dd (Tuesday before start)
  created_at: string;
};

export type Task = Audit & {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  archived: boolean;
};

export type UpdateType = "done" | "planned" | "blocker";
export type Size = "S" | "M" | "L";
export type PlannedStatus = "not_started" | "in_progress" | "done" | "carried_over" | "dropped";

export type Update = Audit & {
  id: string;
  sprint_number: number;
  project_id: string;
  task_id: string;
  person_id: string;
  type: UpdateType;
  text: string;
  size: Size | null;
  due_date: string | null;
  status: PlannedStatus | null; // planned items only
  help_from_person_id: string | null; // blockers only
  help_from_text: string | null;
  resolved: boolean;
  resolved_at: string | null;
  carried_from_id: string | null;
  carry_count: number; // how many times this item has been carried over
  /** Pictures attached to the card, shrunk and stored inline as data URLs (up to 6). */
  images?: string[];
};

export type Priority = "normal" | "urgent";

export type ImportantDate = Audit & {
  id: string;
  title: string;
  /** null = a note with no date: it belongs to one week only (sprint_number) and isn't carried forward. */
  date: string | null;
  sprint_number: number | null;
  project_id: string | null; // null = General
  note: string | null;
  priority: Priority;
};

export type ActionItem = Audit & {
  id: string;
  text: string;
  owner_ids: string[];
  due_date: string | null;
  sprint_number: number;
  done: boolean;
  done_at: string | null;
};

export type Reaction = {
  id: string;
  target_type: "update" | "date";
  target_id: string;
  emoji: string;
  person_id: string;
  created_at: string;
};

export type Setting = {
  id: string; // setting key
  value: unknown;
  updated_at: string;
  updated_by: string | null;
};

export type Tables = {
  people: Person;
  projects: Project;
  sprints: Sprint;
  tasks: Task;
  updates: Update;
  important_dates: ImportantDate;
  action_items: ActionItem;
  reactions: Reaction;
  settings: Setting;
};

export type TableName = keyof Tables;

export const TABLES: TableName[] = [
  "people",
  "projects",
  "sprints",
  "tasks",
  "updates",
  "important_dates",
  "action_items",
  "reactions",
  "settings",
];

export type DB = { [K in TableName]: Record<string, Tables[K]> };

export const emptyDB = (): DB => ({
  people: {},
  projects: {},
  sprints: {},
  tasks: {},
  updates: {},
  important_dates: {},
  action_items: {},
  reactions: {},
  settings: {},
});

export type LoadThresholds = { lightMax: number; heavyMin: number };
export const DEFAULT_THRESHOLDS: LoadThresholds = { lightMax: 3, heavyMin: 9 };
