"use client"

import type { ReactNode, RefObject } from "react"
import { Button } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { BUILDER_PHASE_COPY, type BuilderBusyPhase } from "@/components/builder/builderPresence"
import { splitBuilderSpeech } from "@/lib/builder/chatSpeech"
import { BUILDER_CHAT_WELL_CLASS, OPEN_PREVIEW_ACTION_ID, type BuilderChatMessage } from "@/lib/builder/thread"

function BuilderSpeech({ text }: { text: string }) {
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

function ThreadTurn({
  role,
  children,
}: {
  role: "assistant" | "user"
  children: ReactNode
}) {
  const isUser = role === "user"
  return (
    <div
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
        {children}
      </div>
    </div>
  )
}

export function BuilderThread({
  messages,
  busy,
  phase,
  listRef,
  onChoice,
  onOpenPreview,
}: {
  messages: BuilderChatMessage[]
  busy: boolean
  phase: BuilderBusyPhase | null
  listRef: RefObject<HTMLDivElement | null>
  onChoice: (label: string) => void
  onOpenPreview?: () => void
}) {
  const phaseCopy = BUILDER_PHASE_COPY[phase ?? "schrijft"]

  return (
    <div
      ref={listRef}
      data-siab-builder-thread
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background px-4 py-5"
    >
      <div className={cn("mx-auto flex w-full flex-col gap-6", BUILDER_CHAT_WELL_CLASS)}>
        {messages.map((entry, index) => {
          const isLast = index === messages.length - 1
          const showChoices = isLast && entry.role === "assistant" && !busy && (entry.choices?.length ?? 0) > 0
          return (
            <ThreadTurn key={`${entry.role}-${index}`} role={entry.role}>
              {entry.role === "user"
                ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                : <BuilderSpeech text={entry.text} />}
              {showChoices ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.choices?.map((choice) => (
                    <Button
                      key={choice.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => onChoice(choice.label)}
                    >
                      {choice.label}
                    </Button>
                  ))}
                </div>
              ) : null}
              {entry.role === "assistant"
                && onOpenPreview
                && entry.actions?.some((action) => action.id === OPEN_PREVIEW_ACTION_ID) ? (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={onOpenPreview}
                  >
                    {entry.actions.find((action) => action.id === OPEN_PREVIEW_ACTION_ID)?.label
                      ?? "Bekijk je site"}
                  </Button>
                </div>
              ) : null}
            </ThreadTurn>
          )
        })}

        {busy ? (
          <ThreadTurn role="assistant">
            <p className="flex items-center gap-2 text-sm" aria-live="polite">
              <span>{phaseCopy}</span>
              <span className="siab-builder-cursor" aria-hidden />
            </p>
          </ThreadTurn>
        ) : null}
      </div>
    </div>
  )
}
