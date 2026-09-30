-- =====================================================================
-- 0006 — ให้ Edge Function อ่าน key ของระบบจาก Vault ได้
-- pg_cron ยิงเข้ามาด้วย key ที่เก็บใน vault (ชื่อ service_role_key) แต่โปรเจกต์ที่ใช้
-- ระบบ API key แบบใหม่จะไม่มี legacy service_role ให้ platform inject เข้าฟังก์ชัน
-- ฟังก์ชันจึงต้องเทียบ token กับค่าใน vault เป็นทางสำรอง
-- =====================================================================

create or replace function public.read_vault_secret(p_key text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_key;
$$;

revoke all on function public.read_vault_secret(text) from public, anon, authenticated;
grant execute on function public.read_vault_secret(text) to service_role;
