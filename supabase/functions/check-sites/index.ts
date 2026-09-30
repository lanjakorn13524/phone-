// ตรวจสุขภาพเว็บย่อยทุกเว็บ แล้วบันทึกลง site_health_checks
// เรียกโดย pg_cron ทุก 5 นาที (cron_check_sites) หรือกดปุ่ม "ตรวจสอบตอนนี้" ในหน้า Dashboard
// ตรวจ 2 อย่าง: เว็บตอบกลับไหม (http) และต่อฐานข้อมูลของเว็บได้ไหม (connector)

import { FirestoreConnector } from '../_shared/connectors/firestoreConnector.ts';
import { createSupabaseAdmin, resolveCaller } from '../_shared/db.ts';
import { fail, json, preflight, readBody } from '../_shared/http.ts';
import { loadSiteConfig } from '../_shared/siteConfig.ts';

interface RequestBody {
  siteId?: string; // ไม่ส่ง = เช็คทุกเว็บ (ใช้ตอนกดปุ่มรีเฟรช / cron)
}

interface MonitorSite {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  health_path: string;
  monitor_enabled: boolean;
  monitor_interval_minutes: number;
  connector_type: string;
  connector_config_ref: string | null;
}

interface CheckRow {
  site_id: string;
  kind: 'http' | 'connector';
  ok: boolean;
  latency_ms: number | null;
  http_status: number | null;
  error: string | null;
}

const HTTP_TIMEOUT_MS = 8000;
const CONNECTOR_MAX_AGE_MS = 60 * 60 * 1000; // ping connector ทุกชั่วโมงพอ
const MAX_ERROR_LEN = 300;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const db = createSupabaseAdmin();

  try {
    const caller = await resolveCaller(req, db);
    if (!caller) return fail('ไม่ได้ยืนยันตัวตน หรือยังไม่ได้อยู่ในทีมงาน', 401);
    if (!caller.isSystem && caller.role !== 'super' && caller.role !== 'admin') {
      return fail('สั่งตรวจสุขภาพได้เฉพาะ admin ขึ้นไป', 403);
    }

    const body = await readBody<RequestBody>(req);
    const force = Boolean(body.siteId); // กดปุ่ม = เช็คเว็บนั้นทันที ไม่สนรอบเวลา

    let query = db
      .from('sites')
      .select(
        'id, name, slug, domain, health_path, monitor_enabled, monitor_interval_minutes, connector_type, connector_config_ref',
      )
      .eq('monitor_enabled', true)
      .order('created_at', { ascending: true });

    if (body.siteId) query = query.eq('id', body.siteId);

    const { data, error } = await query;
    if (error) throw new Error(`โหลดรายชื่อเว็บไม่สำเร็จ: ${error.message}`);

    const sites = (data ?? []) as MonitorSite[];
    if (body.siteId && sites.length === 0) return fail('ไม่พบเว็บที่เลือก', 404);

    const started = Date.now();
    const rows: CheckRow[] = [];
    const results: Array<{ site: string; checked: string[]; skipped?: string }> = [];

    for (const site of sites) {
      const checked: string[] = [];
      const skipped: string[] = [];
      let httpDone = false;

      try {
        if (!site.domain) {
          skipped.push('ยังไม่ได้ใส่ domain — เช็คแค่ต่อฐานข้อมูล');
        } else if (force || (await dueForHttp(db, site))) {
          rows.push(await checkHttp(site));
          checked.push('http');
          httpDone = true;
        }

        if (site.connector_config_ref) {
          if (force || (await dueForConnector(db, site))) {
            rows.push(await checkConnector(db, site));
            checked.push('connector');
          }
        } else {
          skipped.push('ยังไม่ได้ตั้ง credential');
        }
      } catch (err) {
        // เกิดข้อผิดพลาดที่ตัววนสูงรอบ (เช่น query พัง) — บันทึกเป็นผลตรวจที่ไม่ผ่าน
        const message = cleanError(err);
        skipped.push(message);
        rows.push({
          site_id: site.id,
          kind: httpDone ? 'connector' : 'http',
          ok: false,
          latency_ms: null,
          http_status: null,
          error: message,
        });
      }

      results.push({ site: site.slug, checked, skipped: skipped.length > 0 ? skipped.join('; ') : undefined });
    }

    if (rows.length > 0) {
      const { error: insertErr } = await db.from('site_health_checks').insert(rows);
      if (insertErr) throw new Error(`บันทึกผลตรวจไม่สำเร็จ: ${insertErr.message}`);
    }

    const down = rows.filter((r) => !r.ok);
    await db.from('job_runs').insert({
      job_name: force ? 'check-sites:manual' : 'check-sites',
      ok: down.length === 0,
      error: down.length > 0 ? `${down.length} รายการไม่ผ่าน` : null,
      duration_ms: Date.now() - started,
    });

    return json({
      checked: rows.length,
      failed: down.length,
      durationMs: Date.now() - started,
      results,
    });
  } catch (err) {
    return fail(cleanError(err), 500);
  }
});

