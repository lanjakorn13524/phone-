# สถาปัตยกรรม: Control Plane จัดการเว็บย่อยหลายเว็บ (ฉบับ v2 — Free Solo)

> v1 เป็นแผนแบบ "เตรียมให้ใหญ่ไว้ก่อน" (Fastify + Redis + BullMQ + R2 + NestJS) ซึ่งเหมาะกับทีม 2–3 คนและมีงบประมาณ
> v2 ปรับให้ตรงกับ **งบ 0 บาท / คนเดียว / เว็บย่อย 1 เว็บแต่จะเพิ่ม** โดยตัด service ที่ต้องดูแลต่อเนื่องออกให้หมด

---

## 0. สิ่งที่ตัดสินแล้ว (ไม่ต้องเถียงอีก)

| หัวข้อ | คำตอบ | ผลต่อสถาปัตยกรรม |
|---|---|---|
| โฮสติ้ง | **ฟรี 100%** — Supabase Free + Cloudflare Pages | ไม่ต้องมี API server, Redis, หรือ object storage แยก |
| ทีมงาน | **1 คน** (อนาคตอาจเพิ่ม) | เลี่ยง service ที่ต้องมีคนดูแลต่อเนื่อง, เลี่ยง Kubernetes/Docker compose |
| สมาชิก | **แยกระบบกันทุกเว็บ** | ไม่มี SSO, ไม่มีตาราง `members` กลาง — เก็บเป็น mirror รายเว็บ |
| งบรายเดือน | **0 บาท** | AI ต้องเป็น free tier เท่านั้น + ต้องมีนับโควตา |
| ขนาดระบบ | **1 เว็บแรก (Firebase/Firestore)**, จะเพิ่มเรื่อย ๆ | สคีมาต้องรองรับ N เว็บตั้งแต่แรก แต่โค้ดทำเท่าที่เว็บแรกต้องใช้ |

**หลักการใหม่: ยิ่งเพิ่มเว็บย่อย ยิ่งต้องเพิ่มแค่ "แถวในตาราง" ไม่ใช่เพิ่มระบบ**

---

## 1. เป้าหมาย

1. รู้ว่าเว็บย่อยแต่ละเว็บ **ใช้เทคโนโลยีอะไร** และ **ใช้เงินเท่าไหร่**
2. ดูจำนวนสมาชิก **แยกรายเว็บ** และเปิดดูรายชื่อสมาชิกได้จากที่เดียว
   - *สำหรับเว็บแรก:* ยอดรวมเก็บ snapshot รายวัน, รายชื่อดึงสดจาก Firestore ตอนเปิดหน้า — ไม่ copy ข้อมูลส่วนตัวเข้าระบบกลาง
3. **แก้ไขข้อมูลใน Firestore** ของเว็บย่อยได้อย่างปลอดภัย
4. มี **ช่องแชท** ให้เว็บย่อยแจ้งปัญหา โดยมี **AI ตอบเบื้องต้น** ได้เอง
5. **แก้ไขเว็บย่อย** (คอนเทนต์/หน้า/เมนู/ค่าตั้ง) ได้จากในระบบนี้
   - *หมายเหตุ:* เว็บแรกเป็น Firebase → คอนเทนต์/เมนู/ค่าตั้งเก็บใน Firestore → **ข้อ 3 ครอบคลุมข้อ 5 ไปครึ่งหนึ่งแล้ว** ไม่ต้องทำ CMS Editor แยกตอนนี้

---

## 2. ภาพรวมระบบ (Free Solo)

```
ผู้ใช้งานระบบ (คนเดียวตอนนี้ / ทีมในอนาคต)
   |
   v
+---------------------------------------------------------------+
|  Cloudflare Pages  (React + Vite + TS + Tailwind + shadcn/ui)   |
|  = หน้าเว็บหลังบ้าน static ทั้งหมด ฟรี แบนด์วิธไม่จำกัด            |
+---------------------------------------------------------------+
   |  เรียกตรงผ่าน supabase-js (ปลอดภัยด้วย RLS + JWT)
   v
+---------------------------------------------------------------+
|  Supabase (Free)                                                 |
|  ├── Postgres  = ฐานข้อมูลกลาง + pg_trgm (ค้นภาษาไทย)           |
|  ├── Auth      = บัญชีผู้ใช้งานระบบ (staff) + 2FA                 |
|  ├── Realtime  = ช่องแชท (WebSocket) ไม่ต้องเขียนเอง             |
|  ├── Storage   = ไฟล์แนบเอกสาร/รูป (1 GB)                       |
|  ├── Vault     = เก็บ secret เข้ารหัส (แทน KMS)                 |
|  ├── pg_cron   = ตัวแทน BullMQ (sync/แจ้งเตือน/keep-alive)      |
|  └── Edge Functions = "API + Connector" (Deno) 500k calls/เดือน  |
+---------------------------------------------------------------+
   |
   v
Firebase / Firestore ของเว็บย่อยแต่ละเว็บ  (ผ่าน Service Account)
   │
   └─► AI: Cloudflare Workers AI (ฟรี 10k neurons/วัน)
       └─► Gemini Flash-Lite free tier (จัดกลุ่ม intent/สรุป)
```

