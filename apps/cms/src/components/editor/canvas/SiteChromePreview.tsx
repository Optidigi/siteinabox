"use client"
import Link from "next/link"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { ChevronRight, GripVertical, Menu, MoreVertical, Navigation, PanelBottom, PanelTop } from "lucide-react"
import { useTranslations } from "next-intl"
import { FOOTER_ITEM_TYPES, type FooterCompositionColumn, type FooterCompositionItem } from "@/lib/footerComposition"
import { cn } from "@siteinabox/ui/lib/utils"
import { formatCssPx, useCspStyleRule } from "@siteinabox/ui/lib/csp-style"
import { CanvasChromeGutterOverlay } from "@/components/editor/canvas/CanvasChromeGutterOverlay"
import { useCanvasSelection } from "@/components/editor/canvas/CanvasSelectionContext"
import { isReadOnlyView } from "@/components/editor/canvas/canvasView"
import type { RtManifest } from "@/lib/richText/manifest"
import type { RtBlock, RtInline, RtRoot } from "@/lib/richText/RtNode"
import { RtSlot } from "./inline/RtSlot"

export type SiteChromeZone = "header" | "footer"
export type SiteChromeSelection = { zone: SiteChromeZone }
export type SiteChromeSelectPoint = { x: number; y: number }

const DEFAULT_BRAND = "Site"
const DEFAULT_MAINTENANCE_MESSAGE = "Deze website is tijdelijk in onderhoud."

const mediaUrl = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null
  const url = (value as { url?: unknown }).url
  return typeof url === "string" ? url : null
}

const navLabel = (entry: any): string | null => {
  if (typeof entry?.label === "string" && entry.label.trim()) return entry.label
  const page = entry?.page
  if (page && typeof page === "object" && typeof page.title === "string") return page.title
  return null
}

const navHref = (entry: any): string | null => {
  if (typeof entry?.href === "string" && entry.href.trim()) return entry.href
  if (typeof entry?.url === "string" && entry.url.trim()) return entry.url
  if (typeof entry?.anchor === "string" && entry.anchor.trim()) return `#${entry.anchor.replace(/^#/, "")}`
  if (typeof entry?.section === "string" && entry.section.trim()) return `#${entry.section.replace(/^#/, "")}`
  return null
}

const navLink = (entry: any): { label: string; href: string } | null => {
  const label = navLabel(entry)
  if (!label) return null
  return { label, href: navHref(entry) ?? "#" }
}

const isNavLink = (value: { label: string; href: string } | null): value is { label: string; href: string } =>
  value != null

const trimString = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

const trimOr = (value: unknown, fallback: string) => {
  return trimString(value) ?? fallback
}

const chromeLabel = (zone: SiteChromeZone) => zone === "header" ? "Header" : "Footer"

const itemLabel = (item: FooterCompositionItem, fallback: string) => trimString(item.label) ?? fallback
const footerItemTypes = new Set<string>(FOOTER_ITEM_TYPES)
const siteChromeTargetSelector = (zone: SiteChromeZone) =>
  zone === "header"
    ? '.rt-canvas [data-site-chrome="header"], .rt-canvas [data-amicare-nav], .rt-canvas .site-frame-root > nav'
    : '.rt-canvas [data-site-chrome="footer"], .rt-canvas .site-frame-root > footer'

const isVisibleChromeTarget = (node: HTMLElement | null) => {
  if (!node) return false
  const rect = node.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

const pickChromeTarget = (targets: HTMLElement[], current: HTMLElement | null) => {
  if (current && targets.includes(current) && isVisibleChromeTarget(current)) return current
  return targets.find(isVisibleChromeTarget) ?? targets[0] ?? null
}

const sameChromeTargets = (current: HTMLElement[], next: HTMLElement[]) =>
  current.length === next.length && current.every((target, index) => target === next[index])

type ChromeTriggerProps = {
  onMouseEnter: () => void
  onMouseLeave: () => void
  onFocusCapture: () => void
  onBlurCapture: (event: ReactFocusEvent<HTMLElement>) => void
  onClick: (event: ReactMouseEvent<HTMLElement>) => void
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void
}

const inlineRootFromText = (value: string): RtRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: value }],
})

