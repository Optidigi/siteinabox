export const normalizeBuildRevision = (value: string | undefined): string => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : "unknown"
}
