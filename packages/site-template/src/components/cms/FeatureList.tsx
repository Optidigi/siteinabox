import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import { ICON_MAP } from "./icons"
import { sectionAnalyticsAttrs } from "./analytics"
import type { AnalyticsBlockMetadata, RtRoot } from "../../lib/types"

/**
 * FeatureList block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/FeatureList.ts.
 */
export type FeatureListProps = {
  anchor?: string | null
  title?: RtRoot | null
  intro?: RtRoot | null
  features: Array<{
    title: RtRoot
    description?: RtRoot | null
    icon?: string | null
  }>
  dataBlockIndex?: number
  analytics?: AnalyticsBlockMetadata | null
}

export default function FeatureList(props: FeatureListProps) {
  const { anchor, title, intro, features, dataBlockIndex, analytics } = props
  if (!features || features.length === 0) return null
  return (
    <BlockErrorBoundary blockType="featureList">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--featurelist"
        data-block-index={dataBlockIndex}
        {...sectionAnalyticsAttrs(analytics, "featureList", dataBlockIndex)}
      >
        {title && (
          <h2 class="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
            <RtNodeRenderer node={title} />
          </h2>
        )}
        {intro && (
          <div class="cms-block__intro" style={{ fontFamily: "var(--font-text)" }}>
            <RtNodeRenderer node={intro} />
          </div>
        )}
        <ul class="cms-block__features">
          {features.map((f, i) => {
            const Icon = f.icon ? ICON_MAP[f.icon] : null
            return (
              <li
                key={i}
                class="cms-block__feature"
                style={{ borderRadius: "var(--radius-lg)" }}
              >
                {Icon && <span class="cms-block__feature-icon"><Icon /></span>}
                <h3 class="cms-block__feature-title" style={{ fontFamily: "var(--font-heading)" }}>
                  <RtNodeRenderer node={f.title} />
                </h3>
                {f.description && (
                  <div class="cms-block__feature-description" style={{ fontFamily: "var(--font-text)" }}>
                    <RtNodeRenderer node={f.description} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </BlockErrorBoundary>
  )
}
