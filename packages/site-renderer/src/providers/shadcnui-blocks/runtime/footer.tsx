import * as React from "react"
import type { FooterCompositionItem, LinkRef, SiteSettings } from "@siteinabox/contracts"
import { resolveMedia, type MediaResolver } from "../../../media"

export type FooterLink = { label: string; href: string; external: boolean }
export type FooterColumn = { label?: string; text?: string; links: FooterLink[] }
export type FooterViewModel = {
  siteName: string
  logo?: { src: string; alt: string }
  tagline?: string
  copyright?: string
  columns: FooterColumn[]
  links: FooterLink[]
  social: FooterLink[]
  newsletter?: { title?: string; placeholder: string; submitLabel: string; action: string; method: "GET" | "POST" }
}

function links(values?: LinkRef[] | null): FooterLink[] {
  return (values ?? []).flatMap((link) => {
    const label = link.label?.trim()
    const href = link.href?.trim()
    return label && href ? [{ label, href, external: !!link.external }] : []
  })
}
const uniqueLinks = (values: FooterLink[]) => {
  const seen = new Set<string>()
  return values.filter((link) => { const key = `${link.href.trim().replace(/\/$/, "") || "/"}\u0000${link.label.toLocaleLowerCase()}`; if (seen.has(key)) return false; seen.add(key); return true })
}
const join = (values: Array<string | null | undefined>) => values.map((value) => value?.trim()).filter(Boolean).join(", ")
function columnForItem(item: FooterCompositionItem, settings: SiteSettings): FooterColumn | null {
  const label = item.label?.trim() || undefined
  if (item.type === "brand") return { label: label ?? settings.siteName, text: item.text?.trim() || settings.chrome?.footer?.tagline?.trim() || settings.description?.trim(), links: [] }
  if (item.type === "navigation") return { label: label ?? "Navigatie", links: links(settings.navFooter) }
  if (item.type === "contact") {
    const contactLinks = [
      settings.contactEmail ? { label: settings.contactEmail, href: `mailto:${settings.contactEmail}`, external: false } : null,
      settings.contact?.phone ? { label: settings.contact.phone, href: `tel:${settings.contact.phone.replace(/\s+/g, "")}`, external: false } : null,
      ...links((settings.contact?.social ?? []).map((social) => ({ label: social.platform, href: social.url, external: true }))),
    ].filter((value): value is FooterLink => Boolean(value))
    return { label: label ?? "Contact", text: item.text?.trim() || settings.contact?.address?.trim() || undefined, links: uniqueLinks([...contactLinks, ...links(item.links)]) }
  }
  if (item.type === "business") {
    const nap = settings.nap
    const address = join([nap?.streetAddress, nap?.postalCode, nap?.city, nap?.region, nap?.country])
    const registrations = join([nap?.kvkNumber ? `KvK ${nap.kvkNumber}` : null, nap?.establishmentNumber ? `Vestiging ${nap.establishmentNumber}` : null])
    const service = settings.serviceArea?.length ? `Werkgebied: ${settings.serviceArea.map((entry) => entry.name).join(", ")}` : ""
    const hours = settings.hours?.length ? settings.hours.map((entry) => `${entry.day}: ${entry.closed ? "gesloten" : `${entry.open ?? ""}-${entry.close ?? ""}`}`).join(", ") : ""
    return { label: label ?? nap?.legalName ?? "Bedrijfsgegevens", text: item.text?.trim() || [label ? nap?.legalName : null, address, registrations, service, hours].filter(Boolean).join(" · ") || undefined, links: links(item.links) }
  }
  const itemLinks = links(item.links)
  const text = item.text?.trim() || undefined
  return label || text || itemLinks.length ? { label, text, links: itemLinks } : null
}

export function adaptFooter(settings: SiteSettings, mediaResolver?: MediaResolver): FooterViewModel | null {
  const footer = settings.chrome?.footer
  if (!footer) return null
  const resolved = resolveMedia(footer.logo ?? settings.branding?.logo ?? null, mediaResolver)
  const columns = (footer.columns ?? []).flatMap((column) => (column.items ?? []).flatMap((item) => { const adapted = columnForItem(item, settings); return adapted ? [adapted] : [] }))
  const flatLinks = uniqueLinks([...links(settings.navFooter), ...links(footer.legalLinks)])
  const social = uniqueLinks((settings.contact?.social ?? []).flatMap((item) => {
    const label = item.platform?.trim(); const href = item.url?.trim()
    return label && href ? [{ label, href, external: true }] : []
  }))
  const tagline = footer.tagline?.trim() || undefined
  const copyright = footer.copyright?.trim() || undefined
  const newsletter = footer.newsletter?.action?.trim() ? { title: footer.newsletter.title?.trim() || undefined, placeholder: footer.newsletter.placeholder?.trim() || "Email address", submitLabel: footer.newsletter.submitLabel?.trim() || "Subscribe", action: footer.newsletter.action.trim(), method: footer.newsletter.method ?? "POST" } : undefined
  if (!resolved && !tagline && !copyright && !columns.length && !flatLinks.length && !social.length && !newsletter) return null
  return { siteName: settings.siteName, logo: resolved ? { src: resolved.src, alt: resolved.alt || settings.siteName } : undefined, tagline, copyright, columns, links: flatLinks, social, newsletter }
}

const externalProps = (external: boolean) => external ? { target: "_blank", rel: "noopener noreferrer" } as const : {}
export function FooterBrand({ model, className }: { model: FooterViewModel; className?: string }) { return <a className={className ?? "inline-flex items-center font-semibold"} href="/">{model.logo ? <img className="max-h-8 w-auto" src={model.logo.src} alt={model.logo.alt} /> : model.siteName}</a> }
export function FooterColumns({ model }: { model: FooterViewModel }) { return <>{model.columns.map((column, index) => <div key={`${column.label ?? "column"}-${index}`}>{column.label ? <h6 className="font-medium">{column.label}</h6> : null}{column.text ? <p className="mt-4 text-muted-foreground">{column.text}</p> : null}{column.links.length ? <ul className="mt-6 space-y-4">{column.links.map((link) => <li key={`${link.href}-${link.label}`}><a className="text-muted-foreground hover:text-foreground" href={link.href} {...externalProps(link.external)}>{link.label}</a></li>)}</ul> : null}</div>)}</> }
export function FooterFlatLinks({ model, className = "flex flex-wrap items-center gap-4" }: { model: FooterViewModel; className?: string }) { return <ul className={className}>{model.links.map((link) => <li key={`${link.href}-${link.label}`}><a className="text-muted-foreground hover:text-foreground" href={link.href} {...externalProps(link.external)}>{link.label}</a></li>)}</ul> }
export function FooterSocial({ model }: { model: FooterViewModel }) { return model.social.length ? <div className="flex flex-wrap items-center gap-5 text-muted-foreground">{model.social.map((link) => <a aria-label={link.label} className="hover:text-foreground" href={link.href} key={`${link.href}-${link.label}`} {...externalProps(link.external)}>{link.label}</a>)}</div> : null }
