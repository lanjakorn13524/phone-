import { useEffect, useState, type ReactNode } from 'react'
import { useImageUrl } from '../lib/images'

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

export const labelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50'

export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'

export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400'

export const cardClass =
  'rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-3xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
        {children}
        {footer ? <div className="mt-5">{footer}</div> : null}
      </div>
    </div>
  )
}

export function Thumb({
  imageRef,
  alt,
  className = '',
  onClick,
}: {
  imageRef: string | null | undefined
  alt: string
  className?: string
  onClick?: () => void
}) {
  const url = useImageUrl(imageRef)
  return (
    <div
      className={`relative overflow-hidden bg-slate-100 dark:bg-slate-800 ${onClick ? 'cursor-zoom-in' : ''} ${className}`}
      onClick={onClick}
    >
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="grid h-full w-full place-items-center text-xs text-slate-400">ไม่มีรูป</div>
      )}
    </div>
  )
}

export function Lightbox({
  refs,
  startIndex,
  onClose,
}: {
  refs: string[]
  startIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(startIndex)
  const url = useImageUrl(refs[index])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, refs.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, refs.length])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm">
          รูปที่ {index + 1} / {refs.length}
        </span>
        <button
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="ปิด"
        >
          ✕
        </button>
      </div>
      <div className="grid flex-1 place-items-center overflow-hidden p-4" onClick={(e) => e.stopPropagation()}>
        {url ? (
          <img src={url} alt="รูปเต็ม" className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <span className="text-slate-400">กำลังโหลด...</span>
        )}
      </div>
      {refs.length > 1 ? (
        <div className="flex items-center justify-center gap-4 p-4" onClick={(e) => e.stopPropagation()}>
          <button
            className="rounded-full bg-white/10 px-5 py-2 text-white hover:bg-white/20 disabled:opacity-40"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          >
            ‹ ก่อนหน้า
          </button>
          <button
            className="rounded-full bg-white/10 px-5 py-2 text-white hover:bg-white/20 disabled:opacity-40"
            disabled={index === refs.length - 1}
            onClick={() => setIndex((i) => Math.min(i + 1, refs.length - 1))}
          >
            ถัดไป ›
          </button>
        </div>
      ) : null}
    </div>
  )
}
