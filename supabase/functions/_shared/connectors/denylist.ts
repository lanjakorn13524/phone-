// path ที่ห้ามแก้ผ่าน Data Editor (ARCHITECTURE.md ข้อ 3.3 ชั้นที่ 6)
// เพิ่มรายการได้โดยแก้ที่นี่ที่เดียว

const DENYLIST: RegExp[] = [
  /^users\/[^/]+\/role$/,
  /^users\/[^/]+\/email$/,
  /^users\/[^/]+\/isAdmin$/,
  /^users\/[^/]+\/permissions(\/|$)/,
  /^admins(\/|$)/,
  /^billing(\/|$)/,
  /^secrets(\/|$)/,
  /^serviceAccounts(\/|$)/,
];

export const DENYLIST_PATTERNS = DENYLIST.map((re) => re.source);

export function normalizePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

export function checkPathAllowed(path: string): { ok: true; path: string } | { ok: false; reason: string } {
  const clean = normalizePath(path);

  if (!clean) return { ok: false, reason: 'path ว่าง' };
  if (DENYLIST.some((re) => re.test(clean))) {
    return { ok: false, reason: `path นี้อยู่ในรายการห้ามแก้: ${clean}` };
  }
  if (clean.split('/').length % 2 === 0) {
    return { ok: false, reason: 'path ต้องสลับ collection/doc เช่น pages/home' };
  }
  if (clean.includes('//')) return { ok: false, reason: 'path มี // ติดกัน' };
  return { ok: true, path: clean };
}
