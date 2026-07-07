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
    return options.editSlots.renderRichText({ name, value, variant, className, elementPath, blockMode })
  }
  return <RichTextRenderer value={value} blockMode={blockMode} />
}
