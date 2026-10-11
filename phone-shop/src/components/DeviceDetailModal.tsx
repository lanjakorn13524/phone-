import { useState } from 'react'
import { CameraIcon, TrashIcon } from './icons'
import { btnGhost, btnPrimary, inputClass, labelClass, Modal, Thumb } from './ui'
import { useBackend } from '../lib/backend'
import { baht } from '../lib/format'
import { useImageStore } from '../lib/images'
import type { Device } from '../lib/types'

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
  const images = useImageStore()

  const shop = snapshot.shops.find((s) => s.id === device.shopId)

  const [model, setModel] = useState(device.model)
  const [color, setColor] = useState(device.color)
  const [imei, setImei] = useState(device.imei)
  const [memory, setMemory] = useState(device.memory)
  const [battery, setBattery] = useState(device.battery)
  const [condition, setCondition] = useState(device.condition)
  const [costPrice, setCostPrice] = useState(String(device.costPrice))
  const [sellPrice, setSellPrice] = useState(String(device.sellPrice))
  const [deviceRefs, setDeviceRefs] = useState<string[]>(device.images.device)
  const [idCardRef, setIdCardRef] = useState<string | null>(device.images.idCard)
  const [busy, setBusy] = useState(false)

  const shopId = device.shopId
  const shopName = shop?.name ?? 'shop'

  async function addImages(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    const added: string[] = []
    let i = 0
    for (const file of Array.from(files)) {
      const ref = await images.put(file, {
        shopId,
        shopName,
        imei: imei.trim() || device.imei,
        kind: 'device',
        index: Date.now() + i,
      })
      added.push(ref)
      i += 1
    }
    setDeviceRefs((prev) => [...prev, ...added])
    setBusy(false)
  }

  async function replaceIdCard(file: File | undefined) {
    if (!file) return
    setBusy(true)
    const ref = await images.put(file, {
      shopId,
      shopName,
      imei: imei.trim() || device.imei,
      kind: 'idcard',
      index: Date.now(),
    })
    if (idCardRef) await images.remove(idCardRef)
    setIdCardRef(ref)
    setBusy(false)
  }

  async function removeDeviceImage(ref: string) {
    await images.remove(ref)
    setDeviceRefs((prev) => prev.filter((r) => r !== ref))
  }

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
      images: { device: deviceRefs, idCard: idCardRef },
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

        <div className="flex flex-wrap gap-2">
          {deviceRefs.map((ref) => (
            <div key={ref} className="relative">
              <Thumb imageRef={ref} alt="รูปเครื่อง" className="h-20 w-20 rounded-xl" />
              {!readOnly ? (
                <button
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white"
                  onClick={() => removeDeviceImage(ref)}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
          {idCardRef ? (
            <Thumb imageRef={idCardRef} alt="บัตรประชาชน" className="h-20 w-20 rounded-xl ring-2 ring-brand-400" />
          ) : null}
          {readOnly ? null : (
            <>
              <label className={`${btnGhost} h-20 cursor-pointer px-3`}>
                <CameraIcon className="h-4 w-4" />
                เพิ่มรูป
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void addImages(e.target.files)}
                />
              </label>
              <label className={`${btnGhost} h-20 cursor-pointer px-3`}>
                เปลี่ยนบัตร ปชช.
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void replaceIdCard(e.target.files?.[0])}
                />
              </label>
            </>
          )}
        </div>

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