### สิ่งที่ตัดออกจาก v1 และเหตุผล

| ตัดออก | แทนด้วย | เหตุผล |
|---|---|---|
| Fastify / NestJS API server | Supabase Edge Functions (Deno) | ไม่ต้องเช่าเครื่อง, ไม่ต้องดูแล process, deploy ได้ด้วย `supabase deploy` |
| Redis + BullMQ | `pg_cron` + ตาราง `job_runs` | งานไม่ถี่และไม่หนัก ประหยัดตัวเลขกว่ามาก |
| Cloudflare R2 | Supabase Storage (1 GB) | ไฟล์แนบไม่เยอะ ประหยัดตัวแลือก |
| Sentry (ชั้นล่าง) | Sentry free tier + error table ใน Postgres | 5k error/เดือนฟรี พอสำหรับคนเดียว |
| SSO / ตาราง `members` กลาง | `site_members` mirror รายเว็บ | สมาชิกแยกระบบ ไม่มีอัตราตัวตนกลางให้ยึด |
| CMS Editor แยก | Data Editor (Firestore) รองรับคอนเทนต์ไปก่อน | เว็บแรกเก็บคอนเทนต์ใน Firestore อยู่แล้ว |

### ข้อดีของทางเลือกนี้

- ค่าใช้จ่าย = 0 บาทถาวรจนกว่าจะโตเกินโควตา
- ไม่มีอะไรต้อง "คอยดู" (ไม่มี container ล่ม, ไม่มี cert หมดอายุ, ไม่มี Redis โดนโดน)
- **Cloudflare Pages เป็น static** = deploy กี่ครั้งก็ได้ ไม่มี cold start
- เมื่อเกินโควตาค่อยอัปเกรดทีละจุด (Supabase Pro $5/เดือน) — ไม่ต้องรื้อสถาปัตยกรรม

---

## 3. ส่วนประกอบหลัก

### 3.1 Site Registry (ทะเบียนเว็บย่อย)

| Field | ตัวอย่าง | ทำไมต้องมี |
|---|---|---|
| `id` | uuid | คีย์หลักของทุกอย่างในระบบ |
| `name` / `slug` | เว็บขายกาแฟ | ระบุตัวตน |
| `domain` | coffee.example.com | ยิง API / ตรวจสุขภาพ |
| `stack` | Firebase Hosting + Firestore | ตอบโจทย์ "เว็บใช้อะไร" |
| `hosting_provider` | Firebase / VPS-A | ผูกกับค่าใช้จ่าย |
| `connector_type` | `firestore` | บอกว่าจะเชื่อมยังไง |
| `connector_config` | JSON → เก็บใน Vault | project id, database, key ของเว็บ |
| `status` | active / maintenance / down | คุมทั้งระบบ |
| `version` | git sha | รู้ว่า deploy อะไรอยู่ |
| `daily_quota` | 100 | โควตาเขียนข้อมูล/วัน/เว็บ (มาตรการกันพลาด) |

> **เพิ่มเว็บใหม่ = insert 1 แถว** (ถ้าเป็น Firebase) หรือ +1 ไฟล์ connector (ถ้าเป็น stack อื่น)

### 3.2 Connector Layer

| เว็บย่อย | ต่อยังไง | สถานะ |
|---|---|---|
| **Firebase / Firestore** | **Firestore REST API v1 + self-signed JWT ของ Service Account** (ไม่ใช้ Admin SDK) | ✅ **ทำเฟสแรก** |
| MySQL / MariaDB | Edge Function + driver, user สิทธิ์จำกัด | ⏳ เมื่อมีเว็บแรกที่ใช้ |
| PostgreSQL | เหมาะนัก | ⏳ เมื่อมีเว็บแรกที่ใช้ |
| WordPress | WP REST API + Application Password | ⏳ เมื่อมีเว็บแรกที่ใช้ |
| Node / Next / Laravel | REST endpoint ในตัวเว็บ (Site Agent) | ⏳ เมื่อมีเว็บแรกที่ใช้ |

**ทำแค่ Firestore ตอนนี้** แต่เขียนเป็น interface เดียวกันตั้งแต่แรก:

```ts
// supabase/functions/_shared/connectors/types.ts
export interface SiteConnector {
  ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }>
  countMembers(): Promise<{ total: number; active: number; newThisMonth: number }>
  listMembers(site: Site, opts: { limit: number; cursor?: string }): Promise<MemberPage>
  listCollections(): Promise<Array<{ name: string }>>
  readDoc(site: Site, path: string): Promise<{ data: unknown; exists: boolean }>
  writeDoc(site: Site, path: string, data: unknown, ctx: WriteContext): Promise<WriteResult>
  listCollections(): Promise<Array<{ name: string }>>
}
```

