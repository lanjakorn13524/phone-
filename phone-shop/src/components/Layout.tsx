import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  BoxIcon,
  ChartIcon,
  ChevronDownIcon,
  LogoutIcon,
  PanelLeftIcon,
  PlusIcon,
  ReceiptIcon,
  SettingsIcon,
  StoreIcon,
} from './icons'
import { Thumb } from './ui'
import type { Role } from '../lib/types'

interface NavItem {
  to: string
  label: string
  Icon: typeof BoxIcon
}

const NAV: Record<Role, NavItem[]> = {
  staff: [
    { to: '/stock', label: 'สต็อก', Icon: BoxIcon },
    { to: '/add', label: 'เพิ่ม', Icon: PlusIcon },
    { to: '/sold', label: 'ขายแล้ว', Icon: ReceiptIcon },
    { to: '/dashboard', label: 'แดชบอร์ด', Icon: ChartIcon },
    { to: '/settings', label: 'ตั้งค่า', Icon: SettingsIcon },
  ],
  admin: [
    { to: '/stock', label: 'สต็อก', Icon: BoxIcon },
    { to: '/sold', label: 'ขายแล้ว', Icon: ReceiptIcon },
    { to: '/shops', label: 'ร้าน', Icon: StoreIcon },
    { to: '/dashboard', label: 'แดชบอร์ด', Icon: ChartIcon },
    { to: '/settings', label: 'ตั้งค่า', Icon: SettingsIcon },
  ],
  owner: [
    { to: '/stock', label: 'สต็อก', Icon: BoxIcon },
    { to: '/sold', label: 'ขายแล้ว', Icon: ReceiptIcon },
    { to: '/shops', label: 'ร้าน', Icon: StoreIcon },
    { to: '/dashboard', label: 'แดชบอร์ด', Icon: ChartIcon },
    { to: '/settings', label: 'ตั้งค่า', Icon: SettingsIcon },
  ],
}

const ROLE_LABEL: Record<Role, string> = {
  staff: 'พนักงานร้าน',
  admin: 'ผู้ดูแลระบบ',
  owner: 'เจ้าของ',
}

interface SubItem {
  id: string
  label: string
  description: string
  to: string
  Icon: typeof BoxIcon
}

interface SidebarGroup {
  id: string
  label: string
  Icon: typeof BoxIcon
  subItems: SubItem[]
}

function buildGroups(role: Role): SidebarGroup[] {
  const manage: SidebarGroup =
    role === 'staff'
      ? {
          id: 'manage',
          label: 'สต็อก',
          Icon: BoxIcon,
          subItems: [
            { id: 'stock', label: 'สต็อกเครื่อง', description: 'เครื่องที่ยังขายอยู่', to: '/stock', Icon: BoxIcon },
            { id: 'add', label: 'เพิ่มเครื่อง', description: 'รับเครื่อง + ตรวจเช็คก่อนลง', to: '/add', Icon: PlusIcon },
          ],
        }
      : {
          id: 'manage',
          label: 'จัดการร้าน',
          Icon: BoxIcon,
          subItems: [
            { id: 'stock', label: 'สต็อกเครื่อง', description: 'ดูสต็อกข้ามร้าน', to: '/stock', Icon: BoxIcon },
            { id: 'shops', label: 'จัดการร้าน', description: 'พนักงาน ตั้งวันสรุปยอด', to: '/shops', Icon: StoreIcon },
          ],
        }

  return [
    {
      id: 'overview',
      label: 'ภาพรวม',
      Icon: ChartIcon,
      subItems: [
        { id: 'dashboard', label: 'แดชบอร์ด', description: 'ยอดขายและกำไรรายเดือน', to: '/dashboard', Icon: ChartIcon },
        { id: 'sold', label: 'ขายแล้ว', description: 'รายการที่ขายไปแล้ว', to: '/sold', Icon: ReceiptIcon },
      ],
    },
    manage,
  ]
}

