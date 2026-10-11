import { useMemo, useState } from 'react'
import { DeviceDetailModal } from '../components/DeviceDetailModal'
import { SellModal } from '../components/SellModal'
import { BoxIcon, PencilIcon, SearchIcon } from '../components/icons'
import { btnGhost, btnPrimary, cardClass, inputClass, Lightbox, Thumb } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useBackend } from '../lib/backend'
import { baht } from '../lib/format'
import type { Device } from '../lib/types'

export function StockPage() {
  const { activeShop, isStaff, isAdmin } = useAuth()
  const { snapshot } = useBackend()
  const [query, setQuery] = useState('')
  const [shopFilter, setShopFilter] = useState('')
  const [selling, setSelling] = useState<Device | null>(null)
  const [detail, setDetail] = useState<{ device: Device; readOnly: boolean } | null>(null)
  const [viewer, setViewer] = useState<{ refs: string[]; index: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const devices = useMemo(() => {
    const q = query.trim().toLowerCase()
    return snapshot.devices
      .filter((d) => (isStaff ? d.shopId === activeShop?.id : shopFilter ? d.shopId === shopFilter : true))
      .filter((d) =>
        q ? [d.model, d.imei, d.color, d.memory].some((v) => v.toLowerCase().includes(q)) : true,
      )
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [snapshot.devices, isStaff, activeShop?.id, shopFilter, query])

  const totalValue = devices.reduce((sum, d) => sum + d.sellPrice, 0)

  function shopName(shopId: string): string {
    return snapshot.shops.find((s) => s.id === shopId)?.name ?? 'ร้าน'
  }

  function openViewer(device: Device, index: number) {
    const refs = [...device.images.device]
    if (device.images.idCard) refs.push(device.images.idCard)
    if (refs.length === 0) return
    setViewer({ refs, index })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">สต็อกทั้งหมด</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {devices.length} เครื่อง · มูลค่ารวม {baht(totalValue)}
            {isStaff ? '' : ' · ทุกร้าน'}
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
          {snapshot.shops.map((s) => (
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

      {devices.length === 0 ? (
        <div className={`${cardClass} p-10 text-center text-sm text-slate-400`}>
          ยังไม่มีเครื่องในสต็อก
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {devices.map((d) => (
            <div key={d.id} className={`${cardClass} overflow-hidden`}>
              <Thumb
                imageRef={d.images.device[0]}
                alt={d.model}
                className="aspect-square w-full"
                onClick={() => openViewer(d, 0)}
              />
              <div className="space-y-2 p-3">
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
                {isStaff ? (
                  <button className={`${btnPrimary} w-full py-2 text-xs`} onClick={() => setSelling(d)}>
                    ขาย
                  </button>
                ) : isAdmin ? (
                  <button className={`${btnGhost} w-full py-2 text-xs`} onClick={() => setDetail({ device: d, readOnly: false })}>
                    <PencilIcon className="h-3.5 w-3.5" /> แก้ไข
                  </button>
                ) : (
                  <button className={`${btnGhost} w-full py-2 text-xs`} onClick={() => setDetail({ device: d, readOnly: true })}>
                    ดูรายละเอียด
                  </button>
                )}
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

      {viewer ? (
        <Lightbox refs={viewer.refs} startIndex={viewer.index} onClose={() => setViewer(null)} />
      ) : null}

      {toast ? (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
