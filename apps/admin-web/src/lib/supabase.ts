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
  created_at: string;
  updated_at: string;
}
