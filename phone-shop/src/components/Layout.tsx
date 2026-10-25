import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  BoxIcon,
  ChartIcon,
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

export function Layout() {
  const { session, activeShop, signOut } = useAuth()
  const role: Role = session?.role ?? 'staff'
  const nav = NAV[role]
  const [collapsed, setCollapsed] = useState(false)

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
            {nav.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `mt-1 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition ${
                    collapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1 text-left">{label}</span>}
              </NavLink>
            ))}
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

      <div className="fixed inset-0 flex flex-col md:hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
            <Outlet />
          </div>
        </main>

        <nav className="relative z-30 mx-3 shrink-0 overflow-hidden rounded-full border border-white/60 bg-white/10 text-slate-800 shadow-[inset_0_1px_0px_rgba(255,255,255,0.75),0_0_9px_rgba(0,0,0,0.16),0_3px_8px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/40 dark:bg-slate-950/15 dark:text-white before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/30 before:via-transparent before:to-transparent before:opacity-70 after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-tl after:from-white/15 after:via-transparent after:to-transparent after:opacity-50">
          <div className="relative mx-auto flex max-w-5xl items-stretch justify-between px-2 py-1.5">
            {nav.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `relative flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-all duration-300 ${
                    isActive
                      ? 'border-white/70 bg-white/40 text-slate-900 shadow-[inset_0_1px_0px_rgba(255,255,255,0.65),0_2px_6px_rgba(0,0,0,0.1)] dark:border-white/50 dark:bg-white/25 dark:text-white'
                      : 'border-transparent text-slate-600 hover:border-white/40 hover:bg-white/20 hover:text-slate-900 dark:text-white/80 dark:hover:border-white/30 dark:hover:bg-white/15 dark:hover:text-white'
                  }`
                }
              >
                <Icon className="h-5 w-5 drop-shadow-sm" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
