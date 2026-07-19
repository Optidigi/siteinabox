"use client"

import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import type { MediaResolver } from "../../../media"
import {
  LOGO_CLOUD_BLOCK_TYPE,
  renderLogoCloudIntro,
  renderLogoCloudLogo,
  renderLogoCloudTitle,
  sliceLogoCloudLogos,
  type LogoCloudLogoItem,
} from "./logo-cloud-fields"

export const INTEGRATIONS_BLOCK_TYPE = LOGO_CLOUD_BLOCK_TYPE

export type IntegrationLogoItem = LogoCloudLogoItem & {
  description?: string | null
  status?: "connected" | "pending" | null
}

export const sliceIntegrationLogos = sliceLogoCloudLogos
export const renderIntegrationsTitle = renderLogoCloudTitle
export const renderIntegrationsIntro = renderLogoCloudIntro

export const renderIntegrationLogo = (
  editSlots: BlockEditSlots | undefined,
  mediaResolver: MediaResolver | undefined,
  logo: IntegrationLogoItem,
  blockIndex: number,
  itemIndex: number,
  options: { className: string; fallback?: React.ReactNode },
) => renderLogoCloudLogo(logo, itemIndex, blockIndex, editSlots, mediaResolver, options)

export const renderIntegrationName = (
  editSlots: BlockEditSlots | undefined,
  name: string,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = name?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${INTEGRATIONS_BLOCK_TYPE}.logos.name`,
      value: trimmed,
      className: "contents",
      elementPath: { blockIndex, field: "logos", itemIndex, subField: "name" },
    })
  }
  return trimmed || null
}

export const renderIntegrationDescription = (
  editSlots: BlockEditSlots | undefined,
  description: string | null | undefined,
  blockIndex: number,
  itemIndex: number,
) => {
  const trimmed = description?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${INTEGRATIONS_BLOCK_TYPE}.logos.description`,
      value: trimmed,
      className: "contents",
      elementPath: { blockIndex, field: "logos", itemIndex, subField: "description" },
    })
  }
  return trimmed || null
}

export type IntegrationsTypedProps = {
  title?: RtRoot | null
  intro?: RtRoot | null
  logos: IntegrationLogoItem[]
}
