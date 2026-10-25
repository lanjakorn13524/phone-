import { useMemo, useState } from 'react'
import { DeviceDetailModal } from '../components/DeviceDetailModal'
import { SellModal } from '../components/SellModal'
import { BoxIcon, PencilIcon, SearchIcon, TrashIcon } from '../components/icons'
import { btnGhost, btnPrimary, cardClass, inputClass } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useBackend } from '../lib/backend'
import { baht } from '../lib/format'
import type { Device } from '../lib/types'

const NO_OWNER = '__none__'

export function StockPage() {
  const { activeShop, isStaff, isAdmin, isOwner, session } = useAuth()
  const { snapshot, deleteDevice } = useBackend()
  const [query, setQuery] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [selling, setSelling] = useState<Device | null>(null)
  const [detail, setDetail] = useState<{ device: Device; readOnly: boolean } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const shopById = useMemo(() => new Map(snapshot.shops.map((s) => [s.id, s])), [snapshot.shops])

  // Owner and staff can see stock across every branch with the same owner.
  const visibleShopIds = useMemo(() => {
    if (isOwner) {
      return snapshot.shops.filter((shop) => shop.ownerId === session?.id).map((shop) => shop.id)
    }
    if (isStaff && activeShop) {
      if (!activeShop.ownerId) return [activeShop.id]
      return snapshot.shops.filter((shop) => shop.ownerId === activeShop.ownerId).map((shop) => shop.id)
    }
    return []
  }, [snapshot.shops, isOwner, isStaff, session?.id, activeShop])

  function ownerIdOfShop(shopId: string): string {
    return shopById.get(shopId)?.ownerId ?? NO_OWNER
  }

  function ownerName(id: string): string {
    if (id === NO_OWNER) return 'สต็อกกลาง (ไม่มีเจ้าของ)'
    const account = snapshot.accounts.find((a) => a.id === id)
    if (account) return account.name
    const employee = snapshot.employees.find((e) => e.id === id)
    return employee?.name ?? 'ไม่ทราบเจ้าของ'
  }

  const devices = useMemo(() => {
    const q = query.trim().toLowerCase()
    let filtered = snapshot.devices

    if (isOwner || isStaff) {
      filtered = filtered.filter((d) => visibleShopIds.includes(d.shopId))
    } else if (ownerFilter) {
      filtered = filtered.filter((d) => ownerIdOfShop(d.shopId) === ownerFilter)
    }

    return filtered
      .filter((d) =>
        q ? [d.model, d.imei, d.color, d.memory].some((v) => v.toLowerCase().includes(q)) : true,
      )
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [snapshot.devices, isStaff, isOwner, ownerFilter, query, visibleShopIds, shopById])

  // จัดกลุ่มสต็อกตามเจ้าของ (แอดมิน) — เจ้าของเห็นรวมทุกสาขาของตัวเองเป็นกลุ่มเดียว
  const groups = useMemo(() => {
    if (isStaff) {
      return [{ key: 'shop', label: 'สต็อกรวมของเจ้าของเดียวกัน', devices }]
    }
    if (isOwner) {
      const names = new Set(devices.map((d) => shopById.get(d.shopId)?.name).filter(Boolean))
      return [{ key: 'mine', label: `สต็อกรวมของฉัน · ${names.size} สาขา`, devices }]
    }
    const map = new Map<string, Device[]>()
    for (const d of devices) {
      const key = ownerIdOfShop(d.shopId)
      const list = map.get(key) ?? []
      list.push(d)
      map.set(key, list)
    }
    const order = Array.from(map.keys())
    return order.map((key) => ({ key, label: ownerName(key), devices: map.get(key) ?? [] }))
  }, [devices, isStaff, isOwner, shopById, snapshot.accounts, snapshot.employees])

  const ownerFilterOptions = useMemo(() => {
    const ids = new Set<string>()
    snapshot.shops.forEach((s) => ids.add(s.ownerId ?? NO_OWNER))
    return Array.from(ids).map((id) => ({ id, name: ownerName(id) }))
  }, [snapshot.shops, snapshot.accounts, snapshot.employees])

  const totalValue = devices.reduce((sum, d) => sum + d.sellPrice, 0)

  function shopName(shopId: string): string {
    return shopById.get(shopId)?.name ?? 'ร้าน'
  }

  function openDetail(device: Device) {
    setDetail({ device, readOnly: !isAdmin })
  }

  async function handleDeleteDevice(device: Device) {
    if (!window.confirm(`ลบเครื่อง "${device.model}" (IMEI: ${device.imei}) ออกจากสต็อก?`)) return
    await deleteDevice(device.id)
    setToast(`ลบ ${device.model} แล้ว`)
    window.setTimeout(() => setToast(null), 2500)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">สต็อกทั้งหมด</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {devices.length} เครื่อง · มูลค่ารวม {baht(totalValue)}
            {isStaff
              ? visibleShopIds.length > 1 ? ' · รวมทุกสาขาของเจ้าของเดียวกัน' : ''
              : isOwner ? ' · รวมทุกสาขาของฉัน' : ' · จัดกลุ่มตามเจ้าของ'}
          </p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <BoxIcon className="h-5 w-5" />
        </div>
      </div>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className={`${inputClass} pl-9`}
          placeholder="ค้นหารุ่น / IMEI / สี"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              ownerFilter === ''
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
            onClick={() => setOwnerFilter('')}
          >
            ทุกเจ้าของ
          </button>
          {ownerFilterOptions.map((o) => (
            <button
              key={o.id}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                ownerFilter === o.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
              onClick={() => setOwnerFilter(o.id)}
            >
              {o.name}
            </button>
          ))}
        </div>
      ) : null}

      {devices.length === 0 ? (
        <div className={`${cardClass} p-10 text-center text-sm text-slate-400`}>
          ยังไม่มีเครื่องในสต็อก
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key} className="space-y-3">
              {!isStaff || visibleShopIds.length > 1 ? (
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{group.label}</h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {group.devices.length} เครื่อง · {baht(group.devices.reduce((sum, d) => sum + d.sellPrice, 0))}
                  </span>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.devices.map((d) => (
                  <div key={d.id} className={`${cardClass} relative overflow-hidden`}>
                    {isAdmin || isOwner ? (
                      <button
                        type="button"
                        aria-label="ลบเครื่อง"
                        title="ลบเครื่อง"
                        className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border border-red-200 bg-white text-red-500 shadow-sm transition hover:bg-red-50 dark:border-red-500/40 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteDevice(d)
                        }}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    ) : null}
                    <div className="cursor-pointer" onClick={() => openDetail(d)}>
                      <div className={`space-y-2 px-3 pt-3 ${isAdmin || isOwner ? 'pr-11' : ''}`}>
                        <div>
                          <p className="truncate text-sm font-semibold">{d.model}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {d.color} · {d.memory}
                          </p>
                          {!isStaff ? (
                            <p className="truncate text-[11px] text-brand-600 dark:text-brand-400">
                              {shopName(d.shopId)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                          {d.checklist?.answers.model ? (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                              โมเดล {d.checklist.answers.model}
                            </span>
                          ) : null}
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                            แบต {d.battery}
                          </span>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                            ทุน {baht(d.costPrice)}
                          </span>
                        </div>
                        <p className="text-base font-bold text-brand-600 dark:text-brand-400">
                          {baht(d.sellPrice)}
                        </p>
                      </div>
                    </div>
                    <div className="px-3 pb-3 pt-3">
                      {isStaff ? (
                        <button className={`${btnPrimary} w-full py-2 text-xs`} onClick={() => setSelling(d)}>
                          ขาย
                        </button>
                      ) : isAdmin || isOwner ? (
                        <div className="flex gap-2">
                          <button className={`${btnPrimary} flex-1 py-2 text-xs`} onClick={() => setSelling(d)}>
                            ขาย
                          </button>
                          <button className={`${btnGhost} flex-1 py-2 text-xs`} onClick={() => setDetail({ device: d, readOnly: false })}>
                            <PencilIcon className="h-3.5 w-3.5" /> แก้ไข
                          </button>
                        </div>
                      ) : (
                        <button className={`${btnGhost} w-full py-2 text-xs`} onClick={() => setDetail({ device: d, readOnly: true })}>
                          ดูรายละเอียด
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selling ? (
        <SellModal
          device={selling}
          onClose={() => setSelling(null)}
          onSold={() => {
            setSelling(null)
            setToast(`ขาย ${selling.model} แล้ว และลบรูปเครื่องออกแล้ว`)
            window.setTimeout(() => setToast(null), 3000)
          }}
        />
      ) : null}

      {detail ? (
        <DeviceDetailModal device={detail.device} readOnly={detail.readOnly} onClose={() => setDetail(null)} />
      ) : null}

      {toast ? (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
