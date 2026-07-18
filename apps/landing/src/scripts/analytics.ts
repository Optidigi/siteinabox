type LandingAnalyticsConfig = {
  projectToken: string
  apiHost: string
  uiHost: string
  consentStorageKey: string
  consentVersion: string
  siteDomain: string
}

const node = document.querySelector<HTMLScriptElement>("#siab-analytics-config")
const config = (() => {
  if (!node?.textContent) return null
  try { return JSON.parse(node.textContent) as LandingAnalyticsConfig } catch { return null }
})()

let started = false
let posthog: typeof import("posthog-js").default | null = null
let recentAction: Record<string, unknown> | null = null

const baseProperties = () => ({
  schema_version: 1,
  analytics_surface: "site",
  site_kind: "platform",
  environment: location.hostname === "localhost" ? "development" : "production",
  tenant_id: null,
  tenant_slug: null,
  tenant_name: null,
  site_id: "platform:siteinabox",
  site_domain: config?.siteDomain ?? location.hostname,
  page_path: location.pathname,
})

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

const initialize = async () => {
  if (!config || started) return
  started = true
  try {
    const module = await import("posthog-js")
    posthog = module.default
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
    opt_out_capturing_by_default: true,
    disable_scroll_properties: false,
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
      if (!event || !["$pageview", "$pageleave", "$autocapture", "$web_vitals", "site_conversion_completed"].includes(event.event)) return null
      const properties = event.properties ?? {}
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
      instance.register(baseProperties())
      instance.opt_in_capturing({ captureEventName: false })
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
    if (accepted) void initialize()
    else {
      posthog?.opt_out_capturing()
      posthog?.reset()
      posthog = null
      started = false
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
  if (started && ["phone", "email", "whatsapp"].includes(String(target.target_type))) {
    posthog?.capture("site_conversion_completed", {
      ...baseProperties(),
      ...recentAction,
      conversion_source: "contact_click",
    })
  }
}, true)

if (receipt() === true) void initialize()
if (receipt() !== null) document.querySelector<HTMLElement>("[data-siab-cookie-consent]")?.setAttribute("hidden", "")
