// โหลด config ของเว็บย่อย (service account) จาก Supabase Vault + ตัวช่วย DB
// credential ไม่เคยออกจากฝั่ง server — เขียนลง sites.connector_config_ref เป็น "ชื่อ key ใน vault"

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { FirestoreSiteConfig, Site, WriteContext } from './connectors/types.ts';
import type { DbLike } from './connectors/firestoreConnector.ts';
import type { Caller } from './db.ts';

export async function loadSite(db: SupabaseClient, siteId: string): Promise<Site> {
  const { data, error } = await db
    .from('sites')
    .select('id, name, slug, connector_type, connector_config_ref, daily_quota')
    .eq('id', siteId)
    .maybeSingle();

  if (error) throw new Error(`โหลดเว็บไม่สำเร็จ: ${error.message}`);
  if (!data) throw new Error(`ไม่พบเว็บ id=${siteId}`);
  return data as Site;
}

export async function loadSiteConfig(db: SupabaseClient, site: Site): Promise<FirestoreSiteConfig> {
  if (!site.connector_config_ref) {
    throw new Error(`เว็บ "${site.name}" ยังไม่ได้ตั้ง credential (connector_config_ref ว่าง)`);
  }

  const { data, error } = await db
    .rpc('read_site_config', { p_key: site.connector_config_ref })
    .maybeSingle();

  if (error) throw new Error(`อ่าน credential ไม่สำเร็จ: ${error.message}`);
  if (!data) throw new Error(`ไม่พบ secret "${site.connector_config_ref}" ใน Vault`);

  const raw = (data as { config: string | null }).config;
  if (!raw) throw new Error(`secret "${site.connector_config_ref}" ไม่มีค่า`);

  return JSON.parse(raw) as FirestoreSiteConfig;
}

/** นับโควตาเขียนข้อมูลแบบ atomic: เกินลิมิตต้อง error (ไม่ใช่เงียบ ๆ ไป) */
export async function claimQuota(
  db: SupabaseClient,
  siteId: string,
  day: string,
  limit: number,
): Promise<{ quotaUsed: number }> {
  const { data, error } = await db.rpc('claim_write_quota', {
    p_site_id: siteId,
    p_day: day,
    p_limit: limit,
  });
  if (error) throw new Error(`เช็คโควตาไม่สำเร็จ: ${error.message}`);
  return { quotaUsed: Number((data as { quota_used: number }).quota_used) };
}

/** audit + backup (ชั้นที่ 3 และ 5) */
export async function recordWrite(
  db: SupabaseClient,
  site: Site,
  path: string,
  before: unknown,
  after: unknown,
  ctx: WriteContext,
): Promise<{ backupId: string }> {
  const { data: backup, error: backupErr } = await db
    .from('data_change_backup')
    .insert({
      site_id: site.id,
      path,
      snapshot: before ?? null,
      created_by: ctx.actorId,
    })
    .select('id')
    .single();
  if (backupErr) throw new Error(`บันทึก backup ไม่สำเร็จ: ${backupErr.message}`);

  const { error: auditErr } = await db.from('audit_logs').insert({
    actor_id: ctx.actorId === 'system' ? null : ctx.actorId,
    action: 'firestore.write',
    target_type: 'firestore_doc',
    target_id: `${site.slug}/${path}`,
    before: before ?? null,
    after: after ?? null,
    ip: ctx.ip ?? null,
  });
  if (auditErr) throw new Error(`บันทึก audit ไม่สำเร็จ: ${auditErr.message}`);

  return { backupId: (backup as { id: string }).id };
}

export function makeDeps(db: SupabaseClient): {
  claimQuota: (siteId: string, day: string, limit: number) => Promise<{ quotaUsed: number }>;
  recordWrite: (
    site: Site,
    path: string,
    before: unknown,
    after: unknown,
    ctx: WriteContext,
  ) => Promise<{ backupId: string }>;
} {
  return {
    claimQuota: (siteId, day, limit) => claimQuota(db, siteId, day, limit),
    recordWrite: (site, path, before, after, ctx) => recordWrite(db, site, path, before, after, ctx),
  };
}

export function toWriteContext(caller: Caller, ip: string | null, reason: string): WriteContext {
  return {
    actorId: caller.isSystem ? null : caller.userId,
    actorRole: caller.role,
    ip,
    reason,
  };
}

/** ใช้ตอนอยากพิสูจน์ว่า client ที่ implement เป็น DB จริง */
export type { DbLike };
