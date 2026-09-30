import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PostgrestError } from '@supabase/supabase-js';
import { HealthPill } from '../components/HealthPill';
import { Sparkline } from '../components/Sparkline';
import { runHealthCheck } from '../lib/api';
import { fmtBaht, fmtDateTime, fmtMs, fmtNumber, fmtPct, timeAgo } from '../lib/format';
import {
  supabase,
  type FailureRow,
  type HealthPoint,
  type SiteOverviewRow,
  type SparkRow,
  type StaffUser,
} from '../lib/supabase';

const POLL_MS = 30_000;

export function DashboardPage({ staff }: { staff: StaffUser }) {
  const [sites, setSites] = useState<SiteOverviewRow[] | null>(null);
  const [sparks, setSparks] = useState<Record<string, HealthPoint[]>>({});
  const [failures, setFailures] = useState<FailureRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canCheck = staff.role === 'super' || staff.role === 'admin';

  const load = useCallback(async () => {
    const [overview, spark, failed] = await Promise.all([
      supabase.from('site_overview').select('*').order('created_at', { ascending: true }),
      supabase.from('site_health_spark').select('*'),
      supabase
        .from('site_health_recent_failures')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(30),
    ]);

    const firstError = overview.error ?? spark.error ?? failed.error;
    if (firstError) {
      setError(firstError.message);
      setSchemaMissing((firstError as PostgrestError).code === '42P01');
      return;
    }

    setError(null);
    setSchemaMissing(false);
    setSites((overview.data ?? []) as SiteOverviewRow[]);

    const map: Record<string, HealthPoint[]> = {};
    for (const row of (spark.data ?? []) as SparkRow[]) {
      map[row.site_id] = row.points ?? [];
    }
    setSparks(map);
    setFailures((failed.data ?? []) as FailureRow[]);
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function check(siteId?: string) {
    setBusy(siteId ?? 'all');
    try {
      const result = await runHealthCheck(siteId);
      const scope = siteId ? sites?.find((s) => s.id === siteId)?.name ?? 'เว็บนั้น' : 'ทุกเว็บ';
      setNotice(
        result.failed === 0
          ? `ตรวจ ${scope} แล้ว ผ่านทั้งหมด ${result.checked} รายการ (${result.durationMs} ms)`
          : `ตรวจ ${scope} แล้ว ไม่ผ่าน ${result.failed}/${result.checked} รายการ`,
      );
      await load();
    } catch (err) {
      setNotice(`สั่งตรวจไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  const summary = useMemo(() => {
    const rows = sites ?? [];
    let up = 0;
    let down = 0;
    let checks = 0;
    let ok = 0;
    for (const s of rows) {
      if (s.health === 'up') up += 1;
      if (s.health === 'down') down += 1;
      checks += s.checks_24h ?? 0;
      ok += s.uptime_24h !== null && s.checks_24h !== null ? (s.uptime_24h / 100) * s.checks_24h : 0;
    }
    return { total: rows.length, up, down, uptime: checks > 0 ? (ok / checks) * 100 : null };
  }, [sites]);

  if (schemaMissing) {
    return (
      <section className="rounded-lg border border-dashed bg-white p-6">
        <h1 className="mb-2 text-lg font-semibold">ยังไม่มีตารางของหน้านี้ในฐานข้อมูล</h1>
        <p className="mb-3 text-sm text-zinc-600">
          ต้องรัน migration <code className="rounded bg-zinc-100 px-1">0005_uptime.sql</code> ก่อน
        </p>
        <pre className="overflow-x-auto rounded bg-zinc-900 p-3 text-xs text-zinc-100">
          npm run supabase:push
        </pre>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ภาพรวมสถานะเว็บ</h1>
          <p className="text-sm text-zinc-600">
            ตรวจอัตโนมัติทุก 5 นาที · หน้านี้รีเฟรชเองทุก 30 วินาที
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            รีเฟรช
          </button>
          {canCheck && (
            <button
              onClick={() => void check()}
              disabled={busy !== null}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {busy === 'all' ? 'กำลังตรวจ…' : 'ตรวจทุกเว็บตอนนี้'}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p className="mb-4 rounded border border-zinc-200 bg-white px-3 py-2 text-sm">{notice}</p>
      )}
      {error && <p className="mb-4 text-sm text-red-600">โหลดไม่สำเร็จ: {error}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="เว็บที่ดูแล" value={fmtNumber(summary.total)} />
        <Stat label="ออนไลน์" value={fmtNumber(summary.up)} tone="text-emerald-600" />
        <Stat label="มีปัญหา" value={fmtNumber(summary.down)} tone={summary.down > 0 ? 'text-red-600' : undefined} />
        <Stat label="Uptime 24 ชม." value={fmtPct(summary.uptime)} />
      </div>

      {!sites ? (
        <p className="text-sm text-zinc-500">กำลังโหลดสถานะ…</p>
      ) : sites.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-zinc-600">
          ยังไม่มีเว็บในทะเบียน — เพิ่มแถวแรกด้วย SQL:
          <pre className="mt-3 overflow-x-auto rounded bg-zinc-900 p-3 text-left text-xs text-zinc-100">
{`insert into public.sites (name, slug, domain, stack, hosting_provider, connector_type, connector_config_ref)
values ('เว็บแรก', 'site-1', 'example.firebaseapp.com',
        'Firebase Hosting + Firestore', 'firebase', 'firestore', 'site-1-firestore');`}
          </pre>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sites.map((site) => (
            <article key={site.id} className="rounded-lg border bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{site.name}</h2>
                  <p className="truncate text-xs text-zinc-500">
                    {site.domain ? (
                      <a
                        className="hover:underline"
                        href={`https://${site.domain}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {site.domain}
                      </a>
                    ) : (
                      'ยังไม่ได้ใส่ domain'
                    )}
                    {site.stack ? ` · ${site.stack}` : ''}
                  </p>
                </div>
                <HealthPill health={site.health} />
              </div>

              <Sparkline points={sparks[site.id] ?? []} />

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <Metric label="Uptime 24 ชม." value={fmtPct(site.uptime_24h)} />
                <Metric label="ตอบกลับ" value={fmtMs(site.latency_ms)} />
                <Metric label="สมาชิก" value={fmtNumber(site.members_total)} />
                <Metric label="ค่าใช้จ่ายเดือนนี้" value={fmtBaht(site.due_this_month)} />
              </dl>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-zinc-500">
                <span>
                  ตรวจล่าสุด {timeAgo(site.last_checked_at)}
                  {site.http_status ? ` · HTTP ${site.http_status}` : ''}
                  {site.monitor_enabled ? ` · ทุก ${site.monitor_interval_minutes} นาที` : ' · ปิดการมอนิเตอร์'}
                </span>
                <span className="flex items-center gap-3">
                  {site.connector_checked_at && (
                    <span title={site.connector_error ?? 'เชื่อมฐานข้อมูลได้'}>
                      ฐานข้อมูล{' '}
                      <span className={site.connector_ok ? 'text-emerald-600' : 'text-red-600'}>
                        {site.connector_ok ? 'ปกติ' : 'มีปัญหา'}
                      </span>
                    </span>
                  )}
                  {canCheck && (
                    <button
                      onClick={() => void check(site.id)}
                      disabled={busy !== null}
                      className="rounded border px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {busy === site.id ? 'กำลังตรวจ…' : 'ตรวจสอบตอนนี้'}
                    </button>
                  )}
                </span>
              </div>

              {site.last_error && (
                <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                  {site.last_error}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-2 text-sm font-semibold">ประวัติที่ตรวจไม่ผ่าน (7 วันล่าสุด)</h2>
        {failures.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-white px-4 py-6 text-center text-sm text-zinc-500">
            ไม่มีเว็บไหนล่มใน 7 วันที่ผ่านมา
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">เว็บ</th>
                  <th className="px-4 py-2.5 font-medium">ตรวจ</th>
                  <th className="px-4 py-2.5 font-medium">รายละเอียด</th>
                  <th className="px-4 py-2.5 font-medium">เวลา</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {failures.map((f) => (
                  <tr key={f.id}>
                    <td className="px-4 py-2.5 font-medium">{f.site_name}</td>
                    <td className="px-4 py-2.5 text-zinc-600">
                      {f.kind === 'http' ? 'เว็บ' : 'ฐานข้อมูล'}
                    </td>
                    <td className="px-4 py-2.5 text-red-700">{f.error ?? '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{fmtDateTime(f.checked_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`text-xl font-semibold ${tone ?? ''}`}>{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
