"use client"

import * as React from "react"
import {
  DEFAULT_THEME_TOKEN_SPEC,
  BACKGROUND_MODE_IDS,
  type BackgroundMode,
} from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/components/button"
import { MobilePickerOption } from "@/components/common/mobile-picker-option"
import { InlineToolbarGroup, InlineToolbarOption } from "@/components/common/inline-toolbar-group"
import { cn } from "@siteinabox/ui/lib/utils"
import { useTranslations } from "next-intl"

const MODE_COPY = {
  image: {
    label: "backgroundModeImage",
    description: "backgroundModeImageDescription",
  },
  animation: {
    label: "backgroundModeAnimation",
    description: "backgroundModeAnimationDescription",
  },
  grid: {
    label: "backgroundModeGrid",
    description: "backgroundModeGridDescription",
  },
  ambient: {
    label: "backgroundModeAmbient",
    description: "backgroundModeAmbientDescription",
  },
  mesh: {
    label: "backgroundModeMesh",
    description: "backgroundModeMeshDescription",
  },
  none: {
    label: "backgroundModeNone",
    description: "backgroundModeNoneDescription",
  },
} as const

type BackgroundModeControlProps = {
  value?: BackgroundMode
  onChange: (value: BackgroundMode) => void
  layout?: "list" | "segment" | "pill"
  sizeClassName?: string
}

export function BackgroundModeIcon({
  mode = "animation",
  className,
}: {
    mode?: BackgroundMode
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-4", className)}
      aria-hidden="true"
    >
      {mode === "image" ? (
        <>
          <rect x="2.5" y="3" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="13.5" cy="7" r="1.5" fill="currentColor" />
          <path d="M3.5 15 8.2 10.3l2.8 2.7 1.8-1.8 3.7 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {mode === "animation" ? (
        <>
          <path d="M2.5 11.4c2.2-4.7 4.3-4.7 6.4 0s4.2 4.7 6.4 0 2.1-4.7 2.2-4.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M2.5 15.2c2.2-3.1 4.3-3.1 6.4 0s4.2 3.1 6.4 0 2.1-3.1 2.2-3.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity=".55" />
          <circle cx="4" cy="5" r="1" fill="currentColor" />
          <circle cx="16" cy="4" r=".8" fill="currentColor" opacity=".7" />
        </>
      ) : null}
      {mode === "grid" ? (
        <>
          <rect x="3" y="3" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7.7 3v14M12.3 3v14M3 7.7h14M3 12.3h14" stroke="currentColor" strokeWidth="1.1" opacity=".8" />
        </>
      ) : null}
      {mode === "ambient" ? (
        <>
          <circle cx="10" cy="10" r="2.5" fill="currentColor" opacity=".9" />
          <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.1" opacity=".65" />
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1" opacity=".3" />
        </>
      ) : null}
      {mode === "mesh" ? (
        <>
          <path d="M2.5 6.5c2.5-2.7 4.8-2.7 7.3 0s4.8 2.7 7.7-.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
          <path d="M2.5 11c2.5-2.7 4.8-2.7 7.3 0s4.8 2.7 7.7-.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".62" />
          <path d="M2.5 15.5c2.5-2.7 4.8-2.7 7.3 0s4.8 2.7 7.7-.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".42" />
          <path d="M5 3.5v13M10 3.5v13M15 3.5v13" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" opacity=".28" />
        </>
      ) : null}
      {mode === "none" ? (
        <>
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.2" opacity=".65" />
          <path d="m5.5 5.5 9 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  )
}

function BackgroundPreview({ mode, compact = false }: { mode: BackgroundMode; compact?: boolean }) {
  if (compact) return <BackgroundModeIcon mode={mode} className="size-4" />

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative isolate flex shrink-0 items-center justify-center overflow-hidden rounded-[0.3rem] border border-foreground/15",
        "size-8",
        mode === "image" && "bg-gradient-to-br from-primary/85 via-primary/35 to-muted text-background",
        mode === "animation" && "bg-muted text-primary",
        mode === "grid" && "bg-background text-muted-foreground",
        mode === "ambient" && "bg-gradient-to-br from-primary/25 via-background to-accent/60 text-primary",
        mode === "mesh" && "bg-gradient-to-br from-primary/35 via-background to-accent/55 text-primary",
        mode === "none" && "bg-background text-muted-foreground",
      )}
    >
      <BackgroundModeIcon mode={mode} className="size-5" />
    </span>
  )
}

export function BackgroundModeControl({
  value,
  onChange,
  layout = "list",
  sizeClassName,
}: BackgroundModeControlProps) {
  const t = useTranslations("editor")
  const activeId = value ?? DEFAULT_THEME_TOKEN_SPEC.appearance.backgroundMode
  const options = BACKGROUND_MODE_IDS.map((id) => ({
    id,
    label: t(MODE_COPY[id].label),
    description: t(MODE_COPY[id].description),
  }))

  if (layout === "segment") {
    return (
      <InlineToolbarGroup>
        {options.map((option) => (
          <InlineToolbarOption
            key={option.id}
            active={activeId === option.id}
            onClick={() => onChange(option.id)}
            ariaLabel={option.label}
            title={option.label}
            className="size-7 p-1"
          >
            <BackgroundPreview mode={option.id} compact />
          </InlineToolbarOption>
        ))}
      </InlineToolbarGroup>
    )
  }

  if (layout === "pill") {
    return (
      <div className="flex items-center gap-1.5">
        {options.map((option) => (
          <MobilePickerOption
            key={option.id}
            active={activeId === option.id}
            onClick={() => onChange(option.id)}
            ariaLabel={option.label}
            sizeClassName={sizeClassName ?? "size-8"}
          >
            <BackgroundPreview mode={option.id} compact />
          </MobilePickerOption>
        ))}
      </div>
    )
  }

  return (
    <div role="group" aria-label={t("backgroundModeControls")} className="flex w-full min-w-[18rem] max-w-[24rem] flex-col gap-1">
      {options.map((option) => {
        const active = activeId === option.id
        return (
          <Button
            key={option.id}
            type="button"
            variant="ghost"
            size="default"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "group h-auto w-full justify-start rounded-lg px-2.5 py-2 text-left whitespace-normal",
              active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
            )}
          >
            <BackgroundPreview mode={option.id} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-5">{option.label}</span>
              <span className="block text-xs leading-5 text-muted-foreground">{option.description}</span>
            </span>
          </Button>
        )
      })}
    </div>
  )
}
