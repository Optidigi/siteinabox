"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import {
  StatusBadge,
  type StatusBadgeTone,
} from "@/components/save-ui/status-badge"
import { cn } from "@siteinabox/ui/lib/utils"

type FeedbackKind = "loading" | "success" | "error" | "info"

type FeedbackAction = {
  label: string
  onClick: () => void
}

type FeedbackEntry = {
  id: string
  kind: FeedbackKind
  label: string
  action?: FeedbackAction
}

type ShowOptions = {
  id?: string
  action?: FeedbackAction
}

type StatusFeedbackContextValue = {
  loading: (label: string, options?: ShowOptions) => string
  success: (label: string, options?: ShowOptions) => string
  error: (label: string, options?: ShowOptions) => string
  info: (label: string, options?: ShowOptions) => string
  clear: (id?: string) => void
}

const StatusFeedbackContext = createContext<StatusFeedbackContextValue | null>(null)

const AUTO_DISMISS_MS = 3_750
const FADE_MS = 500

function makeId() {
  return `status-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function StatusFeedbackProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<FeedbackEntry | null>(null)
  const [fading, setFading] = useState(false)
  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
  }, [])

  const clear = useCallback((id?: string) => {
    setEntry((current) => {
      if (id && current?.id !== id) return current
      return null
    })
    setFading(false)
    clearTimers()
  }, [clearTimers])

  const show = useCallback((kind: FeedbackKind, label: string, options: ShowOptions = {}) => {
    const id = options.id ?? makeId()
    clearTimers()
    setFading(false)
    setEntry({ id, kind, label, action: options.action })

    if (kind !== "loading") {
      timers.current.push(window.setTimeout(() => setFading(true), AUTO_DISMISS_MS))
      timers.current.push(window.setTimeout(() => clear(id), AUTO_DISMISS_MS + FADE_MS))
    }

    return id
  }, [clear, clearTimers])

  useEffect(() => clearTimers, [clearTimers])

  const value = useMemo<StatusFeedbackContextValue>(() => ({
    loading: (label, options) => show("loading", label, options),
    success: (label, options) => show("success", label, options),
    error: (label, options) => show("error", label, options),
    info: (label, options) => show("info", label, options),
    clear,
  }), [clear, show])

  return (
    <StatusFeedbackContext.Provider value={value}>
      {children}
      <StatusFeedbackBadge entry={entry} fading={fading} />
    </StatusFeedbackContext.Provider>
  )
}

export function useStatusFeedback() {
  const value = useContext(StatusFeedbackContext)
  if (!value) {
    throw new Error("useStatusFeedback must be used within StatusFeedbackProvider")
  }
  return value
}

function StatusFeedbackBadge({
  entry,
  fading,
}: {
  entry: FeedbackEntry | null
  fading: boolean
}) {
  const sidebarOffset = useAdminSidebarOffset()
  if (!entry) return null

  const tone: StatusBadgeTone =
    entry.kind === "error" ? "destructive" : entry.kind === "success" ? "success" : "neutral"
  const icon =
    entry.kind === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> :
    entry.kind === "error" ? <AlertCircle className="h-4 w-4" aria-hidden /> :
    entry.kind === "info" ? <Info className="h-4 w-4" aria-hidden /> :
    <CheckCircle2 className="h-4 w-4" aria-hidden />
  return (
    <div
      className={cn(
        "fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 transition-all duration-500 ease-out",
        sidebarOffset === "icon" && "md:left-[calc(50%+1.5rem)]",
        sidebarOffset === "full" && "md:left-[calc(50%+8rem)]",
        fading && "translate-y-2 opacity-0",
      )}
    >
      <StatusBadge tone={tone} role="status" aria-live="polite" aria-label={entry.label}>
        {icon}
        <span>{entry.label}</span>
      </StatusBadge>
      {entry.action && (
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={entry.action.onClick}
          className="h-8"
        >
          {entry.action.label}
        </Button>
      )}
    </div>
  )
}

type AdminSidebarOffset = "none" | "icon" | "full"

function currentAdminSidebarOffset(): AdminSidebarOffset {
  if (typeof window === "undefined") return "none"
  if (!window.matchMedia("(min-width: 768px)").matches) return "none"
  const sidebar = document.querySelector<HTMLElement>('[data-slot="sidebar"]')
  if (!sidebar) return "none"
  return sidebar.getAttribute("data-state") === "collapsed"
    ? "icon"
    : "full"
}

function useAdminSidebarOffset() {
  const [offset, setOffset] = useState<AdminSidebarOffset>("none")

  useEffect(() => {
    const update = () => setOffset(currentAdminSidebarOffset())
    update()

    const media = window.matchMedia("(min-width: 768px)")
    media.addEventListener("change", update)
    window.addEventListener("resize", update)

    const observer = new MutationObserver(update)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state"],
    })

    return () => {
      media.removeEventListener("change", update)
      window.removeEventListener("resize", update)
      observer.disconnect()
    }
  }, [])

  return offset
}
