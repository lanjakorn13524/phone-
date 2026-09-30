// เรียก Edge Function ฝั่ง server (service_role ไม่เคยออกจากฝั่งนี้)
// ใช้โทเคนของ staff ที่ล็อกอิู่แล้ว — supabase-js แนบ access token ให้เอง

import { supabase } from './supabase';

export interface CheckRunResult {
  checked: number;
  failed: number;
  durationMs: number;
  results: Array<{ site: string; checked: string[]; skipped?: string }>;
}

/** สั่งตรวจสุขภาพ: ไม่ส่ง siteId = เช็คทุกเว็บ */
export async function runHealthCheck(siteId?: string): Promise<CheckRunResult> {
  const { data, error } = await supabase.functions.invoke('check-sites', {
    body: siteId ? { siteId } : {},
  });
  if (error) throw new Error(error.message);
  return data as CheckRunResult;
}
