/**
 * Stable block ids for iframe-editor wire addressing. Payload array-row ids are
 * numeric when present; otherwise a session-stable UUID is minted once.
 */
export function blockWireId(block: Record<string, unknown>): string | null {
  const raw = block.id
  if (typeof raw === "string" && raw.trim()) return raw.trim()
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw)
  return null
}

export function ensureBlockId(block: Record<string, unknown>): string {
  const existing = blockWireId(block)
  if (existing) {
    block.id = existing
    return existing
  }
  const id = crypto.randomUUID()
  block.id = id
  return id
}

export function ensurePageBlockIds<T>(blocks: T[]): T[] {
  return blocks.map((entry) => {
    if (!entry || typeof entry !== "object") return entry
    const copy = { ...(entry as Record<string, unknown>) }
    ensureBlockId(copy)
    return copy as T
  })
}

export function findBlockIndexByWireId(blocks: unknown[], blockId: string): number {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (!block || typeof block !== "object") continue
    if (blockWireId(block as Record<string, unknown>) === blockId) return index
  }
  return -1
}
