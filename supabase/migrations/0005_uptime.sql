-- =====================================================================
-- 0005 — Uptime monitor: ผลการตรวจสุขภาพเว็บย่อย + วิวสำหรับหน้า Dashboard
-- ตรวจโดย Edge Function `check-sites` (pg_cron ทุก 5 นาที หรือกดปุ่มในหน้าเว็บ)
-- =====================================================================

-- ---------- ตั้งค่าการมอนิเตอร์ต่อเว็บ ----------
alter table public.sites
  add column if not exists monitor_enabled boolean not null default true,
  add column if not exists monitor_interval_minutes integer not null default 5
    check (monitor_interval_minutes between 1 and 1440),
  add column if not exists health_path text not null default '/';

-- ---------- ผลการตรวจ (append-only) ----------
-- เก็บย้อนหลัง 30 วัน (cron_cleanup ลบทิ้ง) — ที่ 5 นาทีต่อครั้ง = ~8.6k แถว/เว็บ/เดือน
create table if not exists public.site_health_checks (
  id          bigint generated always as identity primary key,
  site_id     uuid not null references public.sites (id) on delete cascade,
  kind        text not null default 'http' check (kind in ('http', 'connector')),
  ok          boolean not null,
  latency_ms  integer check (latency_ms is null or latency_ms >= 0),
  http_status integer,
  error       text,
  checked_at  timestamptz not null default now()
);
create index if not exists site_health_checks_site_idx
  on public.site_health_checks (site_id, checked_at desc);
create index if not exists site_health_checks_time_idx
  on public.site_health_checks (checked_at desc);
create index if not exists site_health_checks_fail_idx
  on public.site_health_checks (checked_at desc) where not ok;

-- ---------- RLS: staff อ่านได้ / เขียนได้แค่ service role ----------
alter table public.site_health_checks enable row level security;
drop policy if exists site_health_checks_read_all_staff on public.site_health_checks;
create policy site_health_checks_read_all_staff on public.site_health_checks
  for select to authenticated using (true);

-- ---------- วิว ----------
-- security_invoker = true เพื่อให้ RLS ของตารางข้างล่างมีผลจริง (PG15+)
create or replace view public.site_health_latest_http
with (security_invoker = true)
as
select distinct on (site_id)
  site_id, ok, latency_ms, http_status, error, checked_at
from public.site_health_checks
where kind = 'http'
order by site_id, checked_at desc;

create or replace view public.site_health_latest_connector
with (security_invoker = true)
as
select distinct on (site_id)
  site_id, ok, latency_ms, error, checked_at
from public.site_health_checks
where kind = 'connector'
order by site_id, checked_at desc;

-- สถิติ 24 ชั่วโมง (ใช้ทำ % uptime บนการ์ด)
create or replace view public.site_health_stats_24h
with (security_invoker = true)
as
select
  site_id,
  count(*)::int as checks_24h,
  count(*) filter (where ok)::int as ok_24h,
  round(100.0 * count(*) filter (where ok) / greatest(count(*), 1), 1) as uptime_24h,
  round(avg(latency_ms) filter (where ok))::int as avg_latency_ms,
  max(latency_ms) filter (where ok)::int as max_latency_ms
from public.site_health_checks
where kind = 'http' and checked_at > now() - interval '24 hours'
group by site_id;

-- จุดสำหรับกราฟแท่ง 24 ครั้งล่าสุดของแต่ละเว็บ (เว็บที่ยังไม่เคยตรวจได้ [] )
create or replace view public.site_health_spark
with (security_invoker = true)
as
select
  s.id as site_id,
  coalesce((
    select jsonb_agg(
             jsonb_build_object('at', c.checked_at, 'ok', c.ok, 'ms', c.latency_ms)
             order by c.checked_at)
    from (
      select checked_at, ok, latency_ms
      from public.site_health_checks
      where site_id = s.id and kind = 'http'
      order by checked_at desc
      limit 24
    ) c
  ), '[]'::jsonb) as points
from public.sites s;

