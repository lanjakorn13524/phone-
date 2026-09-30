-- =====================================================================
-- 0003 — งานที่ตั้งเวลาได้ (แทน BullMQ ด้วย pg_cron + pg_net)
-- ต้องมี vault secrets ก่อน:
--   select vault.create_secret('https://<ref>.supabase.co', 'edge_functions_base_url');
--   select vault.create_secret('<service_role_key>',          'service_role_key');
-- =====================================================================

do $$
begin
  create extension if not exists pg_cron with schema cron;
exception when others then
  raise notice 'skip pg_cron: %', sqlerrm;
end $$;

do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  raise notice 'skip pg_net: %', sqlerrm;
end $$;

-- ---------- ดึงจำนวนสมาชิกของทุกเว็บ (วันละครั้ง) ----------
create or replace function public.cron_sync_member_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'edge_functions_base_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_url is null or v_key is null then
    insert into public.job_runs (job_name, ok, error)
      values ('sync-member-stats', false, 'missing vault secret: edge_functions_base_url / service_role_key');
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/sync-member-stats',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );

  insert into public.job_runs (job_name, ok) values ('sync-member-stats', true);
end;
$$;

-- ---------- กวาดข้อมูลเก่า ----------
create or replace function public.cron_cleanup()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.write_quota_usage where day < current_date - 90;
  delete from public.job_runs where created_at < now() - interval '30 days';
  -- backup ราย entry เก็บ 90 วัน (ไฟล์ .sql.gz เก็บแยกใน Storage)
  delete from public.data_change_backup where created_at < now() - interval '90 days';
end;
$$;

-- ---------- ลงทะเบียนงาน ----------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ไม่พร้อมใช้งาน — ข้ามการตั้งงานอัตโนมัติ';
    return;
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname in ('sync-member-stats', 'cleanup');

  -- ใช้ $cron$ เป็นตัวครอบคำสั่ง เพราะทั้งก้อนอยู่ใน do block ที่ครอบด้วย dollar-quote แล้ว
  perform cron.schedule('sync-member-stats', '7 2 * * *', $cron$select public.cron_sync_member_stats()$cron$);
  perform cron.schedule('cleanup',          '23 3 * * *', $cron$select public.cron_cleanup()$cron$);
end $$;
