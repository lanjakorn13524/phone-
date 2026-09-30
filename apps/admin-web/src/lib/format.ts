// ฟอร์แมตย่อย ๆ สำหรับหน้า Dashboard — ไม่พึ่งไลบรารีเพิ่ม

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(iso: string | null): string {
  if (!iso) return 'ยังไม่เคยตรวจ';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '—';
  if (diff < 45 * 1000) return 'เมื่อสักครู่';
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} นาทีที่แล้ว`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} ชั่วโมงที่แล้ว`;
  return `${Math.round(diff / DAY)} วันที่แล้ว`;
}

export function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('th-TH');
}

export function fmtMs(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${n.toLocaleString('th-TH')} ms`;
}

export function fmtBaht(n: string | number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const value = typeof n === 'string' ? Number(n) : n;
  return `฿${value.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${n.toLocaleString('th-TH', { maximumFractionDigits: 1 })}%`;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}
