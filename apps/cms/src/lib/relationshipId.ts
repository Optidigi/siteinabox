export type RelationshipIdRef =
  | number
  | string
  | { id?: number | string | null }
  | null
  | undefined

export const relationshipValue = (value: unknown): string | number | null => {
  if (typeof value === "string" || typeof value === "number") return value
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null
  const id = (value as { id?: unknown }).id
  return typeof id === "string" || typeof id === "number" ? id : null
}

export const relationshipId = (value: RelationshipIdRef): string | null => {
  if (value == null) return null
  if (typeof value === "object") {
    const id = value.id
    return id == null ? null : String(id)
  }
  return String(value)
}

export const sameRelationshipId = (
  left: RelationshipIdRef,
  right: RelationshipIdRef,
): boolean => {
  const leftId = relationshipId(left)
  const rightId = relationshipId(right)
  return leftId != null && rightId != null && leftId === rightId
}

export const relationshipIdSet = (
  values: Iterable<RelationshipIdRef>,
): Set<string> => {
  const ids = new Set<string>()
  for (const value of values) {
    const id = relationshipId(value)
    if (id != null) ids.add(id)
  }
  return ids
}
