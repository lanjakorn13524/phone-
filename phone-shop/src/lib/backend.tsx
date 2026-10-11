import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Backend, Device, Employee, GlobalAccount, Sale, Shop, Snapshot } from './types'
import { DEMO_ACCOUNTS, makeDemoSnapshot } from './demo'
import { createFirestoreBackend, isFirebaseConfigured } from './firestoreBackend'

const LS_KEY = 'phone-shop:data'

const EMPTY: Snapshot = { shops: [], employees: [], accounts: [], devices: [], sales: [] }

function normalize(snapshot: Partial<Snapshot>): Snapshot {
  return {
    shops: snapshot.shops ?? [],
    employees: (snapshot.employees ?? []).map((e) => ({ ...e, status: e.status ?? 'active' })),
    accounts: snapshot.accounts && snapshot.accounts.length > 0 ? snapshot.accounts : DEMO_ACCOUNTS,
    devices: snapshot.devices ?? [],
    sales: snapshot.sales ?? [],
  }
}

export function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const copy = list.slice()
  copy[i] = item
  return copy
}

function readLocal(): Snapshot | null {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Snapshot
  } catch {
    return null
  }
}

function writeLocal(snapshot: Snapshot): void {
  localStorage.setItem(LS_KEY, JSON.stringify(snapshot))
}

function localBackend(): Backend {
  let memory: Snapshot | null = null
  const current = (): Snapshot => memory ?? readLocal() ?? makeDemoSnapshot()

  return {
    mode: 'local',
    async load() {
      const existing = readLocal()
      if (existing) {
        const normalized = normalize(existing)
        writeLocal(normalized)
        memory = normalized
        return normalized
      }
      const demo = makeDemoSnapshot()
      writeLocal(demo)
      memory = demo
      return demo
    },
    async upsertDevice(device) {
      const s = current()
      writeLocal({ ...s, devices: upsert(s.devices, device) })
      memory = readLocal()
    },
    async deleteDevice(id) {
      const s = current()
      writeLocal({ ...s, devices: s.devices.filter((d) => d.id !== id) })
      memory = readLocal()
    },
    async upsertSale(sale) {
      const s = current()
      writeLocal({ ...s, sales: upsert(s.sales, sale) })
      memory = readLocal()
    },
    async deleteSale(id) {
      const s = current()
      writeLocal({ ...s, sales: s.sales.filter((x) => x.id !== id) })
      memory = readLocal()
    },
    async upsertShop(shop) {
      const s = current()
      writeLocal({ ...s, shops: upsert(s.shops, shop) })
      memory = readLocal()
    },
    async deleteShop(id) {
      const s = current()
      writeLocal({
        ...s,
        shops: s.shops.filter((x) => x.id !== id),
        employees: s.employees.filter((e) => e.shopId !== id),
      })
      memory = readLocal()
    },
    async upsertEmployee(employee) {
      const s = current()
      writeLocal({ ...s, employees: upsert(s.employees, employee) })
      memory = readLocal()
    },
    async deleteEmployee(id) {
      const s = current()
      writeLocal({ ...s, employees: s.employees.filter((x) => x.id !== id) })
      memory = readLocal()
    },
    async upsertAccount(account) {
      const s = current()
      writeLocal({ ...s, accounts: upsert(s.accounts, account) })
      memory = readLocal()
    },
    async seed(snapshot) {
      writeLocal(snapshot)
      memory = snapshot
    },
  }
}

interface BackendContextValue {
  mode: 'local' | 'firebase'
  ready: boolean
  error: string | null
  snapshot: Snapshot
  addDevice: (device: Device) => Promise<void>
  completeSale: (sale: Sale, deviceId: string) => Promise<void>
  updateSale: (sale: Sale) => Promise<void>
  deleteSale: (id: string) => Promise<void>
  updateShop: (shop: Shop) => Promise<void>
  deleteShop: (id: string) => Promise<void>
  updateEmployee: (employee: Employee) => Promise<void>
  deleteEmployee: (id: string) => Promise<void>
  addEmployee: (shopId: string, name: string, email: string, avatarRef?: string | null) => Promise<Employee>
  updateAccount: (account: GlobalAccount) => Promise<void>
}

const BackendContext = createContext<BackendContextValue | null>(null)

