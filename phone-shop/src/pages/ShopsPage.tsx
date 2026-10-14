import { useRef, useState } from 'react'
import { ShopSalesSection } from '../components/ShopSalesSection'
import { CameraIcon, EyeIcon, EyeOffIcon, KeyIcon, PlusIcon, StoreIcon, TrashIcon, UserPlusIcon, UserIcon } from '../components/icons'
import { btnDanger, btnGhost, btnPrimary, cardClass, inputClass, labelClass, Modal, Thumb } from '../components/ui'
import { useAuth } from '../lib/auth'
import { newId, useBackend } from '../lib/backend'
import { useImageStore } from '../lib/images'
import type { Role, Shop } from '../lib/types'

export function ShopsPage() {
  const { session, isOwner, isAdmin } = useAuth()
  const { snapshot, updateShop, deleteShop, addEmployee, updateEmployee, deleteEmployee } = useBackend()
  const images = useImageStore()

  const [editing, setEditing] = useState<Shop | 'new' | null>(null)
  const [addEmpShop, setAddEmpShop] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<{ emp: any; shopId: string } | null>(null)

  // Filter shops for owner - only their shops
  const shops = isOwner
    ? snapshot.shops.filter((s) => s.ownerId === session?.id)
    : snapshot.shops

  function flash(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  async function removeShop(shop: Shop) {
    if (!window.confirm(`ลบร้าน "${shop.name}" และพนักงานทั้งหมดในร้าน?`)) return
    await deleteShop(shop.id)
    flash(`ลบร้าน ${shop.name} แล้ว`)
  }

  async function removeEmployee(id: string, name: string) {
    if (isOwner) {
      if (!window.confirm(`ลบพนักงาน "${name}" ออกถาวร?\n(แอดมินจะเห็นเป็นสถานะถูกลบ · ข้อมูลที่พนักงานเคยกรอกยังอยู่ครบ)`))
        return
      const emp = snapshot.employees.find((e) => e.id === id)
      if (!emp) return
      await updateEmployee({ ...emp, status: 'deleted', deletedBy: session?.name ?? 'เจ้าของ' })
      flash(`ลบพนักงาน ${name} แล้ว · ข้อมูลที่เคยกรอกยังอยู่`)
    } else {
      if (!window.confirm(`ลบพนักงาน "${name}" ออกถาวร?\n(ข้อมูลที่พนักงานเคยกรอกยังอยู่ครบ)`)) return
      await deleteEmployee(id)
      flash(`ลบพนักงาน ${name} แล้ว · ข้อมูลที่เคยกรอกยังอยู่`)
    }
  }

  function openEditEmployee(emp: any, shopId: string) {
    setEditingEmployee({ emp, shopId })
  }

  async function saveEmployee(patch: { name: string; email: string; role: Role; password?: string }) {
    if (!editingEmployee) return
    const { emp, shopId } = editingEmployee
    // Handle delete
    if (patch.password === '__DELETE__') {
      if (isOwner) {
        await updateEmployee({ ...emp, status: 'deleted', deletedBy: session?.name ?? 'เจ้าของ' })
        flash(`ลบพนักงาน ${emp.name} แล้ว · ข้อมูลที่เคยกรอกยังอยู่`)
      } else {
        await deleteEmployee(emp.id)
        flash(`ลบพนักงาน ${emp.name} แล้ว · ข้อมูลที่เคยกรอกยังอยู่`)
      }
      setEditingEmployee(null)
      return
    }
    const next = { ...emp, ...patch, shopId }
    await updateEmployee(next)
    setEditingEmployee(null)
    flash(`บันทึกข้อมูลพนักงาน ${patch.name} แล้ว`)
  }

  async function saveShop(input: { name: string; phone: string; file: File | null; summaryDay: number }, target: Shop | 'new') {
    setBusy(true)
    const id = target === 'new' ? newId('shop') : target.id
    const name = input.name.trim() || 'ร้านใหม่'
    let imageRef = target === 'new' ? null : target.imageRef
    if (input.file) {
      imageRef = await images.put(input.file, {
        shopId: id,
        shopName: name,
        imei: 'shop-cover',
        kind: 'shop',
        index: 0,
      })
    }
    // Set ownerId for new shops created by owner
    const ownerId = target === 'new' && isOwner ? session?.id : target === 'new' ? undefined : target.ownerId
    await updateShop({ id, name, phone: input.phone.trim(), imageRef, summaryDay: input.summaryDay, ownerId })
    setBusy(false)
    setEditing(null)
    flash(target === 'new' ? 'เพิ่มร้านแล้ว' : 'บันทึกข้อมูลร้านแล้ว')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">ร้านและพนักงาน</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isOwner ? 'เจ้าของ: จัดการร้านของตัวเอง' : isAdmin ? 'แอดมิน: จัดการทุกร้านและพนักงาน' : ''}
          </p>
        </div>
        <button className={btnPrimary} onClick={() => setEditing('new')}>
          <StoreIcon className="h-4 w-4" /> เพิ่มร้าน
        </button>
      </div>

      {!isOwner && <PasswordManagerCard onFlash={flash} />}

      {shops.map((shop) => {
        const staff = snapshot.employees.filter((e) => e.shopId === shop.id)
        const visible = isOwner ? staff.filter((e) => e.status !== 'deleted') : staff
        const isOwnerShop = shop.ownerId === session?.id
        return (
          <div key={shop.id} className={`${cardClass} overflow-hidden`}>
            <div className="flex items-center gap-3 p-4">
              <Thumb imageRef={shop.imageRef} alt={shop.name} className="h-14 w-14 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="truncate font-semibold">{shop.name}</p>
                  {isOwnerShop && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-900/40 dark:text-brand-400">เจ้าของ</span>}
                  {shop.ownerId && shop.ownerId !== session?.id && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:bg-sky-900/40 dark:text-sky-400">แอดมิน</span>}
                </div>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{shop.phone || 'ไม่มีเบอร์'}</p>
              </div>
              <button className={`${btnGhost} px-3 py-2 text-xs`} onClick={() => setEditing(shop)}>
                แก้ไข
              </button>
              <button className={`${btnDanger} px-3 py-2 text-xs`} onClick={() => removeShop(shop)}>
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="border-t border-slate-100 p-4 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  พนักงาน {visible.length} คน
                </p>
                <button className={`${btnGhost} px-3 py-1.5 text-xs`} onClick={() => setAddEmpShop(shop.id)}>
                  <UserPlusIcon className="h-3.5 w-3.5" /> เพิ่มพนักงาน
                </button>
              </div>
              <div className="space-y-2">
                {visible.length === 0 ? (
                  <p className="text-xs text-slate-400">ไม่มีพนักงาน</p>
                ) : (
                  visible.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {e.avatarRef ? (
                          <Thumb
                            imageRef={e.avatarRef}
                            alt={e.name}
                            className="h-9 w-9 shrink-0 rounded-full"
                          />
                        ) : (
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                            {e.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm">{e.name}</p>
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{e.email}</p>
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {ROLE_LABEL[e.role] ?? e.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.status === 'deleted' ? (
                          <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] text-red-500 dark:bg-red-950/40 dark:text-red-400">
                            ถูกลบโดยเจ้าของ
                          </span>
                        ) : (
                          <>
                            {(isAdmin || isOwner) ? (
                              <button
                                className="grid h-8 w-8 place-items-center rounded-lg text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                                onClick={() => openEditEmployee(e, shop.id)}
                                title="แก้ไขพนักงาน"
                              >
                                <UserIcon className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                className="grid h-8 w-8 place-items-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                                onClick={() => removeEmployee(e.id, e.name)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <ShopSalesSection shopId={shop.id} />
          </div>
        )
      })}

      {editing ? (
        <ShopModal
          shop={editing === 'new' ? null : editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(input) => saveShop(input, editing)}
        />
      ) : null}

      {addEmpShop ? (
        <AddEmployeeModal
          shopName={snapshot.shops.find((s) => s.id === addEmpShop)?.name ?? ''}
          onClose={() => setAddEmpShop(null)}
          onSave={async (name, email, password, avatarFile) => {
            if (!addEmpShop) return
            let avatarRef: string | null = null
            if (avatarFile) {
              const shop = snapshot.shops.find((s) => s.id === addEmpShop)
              avatarRef = await images.put(avatarFile, {
                shopId: addEmpShop,
                shopName: shop?.name ?? 'ร้าน',
                imei: 'avatar',
                kind: 'avatar',
                index: 0,
              })
            }
            await addEmployee(addEmpShop, name, email, password, avatarRef)
            setAddEmpShop(null)
            flash('เพิ่มพนักงานแล้ว')
          }}
        />
      ) : null}

      {editingEmployee ? (
        <EditEmployeeModal
          emp={editingEmployee.emp}
          shopId={editingEmployee.shopId}
          onClose={() => setEditingEmployee(null)}
          onSave={saveEmployee}
        />
      ) : null}

      {toast ? (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

function ShopModal({
  shop,
  busy,
  onClose,
  onSave,
}: {
  shop: Shop | null
  busy: boolean
  onClose: () => void
  onSave: (input: { name: string; phone: string; file: File | null; summaryDay: number }) => void
}) {
  const [name, setName] = useState(shop?.name ?? '')
  const [phone, setPhone] = useState(shop?.phone ?? '')
  const [summaryDay, setSummaryDay] = useState(shop?.summaryDay ?? 31)
  const [file, setFile] = useState<File | null>(null)

  return (
    <Modal
      open
      onClose={onClose}
      title={shop ? 'แก้ไขร้าน' : 'เพิ่มร้าน'}
      subtitle="กรอกชื่อร้านและข้อมูลติดต่อ เช่น เบอร์โทร"
      footer={
        <div className="flex justify-end gap-2">
          <button className={`${btnGhost} px-4 py-2`} onClick={onClose} disabled={busy}>
            ยกเลิก
          </button>
          <button
            className={`${btnPrimary} px-4 py-2`}
            onClick={() => onSave({ name, phone, file, summaryDay })}
            disabled={busy || !name.trim()}
          >
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {shop && !file ? (
          <Thumb imageRef={shop.imageRef} alt={shop.name} className="h-28 w-full rounded-xl" />
        ) : null}
        <div>
          <label className={labelClass}>
            ชื่อร้าน <span className="text-brand-600">*</span>
          </label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ร้านสายฟ้าโฟน" />
        </div>
        <div>
          <label className={labelClass}>เบอร์โทร</label>
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" inputMode="tel" />
        </div>
        <div>
          <label className={labelClass}>วันสรุปยอดของเดือน</label>
          <select className={inputClass} value={summaryDay} onChange={(e) => setSummaryDay(Number(e.target.value))}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d === 31 ? 'สิ้นเดือน' : `วันที่ ${d}`}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            สรุปยอดเครื่องต่อเดือนจะนับรายการขายถึงวันที่เลือก (เช่น วันที่ 25 = รอบวันที่ 26 ก่อนหน้า ถึง 25 ของเดือน)
          </p>
        </div>
        <div>
          <label className={labelClass}>รูปหน้าร้าน</label>
          <label className={`${btnGhost} w-full cursor-pointer`}>
            <CameraIcon className="h-4 w-4" />
            {file ? file.name : 'เลือกรูปหน้าร้าน'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>
    </Modal>
  )
}

function AddEmployeeModal({
  shopName,
  onClose,
  onSave,
}: {
  shopName: string
  onClose: () => void
  onSave: (name: string, email: string, password: string, avatarFile: File | null) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('1234')
  const [showPassword, setShowPassword] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1_048_576) {
      setError('รูปใหญ่เกิน 1MB ลองลดขนาดรูปแล้วลองใหม่')
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = () => setAvatar(String(reader.result))
    reader.readAsDataURL(file)
    setAvatarFile(file)
  }

  function clearAvatar() {
    setAvatar(null)
    setAvatarFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`เพิ่มพนักงาน · ${shopName}`}
      subtitle="อัปโหลดรูปโปรไฟล์และกรอกข้อมูลพนักงาน"
      footer={
        <div className="flex justify-end gap-2">
          <button className={`${btnGhost} px-4 py-2`} onClick={onClose}>
            ยกเลิก
          </button>
          <button
            className={`${btnPrimary} px-4 py-2`}
            disabled={!name.trim() || !email.trim() || !password.trim()}
            onClick={() => onSave(name, email, password, avatarFile)}
          >
            เพิ่มพนักงาน
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <div className="flex flex-col items-center justify-center md:col-span-2">
          <div className="relative">
            <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
              {avatar ? (
                <img src={avatar} alt="รูปโปรไฟล์" className="h-full w-full object-cover" />
              ) : (
                <svg
                  className="h-10 w-10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <button
              type="button"
              aria-label={avatar ? 'ลบรูป' : 'เลือกรูป'}
              onClick={() => (avatar ? clearAvatar() : fileInputRef.current?.click())}
              className="absolute -top-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-[3px] border-white bg-slate-200 text-slate-600 shadow transition hover:bg-slate-300 dark:border-slate-900 dark:bg-slate-700 dark:text-slate-200"
            >
              {avatar ? (
                <span className="text-sm leading-none">✕</span>
              ) : (
                <PlusIcon className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-3 text-sm font-medium">รูปโปรไฟล์</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">ขนาดไฟล์สูงสุด 1MB</p>
          {error ? <p className="mt-1 text-center text-xs text-red-500">{error}</p> : null}
          <input
            ref={fileInputRef}
            accept="image/*"
            type="file"
            className="hidden"
            onChange={handleFile}
          />
          <button
            className={`${btnGhost} mt-2 px-3 py-1.5 text-xs`}
            onClick={() => fileInputRef.current?.click()}
          >
            <CameraIcon className="h-3.5 w-3.5" /> {avatar ? 'เปลี่ยนรูป' : 'เลือกรูป'}
          </button>
        </div>

        <div className="space-y-4 md:col-span-3">
          <div>
            <label className={labelClass}>
              ชื่อพนักงาน <span className="text-brand-600">*</span>
            </label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น สมชาย ใจดี"
            />
          </div>
          <div>
            <label className={labelClass}>
              อีเมล <span className="text-brand-600">*</span>
            </label>
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@shop.com"
            />
          </div>
          <div>
            <label className={labelClass}>
              รหัสผ่าน <span className="text-brand-600">*</span>
            </label>
            <div className="relative">
              <input
                className={inputClass}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่านสำหรับเข้าสู่ระบบ"
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              พนักงานใช้รหัสนี้เข้าสู่ระบบ (ค่าเริ่มต้น 1234)
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function EditEmployeeModal({
  emp,
  shopId,
  onClose,
  onSave,
}: {
  emp: any
  shopId: string
  onClose: () => void
  onSave: (patch: { name: string; email: string; role: Role; password?: string }) => Promise<void>
}) {
  const [name, setName] = useState(emp.name)
  const [email, setEmail] = useState(emp.email)
  const [role, setRole] = useState<Role>(emp.role)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!name.trim()) {
      setError('กรุณากรอกชื่อ')
      return
    }
    if (!email.trim()) {
      setError('กรุณากรอกอีเมล')
      return
    }
    if (password) {
      if (password.length < 4) {
        setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร')
        return
      }
      if (password !== confirm) {
        setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
        return
      }
    }
    setError(null)
    setBusy(true)
    onSave({ name, email, role, password: password || undefined }).catch((e: unknown) => {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`แก้ไขพนักงาน · ${emp.name}`}
      subtitle={`ร้าน: ${shopId}`}
      footer={
        <div className="flex justify-end gap-2">
          <button className={`${btnGhost} px-4 py-2`} onClick={onClose} disabled={busy}>
            ยกเลิก
          </button>
          <button className={`${btnPrimary} px-4 py-2`} onClick={submit} disabled={busy}>
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>ชื่อ</label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อ-นามสกุล"
          />
        </div>
        <div>
          <label className={labelClass}>อีเมล</label>
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@shop.com"
          />
        </div>
        <div>
          <label className={labelClass}>สิทธิ์การใช้งาน</label>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="staff">พนักงาน</option>
            <option value="admin">แอดมิน</option>
            <option value="owner">เจ้าของ</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>รหัสผ่านใหม่ (เว้นว่างเพื่อไม่เปลี่ยน)</label>
          <div className="relative">
            <input
              className={inputClass}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 4 ตัวอักษร"
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {password ? (
          <div>
            <label className={labelClass}>ยืนยันรหัสผ่านใหม่</label>
            <input
              className={inputClass}
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="พิมพ์รหัสอีกครั้ง"
              autoComplete="new-password"
            />
          </div>
        ) : null}
        <div className="flex justify-end">
          <button
            className={`${btnDanger} px-4 py-2`}
            onClick={() => {
              if (window.confirm(`ลบพนักงาน "${emp.name}" ออกถาวร?`)) {
                onSave({ name: emp.name, email: emp.email, role: emp.role, password: '__DELETE__' })
              }
            }}
            disabled={busy}
          >
            <TrashIcon className="h-4 w-4" /> ลบพนักงาน
          </button>
        </div>
        {error ? <p className="text-xs text-red-500">{error}</p> : null}
      </div>
    </Modal>
  )
}

const ROLE_LABEL: Record<string, string> = {
  staff: 'พนักงาน',
  admin: 'แอดมิน',
  owner: 'เจ้าของ',
}

interface PasswordTarget {
  id: string
  name: string
  email: string
  role: Role
}

function PasswordManagerCard({ onFlash }: { onFlash: (msg: string) => void }) {
  const { snapshot, saveAccount, deleteEmployee } = useBackend()
  const { session, isAdmin } = useAuth()
  const [target, setTarget] = useState<PasswordTarget | null>(null)

  const rows: PasswordTarget[] = [
    ...snapshot.accounts.map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role })),
    ...snapshot.employees
      .filter((e) => e.status !== 'deleted')
      .map((e) => ({ id: e.id, name: e.name, email: e.email, role: e.role })),
  ]

  async function handleDeleteAccount(id: string) {
    if (!window.confirm('ลบบัญชีนี้ออกถาวร?')) return
    // Check if it's an employee
    const emp = snapshot.employees.find((e) => e.id === id)
    if (emp) {
      await deleteEmployee(id)
      onFlash('ลบพนักงานแล้ว')
    } else {
      // For global accounts, we'd need a deleteAccount function
      // For now, just show not supported
      onFlash('ไม่สามารถลบบัญชีผู้ดูแลระบบได้ในหน้านี้')
    }
  }

  return (
    <div className={`${cardClass} p-4`}>
      <div className="mb-1 flex items-center gap-2">
        <KeyIcon className="h-4 w-4 text-brand-600" />
        <h2 className="text-sm font-semibold">จัดการบัญชี</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        แก้ไขชื่อ อีเมล และรหัสผ่านได้ทุกบัญชี รวมถึงเจ้าของและตัวเอง
      </p>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400">ยังไม่มีบัญชีในระบบ</p>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {r.name}
                  {r.id === session?.id ? (
                    <span className="ml-1.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                      ตัวเอง
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {r.email} · {ROLE_LABEL[r.role] ?? r.role}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={`${btnGhost} shrink-0 px-3 py-1.5 text-xs`}
                  onClick={() => setTarget(r)}
                >
                  แก้ไข
                </button>
                {isAdmin && r.id !== session?.id && (
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    onClick={() => handleDeleteAccount(r.id)}
                    title="ลบบัญชี"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {target ? (
        <EditAccountModal
          target={target}
          takenEmails={rows.filter((r) => r.id !== target.id).map((r) => r.email)}
          onClose={() => setTarget(null)}
          onSave={async (patch) => {
            await saveAccount(target.id, patch)
            setTarget(null)
            onFlash(`บันทึกข้อมูลของ ${target.name} แล้ว`)
          }}
        />
      ) : null}
    </div>
  )
}

function EditAccountModal({
  target,
  takenEmails,
  onClose,
  onSave,
}: {
  target: PasswordTarget
  takenEmails: string[]
  onClose: () => void
  onSave: (patch: { name: string; email: string; role: Role; password?: string }) => Promise<void>
}) {
  const [name, setName] = useState(target.name)
  const [email, setEmail] = useState(target.email)
  const [role, setRole] = useState<Role>(target.role)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!name.trim()) {
      setError('กรุณากรอกชื่อ')
      return
    }
    if (!email.trim()) {
      setError('กรุณากรอกอีเมล')
      return
    }
    if (takenEmails.some((e) => e.toLowerCase() === email.trim().toLowerCase())) {
      setError('อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว')
      return
    }
    if (password) {
      if (password.length < 4) {
        setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร')
        return
      }
      if (password !== confirm) {
        setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
        return
      }
    }
    setError(null)
    setBusy(true)
    onSave({ name, email, role, password: password || undefined }).catch((e: unknown) => {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ')
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`แก้ไขบัญชี · ${target.name}`}
      subtitle={`${ROLE_LABEL[target.role] ?? target.role}`}
      footer={
        <div className="flex justify-end gap-2">
          <button className={`${btnGhost} px-4 py-2`} onClick={onClose} disabled={busy}>
            ยกเลิก
          </button>
          <button className={`${btnPrimary} px-4 py-2`} onClick={submit} disabled={busy}>
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>ชื่อ</label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อ-นามสกุล"
          />
        </div>
        <div>
          <label className={labelClass}>อีเมล</label>
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@shop.com"
          />
        </div>
        <div>
          <label className={labelClass}>สิทธิ์การใช้งาน</label>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="staff">พนักงาน</option>
            <option value="admin">แอดมิน</option>
            <option value="owner">เจ้าของ</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>รหัสผ่านใหม่ (เว้นว่างเพื่อไม่เปลี่ยน)</label>
          <div className="relative">
            <input
              className={inputClass}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 4 ตัวอักษร"
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {password ? (
          <div>
            <label className={labelClass}>ยืนยันรหัสผ่านใหม่</label>
            <input
              className={inputClass}
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="พิมพ์รหัสอีกครั้ง"
              autoComplete="new-password"
            />
          </div>
        ) : null}
        {error ? <p className="text-xs text-red-500">{error}</p> : null}
      </div>
    </Modal>
  )
}
