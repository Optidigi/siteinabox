import * as React from "react"
import type { LinkRef, NavLink, SiteFooter, SiteSettings } from "@siteinabox/contracts"
import { cn } from "@siteinabox/ui/lib/utils"
import { assertNever } from "../blocks/shared"
import type { MediaResolver } from "../media"
import { Footer01 } from "./Footer01"

export type FooterVariantProps = {
  footer: SiteFooter
  settings: SiteSettings
  links: LinkRef[]
  mediaResolver?: MediaResolver
}

export type FooterRendererProps = {
  settings: SiteSettings
  mediaResolver?: MediaResolver
}

const hrefFor = (value: string | null | undefined): string | null => {
  const href = value?.trim()
  return href || null
}

const flattenNavigation = (items: NavLink[]): LinkRef[] => items.flatMap((item) => {
  const link = hrefFor(item.href)
  const own = link ? [{ label: item.label, href: link, external: item.external }] : []
  const children = item.children?.length ? flattenNavigation(item.children) : []
  return [...own, ...children]
})

const footerLinks = (settings: SiteSettings, footer: SiteFooter): LinkRef[] => {
  const links = [
    ...flattenNavigation(settings.navigation?.footer ?? []),
    ...(footer.legalLinks ?? []).filter((link) => Boolean(hrefFor(link.href))),
  ]
  const seen = new Set<string>()
  return links.filter((link) => {
    const href = hrefFor(link.href)
    if (!href) return false
    const key = `${link.label?.trim() ?? ""}\u0000${href}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function FooterVariantView(props: FooterVariantProps) {
  switch (props.footer.variant) {
    case "footer-01":
      return <Footer01 {...props} />
    default:
      return assertNever(props.footer.variant)
  }
}

export function FooterRenderer({ settings, mediaResolver }: FooterRendererProps) {
  const footer = settings.chrome?.footer
  if (!footer) return null

  return (
    <div
      className={cn("site-footer-frame", `site-footer-variant-${footer.variant.replace("footer-", "")}`)}
      data-siab-footer="true"
      data-footer-variant={footer.variant}
    >
      <FooterVariantView
        footer={footer}
        settings={settings}
        links={footerLinks(settings, footer)}
        mediaResolver={mediaResolver}
      />
    </div>
  )
}