- ข้อดี: เพิ่มเว็บใหม่ไม่ต้องแก้ระบบกลาง — แค่เขียน adapter ตัวใหม่
- ข้อเสีย: เขียนผิด = ข้อมูลเสียหาย → ต้องมีระบบกันพลาด (ดู 3.3)
- **ห้ามเขียน Firestore logic ใน Edge Function โดยตรง** — ต้องผ่าน interface เสมอ จะได้ทดสอบและสลับได้
- **ทำไมไม่ใช้ Firebase Admin SDK:** SDK ใช้ gRPC ซึ่งรันบน Deno (Edge Functions) ไม่เสถียร
  จึงเขียน client บน Firestore REST API v1 เอง พร้อม self-signed JWT จาก WebCrypto — ไม่มี dependency, ทดสอบง่าย
- **โค้ด connector อยู่ใต้ `supabase/functions/_shared/`** เพราะ Supabase CLI bundle เฉพาะไฟล์ในโฟลเดอร์นั้น
  (แยกเป็น `packages/connectors` ตอน deploy จะหาไฟล์ไม่เจอ)

**ทางเลือกระยะยาว: Site Agent** — ติดตั้งแพ็กเกจเดียวกันในทุกเว็บ เปิด endpoint เดียวมาให้ระบบกลางเรียก
- ปลอดภัยกว่า ไม่ต้องเปิด credential ออกนอก, ทำ operation แปลก ๆ ได้, มี log
- แต่ต้องแก้โค้ดทุกเว็บ → **รอเว็บที่ 2 ค่อยตัดสินใจ** (สองแนวทางเป็น interface เดียวกัน ใช้ร่วมกันได้)

### 3.3 Data Editor (แก้ไขข้อมูล Firestore) — หน้าที่อันตรายที่สุด

ความปลอดภัย 6 ชั้น (ชั้นที่ 6 เพิ่มใหม่):

1. **Read-only เป็นค่าเริ่มต้น** — ต้องเปิด "โหมดแก้ไข" อย่างชัดเจน
2. **Preview diff** — แสดงค่าใหม่ vs เดิม ก่อน commit
3. **Backup ก่อนเขียนทุกครั้ง** — snapshot ลงตาราง `data_change_backup` (ค้นย้อนหลังได้จากหน้า Audit)
4. **โควตา** — เขียนได้ไม่เกิน `sites.daily_quota` ครั้ง/วัน/เว็บ
5. **Audit log ทุกครั้ง** — ใคร แก้ path อะไร จากอะไร เป็นอะไร และย้อนกลับได้
6. **Denylist path** — `users/*/role`, `users/*/email`, `billing/*`, `secrets/*` แก้ผ่านหน้านี้ไม่ได้
7. **ยืนยันสองขั้น** — พิมพ์ชื่อเว็บเพื่อยืนยันก่อน commit (กันกดผิด)

### 3.4 ระบบแชท + AI

```
เว็บย่อยแจ้งปัญหา
      |
      v
  Supabase Realtime (WebSocket — ไม่ต้องเขียน server)
      |
      v
  Intent Router (Edge Function)
    |-- วิธีใช้งาน --> ค้นคู่มือด้วย pg_trgm -> AI สรุป + อ้างอิงแหล่งที่มา
    |-- บั๊ก/ผิดพลาด --> เปิด Ticket อัตโนมัติ + AI วิเคราะห์เบื้องต้น
    |                    + เสนอวิธีแก้ (คนอนุมัติก่อนลงมือเสมอ)
    |-- เรื่องเงิน/บัญชี --> ส่งทีมงานตรง
    |-- งงมาก/เสี่ยง -----> ส่งคนทันที + สรุปบทสนทนาให้เจ้าหน้าที่
```

**AI ฟรี — เลือก 2 ตัว สลับหน้าที่กัน**

| งาน | โมเดล | โควตาฟรี |
|---|---|---|
| ตอบคำถามคู่มือ (ภาษาไทย), สรุปบทสนทนา, วิเคราะห์เบื้องต้น | Cloudflare Workers AI | 10,000 neurons/วัน |
| จัดกลุ่ม intent, สกัดข้อมูล, สร้างคำแนะนำสั้น ๆ | Google Gemini Flash-Lite (free tier) | ~500 req/วัน |

