"use client"
import * as React from "react"
import { RtSlot } from "../inline/RtSlot"
import type { CanvasBlockRendererProps } from "@/components/editor/canvas/CanvasBlockRenderer"
import { useTranslations } from "next-intl"
import type { RtBlock, RtRoot } from "@/lib/richText/RtNode"

/**
 * Canvas-mode renderer for the RichText block.
 *
 * Emits the shared renderer rich-text DOM class structure
 * so tenant CSS targets the same classes.
 *
 * Fields:
 *   - body: block rich-text → RtSlot (full prose)
 */

const isRtRoot = (value: unknown): value is RtRoot =>
  Boolean(value && typeof value === "object" && (value as { t?: unknown }).t === "root" && Array.isArray((value as { children?: unknown }).children))

function splitAmicareIntro(value: unknown): { intro: RtRoot; body: RtRoot } | null {
  if (!isRtRoot(value) || value.variant !== "block") return null
  const [eyebrow, heading, ...rest] = value.children
  if (eyebrow?.t !== "themed" || eyebrow.id !== "eyebrow" || heading?.t !== "heading") return null
  return {
    intro: {
      t: "root",
      variant: "block",
      children: [eyebrow, heading] as RtBlock[],
    },
    body: {
      t: "root",
      variant: "block",
      children: rest as RtBlock[],
    },
  }
}

export const RichTextCanvas: React.FC<CanvasBlockRendererProps> = ({ block, isActive, manifest, onActivate, onUpdate, legacyTenant }) => {
  const t = useTranslations("editor")
  const set = (field: string) => (value: any) => onUpdate({ ...block, [field]: value })
  const idx = block.__index as number
  const splitBody = legacyTenant === "amicare" ? splitAmicareIntro(block.body) : null
  const setSplitIntro = (nextIntro: RtRoot) => {
    if (!splitBody) return set("body")(nextIntro)
    set("body")({
      t: "root",
      variant: "block",
      children: [...(nextIntro.children ?? []), ...(splitBody.body.children ?? [])],
    })
  }
  const setSplitBody = (nextBody: RtRoot) => {
    if (!splitBody) return set("body")(nextBody)
    set("body")({
      t: "root",
      variant: "block",
      children: [...(splitBody.intro.children ?? []), ...(nextBody.children ?? [])],
    })
  }

  return (
    <section
      id={block.anchor || (legacyTenant === "amicare" ? "over" : undefined)}
      className="cms-block cms-block--richtext px-6 py-20 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-24 @min-[64rem]/site-frame:px-24"
      data-block-index={block.__index ?? undefined}
      data-active={isActive || undefined}
      onClick={onActivate}
    >
      {splitBody ? (
        <>
          <div className="amicare-richtext-intro mx-auto max-w-3xl text-center">
            <RtSlot
              variant="block"
              manifest={manifest}
              value={splitBody.intro}
              onChange={setSplitIntro}
              placeholder={t("longFormContentPlaceholder")}
              elementPath={{ blockIndex: idx, field: "body" }}
              allowFontFamily
            />
          </div>
          <div
            className="amicare-richtext-body prose mx-auto mt-10 max-w-prose space-y-6 text-[17px] leading-[1.6] text-ink/90 @min-[48rem]/site-frame:text-[18px] [font-family:var(--font-text)]"
          >
            <RtSlot
              variant="block"
              manifest={manifest}
              value={splitBody.body}
              onChange={setSplitBody}
              placeholder={t("longFormContentPlaceholder")}
              elementPath={{ blockIndex: idx, field: "body" }}
              allowFontFamily
            />
          </div>
        </>
      ) : (
        <div
          className="prose mx-auto max-w-prose text-[17px] leading-[1.7] text-ink/90 @min-[48rem]/site-frame:text-[18px] prose-headings:font-serif prose-headings:tracking-[-0.01em] prose-headings:text-ink prose-h2:text-[34px] prose-h2:leading-[1.1] @min-[48rem]/site-frame:prose-h2:text-[44px] prose-p:text-ink/90 prose-strong:text-ink prose-strong:font-semibold prose-em:text-accent prose-em:italic prose-a:text-accent prose-a:underline prose-a:decoration-1 prose-a:underline-offset-[6px] hover:prose-a:decoration-accent prose-blockquote:border-l-2 prose-blockquote:border-accent prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:font-serif prose-blockquote:text-[19px] @min-[48rem]/site-frame:prose-blockquote:text-[22px] [font-family:var(--font-text)]"
        >
          <RtSlot
            variant="block"
            manifest={manifest}
            value={block.body}
            onChange={set("body")}
            placeholder={t("longFormContentPlaceholder")}
            elementPath={{ blockIndex: idx, field: "body" }}
            allowFontFamily
          />
        </div>
      )}
    </section>
  )
}
