"use client"

import { builderCopy } from "./copy"
import { restorePendingBuilderOperation, type PendingBuilderOperation } from "./clientOperation"
import type { Locale } from "@/i18n/config"
import { useMemo, useRef, useEffect, useState, useCallback } from "react"
import { Rocket, Monitor, Tablet, Smartphone, LogOut, MessageSquare } from "lucide-react"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
} from "@siteinabox/contracts/iframe-editor"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { signOutBuilderAction } from "@/lib/actions/requestBuilderMagicLink"
import { BuilderAgentHeader } from "@/components/builder/BuilderAgentHeader"
import { BuilderAgentStage } from "@/components/builder/BuilderAgentStage"
import { BuilderComposer } from "@/components/builder/BuilderComposer"
import { BuilderThread } from "@/components/builder/BuilderThread"
import { useBuilderBusyPhase } from "@/components/builder/builderPresence"
import { FLOATING_PILL_CLASS } from "@/components/editor/floating-pill"
import { useBuilderMobilePager } from "@/components/builder/useBuilderMobilePager"
import type { BuilderFacts } from "@/lib/builder/facts"
import {
  isBuilderAgentStage,
  withOpenPreviewAction,
  type BuilderChatMessage,
} from "@/lib/builder/thread"

type BuilderPreviewSnapshot = {
  pageId: string
  page: unknown
  settings: unknown
  theme: unknown
}

type BuilderResponse = {
  ok: boolean
  text: string
  facts?: BuilderFacts | null
  clientSlug?: string | null
  messages?: BuilderChatMessage[]
  error?: string
  quota?: { remaining: number }
  applied?: boolean
  previewSnapshot?: BuilderPreviewSnapshot | null
}

type Viewport = "desktop" | "tablet" | "phone"

const viewportClass: Record<Viewport, string> = {
  desktop: "w-full",
  tablet: "w-full max-w-[768px]",
  phone: "w-full max-w-[390px]",
}

const previewOpenedKey = (slug: string) => `siab-builder-preview-opened:${slug}`

function SignOutControl({ iconOnly, locale = "nl" }: { iconOnly?: boolean; locale?: Locale }) {
  return (
    <form action={signOutBuilderAction}>
      <Button type="submit" variant="outline" size={iconOnly ? "icon" : "sm"} aria-label={builderCopy[locale].signOut}>
        <LogOut className="size-4" />
        {iconOnly ? <span className="sr-only">{builderCopy[locale].signOut}</span> : builderCopy[locale].signOut}
      </Button>
    </form>
  )
}

