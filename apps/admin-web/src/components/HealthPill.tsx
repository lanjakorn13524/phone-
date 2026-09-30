import type { HealthState } from '../lib/supabase';

const TONE: Record<HealthState, { label: string; className: string; dot: string }> = {
  up: { label: 'ออนไลน์', className: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  down: { label: 'ล่ม', className: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  maintenance: { label: 'ปิดเว็บชั่วคราว', className: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  unknown: { label: 'ยังไม่ทราบ', className: 'bg-zinc-100 text-zinc-600', dot: 'bg-zinc-400' },
};

export function HealthPill({ health, className = '' }: { health: HealthState; className?: string }) {
  const tone = TONE[health];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${tone.className} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}
