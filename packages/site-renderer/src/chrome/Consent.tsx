import * as React from "react"
import { DEFAULT_CONSENT_VARIANT, type SiteSettings, type SiteConsent } from "@siteinabox/contracts"
import { assertNever } from "../blocks/shared"
import type { MediaResolver } from "../media"
import { Consent01 } from "./Consent01"

export type ConsentRendererProps = {
  settings: SiteSettings
  mediaResolver?: MediaResolver
  consentAvailable?: boolean
}

type ConsentVariantProps = {
  consent: SiteConsent
  settings: SiteSettings
  mediaResolver?: MediaResolver
}

function ConsentVariantView({ consent, settings, mediaResolver }: ConsentVariantProps) {
  switch (consent.variant) {
    case "consent-01":
      return <Consent01 consent={consent} settings={settings} mediaResolver={mediaResolver} />
    default:
      return assertNever(consent.variant)
  }
}

export function ConsentRenderer({ settings, mediaResolver, consentAvailable = false }: ConsentRendererProps) {
  if (!consentAvailable) return null

  // A site with approved optional analytics must always have a usable consent
  // presentation. The CMS group remains the customization point, while an
  // omitted group receives the safe first-party default instead of exposing a
  // consented runtime with no way for a visitor to choose.
  const consent: SiteConsent = settings.consent ?? {
    variant: DEFAULT_CONSENT_VARIANT,
    visible: true,
  }
  if (consent.visible !== true) return null

  return (
    <div
      className="site-consent-frame"
      data-siab-consent-frame="true"
      data-siab-cookie-consent="true"
      data-siab-consent-variant={consent.variant}
    >
      <ConsentVariantView consent={consent} settings={settings} mediaResolver={mediaResolver} />
    </div>
  )
}
