-- =====================================================================
-- 0001 — schema กลาง (Control Plane)  อ้างอิง: ARCHITECTURE.md ข้อ 5
-- =====================================================================

-- ---------- ส่วนขยาย ----------
create extension if not exists pg_trgm;    -- ค้นภาษาไทยแบบ fuzzy (FTS ตัดคำไทยไม่ได้)
create extension if not exists pgcrypto;  -- gen_random_uuid / digest

do $$
begin
  create extension if not exists supabase_vault with schema vault;
exception when others then
  raise notice 'skip supabase_vault: %', sqlerrm;
end $$;

-- ---------- ผู้ใช้งานระบบ (staff เท่านั้น ลูกค้าไม่เข้ามา) ----------
create table if not exists public.staff_users (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null unique,
  name             text,
  role             text not null default 'viewer'
                     check (role in ('super', 'admin', 'support', 'viewer')),
  is_super_admin   boolean not null default false,
  last_login_at    timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------- ทะเบียนเว็บย่อย ----------
create table if not exists public.sites (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  slug                   text not null unique,
  domain                 text,
  stack                  text,                       -- เช่น "Firebase Hosting + Firestore"
  hosting_provider       text,                       -- เช่น "firebase", "vps-a", "railway"
  connector_type         text not null default 'firestore'
                           check (connector_type in ('firestore', 'mysql', 'postgres', 'wordpress', 'rest')),
  status                 text not null default 'active'
                           check (status in ('active', 'maintenance', 'down')),
  version                text,                       -- git sha ที่ deploy อยู่
  daily_quota            integer not null default 100 check (daily_quota > 0),
  connector_config_ref   text,                       -- ชี้ไปที่ vault secret (ชื่อ key ใน vault) ไม่เก็บ credential ตรง ๆ
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------- ค่าใช้จ่าย ----------
create table if not exists public.site_costs (
  id              uuid primary key default gen_random_uuid(),
  site_id         uuid not null references public.sites (id) on delete cascade,
  provider        text not null,
  category        text not null default 'hosting'
                    check (category in ('hosting', 'domain', 'plugin', 'sms', 'ai', 'other')),
  amount          numeric(12, 2) not null default 0 check (amount >= 0),
  currency        text not null default 'THB',
  billing_cycle   text not null default 'monthly'
                    check (billing_cycle in ('monthly', 'yearly', 'one_time')),
  next_due_date   date,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists site_costs_site_idx on public.site_costs (site_id);

-- ---------- สมาชิก (แหล่งความจริงอยู่ที่ Firestore ของแต่ละเว็บ) ----------
-- เว็บแรก: ใช้แค่ site_member_stats เพื่อทำกราฟ ส่วนรายชื่อดึงสดจาก Firestore
--          ตารางนี้ "ยังไม่ต้องใช้" — สร้างตอนต้อง export CSV / ค้นข้ามเว็บ / เก็บประวัติ
create table if not exists public.site_members (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references public.sites (id) on delete cascade,
  external_id   text not null,
  email         text,
  display_name  text,
  plan          text,
  status        text,
  joined_at     timestamptz,
  synced_at     timestamptz not null default now(),
  raw           jsonb,
  unique (site_id, external_id)
);
create index if not exists site_members_site_idx on public.site_members (site_id, joined_at desc);

create table if not exists public.site_member_stats (
  site_id          uuid primary key references public.sites (id) on delete cascade,
  total            integer not null default 0,
  active           integer not null default 0,
  new_this_month   integer not null default 0,
  captured_at      timestamptz not null default now()
);

-- ---------- แชท ----------
create table if not exists public.chat_channels (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites (id) on delete cascade,
  topic       text,
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now()
);
create index if not exists chat_channels_site_idx on public.chat_channels (site_id, created_at desc);

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references public.chat_channels (id) on delete cascade,
  sender_type  text not null check (sender_type in ('user', 'staff', 'ai')),
  sender_id    text,
  body         text not null,
  attachments  jsonb not null default '[]'::jsonb,
  ai_meta      jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists chat_messages_channel_idx on public.chat_messages (channel_id, created_at);

-- ---------- Ticket ----------
create table if not exists public.tickets (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.sites (id) on delete cascade,
  channel_id   uuid references public.chat_channels (id) on delete set null,
  title        text not null,
  description  text,
  category     text,
  priority     text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  assigned_to  uuid references public.staff_users (id) on delete set null,
  created_at   timestamptz not null default now(),
  sla_due_at   timestamptz,
  resolved_at  timestamptz
);
create index if not exists tickets_site_idx on public.tickets (site_id, status, created_at desc);

-- ---------- ฐานความรู้ ----------
create table if not exists public.knowledge_docs (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.sites (id) on delete cascade,
  title        text not null,
  content      text not null,
  source_url   text,
  search_text  text generated always as (title || ' ' || content) stored,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists knowledge_docs_trgm_idx on public.knowledge_docs using gin (search_text gin_trgm_ops);

create table if not exists public.ai_faqs (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites (id) on delete cascade,
  question    text not null,
  answer      text not null,
  hits        integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- ---------- AI ----------
create table if not exists public.ai_models (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null,                    -- 'cloudflare' | 'gemini'
  model_id    text not null,                    -- เปลี่ยนได้โดยไม่ต้อง deploy โค้ดใหม่
  purpose     text not null check (purpose in ('classify', 'answer', 'embed')),
  enabled     boolean not null default true,
  is_default  boolean not null default false,
  notes       text,
  updated_at  timestamptz not null default now(),
  unique (provider, model_id, purpose)
);

create table if not exists public.ai_usage (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid references public.sites (id) on delete set null,
  model_id     text,
  purpose      text,
  tokens_in    integer,
  tokens_out   integer,
  latency_ms   integer,
  ok           boolean not null default true,
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);

-- ---------- ความปลอดภัย / ตรวจสอบ ----------
create table if not exists public.secrets (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid references public.sites (id) on delete cascade,
  key               text not null unique,
  vault_secret_id   text not null,               -- id ของ secret ใน Supabase Vault
  updated_at        timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.staff_users (id) on delete set null,
  action       text not null,
  target_type  text not null,
  target_id    text,
  before       jsonb,
  after        jsonb,
  ip           inet,
  created_at   timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_target_idx on public.audit_logs (target_type, target_id, created_at desc);

create table if not exists public.data_change_backup (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.sites (id) on delete cascade,
  path         text not null,
  snapshot     jsonb,                            -- ค่าเดิมก่อนถูกเขียนทับ (null = doc ยังไม่มี)
  created_by   uuid references public.staff_users (id) on delete set null,
  created_at   timestamptz not null default now(),
  restored_at  timestamptz
);
create index if not exists data_change_backup_path_idx on public.data_change_backup (site_id, path, created_at desc);

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references public.staff_users (id) on delete cascade,
  channel     text not null default 'inapp',
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- โควตาเขียนข้อมูลของ Data Editor (ต่อเว็บ ต่อวัน)
create table if not exists public.write_quota_usage (
  site_id  uuid not null references public.sites (id) on delete cascade,
  day      date not null,
  used     integer not null default 0,
  primary key (site_id, day)
);

-- แทน BullMQ: บันทึกผลการรันงานที่ตั้งเวลาไว้
create table if not exists public.job_runs (
  id           uuid primary key default gen_random_uuid(),
  job_name     text not null,
  ok           boolean not null default true,
  error        text,
  duration_ms  integer,
  created_at   timestamptz not null default now()
);
create index if not exists job_runs_name_idx on public.job_runs (job_name, created_at desc);

create table if not exists public.feature_flags (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid references public.sites (id) on delete cascade,
  key         text not null,
  enabled     boolean not null default false,
  value       jsonb,
  updated_at  timestamptz not null default now(),
  unique (site_id, key)
);

-- ---------- trigger: updated_at ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['sites', 'site_costs', 'knowledge_docs', 'ai_faqs', 'ai_models', 'secrets', 'feature_flags']
  loop
    execute format(
      'drop trigger if exists %I on public.%I', 'trg_touch_' || t, t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      'trg_touch_' || t, t);
  end loop;
end $$;