export function Layout() {
  const { session, activeShop, signOut } = useAuth()
  const role: Role = session?.role ?? 'staff'
  const nav = NAV[role]
  const groups = buildGroups(role)
  const location = useLocation()
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const hit = groups.find((g) => g.subItems.some((s) => s.to === location.pathname))
    if (hit) setActiveGroup(hit.id)
  }, [location.pathname])

  const openGroup = useMemo(() => groups.find((g) => g.id === activeGroup) ?? null, [groups, activeGroup])

  return (
    <div className="min-h-full bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="hidden h-dvh md:flex">
        <aside
          className={`flex shrink-0 flex-col transition-[width] duration-200 ease-out ${
            collapsed ? 'w-16' : 'w-64'
          }`}
        >
          <div className={`flex items-center px-3 py-3.5 ${collapsed ? 'flex-col gap-3' : 'justify-between gap-2'}`}>
            <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              {activeShop ? (
                <Thumb
                  imageRef={activeShop.imageRef}
                  alt={activeShop.name}
                  className={`shrink-0 rounded-lg ${collapsed ? 'h-8 w-8' : 'h-8 w-8'}`}
                />
              ) : (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                  PS
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{activeShop?.name ?? 'ระบบสต็อกมือถือ'}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{ROLE_LABEL[role]}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
              title={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
            >
              <PanelLeftIcon className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-2">
            {groups.map((g) => {
              const Icon = g.Icon
              const isOpen = openGroup?.id === g.id
              const hasActive = g.subItems.some((s) => s.to === location.pathname)
              return (
                <div key={g.id} className="mt-1">
                  <button
                    onClick={() => {
                      if (collapsed) {
                        setCollapsed(false)
                        setActiveGroup(g.id)
                      } else {
                        setActiveGroup(isOpen ? null : g.id)
                      }
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition ${
                      collapsed ? 'justify-center' : ''
                    } ${
                      isOpen || hasActive
                        ? 'bg-slate-200/70 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                        : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                    }`}
                    title={collapsed ? g.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="flex-1 text-left">{g.label}</span>}
                    {!collapsed && (
                      <ChevronDownIcon
                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                      />
                    )}
                  </button>

                  {!collapsed && isOpen && (
                    <div className="mt-1 mb-2 ml-3.5 space-y-0.5 border-l border-slate-200 pl-2 dark:border-slate-800">
                      {g.subItems.map((s) => {
                        const SubIcon = s.Icon
                        const active = location.pathname === s.to
                        return (
                          <NavLink
                            key={s.id}
                            to={s.to}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition ${
                              active
                                ? 'bg-brand-600 text-white'
                                : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                            }`}
                          >
                            <SubIcon className="h-4 w-4 shrink-0" />
                            <span className="truncate font-medium">{s.label}</span>
                          </NavLink>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            <div className="mt-1">
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition ${
                    collapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-slate-200/70 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  }`
                }
                title={collapsed ? 'ตั้งค่า' : undefined}
              >
                <SettingsIcon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1 text-left">ตั้งค่า</span>}
              </NavLink>
            </div>
          </nav>

          <div className="p-2">
            <button
              onClick={signOut}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-200/60 dark:hover:bg-slate-800/60 ${
                collapsed ? 'justify-center' : ''
              }`}
              title={collapsed ? (session?.name ?? 'ออกจากระบบ') : undefined}
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {(session?.name ?? '?').slice(0, 1)}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{session?.name ?? ''}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{session?.email ?? ''}</p>
                </div>
              )}
              {!collapsed && <LogoutIcon className="h-4 w-4 shrink-0 text-slate-400" />}
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 p-2 pl-0">
          <div className="h-full overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <main className="h-full overflow-y-auto">
              <div className="mx-auto max-w-5xl px-4 py-6">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            {activeShop ? (
              <Thumb
                imageRef={activeShop.imageRef}
                alt={activeShop.name}
                className="h-10 w-10 shrink-0 rounded-xl"
              />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">
                PS
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{activeShop?.name ?? 'ระบบสต็อกมือถือ'}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {session?.name ?? ''} · {ROLE_LABEL[role]}
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-28 pt-4">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-5xl items-stretch justify-between px-2 py-1.5">
            {nav.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition ${
                    isActive
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