> ⚠️ Cloudflare ล็อกโมเดลหนัก ๆ ไว้เฉพาะแผน Paid ($5/เดือน) เหลือบน Free เช่น `@cf/zai-org/glm-4.7-flash`, `@cf/google/gemma-4-26b-a4b-it`, `@cf/nvidia/nemotron-3-120b-a12b`
> ⚠️ โมเดลฟรีเปลี่ยนชื่อบ่อย — **ห้าม hardcode model id** ต้องอ่านจากตาราง `ai_models` ใน DB แก้ได้โดยไม่ต้อง deploy
> ⚠️ คุณภาพภาษาไทยของโมเดลฟรียังห่างจาก Claude — ยอมรับได้เพราะงานหลักคือ "ค้นคู่มือมาตอบ" ไม่ใช่คิดเอง

**RAG สำหรับภาษาไทย (สำคัญ):** Postgres full-text search ของ Supabase **ตัดคำภาษาไทยไม่ได้** อย่าใช้ `to_tsvector` ตรง ๆ — ให้ใช้ `pg_trgm` (เปิดได้ฟรีใน Supabase) ทำ fuzzy substring match แล้วค่อยส่ง chunk ที่ match ให้ AI สรุป วิธีนี้ไทยได้ผลจริงและไม่ต้องเพิ่ม dependency

**หลักการที่ห้ามละเมิด**
- AI **ไม่เขียน production เองโดยไม่มีคนอนุมัติ** — เสนอคำสั่ง → คนกดยืนยัน → ระบบ execute เท่านั้น
- AI เรียก connector ผ่านชั้นสิทธิ์เดียวกันกับคน (ตาราง `roles`) — ไม่มีทางลัด
- **บันทึก token ทุกครั้ง** ลง `ai_usage` → รู้ว่าใกล้ชนลิมิตเมื่อไหร่ (สำคัญมากตอนงบ 0)

---

## 4. โควตาฟรีและความเสี่ยงที่ต้องรู้

| บริการ | โควตาฟรี | พอไหม (1 เว็บ) | ความเสี่ยง |
|---|---|---|---|
| Supabase DB | 500 MB | ✅ พอมาก | ❗**project ฟรี pause ถ้าไม่มี activity 7 วัน** |
| Supabase Edge Functions | 500,000 calls/เดือน | ✅ เกินจำเป็น | — |
| Supabase Realtime | 2 ล้าน msg/เดือน, 200 คนพร้อมกัน | ✅ | — |
| Supabase Storage | 1 GB | ✅ | — |
| Supabase Egress | 5 GB/เดือน | ✅ | — |
| Cloudflare Pages | แบนด์วิธไม่จำกัด, 500 builds/เดือน | ✅ | — |
| Workers AI | 10,000 neurons/วัน | ✅ | ❗โมเดลถูกล็อก/เปลี่ยนบ่อย |
| Gemini free | ~500 req/วัน | ✅ | ❗Google ไม่ประกาศตัวเลข ต้องดูใน AI Studio เอง |

### แผนรับมือ (ทำตั้งแต่เฟส 0 ไม่ใช่ตอนเจอปัญหา)

| ความเสี่ยง | วิธีรับมือ |
|---|---|
| **Supabase ถูก pause** | GitHub Actions cron ทุก 12 ชม. ยิง health check DB + `UptimeRobot` เช็คทุก 5 นาที → กัน pause และเตือนพร้อมกัน |
| **ไม่มี auto backup (free)** | **แบบชั่วคราว (เฟส 0):** `pg_dump` ใน GitHub Actions (03:11 ทุกวัน) → ส่งเข้า Edge Function `backup-upload` → Supabase Storage เก็บ 7 วัน + ของเดือนละ 1 (ลบอัตโนมัติ) — **pg_cron รัน `pg_dump` ไม่ได้ เพราะมันเป็น client binary ไม่ใช่ SQL**<br>**อัปเกรดเป็น Cloudflare R2** (10 GB, egress ฟรี, lifecycle rule ล้างไฟล์ให้เอง) เมื่อเว็บที่ 2 หรือ dump เกิน 1 GB — ดูข้อ 9.1 #1 |
| **AI ฟรีตอบผิด/ตอบไม่รู้** | ใส่ system prompt บังคับอ้างอิงแหล่งที่มา + ถ้าคะแนนความมั่นใจ < เกณฑ์ ให้ตอบ "ยังไม่มีข้อมูล เดี๋ยวส่งให้ทีมงาน" → escalate ให้คน |
| **AI free tier ตัด** | สลับ provider ได้จากตาราง `ai_models` ไม่ต้องแก้โค้ด (ออกแบบไว้ให้เป็น pluggable) |
| **โตเกินโควตา** | ตั้ง usage alert ใน Supabase billing + alert ใน Slack/Discord เมื่อถึง 80% → ค่อยอัป Pro ($5/เดือน) เป็นขั้นตอนที่เตรียมไว้ ไม่ใช่เรื่องล้มเหลว |
| **ไม่มี static outbound IP → ไม่มี IP allowlist** | แก้ไม่ได้ฟรี (ไม่มี provider ฟรีไหนให้) → ลดความเสี่ยงแทน 4 ข้อด้านล่าง |

