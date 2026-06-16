import RtNodeRenderer from "./RtNodeRenderer"
import { sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata, RtField } from "../../lib/types"

/**
 * RichText block renderer (Preact, Zen-skinned for amicare-zorg).
 *
 * `body` is an RtRoot tree (v2). Rendered via RtNodeRenderer; visual
 * treatment lives in src/styles/rich-text.css.
 */
export type RichTextProps = {
  body: RtField
  anchor?: string | null
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

export default function RichText({ body, anchor, dataBlockIndex, analytics }: RichTextProps) {
  if (!body) return null
  return (
    <section
      // amicare-zorg: nav links to #over for the "Over mij" section. Falls
      // back to "over" when block.anchor is unset so existing nav targets
      // keep working without a per-page CMS edit.
      id={anchor || "over"}
      class="cms-block cms-block--richtext px-6 py-20 @min-[48rem]/site-frame:px-12 @min-[48rem]/site-frame:py-24 @min-[64rem]/site-frame:px-24"
      data-block-index={dataBlockIndex}
      {...sectionAnalyticsAttrs(analytics, "richText", dataBlockIndex)}
    >
      <div
        class="prose mx-auto max-w-prose text-[17px] leading-[1.7] text-ink/90 @min-[48rem]/site-frame:text-[18px] prose-headings:font-serif prose-headings:tracking-[-0.01em] prose-headings:text-ink prose-h2:text-[34px] prose-h2:leading-[1.1] @min-[48rem]/site-frame:prose-h2:text-[44px] prose-p:text-ink/90 prose-strong:text-ink prose-strong:font-semibold prose-em:text-accent prose-em:italic prose-a:text-accent prose-a:underline prose-a:decoration-1 prose-a:underline-offset-[6px] hover:prose-a:decoration-accent prose-blockquote:border-l-2 prose-blockquote:border-accent prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:font-serif prose-blockquote:text-[19px] @min-[48rem]/site-frame:prose-blockquote:text-[22px]"
        style={{ fontFamily: "var(--font-text)" }}
      >
        <RtNodeRenderer node={body} />
      </div>
    </section>
  )
}
