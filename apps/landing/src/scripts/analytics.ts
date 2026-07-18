type LandingAnalyticsConfig = {
  projectToken: string
  apiHost: string
  uiHost: string
  consentStorageKey: string
  consentVersion: string
  siteDomain: string
  googleAnalyticsMeasurementId: string
}

type PostHogClient = typeof import("posthog-js").default & {
  clear_opt_in_out_capturing?: () => void
}

const node = document.querySelector<HTMLScriptElement>("#siab-analytics-config")
const config = (() => {
  if (!node?.textContent) return null
  try { return JSON.parse(node.textContent) as LandingAnalyticsConfig } catch { return null }
})()

let started = false
let consentGranted = false
let posthog: PostHogClient | null = null
let recentAction: Record<string, unknown> | null = null
let googleAnalyticsStarted = false

type AnalyticsWindow = Window & {
  dataLayer?: unknown[][]
  gtag?: (...args: unknown[]) => void
}

const analyticsWindow = window as AnalyticsWindow

const environment = () => location.hostname === "localhost" ? "development" : "production"
const referrerType = () => {
  if (!document.referrer) return "direct"
  try {
    const host = new URL(document.referrer).hostname.toLowerCase()
    if (host === location.hostname) return "internal"
    if (/(^|\.)google\.|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)ecosia\.org$/.test(host)) return "search"
    if (/(^|\.)facebook\.com$|(^|\.)instagram\.com$|(^|\.)linkedin\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$/.test(host)) return "social"
    return "external"
  } catch { return "direct" }
}

const baseProperties = () => ({
  schema_version: 1,
  analytics_surface: "site",
  analytics_tier: "consented",
  site_kind: "platform",
  environment: environment(),
  tenant_id: null,
  tenant_slug: null,
  tenant_name: null,
  site_id: "platform:siteinabox",
  site_domain: config?.siteDomain ?? location.hostname,
  page_path: location.pathname,
})

const baselineProperties = () => ({
  schema_version: 1,
  analytics_surface: "site",
  analytics_tier: "baseline",
  site_kind: "platform",
  environment: environment(),
  tenant_id: null,
  tenant_slug: null,
  site_id: "platform:siteinabox",
  site_domain: config?.siteDomain ?? location.hostname,
  page_path: location.pathname,
  $current_url: `${location.origin}${location.pathname}`,
  $host: location.hostname,
  $pathname: location.pathname,
  referrer_type: referrerType(),
  $geoip_disable: true,
  $process_person_profile: false,
})

const baselineSdkKeys = new Set([
  "token", "distinct_id", "$device_id", "$cookieless_mode", "$lib", "$lib_version",
  "$time", "$insert_id", "$is_identified", "$browser", "$os", "$device_type",
])

const minimizedBaselineProperties = (properties: Record<string, unknown>, webVitals: boolean) => {
  const minimized: Record<string, unknown> = { ...baselineProperties() }
  for (const [key, value] of Object.entries(properties)) {
    if (baselineSdkKeys.has(key) || (webVitals && key.startsWith("$web_vitals_"))) minimized[key] = value
  }
  if (webVitals) minimized.siab_web_vitals = true
  return minimized
}

const targetProperties = (anchor: HTMLAnchorElement | null) => {
  if (!anchor) return { target_type: "unknown", target_domain: null, target_path: null }
  const href = anchor.getAttribute("href") || ""
  if (href.startsWith("tel:")) return { target_type: "phone", target_domain: null, target_path: null }
  if (href.startsWith("mailto:")) return { target_type: "email", target_domain: null, target_path: null }
  if (href.startsWith("/") || href.startsWith("#")) return { target_type: "internal", target_domain: null, target_path: href.split("?")[0] }
  try {
    const url = new URL(href, location.href)
    return {
      target_type: url.hostname.includes("wa.me") || url.hostname.includes("whatsapp") ? "whatsapp" : "external",
      target_domain: url.hostname,
      target_path: url.pathname,
    }
  } catch {
    return { target_type: "unknown", target_domain: null, target_path: null }
  }
}

const activateConsented = (instance: PostHogClient) => {
  instance.opt_in_capturing({ captureEventName: false })
  instance.register(baseProperties())
}

const googleAnalyticsCookieNames = () => {
  const measurementId = config?.googleAnalyticsMeasurementId ?? ""
  return ["_ga", `_ga_${measurementId.replace(/^G-/, "").replaceAll("-", "_")}`]
}