### 4.1 การลดความเสี่ยงแทน IP allowlist (ฟรีทั้งหมด)

1. **แยก Firebase project ต่อ 1 เว็บ** — credential หนึ่งหมดกระทบแค่เว็บเดียว (ระดับความเสียหายเท่ากับจำนวนเว็บ)
2. **Custom IAM role** — จำกัดให้เขียนได้เฉพาะ path ที่ต้องแก้ เช่น `projects/x/databases/(default)/documents/sites/*`
3. **Budget alert + auto-revoke** — ตั้ง budget ที่ GCP (เช่น 100 บาท) แล้วให้ Cloud Scheduler ตรวจ spend → เกินก็ revoke key อัตโนมัติ (เปลี่ยนจาก "ไม่มีเพดาน" เป็น "มีเพดาน")
4. **Cloud Audit Logs** — ตรวจว่าใครอ่าน/เขียน และ alert เมื่อมี activity ผิดปกติ

> ❌ ไม่แนะนำ: เช่า VPS เพียงเพื่อให้มี IP ถาวร (ผิดเงื่อนไขงบ 0) หรือย้ายไป provider ที่ต้องจ่ายเงิน

---

## 5. Schema ฐานข้อมูลกลาง (PostgreSQL)

```sql
-- เปิดส่วนขยาย (ฟรี ใน Supabase)
create extension if not exists pg_trgm;   -- ค้นภาษาไทยแบบ fuzzy
create extension if not exists pgcrypto; -- เข้ารหัส/สุ่ม

-- ===== ผู้ใช้งานระบบ (staff เท่านั้น — ไม่มีสมาชิกลูกค้าเข้ามา) =====
staff_users(id uuid pk references auth.users, email, name,
            role text check (role in ('super','admin','support','viewer')),
            is_super_admin bool default false, last_login_at)

-- ===== ทะเบียนเว็บย่อย =====
sites(id uuid pk, name, slug unique, domain, stack, hosting_provider,
      connector_type, status, version, daily_quota int default 100,
      connector_config_ref text,   -- ชี้ไปที่ vault secret ไม่เก็บ credential ตรง ๆ
      created_at, updated_at)

-- ===== ค่าใช้จ่าย =====
site_costs(id, site_id -> sites, provider, category,  -- hosting/domain/plugin/sms/ai
           amount numeric, currency, billing_cycle,   -- monthly/yearly/one_time
           next_due_date, note, created_at)

-- ===== สมาชิก (แยกระบบต่อเว็บ — แหล่งความจริงอยู่ที่ Firestore ของแต่ละเว็บ) =====
-- เว็บแรก: ไม่ต้องสร้างตารางนี้ก็ได้ — ดึงรายชื่อสด ๆ จาก Firestore ตอนเปิดหน้า "สมาชิก"
-- เก็บก็ต่อเมื่อต้องค้นหาข้ามเว็บ/ส่งออก CSV/เก็บประวัติการเปลี่ยนแปลง
site_members(id, site_id -> sites,
             external_id text,          -- uid ของระบบในเว็บนั้น
             email, display_name, plan, status, joined_at,
             synced_at, raw jsonb,
             unique(site_id, external_id))

site_member_stats(site_id -> sites, total, active, new_this_month,
                  captured_at)         -- snapshot รายวัน สำหรับกราฟเทียบแนวโน้ม

-- ===== แชท =====
chat_channels(id, site_id -> sites, topic, status, created_at)
chat_messages(id, channel_id -> chat_channels, sender_type,  -- user/staff/ai
              sender_id, body, attachments jsonb, ai_meta jsonb, created_at)

-- ===== Ticket =====
tickets(id, site_id -> sites, channel_id, title, description, category,
        priority, status, assigned_to -> staff_users,
        created_at, sla_due_at, resolved_at)

-- ===== ฐานความรู้ =====
knowledge_docs(id, site_id -> sites, title, content, source_url,
               search_text text,              -- ค้นด้วย pg_trgm (ตัดคำไทยเอง)
               updated_at)
ai_faqs(id, site_id, question, answer, hits, updated_at)

-- ===== AI =====
ai_models(id, provider, model_id, purpose,          -- classify|answer|embed
          enabled bool, is_default, notes, updated_at)
ai_usage(id, site_id, model_id, purpose, tokens_in, tokens_out,
         latency_ms, ok, error, created_at)          -- ใช้นับโควตาฟรี

-- ===== ความปลอดภัย / ตรวจสอบ =====
secrets(id, site_id, key, vault_secret_id, updated_at)   -- เก็บใน Supabase Vault
audit_logs(id, actor_id, action, target_type, target_id,
           before jsonb, after jsonb, ip, created_at)
data_change_backup(id, site_id, path, snapshot jsonb,
                   created_by, created_at, restored_at)
notifications(id, staff_id, channel, payload jsonb, read_at, created_at)
write_quota_usage(site_id, day, used)              -- นับโควตา Data Editor
job_runs(id, job_name, ok, error, duration_ms, created_at)  -- แทน BullMQ
feature_flags(id, site_id, key, enabled, value, updated_at)
```

