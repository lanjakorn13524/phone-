import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { GlobalAccount, Session, Shop } from './types'
import { useBackend } from './backend'
import { verifyPassword } from './password'

const KEY = 'phone-shop:session:v2'

interface AuthContextValue {
  session: Session | null
  shops: Shop[]
  accounts: GlobalAccount[]
  activeShop: Shop | null
  isStaff: boolean
  isAdmin: boolean
  isOwner: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  updateProfile: (patch: { name?: string; email?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): Session | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { snapshot, updateEmployee, updateAccount } = useBackend()
  const [session, setSession] = useState<Session | null>(readSession)

  const signIn = useCallback(
    async (email: string, password: string) => {
      const emailNorm = email.trim().toLowerCase()

      const account = snapshot.accounts.find((a) => a.email.toLowerCase() === emailNorm)
      if (account) {
        if (!(await verifyPassword(password, account.password))) {
          throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
        }
        const next: Session = {
          id: account.id,
          role: account.role,
          shopId: null,
          name: account.name,
          email: account.email,
          signedInAt: Date.now(),
        }
        localStorage.setItem(KEY, JSON.stringify(next))
        setSession(next)
        return
      }

      const employee = snapshot.employees.find(
        (e) => e.status !== 'deleted' && e.email.toLowerCase() === emailNorm,
      )
      if (!employee || !(await verifyPassword(password, employee.password))) {
        throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      }
      const next: Session = {
        id: employee.id,
        role: employee.role ?? 'staff',
        shopId: employee.shopId,
        name: employee.name,
        email: employee.email,
        signedInAt: Date.now(),
      }
      localStorage.setItem(KEY, JSON.stringify(next))
      setSession(next)
    },
    [snapshot.accounts, snapshot.employees],
  )

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY)
    setSession(null)
  }, [])

  useEffect(() => {
    setSession((current) => {
      if (!current) return current
      const employee = snapshot.employees.find((e) => e.id === current.id)
      const account = snapshot.accounts.find((a) => a.id === current.id)
      const name = employee?.name ?? account?.name
      const email = employee?.email ?? account?.email
      if (!name || (name === current.name && email === current.email)) return current
      const next = { ...current, name, email: email ?? current.email }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [snapshot.employees, snapshot.accounts])

  const updateProfile = useCallback(
    async (patch: { name?: string; email?: string }) => {
      if (!session) return
      if (session.role === 'staff') {
        const employee = snapshot.employees.find((e) => e.id === session.id)
        if (!employee) return
        const next = {
          ...employee,
          name: patch.name ?? employee.name,
          email: patch.email ?? employee.email,
        }
        await updateEmployee(next)
        persistSession({ name: next.name, email: next.email })
        return
      }
      const account = snapshot.accounts.find((a) => a.id === session.id)
      if (!account) return
      const next = {
        ...account,
        name: patch.name ?? account.name,
        email: patch.email ?? account.email,
      }
      await updateAccount(next)
      persistSession({ name: next.name, email: next.email })
    },
    [session, snapshot.employees, snapshot.accounts, updateEmployee, updateAccount],
  )

  function persistSession(patch: { name: string; email: string }) {
    setSession((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  const activeShop = useMemo(
    () => (session?.shopId ? snapshot.shops.find((s) => s.id === session.shopId) ?? null : null),
    [session, snapshot.shops],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      shops: snapshot.shops,
      accounts: snapshot.accounts,
      activeShop,
      isStaff: session?.role === 'staff',
      isAdmin: session?.role === 'admin',
      isOwner: session?.role === 'owner',
      signIn,
      signOut,
      updateProfile,
    }),
    [session, snapshot.shops, snapshot.accounts, activeShop, signIn, signOut, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('ต้องใช้งานภายใน AuthProvider')
  return ctx
}
