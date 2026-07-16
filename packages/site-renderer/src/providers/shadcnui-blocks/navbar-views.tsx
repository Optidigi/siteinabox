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

function PrimaryAction({ model }: { model: NavbarViewModel }) {
  return model.cta ? <Button asChild><a href={model.cta.href} rel={model.cta.external ? "noopener noreferrer" : undefined} target={model.cta.external ? "_blank" : undefined}>{model.cta.label}</a></Button> : null
}

function SecondaryAction({ model }: { model: NavbarViewModel }) {
  return model.secondaryAction ? <Button asChild variant="outline"><a href={model.secondaryAction.href} rel={model.secondaryAction.external ? "noopener noreferrer" : undefined} target={model.secondaryAction.external ? "_blank" : undefined}>{model.secondaryAction.label}</a></Button> : null
}

function Navbar({ model, variant }: { model: NavbarViewModel; variant: string }) {
  if (variant === "shadcnui-blocks.navbar-05") return (
    <nav className="border-b bg-background"><div className="mx-auto flex min-h-16 max-w-(--breakpoint-xl) flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <ProviderLogo className="mr-auto shrink-0" model={model} />
      {model.search ? <form action={model.search.action} className="order-last flex w-full max-w-md items-center sm:order-none sm:w-auto sm:flex-1" method="get" role="search"><label className="sr-only" htmlFor="provider-navbar-search">{model.search.placeholder}</label><Input id="provider-navbar-search" name="q" placeholder={model.search.placeholder} /><Button aria-label={model.search.placeholder} className="ml-2" size="icon" type="submit" variant="outline"><Search /></Button></form> : null}
      <SecondaryAction model={model} /><PrimaryAction model={model} />
    </div></nav>
  )

  const nav = <ProviderNavMenu className="hidden items-center gap-6 md:flex" model={model} variant={variant} />
  const actions = <div className="flex items-center gap-3"><PrimaryAction model={model} />{variant === "shadcnui-blocks.navbar-02" ? <Button aria-label={model.themeToggleLabel} data-theme-toggle size="icon" type="button" variant="outline"><SunIcon /></Button> : null}<ProviderNavigationSheet model={model} variant={variant} /></div>

  if (variant === "shadcnui-blocks.navbar-04") return <nav className="border-b bg-background"><div className="mx-auto grid h-16 max-w-(--breakpoint-xl) grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-8"><div>{nav}</div><ProviderLogo model={model} /><div className="justify-self-end">{actions}</div></div></nav>
  return <nav className="border-b bg-background"><div className="mx-auto flex h-16 max-w-(--breakpoint-xl) items-center justify-between px-4 sm:px-6 lg:px-8"><div className="flex items-center gap-12"><ProviderLogo model={model} />{nav}</div>{actions}</div></nav>
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
