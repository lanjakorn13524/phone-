import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChartIcon } from '../components/icons'
import { btnGhost, cardClass } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useBackend } from '../lib/backend'
import {
  baht,
  currentMonthKey,
  dateKey,
  monthLabel,
  monthRange,
  shortDayLabel,
  shiftMonth,
} from '../lib/format'
import type { Sale } from '../lib/types'

interface Totals {
  count: number
  sell: number
  cost: number
  profit: number
}

function sumSales(sales: Sale[]): Totals {
  return sales.reduce(
    (acc, s) => {
      acc.count += 1
      acc.sell += s.sellPrice
      acc.cost += s.costPrice
      acc.profit += s.profit
      return acc
    },
    { count: 0, sell: 0, cost: 0, profit: 0 },
  )
}

function inMonth(sales: Sale[], month: string): Sale[] {
  const { start, end } = monthRange(month)
  return sales.filter((s) => s.soldAt >= start && s.soldAt < end)
}

export function DashboardPage() {
  const { activeShop, isStaff } = useAuth()
  if (isStaff) return <StaffDashboard shopId={activeShop?.id ?? ''} />
  return <MultiShopDashboard />
}

function StaffDashboard({ shopId }: { shopId: string }) {
  const { snapshot } = useBackend()
  const [month, setMonth] = useState(currentMonthKey())
  const [compareMonth, setCompareMonth] = useState(shiftMonth(currentMonthKey(), -1))

  const shopSales = useMemo(() => snapshot.sales.filter((s) => s.shopId === shopId), [snapshot.sales, shopId])
  const monthSales = useMemo(() => inMonth(shopSales, month), [shopSales, month])
  const compareSales = useMemo(() => inMonth(shopSales, compareMonth), [shopSales, compareMonth])
  const totals = useMemo(() => sumSales(monthSales), [monthSales])
  const compareTotals = useMemo(() => sumSales(compareSales), [compareSales])

  const shop = snapshot.shops.find((s) => s.id === shopId)
  const health = healthOf(totals.profit, compareTotals.profit)

  return (
    <div className="space-y-4">
      <Header title="แดชบอร์ด" subtitle="ข้อมูลเฉพาะร้านนี้" />

      <MonthNav month={month} setMonth={setMonth} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="ขายได้" value={`${totals.count} เครื่อง`} />
        <Metric label="ยอดขาย" value={baht(totals.sell)} />
        <Metric label="ยอดทุน" value={baht(totals.cost)} />
        <Metric label="กำไร" value={baht(totals.profit)} accent />
      </div>

      <ShopStatusGrid
        items={[
          {
            id: shopId,
            name: shop?.name ?? 'ร้านนี้',
            profit: totals.profit,
            status: health.status,
            goals: health.goals,
          },
        ]}
      />

      <DailyChart sales={monthSales} />

      <CompareCard
        month={month}
        compareMonth={compareMonth}
        setCompareMonth={setCompareMonth}
        a={totals}
        b={compareTotals}
      />

      <ValueBreakdown sales={shopSales} />
    </div>
  )
}

function MultiShopDashboard() {
  const { snapshot } = useBackend()
  const [month, setMonth] = useState(currentMonthKey())
  const [compareMonth, setCompareMonth] = useState(shiftMonth(currentMonthKey(), -1))

  const monthSales = useMemo(() => inMonth(snapshot.sales, month), [snapshot.sales, month])
  const compareSales = useMemo(() => inMonth(snapshot.sales, compareMonth), [snapshot.sales, compareMonth])
  const combined = useMemo(() => sumSales(monthSales), [monthSales])
  const compareCombined = useMemo(() => sumSales(compareSales), [compareSales])

  const perShop = snapshot.shops.map((shop) => {
    const totals = sumSales(monthSales.filter((s) => s.shopId === shop.id))
    const prevTotals = sumSales(compareSales.filter((s) => s.shopId === shop.id))
    const health = healthOf(totals.profit, prevTotals.profit)
    return { id: shop.id, name: shop.name, profit: totals.profit, status: health.status, goals: health.goals }
  })

  return (
    <div className="space-y-4">
      <Header title="แดชบอร์ด" subtitle={`ทุกร้าน · ${snapshot.shops.length} ร้าน`} />

      <MonthNav month={month} setMonth={setMonth} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="ขายรวม" value={`${combined.count} เครื่อง`} />
        <Metric label="ยอดขายรวม" value={baht(combined.sell)} />
        <Metric label="ยอดทุนรวม" value={baht(combined.cost)} />
        <Metric label="กำไรรวม" value={baht(combined.profit)} accent />
      </div>

      <ShopStatusGrid items={perShop} />

      <ValueBreakdown sales={snapshot.sales} />

      <DailyChart sales={monthSales} />

      <CompareCard
        month={month}
        compareMonth={compareMonth}
        setCompareMonth={setCompareMonth}
        a={combined}
        b={compareCombined}
      />
    </div>
  )
}

