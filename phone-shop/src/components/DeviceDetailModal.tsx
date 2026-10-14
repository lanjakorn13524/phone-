import { useState } from 'react'
import { btnGhost, btnPrimary, inputClass, labelClass, Modal } from './ui'
import { useBackend } from '../lib/backend'
import { baht } from '../lib/format'
import type { Device } from '../lib/types'

const CHECK_LABELS: Record<string, string> = {
  model: 'โมเดล / ภูมิภาค',
  accessories: 'มีอุปกรณ์อะไรบ้าง',
  parts: 'แจ้งเตือนเปลี่ยนชิ้นส่วน',
}

const PART_LABELS: Record<string, string> = {
  battery: 'แบตเตอรี่',
  screen: 'จอ',
  camera: 'กล้อง',
  frontcam: 'กล้องหน้า',
  faceid: 'Face ID',
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  )
}

export function DeviceDetailModal({
  device,
  readOnly,
  onClose,
}: {
  device: Device
  readOnly: boolean
  onClose: () => void
}) {
  const { snapshot, addDevice } = useBackend()

  const shop = snapshot.shops.find((s) => s.id === device.shopId)

  const [model, setModel] = useState(device.model)
  const [color, setColor] = useState(device.color)
  const [imei, setImei] = useState(device.imei)
  const [memory, setMemory] = useState(device.memory)
  const [battery, setBattery] = useState(device.battery)
  const [condition, setCondition] = useState(device.condition)
  const [costPrice, setCostPrice] = useState(String(device.costPrice))
  const [sellPrice, setSellPrice] = useState(String(device.sellPrice))
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const updated: Device = {
      ...device,
      model: model.trim(),
      color: color.trim(),
      imei: imei.trim(),
      memory: memory.trim(),
      battery: battery.trim(),
      condition: condition.trim(),
      costPrice: Number(costPrice) || 0,
      sellPrice: Number(sellPrice) || 0,
    }
    await addDevice(updated)
    setBusy(false)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={readOnly ? 'รายละเอียดเครื่อง' : 'แก้ไขรายละเอียดเครื่อง'}
      footer={
        readOnly ? (
          <button className={`${btnGhost} w-full`} onClick={onClose}>
            ปิด
          </button>
        ) : (
          <div className="flex gap-2">
            <button className={`${btnGhost} flex-1`} onClick={onClose} disabled={busy}>
              ยกเลิก
            </button>
            <button className={`${btnPrimary} flex-1`} onClick={save} disabled={busy}>
              {busy ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {shop ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">ร้าน: {shop.name}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>รุ่น</label>
            <input className={inputClass} value={model} disabled={readOnly} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>สี</label>
            <input className={inputClass} value={color} disabled={readOnly} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>ความจำ</label>
            <input className={inputClass} value={memory} disabled={readOnly} onChange={(e) => setMemory(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>IMEI</label>
            <input className={inputClass} value={imei} disabled={readOnly} onChange={(e) => setImei(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>แบตเตอรี่</label>
            <input className={inputClass} value={battery} disabled={readOnly} onChange={(e) => setBattery(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>ตำหนิ / สภาพ</label>
            <input className={inputClass} value={condition} disabled={readOnly} onChange={(e) => setCondition(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>ราคาทุน</label>
            <input className={inputClass} type="number" value={costPrice} disabled={readOnly} onChange={(e) => setCostPrice(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>ราคาขาย</label>
            <input className={inputClass} type="number" value={sellPrice} disabled={readOnly} onChange={(e) => setSellPrice(e.target.value)} />
          </div>
        </div>

        {device.checklist ? (
          <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">ข้อมูลตรวจเช็ค</p>
            {device.checklist.answers.model ? (
              <InfoRow label={CHECK_LABELS.model} value={device.checklist.answers.model} />
            ) : null}
            {(device.checklist.multiple.accessories ?? []).length > 0 ? (
              <InfoRow
                label={CHECK_LABELS.accessories}
                value={(device.checklist.multiple.accessories ?? []).join(', ')}
              />
            ) : null}
            {device.checklist.answers.parts ? (
              <InfoRow label={CHECK_LABELS.parts} value={device.checklist.answers.parts} />
            ) : null}
            {device.checklist.answers.parts === 'มีแจ้ง'
              ? Object.entries(device.checklist.parts)
                  .filter(([, v]) => v)
                  .map(([k, v]) => <InfoRow key={k} label={PART_LABELS[k] ?? k} value={v} />)
              : null}
            <InfoRow label="ตรวจโดย" value={device.checklist.checkedBy} />
          </div>
        ) : null}

        {readOnly ? (
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            กำไรคาดหวัง:{' '}
            <span className="font-semibold text-emerald-600">
              {baht((Number(sellPrice) || 0) - (Number(costPrice) || 0))}
            </span>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
