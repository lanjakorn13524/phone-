// ตัวช่วยฝั่ง Edge Function (Deno) — service role client + การยืนยันผู้เรียก
// service_role key อยู่แค่ในฝั่งนี้ ห้ามส่งไป browser เด็ดขาด (ARCHITECTURE.md ข้อ 5/6)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function createSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = SERVER_KEYS().values().next().value;
  if (!url || !key) throw new Error('missing SUPABASE_URL / service role key');

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

  // key ฝั่งเซิร์ฟเวอร์ (cron / CI) = ไม่ใช่ user → จบตรงนี้ ไม่ต้องไป auth
  if (await isSystemKey(db, token)) {
    return { userId: 'system', email: 'system', role: 'super', isSystem: true };
  }

  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData.user) return null;

  const { data: staff } = await db
    .from('staff_users')
    .select('role, is_super_admin, email')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!staff) return null; // ล็อกอินได้แต่ไม่ได้อยู่ในทีม = ไม่มีสิทธิ์

  return {
    userId: userData.user.id,
    email: staff.email ?? userData.user.email ?? '',
    role: (staff.is_super_admin ? 'super' : staff.role) as Caller['role'],
    isSystem: false,
  };
}

/**
 * key ฝั่งเซิร์ฟเวอร์ที่ถือว่าเป็น "งานจากระบบ" (pg_cron / CI)
 * รองรับทั้ง key แบบเก่า (service_role JWT) และแบบใหม่ (sb_secret_...) เพราะโปรเจกต์ใหม่
 * ของ Supabase ไม่มี legacy key ให้กดใน dashboard
 */
function SERVER_KEYS(): Set<string> {
  return new Set(
    [
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      Deno.env.get('SUPABASE_SECRET_KEY'),
    ].filter((k): k is string => Boolean(k)),
  );
}

/**
 * เทียบ token กับ key ฝั่งเซิร์ฟเวอร์ — เช็คทั้งค่าที่ platform inject ให้
 * และค่าใน Vault (`service_role_key`) ซึ่งเป็นตัวเดียวกับที่ pg_cron ใช้ยิงเข้ามา
 * (โปรเจกต์ที่ใช้ระบบ key ใหม่จะไม่มี legacy key ให้ inject ต้องอาศัย Vault)
 */
async function isSystemKey(db: SupabaseClient, token: string): Promise<boolean> {
  if (SERVER_KEYS().has(token)) return true;

  const { data, error } = await db.rpc('read_vault_secret', { p_key: 'service_role_key' });
  if (error) return false;

  // ฟังก์ชันคืน text ตรง ๆ PostgREST จึงส่ง string กลับมา (ไม่ได้ห่อเป็น object)
  const vaultKey = typeof data === 'string' ? data : (data as { read_vault_secret?: string } | null)?.read_vault_secret;
  return Boolean(vaultKey) && vaultKey === token;
}
