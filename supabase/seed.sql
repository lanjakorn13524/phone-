-- ไฟล์นี้ถูกรันหลัง migrations ทุกครั้ง (supabase db reset / supabase db push --include-seed)

-- ---------- bucket เก็บ backup ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backups', 'backups', false, 209715200, array['application/gzip'])
on conflict (id) do nothing;

-- ---------- โมเดล AI เริ่มต้น (แก้ที่นี่ได้ ไม่ต้อง deploy โค้ดใหม่) ----------
-- ⚠️ ชื่อโมเดลฟรีเปลี่ยนบ่อย — Cloudflare ล็อกโมเดลหนักไว้เฉพาะแผน Paid
--    ตรวจรายชื่อที่ใช้ได้กับแผน Free ที่ https://developers.cloudflare.com/workers-ai/models/
insert into public.ai_models (provider, model_id, purpose, is_default, notes) values
  ('cloudflare', '@cf/zai-org/glm-4.7-flash', 'answer', true,
   'ตอบคู่มือภาษาไทย — ลองสลับเป็น gemma-4-26b แล้วเทียบคุณภาพ'),
  ('cloudflare', '@cf/google/gemma-4-26b-a4b-it', 'answer', false, 'ทางเลือกสำรอง'),
  ('gemini', 'gemini-flash-lite', 'classify', true,
   'จัดกลุ่ม intent / สกัดข้อมูล — เช็คโควตาจริงใน AI Studio ก่อนใช้')
on conflict (provider, model_id, purpose) do nothing;