**RLS (Row Level Security)** — บังคับที่ระดับฐานข้อมูล ไม่ใช่แค่เช็คใน UI:
- ทุกตารางเปิด RLS
- `staff_users.role` เป็นตัวกำหนดสิทธิ์ (viewer เห็นอย่างเดียว, support แก้ได้แต่ไม่เขียน Firestore, admin เขียนได้, super ทุกอย่าง + จัดการ staff)
- credential ของเว็บย่อย อ่านได้จาก **Edge Function เท่านั้น** — service_role key ไม่เคยไปถึง browser

---

## 6. Security

- Service Account ของแต่ละเว็บใช้ **สิทธิ์ต่ำสุด** (อ่านอย่างเดียว เว้นแต่ต้องเขียนจริง) และ**แยก Firebase project ต่อหนึ่งเว็บ**
- ❗ **Supabase Free ไม่มี outbound IP คงที่** → ทำ IP allowlist ไม่ได้ ใช้การแยก Firebase project + custom IAM role จำกัด path แทน (ดูข้อ 4.1)
- Secret เก็บใน **Supabase Vault** (เข้ารหัด at rest) ไม่เก็บใน git, ไม่ส่งค่าเต็มกลับไป browser (ส่งแค่ masked)
- 2FA บังคับสำหรับ `super` และ `admin`
- Audit log ทุก action ที่เป็นการเขียน — เขียน log ใน Edge Function เพียงจุดเดียว ไม่ต้องพึ่งคนจำ
- Admin UI ต้องมี CSP + ไม่มี `dangerouslySetInnerHTML` กับข้อมูลจาก Firestore

---

## 7. Roadmap (ปรับสำหรับคนเดียว)

> หลัก: **เฟสต้องจบใน 1–2 สัปดาห์ และต้อง "ใช้ได้จริง" ทุกเฟส** — ไม่มีเฟสไหนที่จบแล้วยังใช้ไม่ได้

| เฟส | ส่งมอบ | ใช้เวลา | ผ่านเมื่อ |
|---|---|---|---|
| **0** ✅ โค้ดเสร็จ เหลือ deploy | Monorepo, schema, RLS, Login + สิทธิ์, Site Registry (เว็บแรก 1 เว็บ), keep-alive cron, backup กลางคืน | 1–2 สัปดาห์ | เข้าระบบได้ เห็น 1 เว็บ ไม่โดน pause |
| **1** | Dashboard: ค่าใช้จ่าย + จำนวนสมาชิก (snapshot ยอดรวมรายวันจาก Firestore) + หน้ารายชื่อสมาชิกที่ดึงสด (50 คน/หน้า) | 1 สัปดาห์ | เปิดหน้าเดียวเห็นเงิน + จำนวนสมาชิก และเปิดดูรายชื่อสมาชิกได้โดยไม่ต้อง sync เข้า DB |
| **2** | Data Editor (Firestore) พร้อม backup/audit/โควตา/denylist + ปุ่มย้อนกลับ | 1–2 สัปดาห์ | แก้คอนเทนต์ที่เว็บย่อยเห็นผลจริง และย้อนกลับได้ |
| **3** | แชท (Realtime) + AI ตอบเบื้องต้นจากคู่มือ + เปิด Ticket อัตโนมัติ + `ai_usage` | 1–2 สัปดาห์ | เว็บย่อยส่งข้อความเข้ามา ได้คำตอบอ้างอิงแหล่งที่มา หรือได้ Ticket |
| **4** | Uptime/SSL monitor ของทุกเว็บ + รายงานสรุปรายเดือน | 1 สัปดาห์ | เว็บย่อยล่ม → เตือนใน 5 นาที |
| **5** | **เมื่อมีเว็บที่ 2**: connector ตัวที่ 2, Site Agent (ถ้าจำเป็น), SSO เฉพาะทีมงาน, deploy pipeline | 2–3 สัปดาห์ | เพิ่มเว็บใหม่โดยไม่แก้โค้ดระบบกลาง |
| **X** | ~~CMS Editor แยก~~ — เลื่อนจนกว่าจะมีเว็บที่คอนเทนต์ไม่ได้อยู่ใน Firestore | — | ทำตอนนั้น ไม่ต้องทำตอนนี้ |

**สิ่งที่ตัดสินชั่วคราว/เลื่อน/ยังไม่รู้:** ดูหัวข้อ 9 (รวมทั้งหมดไว้ที่เดียว)

