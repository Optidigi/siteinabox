export type JsonRecord = Record<string, unknown>

export function isRecord(value: unknown): value is JsonRecord {
  return value != null && typeof value === "object" && !Array.isArray(value)
}

export function asRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null
}

export function nodeErrorCode(error: unknown): string | undefined {
  const record = asRecord(error)
  return typeof record?.code === "string" ? record.code : undefined
}

export function queryRows<T>(result: unknown): T[] {
  const rows = asRecord(result)?.rows
  if (Array.isArray(rows)) return rows as T[]
  if (Array.isArray(result)) return result as T[]
  return []
}
