// รับไฟล์ pg_dump จาก GitHub Actions แล้วเก็บลง Supabase Storage (ARCHITECTURE.md ข้อ 9.1 #1)
// หมายเหตุ: pg_dump เป็น client binary — รันใน pg_cron ไม่ได้ จึงรันใน CI แล้วส่งเข้ามาที่นี่
// ข้อดี: service_role key ไม่เคยอยู่ใน CI, CI ต้องมี token ที่ผูกกับชื่อไฟล์เท่านั้น

import { createSupabaseAdmin } from '../_shared/db.ts';
import { fail, json, preflight } from '../_shared/http.ts';

const BUCKET = 'backups';
const MAX_BYTES = 200 * 1024 * 1024;
const KEEP_DAILY_DAYS = 7;
const KEEP_MONTHLY = 12;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const db = createSupabaseAdmin();

  try {
    if (req.method !== 'POST') return fail('ใช้ POST เท่านั้น', 405);

    const expected = Deno.env.get('BACKUP_UPLOAD_TOKEN');
    const provided = req.headers.get('x-backup-token');
    if (!expected) return fail('ยังไม่ได้ตั้ง BACKUP_UPLOAD_TOKEN', 500);
    if (!provided || provided !== expected) return fail('token ไม่ถูกต้อง', 401);

    const filename = sanitize(req.headers.get('x-filename') ?? '');
    if (!filename) return fail('ต้องส่ง x-filename', 422);

    const body = new Uint8Array(await req.arrayBuffer());
    if (body.byteLength === 0) return fail('ไฟล์ว่าง', 422);
    if (body.byteLength > MAX_BYTES) return fail('ไฟล์ใหญ่เกิน 200 MB', 413);

    // ต้องเป็น gzip จริง (magic bytes 1f 8b) — กันส่งอะไรมากวน
    if (body[0] !== 0x1f || body[1] !== 0x8b) return fail('ไม่ใช่ไฟล์ gzip', 415);

    const path = `${new Date().toISOString().slice(0, 10)}/${filename}`;

    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(path, body, { contentType: 'application/gzip', upsert: true });
    if (upErr) throw new Error(`อัปโหลดไม่สำเร็จ: ${upErr.message}`);

    const pruned = await prune(db);

    return json({
      ok: true,
      path,
      bytes: body.byteLength,
      mb: Math.round((body.byteLength / 1024 / 1024) * 100) / 100,
      pruned,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', 500);
  }
});

function sanitize(name: string): string | null {
  const base = name.replace(/[^A-Za-z0-9._-]/g, '');
  return base.endsWith('.sql.gz') ? base : null;
}

/** เก็บ 7 วันล่าสุด + ของวันที่ 1 ของแต่ละเดือนย้อนหลัง 12 เดือน ที่เหลือลบทิ้ง */
async function prune(db: ReturnType<typeof createSupabaseAdmin>): Promise<string[]> {
  const { data: list, error } = await db.storage.from(BUCKET).list('', { limit: 1000 });
  if (error || !list) return [];

  const cutoff = Date.now() - KEEP_DAILY_DAYS * 86_400_000;
  const keepMonths = new Set<string>();
  const now = new Date();
  for (let i = 0; i < KEEP_MONTHLY; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keepMonths.add(d.toISOString().slice(0, 7));
  }

  const stale: string[] = [];
  for (const folder of list) {
    if (folder.name < cutoff.toISOString().slice(0, 10)) {
      stale.push(`${folder.name}/`);
      continue;
    }
    const day = Number(folder.name.slice(8, 10));
    if (day !== 1) continue; // เก็บแค่ไฟล์ของวันที่ 1 เป็นรายเดือน
    if (keepMonths.has(folder.name.slice(0, 7))) stale.push(`${folder.name}/`);
    else {
      const { data: files } = await db.storage.from(BUCKET).list(folder.name, { limit: 100 });
      for (const f of files ?? []) stale.push(`${folder.name}/${f.name}`);
    }
  }

  if (stale.length > 0) await db.storage.from(BUCKET).remove(stale);
  return stale;
}
