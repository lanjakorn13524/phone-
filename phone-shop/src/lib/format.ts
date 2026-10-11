const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

export function baht(n: number): string {
  return '฿' + Math.round(n).toLocaleString('en-US')
}

export function bahtPlain(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

export function dateKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${THAI_MONTHS[m - 1]} ${y + 543}`
}

export function dayLabel(ts: number): string {
  const d = new Date(ts)
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

export function shortDayLabel(ts: number): string {
  const d = new Date(ts)
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()].slice(0, 3)}.`
}

export function timeLabel(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function paymentLabel(p: string): string {
  if (p === 'cash') return 'เงินสด'
  if (p === 'transfer') return 'โอน'
  return 'บัตร'
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function monthRange(key: string): { start: number; end: number } {
  const [y, m] = key.split('-').map(Number)
  const start = new Date(y, m - 1, 1).getTime()
  const end = new Date(y, m, 1).getTime()
  return { start, end }
}

export function summaryRange(key: string, day: number): { start: number; end: number } {
  const [y, m] = key.split('-').map(Number)
  const mo = m - 1
  const daysThis = new Date(y, mo + 1, 0).getDate()
  const daysPrev = new Date(y, mo, 0).getDate()
  const cutoff = Math.min(day, daysThis)
  const prevCutoff = Math.min(day, daysPrev)
  const start = new Date(y, mo - 1, prevCutoff + 1).getTime()
  const end = new Date(y, mo, cutoff + 1).getTime()
  return { start, end }
}

export function summaryDayOf(shop: { summaryDay?: number } | null | undefined): number {
  const d = shop?.summaryDay
  return typeof d === 'number' && d >= 1 && d <= 31 ? d : 31
}

export function summaryDayLabel(day: number): string {
  return day >= 31 ? 'สิ้นเดือน' : `วันที่ ${day}`
}

export function summaryPeriodLabel(key: string, day: number): string {
  const { start, end } = summaryRange(key, day)
  return `${shortDayLabel(start)} – ${shortDayLabel(end - 1)}`
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function currentMonthKey(): string {
  return monthKey(Date.now())
}