const blockRootFromText = (value: string): RtRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: value }] }],
})

const rtToPlainText = (value: RtRoot): string => {
  const parts: string[] = []
  const walkInline = (node: RtInline) => {
    if (node.t === "text") parts.push(node.v)
    else if (node.t === "linebreak") parts.push("\n")
    else node.children.forEach(walkInline)
  }
  const walkBlock = (node: RtBlock) => {
    if (node.t === "paragraph" || node.t === "heading") {
      node.children.forEach(walkInline)
      parts.push("\n")
      return
    }
    if (node.t === "list") {
      node.items.forEach((item) => item.children.forEach(walkBlock))
      return
    }
    if (node.t === "blockquote") {
      node.children.forEach(walkBlock)
      return
    }
    if (node.t === "themed") {
      if (typeof node.props.text === "string") parts.push(node.props.text)
      node.children?.forEach(walkBlock)
    }
  }
  if (value.variant === "inline") value.children.forEach(walkInline)
  else value.children.forEach(walkBlock)
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim()
}

const footerGridClass = (count: number) => {
  switch (count) {
    case 1:
      return "@min-[48rem]/site-frame:grid-cols-1"
    case 2:
      return "@min-[48rem]/site-frame:grid-cols-2"
    case 4:
      return "@min-[48rem]/site-frame:grid-cols-4"
    case 5:
      return "@min-[48rem]/site-frame:grid-cols-5"
    case 6:
      return "@min-[48rem]/site-frame:grid-cols-6"
    case 3:
    default:
      return "@min-[48rem]/site-frame:grid-cols-3"
  }
}

const normalizeFooterPreviewColumns = (value: unknown): FooterCompositionColumn[] => {
  if (!Array.isArray(value)) return []
  return value.map((column: any) => ({
    id: trimString(column?.id),
    items: Array.isArray(column?.items)
      ? column.items
          .filter((item: any) => item && typeof item === "object" && footerItemTypes.has(item.type))
          .map((item: any) => ({
            id: trimString(item.id),
            type: item.type as FooterCompositionItem["type"],
            label: trimString(item.label) ?? (item.type === "text" ? "Info" : null),
            text: trimString(item.text) ?? (item.type === "text" ? "Text" : null),
            links: Array.isArray(item.links)
              ? item.links
                  .map((link: any) => ({
                    label: trimString(link?.label) ?? "",
                    href: trimString(link?.href) ?? "",
                  }))
                  .filter((link: { label: string; href: string }) => link.label || link.href)
              : [],
          }))
      : [],
  })).filter((column) => column.items.length > 0)
}