-- ประวัติเว็บล่ม 7 วันล่าสุด (หน้า Dashboard ใช้ตารางนี้)
create or replace view public.site_health_recent_failures
with (security_invoker = true)
as
select
  c.id, c.site_id, s.name as site_name, s.slug,
  c.kind, c.error, c.http_status, c.checked_at
from public.site_health_checks c
join public.sites s on s.id = c.site_id
where not c.ok and c.checked_at > now() - interval '7 days';

-- ตัวเลขรวมทั้งแดชบอร์ดในคิวรีเดียว
-- health: up | down | maintenance (ตั้งใจปิดเว็บ) | unknown (ยังไม่เคยตรวจ)
create or replace view public.site_overview
with (security_invoker = true)
as
select
  s.id, s.name, s.slug, s.domain, s.stack, s.hosting_provider,
  s.status as declared_status, s.version,
  s.monitor_enabled, s.monitor_interval_minutes, s.health_path,
  s.connector_type, s.connector_config_ref,
  s.created_at,
  case
    when s.status = 'maintenance' then 'maintenance'
    when lh.site_id is null then 'unknown'
    when lh.ok then 'up'
    else 'down'
  end as health,
  lh.checked_at as last_checked_at,
  lh.latency_ms, lh.http_status, lh.error as last_error,
  st.checks_24h, st.uptime_24h, st.avg_latency_ms, st.max_latency_ms,
  lc.ok as connector_ok, lc.latency_ms as connector_latency_ms,
  lc.checked_at as connector_checked_at, lc.error as connector_error,
  ms.total as members_total, ms.active as members_active,
  ms.new_this_month as members_new_this_month,
  cost.due_this_month
from public.sites s
left join public.site_health_latest_http lh on lh.site_id = s.id
left join public.site_health_latest_connector lc on lc.site_id = s.id
left join public.site_health_stats_24h st on st.site_id = s.id
left join public.site_member_stats ms on ms.site_id = s.id
left join lateral (
  select sum(c.amount)::numeric(12, 2) as due_this_month
  from public.site_costs c
  where c.site_id = s.id
    and c.next_due_date >= date_trunc('month', current_date)::date
) cost on true;

revoke all on public.site_health_latest_http from anon;
revoke all on public.site_health_latest_connector from anon;
revoke all on public.site_health_stats_24h from anon;
revoke all on public.site_health_spark from anon;
revoke all on public.site_health_recent_failures from anon;
revoke all on public.site_overview from anon;

grant select on public.site_health_latest_http to authenticated, service_role;
grant select on public.site_health_latest_connector to authenticated, service_role;
grant select on public.site_health_stats_24h to authenticated, service_role;
grant select on public.site_health_spark to authenticated, service_role;
grant select on public.site_health_recent_failures to authenticated, service_role;
grant select on public.site_overview to authenticated, service_role;

-- ---------- cron: ตรวจทุกเว็บทุก 5 นาที ----------
create or replace function public.cron_check_sites()
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
      values ('check-sites', false, 'missing vault secret: edge_functions_base_url / service_role_key');
    return;
  end if;

  perform net.http_post(
    url     := v_url || '/functions/v1/check-sites',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );

  insert into public.job_runs (job_name, ok) values ('check-sites', true);
end;
$$;

-- ---------- เก็บข้อมูล: ผลตรวจเก็บ 30 วัน ----------
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
  -- ผลตรวจสุขภาพเก็บ 30 วัน (ตารางโตช้าที่สุดของระบบ)
  delete from public.site_health_checks where checked_at < now() - interval '30 days';
end;
$$;

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron ไม่พร้อมใช้งาน — ข้ามการตั้งงานตรวจสุขภาพอัตโนมัติ';
    return;
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'check-sites';
  -- ใช้ $cron$ เป็นตัวครอบคำสั่ง เพราะทั้งก้อนอยู่ใน do block ที่ครอบด้วย dollar-quote แล้ว
  perform cron.schedule('check-sites', '*/5 * * * *', $cron$select public.cron_check_sites()$cron$);
end $$;
