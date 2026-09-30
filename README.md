# Control Plane

ระบบหลังบ้านกลางสำหรับดูแลเว็บย่อยหลายเว็บ — สถาปัตยกรรมเต็มอยู่ที่ [`ARCHITECTURE.md`](./ARCHITECTURE.md)

**เฟส 0 (สิ่งที่อยู่ใน repo นี้ตอนนี้):** schema + RLS + Login/สิทธิ์ + ทะเบียนเว็บย่อย + Firestore connector (โครง) + cron + backup
**เฟส 1 (ทำแล้วบางส่วน):** หน้า "ภาพรวมสถานะเว็บ" — สถานะออนไลน์/ล่ม, response time, uptime 24 ชม., ประวัติการล่ม, จำนวนสมาชิก, ค่าใช้จ่ายเดือนนี้ (ดูหั้ข้อ 5)

## เงื่อนไข

- Node.js ≥ 20
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase`)
- [Deno](https://deno.com) (Edge Functions รันบน Deno)
- บัญชี Supabase (Free) + บัญชี Cloudflare (Pages) + Firebase project ของเว็บแรก

## เริ่มใช้งาน

```bash
npm install
# สร้าง access token: Dashboard > Settings > Access Tokens > Generate new token
# ใส่ SUPABASE_ACCESS_TOKEN ใน .env.local (SUPABASE_PROJECT_REF มีอยู่แล้ว)
npm run setup:prod                      # migration + seed + vault + deploy Edge Functions ทั้งหมด
npm run dev                             # เปิดหน้า admin-web ที่ :5173
```

> `supabase login` แบบเปิดเบราว์เซอร์ใช้ไม่ได้แล้ว (Supabase ปิด flow นี้) — ต้องใช้ access token
> ถ้าชอบแบบพิมพ์เอง: `npx supabase login --token sbp_...`

`npm run setup:prod` รัน SQL ผ่าน Management API (ตัวเดียวกับ SQL Editor) จึง **ไม่ต้องใช้รหัสผ่านฐานข้อมูล** ทำให้ครบ:
รัน migration ที่ยังไม่เคยรัน (ข้ามของที่รันแล้วจาก `supabase_migrations.schema_migrations`) → seed
→ ตั้ง vault secrets (`service_role_key` + `edge_functions_base_url`) → `secrets set BACKUP_UPLOAD_TOKEN`
(สุ่มใหม่ถ้ายังไม่มี แล้วบันทึกลง `.env.local`) → `functions deploy` ทั้ง 4 ตัว — รันซ้ำได้ไม่พัง

ค่าที่สคริปต์อ่านจาก `.env.local` (ไฟล์นี้อยู่ใน `.gitignore` แล้ว):

| ตัวแปร | เอามาจาก |
|---|---|
| `SUPABASE_PROJECT_REF` | Settings → API (มีอยู่แล้ว) |
| `SUPABASE_ACCESS_TOKEN` | Settings → Access Tokens → Generate new token |
| `SUPABASE_DB_PASSWORD` | ไม่บังคับ — ต้องการตอนจะใช้ `supabase link` (ดู log, `db push`) |

### 1) เพิ่มผู้ใช้งานระบบคนแรก

Supabase → Authentication → Users → Add user (ใส่อีเมลของคุณ) — ทำก่อนข้อ 2

### 2) เพิ่มเว็บย่อยเข้าระบบ (ครั้งแรก หรือทุกเว็บใหม่)

`service_role_key` กับ `edge_functions_base_url` ใส่ Vault ให้แล้วในขั้นตอน `setup:prod` เหลือแค่เว็บ
เปิด `supabase/bootstrap.local.sql` (อยู่ใน `.gitignore` เพราะจะมี private key ของ Firebase อยู่ข้างใน) แก้ 2 จุดแล้ววางรันใน SQL Editor:

- JSON ของ Firebase service account + เติม `"members_collection"` (ชื่อคอลเลกชันผู้ใช้ เช่น `users`)
- `domain` ของเว็บ (ยังไม่มีจะขึ้น "ยังไม่ทราบ" ในหน้าภาพรวม และข้ามการเช็ค HTTP)

credential ถูกอ่านจาก Vault โดยเฉพาะฝั่ง server — หน้าเว็บไม่มีทางเห็นค่านี้

### 3) Deploy หน้าเว็บ

```bash
npm run build && npm run deploy:web    # ขึ้น Cloudflare Pages
```

### 4) GitHub Actions (กันโปรเจกต์ถูก pause + backup กลางคืน)

ใส่ repository secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `BACKUP_UPLOAD_TOKEN`

| Workflow | เวลา | ทำอะไร |
|---|---|---|
| `keep-alive.yml` | ทุก 12 ชม. | ยิง DB กัน Supabase pause โปรเจกต์ฟรี + เตือนถ้าล่ม |
| `nightly-backup.yml` | 03:11 ทุกวัน | `pg_dump` → ตรวจ gzip → ส่งเข้า Storage (เก็บ 7 วัน + ของเดือนละ 1) |

> ทำไม backup ไม่รันใน pg_cron: `pg_dump` เป็น client binary รันในฐานข้อมูลไม่ได้ (ข้อ 9.1 #1 ใน ARCHITECTURE.md)

### 5) Uptime monitor — หน้า "ภาพรวมสถานะเว็บ"

Edge Function `check-sites` เช็คทุกเว็บในทะเบียน 2 อย่าง แล้วเขียนผลลง `site_health_checks`
(append-only เก็บ 30 วัน, `cron_cleanup` ลบทิ้งเอง):

| ชนิด | ตรวจอะไร | ความถี่ |
|---|---|---|
| `http` | `GET https://<domain><health_path>` — วัด response time + status | ทุก `monitor_interval_minutes` (ค่าเริ่มต้น 5 นาที) |
| `connector` | ping Firestore ของเว็บนั้น (แยก "เว็บล่ม" ออกจาก "ต่อข้อมูลไม่ได้") | ทุก 60 นาที |

