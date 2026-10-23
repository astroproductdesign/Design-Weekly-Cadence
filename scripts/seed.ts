// Loads the team, projects and the Sprint 86 cards (migrated from FigJam) into Supabase.
// Usage: npm run seed   (reads .env.local). Safe to run more than once.

import { createClient } from "@supabase/supabase-js";
import { buildSeed } from "../lib/seed-data";
import { TABLES } from "../lib/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and a Supabase key in .env.local (see README).");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const db = buildSeed();

// Parents before children so foreign keys are satisfied.
db.projects = Object.fromEntries(
  Object.entries(db.projects).sort(([, a], [, b]) => Number(!!a.parent_id) - Number(!!b.parent_id)),
);
db.updates = Object.fromEntries(
  Object.entries(db.updates).sort(([, a], [, b]) => a.sprint_number - b.sprint_number),
);

async function main() {
  for (const table of TABLES) {
    const rows = Object.values(db[table]);
    if (!rows.length) continue;
    // Insert one by one for tables with self-references, in bulk otherwise.
    const batches = table === "projects" || table === "updates" ? rows.map((r) => [r]) : [rows];
    for (const batch of batches) {
      const { error } = await supabase.from(table).upsert(batch as never[]);
      if (error) {
        console.error(`✗ ${table}: ${error.message}`);
        process.exit(1);
      }
    }
    console.log(`✓ ${table}: ${rows.length}`);
  }
  console.log("Done. Open the app and pick your name.");
}

void main();
