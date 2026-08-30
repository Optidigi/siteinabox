export type SectionAnalytics = {
  sectionId?: string | null
  sectionType?: string | null
  sectionPosition?: number | null
  sectionAnchor?: string | null
  contentSignature?: string | null
}

export function sectionAnalyticsAttrs(
  analytics: SectionAnalytics | null | undefined,
  fallbackType: string,
  fallbackIndex?: number,
): Record<string, string> {
  const position = String(analytics?.sectionPosition ?? fallbackIndex ?? "")
  const sectionType = analytics?.sectionType ?? fallbackType

  return {
    "data-siab-analytics-section": "true",
    "data-siab-section-id": analytics?.sectionId ?? "",
    "data-siab-section-type": sectionType,
    "data-siab-section-position": position,
    "data-siab-section-anchor": analytics?.sectionAnchor ?? "",
    "data-siab-content-signature": analytics?.contentSignature ?? "",
    "data-ph-capture-attribute-section_id": analytics?.sectionId ?? "",
    "data-ph-capture-attribute-section_type": sectionType,
    "data-ph-capture-attribute-section_position": position,
    "data-ph-capture-attribute-section_anchor": analytics?.sectionAnchor ?? "",
  }
}

export function actionAnalyticsAttrs(
  role: "primary" | "secondary" | "inline" | "nav" | "footer" | "unknown",
  label?: string | null,
): Record<string, string> {
  return {
    "data-siab-analytics-action": "true",
    "data-siab-action-role": role,
    "data-siab-action-label": label ?? "",
    "data-ph-capture-attribute-action_role": role,
    "data-ph-capture-attribute-action_label": label ?? "",
    "data-ph-capture-attribute-siab_autocapture": "true",
  }
}
