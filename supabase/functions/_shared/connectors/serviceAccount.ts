// สร้าง self-signed JWT ของ Service Account เพื่อเรียก Firestore REST API
// ทำเองด้วย WebCrypto เพราะ @google-cloud/firestore ใช้ gRPC ซึ่งรันใน Deno ไม่เสถียร
// อ้างอิง: https://firebase.google.com/docs/auth/admin/create-custom-tokens (self-signed JWT สำหรับ service account)

import type { ServiceAccountKey } from './types.ts';

const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const TOKEN_TTL_SECONDS = 3600;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlEncodeText(text: string): string {
  return base64UrlEncode(new TextEncoder().encode(text));
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(pemBody);
  const keyBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) keyBytes[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    'pkcs8',
    keyBytes as unknown as BufferSource,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function createSelfSignedJwt(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: DATASTORE_SCOPE,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };

  const signingInput = `${base64UrlEncodeText(JSON.stringify(header))}.${base64UrlEncodeText(
    JSON.stringify(claims),
  )}`;

  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput) as unknown as BufferSource,
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export type FirestoreTokenCache = { token: string; expiresAt: number };

const cache = new Map<string, FirestoreTokenCache>();

/** cache token ไว้เกือบหมดอายุ เพื่อไม่ต้อง sign ทุก request */
export async function getFirestoreToken(sa: ServiceAccountKey): Promise<string> {
  const cached = cache.get(sa.client_email);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const token = await createSelfSignedJwt(sa);
  cache.set(sa.client_email, { token, expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000 });
  return token;
}
