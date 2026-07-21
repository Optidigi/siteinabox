import * as React from "react"
import type { SiteSettings } from "@siteinabox/contracts"
import { ArrowUpRight, ChartPie, UserPlusIcon, X } from "lucide-react"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import { adaptBanner, type BannerViewModel } from "./runtime/banner"

const variants = new Set([
  "shadcnui-blocks.banner-01",
  "shadcnui-blocks.banner-02",
  "shadcnui-blocks.banner-03",
  "shadcnui-blocks.banner-04",
])

function Close() {
  return <X aria-hidden className="size-3" />
}

function BannerFourCard({ model }: { model: BannerViewModel }) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-xl border bg-muted/70 p-0.75">
      <div className="shadow/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserPlusIcon className="size-5" /></div>
          <div>{model.title ? <p className="font-medium text-sm">{model.title}</p> : null}<p className="text-muted-foreground text-sm">{model.message}</p></div>
        </div>
        <div className="flex items-center gap-2">{model.consent ? <><Button data-consent-action="reject" size="sm" type="button">Weigeren</Button><Button data-consent-action="accept" size="sm" type="button">Accepteren</Button></> : <>{model.dismissible ? <Button data-banner-dismiss size="sm" type="button" variant="ghost">Sluiten</Button> : null}{model.link ? <Button asChild size="sm"><a href={model.link.href}>{model.link.label}</a></Button> : null}</>}</div>
      </div>
    </div>
  )
}

function BannerThreeCard({ model }: { model: BannerViewModel }) {
  return (
    <div className="relative mx-auto flex min-h-10 w-full max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-4 rounded-lg border bg-background px-4 py-3 text-center text-sm shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/13 text-primary"><ChartPie className="size-5" /></div>
        <p>{model.title ? <><strong className="font-medium">{model.title}</strong>{" "}</> : null}<span>{model.message}</span></p>
      </div>
      <div className="flex items-center gap-2">
        {model.consent ? <><Button data-consent-action="reject" size="sm" type="button" variant="outline">Weigeren</Button><Button data-consent-action="accept" size="sm" type="button">Accepteren</Button></> : <>{model.link ? <Button asChild size="sm"><a href={model.link.href}>{model.link.label}<ArrowUpRight /></a></Button> : null}{model.dismissible ? <Button aria-label="Sluiten" className="hover:bg-primary/13 max-sm:absolute max-sm:-top-2.5 max-sm:-right-2.5 max-sm:size-6 max-sm:border max-sm:bg-background max-sm:hover:bg-muted sm:-me-2" data-banner-dismiss size="icon" type="button" variant="ghost"><X /></Button> : null}</>}
      </div>
    </div>
  )
}

function Banner({ model, variant }: { model: BannerViewModel; variant: string }) {
  if (variant === "shadcnui-blocks.banner-01") return (
    <div className="flex min-h-10 flex-wrap items-center justify-center bg-primary px-3 py-2 text-center text-primary-foreground text-sm">
      {model.title ? <strong className="mr-1 font-medium">{model.title}</strong> : null}<span>{model.message}</span>
      {model.link ? <a className="mx-1 underline underline-offset-2" href={model.link.href}>{model.link.label}</a> : null}
    </div>
  )

  if (variant === "shadcnui-blocks.banner-02") return (
    <div className="px-6 py-10"><div className="relative mx-auto flex min-h-10 max-w-lg flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-5 py-4 text-center text-sm">
      <p>{model.title ? <><strong className="font-medium">{model.title}</strong>{" "}</> : null}<span>{model.message}</span></p>
      {model.link ? <Button asChild><a href={model.link.href}>{model.link.label}<ArrowUpRight /></a></Button> : null}
      {model.dismissible ? <Button aria-label="Sluiten" className="absolute -top-2.5 -right-2.5 size-6" data-banner-dismiss size="icon" type="button" variant="outline"><Close /></Button> : null}
    </div></div>
  )

  if (variant === "shadcnui-blocks.banner-03") return <div className="px-6 py-10"><BannerThreeCard model={model} /></div>

  return <div className="px-6 py-10"><BannerFourCard model={model} /></div>
}

export function ShadcnUiBannerView({ variant, settings }: { variant: string; settings: SiteSettings }) {
  if (!variants.has(variant)) throw new Error(`Unresolved provider chrome variant "${variant}" for banner.`)
  const model = adaptBanner(settings)
  if (!model) return null
  const isConsentChrome = variant === "shadcnui-blocks.banner-03" && model.consent
  return (
    <aside
      className={isConsentChrome ? "pointer-events-none fixed inset-x-0 z-50 px-3 sm:px-6" : undefined}
      data-site-chrome="banner"
      data-provider-variant={variant}
      data-provider-token-mode="theme"
      data-siab-cookie-consent={isConsentChrome ? "true" : undefined}
    >
      {isConsentChrome ? <div className="pointer-events-auto"><BannerThreeCard model={model} /></div> : <Banner model={model} variant={variant} />}
    </aside>
  )
}