export function SiteChromePreview({
  zone,
  settings,
  navigationHref,
  manifest,
  onNavigate,
  selected,
  onSelect,
  onUpdateFooterTextItem,
}: {
  zone: SiteChromeZone
  settings: any
  navigationHref?: string | null
  manifest?: RtManifest
  onNavigate?: (href: string) => void
  selected?: SiteChromeSelection | null
  onSelect?: (selection: SiteChromeSelection, point?: SiteChromeSelectPoint) => void
  onUpdateFooterTextItem?: (columnIndex: number, patch: { label?: string | null; text?: string | null }) => void
}) {
  const brandLogo = mediaUrl(settings?.branding?.logo)
  const headerLogo = mediaUrl(settings?.chrome?.header?.logo) ?? brandLogo
  const footerLogo = mediaUrl(settings?.chrome?.footer?.logo) ?? brandLogo
  const footer = settings?.chrome?.footer
  const footerColumns = normalizeFooterPreviewColumns(footer?.columns)
  const navItems: Array<{ label: string; href: string }> = ((zone === "header" ? settings?.navHeader : settings?.navFooter) ?? [])
    .map(navLink)
    .filter(isNavLink)
  const resolvedLinks = navItems.slice(0, 5)
  const isHeader = zone === "header"
  const label = chromeLabel(zone)
  const brand = trimOr(settings?.siteName, DEFAULT_BRAND)
  const footerBrand = brand.toUpperCase()
  const footerText = trimString(footer?.tagline)
  const copyright = trimOr(footer?.copyright, `© ${new Date().getFullYear()} ${footerBrand}`)
  const email = trimString(settings?.contactEmail)
  const nap = settings?.nap ?? {}
  const tradeName = trimString(nap?.legalName)
  const kvkNumber = trimString(nap?.kvkNumber)
  const establishmentNumber = trimString(nap?.establishmentNumber)
  const hasBusinessDetails = tradeName || kvkNumber || establishmentNumber
  const showMaintenance = !!settings?.maintenance?.enabled
  const maintenanceMessage = trimOr(settings?.maintenance?.message, DEFAULT_MAINTENANCE_MESSAGE)
  const isSelected = selected?.zone === zone

  return (
    <ChromeActionsMenu
      label={label}
      zone={zone}
      selected={isSelected}
      navigationHref={navigationHref}
      onNavigate={onNavigate}
      onSelect={onSelect ? (point) => onSelect({ zone }, point) : undefined}
      showOptionsButton
      overlayTargetSelector={siteChromeTargetSelector(zone)}
      trigger={(chromeTargetProps) =>
        isHeader ? (
          <>
            <nav
              {...chromeTargetProps}
              aria-label="Hoofdnavigatie"
              className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-rule bg-bg px-6 py-5 @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-20"
              data-site-chrome={zone}
            >
              <a href="#top" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
                {headerLogo ? (
                  <>
                    <img src={headerLogo} alt="" className="h-7 w-auto max-w-40 object-contain" />
                    <span className="sr-only">{brand}</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
                    <span className="font-sans text-[13px] font-medium uppercase tracking-[0.18em]">
                      {brand}
                    </span>
                  </>
                )}
              </a>

              <div className="hidden items-center gap-8 text-[13px] tracking-[0.04em] @min-[48rem]/site-frame:flex">
                {resolvedLinks.map((item) => (
                  <a key={`${item.href}:${item.label}`} href={item.href} className="relative text-ink-muted transition-colors hover:text-ink">
                    {item.label}
                  </a>
                ))}
              </div>

              <button
                type="button"
                aria-label="Menu openen"
                aria-expanded="false"
                className="rounded-full bg-accent/10 p-3 text-ink transition-colors hover:bg-accent/20 @min-[48rem]/site-frame:hidden"
              >
                <Menu size={20} />
              </button>
            </nav>
            {showMaintenance && (
              <aside className="border-b border-rule bg-accent/10 px-6 py-3 text-center text-[13px] font-medium tracking-[0.02em] text-ink @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-20">
                {maintenanceMessage}
              </aside>
            )}
          </>
        ) : (
          <footer
            {...chromeTargetProps}
            className="relative border-t border-rule bg-gradient-to-br from-secondary/20 via-bg to-accent/5 px-6 py-16 @min-[48rem]/site-frame:px-12 @min-[64rem]/site-frame:px-24"
            data-site-chrome={zone}
          >
            {footerColumns.length ? (
              <FooterColumns
                columns={footerColumns}
                onUpdateFooterTextItem={onUpdateFooterTextItem}
                manifest={manifest}
                footerLogo={footerLogo}
                footerBrand={footerBrand}
                footerText={footerText}
                tradeName={tradeName}
                kvkNumber={kvkNumber}
                establishmentNumber={establishmentNumber}
                email={email}
                navItems={resolvedLinks}
              />
            ) : (
              <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 @min-[48rem]/site-frame:grid-cols-3 @min-[48rem]/site-frame:gap-8 @min-[64rem]/site-frame:gap-12">
                <FooterBrandItem footerLogo={footerLogo} footerBrand={footerBrand} footerText={footerText} />
                {hasBusinessDetails && (
                  <FooterBusinessItem tradeName={tradeName} kvkNumber={kvkNumber} establishmentNumber={establishmentNumber} />
                )}
                {email && <FooterContactItem email={email} />}
              </div>
            )}
            <div className="mx-auto my-8 max-w-7xl border-t border-rule" />
            <p className="mx-auto max-w-7xl text-center text-[12px] tracking-[0.04em] text-ink-muted/70 @min-[48rem]/site-frame:text-left">
              {copyright}
            </p>
          </footer>
        )
      }
    />
  )
}

