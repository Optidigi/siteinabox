import * as React from "react"
import { Search, SunIcon } from "lucide-react"
import { validateSiteChromeCapabilities, type SiteSettings } from "@siteinabox/contracts"
import { Button, Input } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { MediaResolver } from "../../media"
import { adaptNavbar, ProviderLogo, ProviderNavMenu, ProviderNavigationSheet, type NavbarViewModel } from "./runtime/navbar"

const variants = new Set([
  "shadcnui-blocks.navbar-01",
  "shadcnui-blocks.navbar-02",
  "shadcnui-blocks.navbar-03",
  "shadcnui-blocks.navbar-04",
  "shadcnui-blocks.navbar-05",
])

function PrimaryAction({ model, pill = false }: { model: NavbarViewModel; pill?: boolean }) {
  return model.cta ? <Button asChild className={pill ? "rounded-full" : undefined}><a href={model.cta.href} rel={model.cta.external ? "noopener noreferrer" : undefined} target={model.cta.external ? "_blank" : undefined}>{model.cta.label}</a></Button> : null
}

function SecondaryAction({ model, pill = false }: { model: NavbarViewModel; pill?: boolean }) {
  return model.secondaryAction ? <Button asChild className={pill ? "hidden rounded-full sm:inline-flex" : "hidden sm:inline-flex"} variant="outline"><a href={model.secondaryAction.href} rel={model.secondaryAction.external ? "noopener noreferrer" : undefined} target={model.secondaryAction.external ? "_blank" : undefined}>{model.secondaryAction.label}</a></Button> : null
}

function Navbar({ model, variant }: { model: NavbarViewModel; variant: string }) {
  if (variant === "shadcnui-blocks.navbar-05") return (
    <nav className="fixed inset-x-4 top-6 mx-auto h-16 max-w-(--breakpoint-xl) rounded-full border bg-background"><div className="mx-auto flex h-full items-center justify-between px-4">
      <div className="flex items-center gap-2 md:gap-6"><ProviderLogo className="shrink-0" model={model} />{model.search ? <form action={model.search.action} className="relative hidden md:block" method="get" role="search"><label className="sr-only" htmlFor="provider-navbar-search">{model.search.placeholder}</label><Search className="absolute inset-y-0 left-2.5 my-auto h-5 w-5" /><Input className="w-[280px] flex-1 rounded-full border-none bg-muted pl-10 shadow-none" id="provider-navbar-search" name="q" placeholder={model.search.placeholder} /></form> : null}</div>
      <div className="flex items-center gap-2">{model.search ? <Button aria-label={model.search.placeholder} className="rounded-full bg-muted text-foreground shadow-none hover:bg-accent md:hidden" size="icon" type="button" variant="outline"><Search className="h-5! w-5!" /></Button> : null}<SecondaryAction model={model} pill /><PrimaryAction model={model} pill /></div>
    </div></nav>
  )

  const nav = <ProviderNavMenu className="hidden items-center gap-6 md:flex" model={model} variant={variant} />
  const pill = variant === "shadcnui-blocks.navbar-04"
  const actions = <div className="flex items-center gap-3"><SecondaryAction model={model} pill={pill} /><PrimaryAction model={model} pill={pill} />{variant === "shadcnui-blocks.navbar-02" ? <Button aria-label={model.themeToggleLabel} data-theme-toggle size="icon" type="button" variant="outline"><SunIcon /></Button> : null}<div className="md:hidden"><ProviderNavigationSheet model={model} variant={variant} /></div></div>

  if (variant === "shadcnui-blocks.navbar-04") return <nav className="fixed inset-x-4 top-6 mx-auto h-16 max-w-(--breakpoint-xl) rounded-full border bg-background"><div className="mx-auto flex h-full items-center justify-between px-4"><ProviderLogo model={model} />{nav}{actions}</div></nav>
  const width = variant === "shadcnui-blocks.navbar-03" ? "max-w-(--breakpoint-lg)" : "max-w-(--breakpoint-xl)"
  const gap = variant === "shadcnui-blocks.navbar-03" ? "gap-8" : "gap-12"
  return <nav className="h-16 border-b bg-background"><div className={`mx-auto flex h-full ${width} items-center justify-between px-4 sm:px-6 lg:px-8`}><div className={`flex items-center ${gap}`}><ProviderLogo model={model} />{nav}</div>{actions}</div></nav>
}

export function ShadcnUiNavbarView({ variant, settings, currentSlug, mediaResolver }: { variant: string; settings: SiteSettings; currentSlug?: string; mediaResolver?: MediaResolver }) {
  if (!variants.has(variant)) throw new Error(`Unresolved provider chrome variant "${variant}" for header.`)
  const effectiveSettings = { ...settings, chrome: { ...settings.chrome, header: { ...settings.chrome?.header, variant } } } as SiteSettings
  const issues = validateSiteChromeCapabilities(effectiveSettings).filter((issue) => issue.path === "navHeader" || issue.path.startsWith("navHeader.") || issue.path.startsWith("chrome.header"))
  if (issues.length) throw new Error(`Invalid ${variant} settings: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`)
  const model = adaptNavbar(effectiveSettings, currentSlug, mediaResolver)
  if (!model) return null
  const nav = <Navbar model={model} variant={variant} />
  return <header className={model.behavior === "sticky" ? "sticky top-0 z-50" : undefined} data-header-behavior={model.behavior} data-provider-token-mode="theme" data-provider-variant={variant}>{nav}</header>
}
