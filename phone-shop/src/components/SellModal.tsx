import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useBackend, newId } from '../lib/backend'
import { baht, paymentLabel } from '../lib/format'
import { useImageStore } from '../lib/images'
import type { Device, Freebies, PaymentMethod, Sale } from '../lib/types'
import { btnGhost, btnPrimary, inputClass, labelClass, Modal } from './ui'

const PAYMENTS: PaymentMethod[] = ['cash', 'transfer', 'card']

export function SellModal({
  device,
  onClose,
  onSold,
}: {
  device: Device
  onClose: () => void
  onSold: () => void
}) {
  const { session } = useAuth()
  const { completeSale } = useBackend()
  const images = useImageStore()

  const [sellPrice, setSellPrice] = useState(device.sellPrice)
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [freebies, setFreebies] = useState<Freebies>({
    case: false,
    film: false,
    other: false,
    otherNote: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const profit = sellPrice - device.costPrice

  async function confirm() {
    if (sellPrice <= 0) {
      setError('ใส่ราคาขายก่อนนะ')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const sale: Sale = {
        id: newId('sale'),
        shopId: device.shopId,
        deviceId: device.id,
        model: device.model,
        color: device.color,
        memory: device.memory,
        battery: device.battery,
        imei: device.imei,
        condition: device.condition,
        region: device.checklist?.answers.model || undefined,
        costPrice: device.costPrice,
        sellPrice,
        profit,
        paymentMethod: payment,
        freebies,
        soldAt: Date.now(),
        soldBy: session?.name ?? 'พนักงาน',
        soldById: session?.id,
        hadImages: device.images.device.length > 0 || Boolean(device.images.idCard),
      }
      await images.removeMany([...device.images.device, device.images.idCard])
      await completeSale(sale, device.id)
      onSold()
    } catch {
      setError('บันทึกการขายไม่สำเร็จ ลองใหม่')
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="ขายเครื่อง"
      footer={
        <div className="flex gap-2">
          <button className={`${btnGhost} flex-1`} onClick={onClose} disabled={busy}>
            ยกเลิก
          </button>
          <button className={`${btnPrimary} flex-1`} onClick={confirm} disabled={busy}>
            {busy ? 'กำลังบันทึก...' : 'บันทึกการขาย'}
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
        <p className="font-semibold">{device.model}</p>
        <p className="text-slate-500 dark:text-slate-400">
          {device.color} · {device.memory} · แบต {device.battery} · IMEI {device.imei}
        </p>
        {device.checklist?.answers.model ? (
          <p className="text-slate-500 dark:text-slate-400">โมเดล / ภูมิภาค {device.checklist.answers.model}</p>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelClass}>ราคาขาย</label>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            value={sellPrice}
            onChange={(e) => setSellPrice(Number(e.target.value))}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">ราคาทุน</span>
            <span>{baht(device.costPrice)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">ราคาขาย</span>
            <span>{baht(sellPrice)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-dashed border-slate-200 pt-2 text-base font-semibold dark:border-slate-700">
            <span>กำไร</span>
            <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-500'}>{baht(profit)}</span>
          </div>
        </div>

        <div>
          <label className={labelClass}>ช่องทางชำระเงิน</label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPayment(p)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                  payment === p
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                    : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {paymentLabel(p)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>ของแถม</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={freebies.case}
                onChange={(e) => setFreebies((f) => ({ ...f, case: e.target.checked }))}
              />
              เคส
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={freebies.film}
                onChange={(e) => setFreebies((f) => ({ ...f, film: e.target.checked }))}
              />
              ฟิล์ม
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={freebies.other}
                onChange={(e) => setFreebies((f) => ({ ...f, other: e.target.checked }))}
              />
              อื่นๆ
            </label>
            {freebies.other ? (
              <input
                className={inputClass}
                placeholder="ระบุของแถมอื่นๆ"
                value={freebies.otherNote}
                onChange={(e) => setFreebies((f) => ({ ...f, otherNote: e.target.value }))}
              />
            ) : null}
          </div>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>
    </Modal>
  )
}
