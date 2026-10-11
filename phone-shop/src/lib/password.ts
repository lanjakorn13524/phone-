export const DEFAULT_PASSWORD = '1234'
export const DEFAULT_PASSWORD_HASH =
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'

export async function hashPassword(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPassword(plain: string, stored: string | undefined | null): Promise<boolean> {
  const target = stored && stored.length > 0 ? stored : DEFAULT_PASSWORD_HASH
  return (await hashPassword(plain)) === target
}