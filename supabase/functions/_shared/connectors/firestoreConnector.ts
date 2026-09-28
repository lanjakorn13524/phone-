// Firestore adapter — ทำตาม interface SiteConnector (ARCHITECTURE.md ข้อ 3.2)
// ทุกการเขียนต้องผ่าน 6 ชั้นความปลอดภัย (ข้อ 3.3) และ dependency ถูกส่งเข้ามาตอนสร้าง
// เพื่อให้ทดสอบ connector ได้โดยไม่ต้องต่อ Supabase จริง

import { checkPathAllowed } from './denylist.ts';
import { FirestoreRest, decodeDocument } from './firestoreRest.ts';
import {
  ConnectorError,
  type FirestoreSiteConfig,
  type MemberPage,
  type Site,
  type SiteConnector,
  type WriteContext,
  type WriteResult,
} from './types.ts';

/** subset ของ supabase-js ที่ใช้จริง ๆ (คงไว้เป็นโครงสร้างเพื่อไม่ผูกกับ SDK) */
export interface DbLike {
  from(table: string): {
    upsert(values: unknown, opts?: { onConflict?: string }): PromiseLike<{ error: unknown }>;
    insert(values: unknown): PromiseLike<{ error: unknown }>;
  };
}

export interface ConnectorDeps {
  claimQuota(siteId: string, day: string, limit: number): Promise<{ quotaUsed: number }>;
  recordWrite(
    site: Site,
    path: string,
    before: unknown,
    after: unknown,
    ctx: WriteContext,
  ): Promise<{ backupId: string }>;
}

export class FirestoreConnector implements SiteConnector {
  readonly type = 'firestore';
  private readonly rest: FirestoreRest;

  constructor(
    private readonly config: FirestoreSiteConfig,
    private readonly deps: ConnectorDeps,
  ) {
    this.rest = new FirestoreRest(config);
  }

  async ping() {
    const started = Date.now();
    try {
      await this.rest.ping();
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, error: (err as Error).message };
    }
  }

  async countMembers() {
    const col = this.config.members_collection;
    const total = await this.rest.count(col);

    let active = total;
    if (this.config.active_field) {
      active = await this.rest.count(col, {
        field: this.config.active_field,
        op: 'EQUAL',
        value: true,
      });
    }

    let newThisMonth = 0;
    if (this.config.joined_at_field) {
      const since = new Date();
      since.setUTCDate(1);
      since.setUTCHours(0, 0, 0, 0);
      newThisMonth = await this.rest.count(col, {
        field: this.config.joined_at_field,
        op: '>=',
        value: since,
      });
    }
    return { total, active, newThisMonth };
  }

  async listMembers(_site: Site, opts: { limit: number; cursor?: string }): Promise<MemberPage> {
    const res = await this.rest.listDocuments(this.config.members_collection, {
      limit: opts.limit,
      cursor: opts.cursor,
    });
    const members = res.documents
      .map((d) => decodeDocument(d))
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map((d) => ({ external_id: d.id, data: d.data }));
    return { members, next_cursor: res.nextPageToken };
  }

  async listCollections() {
    return (await this.rest.listCollectionIds()).map((name) => ({ name }));
  }

  async readDoc(_site: Site, path: string) {
    const check = checkPathAllowed(path);
    if (!check.ok) throw new ConnectorError(check.reason, 'denied_path', 403);

    const doc = await this.rest.getDocument(check.path);
    return { data: doc?.data ?? null, exists: doc !== null };
  }

  async writeDoc(site: Site, path: string, data: unknown, ctx: WriteContext): Promise<WriteResult> {
    // 1) path ต้องไม่ติด denylist
    const check = checkPathAllowed(path);
    if (!check.ok) throw new ConnectorError(check.reason, 'denied_path', 403);

    // 2) สิทธิ์
    if (ctx.actorRole !== 'super' && ctx.actorRole !== 'admin') {
      throw new ConnectorError('เขียนข้อมูลได้เฉพาะ admin ขึ้นไป', 'upstream_error', 403);
    }

    // 3) โควตารายวัน
    const day = new Date().toISOString().slice(0, 10);
    const { quotaUsed } = await this.deps.claimQuota(site.id, day, site.daily_quota);

    // 4) อ่านค่าเดิมไว้ก่อน (ใช้เป็น snapshot ย้อนกลับ)
    const before = await this.rest.getDocument(check.path);

    // 5) เขียน
    await this.rest.setDocument(check.path, data);

    // 6) audit + backup
    const { backupId } = await this.deps.recordWrite(site, check.path, before?.data ?? null, data, ctx);

    return { path: check.path, backupId, quotaUsed, quotaLimit: site.daily_quota };
  }
}
