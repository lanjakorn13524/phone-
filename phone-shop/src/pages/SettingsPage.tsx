import { useEffect, useState } from 'react'
import {
  LogoutIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from '../components/icons'
import {
  btnDanger,
  cardClass,
  Thumb,
} from '../components/ui'
import { useAuth } from '../lib/auth'
import { useBackend } from '../lib/backend'
import { useImageStore } from '../lib/images'
import { useTheme } from '../lib/theme'
import type { Snapshot } from '../lib/types'

export function SettingsPage() {
  const { isStaff, isOwner } = useAuth()
  if (isStaff) return <StaffSettings />
  if (isOwner) return <OwnerSettings />
  return <AdminSettings />
}

function ThemeCard() {
  const { theme, setTheme } = useTheme()
  return (
    <div className={`${cardClass} flex items-center justify-between p-4`}>
      <div>
        <p className="text-sm font-semibold">โหมดแสดงผล</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {theme === 'dark' ? 'โหมดมืด' : 'โหมดสว่าง'}
        </p>
      </div>
      <div className="flex overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700">
        <button
          className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
            theme === 'light' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'
          }`}
          onClick={() => setTheme('light')}
        >
          <SunIcon className="h-4 w-4" /> สว่าง
        </button>
        <button
          className={`flex items-center gap-1.5 px-3 py-2 text-sm ${
            theme === 'dark' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'
          }`}
          onClick={() => setTheme('dark')}
        >
          <MoonIcon className="h-4 w-4" /> มืด
        </button>
      </div>
    </div>
  )
}

function ModeBadges() {
  const { mode } = useBackend()
  const images = useImageStore()
  return (
    <div className={`${cardClass} flex flex-wrap items-center gap-2 p-4 text-xs`}>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        ข้อมูล: {mode === 'firebase' ? 'Firebase' : 'Local (demo)'}
      </span>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        รูปภาพ: {images.mode === 'drive' ? 'Google Drive' : 'Local (demo)'}
      </span>
    </div>
  )
}

function useFlash() {
  const [toast, setToast] = useState<string | null>(null)
  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2500)
  }
  return { toast, flash }
}

function buildDataProblems(snapshot: Snapshot): { level: 'warn' | 'info'; text: string }[] {
  const out: { level: 'warn' | 'info'; text: string }[] = []
  const shopIds = new Set(snapshot.shops.map((s) => s.id))

  if (snapshot.shops.length === 0 && snapshot.devices.length === 0 && snapshot.sales.length === 0) {
    out.push({ level: 'warn', text: 'ฐานข้อมูลยังว่างเปล่า — ยังไม่มีร้าน/ข้อมูลใดในระบบ' })
    return out
  }

  const orphanDevices = snapshot.devices.filter((d) => !shopIds.has(d.shopId))
  if (orphanDevices.length > 0) {
    out.push({ level: 'warn', text: `เครื่อง ${orphanDevices.length} เครื่อง อ้างถึงร้านที่ไม่มีอยู่ (ข้อมูลร้านหายหรือถูกลบ)` })
  }

  const orphanSales = snapshot.sales.filter((s) => !shopIds.has(s.shopId))
  if (orphanSales.length > 0) {
    out.push({ level: 'warn', text: `รายการขาย ${orphanSales.length} รายการ อ้างถึงร้านที่ไม่มีอยู่` })
  }

  const byImei = new Map<string, number>()
  snapshot.devices.forEach((d) => {
    const k = d.imei.trim().toLowerCase()
    if (k) byImei.set(k, (byImei.get(k) ?? 0) + 1)
  })
  const dupImei = [...byImei.values()].filter((c) => c > 1).length
  if (dupImei > 0) {
    out.push({ level: 'warn', text: `พบ IMEI ซ้ำในสต็อก ${dupImei} รายการ — เสี่ยงเป็นเครื่องที่ลงซ้ำ` })
  }

  const soldButInStock = snapshot.sales.filter((s) => snapshot.devices.some((d) => d.id === s.deviceId))
  if (soldButInStock.length > 0) {
    out.push({ level: 'warn', text: `เครื่องที่ขายไปแล้ว ${soldButInStock.length} เครื่อง ยังเหลืออยู่ในสต็อก (ข้อมูลไม่ตรงกัน)` })
  }

  const noImages = snapshot.devices.filter((d) => !d.images.device.length)
  if (noImages.length > 0) {
    out.push({ level: 'info', text: `เครื่องในสต็อก ${noImages.length} เครื่อง ยังไม่มีรูปเครื่อง` })
  }

  const lastTs = snapshot.sales.reduce(
    (m, s) => Math.max(m, s.soldAt),
    snapshot.devices.reduce((m2, d) => Math.max(m2, d.createdAt), 0),
  )
  if (lastTs > 0) {
    const days = Math.floor((Date.now() - lastTs) / 86400000)
    if (days >= 7) {
      out.push({
        level: 'warn',
        text: `ไม่มีข้อมูลใหม่อยู่ในระบบเกิน ${days} วันแล้ว (ล่าสุด ${new Date(lastTs).toLocaleDateString('th-TH')})`,
      })
    } else if (days >= 3) {
      out.push({ level: 'info', text: `ข้อมูลล่าสุดเมื่อ ${days} วันที่แล้ว` })
    }
  }

  return out
}

function StaffSettings() {
  const { session, activeShop } = useAuth()
  const { toast } = useFlash()

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">ตั้งค่า</h1>

      <div className={`${cardClass} overflow-hidden`}>
        <Thumb imageRef={activeShop?.imageRef} alt={activeShop?.name ?? 'หน้าร้าน'} className="h-40 w-full" />
        <div className="space-y-3 p-4">
          <InfoRow label="ชื่อร้าน" value={activeShop?.name || '—'} />
          <InfoRow label="เบอร์โทรร้าน" value={activeShop?.phone || 'ไม่มีเบอร์'} />
        </div>
      </div>

      <div className={`${cardClass} space-y-2 p-4`}>
        <h2 className="text-sm font-semibold">ข้อมูลผู้ใช้</h2>
        <InfoRow label="ชื่อ" value={session?.name || '—'} />
        <InfoRow label="อีเมล" value={session?.email || '—'} />
      </div>

      <ThemeCard />
      <LogoutButton />
      <Toast toast={toast} />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  )
}

function OwnerSettings() {
  const { session, signOut } = useAuth()
  const { toast } = useFlash()

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">ตั้งค่าเจ้าของ</h1>
      <div className={`${cardClass} flex items-center gap-3 p-4`}>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-lg font-bold text-white">
          {(session?.name ?? 'O').slice(0, 1)}
        </div>
        <div>
          <p className="text-sm font-semibold">{session?.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">เจ้าของ · จัดการได้ทุกอย่าง</p>
        </div>
      </div>
      <div className={`${cardClass} space-y-2 p-4`}>
        <h2 className="text-sm font-semibold">ข้อมูลผู้ใช้</h2>
        <InfoRow label="ชื่อ" value={session?.name || '—'} />
        <InfoRow label="อีเมล" value={session?.email || '—'} />
      </div>
      <ThemeCard />
      <ModeBadges />
      <button className={`${btnDanger} w-full`} onClick={signOut}>
        <LogoutIcon className="h-4 w-4" /> ออกจากระบบ
      </button>
      <Toast toast={toast} />
    </div>
  )
}

function AdminSettings() {
  const { session, signOut } = useAuth()
  const { mode, snapshot, error } = useBackend()
  const images = useImageStore()
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const deletedStaff = snapshot.employees.filter((e) => e.status === 'deleted')
  const noStaffShops = snapshot.shops.filter(
    (s) => !snapshot.employees.some((e) => e.shopId === s.id && e.status !== 'deleted'),
  )

  const problems: { level: 'warn' | 'info'; text: string }[] = []
  if (error) problems.push({ level: 'warn', text: `โหลดข้อมูลไม่สำเร็จ: ${error}` })
  if (mode !== 'firebase') problems.push({ level: 'warn', text: 'ยังไม่เชื่อมต่อ Firebase — ข้อมูลเก็บในเบราว์เซอร์ (โหมด demo)' })
  if (images.mode !== 'drive') problems.push({ level: 'warn', text: 'ยังไม่เชื่อมต่อ Google Drive — รูปเก็บในเบราว์เซอร์ (โหมด demo)' })
  if (!online) problems.push({ level: 'warn', text: 'อินเทอร์เน็ตออฟไลน์ — การซิงก์ข้อมูลอาจล่าช้า' })
  if (noStaffShops.length > 0) problems.push({ level: 'info', text: `ร้านที่ยังไม่มีพนักงาน: ${noStaffShops.map((s) => s.name).join(', ')}` })
  deletedStaff.forEach((e) =>
    problems.push({ level: 'info', text: `พนักงาน "${e.name}" ถูกลบโดยเจ้าของ (${e.deletedBy ?? '-'}) — เข้าสู่ระบบไม่ได้แล้ว` }),
  )
  problems.push(...buildDataProblems(snapshot))

  const dataStatus = {
    total:
      snapshot.shops.length +
      snapshot.employees.filter((e) => e.status !== 'deleted').length +
      snapshot.devices.length +
      snapshot.sales.length,
    segments: [
      { label: 'ร้าน', value: snapshot.shops.length, color: 'bg-sky-500' },
      { label: 'พนักงาน', value: snapshot.employees.filter((e) => e.status !== 'deleted').length, color: 'bg-emerald-500' },
      { label: 'เครื่องในสต็อก', value: snapshot.devices.length, color: 'bg-amber-500' },
      { label: 'ขายแล้ว', value: snapshot.sales.length, color: 'bg-purple-500' },
    ],
  }

  const connections = [
    { label: 'Firebase (ฐานข้อมูล)', ok: mode === 'firebase', detail: mode === 'firebase' ? 'เชื่อมต่อแล้ว' : 'โหมด demo' },
    { label: 'Google Drive (รูปภาพ)', ok: images.mode === 'drive', detail: images.mode === 'drive' ? 'เชื่อมต่อแล้ว' : 'โหมด demo' },
    { label: 'เว็บไซต์', ok: online, detail: online ? 'ออนไลน์' : 'ออฟไลน์' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">ตั้งค่าผู้ดูแลระบบ</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{session?.name} · จัดการทุกอย่าง</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <SettingsIcon className="h-5 w-5" />
        </div>
      </div>

      <div className={`${cardClass} p-4`}>
        <h2 className="mb-3 text-sm font-semibold">การเชื่อมต่อ</h2>
        <div className="space-y-2">
          {connections.map((c) => (
            <div key={c.label} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <div>
                <p className="text-sm">{c.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{c.detail}</p>
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${c.ok ? 'bg-emerald-500' : 'bg-amber-400'}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold">สถานะข้อมูล</h2>
        <p className="mb-3 mt-1 text-pretty text-sm text-slate-500 dark:text-slate-400">
          ระบบจัดเก็บ{' '}
          <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {dataStatus.total.toLocaleString('en-US')}
          </span>{' '}
          รายการข้อมูล แบ่งเป็น {dataStatus.segments.length} หมวด
        </p>

        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          {dataStatus.segments.map((seg) => {
            const pct = dataStatus.total > 0 ? (seg.value / dataStatus.total) * 100 : 0
            return (
              <div
                key={seg.label}
                role="progressbar"
                aria-label={seg.label}
                aria-valuemin={0}
                aria-valuemax={dataStatus.total}
                aria-valuenow={seg.value}
                className={`h-full ${seg.color}`}
                style={{ width: `${pct}%` }}
              />
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {dataStatus.segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-2">
              <span aria-hidden className={`size-3 shrink-0 rounded ${seg.color}`} />
              <span className="text-sm text-slate-500 dark:text-slate-400">{seg.label}</span>
              <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                {seg.value.toLocaleString('en-US')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={`${cardClass} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">ปัญหาที่พบ</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            problems.length === 0
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
          }`}>
            {problems.length === 0 ? 'ไม่มีปัญหา' : `${problems.length} รายการ`}
          </span>
        </div>
        {problems.length === 0 ? (
          <p className="text-sm text-slate-400">ระบบทำงานปกติ</p>
        ) : (
          <ul className="space-y-2">
            {problems.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${p.level === 'warn' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                <span className="text-slate-600 dark:text-slate-300">{p.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModeBadges />
      <ThemeCard />
      <button className={`${btnDanger} w-full`} onClick={signOut}>
        <LogoutIcon className="h-4 w-4" /> ออกจากระบบผู้ดูแล
      </button>
    </div>
  )
}

function LogoutButton() {
  const { signOut } = useAuth()
  return (
    <button className={`${btnDanger} w-full`} onClick={signOut}>
      <LogoutIcon className="h-4 w-4" /> ออกจากระบบ
    </button>
  )
}

function Toast({ toast }: { toast: string | null }) {
  if (!toast) return null
  return (
    <div className="fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
      {toast}
    </div>
  )
}
