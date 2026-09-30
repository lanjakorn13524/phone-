-- =====================================================================
-- 0004 — ฟังก์ชันฝั่งเซิร์ฟเวอร์ที่ Edge Function เรียกใช้
-- ทุกตัวเป็น SECURITY DEFINER และปิดสิทธิ์ไว้ที่ service_role เท่านั้น
-- (staff อ่าน credential หรือเพิ่มโควตาเองไม่ได้)
-- =====================================================================

-- ---------- อ่าน credential ของเว็บย่อยจาก Vault ----------
create or replace function public.read_site_config(p_key text)
returns table (config text)
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_key;
$$;

-- ---------- นับโควตาเขียนข้อมูลแบบ atomic ----------
-- คืน quota_used ปัจจุบัน หรือ error 'quota_exceeded' ถ้าเกินลิมิต
create or replace function public.claim_write_quota(
  p_site_id uuid,
  p_day     date,
  p_limit   integer
)
returns table (quota_used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  insert into public.write_quota_usage as q (site_id, day, used)
  values (p_site_id, p_day, 1)
  on conflict (site_id, day) do update set used = q.used + 1
  returning q.used into v_used;

  if v_used > coalesce(p_limit, 0) then
    -- คืนโควตาที่เกินออก ไม่ให้มั่วเมื่อถูกปฏิเสธ
    update public.write_quota_usage
       set used = used - 1
     where site_id = p_site_id and day = p_day;
    raise exception 'quota_exceeded';
  end if;

  return query select v_used;
end;
$$;

-- ---------- ทำเครื่องหมายว่า backup ถูกใช้ย้อนกลับแล้ว ----------
-- การเขียนค่ากลับลง Firestore ทำที่ Edge Function (connectors-firestore action=restore)
-- เพื่อให้ผ่านชั้น denylist/โควตา/audit ชุดเดียวกัน และ snapshot ก่อนเขียนทับได้ถูกต้อง
create or replace function public.restore_backup(p_backup_id uuid, p_note text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.data_change_backup
     set restored_at = now()
   where id = p_backup_id;
$$;

-- ---------- health check ใช้กัน Supabase pause ----------
create or replace function public.health_ping()
returns text
language sql
stable
as $$
  select 'ok'::text;
$$;

revoke all on function public.read_site_config(text) from public, anon, authenticated;
revoke all on function public.claim_write_quota(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.restore_backup(uuid, text) from public, anon, authenticated;
revoke all on function public.health_ping() from public;

grant execute on function public.read_site_config(text) to service_role;
grant execute on function public.claim_write_quota(uuid, date, integer) to service_role;
grant execute on function public.restore_backup(uuid, text) to service_role;
grant execute on function public.health_ping() to anon, authenticated;