**ทำอะไรก่อนหลังในเฟส 0:** schema + RLS + Site Registry + cron → (Login ใช้ Supabase Auth สำเร็จ 5 นาที ไม่ต้องเขียนเอง)

---

## 8. โครงโปรเจกต์

```
apps/
  admin-web/                 # React + Vite + TS + Tailwind (static → Cloudflare Pages)
supabase/
  config.toml                # local stack (supabase start)
  migrations/                # schema + RLS + ฟังก์ชันฝั่งเซิร์ฟเวอร์
  seed.sql                   # bucket `backups` + โมเดล AI เริ่มต้น
  functions/
    _shared/
      db.ts                  # service-role client + ยืนยันผู้เรียก
      http.ts                # json/err/cors
      siteConfig.ts          # โหลด credential จาก Vault + โควตา + audit/backup
      connectors/            # interface + Firestore adapter (โค้ดล้วน ไม่พึ่ง SDK)
    connectors-firestore/    # จุดเดียวที่เข้าถึงข้อมูลเว็บย่อยได้ (read/write/ping/members)
    sync-member-stats/       # ดึงจำนวนสมาชิกรายวัน (pg_cron เรียก)
    backup-upload/           # รับไฟล์ pg_dump จาก CI + ล้างไฟล์เก่า
    ai/                      # เฟส 3: intent router, RAG (pg_trgm), usage logging
packages/                    # สงวนไว้ — ยังไม่มี ตอนนี้ยังไม่ต้องแยก
.github/workflows/           # keep-alive.yml + nightly-backup.yml
```

> monorepo (npm workspace) เพราะตอนนี้ 1 คน — ย้ายแยกทีหลังได้ง่าย แต่ระหว่างนี้ไม่มีเหตุผลที่จะแยก repo
> ใช้ npm workspaces (ไม่ใช่ pnpm) เพราะ Node ที่ติดตั้งมีอยู่แล้ว ไม่ต้องเพิ่ม tool ใหม่
> ใช้ Tailwind แบบ v4 (`@tailwindcss/vite`) — ไม่ต้องมีไฟล์ config ที่ยาว ๆ

---

## 9. สิ่งที่ค้างไว้ — ตัดสินชั่วคราว / เลื่อน / ยังไม่รู้

> รวมทุกอย่างที่ "ยังไม่จบ" ไว้ที่เดียว ตัดกออกซ้ำ ๆ ไปแล้ว ให้ดูที่นี่ที่เดียว
>
> **ขอบเขต: ยึดเว็บย่อย 1 เว็บ (เว็บแรก, Firebase/Firestore) เท่านั้น** — เว็บที่ 2+ ไม่ต้องออกแบบล่วงหน้า ไม่ต้องเตรียม connector/ตารางให้ แค่รักษาโครงสร้างให้ "เพิ่มแถว/เพิ่ม adapter" ได้

### 9.1 ตัดสินชั่วคราว — ใช้ของธรรมดาไปก่อน แล้วค่อยดีขึ้น

| # | เรื่อง | ตอนนี้ใช้ (พอผ่านเฟส 0–4) | อัปเกรดเป็น | เงื่อนไขที่ต้องยิง |
|---|---|---|---|---|
| 1 | เก็บ backup | Supabase Storage 1 GB + cron ล้างไฟล์เก่า | Cloudflare R2 (10 GB, egress ฟรี, lifecycle rule ล้างให้เอง) | เว็บที่ 2 หรือ dump ใกล้เต็ม 1 GB |
| 2 | กัน Supabase pause | GitHub Actions cron ทุก 12 ชม. + UptimeRobot | Neon Free (ไม่มี pause) — แต่ต้องเขียน Realtime เอง | ถ้า cron ตายจริง / เริ่มรำคาญ (ระวัง: Neon CU หมด = suspend ถึงเดือนหน้า) |
| 3 | ป้องกัน credential หลุด | แยก Firebase project ต่อ 1 เว็บ + custom IAM role | + GCP budget alert และ auto-revoke key | เว็บที่ 3 ขึ้นไป (ความเสี่ยงคูณตามจำนวนเว็บ) |
| 4 | โมเดล AI | Workers AI (คุณภาพไทยระดับพอใช้) | Claude / โมเดลเสียเงิน | เมื่อผู้ใช้บอกว่าคำตอบไม่พอจริง ๆ (นับจาก `ai_usage` + เคสที่ escalate) |
| 5 | การค้นคู่มือ | `pg_trgm` + ส่ง chunk ให้ AI สรุป | Embedding + vector search (pgvector) | เมื่อคู่มือยาวมากแล้ว pg_trgm หาไม่เจอ |
| 6 | เก็บสมาชิก | **ตัดสินแล้ว (เว็บแรก):** ดึงรายชื่อสด ๆ จาก Firestore ตอนเปิดหน้า "สมาชิก" (50 คน/หน้า) + snapshot ยอดรวมรายวัน — **ไม่ copy PII เข้าระบบกลาง** | sync เต็มเข้า `site_members` + ประวัติการเปลี่ยนแปลง | เมื่อต้องค้นหาข้ามเว็บ / export CSV / ดูประวัติสมัคร |
| 7 | ค้นหาสมาชิก | ค้นจาก Firestore ตรง ๆ | index ในตัวเอง / cache ในระบบกลาง | เมื่อเปิดหน้า "สมาชิก" ช้ากว่า 2 วินาที |

