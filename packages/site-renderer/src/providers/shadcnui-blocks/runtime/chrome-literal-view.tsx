import * as React from "react"
import { TooltipProvider } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { BannerViewModel } from "./banner"
import type { FooterViewModel } from "./footer"
import type { NavbarViewModel } from "./navbar"
import { ProviderLogo, ProviderNavMenu, ProviderNavigationSheet } from "./navbar"

type LiteralComponent = (props: Record<string, never>) => React.ReactNode
type ChromeModel =
  | { kind: "banner"; value: BannerViewModel; variant: string }
  | { kind: "footer"; value: FooterViewModel; variant: string }
  | { kind: "navbar"; value: NavbarViewModel; variant: string }

type Projection = {
  texts: string[]
  links: { label: string; href: string; external?: boolean }[]
  logo?: { src: string; alt: string }
  siteName?: string
  cursor: { text: number; link: number; action: number; bannerAction: number }
}

function nodeHasText(node: React.ReactNode): boolean {
  if (typeof node === "string" || typeof node === "number") return String(node).trim().length > 0
  if (Array.isArray(node)) return node.some(nodeHasText)
  return React.isValidElement(node) && nodeHasText((node.props as { children?: React.ReactNode }).children)
}

function nodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join("")
  return React.isValidElement(node) ? nodeText((node.props as { children?: React.ReactNode }).children) : ""
}

function projectionFor(model: ChromeModel): Projection {
  if (model.kind === "banner") {
    const value = model.value
    return {
      texts: [value.message, value.title, value.link?.label].filter((item): item is string => Boolean(item)),
      links: value.link ? [value.link] : [],
      cursor: { text: 0, link: 0, action: 0, bannerAction: 0 },
    }
  }
  if (model.kind === "navbar") {
    const value = model.value
    return {
      texts: [...value.links.map((link) => link.label), value.cta?.label].filter((item): item is string => Boolean(item)),
      links: [{ label: value.siteName, href: "/" }, ...value.links.flatMap((link) => link.href ? [{ label: link.label, href: link.href, external: link.external }] : []), ...(value.cta ? [value.cta] : [])],
      logo: value.logo,
      siteName: value.siteName,
      cursor: { text: 0, link: 0, action: 0, bannerAction: 0 },
    }
  }
  const value = model.value
  const columnText = value.columns.flatMap((column) => [column.label, column.text])
  return {
    texts: [value.siteName, value.tagline, ...columnText, value.newsletter?.title, value.copyright].filter((item): item is string => Boolean(item)),
    links: [{ label: value.siteName, href: "/" }, ...value.columns.flatMap((column) => column.links), ...value.links, ...value.social],
    logo: value.logo,
    siteName: value.siteName,
    cursor: { text: 0, link: 0, action: 0, bannerAction: 0 },
  }
}

