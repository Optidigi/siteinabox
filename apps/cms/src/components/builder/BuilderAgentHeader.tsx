"use client"

import type { ReactNode } from "react"
import { AppWindow } from "lucide-react"
import { Button } from "@siteinabox/ui/components/button"
import { BuilderLogo } from "@/components/builder/BuilderLogo"
import { BuilderThemeToggle } from "@/components/builder/BuilderThemeToggle"
import {
  builderAgentStatus,
  type BuilderBusyPhase,
} from "@/components/builder/builderPresence"
import type { BuilderMobilePane } from "@/components/builder/useBuilderMobilePager"
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader"
import { useTranslations } from "next-intl"

export function BuilderAgentHeader({
  email,
  busy,
  hasPreview,
  previewUnread,
  phase,
  pane,
  showDesktopSignOut,
  onShowPreview,
  desktopSignOut,
  mobileSignOut,
}: {
  email: string
  busy: boolean
  hasPreview: boolean
  previewUnread?: boolean
  phase: BuilderBusyPhase | null
  pane: BuilderMobilePane
  showDesktopSignOut?: boolean
  onShowPreview: () => void
  desktopSignOut?: ReactNode
  mobileSignOut: ReactNode
}) {
  const status = builderAgentStatus(busy, hasPreview, phase)
  const t = useTranslations("auth")

  return (
    <WorkspaceHeader identity={<>
        <BuilderLogo
          title={email}
          imgClassName="h-8 max-w-[11rem] sm:h-9 sm:max-w-[14rem]"
        />
        <span className="sr-only" data-siab-builder-status={status} aria-live="polite">
          {t(busy ? phase === "leest" ? "workspaceReading" : phase === "bouwt" ? "workspaceBuilding" : "workspaceWriting" : hasPreview ? "workspacePreviewReady" : "workspaceReady")}
        </span>
      </>} actions={<>
        {hasPreview ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="relative lg:hidden"
            aria-label={t("workspaceShowPreview")}
            aria-current={pane === "preview" ? "true" : undefined}
            onClick={onShowPreview}
          >
            <AppWindow className="size-4" />
            {previewUnread ? (
              <span
                data-siab-builder-preview-unread
                className="absolute top-1.5 right-1.5 size-2 bg-main"
                aria-hidden
              />
            ) : null}
          </Button>
        ) : null}
        <BuilderThemeToggle />
        {showDesktopSignOut ? (
          <div className="hidden lg:block">{desktopSignOut}</div>
        ) : null}
        <div className="lg:hidden">{mobileSignOut}</div>
      </>} />
  )
}
