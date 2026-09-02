"use client"

import * as React from "react"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import { BlockRenderer, type BlockRenderOptions } from "./blocks"
import { resolveBlockAnchor } from "./blocks/anchors"
import { sectionAnalyticsAttrs } from "./analytics"
import type { MediaResolver } from "./media"
import type { SitePageRendererProps } from "./SitePageRenderer"
import { SitePageShell } from "./SitePageShell"

/** Kept as an async preparation boundary for iframe callers; no runtime component registry is involved. */
export type PreparedClientSiteRenderer = { kind: "first-party" }

export async function prepareClientSiteRenderer(
  _args: Pick<SitePageRendererProps, "page" | "settings" | "tenantSlug" | "domain">,
): Promise<PreparedClientSiteRenderer> {
  return { kind: "first-party" }
}

export function ClientSitePageRenderer({
  prepared: _prepared,
  page,
  settings,
  theme,
  mediaResolver,
  imageLoading,
  formAction,
  editSlots,
  blockIndexOffset = 0,
  className,
  canvasClassName,
  canvasAttributes,
  consentAvailable,
  appointmentMode = "preview",
}: SitePageRendererProps & { prepared: PreparedClientSiteRenderer }) {
  React.useEffect(() => {
    if (typeof document === "undefined" || !document.querySelector("[data-siab-appointment-block]")) return
    let cleanup: (() => void) | undefined
    let cancelled = false
    void import("./blocks/appointments/appointment-behavior").then(({ initializeAppointmentBlocks }) => {
      if (cancelled) return
      cleanup = initializeAppointmentBlocks(document)
    })
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [appointmentMode, page.blocks, page.id, page.slug])

  const blocks = page.blocks.map((block, index) => {
    const sectionAnchor = resolveBlockAnchor(block)
    const options: BlockRenderOptions = {
      index: blockIndexOffset + index,
      mediaResolver,
      imageLoading,
      formAction,
      editSlots,
      siteSettings: settings,
      theme,
      appointmentMode,
      sectionAttributes: {
        id: sectionAnchor,
        "data-block-index": blockIndexOffset + index,
        "data-block-type": block.blockType,
        ...sectionAnalyticsAttrs({
          sectionType: block.blockType,
          sectionPosition: blockIndexOffset + index,
          sectionAnchor: sectionAnchor ?? null,
        }, block.blockType, blockIndexOffset + index),
      },
    }
    return <BlockRenderer key={`${block.blockType}-${"variant" in block ? block.variant : index}`} block={block} options={options} />
  })
  return <SitePageShell {...{ page, settings, theme, mediaResolver, className, canvasClassName, canvasAttributes, consentAvailable }}>{blocks}</SitePageShell>
}
