import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { btnPrimary, inputClass, labelClass } from '../components/ui'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('กรอกอีเมลและรหัสผ่านก่อนนะ')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง')
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-xl font-bold text-white shadow-sm">
            PS
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">ระบบสต็อกมือถือ</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            เข้าสู่ระบบเพื่อใช้งานแอปสต็อกมือถือของคุณ
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 text-center">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              ยินดีต้อนรับกลับ
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              กรอกอีเมลและรหัสผ่านเพื่อเข้าสู่ระบบ
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="login-email">
                อีเมล
              </label>
              <input
                id="login-email"
                className={inputClass}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@shop.com"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="login-password">
                รหัสผ่าน
              </label>
              <input
                id="login-password"
                className={inputClass}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
              />
            </div>

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <button type="submit" className={`${btnPrimary} w-full`} disabled={busy}>
              {busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}