import type { RtManifest } from "@/lib/richText/manifest"
import { asRecord, isRecord } from "@/lib/record"

export const FOOTER_ITEM_TYPES = ["brand", "text", "links", "contact", "business", "navigation"] as const
export type FooterItemType = (typeof FOOTER_ITEM_TYPES)[number]

export type FooterLink = {
  label: string
  href: string
  external?: boolean
}

export type FooterCompositionItem = {
  id?: string | null
  type: FooterItemType
  label?: string | null
  text?: string | null
  links?: FooterLink[] | null
}

export type FooterCompositionColumn = {
  id?: string | null
  items: FooterCompositionItem[]
}

export type FooterCompositionContract = {
  columnCounts: number[]
  defaultColumnCount: number
  items: Array<{ type: FooterItemType; label: string }>
}

const typeSet = new Set<string>(FOOTER_ITEM_TYPES)

const stringOrNull = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

const normalizeColumnCounts = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  const counts = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 6)
  return Array.from(new Set(counts)).sort((a, b) => a - b)
}

export const resolveFooterContract = (manifest?: RtManifest | null): FooterCompositionContract | null => {
  const raw = manifest?.footer
  if (!raw || typeof raw !== "object") return null
  const columnCounts = normalizeColumnCounts(raw.columnCounts)
  if (!columnCounts.length) return null
  const items = Array.isArray(raw.items)
    ? raw.items
        .filter((item) => isRecord(item) && typeSet.has(String(item.type)))
        .map((item) => ({
          type: String(item.type) as FooterItemType,
          label: stringOrNull(item.label) ?? defaultFooterItemLabel(item.type as FooterItemType),
        }))
    : []
  if (!items.length) return null
  const defaultColumnCount = typeof raw.defaultColumnCount === "number" && columnCounts.includes(raw.defaultColumnCount)
    ? raw.defaultColumnCount
    : columnCounts[columnCounts.length - 1]!
  return { columnCounts, defaultColumnCount, items }
}

export const defaultFooterItemLabel = (type: FooterItemType) => {
  switch (type) {
    case "brand":
      return "Brand"
    case "text":
      return "Text"
    case "links":
      return "Links"
    case "contact":
      return "Contact"
    case "business":
      return "Business details"
    case "navigation":
      return "Navigation"
  }
}

export const newFooterId = () => `footer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const createFooterItem = (type: FooterItemType): FooterCompositionItem => ({
  id: newFooterId(),
  type,
  label: type === "text" ? "Info" : null,
  text: type === "text" ? "Text" : null,
  links: type === "links" ? [{ label: "Link", href: "/" }] : null,
})

const preferredFooterTypes: FooterItemType[] = ["brand", "business", "contact", "navigation", "text", "links"]

const defaultFooterTypeForColumn = (
  columnIndex: number,
  contract: FooterCompositionContract,
): FooterItemType => {
  const allowed = new Set(contract.items.map((item) => item.type))
  const selected = preferredFooterTypes.filter((type) => allowed.has(type))
  return selected[columnIndex] ?? selected[0] ?? contract.items[0]!.type
}

export const ensureFooterColumnItems = (
  columns: FooterCompositionColumn[],
  contract: FooterCompositionContract,
): FooterCompositionColumn[] => columns.map((column, index) => ({
  ...column,
  items: column.items.length
    ? column.items
    : [createFooterItem(defaultFooterTypeForColumn(index, contract))],
}))

export const normalizeFooterColumns = (
  value: unknown,
  contract?: FooterCompositionContract | null,
): FooterCompositionColumn[] => {
  if (!Array.isArray(value)) return []
  const allowed = new Set<string>((contract?.items ?? FOOTER_ITEM_TYPES.map((type) => ({ type, label: defaultFooterItemLabel(type) }))).map((item) => item.type))
  return value
    .map((column) => {
      const columnRecord = isRecord(column) ? column : {}
      const items = Array.isArray(columnRecord.items) ? columnRecord.items : []
      return {
        id: stringOrNull(columnRecord.id),
        items: items
          .filter((item): item is Record<string, unknown> => isRecord(item) && allowed.has(String(item.type)))
          .map((item) => ({
            id: stringOrNull(item.id),
            type: item.type as FooterItemType,
            label: stringOrNull(item.label) ?? (item.type === "text" ? "Info" : null),
            text: stringOrNull(item.text) ?? (item.type === "text" ? "Text" : null),
            links: Array.isArray(item.links)
              ? item.links
                  .filter(isRecord)
                  .map((link) => ({
                    label: stringOrNull(link.label) ?? "",
                    href: stringOrNull(link.href) ?? "",
                    external: !!link.external,
                  }))
                  .filter((link: FooterLink) => link.label || link.href)
              : [],
          })),
      }
    })
}

export const comparableFooterColumns = (
  value: unknown,
  contract?: FooterCompositionContract | null,
) => normalizeFooterColumns(value, contract).map((column) => ({
  items: column.items.map((item) => ({
    type: item.type,
    label: item.label ?? null,
    text: item.text ?? null,
    links: item.links ?? [],
  })),
}))

export const setFooterColumnCount = (
  columns: FooterCompositionColumn[],
  count: number,
  contract?: FooterCompositionContract | null,
): FooterCompositionColumn[] => {
  const next = columns.slice(0, count)
  while (next.length < count) next.push({ id: newFooterId(), items: [] })
  return contract ? ensureFooterColumnItems(next, contract) : next
}

export const defaultFooterColumns = (
  settings: { chrome?: { footer?: { columns?: unknown; tagline?: string | null } } } | null | undefined,
  contract: FooterCompositionContract | null,
): FooterCompositionColumn[] => {
  const existing = normalizeFooterColumns(settings?.chrome?.footer?.columns, contract)
  if (existing.length) return contract ? setFooterColumnCount(existing, existing.length, contract) : existing
  if (!contract) return []

  const allowed = new Set(contract.items.map((item) => item.type))
  const selected = preferredFooterTypes.filter((type) => allowed.has(type)).slice(0, contract.defaultColumnCount)
  const columns = setFooterColumnCount([], contract.defaultColumnCount, contract)
  selected.forEach((type, index) => {
    columns[index]!.items = [{
      ...createFooterItem(type),
      text: type === "brand" ? (settings?.chrome?.footer?.tagline ?? null) : null,
    }]
  })
  return columns
}
