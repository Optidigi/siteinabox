import type { LucideIcon } from "lucide-react"
import type { Block } from "payload"

/**
 * Shared truncation helper for block summary pills.
 * Truncates a string to `n` characters, appending an ellipsis if needed.
 */
export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

export type BlockMeta = {
  description?: string
  icon?: LucideIcon
}

export type BlockWithMeta = Block & BlockMeta & {
  summary?: (v: Record<string, unknown>) => string | undefined
}
