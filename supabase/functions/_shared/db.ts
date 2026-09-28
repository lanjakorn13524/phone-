// ตัวช่วยฝั่ง Edge Function (Deno) — service role client + การยืนยันผู้เรียก
// service_role key อยู่แค่ในฝั่งนี้ ห้ามส่งไป browser เด็ดขาด (ARCHITECTURE.md ข้อ 5/6)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function createSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface Caller {
  userId: string;
  email: string;
  role: 'super' | 'admin' | 'support' | 'viewer';
  isSystem: boolean; // true = เรียกจาก pg_cron / CI ด้วย service_role
}

export async function resolveCaller(req: Request, db: SupabaseClient): Promise<Caller | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData.user) return null;

  // service_role key เรียกได้แต่ไม่มี staff_users row = งานจากระบบ (cron / CI)
  const { data: staff } = await db
    .from('staff_users')
    .select('role, is_super_admin, email')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!staff) {
    if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      return { userId: 'system', email: 'system', role: 'super', isSystem: true };
    }
    return null; // ล็อกอินได้แต่ไม่ได้อยู่ในทีม = ไม่มีสิทธิ์
  }

  return {
    userId: userData.user.id,
    email: staff.email ?? userData.user.email ?? '',
    role: (staff.is_super_admin ? 'super' : staff.role) as Caller['role'],
    isSystem: false,
  };
}