export function BuilderShell({
  email,
  initialMessages,
  initialClientSlug,
  locale = "nl",
  initialRemaining,
}: {
  email: string
  initialMessages: BuilderChatMessage[]
  initialFacts: BuilderFacts | null
  initialClientSlug: string | null
  locale?: Locale
  initialRemaining?: number
}) {
  const copy = builderCopy[locale]
  const pendingRef = useRef<PendingBuilderOperation | null>(null)
  const pendingKey = `siab-builder-pending:${email.trim().toLowerCase()}`
  const [pending, setPending] = useState(false)
  const [remaining, setRemaining] = useState<number | undefined>(initialRemaining)
  const [requestNotice, setRequestNotice] = useState<string | null>(null)
  useEffect(() => {
    try { pendingRef.current = restorePendingBuilderOperation(sessionStorage.getItem(pendingKey)) }
    catch { pendingRef.current = null }
    setPending(Boolean(pendingRef.current))
  }, [pendingKey])
  useEffect(() => {
    const controller = new AbortController()
    const renew = () => {
      void fetch("/api/siab-auth/preview-renew", { method: "POST", credentials: "same-origin", signal: controller.signal }).catch(() => undefined)
    }
    renew()
    const interval = window.setInterval(renew, 6 * 60 * 60 * 1000)
    return () => { controller.abort(); window.clearInterval(interval) }
  }, [email])
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [clientSlug, setClientSlug] = useState<string | null>(initialClientSlug)
  const [messages, setMessages] = useState<BuilderChatMessage[]>(initialMessages)
  const [viewport, setViewport] = useState<Viewport>("desktop")
  const [previewRevision, setPreviewRevision] = useState(0)
  const [frameReady, setFrameReady] = useState(false)
  const [previewOpened, setPreviewOpened] = useState(false)
  const [splitReady, setSplitReady] = useState(() => Boolean(initialClientSlug))
  const previewWasOff = useRef(!initialClientSlug)
  const chatListRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const revisionRef = useRef(1)
  const pendingSnapshotRef = useRef<BuilderPreviewSnapshot | null>(null)
  const { pagerRef, pane, paging, scrollToPane } = useBuilderMobilePager()
  const hasPreview = Boolean(clientSlug)
  const agentStage = isBuilderAgentStage(messages, clientSlug)
  const threadMessages = withOpenPreviewAction(messages, hasPreview)
  const phase = useBuilderBusyPhase(busy, hasPreview)

  const markPreviewOpened = useCallback((slug: string | null) => {
    if (!slug || typeof window === "undefined") return
    sessionStorage.setItem(previewOpenedKey(slug), "1")
    setPreviewOpened(true)
  }, [])

  const openPreview = useCallback(() => {
    markPreviewOpened(clientSlug)
    scrollToPane("preview")
  }, [clientSlug, markPreviewOpened, scrollToPane])

  const postSnapshot = useCallback((snapshot: BuilderPreviewSnapshot) => {
    const target = frameRef.current?.contentWindow
    if (!target || typeof window === "undefined") {
      pendingSnapshotRef.current = snapshot
      return false
    }
    const expectedRevision = revisionRef.current
    target.postMessage({
      protocol: IFRAME_EDITOR_PROTOCOL_NAME,
      schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
      type: "render.snapshot",
      messageId: `builder-snapshot-${expectedRevision}`,
      expectedRevision,
      pageId: snapshot.pageId,
      page: snapshot.page,
      settings: snapshot.settings,
      theme: snapshot.theme,
    }, window.location.origin)
    revisionRef.current = expectedRevision + 1
    pendingSnapshotRef.current = null
    return true
  }, [])

  useEffect(() => {
    if (!hasPreview) {
      setSplitReady(false)
      previewWasOff.current = true
      return
    }
    if (!previewWasOff.current) {
      setSplitReady(true)
      return
    }
    previewWasOff.current = false
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const desktop = window.matchMedia("(min-width: 1024px)").matches
    if (reduced || !desktop) {
      setSplitReady(true)
      return
    }
    let inner = 0
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => setSplitReady(true))
    })
    return () => {
      window.cancelAnimationFrame(outer)
      window.cancelAnimationFrame(inner)
    }
  }, [hasPreview])

  useEffect(() => {
    const list = chatListRef.current
    if (!list) return
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" })
  }, [messages, busy, phase])

  useEffect(() => {
    if (!clientSlug || typeof window === "undefined") return
    const next = `/builder/${encodeURIComponent(clientSlug)}`
    if (window.location.pathname !== next) {
      window.history.replaceState(null, "", next)
    }
  }, [clientSlug])

  useEffect(() => {
    if (!clientSlug || typeof window === "undefined") {
      setPreviewOpened(false)
      return
    }
    setPreviewOpened(sessionStorage.getItem(previewOpenedKey(clientSlug)) === "1")
  }, [clientSlug])

  useEffect(() => {
    if (pane !== "preview") return
    markPreviewOpened(clientSlug)
  }, [clientSlug, markPreviewOpened, pane])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { protocol?: unknown; type?: unknown }
      if (data?.protocol !== IFRAME_EDITOR_PROTOCOL_NAME || data.type !== "renderer.ready") return
      setFrameReady(true)
      if (pendingSnapshotRef.current) postSnapshot(pendingSnapshotRef.current)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [postSnapshot])

  const frameSrc = useMemo(
    () => {
      if (!clientSlug) return null
      const path = `/renderer-frame/preview/${encodeURIComponent(clientSlug)}`
      return previewRevision > 0 ? `${path}?rev=${previewRevision}` : path
    },
    [clientSlug, previewRevision],
  )

  useEffect(() => {
    setFrameReady(false)
    revisionRef.current = 1
  }, [frameSrc])

  const previewInteractive = pane === "preview" && !paging

  const send = async (raw?: string, retry = false) => {
    const trimmed = (raw ?? message).trim()
    if (busy || (!retry && (trimmed.length < 2 || trimmed.length > 4000 || remaining === 0 || pendingRef.current))) return
    const operation = retry ? pendingRef.current : { operationId: crypto.randomUUID(), message: trimmed, locale }
    if (!operation) return
    pendingRef.current = operation
    setPending(true)
    try { sessionStorage.setItem(pendingKey, JSON.stringify(operation)) } catch { /* In-memory retry keeps the same UUID. */ }
    if (!retry) setMessages((current) => [...current, { role: "user", text: trimmed }])
    setMessage("")
    setBusy(true)
    setRequestNotice(null)
    try {
      const response = await fetch("/api/builder/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(operation),
      })
      const body = (await response.json()) as BuilderResponse
      if (body.quota && Number.isSafeInteger(body.quota.remaining) && body.quota.remaining >= 0) setRemaining(body.quota.remaining)
      if (response.status === 202) { setRequestNotice(copy.pending); return }
      const completed = Array.isArray(body.messages) && body.messages.length > 0
      if (completed || response.status < 500) {
        pendingRef.current = null
        setPending(false)
        try { sessionStorage.removeItem(pendingKey) } catch { /* Storage is optional. */ }
      }
      if (!completed && !response.ok) {
        setRequestNotice(body.error === "quota_exhausted" ? copy.exhausted : copy.unavailable)
        return
      }
      if (completed) setMessages(body.messages ?? [])
      else if (typeof body.text === "string") setMessages((current) => [...current, { role: "assistant", text: body.text }])
      if (body.previewSnapshot) {
        const sameSlug = Boolean(clientSlug && body.clientSlug === clientSlug)
        if (sameSlug && frameReady) {
          postSnapshot(body.previewSnapshot)
        } else {
          pendingSnapshotRef.current = body.previewSnapshot
          if (body.applied && sameSlug && !frameReady) {
            setPreviewRevision((current) => current + 1)
          }
        }
      } else if (body.applied && body.clientSlug && body.clientSlug === clientSlug) {
        setPreviewRevision((current) => current + 1)
      }
      if (body.clientSlug) setClientSlug(body.clientSlug)
    } catch {
      setRequestNotice(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const composer = (
    <BuilderComposer
      message={message}
      busy={busy || pending || remaining === 0}
      locale={locale}
      layout={agentStage ? "stage" : "docked"}
      placeholder={agentStage ? copy.placeholder : undefined}
      onMessageChange={setMessage}
      onSend={() => void send()}
    />
  )

  return (
    <div
      data-siab-builder
      data-builder-mode={hasPreview ? "workspace" : "agent"}
      data-split-motion={hasPreview ? "" : undefined}
      data-split-ready={splitReady ? "true" : "false"}
      className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground lg:grid lg:grid-rows-[minmax(0,1fr)]"
    >
      <div
        ref={hasPreview ? pagerRef : undefined}
        data-siab-builder-pager={hasPreview ? true : undefined}
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden lg:contents",
          hasPreview
            && "max-lg:snap-x max-lg:snap-mandatory max-lg:flex-row max-lg:overflow-x-auto max-lg:overflow-y-hidden max-lg:overscroll-x-contain",
        )}
      >
        <section
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden",
            hasPreview
              ? "w-full min-w-full shrink-0 snap-start snap-always lg:w-auto lg:min-w-0 lg:border-r-2 lg:border-border"
              : "w-full min-w-0 flex-1",
          )}
        >
          <BuilderAgentHeader
            locale={locale}
            email={email}
            busy={busy}
            hasPreview={hasPreview}
            previewUnread={hasPreview && !previewOpened}
            phase={phase}
            pane={pane}
            showDesktopSignOut={!hasPreview}
            onShowPreview={openPreview}
            desktopSignOut={<SignOutControl locale={locale} />}
            mobileSignOut={<SignOutControl iconOnly locale={locale} />}
          />
          <div
            data-siab-builder-chat
            data-agent-stage={agentStage ? "true" : "false"}
            className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
          >
            <div className="siab-builder-thread-cell relative min-h-0 overflow-hidden">
              <div
                aria-hidden={!agentStage}
                className={cn(
                  "siab-builder-stage-copy hidden h-full flex-col items-center justify-end pb-16 lg:flex",
                  agentStage
                    ? "relative opacity-100"
                    : "pointer-events-none absolute inset-0 opacity-0",
                )}
              >
                <BuilderAgentStage locale={locale} />
              </div>
              <div
                key={agentStage ? "landing" : "live"}
                className={cn(
                  "siab-builder-thread-slot flex h-full min-h-0 flex-col",
                  agentStage && "lg:hidden",
                  !agentStage && "siab-builder-fade",
                )}
              >
                <BuilderThread
                  locale={locale}
                  messages={agentStage ? [{ role: "assistant", text: copy.headline }] : threadMessages}
                  busy={!agentStage && busy}
                  phase={phase}
                  listRef={chatListRef}
                  onChoice={(label) => void send(label)}
                  onOpenPreview={hasPreview ? openPreview : undefined}
                />
              </div>
            </div>
            <div className="px-4 py-2 text-sm" aria-live="polite">
              {typeof remaining === "number" ? <p>{copy.remaining}: {remaining}</p> : null}
              {requestNotice ? <p role="status">{requestNotice}</p> : null}
              {remaining === 0 && !requestNotice ? <p>{copy.exhausted}</p> : null}
              {pending ? <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void send(undefined, true)}>{copy.retry}</Button> : null}
            </div>
            {composer}
            <div aria-hidden className="siab-builder-stage-spacer" />
          </div>
        </section>

        {hasPreview ? (
          <section className="relative flex h-full w-full min-w-full shrink-0 snap-start snap-always flex-col overflow-hidden bg-muted p-3 lg:min-w-0 lg:w-auto lg:p-5">
            <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label={copy.chat}
                aria-current={pane === "chat" ? "true" : undefined}
                onClick={() => scrollToPane("chat")}
              >
                <MessageSquare className="size-4" />
              </Button>
              <div className={cn(FLOATING_PILL_CLASS, "inline-flex items-center gap-1.5")}>
                {([
                  ["desktop", Monitor, "Desktop"],
                  ["tablet", Tablet, "Tablet"],
                  ["phone", Smartphone, copy.phone],
                ] as const).map(([id, Icon, label]) => (
                  <Button
                    key={id}
                    type="button"
                    size="icon"
                    variant={viewport === id ? "default" : "outline"}
                    aria-label={label}
                    aria-pressed={viewport === id}
                    onClick={() => setViewport(id)}
                  >
                    <Icon className="size-4" />
                  </Button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {clientSlug ? (
                  <Button asChild variant="secondary" size="sm">
                    <a href={`/${clientSlug}/checkout`}>
                      <Rocket className="size-4 shrink-0" />
                      {copy.goLive}
                    </a>
                  </Button>
                ) : null}
                <div className="hidden lg:block">
                  <SignOutControl locale={locale} />
                </div>
              </div>
            </div>
            {frameSrc ? (
              <div className="flex min-h-0 flex-1 justify-center">
                <iframe
                  ref={frameRef}
                  title={copy.frame}
                  src={frameSrc}
                  className={cn(
                    viewportClass[viewport],
                    "h-full border-2 border-border bg-secondary-background shadow-shadow lg:pointer-events-auto",
                    !previewInteractive && "pointer-events-none",
                  )}
                />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
