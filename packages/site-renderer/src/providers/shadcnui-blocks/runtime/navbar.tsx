import * as React from "react"
import type { NavLink, SiteSettings } from "@siteinabox/contracts"
import { Backpack, CakeSlice, Coffee, Grape, Hotel, IceCream, MapPin, Menu, Package, Pizza, Plane, Sandwich, Smile, X } from "lucide-react"
import { Button, NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { resolveMedia, type MediaResolver } from "../../../media"

export type NavbarLink = { label: string; href?: string; external: boolean; active: boolean; description?: string; icon?: NavLink["icon"]; children?: NavbarLink[] }
export type NavbarViewModel = {
  siteName: string
  logo?: { src: string; alt: string }
  links: NavbarLink[]
  cta?: { label: string; href: string; external: boolean }
  secondaryAction?: { label: string; href: string; external: boolean }
  search?: { action: string; placeholder: string }
  behavior: "static" | "sticky"
  activeMode: "path" | "anchor" | "none"
  mobileMenu: "dropdown" | "drawer"
  themeToggleLabel: string
}

const cleanPath = (value: string) => (value.split(/[?#]/)[0] || "/").replace(/\/$/, "") || "/"
const currentPath = (slug?: string) => cleanPath(slug ? `/${slug}` : "/")
const isActive = (href: string | undefined, mode: NavbarViewModel["activeMode"], slug?: string) => {
  if (!href || mode === "none") return false
  if (mode === "anchor") return href.startsWith("#") || (href.includes("#") && cleanPath(href) === currentPath(slug))
  return cleanPath(href) === currentPath(slug)
}
const adaptLink = (link: NavLink, mode: NavbarViewModel["activeMode"], slug?: string): NavbarLink | null => {
  const label = link.label?.trim()
  if (!label) return null
  const children = (link.children ?? []).flatMap((child) => {
    const adapted = adaptLink(child, mode, slug)
    return adapted ? [adapted] : []
  })
  const href = link.href?.trim() || undefined
  if (!href && !children.length) return null
  return { label, href, external: !!link.external, active: isActive(href, mode, slug), ...(link.description?.trim() ? { description: link.description.trim() } : {}), ...(link.icon ? { icon: link.icon } : {}), ...(children.length ? { children } : {}) }
}
const action = (value?: { label?: string | null; href?: string | null; external?: boolean | null } | null) => value?.label?.trim() && value.href?.trim() ? { label: value.label.trim(), href: value.href.trim(), external: !!value.external } : undefined

export function adaptNavbar(settings: SiteSettings, currentSlug?: string, mediaResolver?: MediaResolver): NavbarViewModel | null {
  const header = settings.chrome?.header
  if (!header) return null
  const activeMode = header.activeMode ?? "path"
  const resolved = resolveMedia(header.logo ?? settings.branding?.logo ?? null, mediaResolver)
  const links = (settings.navHeader ?? []).flatMap((link) => { const adapted = adaptLink(link, activeMode, currentSlug); return adapted ? [adapted] : [] })
  const cta = action(header.cta)
  const secondaryAction = action(header.secondaryAction)
  const search = header.search?.enabled ? { action: header.search.action?.trim() || "/search", placeholder: header.search.placeholder?.trim() || "Search" } : undefined
  if (!resolved && !links.length && !cta && !secondaryAction && !search) return null
  return { siteName: settings.siteName, logo: resolved ? { src: resolved.src, alt: resolved.alt || settings.siteName } : undefined, links, cta, secondaryAction, search, behavior: header.behavior ?? "static", activeMode, mobileMenu: header.mobileMenu ?? "drawer", themeToggleLabel: (settings.language ?? "en").toLowerCase().startsWith("nl") ? "Kleurmodus wisselen" : "Toggle color mode" }
}

const externalProps = (external: boolean) => external ? { target: "_blank", rel: "noopener noreferrer" } as const : {}
export function ProviderLogo({ model, className }: { model: NavbarViewModel; className?: string }) {
  return <a className={className ?? "font-semibold"} href="/">{model.logo ? <img className="max-h-9 w-auto" src={model.logo.src} alt={model.logo.alt} /> : model.siteName}</a>
}

const icons = { backpack: Backpack, "cake-slice": CakeSlice, coffee: Coffee, grape: Grape, hotel: Hotel, "ice-cream": IceCream, "map-pin": MapPin, package: Package, pizza: Pizza, plane: Plane, sandwich: Sandwich, smile: Smile }
function FlyoutChild({ link }: { link: NavbarLink }) {
  const Icon = link.icon ? icons[link.icon] : undefined
  return <li><NavigationMenuLink asChild><a className="select-none flex-col items-start rounded-md p-3 leading-none no-underline outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground" href={link.href} {...externalProps(link.external)}>{Icon ? <Icon className="mb-3 size-6" aria-hidden /> : null}<div className="font-medium leading-none">{link.label}</div>{link.description ? <p className="line-clamp-2 text-muted-foreground text-sm leading-snug">{link.description}</p> : null}</a></NavigationMenuLink></li>
}

export function ProviderNavMenu({ model, variant, className }: { model: NavbarViewModel; variant: string; className?: string }) {
  if (variant === "shadcnui-blocks.navbar-03") return <NavigationMenu className={className}><NavigationMenuList className="gap-1 space-x-0 text-sm">{model.links.map((link) => link.children?.length ? <NavigationMenuItem key={link.label}><NavigationMenuTrigger>{link.label}</NavigationMenuTrigger><NavigationMenuContent forceMount><ul className="grid w-[400px] gap-3 p-1 md:w-[500px] md:grid-cols-2 lg:w-[600px]">{link.children.map((child) => <FlyoutChild key={`${child.label}-${child.href}`} link={child} />)}</ul></NavigationMenuContent></NavigationMenuItem> : <NavigationMenuItem key={`${link.label}-${link.href}`}><Button asChild variant="ghost"><a aria-current={link.active ? "page" : undefined} href={link.href} {...externalProps(link.external)}>{link.label}</a></Button></NavigationMenuItem>)}</NavigationMenuList></NavigationMenu>
  return <div className={className}>{model.links.map((link) => <a className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground" aria-current={link.active ? "page" : undefined} href={link.href} key={`${link.href}-${link.label}`} {...externalProps(link.external)}>{link.label}</a>)}</div>
}

export function ProviderNavigationSheet({ model, variant }: { model: NavbarViewModel; variant: string }) {
  return <div className="md:hidden" data-provider-mobile-navigation data-mobile-menu={model.mobileMenu}><button aria-expanded="false" aria-label="Menu openen" className="inline-flex size-9 items-center justify-center rounded-lg border" data-navbar-toggle type="button"><Menu className="size-5" data-navbar-open-icon /><X className="hidden size-5" data-navbar-close-icon /></button><div className="absolute inset-x-4 top-[calc(100%+0.5rem)] hidden max-h-[calc(100vh-7rem)] overflow-auto rounded-xl border bg-background p-4 shadow-lg" data-navbar-panel><ProviderNavMenu className="flex flex-col gap-4" model={model} variant={variant} />{model.cta ? <a className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground" href={model.cta.href} {...externalProps(model.cta.external)}>{model.cta.label}</a> : null}</div></div>
}