### 9.2 เลื่อนไปทีหลัง — ยังไม่ต้องทำ

| # | เรื่อง | ทำเมื่อ |
|---|---|---|
| 1 | CMS Editor แยก (หน้า/บทความ/เมนู) | มีเว็บที่คอนเทนต์ไม่ได้อยู่ใน Firestore (ตอนนี้ Data Editor ครอบคลุมแล้ว) |
| 2 | Connector ตัวที่ 2 (MySQL / WordPress / REST) | เว็บที่ 2 พร้อนบิ้ว |
| 3 | Site Agent (แพ็กเกจในเว็บย่อย) | เว็บที่ต่อ connector ตรงออกยาก/เสี่ยง |
| 4 | SSO เฉพาะทีมงาน + deploy pipeline | มีทีมมากกว่า 1 คนจริง |
| 5 | 2FA แบบบังคับทุก role | มี staff มากกว่า 1 คน |
| 6 | Neon / Cloudflare Workers (ทางเลือก stack) | เมื่อโควตาฟรีเริ่มเป็นปัญหาจริง |

### 9.3 ยังไม่รู้ — ต้องตอบก่อนจะเดินหน้าถัดไป

| # | คำถาม | ต้องตอบก่อนเฟส | สถานะ |
|---|---|---|---|
| 1 | **เว็บย่อยจะส่งข้อความเข้าแชทยังไง** — ฝัง widget ในเว็บ หรือเข้าหน้าแชทของระบบกลาง | เฟส 3 | ⏳ ยังไม่ตอบ |
| 2 | **แจ้งเตือนส่งทางไหน** — Slack / Discord / LINE / Email | เฟส 3 | ⏳ ยังไม่ตอบ |
| 3 | **Domain ของระบบกลาง** — ใช้ `*.pages.dev` ฟรี หรือซื้อโดเมนเอง | เฟส 4 | ⏳ ยังไม่ตอบ |
| 4 | **เว็บที่ 2 ใช้ stack อะไร** | เฟส 5 | ⏸ นอกขอบเขต — ยังไม่ต้องคิด |

> ✅ **ตัดสินแล้ว 2 เรื่อง (ยึดเว็บแรก):**
> - **ความละเอียดข้อมูลสมาชิก** = ดึงสดจาก Firestore + snapshot ยอดรวมรายวัน ไม่ copy PII เข้ากลาง (ดู 9.1 #6) → **เฟส 1 ติดต่อได้เลย**
> - **ขอบเขตระบบ** = 1 เว็บ ไม่ต้องเตรียมอะไรรับเว็บที่ 2 → **ตอบข้อ 1–3 ได้ในเฟสที่เกี่ยวข้อง ไม่ต้องรอ**

---

## ภาคผนวก: สิ่งที่เปลี่ยนจาก v1 → v2 และเหตุผล

| เรื่อง | v1 | v2 | เหตุผล |
|---|---|---|---|
| Backend | Fastify/NestJS บน VPS | Supabase Edge Functions | ไม่มีเครื่องต้องเช่า, ไม่มี process ต้องคอยดู |
| Queue | Redis + BullMQ | pg_cron | งานไม่ถี่พอจะต้องมี Redis |
| Auth | Firebase Auth / Auth.js | Supabase Auth | อยู่ติดกับ DB อยู่แล้ว ไม่ต้องมี provider สองเจ้า |
| สมาชิก | รวมกลาง (`members` + SSO) | แยกรายเว็บ (`site_members`) | สมาชิกแยกระบบกันจริง |
| IP allowlist | เป็นมาตรการหลัก | ตัดออก (Supabase Free ไม่มี IP คงที่) | ทำไม่ได้จริง — ใช้ credential จำกัดสิทธิ์แทน |
| RAG | RAG ทั่วไป | pg_trgm + ส่ง chunk ให้ AI | FTS ตัดคำไทยไม่ได้ |
| CMS Editor | เฟส 4 (2–3 สัปดาห์) | เลื่อนไป ใช้ Data Editor แทน | คอนเทนต์เว็บแรกอยู่ใน Firestore อยู่แล้ว |
| ทีม | รองรับทีม | เดียวก่อน แต่ไม่ผูกโยง | ลดความซับซ้อนตอนต้องทำให้เสร็จเร็ว |