const clearGoogleAnalyticsCookies = () => {
  const domains = ["", location.hostname, `.${location.hostname.replace(/^www\./, "")}`]
  for (const name of googleAnalyticsCookieNames()) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ""} SameSite=Lax`
    }
  }
}

const disableGoogleAnalytics = () => {
  analyticsWindow.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
  clearGoogleAnalyticsCookies()
}

const initializeGoogleAnalytics = () => {
  const measurementId = config?.googleAnalyticsMeasurementId
  if (googleAnalyticsStarted || !measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) return
  googleAnalyticsStarted = true

  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? []
  analyticsWindow.gtag = analyticsWindow.gtag ?? ((...args: unknown[]) => analyticsWindow.dataLayer?.push(args))
  analyticsWindow.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
  analyticsWindow.gtag("js", new Date())
  analyticsWindow.gtag("config", measurementId, {
    send_page_view: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  })

  const script = document.createElement("script")
  script.id = "siab-google-analytics"
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  script.onerror = () => {
    googleAnalyticsStarted = false
    script.remove()
  }
  document.head.append(script)
}

const initialize = async () => {
  if (!config || started) return
  started = true
  try {
    const module = await import("posthog-js")
    posthog = module.default as PostHogClient
  } catch {
    started = false
    return
  }
  posthog.init(config.projectToken, {
    api_host: config.apiHost,
    ui_host: config.uiHost,
    defaults: "2026-01-30",
    capture_pageview: true,
    capture_pageleave: true,
    disable_scroll_properties: false,
    capture_performance: {
      web_vitals: true,
      web_vitals_allowed_metrics: ["CLS", "FCP", "INP", "LCP"],
      web_vitals_attribution: true,
    },
    cookieless_mode: "on_reject",
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    person_profiles: "identified_only",
    disable_session_recording: true,
    enable_recording_console_log: false,
    enable_heatmaps: false,
    disable_surveys: true,
    autocapture: {
      dom_event_allowlist: ["click", "submit"],
      element_allowlist: ["a", "button", "form"],
      element_attribute_ignorelist: ["value", "placeholder", "name", "aria-label", "title"],
      capture_copied_text: false,
    },
    before_send(event) {
      if (!event) return null
      const allowed = ["$pageview", "$pageleave", "$autocapture", "$web_vitals", "site_conversion_completed"]
      if (!allowed.includes(event.event)) return null
      const properties = event.properties ?? {}
      if (!consentGranted) {
        const webVitals = event.event === "$web_vitals"
        if (event.event !== "$pageview" && !webVitals) return null
        return { ...event, properties: minimizedBaselineProperties(properties, webVitals) }
      }
      delete properties.$el_text
      delete properties.$element_text
      delete properties.$elements
      delete properties.$elements_chain
      return {
        ...event,
        properties: {
          ...properties,
          ...baseProperties(),
          ...(event.event === "$autocapture" ? recentAction ?? {} : {}),
          ...(event.event === "$autocapture" ? { siab_autocapture: true } : {}),
        },
      }
    },
    loaded(instance) {
      if (consentGranted) activateConsented(instance as PostHogClient)
    },
  })
}

const receipt = () => {
  if (!config) return null
  try {
    const value = localStorage.getItem(config.consentStorageKey)
    if (!value) return null
    const parsed = JSON.parse(value) as { version?: unknown; categories?: { analytics?: unknown } }
    if (parsed.version !== config.consentVersion) return null
    return typeof parsed.categories?.analytics === "boolean" ? parsed.categories.analytics : null
  } catch { return null }
}

document.addEventListener("click", (event) => {
  const element = event.target instanceof Element ? event.target : null
  const consent = element?.closest<HTMLButtonElement>("[data-consent-action]")
  if (consent && config) {
    const accepted = consent.dataset.consentAction === "accept"
    localStorage.setItem(config.consentStorageKey, JSON.stringify({
      version: config.consentVersion,
      categories: { necessary: true, analytics: accepted },
    }))
    document.querySelector<HTMLElement>("[data-siab-cookie-consent]")?.setAttribute("hidden", "")
    if (accepted) {
      consentGranted = true
      initializeGoogleAnalytics()
      if (posthog) activateConsented(posthog)
      else void initialize()
    } else if (consentGranted && posthog) {
      consentGranted = false
      disableGoogleAnalytics()
      posthog.opt_out_capturing()
      posthog.clear_opt_in_out_capturing?.()
    } else {
      consentGranted = false
      disableGoogleAnalytics()
    }
    return
  }

  const anchor = element?.closest<HTMLAnchorElement>("a") ?? null
  if (!anchor) return
  const target = targetProperties(anchor)
  recentAction = {
    action_role: anchor.closest("nav") ? "nav" : anchor.closest("footer") ? "footer" : "unknown",
    action_label: (anchor.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) || null,
    component_type: anchor.closest("section")?.id || "link",
    component_role: anchor.closest("nav") ? "nav" : anchor.closest("footer") ? "footer" : "link",
    interaction_type: "click",
    siab_click_kind: ["phone", "email", "whatsapp"].includes(String(target.target_type)) ? "contact" : "cta",
    ...target,
  }
  window.setTimeout(() => { recentAction = null }, 0)
  if (consentGranted && ["phone", "email", "whatsapp"].includes(String(target.target_type))) {
    posthog?.capture("site_conversion_completed", {
      ...baseProperties(),
      ...recentAction,
      conversion_source: "contact_click",
    })
  }
}, true)

consentGranted = receipt() === true
if (receipt() !== null) document.querySelector<HTMLElement>("[data-siab-cookie-consent]")?.setAttribute("hidden", "")
if (consentGranted) initializeGoogleAnalytics()
void initialize()