export function BackendProvider({ children }: { children: ReactNode }) {
  const backend = useMemo<Backend>(
    () => (isFirebaseConfigured() ? createFirestoreBackend() : localBackend()),
    [],
  )
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const snapRef = useRef<Snapshot>(EMPTY)

  useEffect(() => {
    snapRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    let alive = true
    backend
      .load()
      .then(async (loaded) => {
        if (!alive) return
        if (backend.mode === 'firebase' && loaded.shops.length === 0 && loaded.accounts.length === 0) {
          const source = readLocal() ?? makeDemoSnapshot()
          const seeded = normalize(source)
          await backend.seed(seeded)
          if (!alive) return
          setSnapshot(seeded)
          setReady(true)
          return
        }
        setSnapshot(normalize(loaded))
        setReady(true)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ')
        setReady(true)
      })
    return () => {
      alive = false
    }
  }, [backend])

  const addDevice = useCallback(
    async (device: Device) => {
      await backend.upsertDevice(device)
      setSnapshot((s) => ({ ...s, devices: upsert(s.devices, device) }))
    },
    [backend],
  )

  const completeSale = useCallback(
    async (sale: Sale, deviceId: string) => {
      await backend.upsertSale(sale)
      await backend.deleteDevice(deviceId)
      setSnapshot((s) => ({
        ...s,
        sales: upsert(s.sales, sale),
        devices: s.devices.filter((d) => d.id !== deviceId),
      }))
    },
    [backend],
  )

  const updateSale = useCallback(
    async (sale: Sale) => {
      await backend.upsertSale(sale)
      setSnapshot((s) => ({ ...s, sales: upsert(s.sales, sale) }))
    },
    [backend],
  )

  const deleteSale = useCallback(
    async (id: string) => {
      await backend.deleteSale(id)
      setSnapshot((s) => ({ ...s, sales: s.sales.filter((x) => x.id !== id) }))
    },
    [backend],
  )

  const updateShop = useCallback(
    async (shop: Shop) => {
      await backend.upsertShop(shop)
      setSnapshot((s) => ({ ...s, shops: upsert(s.shops, shop) }))
    },
    [backend],
  )

  const deleteShop = useCallback(
    async (id: string) => {
      await backend.deleteShop(id)
      setSnapshot((s) => ({
        ...s,
        shops: s.shops.filter((x) => x.id !== id),
        employees: s.employees.filter((e) => e.shopId !== id),
      }))
    },
    [backend],
  )

  const updateEmployee = useCallback(
    async (employee: Employee) => {
      await backend.upsertEmployee(employee)
      setSnapshot((s) => ({ ...s, employees: upsert(s.employees, employee) }))
    },
    [backend],
  )

  const deleteEmployee = useCallback(
    async (id: string) => {
      await backend.deleteEmployee(id)
      setSnapshot((s) => ({ ...s, employees: s.employees.filter((x) => x.id !== id) }))
    },
    [backend],
  )

  const addEmployee = useCallback(
    async (shopId: string, name: string, email: string, avatarRef?: string | null): Promise<Employee> => {
      const employee: Employee = {
        id: newId('emp'),
        shopId,
        name: name.trim(),
        email: email.trim(),
        role: 'staff',
        status: 'active',
        ...(avatarRef ? { avatarRef } : {}),
      }
      await backend.upsertEmployee(employee)
      setSnapshot((s) => ({ ...s, employees: upsert(s.employees, employee) }))
      return employee
    },
    [backend],
  )

  const updateAccount = useCallback(
    async (account: GlobalAccount) => {
      await backend.upsertAccount(account)
      setSnapshot((s) => ({ ...s, accounts: upsert(s.accounts, account) }))
    },
    [backend],
  )

  const value = useMemo<BackendContextValue>(
    () => ({
      mode: backend.mode,
      ready,
      error,
      snapshot,
      addDevice,
      completeSale,
      updateSale,
      deleteSale,
      updateShop,
      deleteShop,
      updateEmployee,
      deleteEmployee,
      addEmployee,
      updateAccount,
    }),
    [
      backend.mode,
      ready,
      error,
      snapshot,
      addDevice,
      completeSale,
      updateSale,
      deleteSale,
      updateShop,
      deleteShop,
      updateEmployee,
      deleteEmployee,
      addEmployee,
      updateAccount,
    ],
  )

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>
}

export function useBackend(): BackendContextValue {
  const ctx = useContext(BackendContext)
  if (!ctx) throw new Error('ต้องใช้งานภายใน BackendProvider')
  return ctx
}
