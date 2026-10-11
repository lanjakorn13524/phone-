import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckIcon } from '../components/icons'
import { btnGhost, btnPrimary, cardClass, inputClass, labelClass } from '../components/ui'
import { useAuth } from '../lib/auth'
import { newId, useBackend } from '../lib/backend'
import type { Device, DeviceChecklist } from '../lib/types'

interface CheckRule {
  id: string
  label: string
  hint?: string
  group: 'info' | 'parts'
  options: string[]
  multiple?: boolean
}

const CHECKS: CheckRule[] = [
  { id: 'model', label: 'โมเดล / ภูมิภาค', options: ['ZP', 'TH', 'CH', 'LL', 'อื่นๆ'], group: 'info' },
  { id: 'accessories', label: 'มีอุปกรณ์อะไรบ้าง', hint: 'เลือกที่มี (เลือกได้หลายอย่าง)', options: ['สาย', 'กล่อง', 'ไม่มี'], multiple: true, group: 'info' },
  { id: 'parts', label: 'แจ้งเตือนเปลี่ยนชิ้นส่วน', options: ['มีแจ้ง', 'ไม่มีแจ้ง'], group: 'parts' },
]

const PARTS_GROUPS: CheckRule[] = [
  { id: 'battery', label: 'แบตเตอรี่', options: ['แท้', 'ใช้แล้ว', 'ไม่ทราบ', 'บริการ'], group: 'parts' },
  { id: 'screen', label: 'จอ', options: ['แท้', 'ใช้แล้ว', 'ไม่ทราบ', 'บริการ'], group: 'parts' },
  { id: 'camera', label: 'กล้อง', options: ['ใช้แล้ว', 'มีปัญหา', 'ไม่รู้จัก'], group: 'parts' },
  { id: 'frontcam', label: 'กล้องหน้า', options: ['ใช้แล้ว', 'มีปัญหา', 'ไม่รู้จัก'], group: 'parts' },
  { id: 'faceid', label: 'Face ID', options: ['ปกติ', 'มีปัญหา'], group: 'parts' },
]

