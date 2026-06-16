import type { AnalyticsBlockMetadata } from "../../lib/types"

export const sectionAnalyticsAttrs = (
  analytics: AnalyticsBlockMetadata | null | undefined,
  fallbackType: string,
  fallbackIndex?: number,
) => ({
  "data-siab-analytics-section": "true",
  "data-siab-section-id": analytics?.sectionId ?? "",
  "data-siab-section-type": analytics?.sectionType ?? fallbackType,
  "data-siab-section-position": String(analytics?.sectionPosition ?? fallbackIndex ?? ""),
  "data-siab-section-anchor": analytics?.sectionAnchor ?? "",
  "data-siab-section-variant": analytics?.sectionVariant ?? "",
  "data-siab-block-preset-id": analytics?.blockPresetId ?? "",
  "data-siab-content-signature": analytics?.contentSignature ?? "",
  "data-ph-capture-attribute-section_id": analytics?.sectionId ?? "",
  "data-ph-capture-attribute-section_type": analytics?.sectionType ?? fallbackType,
  "data-ph-capture-attribute-section_position": String(analytics?.sectionPosition ?? fallbackIndex ?? ""),
  "data-ph-capture-attribute-section_anchor": analytics?.sectionAnchor ?? "",
})

export const actionAnalyticsAttrs = (
  role: "primary" | "secondary" | "inline" | "nav" | "footer" | "unknown",
  label?: string | null,
) => ({
  "data-siab-analytics-action": "true",
  "data-siab-action-role": role,
  "data-siab-action-label": label ?? "",
  "data-ph-capture-attribute-action_role": role,
  "data-ph-capture-attribute-action_label": label ?? "",
  "data-ph-capture-attribute-siab_autocapture": "true",
})
