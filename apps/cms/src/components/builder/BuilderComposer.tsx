"use client"

import { useEffect, useRef } from "react"
import { SendHorizontal } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { cn } from "@siteinabox/ui/lib/utils"
import { BUILDER_CHAT_WELL_CLASS } from "@/lib/builder/thread"

export function BuilderComposer({
  message,
  busy,
  layout = "docked",
  placeholder,
  minLength = 2,
  onMessageChange,
  onSend,
}: {
  message: string
  busy: boolean
  layout?: "stage" | "docked"
  placeholder?: string
  minLength?: number
  onMessageChange: (value: string) => void
  onSend: () => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (layout !== "stage" || typeof window === "undefined") return
    if (!window.matchMedia("(min-width: 1024px)").matches) return
    textareaRef.current?.focus()
  }, [layout])

  return (
    <form
      data-siab-builder-composer
      data-layout={layout}
      className={cn(
        "flex w-full shrink-0 flex-col gap-3 bg-background",
        layout === "docked"
          ? "border-t-2 border-border p-4"
          : "p-0 max-lg:border-t-2 max-lg:border-border max-lg:p-4",
      )}
      onSubmit={(event) => {
        event.preventDefault()
        onSend()
      }}
    >
      <div className={cn("mx-auto flex w-full flex-col gap-3", BUILDER_CHAT_WELL_CLASS)}>
        <div
          className={cn(
            "border-2 border-border bg-card p-2",
            "lg:transition-colors lg:duration-200",
            "lg:hover:border-foreground",
            "lg:has-[:focus-visible]:border-foreground",
          )}
        >
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder={placeholder}
            rows={layout === "stage" ? 4 : 3}
            disabled={busy}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                onSend()
              }
            }}
            className={cn(
              "w-full resize-none border-0 bg-transparent shadow-none outline-none",
              "focus:border-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground/40",
              layout === "stage" ? "min-h-24 max-lg:min-h-20" : "min-h-20",
            )}
          />
          <div className="flex justify-end p-1">
            <Button
              type="submit"
              variant="ink"
              disabled={busy || message.trim().length < minLength}
            >
              <SendHorizontal className="size-4 shrink-0" />
              Stuur
            </Button>
          </div>
        </div>
        {layout === "docked" ? (
          <p className="hidden flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-muted-foreground lg:flex">
            <kbd className="siab-builder-kbd">Enter</kbd>
            <span>verzenden</span>
            <span aria-hidden>·</span>
            <kbd className="siab-builder-kbd">Shift+Enter</kbd>
            <span>nieuwe regel</span>
          </p>
        ) : null}
      </div>
    </form>
  )
}