type HealthStatus = 'within' | 'observe' | 'critical'

const STATUS_META: Record<HealthStatus, { label: string; dot: string }> = {
  within: { label: 'ตามเป้า', dot: 'bg-emerald-500' },
  observe: { label: 'ต้องปรับปรุง', dot: 'bg-amber-500' },
  critical: { label: 'ต่ำกว่าเป้า', dot: 'bg-red-500' },
}

function healthOf(profit: number, prevProfit: number): { status: HealthStatus; goals: number } {
  if (prevProfit <= 0) {
    return profit > 0 ? { status: 'within', goals: 3 } : { status: 'critical', goals: 0 }
  }
  const ratio = profit / prevProfit
  const status: HealthStatus = ratio >= 0.9 ? 'within' : ratio >= 0.5 ? 'observe' : 'critical'
  return { status, goals: Math.min(5, Math.max(0, Math.round(ratio * 5))) }
}

function ShopStatusGrid({
  items,
}: {
  items: { id: string; name: string; profit: number; status: HealthStatus; goals: number }[]
}) {
  const navigate = useNavigate()
  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="grid grid-cols-1 divide-y divide-slate-200/70 dark:divide-slate-800 md:grid-cols-2 md:divide-y-0 md:divide-x xl:grid-cols-3">
        {items.map((item) => {
          const meta = STATUS_META[item.status]
          return (
            <div
              key={item.id}
              className="group relative flex flex-col gap-5 p-5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <span className="flex shrink-0 items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
                  {meta.label}
                </span>
              </div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {baht(item.profit)}
                <span className="ml-1.5 text-sm font-normal text-slate-400 dark:text-slate-500">กำไร</span>
              </p>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">เป้าหมาย</span>
                  <span className="font-medium tabular-nums">{item.goals}/5</span>
                </div>
                <div className="mt-2 flex gap-1" aria-hidden>
                  {[1, 2, 3, 4, 5].map((g) => (
                    <span
                      key={g}
                      className={`h-1.5 flex-1 rounded-full ${
                        g <= item.goals ? meta.dot : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() => navigate('/sold', { state: { shopId: item.id } })}
                className="flex w-fit items-center gap-1 text-sm font-medium text-brand-600 transition hover:text-brand-700 dark:text-brand-400"
              >
                ดูยอดขายร้านนี้
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ValueBreakdown({ sales }: { sales: Sale[] }) {
  const rows = useMemo(() => {
    const base = currentMonthKey()
    return [0, 1, 2].map((i) => {
      const key = shiftMonth(base, -i)
      const prev = shiftMonth(base, -(i + 1))
      const cur = sumSales(inMonth(sales, key)).profit
      const before = sumSales(inMonth(sales, prev)).profit
      const diff = cur - before
      const pct = before !== 0 ? Math.round((diff / before) * 100) : cur !== 0 ? 100 : 0
      return { key, profit: cur, pct }
    })
  }, [sales])

  return (
    <div className={`${cardClass} p-4`}>
      <h2 className="text-sm font-semibold">กำไร 3 เดือนล่าสุด</h2>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">เทียบกับเดือนก่อนหน้าของแต่ละเดือน</p>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-center justify-between py-2.5">
            <p className="text-sm font-medium">
              {monthLabel(r.key)}
              {i === 0 ? <span className="ml-1 text-xs text-slate-400">(เดือนนี้)</span> : null}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums">{baht(r.profit)}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                  r.pct >= 0
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400'
                }`}
              >
                {r.pct >= 0 ? '+' : ''}
                {r.pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
        <ChartIcon className="h-5 w-5" />
      </div>
    </div>
  )
}

function MonthNav({ month, setMonth }: { month: string; setMonth: (fn: (m: string) => string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button className={btnGhost} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
        ‹
      </button>
      <span className="text-sm font-semibold">{monthLabel(month)}</span>
      <button className={btnGhost} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
        ›
      </button>
    </div>
  )
}

function DailyChart({ sales }: { sales: Sale[] }) {
  const byDay = useMemo(() => {
    const map = new Map<string, Totals>()
    for (const s of sales) {
      const key = dateKey(s.soldAt)
      const cur = map.get(key) ?? { count: 0, sell: 0, cost: 0, profit: 0 }
      cur.count += 1
      cur.sell += s.sellPrice
      cur.cost += s.costPrice
      cur.profit += s.profit
      map.set(key, cur)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [sales])

  const maxDaySell = Math.max(1, ...byDay.map(([, t]) => t.sell))

  return (
    <div className={`${cardClass} p-4`}>
      <h2 className="mb-3 text-sm font-semibold">ยอดขายรายวัน</h2>
      {byDay.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">ยังไม่มียอดขายในเดือนนี้</p>
      ) : (
        <div className="space-y-2.5">
          {byDay.map(([key, t]) => {
            const ts = new Date(`${key}T12:00:00`).getTime()
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{shortDayLabel(ts)}</span>
                  <span className="font-medium">
                    {baht(t.sell)} · {t.count} เครื่อง ·{' '}
                    <span className="text-emerald-600">กำไร {baht(t.profit)}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.max(4, (t.sell / maxDaySell) * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CompareCard({
  month,
  compareMonth,
  setCompareMonth,
  a,
  b,
}: {
  month: string
  compareMonth: string
  setCompareMonth: (fn: (m: string) => string) => void
  a: Totals
  b: Totals
}) {
  return (
    <div className={`${cardClass} p-4`}>
      <h2 className="mb-3 text-sm font-semibold">เปรียบเทียบเดือน</h2>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">เดือนนี้</p>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium dark:bg-slate-800/60">
            {monthLabel(month)}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">เทียบกับ</p>
          <div className="flex items-center gap-1">
            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 text-sm dark:border-slate-700"
              onClick={() => setCompareMonth((m) => shiftMonth(m, -1))}
            >
              ‹
            </button>
            <span className="flex-1 rounded-xl bg-slate-50 px-2 py-2 text-center text-xs font-medium dark:bg-slate-800/60">
              {monthLabel(compareMonth)}
            </span>
            <button
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 text-sm dark:border-slate-700"
              onClick={() => setCompareMonth((m) => shiftMonth(m, 1))}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <CompareRow label="จำนวนเครื่อง" a={a.count} b={b.count} unit=" เครื่อง" />
        <CompareRow label="ยอดขาย" a={a.sell} b={b.sell} money />
        <CompareRow label="ยอดทุน" a={a.cost} b={b.cost} money />
        <CompareRow label="กำไร" a={a.profit} b={b.profit} money accent />
      </div>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`${cardClass} p-3`}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-bold ${accent ? 'text-emerald-600' : ''}`}>{value}</p>
    </div>
  )
}

function CompareRow({
  label,
  a,
  b,
  money,
  unit,
  accent,
}: {
  label: string
  a: number
  b: number
  money?: boolean
  unit?: string
  accent?: boolean
}) {
  const diff = a - b
  const fmt = (n: number) => (money ? baht(n) : `${n}${unit ?? ''}`)
  const pct = b !== 0 ? Math.round((diff / b) * 100) : a !== 0 ? 100 : 0
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${accent ? 'text-emerald-600' : ''}`}>{fmt(a)}</span>
        <span className="text-xs text-slate-400">vs {fmt(b)}</span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
            diff >= 0
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400'
          }`}
        >
          {diff >= 0 ? '+' : ''}
          {pct}%
        </span>
      </div>
    </div>
  )
}
