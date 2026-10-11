import { useMemo, useState } from 'react'
import { TrashIcon } from './icons'
import { btnDanger, btnGhost } from './ui'
import { useBackend } from '../lib/backend'
import {
  baht,
  currentMonthKey,
  dayLabel,
  monthLabel,
  paymentLabel,
  shiftMonth,
  summaryDayOf,
  summaryPeriodLabel,
  summaryRange,
  timeLabel,
} from '../lib/format'
import type { Sale } from '../lib/types'

export function ShopSalesSection({ shopId }: { shopId: string }) {
  const { snapshot, deleteSale } = useBackend()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(currentMonthKey())

  const shop = snapshot.shops.find((s) => s.id === shopId)
  const summaryDay = summaryDayOf(shop)

  const sales = useMemo(() => {
    const { start, end } = summaryRange(month, summaryDay)
    return snapshot.sales
      .filter((s) => s.shopId === shopId && s.soldAt >= start && s.soldAt < end)
      .sort((a, b) => b.soldAt - a.soldAt)
  }, [snapshot.sales, shopId, month, summaryDay])

  const totals = useMemo(
    () =>
      sales.reduce(
        (acc, s) => {
          acc.count += 1
          acc.sell += s.sellPrice
          acc.cost += s.costPrice
          acc.profit += s.profit
          return acc
        },
        { count: 0, sell: 0, cost: 0, profit: 0 },
      ),
    [sales],
  )

  function sellerName(sale: Sale): string {
    if (sale.soldById) {
      const account = snapshot.accounts.find((a) => a.id === sale.soldById)
      if (account) return account.name
      const employee = snapshot.employees.find((e) => e.id === sale.soldById)
      if (employee) return employee.name
    }
    return sale.soldBy
  }

  async function remove(sale: Sale) {
    if (!window.confirm(`ลบรายการขาย ${sale.model}?`)) return
    await deleteSale(sale.id)
  }

  return (
    <div className="border-t border-slate-100 p-4 dark:border-slate-800">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            สรุปยอดขาย (รายเดือน)
          </p>
          <p className="text-[11px] text-slate-400">
            {monthLabel(month)} · ตัดยอด {summaryPeriodLabel(month, summaryDay)} · {totals.count} เครื่อง · ยอดขาย {baht(totals.sell)} · กำไร {baht(totals.profit)}
          </p>
        </div>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button className={`${btnGhost} px-3 py-1.5 text-xs`} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
              ‹ เดือนก่อน
            </button>
            <span className="text-xs font-semibold">{monthLabel(month)}</span>
            <button className={`${btnGhost} px-3 py-1.5 text-xs`} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
              เดือนถัดไป ›
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
            <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/60">
              <p className="text-slate-500 dark:text-slate-400">ขายได้</p>
              <p className="mt-0.5 font-semibold">{totals.count}</p>
            </div>
            <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/60">
              <p className="text-slate-500 dark:text-slate-400">ยอดขาย</p>
              <p className="mt-0.5 font-semibold">{baht(totals.sell)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/60">
              <p className="text-slate-500 dark:text-slate-400">ทุน</p>
              <p className="mt-0.5 font-semibold">{baht(totals.cost)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/60">
              <p className="text-slate-500 dark:text-slate-400">กำไร</p>
              <p className="mt-0.5 font-semibold text-emerald-600">{baht(totals.profit)}</p>
            </div>
          </div>

          {sales.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">ไม่มีการขายในเดือนนี้</p>
          ) : (
            <div className="space-y-2">
              {sales.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.model}</p>
                      <p className="truncate text-[11px] text-slate-400">IMEI {s.imei}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-brand-600 dark:text-brand-400">{baht(s.sellPrice)}</p>
                      <p className="text-[11px] text-emerald-600">กำไร {baht(s.profit)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{paymentLabel(s.paymentMethod)}</span>
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      ขายโดย {sellerName(s)}
                    </span>
                    <span className="ml-auto">
                      {dayLabel(s.soldAt)} · {timeLabel(s.soldAt)}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className={`${btnDanger} py-1.5 text-xs`} onClick={() => remove(s)}>
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