const MEMORY_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB']
const RAM_OPTIONS = ['4GB', '6GB', '8GB', '12GB', '16GB']

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300'
      }`}
    >
      {label}
    </button>
  )
}

export function AddPage() {
  const { activeShop, session } = useAuth()
  const { addDevice } = useBackend()
  const navigate = useNavigate()

  const [answer, setAnswer] = useState<Record<string, string>>({})
  const [multi, setMulti] = useState<Record<string, string[]>>({})
  const [partsDetail, setPartsDetail] = useState<Record<string, string>>({})

  const [model, setModel] = useState('')
  const [color, setColor] = useState('')
  const [imei, setImei] = useState('')
  const [platform, setPlatform] = useState<'iphone' | 'android'>('iphone')
  const [memory, setMemory] = useState('')
  const [ram, setRam] = useState('')
  const [battery, setBattery] = useState('')
  const [condition, setCondition] = useState('')
  const [costPrice, setCostPrice] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<{ model: string; imei: string } | null>(null)

  const profitPreview = useMemo(() => {
    const cost = Number(costPrice) || 0
    const sell = Number(sellPrice) || 0
    return sell - cost
  }, [costPrice, sellPrice])

  function resetForm() {
    setAnswer({})
    setMulti({})
    setPartsDetail({})
    setModel('')
    setColor('')
    setImei('')
    setMemory('')
    setRam('')
    setPlatform('iphone')
    setBattery('')
    setCondition('')
    setCostPrice('')
    setSellPrice('')
    setError(null)
  }

  function pick(rule: CheckRule, value: string) {
    if (rule.multiple) {
      const cur = multi[rule.id] ?? []
      if (value === 'ไม่มี') {
        setMulti({ ...multi, [rule.id]: cur.includes('ไม่มี') ? [] : ['ไม่มี'] })
        return
      }
      const base = cur.filter((v) => v !== 'ไม่มี')
      setMulti({
        ...multi,
        [rule.id]: base.includes(value) ? base.filter((v) => v !== value) : [...base, value],
      })
      return
    }
    setAnswer((prev) => (prev[rule.id] === value ? { ...prev, [rule.id]: '' } : { ...prev, [rule.id]: value }))
  }

  async function save() {
    if (!activeShop) return
    if (!model.trim() || !imei.trim()) {
      setError('ต้องมีรุ่นและ IMEI')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const checklist: DeviceChecklist = {
        answers: answer,
        multiple: multi,
        parts: partsDetail,
        checkedBy: session?.name ?? 'พนักงาน',
        checkedAt: Date.now(),
      }

      const memoryLabel =
        platform === 'android' ? [ram, memory.trim()].filter(Boolean).join('+') : memory.trim()

      const device: Device = {
        id: newId('dev'),
        shopId: activeShop.id,
        model: model.trim(),
        color: color.trim(),
        memory: memoryLabel,
        battery: battery.trim(),
        imei: imei.trim(),
        condition: condition.trim(),
        costPrice: Number(costPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
        images: { device: [], idCard: null },
        createdAt: Date.now(),
        createdBy: session?.name ?? 'พนักงาน',
        checklist,
      }
      await addDevice(device)
      setConfirmed({ model: device.model, imei: device.imei })
      resetForm()
    } catch {
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง (ตรวจการเชื่อมต่อ Firebase / Cloud)')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">เพิ่มเครื่อง</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">กรอกข้อมูลและตรวจเช็คให้ครบก่อนบันทึกเข้าสต็อก</p>
        </div>
        <button className={btnGhost} onClick={resetForm}>
          เริ่มใหม่
        </button>
      </div>

      <div className={`${cardClass} space-y-4 p-4`}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>ระบบ</label>
            <div className="flex flex-wrap gap-1.5">
              {(['ไอโฟน', 'แอนดรอย'] as const).map((opt) => {
                const value = opt === 'ไอโฟน' ? 'iphone' : 'android'
                return (
                  <Chip
                    key={value}
                    label={opt}
                    active={platform === value}
                    onClick={() => {
                      setPlatform(value)
                      if (value === 'android') {
                        setAnswer((prev) => ({ ...prev, model: '', parts: '' }))
                        setPartsDetail({})
                      }
                    }}
                  />
                )
              })}
            </div>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>รุ่น</label>
            <input className={inputClass} value={model} onChange={(e) => setModel(e.target.value)} placeholder="เช่น iPhone 14 Pro" />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>สี</label>
            <input className={inputClass} value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          {platform === 'android' && (
            <div className="col-span-2">
              <label className={labelClass}>แรม (RAM)</label>
              <div className="flex flex-wrap gap-1.5">
                {RAM_OPTIONS.map((opt) => (
                  <Chip
                    key={opt}
                    label={opt}
                    active={ram === opt}
                    onClick={() => setRam((r) => (r === opt ? '' : opt))}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="col-span-2">
            <label className={labelClass}>{platform === 'android' ? 'ความจุ' : 'ความจำ'}</label>
            <div className="flex flex-wrap gap-1.5">
              {MEMORY_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  active={memory === opt}
                  onClick={() => setMemory((m) => (m === opt ? '' : opt))}
                />
              ))}
            </div>
          </div>
          {CHECKS.filter(
            (rule) => !(platform === 'android' && (rule.id === 'model' || rule.id === 'parts')),
          ).map((rule) => {
            const selected = rule.multiple ? multi[rule.id] ?? [] : answer[rule.id]
            return (
              <div key={rule.id} className="col-span-2">
                <label className={labelClass}>
                  {rule.label}
                  {rule.hint ? <span className="ml-1 font-normal text-slate-400">{rule.hint}</span> : null}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {rule.options.map((opt) => (
                    <Chip
                      key={opt}
                      label={opt}
                      active={rule.multiple ? selected.includes(opt) : selected === opt}
                      onClick={() => pick(rule, opt)}
                    />
                  ))}
                </div>

                {rule.id === 'parts' && answer.parts === 'มีแจ้ง' ? (
                  <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    {PARTS_GROUPS.map((pg) => (
                      <div key={pg.id}>
                        <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                          {pg.label}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {pg.options.map((opt) => (
                            <Chip
                              key={opt}
                              label={opt}
                              active={partsDetail[pg.id] === opt}
                              onClick={() =>
                                setPartsDetail((prev) =>
                                  prev[pg.id] === opt ? { ...prev, [pg.id]: '' } : { ...prev, [pg.id]: opt },
                                )
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
          <div className="col-span-2">
            <label className={labelClass}>IMEI</label>
            <input className={inputClass} value={imei} onChange={(e) => setImei(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <label className={labelClass}>แบตเตอรี่</label>
            <input className={inputClass} value={battery} onChange={(e) => setBattery(e.target.value)} placeholder="90%" />
          </div>
          <div>
            <label className={labelClass}>ตำหนิ / สภาพ</label>
            <input className={inputClass} value={condition} onChange={(e) => setCondition(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>ราคาทุน</label>
            <input className={inputClass} type="number" inputMode="numeric" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>ราคาขาย</label>
            <input className={inputClass} type="number" inputMode="numeric" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
          กำไรคาดหวัง:{' '}
          <span className={profitPreview >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-red-500'}>
            {profitPreview.toLocaleString('en-US')} บาท
          </span>
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <button className={`${btnPrimary} w-full`} onClick={save} disabled={busy}>
          {busy ? 'กำลังบันทึก...' : 'บันทึกเข้าสต็อก'}
        </button>
      </div>

      {confirmed ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onClick={() => navigate('/stock')}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
              <CheckIcon className="h-6 w-6 text-emerald-600" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">เพิ่มเครื่องสำเร็จ</h2>
            <p className="mx-auto mt-1.5 max-w-[90%] text-sm text-slate-500 dark:text-slate-400">
              รุ่น {confirmed.model} · IMEI {confirmed.imei}{activeShop ? ` เข้าสต็อก ${activeShop.name}` : ''} แล้ว
            </p>
            <button
              className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              onClick={() => navigate('/stock')}
            >
              ดูสต็อก
            </button>
            <button
              className="mt-2 w-full rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setConfirmed(null)}
            >
              เพิ่มเครื่องต่อ
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
