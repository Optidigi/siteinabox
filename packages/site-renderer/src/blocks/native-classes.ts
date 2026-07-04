import type { SiteChromeVariant } from "@siteinabox/contracts"
import { resolveBlockVariant } from "./variants"

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

type NativeBlockClassMap = Partial<Record<NativeBlockClassSlot, string>>
type NativeChromeClassMap = Partial<Record<NativeChromeClassSlot, string>>

const nativeBlockVariantClasses: Record<string, NativeBlockClassMap> = {
  tailwindPlusSimpleCentered: {
    section: "!w-full !max-w-none !px-6 !py-24 !text-center sm:!py-32 lg:!px-8",
    eyebrow:
      "!mx-auto !w-fit !rounded-full !px-3 !py-1 !text-sm/6 !font-medium !text-[var(--color-ink-muted)] !ring-1 !ring-[var(--color-rule)]",
    title:
      "!mx-auto !max-w-2xl !text-5xl !font-semibold !tracking-normal !text-balance !text-[var(--color-ink)] sm:!text-7xl",
    intro: "!mx-auto !mt-8 !max-w-xl !text-lg/8 !text-pretty !text-[var(--color-ink-muted)]",
    actions: "!mt-10 !flex !items-center !justify-center !gap-x-6",
    cta: "!rounded-[var(--radius-md)] !px-3.5 !py-2.5 !text-sm !font-semibold !shadow-xs",
    image: "!mx-auto !mt-12 !max-w-5xl !overflow-hidden !rounded-[var(--radius-lg)] !shadow-2xl !ring-1 !ring-[var(--color-rule)]",
  },
  tailwindPlusCentered2x2: {
    section: "!w-full !max-w-none !px-6 !py-24 sm:!py-32 lg:!px-8",
    title:
      "!mx-auto !max-w-2xl !text-center !text-3xl !font-semibold !tracking-normal !text-balance !text-[var(--color-ink)] sm:!text-4xl",
    intro: "!mx-auto !mt-6 !max-w-2xl !text-center !text-lg/8 !text-[var(--color-ink-muted)]",
    list: "!mx-auto !mt-16 !grid !max-w-5xl !grid-cols-1 !gap-x-8 !gap-y-10 sm:!grid-cols-2",
    item: "!border-0 !bg-transparent !p-0 !shadow-none",
    icon: "!mb-6 !flex !size-10 !items-center !justify-center !rounded-[var(--radius-lg)] !bg-[var(--color-accent)] !text-[var(--color-on-accent)]",
  },
  tailblocksContentA: {
    section: "!w-full !max-w-none !px-5 !py-24 !text-[var(--color-ink-muted)]",
    body: "!mx-auto !max-w-3xl !text-center !text-base/7 !leading-relaxed",
  },
  tailblocksCtaA: {
    section: "!w-full !max-w-none !bg-[var(--color-card)] !px-5 !py-24 !text-[var(--color-ink)]",
    title: "!text-2xl !font-medium !tracking-normal sm:!text-3xl",
    description: "!mt-4 !text-base/7 !text-[var(--color-ink-muted)]",
    actions: "!mt-8 !flex !flex-col !gap-3 sm:!flex-row",
    ctaPrimary:
      "!rounded-[var(--radius-md)] !border-0 !bg-[var(--color-accent)] !px-8 !py-2 !text-lg !text-[var(--color-on-accent)] hover:!brightness-95",
    ctaSecondary:
      "!rounded-[var(--radius-md)] !border !border-[var(--color-rule)] !bg-[var(--color-card)] !px-8 !py-2 !text-lg !text-[var(--color-ink)] hover:!brightness-95",
  },
  tailwindPlusNewsletterDetails: {
    section: "!w-full !max-w-none !bg-[var(--color-ink)] !px-6 !py-16 !text-[var(--color-bg)] sm:!py-24 lg:!px-8",
    title: "!max-w-xl !text-3xl !font-semibold !tracking-normal !text-[var(--color-bg)] sm:!text-4xl",
    description: "!mt-4 !max-w-xl !text-lg/8 !text-[var(--color-bg)] !opacity-80",
    form: "!mt-10 !grid !max-w-md !grid-cols-1 !gap-y-4",
    formField: "!grid !gap-2",
    label: "!text-sm/6 !font-semibold !text-[var(--color-bg)]",
    input:
      "!block !w-full !rounded-[var(--radius-md)] !bg-[var(--color-card)] !px-3.5 !py-2.5 !text-[var(--color-ink)] !outline-1 !outline-[var(--color-rule)] placeholder:!text-[var(--color-ink-muted)] focus:!outline-2 focus:!-outline-offset-2 focus:!outline-[var(--color-accent)]",
    textarea: "!min-h-28",
    submit:
      "!rounded-[var(--radius-md)] !border-0 !bg-[var(--color-accent)] !px-3.5 !py-2.5 !text-sm !font-semibold !text-[var(--color-on-accent)] !shadow-xs",
  },
  prelineCenteredNewsletter: {
    section: "!w-full !max-w-none !px-4 !py-10 sm:!px-6 lg:!px-8 lg:!py-16",
    title: "!mx-auto !max-w-xl !text-center !text-2xl !font-bold !tracking-normal !text-[var(--color-ink)] md:!text-3xl md:!leading-tight",
    description: "!mx-auto !mt-4 !max-w-xl !text-center !text-[var(--color-ink-muted)]",
    form: "!mx-auto !mt-5 !flex !max-w-xl !flex-col !items-center !gap-2 sm:!flex-row sm:!gap-3 lg:!mt-8",
    formField: "!w-full",
    label: "!sr-only",
    input:
      "!block !w-full !rounded-[var(--radius-lg)] !border-[var(--color-rule)] !bg-[var(--color-card)] !px-4 !py-2.5 !text-[var(--color-ink)] placeholder:!text-[var(--color-ink-muted)] focus:!border-[var(--color-accent)] focus:!ring-[var(--color-accent)] sm:!py-3 sm:!text-sm",
    submit:
      "!inline-flex !w-full !items-center !justify-center !gap-x-2 !whitespace-nowrap !rounded-[var(--radius-lg)] !border !border-[var(--color-accent)] !bg-[var(--color-accent)] !px-4 !py-3 !text-sm !font-medium !text-[var(--color-on-accent)] hover:!brightness-95 focus:!brightness-95 sm:!w-auto",
  },
  tailwindPlusSimpleTiers: {
    section: "!w-full !max-w-none !px-6 !py-24 sm:!py-32 lg:!px-8",
    header: "!mx-auto !max-w-4xl !text-center",
    title: "!text-4xl !font-semibold !tracking-normal !text-balance !text-[var(--color-ink)] sm:!text-5xl",
    intro: "!mx-auto !mt-6 !max-w-2xl !text-lg/8 !text-pretty !text-[var(--color-ink-muted)]",
    grid: "!mx-auto !mt-16 !grid !max-w-lg !grid-cols-1 !gap-y-6 sm:!mt-20 lg:!max-w-4xl lg:!grid-cols-2 lg:!gap-x-8",
    card:
      "!rounded-[var(--radius-lg)] !bg-[var(--color-card)] !p-8 !ring-1 !ring-[var(--color-rule)] xl:!p-10 data-[highlighted=true]:!bg-[var(--color-ink)] data-[highlighted=true]:!text-[var(--color-bg)]",
    cta: "!mt-8 !block !rounded-[var(--radius-md)] !px-3 !py-2 !text-center !text-sm !font-semibold !ring-1 !ring-inset !ring-[var(--color-accent)]",
  },
  "stats:tailwindPlusSimple": {
    section: "!w-full !max-w-none !px-6 !py-24 sm:!py-32 lg:!px-8",
    header: "!mx-auto !max-w-2xl lg:!mx-0",
    title: "!text-4xl !font-semibold !tracking-normal !text-pretty !text-[var(--color-ink)] sm:!text-5xl",
    intro: "!mt-6 !text-lg/8 !text-[var(--color-ink-muted)]",
    list: "!mx-auto !mt-16 !grid !max-w-2xl !grid-cols-1 !gap-x-8 !gap-y-10 sm:!grid-cols-2 lg:!mx-0 lg:!max-w-none lg:!grid-cols-4",
    item: "!flex !flex-col-reverse !gap-y-3 !border-0 !bg-transparent !p-0",
  },
  "gallery:prelineSquareGrid": {
    section: "!w-full !max-w-none !px-4 !py-10 xl:!mt-10 xl:!py-0",
    header: "!mx-auto !mb-8 !max-w-2xl !text-center",
    title: "!text-2xl !font-bold !tracking-normal !text-[var(--color-ink)] md:!text-3xl",
    intro: "!mt-3 !text-[var(--color-ink-muted)]",
    grid: "!mx-auto !grid !max-w-2xl !grid-cols-2 !gap-2 sm:!grid-cols-4",
    card: "!overflow-hidden !rounded-none",
    image: "!h-40 !w-full !object-cover",
  },
  tailwindPlusGrid: {
    section: "!w-full !max-w-none !px-6 !py-24 sm:!py-32 lg:!px-8",
    header: "!mx-auto !max-w-2xl lg:!mx-0",
    title: "!text-4xl !font-semibold !tracking-normal !text-pretty !text-[var(--color-ink)] sm:!text-5xl",
    intro: "!mt-6 !text-lg/8 !text-[var(--color-ink-muted)]",
    list: "!mx-auto !mt-20 !grid !max-w-2xl !grid-cols-1 !gap-x-8 !gap-y-16 sm:!grid-cols-2 lg:!mx-0 lg:!max-w-none lg:!grid-cols-3",
    item: "!border-0 !bg-transparent !p-0",
    image: "!aspect-3/2 !w-full !rounded-[var(--radius-lg)] !object-cover",
  },
  tailwindPlusThreeColumn: {
    section: "!w-full !max-w-none !px-6 !py-24 sm:!py-32 lg:!px-8",
    header: "!mx-auto !max-w-2xl !text-center",
    title: "!text-4xl !font-semibold !tracking-normal !text-balance !text-[var(--color-ink)] sm:!text-5xl",
    intro: "!mt-2 !text-lg/8 !text-[var(--color-ink-muted)]",
    grid: "!mx-auto !mt-16 !grid !max-w-2xl !grid-cols-1 !gap-x-8 !gap-y-20 lg:!mx-0 lg:!max-w-none lg:!grid-cols-3",
    card: "!flex !flex-col !items-start !justify-between !border-0 !bg-transparent !p-0",
    image: "!aspect-video !w-full !rounded-[var(--radius-lg)] !object-cover",
    meta: "!mt-8 !flex !items-center !gap-x-4 !text-xs !text-[var(--color-ink-muted)]",
  },
  "logoCloud:tailwindPlusSimple": {
    section: "!w-full !max-w-none !px-6 !py-24 sm:!py-32 lg:!px-8",
    title: "!text-center !text-lg/8 !font-semibold !text-[var(--color-ink)]",
    intro: "!mx-auto !mt-4 !max-w-2xl !text-center !text-[var(--color-ink-muted)]",
    list: "!mx-auto !mt-10 !grid !max-w-lg !grid-cols-2 !items-center !gap-x-8 !gap-y-10 sm:!max-w-xl sm:!grid-cols-3 lg:!mx-0 lg:!max-w-none lg:!grid-cols-5",
    item: "!col-span-1 !flex !justify-center !border-0 !bg-transparent !p-0",
  },
}

const nativeChromeVariantClasses: Record<string, NativeChromeClassMap> = {}

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ")
}

export function nativeBlockClassName(block: NativeResolvedBlock, slot: NativeBlockClassSlot) {
  const variant = resolveBlockVariant(block).variant
  if (!variant) return ""
  const blockVariantKey = `${block.blockType}:${variant}`
  return (
    nativeBlockVariantClasses[blockVariantKey]?.[slot] ??
    nativeBlockVariantClasses[variant]?.[slot] ??
    ""
  )
}

export function nativeChromeClassName(
  area: "header" | "footer" | "banner",
  variant: SiteChromeVariant | null | undefined,
  slot: NativeChromeClassSlot,
) {
  const key = `${area}:${variant ?? "default"}`
  return nativeChromeVariantClasses[key]?.[slot] ?? ""
}
