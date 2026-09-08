export const allowPreviewMagicLinkWithoutGrant = (metadata: {
  previewClientSlug?: unknown
}): boolean => {
  if (typeof metadata.previewClientSlug === "string" && metadata.previewClientSlug.trim()) {
    return false
  }
  return true
}