function FooterColumns({
  columns,
  onUpdateFooterTextItem,
  manifest,
  footerLogo,
  footerBrand,
  footerText,
  tradeName,
  kvkNumber,
  establishmentNumber,
  email,
  navItems,
}: {
  columns: FooterCompositionColumn[]
  onUpdateFooterTextItem?: (columnIndex: number, patch: { label?: string | null; text?: string | null }) => void
  manifest?: RtManifest
  footerLogo: string | null
  footerBrand: string
  footerText: string | null
  tradeName: string | null
  kvkNumber: string | null
  establishmentNumber: string | null
  email: string | null
  navItems: Array<{ label: string; href: string }>
}) {
  return (
    <div className={`mx-auto grid max-w-7xl grid-cols-1 gap-12 ${footerGridClass(columns.length)} @min-[48rem]/site-frame:gap-8 @min-[64rem]/site-frame:gap-12`}>
      {columns.map((column, columnIndex) => (
        <div
          key={column.id ?? columnIndex}
          className="-m-2 space-y-6 p-2"
        >
          {column.items.map((item, itemIndex) => (
            <div
              key={item.id ?? `${item.type}-${itemIndex}`}
              className="-m-1 p-1"
            >
              <FooterItem
                item={item}
                footerLogo={footerLogo}
                footerBrand={footerBrand}
                footerText={footerText}
                tradeName={tradeName}
                kvkNumber={kvkNumber}
                establishmentNumber={establishmentNumber}
                email={email}
                navItems={navItems}
                manifest={manifest}
                onUpdateTextItem={onUpdateFooterTextItem && itemIndex === 0 && item.type === "text" ? (patch) => onUpdateFooterTextItem(columnIndex, patch) : undefined}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function FooterItem({
  item,
  footerLogo,
  footerBrand,
  footerText,
  tradeName,
  kvkNumber,
  establishmentNumber,
  email,
  navItems,
  manifest,
  onUpdateTextItem,
}: {
  item: FooterCompositionItem
  footerLogo: string | null
  footerBrand: string
  footerText: string | null
  tradeName: string | null
  kvkNumber: string | null
  establishmentNumber: string | null
  email: string | null
  navItems: Array<{ label: string; href: string }>
  manifest?: RtManifest
  onUpdateTextItem?: (patch: { label?: string | null; text?: string | null }) => void
}) {
  if (item.type === "brand") {
    return <FooterBrandItem footerLogo={footerLogo} footerBrand={footerBrand} footerText={trimString(item.text) ?? footerText} />
  }
  if (item.type === "business") {
    return <FooterBusinessItem tradeName={tradeName} kvkNumber={kvkNumber} establishmentNumber={establishmentNumber} />
  }
  if (item.type === "contact") {
    return email ? <FooterContactItem email={email} /> : null
  }
  if (item.type === "navigation") {
    return <FooterLinkList title={itemLabel(item, "Navigation")} links={navItems} />
  }
  if (item.type === "links") {
    return <FooterLinkList title={itemLabel(item, "Links")} links={(item.links ?? []).filter((link) => link.label && link.href)} />
  }
  if (item.type === "text") {
    const text = trimString(item.text)
    const label = itemLabel(item, "Info")
    const textPlaceholder = "Text"
    return (
      <div className="space-y-3">
        {onUpdateTextItem && manifest ? (
          <div onClick={(event) => event.stopPropagation()}>
            <RtSlot
              as="p"
              variant="inline"
              manifest={manifest}
              value={inlineRootFromText(label)}
              onChange={(next) => onUpdateTextItem({ label: rtToPlainText(next) || null })}
              className="max-w-max text-[11px] font-medium uppercase tracking-[0.18em] text-accent"
              placeholder="Info"
            />
          </div>
        ) : (
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
            {label}
          </p>
        )}
        {onUpdateTextItem && manifest ? (
          <div onClick={(event) => event.stopPropagation()}>
            <RtSlot
              as="p"
              variant="block"
              manifest={manifest}
              value={blockRootFromText(text ?? textPlaceholder)}
              onChange={(next) => {
                const plain = rtToPlainText(next)
                onUpdateTextItem({ text: plain || null })
              }}
              className={`max-w-[28ch] text-[13px] leading-[1.6] ${text ? "text-ink-muted" : "text-ink-muted/55"}`}
              placeholder={textPlaceholder}
            />
          </div>
        ) : (
          <p className={`min-h-[1.5em] max-w-[28ch] text-[13px] leading-[1.6] ${text ? "text-ink-muted" : "text-ink-muted/55"}`}>
            {text ?? textPlaceholder}
          </p>
        )}
      </div>
    )
  }
  return null
}

function FooterBrandItem({ footerLogo, footerBrand, footerText }: { footerLogo: string | null; footerBrand: string; footerText: string | null }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        {footerLogo ? (
          <img src={footerLogo} alt="" className="h-8 w-auto max-w-44 object-contain" />
        ) : (
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-accent" />
        )}
        <span className="font-sans text-[14px] font-medium uppercase tracking-[0.18em] text-ink">
          {footerBrand}
        </span>
      </div>
      {footerText && (
        <p className="max-w-[28ch] font-serif text-[14px] italic leading-[1.5] text-ink-muted">
          {footerText}
        </p>
      )}
    </div>
  )
}

function FooterBusinessItem({ tradeName, kvkNumber, establishmentNumber }: { tradeName: string | null; kvkNumber: string | null; establishmentNumber: string | null }) {
  if (!tradeName && !kvkNumber && !establishmentNumber) return null
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
        Bedrijfsgegevens
      </p>
      <div className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
        {tradeName && <p>Handelsnaam: <span className="text-ink">{tradeName}</span></p>}
        {kvkNumber && <p>KVK <span className="text-ink">{kvkNumber}</span></p>}
        {establishmentNumber && <p>Vestigingsnr. <span className="text-ink">{establishmentNumber}</span></p>}
      </div>
    </div>
  )
}

function FooterContactItem({ email }: { email: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
        Contact
      </p>
      <div className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
        <p className="pt-1.5">
          <a href={`mailto:${email}`} className="text-ink transition-colors hover:text-accent">
            {email}
          </a>
        </p>
      </div>
    </div>
  )
}

function FooterLinkList({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  if (!links.length) return null
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{title}</p>
      <ul className="space-y-1.5 text-[13px] leading-[1.6] text-ink-muted">
        {links.map((link) => (
          <li key={`${link.href}:${link.label}`}>
            <a href={link.href} className="text-ink transition-colors hover:text-accent">{link.label}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SiteChromeActionFrame({
  zone,
  navigationHref,
  onNavigate,
  selected,
  onSelect,
  children,
}: {
  zone: SiteChromeZone
  navigationHref?: string | null
  onNavigate?: (href: string) => void
  selected?: SiteChromeSelection | null
  onSelect?: (selection: SiteChromeSelection, point?: SiteChromeSelectPoint) => void
  children: ReactNode
}) {
  const label = chromeLabel(zone)
  return (
    <ChromeActionsMenu
      label={label}
      zone={zone}
      selected={selected?.zone === zone}
      navigationHref={navigationHref}
      onNavigate={onNavigate}
      onSelect={onSelect ? (point) => onSelect({ zone }, point) : undefined}
      showOptionsButton
      overlayTargetSelector={siteChromeTargetSelector(zone)}
      trigger={children}
    />
  )
}

export function SiteChromeRow({
  zone,
  navigationHref,
  onNavigate,
  selected,
  onSelect,
}: {
  zone: SiteChromeZone
  navigationHref?: string | null
  onNavigate?: (href: string) => void
  selected?: boolean
  onSelect?: (selection: SiteChromeSelection, point?: SiteChromeSelectPoint) => void
}) {
  const t = useTranslations("editor")
  const label = chromeLabel(zone)
  const Icon = zone === "header" ? PanelTop : PanelBottom

  return (
    <ChromeActionsMenu
      label={label}
      zone={zone}
      selected={selected}
      navigationHref={navigationHref}
      onNavigate={onNavigate}
      onSelect={onSelect ? (point) => onSelect({ zone }, point) : undefined}
      trigger={
        <button
          type="button"
          className={`group/row flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:border-border hover:bg-accent/30 ${selected ? "border-border bg-accent/30" : "border-transparent"}`}
          aria-label={t("siteChromeActions", { zone: label })}
        >
          <span
            className="shrink-0 rounded-sm p-0.5 text-muted-foreground opacity-35"
            aria-hidden
          >
            <GripVertical className="size-3.5" />
          </span>
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium leading-snug">{label}</span>
          </span>
          {!onSelect && (
            <MoreVertical className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100" aria-hidden />
          )}
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      }
    />
  )
}

function ChromeActionsMenu({
  label,
  zone,
  selected = false,
  navigationHref,
  onNavigate,
  onSelect,
  showOptionsButton = false,
  overlayTargetSelector,
  trigger,
}: {
  label: string
  zone: SiteChromeZone
  selected?: boolean
  navigationHref?: string | null
  onNavigate?: (href: string) => void
  onSelect?: (point?: SiteChromeSelectPoint) => void
  showOptionsButton?: boolean
  overlayTargetSelector?: string
  trigger: ReactNode | ((props: ChromeTriggerProps) => ReactNode)
}) {
  const t = useTranslations("editor")
  const { view } = useCanvasSelection()
  const isReadOnly = isReadOnlyView(view)
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const overlayAnchorRef = useRef<HTMLElement | null>(null)
  const [overlayAnchor, setOverlayAnchor] = useState<HTMLElement | null>(null)
  const [overlayTargets, setOverlayTargets] = useState<HTMLElement[]>([])
  const [gutterVisible, setGutterVisible] = useState(false)
  const open = point != null
  const useOverlayTarget = showOptionsButton && !!overlayTargetSelector
  const activeAnchorRef = useOverlayTarget ? overlayAnchorRef : anchorRef

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPoint(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  useLayoutEffect(() => {
    if (!useOverlayTarget || !overlayTargetSelector) return
    const findTargets = () => {
      const nextTargets = Array.from(document.querySelectorAll<HTMLElement>(overlayTargetSelector))
      const nextAnchor = pickChromeTarget(nextTargets, overlayAnchorRef.current)
      if (overlayAnchorRef.current !== nextAnchor) {
        overlayAnchorRef.current = nextAnchor
        setOverlayAnchor(nextAnchor)
      }
      setOverlayTargets((current) => sameChromeTargets(current, nextTargets) ? current : nextTargets)
    }
    findTargets()
    const observer = new MutationObserver(findTargets)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [overlayTargetSelector, useOverlayTarget])

  // siab-responsive-ignore-next-line -- CMS action menu is fixed to the browser viewport, not tenant layout.
  const left = point && typeof window !== "undefined" ? Math.max(8, Math.min(point.x, window.innerWidth - 240)) : 0
  // siab-responsive-ignore-next-line -- CMS action menu is fixed to the browser viewport, not tenant layout.
  const top = point && typeof window !== "undefined" ? Math.max(8, Math.min(point.y, window.innerHeight - 112)) : 0
  const menuPosition = useCspStyleRule(
    "site-chrome-actions-menu",
    open ? `left:${formatCssPx(left)};top:${formatCssPx(top)};` : null,
  )

  const openAt = useCallback((nextPoint: SiteChromeSelectPoint) => {
    if (onSelect) {
      onSelect(nextPoint)
      return
    }
    setPoint(nextPoint)
  }, [onSelect])

  const setGutterVisibleSafely = useCallback((next: boolean) => {
    setGutterVisible(next)
  }, [])

  const setActiveOverlayTarget = useCallback((target: HTMLElement) => {
    overlayAnchorRef.current = target
    setOverlayAnchor(target)
  }, [])

  const triggerTargetProps: ChromeTriggerProps = {
    onMouseEnter: () => setGutterVisibleSafely(true),
    onMouseLeave: () => setGutterVisibleSafely(false),
    onFocusCapture: () => setGutterVisibleSafely(true),
    onBlurCapture: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setGutterVisibleSafely(false)
      }
    },
    onClick: (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (onSelect) {
        onSelect()
        return
      }
      setPoint({ x: event.clientX, y: event.clientY })
    },
    onContextMenu: (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (isReadOnly) return
      openAt({ x: event.clientX, y: event.clientY })
    },
  }
  const triggerNode = typeof trigger === "function" ? trigger(triggerTargetProps) : trigger

  useEffect(() => {
    if (!useOverlayTarget || !overlayTargetSelector) return
    const targetFromEvent = (eventTarget: EventTarget | null) => eventTarget instanceof HTMLElement
      ? eventTarget.closest<HTMLElement>(overlayTargetSelector)
      : null

    const onDocumentPointerOver = (event: PointerEvent) => {
      const target = targetFromEvent(event.target)
      if (!target) return
      setActiveOverlayTarget(target)
      setGutterVisibleSafely(true)
    }

    const onDocumentPointerOut = (event: PointerEvent) => {
      const target = targetFromEvent(event.target)
      if (!target) return
      const relatedTarget = event.relatedTarget
      if (relatedTarget instanceof Node && target.contains(relatedTarget)) return
      setGutterVisibleSafely(false)
    }

    const onDocumentContextMenu = (event: MouseEvent) => {
      const target = targetFromEvent(event.target)
      if (!target) return
      setActiveOverlayTarget(target)
      event.preventDefault()
      event.stopPropagation()
      if (isReadOnly) return
      openAt({ x: event.clientX, y: event.clientY })
    }

    document.addEventListener("pointerover", onDocumentPointerOver, true)
    document.addEventListener("pointerout", onDocumentPointerOut, true)
    document.addEventListener("contextmenu", onDocumentContextMenu, true)
    return () => {
      document.removeEventListener("pointerover", onDocumentPointerOver, true)
      document.removeEventListener("pointerout", onDocumentPointerOut, true)
      document.removeEventListener("contextmenu", onDocumentContextMenu, true)
    }
  }, [isReadOnly, openAt, overlayTargetSelector, setActiveOverlayTarget, setGutterVisibleSafely, useOverlayTarget])

  useEffect(() => {
    if (!useOverlayTarget || overlayTargets.length === 0) return
    const listeners = overlayTargets.map((target) => {
      const onMouseEnter = () => {
        setActiveOverlayTarget(target)
        setGutterVisibleSafely(true)
      }
      const onMouseLeave = () => setGutterVisibleSafely(false)
      const onFocusIn = () => {
        setActiveOverlayTarget(target)
        setGutterVisibleSafely(true)
      }
      const onFocusOut = (event: FocusEvent) => {
        if (!target.contains(event.relatedTarget as Node | null)) {
          setGutterVisibleSafely(false)
        }
      }
      const onClick = (event: MouseEvent) => {
        setActiveOverlayTarget(target)
        event.preventDefault()
        event.stopPropagation()
        if (onSelect) {
          onSelect()
          return
        }
        setPoint({ x: event.clientX, y: event.clientY })
      }
      const onContextMenu = (event: MouseEvent) => {
        setActiveOverlayTarget(target)
        event.preventDefault()
        event.stopPropagation()
        if (isReadOnly) return
        openAt({ x: event.clientX, y: event.clientY })
      }

      target.addEventListener("mouseenter", onMouseEnter)
      target.addEventListener("mouseleave", onMouseLeave)
      target.addEventListener("focusin", onFocusIn)
      target.addEventListener("focusout", onFocusOut)
      target.addEventListener("click", onClick)
      target.addEventListener("contextmenu", onContextMenu)
      return { target, onMouseEnter, onMouseLeave, onFocusIn, onFocusOut, onClick, onContextMenu }
    })

    return () => {
      listeners.forEach(({ target, onMouseEnter, onMouseLeave, onFocusIn, onFocusOut, onClick, onContextMenu }) => {
        target.removeEventListener("mouseenter", onMouseEnter)
        target.removeEventListener("mouseleave", onMouseLeave)
        target.removeEventListener("focusin", onFocusIn)
        target.removeEventListener("focusout", onFocusOut)
        target.removeEventListener("click", onClick)
        target.removeEventListener("contextmenu", onContextMenu)
      })
    }
  }, [isReadOnly, onSelect, openAt, overlayTargets, setActiveOverlayTarget, setGutterVisibleSafely, useOverlayTarget])

  const menu = open && typeof document !== "undefined" ? createPortal(
    <div
      className="fixed inset-0 z-50 font-sans"
      onClick={() => setPoint(null)}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setPoint(null)
      }}
      role="presentation"
    >
      {menuPosition.styleElement}
      <div
        role="menu"
        aria-label={t("siteChromeActions", { zone: label })}
        className={`${menuPosition.className} fixed min-w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md`}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        {navigationHref && onNavigate && (
          <button
            type="button"
            role="menuitem"
            className="relative flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            onClick={() => {
              setPoint(null)
              onNavigate(navigationHref)
            }}
          >
            <Navigation className="size-4 text-muted-foreground" aria-hidden />
            {t("manageNavigation")}
          </button>
        )}
        {navigationHref && !onNavigate && (
          <Link
            href={navigationHref}
            role="menuitem"
            className="relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            onClick={() => setPoint(null)}
          >
            <Navigation className="size-4 text-muted-foreground" aria-hidden />
            {t("manageNavigation")}
          </Link>
        )}
        {!navigationHref && (
          <div className="relative flex items-center rounded-sm px-2 py-1.5 text-sm text-muted-foreground">
            {t("noSiteChromeActions", { zone: label })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <>
      {useOverlayTarget ? (
        triggerNode
      ) : (
        <div
          ref={anchorRef}
          className={cn(
            "cms-block relative",
            `cms-block--site-chrome cms-block--site-chrome-${zone}`,
          )}
          data-active={selected || undefined}
          data-site-chrome-wrapper={showOptionsButton ? "true" : undefined}
          {...triggerTargetProps}
        >
          {triggerNode}
        </div>
      )}
      {showOptionsButton && !isReadOnly && (
        <CanvasChromeGutterOverlay
          anchorRef={activeAnchorRef}
          visible={gutterVisible || selected}
          setVisible={setGutterVisibleSafely}
          optionsLabel={t("siteChromeActions", { zone: label })}
          dataChrome="site-chrome-gutter"
          premeasure
          measureKey={overlayAnchor}
          onOptionsClick={openAt}
        />
      )}
      {menu}
    </>
  )
}
