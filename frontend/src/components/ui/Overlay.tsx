import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cx } from '../../lib/cx'

/**
 * The one overlay system: Modal, Drawer, Popover.
 * - One scrim recipe (.material-scrim), one z-scale: base overlays z-50,
 *   overlays stacked above a drawer (SyntheticModal) z-[60] via `raised`.
 * - Spring scale-in for modals, slide for drawers; exit animations play
 *   before unmount (the `closing` state below), no motion library needed.
 * - Escape + scrim click close; focus returns to the opener.
 */

const OverlayCtx = createContext<{ close: () => void } | null>(null)

/** Children of Modal/Drawer can call this to close with the exit animation. */
export function useOverlayClose(): () => void {
  const ctx = useContext(OverlayCtx)
  return ctx?.close ?? (() => {})
}

function useOverlayLifecycle(onClose: () => void) {
  const [closing, setClosing] = useState(false)
  const openerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null
    return () => openerRef.current?.focus?.()
  }, [])

  const close = useCallback(() => setClosing(true), [])
  const panelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      } else if (e.key === 'Tab' && panelRef.current) {
        // minimal focus trap: keep Tab cycling inside the panel
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // when the exit animation on the panel finishes, actually unmount
  const onPanelAnimationEnd = useCallback(() => {
    if (closing) onClose()
  }, [closing, onClose])

  return { closing, close, onPanelAnimationEnd, panelRef }
}

interface ModalProps {
  onClose: () => void
  children: ReactNode
  /** panel width class, e.g. 'max-w-2xl' */
  width?: string
  /** stack above an open drawer */
  raised?: boolean
  /** vertical placement: center (default) or top (command palette) */
  align?: 'center' | 'top'
  panelClassName?: string
}

export function Modal({
  onClose,
  children,
  width = 'max-w-2xl',
  raised,
  align = 'center',
  panelClassName,
}: ModalProps) {
  const { closing, close, onPanelAnimationEnd, panelRef } = useOverlayLifecycle(onClose)
  return (
    <OverlayCtx.Provider value={{ close }}>
      <div
        className={cx(
          'fixed inset-0 flex justify-center p-4',
          align === 'center' ? 'items-center' : 'items-start pt-[14vh]',
          raised ? 'z-[60]' : 'z-50',
        )}
        role="dialog"
        aria-modal="true"
        onClick={close}
      >
        <div className={cx('material-scrim absolute inset-0', closing ? 'animate-fade-out' : 'animate-fade-in-slow')} />
        <div
          ref={panelRef as React.RefObject<HTMLDivElement>}
          className={cx(
            'relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl border border-stroke-light bg-surface shadow-lg',
            width,
            closing ? 'animate-scale-out' : 'animate-scale-in',
            panelClassName,
          )}
          onClick={(e) => e.stopPropagation()}
          onAnimationEnd={onPanelAnimationEnd}
        >
          {children}
        </div>
      </div>
    </OverlayCtx.Provider>
  )
}

interface DrawerProps {
  onClose: () => void
  children: ReactNode
  width?: string
  raised?: boolean
}

export function Drawer({ onClose, children, width = 'max-w-xl', raised }: DrawerProps) {
  const { closing, close, onPanelAnimationEnd, panelRef } = useOverlayLifecycle(onClose)
  return (
    <OverlayCtx.Provider value={{ close }}>
      <div
        className={cx('fixed inset-0 flex justify-end', raised ? 'z-[60]' : 'z-50')}
        role="dialog"
        aria-modal="true"
        onClick={close}
      >
        <div className={cx('material-scrim absolute inset-0', closing ? 'animate-fade-out' : 'animate-fade-in-slow')} />
        <aside
          ref={panelRef as React.RefObject<HTMLElement>}
          className={cx(
            'relative flex h-full w-full flex-col border-l border-stroke-light bg-surface shadow-lg',
            width,
            closing ? 'animate-slide-out-right' : 'animate-slide-in-right',
          )}
          onClick={(e) => e.stopPropagation()}
          onAnimationEnd={onPanelAnimationEnd}
        >
          {children}
        </aside>
      </div>
    </OverlayCtx.Provider>
  )
}

/**
 * Anchored popover panel — parent supplies position classes (e.g. 'absolute
 * bottom-full left-0 mb-2'). Dismissal (outside-click + Escape) belongs to the
 * parent via useDismiss, since the trigger stays interactive.
 */
export function PopoverPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('material-panel z-50 overflow-hidden rounded-lg', 'animate-scale-in', className)}>
      {children}
    </div>
  )
}
