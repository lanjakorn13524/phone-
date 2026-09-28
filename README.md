# Control Plane

ระบบหลังบ้านกลางสำหรับดูแลเว็บย่อยหลายเว็บ — สถาปัตยกรรมเต็มอยู่ที่ [`ARCHITECTURE.md`](./ARCHITECTURE.md)

**เฟส 0 (สิ่งที่อยู่ใน repo นี้ตอนนี้):** schema + RLS + Login/สิทธิ์ + ทะเบียนเว็บย่อย + Firestore connector (โครง) + cron + backup

## เงื่อนไข

- Node.js ≥ 20
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase`)
- [Deno](https://deno.com) (Edge Functions รันบน Deno)
- บัญชี Supabase (Free) + บัญชี Cloudflare (Pages) + Firebase project ของเว็บแรก

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env.local            # ใส่ค่าจาก Supabase dashboard
npm run supabase:link                 # เชื่อม project (ต้องมี DATABASE_URL / access token)
npm run supabase:push                 # รัน migrations + seed
npm run dev                           # เปิดหน้า admin-web ที่ :5173
```

### 1) ตั้งค่าหลัง `supabase:push`

เพิ่มผู้ใช้งานระบบคนแรก (ทำครั้งเดียว) — สร้าง user ใน Supabase → Authentication → Users → Add user
แล้วเติม role (SQL Editor):

```sql
insert into public.staff_users (id, email, name, role, is_super_admin)
select id, email, 'เจ้าของระบบ', 'super', true from auth.users where email = 'you@example.com'
on conflict (id) do update set role = 'super', is_super_admin = true;
```

### 2) ใส่ secret ลง Vault (credential ของเว็บย่อยห้ามอยู่ใน git)

```sql
-- service account key ของเว็บแรก (Firebase Console > Project Settings > Service Accounts)
select vault.create_secret('{
  "type": "service_account",
  "project_id": "your-project",
  "client_email": "firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "members_collection": "users",
  "active_field": "active",
  "joined_at_field": "createdAt"
}', 'site-1-firestore');

-- ใช้โดย cron ใน pg_cron
select vault.create_secret('https://<project-ref>.supabase.co', 'edge_functions_base_url');
select vault.create_secret('<service-role-key>', 'service_role_key');
```

แล้วผูก secret เข้ากับเว็บ:

```sql
insert into public.sites (name, slug, domain, stack, hosting_provider,
                          connector_type, connector_config_ref)
values ('เว็บแรก', 'site-1', 'example.firebaseapp.com',
        'Firebase Hosting + Firestore', 'firebase', 'firestore', 'site-1-firestore');
```

### 3) Deploy

```bash
supabase functions deploy connectors-firestore sync-member-stats backup-upload
# ตั้ง secret ของ Edge Function
supabase secrets set BACKUP_UPLOAD_TOKEN=<สุ่มยาว 32+ ตัว>
npm run build && npm run deploy:web    # ขึ้น Cloudflare Pages
```

### 4) GitHub Actions (กันโปรเจกต์ถูก pause + backup กลางคืน)

ใส่ repository secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `BACKUP_UPLOAD_TOKEN`

| Workflow | เวลา | ทำอะไร |
|---|---|---|
| `keep-alive.yml` | ทุก 12 ชม. | ยิง DB กัน Supabase pause โปรเจกต์ฟรี + เตือนถ้าล่ม |
| `nightly-backup.yml` | 03:11 ทุกวัน | `pg_dump` → ตรวจ gzip → ส่งเข้า Storage (เก็บ 7 วัน + ของเดือนละ 1) |

> ทำไม backup ไม่รันใน pg_cron: `pg_dump` เป็น client binary รันในฐานข้อมูลไม่ได้ (ข้อ 9.1 #1 ใน ARCHITECTURE.md)

## คำสั่งที่ใช้บ่อย

```bash
npm run dev                              # เปิดหน้าเว็บ admin-web ที่ :5173
npm run typecheck                        # ตรวจ type ทั้ง connector และหน้าเว็บ
npm run supabase:start                  # เปิด stack ในเครื่อง (ต้องมี Docker)
supabase db reset                        # ล้าง + รัน migration + seed ใหม่ทั้งหมด
supabase functions logs connectors-firestore
```

## โครงสร้าง

```
apps/admin-web/                  หน้าเว็บหลังบ้าน (React + Vite + TS + Tailwind) -> Cloudflare Pages
supabase/
  migrations/                    schema + RLS + ฟังก์ชันฝั่งเซิร์ฟเวอร์
  functions/
    _shared/connectors/          interface + Firestore adapter (โค้ดล้วน ไม่พึ่ง SDK gRPC)
    connectors-firestore/        จุดเดียวที่ระบบกลางเข้าถึงข้อมูลเว็บย่อย
    sync-member-stats/           ดึงจำนวนสมาชิกรายวัน (pg_cron เรียก)
    backup-upload/               รับไฟล์ pg_dump จาก CI
.github/workflows/               keep-alive + nightly backup
```

> connector อยู่ใต้ `supabase/functions/` เพราะ Supabase CLI bundle เฉพาะไฟล์ในโฟลเดอร์นั้น
> (ถ้าแยกเป็น `packages/connectors` ตอน deploy จะหาไฟล์ไม่เจอ)

## กฎที่ห้ามละเมิด

1. service_role key ห้ามไปถึง browser — ใช้ Edge Function เท่านั้น
2. credential ของเว็บย่อยอยู่ใน Vault เท่านั้น อ้างด้วย `connector_config_ref`
3. ทุกการเขียน Firestore ต้องผ่าน `connectors-firestore` เท่านั้น (ได้ backup + audit + โควตา + denylist)
4. โมเดล AI อ่านจากตาราง `ai_models` ห้าม hardcode ในโค้ด
5. สครีต service_role / private key เป็น GitHub secret ห้าม commit
