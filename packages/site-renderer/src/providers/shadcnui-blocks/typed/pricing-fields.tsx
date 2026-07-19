"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import type { LucideIcon } from "lucide-react"
import { resolveIcon } from "../../../blocks/icons"
import type { BlockEditSlots } from "../../../blocks/types"
import { extractRichText } from "../../../rich-text"
import { isExternalHref } from "./links"
import { elementPath } from "./paths"
import { fieldInlineRichText, renderInlineRichText } from "./rich-text"

export const PRICING_BLOCK_TYPE = "pricing" as const

export type PricingFeatureItem = {
  label: RtRoot
  included?: boolean | null
}

export type PricingPlanItem = {
  title: RtRoot
  description?: RtRoot | null
  price?: string | null
  period?: string | null
  features?: PricingFeatureItem[] | null
  cta?: LinkRef | null
  badge?: string | null
  highlighted?: boolean | null
}

export const slicePricingPlans = <T,>(plans: T[], maxPlans: number) => plans.slice(0, maxPlans)

export const planIsHighlighted = (plan: PricingPlanItem) => plan.highlighted === true

export const parsePriceNumber = (price: string | null | undefined): number => {
  const trimmed = price?.trim() ?? ""
  if (!trimmed) return 0
  const match = trimmed.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)
  return match ? Number.parseFloat(match[0]) : 0
}

export const planIcon = (
  iconName: string | null | undefined,
  fallbackIcons: readonly LucideIcon[],
  planIndex: number,
): LucideIcon | null => {
  const resolved = resolveIcon(iconName)
  if (resolved) return resolved
  if (!fallbackIcons.length) return null
  return fallbackIcons[planIndex % fallbackIcons.length] ?? fallbackIcons[0] ?? null
}

const optionalInlineField = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot | null | undefined,
  blockIndex: number,
) => {
  if (value) {
    return fieldInlineRichText(editSlots, PRICING_BLOCK_TYPE, field, value, blockIndex)
  }
  if (!editSlots?.renderRichText) return null
  return editSlots.renderRichText({
    name: `${PRICING_BLOCK_TYPE}.${field}`,
    value: value ?? null,
    variant: "inline",
    as: "span",
    className: "contents",
    elementPath: elementPath(blockIndex, field),
    blockMode: "inline",
  })
}

export const renderPricingTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "title", title, blockIndex)

export const renderPricingIntro = (
  editSlots: BlockEditSlots | undefined,
  intro: RtRoot | null | undefined,
  blockIndex: number,
) => optionalInlineField(editSlots, "intro", intro, blockIndex)

export const renderPlanTitle = (
  editSlots: BlockEditSlots | undefined,
  title: RtRoot,
  blockIndex: number,
  planIndex: number,
) => renderInlineRichText(editSlots, {
  name: `${PRICING_BLOCK_TYPE}.plans.title`,
  value: title,
  elementPath: elementPath(blockIndex, "plans", planIndex, "title"),
})

export const renderPlanDescription = (
  editSlots: BlockEditSlots | undefined,
  description: RtRoot | null | undefined,
  blockIndex: number,
  planIndex: number,
) => {
  if (!description) return null
  return renderInlineRichText(editSlots, {
    name: `${PRICING_BLOCK_TYPE}.plans.description`,
    value: description,
    elementPath: elementPath(blockIndex, "plans", planIndex, "description"),
  })
}

export const renderPlanPrice = (
  editSlots: BlockEditSlots | undefined,
  price: string | null | undefined,
  blockIndex: number,
  planIndex: number,
) => {
  const trimmed = price?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "plans", planIndex, "price")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${PRICING_BLOCK_TYPE}.plans.price`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderPlanPeriod = (
  editSlots: BlockEditSlots | undefined,
  period: string | null | undefined,
  blockIndex: number,
  planIndex: number,
) => {
  const trimmed = period?.trim() ?? ""
  if (!trimmed && !editSlots?.renderText) return null
  const path = elementPath(blockIndex, "plans", planIndex, "period")
  if (editSlots?.renderText) {
    return editSlots.renderText({
      name: `${PRICING_BLOCK_TYPE}.plans.period`,
      value: trimmed,
      className: "contents",
      elementPath: path,
    })
  }
  return trimmed || null
}

export const renderPlanFeatureLabel = (
  editSlots: BlockEditSlots | undefined,
  label: RtRoot,
  blockIndex: number,
  planIndex: number,
  featureIndex: number,
) => renderInlineRichText(editSlots, {
  name: `${PRICING_BLOCK_TYPE}.plans.features.label`,
  value: label,
  elementPath: elementPath(blockIndex, "plans", planIndex, `features.${featureIndex}.label`),
})

export const renderPlanCta = (
  editSlots: BlockEditSlots | undefined,
  cta: LinkRef | null | undefined,
  blockIndex: number,
  planIndex: number,
  options?: { trailingIcon?: React.ReactNode },
) => {
  const href = cta?.href?.trim()
  const label = cta?.label?.trim()
  if (!href || !label) return null
  const path = elementPath(blockIndex, "plans", planIndex, "cta")
  if (editSlots?.renderCta) {
    return editSlots.renderCta({
      name: `${PRICING_BLOCK_TYPE}.plans.cta`,
      value: { ...cta, href, label },
      elementPath: path,
    })
  }
  const external = cta?.external ?? isExternalHref(href)
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {label}
      {options?.trailingIcon}
    </a>
  )
}

export const planTitleText = (title: RtRoot) => extractRichText(title)

export const pricingFeatureTooltip = (
  featureIndex: number,
  tooltipsByIndex: readonly (string | undefined)[],
) => tooltipsByIndex[featureIndex]
