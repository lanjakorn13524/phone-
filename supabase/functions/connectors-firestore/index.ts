// จุดเดียวที่ระบบกลางเข้าถึงข้อมูลของเว็บย่อยได้
// ทุก action ผ่าน: ยืนยันผู้เรียก -> เช็ค role -> เช็ค path -> (เขียน) โควตา + backup + audit

import { FirestoreConnector } from '../_shared/connectors/firestoreConnector.ts';
import { ConnectorError } from '../_shared/connectors/types.ts';
import { createSupabaseAdmin, resolveCaller } from '../_shared/db.ts';
import { clientIp, fail, json, preflight, readBody } from '../_shared/http.ts';
import { loadSite, loadSiteConfig, makeDeps, toWriteContext } from '../_shared/siteConfig.ts';

interface RequestBody {
  action: 'ping' | 'count-members' | 'list-members' | 'list-collections' | 'read-doc' | 'write-doc';
  siteId: string;
  path?: string;
  data?: unknown;
  limit?: number;
  cursor?: string;
  reason?: string;
}

const READ_ROLES = ['super', 'admin', 'support', 'viewer'];

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const db = createSupabaseAdmin();

  try {
    const caller = await resolveCaller(req, db);
    if (!caller) return fail('ไม่ได้ยืนยันตัวตน หรือยังไม่ได้อยู่ในทีมงาน', 401);

    const body = await readBody<RequestBody>(req);
    if (!body.action || !body.siteId) return fail('ต้องส่ง action และ siteId', 422);

    const site = await loadSite(db, body.siteId);
    const config = await loadSiteConfig(db, site);
    const connector = new FirestoreConnector(config, makeDeps(db));

    switch (body.action) {
      case 'ping': {
        const result = await connector.ping();
        return json({ site: site.slug, ...result }, result.ok ? 200 : 502);
      }

      case 'count-members': {
        requireRole(caller.role, READ_ROLES);
        return json(await connector.countMembers(site));
      }

      case 'list-members': {
        requireRole(caller.role, READ_ROLES);
        const page = await connector.listMembers(site, {
          limit: clamp(body.limit ?? 50, 1, 200),
          cursor: body.cursor,
        });
        return json(page);
      }

      case 'list-collections': {
        requireRole(caller.role, READ_ROLES);
        return json({ collections: await connector.listCollections() });
      }

      case 'read-doc': {
        requireRole(caller.role, READ_ROLES);
        if (!body.path) return fail('ต้องส่ง path', 422);
        return json(await connector.readDoc(site, body.path));
      }

      case 'write-doc': {
        requireRole(caller.role, ['super', 'admin']);
        if (!body.path) return fail('ต้องส่ง path', 422);
        if (body.data === undefined) return fail('ต้องส่ง data', 422);
        if (!body.reason || body.reason.trim().length < 5) {
          return fail('ต้องระบุเหตุผล (อย่างน้อย 5 ตัวอักษร) — จะถูกบันทึกลง audit log', 422);
        }

        const result = await connector.writeDoc(
          site,
          body.path,
          body.data,
          toWriteContext(caller, clientIp(req), body.reason),
        );
        return json(result);
      }

      default:
        return fail(`ไม่รู้จัก action: ${String(body.action)}`, 400);
    }
  } catch (err) {
    if (err instanceof ConnectorError) return fail(err.message, err.status, { code: err.code });
    if (err instanceof Error && err.message.includes('quota_exceeded')) {
      return fail('เกินโควตาเขียนข้อมูลของวันนี้แล้ว', 429, { code: 'quota_exceeded' });
    }
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    return fail(message, 500);
  }
});

function requireRole(role: string, allowed: string[]): void {
  if (!allowed.includes(role)) {
    throw new ConnectorError(`role "${role}" ทำ action นี้ไม่ได้`, 'upstream_error', 403);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(n), min), max);
}
