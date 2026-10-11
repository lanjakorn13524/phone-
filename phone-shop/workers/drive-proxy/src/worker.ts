export interface Env {
  IMAGES: KVNamespace
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

const MAX_BYTES = 24 * 1024 * 1024

async function handleUpload(env: Env, form: FormData): Promise<Response> {
  const path = String(form.get('path') ?? '')
  const file = form.get('file')
  if (!path || !(file instanceof File)) return new Response('ต้องการ path และ file', { status: 400, headers: CORS })
  const buf = await file.arrayBuffer()
  if (buf.byteLength > MAX_BYTES) return new Response('ไฟล์ใหญ่เกิน 24MB', { status: 413, headers: CORS })
  await env.IMAGES.put(path, buf, { metadata: { contentType: file.type || 'application/octet-stream' } })
  return new Response(path, { status: 200, headers: CORS })
}

async function handleGet(env: Env, path: string): Promise<Response> {
  if (!path) return new Response('ต้องการ path', { status: 400, headers: CORS })
  const { value, metadata } = await env.IMAGES.getWithMetadata<{ contentType?: string }>(path, 'arrayBuffer')
  if (value === null) return new Response('หาไฟล์ไม่เจอ', { status: 404, headers: CORS })
  const headers = new Headers(CORS)
  headers.set('Content-Type', metadata?.contentType ?? 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=300')
  return new Response(value, { headers })
}

async function handleDelete(env: Env, path: string): Promise<Response> {
  if (!path) return new Response('ต้องการ path', { status: 400, headers: CORS })
  await env.IMAGES.delete(path)
  return new Response(null, { status: 204, headers: CORS })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    const url = new URL(request.url)
    const path = url.searchParams.get('path') ?? ''
    try {
      if (request.method === 'POST') return await handleUpload(env, await request.formData())
      if (request.method === 'GET') return await handleGet(env, path)
      if (request.method === 'DELETE') return await handleDelete(env, path)
      return new Response('วิธีไม่รองรับ', { status: 405, headers: CORS })
    } catch (e) {
      return new Response(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด', { status: 500, headers: CORS })
    }
  },
}