function projectNode(node: React.ReactNode, model: ChromeModel, projection: Projection): React.ReactNode {
  if (Array.isArray(node)) return node.map((child) => projectNode(child, model, projection))
  if (typeof node === "string" || typeof node === "number") {
    if (!String(node).trim()) return node
    if (!projection.texts.length) return "\u00a0"
    return projection.texts[projection.cursor.text++] ?? "\u00a0"
  }
  if (!React.isValidElement(node)) return node
  const props = node.props as Record<string, unknown>
  const componentName = typeof node.type === "function" ? node.type.name : ""
  if (model.kind === "navbar" && componentName === "Logo") return <ProviderLogo className={props.className as string | undefined} model={model.value} />
  if (model.kind === "navbar" && componentName === "NavMenu") return <ProviderNavMenu className={props.className as string | undefined} model={model.value} variant={model.variant} />
  if (model.kind === "navbar" && componentName === "NavigationSheet") return <ProviderNavigationSheet model={model.value} variant={model.variant} />
  if (typeof node.type === "function" && /^(Logo|NavMenu|NavigationSheet)$/.test(componentName)) {
    const Component = node.type as (componentProps: Record<string, unknown>) => React.ReactNode
    return projectNode(Component(props), model, projection)
  }
  const elementType = typeof node.type === "string" ? node.type : undefined
  if (elementType === "form") {
    if (model.kind !== "footer" || !model.value.newsletter) return null
    const newsletter = model.value.newsletter
    return <form action={newsletter.action} className={props.className as string | undefined} method={newsletter.method.toLowerCase()}><label className="sr-only" htmlFor={`provider-newsletter-${model.variant}`}>{newsletter.placeholder}</label><input className="max-w-64 grow rounded-md border bg-background px-3 py-2 text-sm" id={`provider-newsletter-${model.variant}`} name="email" placeholder={newsletter.placeholder} required type="email" /><button className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" type="submit">{newsletter.submitLabel}</button></form>
  }
  const next: Record<string, unknown> = {}
  let linkChildren: React.ReactNode | undefined
  if (elementType === "svg" && projection.siteName && !props["aria-label"]) {
    next.role = "img"
    next["aria-label"] = projection.siteName
  }
  if (elementType === "img" || componentName === "Image") {
    if (!projection.logo) return null
    next.src = projection.logo.src
    next.alt = projection.logo.alt
  }
  if (model.kind === "navbar" && model.variant === "shadcnui-blocks.navbar-05" && (elementType === "input" || componentName === "Input")) {
    if (!model.value.search) return null
    const input = React.cloneElement(node as React.ReactElement<Record<string, unknown>>, { name: "q", "aria-label": model.value.search.placeholder, placeholder: model.value.search.placeholder })
    return <form action={model.value.search.action} id={`provider-search-${model.variant}`} method="get" role="search">{input}</form>
  }
  if ("href" in props) {
    const link = projection.links[projection.cursor.link++]
    if (!link) return null
    next.href = link.href
    linkChildren = link.label
    if (link.external) {
      next.target = "_blank"
      next.rel = "noopener noreferrer"
    }
    if (!nodeHasText(props.children as React.ReactNode)) next["aria-label"] = link.label
  }
  const children = props.children as React.ReactNode
  const projectedChildren = linkChildren !== undefined
    ? linkChildren
    : "children" in props
    ? React.Children.count(children) === 1
      ? projectNode(children, model, projection)
      : React.Children.map(children, (child) => projectNode(child, model, projection))
    : undefined
  if ("children" in props) next.children = projectedChildren

  if (model.kind === "footer" && elementType === "p" && /copyright|all rights reserved|©/i.test(nodeText(children))) {
    next.children = model.value.copyright ?? model.value.tagline ?? model.value.siteName
  }

  if (model.kind === "banner" && (elementType === "button" || componentName === "Button")) {
    const actionIndex = projection.cursor.bannerAction++
    if (model.variant === "shadcnui-blocks.banner-04" && model.value.consent) {
      const action = actionIndex === 0 ? "reject" : "accept"
      next["data-consent-action"] = action
      next.type = "button"
      next.children = action === "accept" ? "Accepteren" : "Weigeren"
    } else if (model.value.link && actionIndex === 0) {
      next.asChild = true
      next.children = <a href={model.value.link.href}>{model.value.link.label}</a>
    } else if (model.value.dismissible && actionIndex <= (model.value.link ? 1 : 0)) {
      next.type = "button"
      next.children = "Sluiten"
    } else return null
  } else if (model.kind === "navbar" && componentName === "Button" && nodeHasText(props.children as React.ReactNode)) {
    const actionIndex = projection.cursor.action++
    const action = model.variant === "shadcnui-blocks.navbar-05"
      ? (actionIndex === 0 ? model.value.secondaryAction : actionIndex === 1 ? model.value.cta : undefined)
      : (actionIndex === 0 ? model.value.cta : undefined)
    if (!action) return null
    next.asChild = true
    next.children = <a href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noopener noreferrer" : undefined}>{action.label}</a>
  } else if (model.kind === "navbar" && model.variant === "shadcnui-blocks.navbar-05" && componentName === "Button" && !nodeHasText(props.children as React.ReactNode) && !model.value.search) {
    return null
  } else if (model.kind === "navbar" && model.variant === "shadcnui-blocks.navbar-05" && componentName === "Button" && !nodeHasText(props.children as React.ReactNode) && model.value.search) {
    next["aria-label"] = model.value.search.placeholder
    next.type = "submit"
    next.form = `provider-search-${model.variant}`
  } else if (model.kind === "navbar" && model.variant === "shadcnui-blocks.navbar-02" && componentName === "Button" && !nodeHasText(props.children as React.ReactNode)) {
    next["aria-label"] = model.value.themeToggleLabel
    next["data-theme-toggle"] = true
    next.type = "button"
  }
  return React.cloneElement(node as React.ReactElement<Record<string, unknown>>, next)
}

function LiteralChromeView({ Literal, model }: { Literal: LiteralComponent; model: ChromeModel }) {
  const tree = Literal({})
  const projection = projectionFor(model)
  let projected = projectNode(tree, model, projection)
  if (!React.isValidElement(projected)) throw new Error(`Literal provider ${model.kind} did not return a React element.`)
  if (model.kind === "footer") {
    const remainingLinks = projection.links.slice(projection.cursor.link).filter((link, index, values) => values.findIndex((candidate) => candidate.href === link.href && candidate.label === link.label) === index)
    const remainingTexts = projection.texts.slice(projection.cursor.text)
    if (remainingLinks.length || remainingTexts.length) projected = React.cloneElement(projected as React.ReactElement<Record<string, unknown>>, {
      children: <>{(projected.props as any).children}<div className="mx-auto grid max-w-(--breakpoint-xl) gap-6 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4" data-provider-overflow>{remainingTexts.length ? <div className="space-y-2">{remainingTexts.map((value, index) => <p className="text-sm text-muted-foreground" key={`${value}-${index}`}>{value}</p>)}</div> : null}{remainingLinks.length ? <ul className="flex flex-wrap gap-x-5 gap-y-3">{remainingLinks.map((link, index) => <li key={`${link.href}-${link.label}-${index}`}><a className="text-sm text-muted-foreground hover:text-foreground" href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined}>{link.label}</a></li>)}</ul> : null}</div></>,
    })
  }
  const withBehavior = model.kind === "navbar" && model.value.behavior === "sticky"
    ? React.cloneElement(projected as React.ReactElement<Record<string, unknown>>, { className: [String((projected.props as any).className ?? ""), "sticky top-0 z-50"].filter(Boolean).join(" "), "data-header-behavior": "sticky" })
    : projected
  return <TooltipProvider>{withBehavior}</TooltipProvider>
}

export function LiteralProviderBannerView({ Literal, model, variant }: { Literal: LiteralComponent; model: BannerViewModel; variant: string }) {
  return <LiteralChromeView Literal={Literal} model={{ kind: "banner", value: model, variant }} />
}

export function LiteralProviderFooterView({ Literal, model, variant }: { Literal: LiteralComponent; model: FooterViewModel; variant: string }) {
  return <LiteralChromeView Literal={Literal} model={{ kind: "footer", value: model, variant }} />
}

export function LiteralProviderNavbarView({ Literal, model, variant }: { Literal: LiteralComponent; model: NavbarViewModel; variant: string }) {
  return <LiteralChromeView Literal={Literal} model={{ kind: "navbar", value: model, variant }} />
}
