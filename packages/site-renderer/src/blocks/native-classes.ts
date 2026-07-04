import type { SiteChromeVariant } from "@siteinabox/contracts"

type NativeResolvedBlock = {
  blockType: string
  designVariant?: string | null
}

type NativeBlockClassSlot =
  | "section"
  | "eyebrow"
  | "title"
  | "intro"
  | "description"
  | "body"
  | "actions"
  | "cta"
  | "ctaPrimary"
  | "ctaSecondary"
  | "image"
  | "list"
  | "item"
  | "icon"
  | "form"
  | "formField"
  | "label"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "submit"
  | "header"
  | "grid"
  | "card"
  | "meta"
  | "avatar"
  | "marker"
  | "table"
  | "scroll"

type NativeChromeClassSlot =
  | "root"
  | "inner"
  | "brand"
  | "nav"
  | "link"
  | "cta"
  | "toggle"
  | "content"
  | "columns"
  | "column"
  | "item"
  | "bottom"
  | "dismiss"

type NativeChromeClassMap = Partial<Record<NativeChromeClassSlot, string>>

const nativeChromeVariantClasses: Record<string, NativeChromeClassMap> = {}

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ")
}

export function nativeBlockClassName(block: NativeResolvedBlock, slot: NativeBlockClassSlot) {
  void block
  void slot
  return ""
}

export function nativeChromeClassName(
  area: "header" | "footer" | "banner",
  variant: SiteChromeVariant | null | undefined,
  slot: NativeChromeClassSlot,
) {
  const key = `${area}:${variant ?? "default"}`
  return nativeChromeVariantClasses[key]?.[slot] ?? ""
}
