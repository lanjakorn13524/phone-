// Firestore REST API v1 (thin client) — ใช้ fetch ล้วน ไม่พึ่ง SDK ที่ใช้ gRPC
// เอกสาร: https://firebase.google.com/docs/firestore/rest/reference

import { getFirestoreToken } from './serviceAccount.ts';
import type { ServiceAccountKey } from './types.ts';

export type FirestoreValue = Record<string, unknown>;
export type FirestoreFields = Record<string, unknown>;

/** รูปแบบค่าที่ Firestore ส่งกลับมา (ครอบคลุมเฉพาะที่เราใช้) */
type DecodedShape =
  | { nullValue: null }
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { arrayValue: { values?: DecodedShape[] } }
  | { mapValue: { fields?: Record<string, DecodedShape> } }
  | { bytesValue: string };

const API = 'https://firestore.googleapis.com/v1';

/** Firestore ใช้ชื่อ operator แบบ enum — แปลงจากสัญลักษณ์ที่อ่านง่ายในโค้ดเรา */
const FIRESTORE_OPS: Record<string, string> = {
  '==': 'EQUAL',
  '=': 'EQUAL',
  '!=': 'NOT_EQUAL',
  '>': 'GREATER_THAN',
  '>=': 'GREATER_THAN_OR_EQUAL',
  '<': 'LESS_THAN',
  '<=': 'LESS_THAN_OR_EQUAL',
  in: 'IN',
  'not-in': 'NOT_IN',
  'array-contains': 'ARRAY_CONTAINS',
};

function encodeScalar(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  throw new TypeError(`ไม่รองรับค่าชนิด ${typeof value} (รองรับ: string, number, boolean, null, Date)`);
}

/** JS value -> Firestore Value (รองรับ object ซ้อน, array) */
export function encodeValue(value: unknown): FirestoreValue {
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const map: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      map[k] = encodeValue(v);
    }
    return { mapValue: { fields: map } };
  }
  return encodeScalar(value);
}

/** Firestore Value -> JS value */
export function decodeValue(value: DecodedShape | undefined): unknown {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('nullValue' in value) return null;
  if ('bytesValue' in value) return value.bytesValue;
  if ('arrayValue' in value) {
    return (value.arrayValue?.values ?? []).map((v) => decodeValue(v));
  }
  if ('mapValue' in value) return decodeFields(value.mapValue?.fields ?? {});
  return null;
}

export function decodeFields(
  fields: Record<string, DecodedShape> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = decodeValue(v);
  return out;
}

/** เอกสาร Firestore -> { id, path, data } | null */
export function decodeDocument(
  doc: unknown,
): { id: string; path: string; data: Record<string, unknown> } | null {
  const d = doc as
    | { name?: string; fields?: Record<string, DecodedShape>; error?: unknown }
    | null;
  if (!d || d.error || !d.name) return null;
  const name = String(d.name);
  const id = name.slice(name.lastIndexOf('/') + 1);
  const path = name.split('/documents/')[1] ?? name;
  return { id, path, data: decodeFields(d.fields) };
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter((s) => s.length > 0)
    .map(encodeURIComponent)
    .join('/');
}

export class FirestoreRest {
  constructor(private readonly sa: ServiceAccountKey) {}

  private base(): string {
    return `${API}/projects/${encodeURIComponent(this.sa.project_id)}/databases/(default)/documents`;
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await getFirestoreToken(this.sa);
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base()}${path}`, {
      ...init,
      headers: { ...(await this.headers()), ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Firestore ${res.status}: ${text.slice(0, 500)}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async ping(): Promise<void> {
    await this.listCollectionIds();
  }

  async getDocument(path: string): Promise<{ id: string; path: string; data: Record<string, unknown> } | null> {
    try {
      const raw = await this.request<unknown>(`/${encodePath(path)}`);
      return decodeDocument(raw);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Firestore 404')) return null;
      throw err;
    }
  }

  async listDocuments(
    collection: string,
    opts: { limit: number; cursor?: string; orderBy?: string },
  ): Promise<{ documents: unknown[]; nextPageToken?: string }> {
    const params = new URLSearchParams({ pageSize: String(Math.min(opts.limit, 300)) });
    if (opts.cursor) params.set('pageToken', opts.cursor);
    if (opts.orderBy) params.set('orderBy', opts.orderBy);
    return this.request<{ documents: unknown[]; nextPageToken?: string }>(
      `/${encodePath(collection)}?${params.toString()}`,
    );
  }

  /** นับเอกสารในคอลเลกชัน (aggregation) — ถูกกว่าการดึงมานับในโค้ด */
  async count(
    collection: string,
    where?: { field: string; op: string; value: unknown },
  ): Promise<number> {
    const structuredQuery: Record<string, unknown> = { from: [{ collectionId: collection }] };
    if (where) {
      structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: where.field },
          op: FIRESTORE_OPS[where.op] ?? where.op.toUpperCase(),
          value: encodeValue(where.value),
        },
      };
    }

    const res = await this.request<
      Array<{ result?: { aggregateFields?: Record<string, { integerValue?: string }> } }>
    >(':runAggregationQuery', {
      method: 'POST',
      body: JSON.stringify({
        structuredAggregationQuery: {
          aggregations: [{ alias: 'all', count: {} }],
          structuredQuery,
        },
      }),
    });

    const raw = res[0]?.result?.aggregateFields?.all?.integerValue;
    return raw ? Number(raw) : 0;
  }

  /** เขียนทับเอกสารทั้งก้อน */
  async setDocument(path: string, data: unknown): Promise<void> {
    const [collection, ...rest] = path.split('/');
    const docId = rest.pop();
    if (!collection || !docId || rest.length === 0) throw new Error(`path ไม่ถูกต้อง: ${path}`);
    const parent = rest.join('/');

    await this.request(`/${encodePath(parent)}/${encodeURIComponent(collection)}?documentId=${encodeURIComponent(docId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: (encodeValue(data) as { mapValue: { fields: FirestoreFields } }).mapValue.fields }),
    });
  }

  /** อัปเดตเฉพาะ field ที่ระบุ (updateMask) — ปลอดภัยกว่าการเขียนทับทั้ง doc */
  async updateFields(path: string, fields: Record<string, unknown>): Promise<void> {
    const mask = Object.keys(fields).map((f) => `documentMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    await this.request(`/${encodePath(path)}?updateMask.fieldPaths=${mask}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: (encodeValue(fields) as { mapValue: { fields: FirestoreFields } }).mapValue.fields }),
    });
  }

  async listCollectionIds(): Promise<string[]> {
    const res = await this.request<{ collectionIds?: string[] }>(':listCollectionIds', {
      method: 'POST',
      body: JSON.stringify({ pageSize: 200 }),
    });
    return res.collectionIds ?? [];
  }
}