/** ถึงรอบตาม monitor_interval_minutes หรือยัง */
async function dueForHttp(db: ReturnType<typeof createSupabaseAdmin>, site: MonitorSite) {
  return isStale(db, site, 'http', site.monitor_interval_minutes * 60_000);
}

async function dueForConnector(db: ReturnType<typeof createSupabaseAdmin>, site: MonitorSite) {
  return isStale(db, site, 'connector', CONNECTOR_MAX_AGE_MS);
}

async function isStale(
  db: ReturnType<typeof createSupabaseAdmin>,
  site: MonitorSite,
  kind: 'http' | 'connector',
  maxAgeMs: number,
): Promise<boolean> {
  const { data } = await db
    .from('site_health_checks')
    .select('checked_at')
    .eq('site_id', site.id)
    .eq('kind', kind)
    .order('checked_at', { ascending: false })
    .limit(1);

  const last = (data as Array<{ checked_at: string }> | null)?.[0]?.checked_at;
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= maxAgeMs;
}

async function checkHttp(site: MonitorSite): Promise<CheckRow> {
  const url = `https://${site.domain}${normalizePath(site.health_path)}`;
  const started = Date.now();

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      headers: { 'user-agent': 'control-plane-monitor/1.0' },
    });
    // กิน body ทิ้งเพื่อให้ connection กลับเข้า pool เร็ว
    await res.body?.cancel();

    return {
      site_id: site.id,
      kind: 'http',
      ok: res.status < 400,
      latency_ms: Date.now() - started,
      http_status: res.status,
      error: res.status < 400 ? null : `ตอบกลับ ${res.status} ${res.statusText}`.slice(0, MAX_ERROR_LEN),
    };
  } catch (err) {
    return {
      site_id: site.id,
      kind: 'http',
      ok: false,
      latency_ms: Date.now() - started,
      http_status: null,
      error: cleanError(err),
    };
  }
}

async function checkConnector(
  db: ReturnType<typeof createSupabaseAdmin>,
  site: MonitorSite,
): Promise<CheckRow> {
  const started = Date.now();
  try {
    const siteRow = {
      id: site.id,
      name: site.name,
      slug: site.slug,
      connector_type: site.connector_type,
      connector_config_ref: site.connector_config_ref,
      daily_quota: 0,
    };
    const config = await loadSiteConfig(db, siteRow as never);
    const result = await new FirestoreConnector(config, {
      claimQuota: async () => ({ quotaUsed: 0 }),
      recordWrite: async () => ({ backupId: '' }),
    }).ping();

    return {
      site_id: site.id,
      kind: 'connector',
      ok: result.ok,
      latency_ms: result.latencyMs,
      http_status: null,
      error: result.ok ? null : (result.error ?? 'เชื่อมต่อไม่ได้').slice(0, MAX_ERROR_LEN),
    };
  } catch (err) {
    return {
      site_id: site.id,
      kind: 'connector',
      ok: false,
      latency_ms: Date.now() - started,
      http_status: null,
      error: cleanError(err),
    };
  }
}

function normalizePath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function cleanError(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err);
  const cause = (err as { cause?: { code?: string } } | null)?.cause?.code;
  const text = cause ? `${base} (${cause})` : base;
  return text.slice(0, MAX_ERROR_LEN);
}
