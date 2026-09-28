// สัญญากลางของ connector — ทุกเว็บย่อยใช้ interface เดียวกันนี้
// เพิ่มเว็บใหม่ = สร้าง adapter ตัวใหม่ ไม่ต้องแก้ระบบกลาง (ARCHITECTURE.md ข้อ 3.2)

export interface ServiceAccountKey {
  type: string;
  project_id: string;
  client_email: string;
  private_key: string; // มี \n จริงในค่า
}

export interface FirestoreSiteConfig extends ServiceAccountKey {
  members_collection: string; // เช่น "users"
  active_field?: string; // เช่น "active" (bool) — ไม่มี = นับทั้งหมดเป็น active
  joined_at_field?: string; // เช่น "createdAt" (timestamp)
}

export interface Site {
  id: string;
  name: string;
  slug: string;
  connector_type: string;
  connector_config_ref: string | null;
  daily_quota: number;
}

export interface MemberPage {
  members: Array<{ external_id: string; data: unknown }>;
  next_cursor?: string;
}

export interface WriteContext {
  actorId: string | null;
  actorRole: string;
  ip?: string | null;
  reason: string;
}

export interface WriteResult {
  path: string;
  backupId: string;
  quotaUsed: number;
  quotaLimit: number;
}

export interface SiteConnector {
  readonly type: string;
  ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  countMembers(site: Site): Promise<{ total: number; active: number; newThisMonth: number }>;
  listMembers(site: Site, opts: { limit: number; cursor?: string }): Promise<MemberPage>;
  listCollections(site: Site): Promise<Array<{ name: string }>>;
  readDoc(site: Site, path: string): Promise<{ data: unknown; exists: boolean }>;
  writeDoc(site: Site, path: string, data: unknown, ctx: WriteContext): Promise<WriteResult>;
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not_found'
      | 'denied_path'
      | 'quota_exceeded'
      | 'not_configured'
      | 'upstream_error',
    readonly status = 400,
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}
