import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { loadStaff, supabase, type StaffUser } from '../lib/supabase';

type State =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'forbidden' }
  | { status: 'ready'; staff: StaffUser };

export function RequireStaff({ children }: { children: (staff: StaffUser) => ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setState(data.session ? await resolve(data.session) : { status: 'anonymous' });
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return;
      setState(next ? await resolve(next) : { status: 'anonymous' });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function resolve(s: Session): Promise<State> {
    const staff = await loadStaff(s.user.id);
    if (!staff) return { status: 'forbidden' };
    return { status: 'ready', staff };
  }

  if (state.status === 'loading') return <p className="p-8 text-sm text-zinc-500">กำลังโหลด…</p>;

  if (state.status === 'anonymous') return <Login />;

  if (state.status === 'forbidden') {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold">ยังเข้าใช้ไม่ได้</h1>
        <p className="mb-4 text-sm text-zinc-600">
          บัญชีนี้ล็อกอินได้ แต่ไม่ได้อยู่ในรายชื่อทีมงาน (staff_users)
          ให้ super admin เพิ่มอีเมลนี้ก่อน
        </p>
        <button
          className="rounded border px-3 py-1.5 text-sm"
          onClick={() => supabase.auth.signOut()}
        >
          ออกจากระบบ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="text-sm font-semibold">Control Plane</div>
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span>
            {state.staff.name ?? state.staff.email} · <Badge role={state.staff.role} />
          </span>
          <button
            className="rounded border px-2.5 py-1 text-xs"
            onClick={() => supabase.auth.signOut()}
          >
            ออกจากระบบ
          </button>
        </div>
      </header>
      <main className="p-6">{children(state.staff)}</main>
    </div>
  );
}

function Badge({ role }: { role: string }) {
  const tone: Record<string, string> = {
    super: 'bg-violet-100 text-violet-700',
    admin: 'bg-blue-100 text-blue-700',
    support: 'bg-amber-100 text-amber-700',
    viewer: 'bg-zinc-100 text-zinc-600',
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs ${tone[role] ?? tone.viewer}`}>{role}</span>;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold">เข้าสู่ระบบ Control Plane</h1>
        <p className="mb-5 text-xs text-zinc-500">เฉพาะทีมงานเท่านั้น</p>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-zinc-600">อีเมล</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block text-zinc-600">รหัสผ่าน</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </label>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
