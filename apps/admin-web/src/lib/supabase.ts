import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — ดู .env.example แล้วสร้าง apps/admin-web/.env.local',
  );
}

export const supabase = createClient(url, anonKey);

export type StaffRole = 'super' | 'admin' | 'support' | 'viewer';

export interface StaffUser {
  id: string;
  email: string;
  name: string | null;
  role: StaffRole;
  is_super_admin: boolean;
}

export async function loadStaff(userId: string): Promise<StaffUser | null> {
  const { data, error } = await supabase
    .from('staff_users')
    .select('id, email, name, role, is_super_admin')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as StaffUser | null) ?? null;
}

export interface SiteRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  stack: string | null;
  hosting_provider: string | null;
  connector_type: string;
  status: 'active' | 'maintenance' | 'down';
  version: string | null;
  daily_quota: number;
  connector_config_ref: string | null;
  monitor_enabled: boolean;
  monitor_interval_minutes: number;
  health_path: string;
  created_at: string;
  updated_at: string;
}

// ---------- วิวสำหรับหน้า Dashboard (supabase/migrations/0005_uptime.sql) ----------

export type HealthState = 'up' | 'down' | 'maintenance' | 'unknown';

export interface SiteOverviewRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  stack: string | null;
  hosting_provider: string | null;
  declared_status: 'active' | 'maintenance' | 'down';
  version: string | null;
  monitor_enabled: boolean;
  monitor_interval_minutes: number;
  health_path: string;
  connector_type: string;
  connector_config_ref: string | null;
  health: HealthState;
  last_checked_at: string | null;
  latency_ms: number | null;
  http_status: number | null;
  last_error: string | null;
  checks_24h: number | null;
  uptime_24h: number | null;
  avg_latency_ms: number | null;
  max_latency_ms: number | null;
  connector_ok: boolean | null;
  connector_latency_ms: number | null;
  connector_checked_at: string | null;
  connector_error: string | null;
  members_total: number | null;
  members_active: number | null;
  members_new_this_month: number | null;
  due_this_month: string | null;
}

export interface HealthPoint {
  at: string;
  ok: boolean;
  ms: number | null;
}

export interface SparkRow {
  site_id: string;
  points: HealthPoint[] | null;
}

export interface FailureRow {
  id: number;
  site_id: string;
  site_name: string;
  slug: string;
  kind: 'http' | 'connector';
  error: string | null;
  http_status: number | null;
  checked_at: string;
}

