// ดึงจำนวนสมาชิกของทุกเว็บมาลง site_member_stats — เรียกโดย pg_cron เวลา 02:07 ทุกวัน
// หน้าที่ของฟังก์ชันนี้คือ "ดึงตัวเลข" เท่านั้น รายชื่อสมาชิกไม่ copy เข้าระบบกลาง (ARCHITECTURE.md ข้อ 9.1 #6)

import { FirestoreConnector } from '../_shared/connectors/firestoreConnector.ts';
import { createSupabaseAdmin, resolveCaller } from '../_shared/db.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { loadSite, loadSiteConfig } from '../_shared/siteConfig.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const db = createSupabaseAdmin();

  try {
    const caller = await resolveCaller(req, db);
    if (!caller?.isSystem) return fail('เรียกได้จากระบบเท่านั้น (pg_cron / CI)', 403);

    const { data: sites, error } = await db
      .from('sites')
      .select('id, name, slug, connector_type, connector_config_ref, daily_quota')
      .neq('status', 'down');
    if (error) throw new Error(`โหลดรายชื่อเว็บไม่สำเร็จ: ${error.message}`);

    const results: Array<{ site: string; ok: boolean; total?: number; error?: string }> = [];

    for (const site of sites ?? []) {
      try {
        const config = await loadSiteConfig(db, site as never);
        const stats = await new FirestoreConnector(config, {
          claimQuota: async () => ({ quotaUsed: 0 }),
          recordWrite: async () => ({ backupId: '' }),
        }).countMembers();

        const { error: upErr } = await db.from('site_member_stats').upsert(
          { site_id: site.id, ...stats, captured_at: new Date().toISOString() },
          { onConflict: 'site_id' },
        );
        if (upErr) throw new Error(upErr.message);

        results.push({ site: site.slug, ok: true, total: stats.total });
      } catch (err) {
        results.push({
          site: site.slug,
          ok: false,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    await db.from('job_runs').insert({
      job_name: 'sync-member-stats',
      ok: okCount === results.length,
      error: results.filter((r) => !r.ok).map((r) => `${r.site}: ${r.error}`).join('; ') || null,
      duration_ms: null,
    });

    return json({ synced: okCount, total: results.length, results });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 500);
  }
});
