export const recordLabel = (value: unknown, keys: string[]): string | null => {
  if (value == null) return null
  if (typeof value !== "object") return String(value)
  const record = value as Record<string, unknown>
  for (const key of keys) {
    const candidate = record[key]
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim()
    if (typeof candidate === "number") return String(candidate)
  }
  return null
}
