import type { SiteConsent, SiteSettings } from "@siteinabox/contracts"
import { resolveMedia, type MediaResolver } from "../media"

type Consent01Props = {
  consent: SiteConsent
  settings: SiteSettings
  mediaResolver?: MediaResolver
}

const hasDutchLanguage = (language: string) => language.toLowerCase().startsWith("nl")

const copyFor = (settings: SiteSettings) => {
  const dutch = hasDutchLanguage(settings.language)
  return {
    title: dutch ? "We gebruiken cookies" : "We use cookies",
    message: dutch
      ? "We gebruiken noodzakelijke cookies om de website goed te laten werken. Met je toestemming kunnen we ook voorkeuren onthouden, statistieken verzamelen en marketingdiensten gebruiken wanneer die zijn ingeschakeld."
      : "We use necessary cookies to keep this website working. With your permission, we can also remember preferences, measure site use, and use marketing services when they are enabled.",
    accept: dutch ? "Alles toestaan" : "Allow all",
    selection: dutch ? "Selectie toestaan" : "Allow selection",
    reject: dutch ? "Weigeren" : "Reject all",
    necessary: dutch ? "Noodzakelijk" : "Necessary",
    preferences: dutch ? "Voorkeuren" : "Preferences",
    statistics: dutch ? "Statistieken" : "Statistics",
    marketing: dutch ? "Marketing" : "Marketing",
    privacy: dutch ? "Lees privacy- en cookieverklaring" : "Read privacy and cookie policy",
  }
}

function ConsentSwitch({
  id,
  label,
  checked,
  disabled = false,
  category,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  category: "necessary" | "preferences" | "analytics" | "marketing"
}) {
  return (
    <div className="site-consent-switch">
      <label className="site-consent-switch-label" htmlFor={id}>{label}</label>
      <label className="site-consent-switch-control" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          role="switch"
          defaultChecked={checked}
          disabled={disabled}
          data-siab-consent-category={category}
        />
        <span className="site-consent-switch-track" aria-hidden="true">
          <span className="site-consent-switch-thumb" />
        </span>
      </label>
    </div>
  )
}

export function Consent01({ consent, settings, mediaResolver }: Consent01Props) {
  const copy = copyFor(settings)
  const title = consent.title?.trim() || copy.title
  const message = consent.message?.trim() || copy.message
  const media = resolveMedia(settings.branding?.logo ?? null, mediaResolver)
  const privacyHref = consent.privacyLink?.href?.trim()
  const privacyLabel = consent.privacyLink?.label?.trim() || copy.privacy
  const headingId = "siab-cookie-consent-title"
  const descriptionId = "siab-cookie-consent-description"

  return (
    <aside
      id="siab-cookie-consent"
      className="site-consent-banner"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      data-siab-cookie-consent="true"
    >
      <div className="site-consent-01-inner">
        <div className="site-consent-01-brand">
          {media ? (
            <img src={media.src} alt={media.alt ?? settings.siteName} className="site-consent-01-logo" />
          ) : (
            <span className="site-consent-01-wordmark">{settings.siteName}</span>
          )}
        </div>

        <div className="site-consent-01-content">
          <h2 id={headingId} className="site-consent-01-title">{title}</h2>
          <p id={descriptionId} className="site-consent-01-message">
            {message}{privacyHref ? <> {" "}<a href={privacyHref} {...(consent.privacyLink?.external ? { target: "_blank", rel: "noreferrer" } : {})}>{privacyLabel}</a>.</> : null}
          </p>
          <fieldset className="site-consent-01-preferences" aria-labelledby={headingId}>
            <ConsentSwitch
              id="siab-cookie-consent-necessary"
              label={consent.necessaryLabel?.trim() || copy.necessary}
              checked
              disabled
              category="necessary"
            />
            <ConsentSwitch
              id="siab-cookie-consent-preferences"
              label={consent.preferencesLabel?.trim() || copy.preferences}
              checked={false}
              category="preferences"
            />
            <ConsentSwitch
              id="siab-cookie-consent-statistics"
              label={consent.statisticsLabel?.trim() || copy.statistics}
              checked={false}
              category="analytics"
            />
            <ConsentSwitch
              id="siab-cookie-consent-marketing"
              label={consent.marketingLabel?.trim() || copy.marketing}
              checked={false}
              category="marketing"
            />
          </fieldset>
        </div>

        <div className="site-consent-01-actions" data-siab-consent-actions="true">
          <button type="button" className="site-consent-button site-consent-button-primary" data-siab-consent-action="all">
            {consent.acceptLabel?.trim() || copy.accept}
          </button>
          <button type="button" className="site-consent-button site-consent-button-selection" data-siab-consent-action="selection">
            {consent.allowSelectionLabel?.trim() || copy.selection}
          </button>
          <button type="button" className="site-consent-button site-consent-button-secondary" data-siab-consent-action="reject">
            {consent.rejectLabel?.trim() || copy.reject}
          </button>
        </div>
      </div>
    </aside>
  )
}
