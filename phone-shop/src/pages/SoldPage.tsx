import { useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ReceiptIcon, TrashIcon } from '../components/icons'
import { btnDanger, btnGhost, cardClass } from '../components/ui'
import { useAuth } from '../lib/auth'
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

export function SoldPage() {
  const { activeShop, isStaff, isOwner, session } = useAuth()
  const { snapshot, deleteSale } = useBackend()
  const location = useLocation()
  const [month, setMonth] = useState(currentMonthKey())
  const [shopFilter, setShopFilter] = useState(() => {
    const sid = (location.state as { shopId?: string } | null)?.shopId
    return typeof sid === 'string' ? sid : ''
  })

  // Get owner's shop IDs for filtering
  const ownerShopIds = isOwner
    ? snapshot.shops.filter((s) => s.ownerId === session?.id).map((s) => s.id)
    : []

  const rangeShop = isStaff
    ? activeShop
    : shopFilter
    ? snapshot.shops.find((s) => s.id === shopFilter)
    : null
  const summaryDay = summaryDayOf(rangeShop)

  const sales = useMemo(() => {
    const single = isStaff || Boolean(shopFilter)
    const { start, end } = summaryRange(month, summaryDay)
    let filtered = snapshot.sales

    // Filter by owner's shops for owner role
    if (isOwner) {
      filtered = filtered.filter((s) => ownerShopIds.includes(s.shopId))
    } else if (isStaff) {
      filtered = filtered.filter((s) => s.shopId === activeShop?.id)
    } else if (shopFilter) {
      filtered = filtered.filter((s) => s.shopId === shopFilter)
    }

    return filtered
      .filter((s) => {
        if (single) return s.soldAt >= start && s.soldAt < end
        const shop = snapshot.shops.find((x) => x.id === s.shopId)
        const range = summaryRange(month, summaryDayOf(shop))
        return s.soldAt >= range.start && s.soldAt < range.end
      })
      .sort((a, b) => b.soldAt - a.soldAt)
  }, [snapshot.sales, snapshot.shops, isStaff, isOwner, activeShop?.id, shopFilter, month, summaryDay, ownerShopIds, session?.id])

  function shopName(shopId: string): string {
    return snapshot.shops.find((x) => x.id === shopId)?.name ?? 'ร้าน'
  }

  function sellerName(sale: Sale): string {
    if (sale.soldById) {
      const account = snapshot.accounts.find((a) => a.id === sale.soldById)
      if (account) return account.name
      const employee = snapshot.employees.find((e) => e.id === sale.soldById)
      if (employee) return employee.name
    }
    return sale.soldBy
  }

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

  async function remove(sale: Sale) {
    if (!window.confirm(`ลบรายการขาย ${sale.model} ออกจากประวัติเดือนนี้?`)) return
    await deleteSale(sale.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">ขายแล้ว</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {monthLabel(month)} ·{' '}
            {rangeShop
              ? `${rangeShop.name} · ตัดยอด ${summaryPeriodLabel(month, summaryDay)}`
              : 'รวมทุกร้าน'}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <ReceiptIcon className="h-5 w-5" />
        </div>
      </div>

      {!isStaff ? (
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              shopFilter === ''
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
            onClick={() => setShopFilter('')}
          >
            ทุกร้าน
          </button>
          {(isOwner
            ? snapshot.shops.filter((s) => s.ownerId === session?.id)
            : snapshot.shops
          ).map((s) => (
            <button
              key={s.id}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                shopFilter === s.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
              onClick={() => setShopFilter(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <button className={btnGhost} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          ‹ เดือนก่อน
        </button>
        <span className="text-sm font-semibold">{monthLabel(month)}</span>
        <button className={btnGhost} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          เดือนถัดไป ›
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="ขายได้" value={`${totals.count} เครื่อง`} />
        <Stat label="ยอดขาย" value={baht(totals.sell)} />
        <Stat label="ยอดทุน" value={baht(totals.cost)} />
        <Stat label="กำไร" value={baht(totals.profit)} accent />
      </div>

      {month !== currentMonthKey() ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          กำลังดูเดือนเก่า (เก็บถาวร) — เดือนใหม่จะเริ่มนับใหม่ และย้ายรายการเดือนก่อนออกให้อัตโนมัติ
        </p>
      ) : null}

      {sales.length === 0 ? (
        <div className={`${cardClass} p-10 text-center text-sm text-slate-400`}>
          ยังไม่มีการขายในเดือนนี้
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((s) => (
            <div key={s.id} className={`${cardClass} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.model}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {s.color} · {s.memory} · แบต {s.battery}
                  </p>
                  <p className="truncate text-xs text-slate-400">IMEI {s.imei}</p>
                  {!isStaff ? (
                    <p className="truncate text-[11px] text-brand-600 dark:text-brand-400">
                      {shopName(s.shopId)}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-brand-600 dark:text-brand-400">{baht(s.sellPrice)}</p>
                  <p className="text-xs text-emerald-600">กำไร {baht(s.profit)}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                {s.region ? (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                    โมเดล {s.region}
                  </span>
                ) : null}
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                  ทุน {baht(s.costPrice)}
                </span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                  {paymentLabel(s.paymentMethod)}
                </span>
                {s.freebies.case ? <Tag>เคส</Tag> : null}
                {s.freebies.film ? <Tag>ฟิล์ม</Tag> : null}
                {s.freebies.other ? <Tag>{s.freebies.otherNote || 'ของแถม'}</Tag> : null}
                <span className="ml-auto">
                  {dayLabel(s.soldAt)} · {timeLabel(s.soldAt)} · {sellerName(s)}
                </span>
              </div>

              {!isStaff ? (
                <div className="mt-3 flex gap-2">
                  <button className={`${btnDanger} py-2 text-xs`} onClick={() => remove(s)}>
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`${cardClass} p-3`}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-bold ${accent ? 'text-emerald-600' : ''}`}>{value}</p>
    </div>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
      {children}
    </span>
  )
}
