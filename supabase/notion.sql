-- Our Calendar: where the Notion connection is kept.
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- One row holds the keys Notion gives back when an admin connects the leave
-- calendar. Row Level Security is on with no policies, so the public key and
-- signed-in people can't read or change it; only the server (service key) can.

create table if not exists notion_connection (
  id int primary key default 1 check (id = 1),
  access_token text not null,
  refresh_token text,
  bot_id text,
  workspace_id text,
  workspace_name text,
  connected_by uuid references people(id) on delete set null,
  connected_at timestamptz not null default now()
);

alter table notion_connection enable row level security;
revoke all on notion_connection from anon, authenticated;
