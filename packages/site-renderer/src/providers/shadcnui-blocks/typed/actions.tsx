"use client"

import * as React from "react"
import type { LinkRef } from "@siteinabox/contracts"
import type { BlockEditSlots } from "../../../blocks/types"
import { isExternalHref } from "./links"
import { elementPath } from "./paths"

export type CtaLinkField = "primary" | "secondary"

type RenderCtaLinkOptions = {
  trailingIcon?: React.ReactNode
}

export const renderCtaLink = (
  editSlots: BlockEditSlots | undefined,
  value: LinkRef,
  blockIndex: number,
  blockType: string,
  field: CtaLinkField,
  options?: RenderCtaLinkOptions,
) => {
  const href = value.href?.trim()
  const label = value.label?.trim()
  if (!href || !label) return null
  const path = elementPath(blockIndex, field)
  if (editSlots?.renderCta) {
    return editSlots.renderCta({
      name: `${blockType}.${field}`,
      value: { ...value, href, label },
      elementPath: path,
    })
  }
  const external = value.external ?? isExternalHref(href)
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {label}
      {options?.trailingIcon}
    </a>
  )
}
