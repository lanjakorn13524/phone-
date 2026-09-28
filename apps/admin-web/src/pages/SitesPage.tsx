import { useCallback, useEffect, useState } from 'react';
import { supabase, type SiteRow, type StaffUser } from '../lib/supabase';

const STATUS_TONE: Record<SiteRow['status'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  maintenance: 'bg-amber-100 text-amber-700',
  down: 'bg-red-100 text-red-700',
};

export function SitesPage({ staff }: { staff: StaffUser }) {
  const [sites, setSites] = useState<SiteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canEdit = staff.role === 'super' || staff.role === 'admin';

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('sites')
      .select('*')
      .order('created_at', { ascending: true });
    if (err) setError(err.message);
    setSites((data as SiteRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-sm text-red-600">โหลดไม่สำเร็จ: {error}</p>;
  if (!sites) return <p className="text-sm text-zinc-500">กำลังโหลดรายชื่อเว็บ…</p>;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">เว็บย่อย</h1>
          <p className="text-sm text-zinc-600">ทะเบียนเว็บทั้งหมดที่ระบบกลางดูแล</p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          รีเฟรช
        </button>
      </div>

      {sites.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
          ยังไม่มีเว็บในทะเบียน — เพิ่มแถวแรกด้วย SQL:
          <pre className="mt-3 overflow-x-auto rounded bg-zinc-900 p-3 text-left text-xs text-zinc-100">
{`insert into public.sites (name, slug, domain, stack, hosting_provider, connector_type, connector_config_ref)
values ('เว็บแรก', 'site-1', 'example.firebaseapp.com',
        'Firebase Hosting + Firestore', 'firebase', 'firestore', 'site-1-firestore');`}
          </pre>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">ชื่อเว็บ</th>
                <th className="px-4 py-2.5 font-medium">slug</th>
                <th className="px-4 py-2.5 font-medium">stack</th>
                <th className="px-4 py-2.5 font-medium">connector</th>
                <th className="px-4 py-2.5 font-medium">สถานะ</th>
                <th className="px-4 py-2.5 font-medium">โควตา/วัน</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sites.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">{s.slug}</td>
                  <td className="px-4 py-3 text-zinc-600">{s.stack ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {s.connector_type}
                    {!s.connector_config_ref && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                        ยังไม่ตั้ง credential
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_TONE[s.status]}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {s.daily_quota}
                    {!canEdit && <span className="ml-2 text-xs text-zinc-400">(อ่านอย่างเดียว)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <p className="mt-4 text-xs text-zinc-500">
          การเพิ่ม/แก้เว็บทำผ่าน SQL ได้ตอนนี้ (โค้ด UI จะมาในเฟส 1) — RLS บังคับว่าเฉพาะ
          admin ขึ้นไปเท่านั้นที่เขียนได้
        </p>
      )}
    </section>
  );
}
