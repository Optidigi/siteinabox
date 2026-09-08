"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@siteinabox/ui/lib/utils"
import { BuilderComposer } from "@/components/builder/BuilderComposer"
import { splitBuilderSpeech } from "@/lib/builder/chatSpeech"
import { BUILDER_CHAT_WELL_CLASS } from "@/lib/builder/thread"
import type { SiteEditorSnapshot } from "@/lib/agent/tools"

export const CMS_AGENT_GREETING = "Wat moet er anders?"

const applyJsonBody = (
  body: { text?: string; message?: string; applied?: boolean; snapshot?: SiteEditorSnapshot },
): { text: string; applied: boolean; snapshot?: SiteEditorSnapshot } => ({
  text: body.text ?? body.message ?? "De agent kon dit nu niet toepassen.",
  applied: Boolean(body.applied && body.snapshot),
  snapshot: body.snapshot,
})

const consumeAgentSse = async (
  response: Response,
  onDelta: (text: string) => void,
): Promise<{ text: string; applied: boolean; snapshot?: SiteEditorSnapshot }> => {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("no stream")
  const decoder = new TextDecoder()
  let buffer = ""
  let assembled = ""
  let applied = false
  let snapshot: SiteEditorSnapshot | undefined
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""
    for (const part of parts) {
      const line = part.split("\n").find((entry) => entry.startsWith("data: "))
      if (!line) continue
      const event = JSON.parse(line.slice(6)) as {
        type?: string
        text?: string
        message?: string
        result?: { text?: string; applied?: boolean; snapshot?: SiteEditorSnapshot }
      }
      if (event.type === "delta" && typeof event.text === "string") {
        assembled += event.text
        onDelta(assembled)
      } else if (event.type === "done" && event.result) {
        assembled = event.result.text ?? assembled
        applied = Boolean(event.result.applied && event.result.snapshot)
        snapshot = event.result.snapshot
        onDelta(assembled)
      } else if (event.type === "error") {
        throw new Error(event.message ?? "stream error")
      }
    }
  }
  return {
    text: assembled.trim().length >= 8 ? assembled : "De agent kon dit nu niet toepassen.",
    applied,
    snapshot,
  }
}

function AgentSpeech({ text }: { text: string }) {
  return (
    <p className="text-base leading-7 whitespace-pre-wrap">
      {splitBuilderSpeech(text).map((part, index) =>
        part.kind === "strong"
          ? <strong key={index}>{part.value}</strong>
          : <span key={index}>{part.value}</span>,
      )}
    </p>
  )
}

export function CmsAgentPanel({
  tenantSlug,
  pageSlug,
  selectedBlockIndex,
  onApplied,
  className,
}: {
  tenantSlug: string
  pageSlug?: string | null
  selectedBlockIndex?: number | null
  onApplied?: (snapshot: SiteEditorSnapshot) => void
  className?: string
}) {
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<Array<{ role: "user" | "assistant"; text: string }>>([])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = listRef.current
    if (!root) return
    root.scrollTop = root.scrollHeight
  }, [log, busy])

  const send = async () => {
    const trimmed = message.trim()
    if (trimmed.length < 8 || busy) return
    setLog((current) => [...current, { role: "user", text: trimmed }, { role: "assistant", text: "" }])
    setMessage("")
    setBusy(true)
    const payload = {
      message: trimmed,
      tenantSlug,
      pageSlug,
      selectedBlockIndex,
      history: log,
    }
    try {
      const response = await fetch("/api/cms/agent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream, application/json",
        },
        body: JSON.stringify(payload),
      })
      const contentType = response.headers.get("content-type") ?? ""
      const updateAssistant = (text: string) => {
        setLog((current) => {
          const next = [...current]
          const last = next[next.length - 1]
          if (last?.role === "assistant") next[next.length - 1] = { role: "assistant", text }
          return next
        })
      }
      const result = contentType.includes("text/event-stream")
        ? await consumeAgentSse(response, updateAssistant)
        : applyJsonBody(await response.json() as {
          text?: string
          message?: string
          applied?: boolean
          snapshot?: SiteEditorSnapshot
        })
      updateAssistant(result.text)
      if (result.applied && result.snapshot) onApplied?.(result.snapshot)
    } catch {
      setLog((current) => {
        const next = [...current]
        const last = next[next.length - 1]
        if (last?.role === "assistant") {
          next[next.length - 1] = { role: "assistant", text: "De agent is even niet bereikbaar. Probeer het zo opnieuw." }
        }
        return next
      })
    } finally {
      setBusy(false)
    }
  }

  const contextBits = [
    tenantSlug,
    pageSlug,
    selectedBlockIndex != null ? `blok ${selectedBlockIndex + 1}` : null,
  ].filter((value): value is string => Boolean(value))

  return (
    <div data-siab-agent-chat className={cn("flex min-h-0 flex-1 flex-col bg-background", className)}>
      {contextBits.length > 0 ? (
        <p className="sr-only">{contextBits.join(" · ")}</p>
      ) : null}
      <div
        ref={listRef}
        data-siab-builder-thread
        className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background px-4 py-5"
      >
        <div className={cn("mx-auto flex w-full flex-col gap-6", BUILDER_CHAT_WELL_CLASS)}>
          {log.length === 0 ? (
            <div className="flex w-full items-start" aria-label="SIAB">
              <div className="min-w-0 flex-1">
                <AgentSpeech text={CMS_AGENT_GREETING} />
              </div>
            </div>
          ) : null}
          {log.map((entry, index) => {
            const isUser = entry.role === "user"
            const pending = Boolean(
              !isUser && !entry.text && busy && index === log.length - 1,
            )
            return (
              <div
                key={`${entry.role}-${index}`}
                className={cn("flex w-full", isUser ? "justify-end" : "items-start")}
                aria-label={isUser ? "Jij" : "SIAB"}
              >
                <div
                  className={cn(
                    "min-w-0",
                    isUser
                      ? "siab-builder-turn ml-auto w-fit max-w-[85%] bg-card px-3.5 py-2.5 text-foreground"
                      : "flex-1",
                  )}
                >
                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                  ) : pending ? (
                    <p className="flex items-center gap-2 text-sm" aria-live="polite">
                      <span>Bezig…</span>
                      <span className="siab-builder-cursor" aria-hidden />
                    </p>
                  ) : (
                    <AgentSpeech text={entry.text} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <BuilderComposer
        layout="docked"
        message={message}
        busy={busy}
        minLength={8}
        placeholder="Bijv: Maak het thema groener en donkerder."
        onMessageChange={setMessage}
        onSend={() => void send()}
      />
    </div>
  )
}
