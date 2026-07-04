import * as React from "react"
import type { RtRoot } from "@siteinabox/contracts"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions, RendererElementPath } from "../blocks/types"

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ")
}

export function richTextSlot({
  options,
  name,
  value,
  variant,
  className,
  elementPath,
  blockMode,
}: {
  options: BlockRenderOptions
  name: string
  value?: RtRoot | null
  variant: "block" | "inline"
  className?: string
  elementPath: RendererElementPath
  blockMode?: "normal" | "inline" | "text"
}) {
  if (options.editSlots?.renderRichText) {
    return options.editSlots.renderRichText({ name, value, variant, className, elementPath })
  }
  return <RichTextRenderer value={value} blockMode={blockMode} />
}

export const providerTokenStyles = {
  title: { fontFamily: "var(--font-title)" },
  heading: { fontFamily: "var(--font-heading)" },
  text: { fontFamily: "var(--font-text)" },
  script: { fontFamily: "var(--font-script)" },
} as const satisfies Record<string, React.CSSProperties>