- `pg_cron` เรียกทุก 5 นาที (`cron_check_sites`) — ฟังก์ชันเป็นตัวตัดสินใจเองว่าถึงรอบหรือยัง
- ปุ่ม "ตรวจทุกเว็บตอนนี้" / "ตรวจสอบตอนนี้" ในหน้าเว็บ (admin ขึ้นไป) = บังคับเช็คทันที ไม่สนรอบเวลา
- เว็บที่ `status = 'maintenance'` แสดงเป็น "ปิดเว็บชั่วคราว" ไม่ถูกนับว่าล่ม
- เว็บที่ยังไม่มี `domain` จะขึ้น "ยังไม่ทราบ" และเช็คแค่ต่อฐานข้อมูล (ไม่เขียนค่าล่มปลอม ๆ)

ตั้งค่าต่อเว็บ:

```sql
update public.sites
   set domain = 'example.firebaseapp.com',
       health_path = '/',
       monitor_interval_minutes = 5,
       monitor_enabled = true
 where slug = 'site-1';
```

## คำสั่งที่ใช้บ่อย

```bash
npm run dev                              # เปิดหน้าเว็บ admin-web ที่ :5173
npm run typecheck                        # ตรวจ type ทั้ง connector และหน้าเว็บ
npm run setup:prod                       # deploy รอบแรก (link + migration + seed + functions)
npm run supabase:start                  # เปิด stack ในเครื่อง (ต้องมี Docker)
supabase db reset                        # ล้าง + รัน migration + seed ใหม่ทั้งหมด
supabase functions logs connectors-firestore
supabase functions logs check-sites
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
    check-sites/                 ตรวจสุขภาพทุกเว็บ (pg_cron ทุก 5 นาที + ปุ่มในหน้าเว็บ)
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
