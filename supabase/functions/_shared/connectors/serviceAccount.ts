// สร้าง self-signed JWT ของ Service Account เพื่อเรียก Firestore REST API
// ทำเองด้วย WebCrypto เพราะ @google-cloud/firestore ใช้ gRPC ซึ่งรันใน Deno ไม่เสถียร
// อ้างอิง: https://firebase.google.com/docs/auth/admin/create-custom-tokens (self-signed JWT สำหรับ service account)

import type { ServiceAccountKey } from './types.ts';

const DATASTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
const DEFAULT_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
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
    aud: sa.token_uri || DEFAULT_TOKEN_ENDPOINT,
    scope: DATASTORE_SCOPE,
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

/** แลก self-signed JWT เป็น OAuth access token แล้ว cache ไว้เกือบหมดอายุ (Firestore ไม่รับ JWT ตรง) */
export async function getFirestoreToken(sa: ServiceAccountKey): Promise<string> {
  const cached = cache.get(sa.client_email);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const assertion = await createSelfSignedJwt(sa);
  const res = await fetch(sa.token_uri || DEFAULT_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const text = await res.text();
  let body: { access_token?: string; expires_in?: string | number; error?: string; error_description?: string };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`ขอ access token ของ Google ไม่สำเร็จ: ${res.status} ${text.slice(0, 120)}`);
  }
  if (!res.ok || !body.access_token) {
    throw new Error(
      `ขอ access token ของ Google ไม่สำเร็จ: ${res.status} ${body.error_description || body.error || ''}`.trim(),
    );
  }

  const ttl = Number(body.expires_in) || TOKEN_TTL_SECONDS;
  cache.set(sa.client_email, { token: body.access_token, expiresAt: Date.now() + ttl * 1000 });
  return body.access_token;
}
