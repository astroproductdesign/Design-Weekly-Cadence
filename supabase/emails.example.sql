-- Copy to supabase/emails.local.sql (not committed), fill in the real emails and run it in the Supabase SQL Editor.
update people set email = 'first.last@astro.com.my' where name = 'Their name in the app';
select name, role, email from people where active order by sort_order;
