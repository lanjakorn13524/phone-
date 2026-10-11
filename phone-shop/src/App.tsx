import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAuth } from './lib/auth'
import { useBackend } from './lib/backend'
import { AddPage } from './pages/AddPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { ShopsPage } from './pages/ShopsPage'
import { SoldPage } from './pages/SoldPage'
import { StockPage } from './pages/StockPage'

export default function App() {
  const { ready, error } = useBackend()
  const { session } = useAuth()

  if (!ready) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        กำลังโหลดข้อมูล...
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 p-6 text-center text-red-500 dark:bg-slate-950">
        {error}
      </div>
    )
  }

  if (!session) return <LoginPage />

  const isStaff = session.role === 'staff'

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/stock" replace />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/sold" element={<SoldPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {isStaff ? (
          <Route path="/add" element={<AddPage />} />
        ) : (
          <Route path="/shops" element={<ShopsPage />} />
        )}
        <Route path="*" element={<Navigate to="/stock" replace />} />
      </Route>
    </Routes>
  )
}
