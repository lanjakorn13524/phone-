-- =====================================================================
-- 0002 — Row Level Security  อ้างอิง: ARCHITECTURE.md ข้อ 5 (RLS) และข้อ 6 (Security)
-- บังคับสิทธิ์ที่ระดับฐานข้อมูล ไม่ใช่แค่เช็คใน UI
-- =====================================================================

-- ---------- helper: role ของผู้ใช้ที่ล็อกอินอยู่ ----------
create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.staff_users where id = auth.uid();
$$;

create or replace function public.has_role(allowed text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_staff_role() = any (allowed), false);
$$;

revoke all on function public.current_staff_role() from public;
revoke all on function public.has_role(text[]) from public;
grant execute on function public.current_staff_role() to authenticated;
grant execute on function public.has_role(text[]) to authenticated;

-- ---------- staff_users ----------
alter table public.staff_users enable row level security;

drop policy if exists staff_users_select_self_or_super on public.staff_users;
create policy staff_users_select_self_or_super on public.staff_users
  for select to authenticated
  using (id = auth.uid() or public.has_role(array['super']));

drop policy if exists staff_users_update_self_or_super on public.staff_users;
create policy staff_users_update_self_or_super on public.staff_users
  for update to authenticated
  using (id = auth.uid() or public.has_role(array['super']))
  with check (id = auth.uid() or public.has_role(array['super']));

-- สร้าง/ลบบัญชี staff ทำได้เฉพาะผ่าน service role (Edge Function / SQL) เพื่อกันการเพิ่ม super เอง

-- ---------- ตารางที่ staff ทุก role อ่านได้ ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'sites', 'site_costs', 'site_members', 'site_member_stats',
    'chat_channels', 'chat_messages', 'tickets',
    'knowledge_docs', 'ai_faqs', 'ai_models', 'ai_usage',
    'audit_logs', 'data_change_backup',
    'job_runs', 'feature_flags', 'write_quota_usage'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read_all_staff', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_read_all_staff', t);
  end loop;
end $$;

-- ---------- เขียนได้เฉพาะ admin / super ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'sites', 'site_costs', 'site_members', 'site_member_stats',
    'knowledge_docs', 'ai_faqs', 'ai_models', 'feature_flags'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_write_admin', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role(array[''super'',''admin''])) with check (public.has_role(array[''super'',''admin'']))',
      t || '_write_admin', t);
  end loop;
end $$;

-- ---------- แชท: staff ส่งข้อความได้ แต่ปลอมเป็น AI ไม่ได้ ----------
drop policy if exists chat_messages_insert_staff on public.chat_messages;
create policy chat_messages_insert_staff on public.chat_messages
  for insert to authenticated
  with check (sender_type <> 'ai');

drop policy if exists chat_channels_write_admin on public.chat_channels;
create policy chat_channels_write_admin on public.chat_channels
  for all to authenticated
  using (public.has_role(array['super', 'admin']))
  with check (public.has_role(array['super', 'admin']));

-- ---------- Ticket ----------
drop policy if exists tickets_write_admin on public.tickets;
create policy tickets_write_admin on public.tickets
  for all to authenticated
  using (public.has_role(array['super', 'admin', 'support']))
  with check (public.has_role(array['super', 'admin', 'support']));

-- ---------- audit_logs / data_change_backup / ai_usage: อ่านได้ เขียนจาก service role เท่านั้น ----------
-- (ไม่สร้าง policy ฝั่ง insert/update → staff ปลอมแถว audit ไม่ได้)

-- ---------- secrets: เปิด RLS แล้วไม่มี policy → service role เท่านั้นที่อ่านได้ ----------
alter table public.secrets enable row level security;

-- ---------- staff อ่าน notification ของตัวเอง ----------
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select to authenticated
  using (staff_id = auth.uid() or public.has_role(array['super']));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (staff_id = auth.uid())
  with check (staff_id = auth.uid());
