import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { idbDelete, idbGet, idbPut } from './storage'

export type ImageKind = 'device' | 'idcard' | 'shop' | 'avatar'

export interface ImageTarget {
  shopId: string
  shopName: string
  imei: string
  kind: ImageKind
  index: number
}

export interface ImageStore {
  readonly mode: 'local' | 'drive'
  put(file: File, target: ImageTarget): Promise<string>
  remove(ref: string): Promise<void>
  load(ref: string): Promise<string | null>
}

function sanitize(s: string): string {
  const cleaned = s
    .trim()
    .replace(/[\\/:*?"<>|#%]+/g, '-')
    .replace(/\s+/g, '_')
  return cleaned || 'unknown'
}

export function imagePath(target: ImageTarget): string {
  const shopFolder = `${sanitize(target.shopName)}-${target.shopId}`
  return `${shopFolder}/${target.imei}/${target.imei}-${target.kind}-${target.index}`
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const localStore: ImageStore = {
  mode: 'local',
  async put(file, target) {
    const ref = imagePath(target)
    await idbPut(ref, await fileToDataUrl(file))
    return ref
  },
  async remove(ref) {
    await idbDelete(ref)
  },
  async load(ref) {
    return idbGet(ref)
  },
}

async function drivePut(proxy: string, file: File, target: ImageTarget): Promise<string> {
  const ref = imagePath(target)
  const form = new FormData()
  form.append('path', ref)
  form.append('shopId', target.shopId)
  form.append('shopName', target.shopName)
  form.append('imei', target.imei)
  form.append('kind', target.kind)
  form.append('index', String(target.index))
  form.append('file', file)
  const res = await fetch(proxy, { method: 'POST', body: form })
  if (!res.ok) throw new Error('อัปโหลดรูปไม่สำเร็จ')
  return ref
}

async function driveRemove(proxy: string, ref: string): Promise<void> {
  const res = await fetch(`${proxy}?path=${encodeURIComponent(ref)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error('ลบรูปไม่สำเร็จ')
}

function makeDriveStore(proxy: string): ImageStore {
  return {
    mode: 'drive',
    put: (file, target) => drivePut(proxy, file, target),
    remove: (ref) => driveRemove(proxy, ref),
    async load(ref) {
      return `${proxy}?path=${encodeURIComponent(ref)}`
    },
  }
}

interface ImageContextValue {
  mode: 'local' | 'drive'
  put(file: File, target: ImageTarget): Promise<string>
  remove(ref: string | null | undefined): Promise<void>
  removeMany(refs: Array<string | null | undefined>): Promise<void>
  resolve(ref: string | null | undefined): Promise<string | null>
}

const ImageContext = createContext<ImageContextValue | null>(null)
const cache = new Map<string, string | null>()

export function ImageProvider({ children }: { children: ReactNode }) {
  const store = useMemo<ImageStore>(() => {
    const proxy = import.meta.env.VITE_DRIVE_PROXY_URL
    return proxy ? makeDriveStore(proxy) : localStore
  }, [])

  const resolve = useCallback(
    async (ref: string | null | undefined): Promise<string | null> => {
      if (!ref) return null
      if (/^(https?:|data:|blob:)/.test(ref)) return ref
      if (cache.has(ref)) return cache.get(ref) ?? null
      const url = await store.load(ref)
      cache.set(ref, url)
      return url
    },
    [store],
  )

  const value = useMemo<ImageContextValue>(
    () => ({
      mode: store.mode,
      put: store.put.bind(store),
      async remove(ref) {
        if (!ref) return
        cache.delete(ref)
        await store.remove(ref)
      },
      async removeMany(refs) {
        const list = refs.filter((r): r is string => Boolean(r))
        list.forEach((r) => cache.delete(r))
        await Promise.all(list.map((r) => store.remove(r)))
      },
      resolve,
    }),
    [store, resolve],
  )

  return <ImageContext.Provider value={value}>{children}</ImageContext.Provider>
}

export function useImageStore(): ImageContextValue {
  const ctx = useContext(ImageContext)
  if (!ctx) throw new Error('ต้องใช้งานภายใน ImageProvider')
  return ctx
}

export function useImageUrl(ref: string | null | undefined): string | null {
  const ctx = useContext(ImageContext)
  const [url, setUrl] = useState<string | null>(() => (ref ? cache.get(ref) ?? null : null))

  useEffect(() => {
    let alive = true
    if (!ref) {
      setUrl(null)
      return
    }
    const cached = cache.get(ref)
    if (cached !== undefined) {
      setUrl(cached)
      return
    }
    ctx?.resolve(ref).then((u) => {
      if (alive) setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [ref, ctx])

  return url
}
