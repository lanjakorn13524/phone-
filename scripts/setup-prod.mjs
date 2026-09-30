#!/usr/bin/env node
// deploy รอบแรก — ใช้ access token ตัวเดียว ไม่ต้องใช้รหัสผ่านฐานข้อมูล
//
// ต้องมีใน .env.local (หรือ environment ปัจจุบัน):
//   SUPABASE_ACCESS_TOKEN=sbp_...   Settings > Access Tokens > Generate new token
//   SUPABASE_PROJECT_REF=...        Settings > API
//   SUPABASE_DB_PASSWORD=...        *ไม่บังคับ* ต้องการต่อเมื่อจะใช้ supabase link (เช่นดู log)
//
// ขั้นตอน: รัน migration + seed -> ตั้ง vault secrets -> ตั้ง edge secret -> deploy ทุกฟังก์ชัน

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.local');
const FUNCTIONS = ['connectors-firestore', 'sync-member-stats', 'backup-upload', 'check-sites'];

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) out[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const fileEnv = readEnvFile(envFile);
const env = { ...fileEnv, ...process.env };

const token = env.SUPABASE_ACCESS_TOKEN;
const ref = env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error(
    'ข้อมูลไม่ครบ — ต้องมี SUPABASE_ACCESS_TOKEN (sbp_...) และ SUPABASE_PROJECT_REF ใน .env.local\n' +
      'สร้าง token ที่ Dashboard > Settings > Access Tokens\n',
  );
  process.exit(1);
}

const api = `https://api.supabase.com/v1/projects/${ref}`;

/** รัน SQL ผ่าน Management API (ตัวเดียวกับที่ SQL Editor ใช้) — ไม่ต้องมีรหัสผ่าน DB */
async function sql(query) {
  const res = await fetch(`${api}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 500));
  return text;
}

const quoted = (v) => `'${String(v).replaceAll("'", "''")}'`;

function run(label, args) {
  process.stdout.write(`\n[${label}] supabase ${args.join(' ')}\n`);
  const res = spawnSync('npx', ['--yes', 'supabase@latest', ...args], { cwd: root, stdio: 'inherit', env });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

// ---------- 1) migration + seed ----------
// ใช้ตารางประวัติของ CLI เอง (supabase_migrations.schema_migrations) เพื่อไม่รันซ้ำ
await sql(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text NOT NULL PRIMARY KEY);
  alter table supabase_migrations.schema_migrations add column if not exists statements text[];
  alter table supabase_migrations.schema_migrations add column if not exists name text;
`);

const applied = new Set(
  JSON.parse(await sql('select version from supabase_migrations.schema_migrations'))
    .map((r) => r.version),
);

const migrations = readdirSync(join(root, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort();

for (const file of [...migrations, '../seed.sql']) {
  const version = file.replace(/^\.\.\/|\.sql$/g, '');
  if (applied.has(version)) {
    console.log(`[sql] ${version} ... ข้าม (รันไปแล้ว)`);
    continue;
  }
  const path = join(root, 'supabase/migrations', file);
  process.stdout.write(`[sql] ${version} ... `);
  await sql(readFileSync(path, 'utf8'));
  await sql(
    `insert into supabase_migrations.schema_migrations (version, name) values (${quoted(version)}, ${quoted(version)}) on conflict (version) do nothing`,
  );
  console.log('ok');
}

// ---------- 2) vault secrets ----------
// cron ยิง Edge Functions ด้วย key ที่เก็บใน vault ถ้าไม่มี ฟังก์ชันจะไม่มีทางรู้ว่าใครเป็นระบบ
process.stdout.write('[sql] vault secrets ... ');
const { service_role: serviceRoleKey } = await (
  await fetch(`${api}/api-keys`, { headers: { Authorization: `Bearer ${token}` } })
).json();

await sql(`
  do $vault$
  begin
    if not exists (select 1 from vault.decrypted_secrets where name = 'service_role_key') then
      perform vault.create_secret(${quoted(serviceRoleKey)}, 'service_role_key');
    end if;
    if not exists (select 1 from vault.decrypted_secrets where name = 'edge_functions_base_url') then
      perform vault.create_secret(${quoted(`https://${ref}.supabase.co`)}, 'edge_functions_base_url');
    end if;
  end $vault$;
`);
console.log('ok (มีอยู่แล้วก็ข้าม)');

// ---------- 3) edge function secret ----------
if (!env.BACKUP_UPLOAD_TOKEN) {
  const value = randomBytes(24).toString('hex');
  writeFileSync(envFile, `${readFileSync(envFile, 'utf8').trimEnd()}\nBACKUP_UPLOAD_TOKEN=${value}\n`);
  env.BACKUP_UPLOAD_TOKEN = value;
  console.log(`\nสร้าง BACKUP_UPLOAD_TOKEN ใหม่ (เก็บใน .env.local)`);
}
run('secrets set', ['secrets', 'set', '--project-ref', ref, `BACKUP_UPLOAD_TOKEN=${env.BACKUP_UPLOAD_TOKEN}`]);

// ---------- 4) deploy ----------
run('functions deploy', ['functions', 'deploy', '--project-ref', ref, ...FUNCTIONS]);

console.log(`\nเสร็จ: ${migrations.length} migrations + seed + vault + ${FUNCTIONS.length} Edge Functions\n`);
console.log('เหลือสิ่งที่ต้องทำเอง (ต้องใช้หน้า Dashboard):');
console.log('  1) Authentication > Users > Add user = อีเมลของคุณ (ติ๊ก Auto Confirm User)');
console.log('  2) SQL Editor > รัน supabase/bootstrap.local.sql (เติมอีเมล + domain + Firebase JSON)');
console.log(`  3) GitHub repository secret: BACKUP_UPLOAD_TOKEN (ค่าเดียวกับใน .env.local) — ใช้กับ nightly-backup.yml`);
if (!env.SUPABASE_DB_PASSWORD) {
  console.log('\nหมายเหตุ: ยังไม่ได้ใส่ SUPABASE_DB_PASSWORD — ต้องการตอนจะใช้ supabase link (เช่นดู log, db push)');
}
