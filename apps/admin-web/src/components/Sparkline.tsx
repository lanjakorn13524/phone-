import type { HealthPoint } from '../lib/supabase';

/** แท่งสีสัญญาณจากผลตรวจล่าสุด (เขียว = ผ่าน, แดง = ไม่ผ่าน, สูง = ช้า) */
export function Sparkline({ points }: { points: HealthPoint[] }) {
  if (points.length === 0) {
    return <p className="text-xs text-zinc-400">ยังไม่มีผลตรวจ</p>;
  }

  const max = Math.max(...points.map((p) => p.ms ?? 0), 1);

  return (
    <div className="flex h-9 items-end gap-[2px]" title={`ผลตรวจ ${points.length} ครั้งล่าสุด`}>
      {points.map((p, i) => (
        <span
          key={`${p.at}-${i}`}
          className={p.ok ? 'bg-emerald-400' : 'bg-red-500'}
          style={{ height: `${p.ok ? Math.max(20, ((p.ms ?? max) / max) * 100) : 100}%` }}
        />
      ))}
    </div>
  );
}
