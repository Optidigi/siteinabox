type AnalyticsConfig = {
  enabled?: boolean
  provider?: "posthog"
  consentMode?: "required"
  posthogHost?: string
  posthogUiHost?: string
  posthogProjectToken?: string
  consentStorageKey?: string | null
  consentVersion?: string | null
  schemaVersion?: number
  tenantId?: string | null
  tenantSlug?: string | null
  tenantName?: string | null
  siteKind?: "platform" | "tenant"
  siteId?: string | null
  siteDomain?: string | null
  pageId?: string | null
  pageSlug?: string | null
  pagePath?: string | null
  themeId?: string | null
  siteBuildId?: string | null
  manifestVersion?: string | number | null
  conversionGoals?: {
    acceptedForms?: true
    contactClicks?: Array<"phone" | "email" | "whatsapp">
  }
}

export {}

type PostHogClient = {
  init: (token: string, config: Record<string, unknown>, name?: string) => void
  register: (properties: Record<string, unknown>) => void
  capture?: (event: string, properties?: Record<string, unknown>) => void
  group?: (groupType: string, groupKey: string, properties?: Record<string, unknown>) => void
  opt_in_capturing?: (options?: { captureEventName?: string | false | null }) => void
  opt_out_capturing?: () => void
  clear_opt_in_out_capturing?: () => void
  reset?: () => void
}

type RuntimeState = {
  consentGranted: boolean
  initialized: boolean
  posthogStarted: boolean
  posthog: PostHogClient | null
  lastAutocaptureAction: AutocaptureActionSnapshot | null
  config: AnalyticsConfig | null
  pageStartedAt: number
  maxScrollDepth: number
  capturedScrollDepths: Set<number>
  journeyStepIndex: number
  viewedSections: WeakSet<Element>
  engagedSections: WeakSet<Element>
  sectionVisibleSince: WeakMap<Element, number>
  viewedComponents: WeakSet<Element>
  componentStats: WeakMap<Element, ComponentStats>
  startedForms: WeakSet<HTMLFormElement>
}

type ComponentStats = {
  views: number
  firstVisibleAt: number | null
  visibleSince: number | null
  visibleMs: number
  hoverStartedAt: number | null
  hoverMs: number
}

type AutocaptureActionSnapshot = {
  at: number
  eventType: "click" | "submit" | "change"
  properties: Record<string, unknown>
}

declare global {
  interface Window {
    SIABAnalytics?: {
      grantConsent: () => void
      revokeConsent: () => void
    }
  }
}

const state: RuntimeState = {
  consentGranted: false,
  initialized: false,
  posthogStarted: false,
  posthog: null,
  lastAutocaptureAction: null,
  config: null,
  pageStartedAt: performance.now(),
  maxScrollDepth: 0,
  capturedScrollDepths: new Set(),
  journeyStepIndex: 0,
  viewedSections: new WeakSet(),
  engagedSections: new WeakSet(),
  sectionVisibleSince: new WeakMap(),
  viewedComponents: new WeakSet(),
  componentStats: new WeakMap(),
  startedForms: new WeakSet(),
}

const legacyCookieConsentStorageKey = "siab_cookie_consent_v1"
const POSTHOG_TENANT_GROUP_TYPE = "tenant"

const readConfig = (): AnalyticsConfig | null => {
  const node = document.getElementById("siab-analytics-config")
  if (!node?.textContent) return null
  try {
    return JSON.parse(node.textContent) as AnalyticsConfig
  } catch {
    return null
  }
}

const baseProperties = () => {
  const config = state.config
  return {
    schema_version: 1,
    analytics_surface: "site",
    analytics_tier: "consented",
    site_kind: config?.siteKind ?? (config?.tenantId ? "tenant" : "platform"),
    environment: location.hostname === "localhost" ? "development" : "production",
    tenant_id: config?.tenantId ?? null,
    tenant_slug: config?.tenantSlug ?? null,
    tenant_name: config?.tenantName ?? null,
    site_id: config?.siteId ?? config?.tenantId ?? null,
    site_domain: config?.siteDomain ?? location.hostname,
    page_id: config?.pageId ?? null,
    page_slug: config?.pageSlug ?? null,
    page_path: config?.pagePath ?? `${location.pathname}${location.hash}`,
    theme_id: config?.themeId ?? null,
    site_build_id: config?.siteBuildId ?? null,
    manifest_version: config?.manifestVersion ?? null,
    $current_url: location.href,
    $host: location.hostname,
    $pathname: location.pathname,
    $referrer: document.referrer || null,
    ...browserProperties(),
    ...trafficProperties(),
    ...campaignProperties(),
    ...(config?.tenantId ? { $groups: { [POSTHOG_TENANT_GROUP_TYPE]: config.tenantId } } : {}),
  }
}

const baselineProperties = () => {
  const config = state.config
  return {
    schema_version: 1,
    analytics_surface: "site",
    analytics_tier: "baseline",
    site_kind: config?.siteKind ?? (config?.tenantId ? "tenant" : "platform"),
    environment: location.hostname === "localhost" ? "development" : "production",
    tenant_id: config?.tenantId ?? null,
    tenant_slug: config?.tenantSlug ?? null,
    site_id: config?.siteId ?? config?.tenantId ?? null,
    site_domain: config?.siteDomain ?? location.hostname,
    page_id: config?.pageId ?? null,
    page_slug: config?.pageSlug ?? null,
    page_path: location.pathname,
    theme_id: config?.themeId ?? null,
    site_build_id: config?.siteBuildId ?? null,
    manifest_version: config?.manifestVersion ?? null,
    $current_url: `${location.origin}${location.pathname}`,
    $host: location.hostname,
    $pathname: location.pathname,
    $browser: browserProperties().$browser,
    $os: browserProperties().$os,
    $device_type: deviceType(),
    referrer_type: trafficProperties().referrer_type,
    $geoip_disable: true,
    $process_person_profile: false,
  }
}

const baselineSdkKeys = new Set([
  "token",
  "distinct_id",
  "$device_id",
  "$cookieless_mode",
  "$lib",
  "$lib_version",
  "$time",
  "$insert_id",
  "$is_identified",
])

const minimizedBaselineProperties = (properties: Record<string, unknown>, isWebVitals: boolean) => {
  const minimized: Record<string, unknown> = { ...baselineProperties() }
  for (const [key, value] of Object.entries(properties)) {
    if (baselineSdkKeys.has(key) || (isWebVitals && key.startsWith("$web_vitals_"))) minimized[key] = value
  }
  if (isWebVitals) minimized.siab_web_vitals = true
  return minimized
}

const consentedSemanticEvents = new Set([
  "site_section_viewed",
  "site_section_engaged",
  "site_component_viewed",
  "site_scroll_depth_reached",
  "site_journey_step",
  "site_form_started",
  "site_form_submitted",
  "site_conversion_completed",
])

const sanitizeAutocaptureEvent = (event: Record<string, unknown> | null | undefined) => {
  if (!event || typeof event !== "object") return null
  const eventName = typeof event.event === "string" ? event.event : ""
  if (!["$autocapture", "$rageclick", "$dead_click", "$web_vitals", "$pageview", "$pageleave", "$groupidentify"].includes(eventName) && !consentedSemanticEvents.has(eventName)) return null

  const props = typeof event.properties === "object" && event.properties ? event.properties as Record<string, unknown> : {}
  const isWebVitals = eventName === "$web_vitals"
  if (!state.consentGranted) {
    if (eventName !== "$pageview" && !isWebVitals) return null
    return { ...event, properties: minimizedBaselineProperties(props, isWebVitals) }
  }
  const isNativeInteraction = ["$autocapture", "$rageclick", "$dead_click"].includes(eventName)
  const snapshot = isNativeInteraction && state.lastAutocaptureAction && performance.now() - state.lastAutocaptureAction.at < 2000
    ? state.lastAutocaptureAction
    : null

  delete props.$el_text
  delete props.$element_text
  delete props.$elements
  delete props.$elements_chain

  return {
    ...event,
    properties: {
      ...props,
      ...baseProperties(),
      ...(isNativeInteraction ? snapshot?.properties : {}),
      ...(eventName === "$pageleave" ? {
        page_duration_ms: Math.max(0, Math.round(performance.now() - state.pageStartedAt)),
        scroll_depth: Math.max(state.maxScrollDepth, scrollDepth()),
        interaction_type: "leave",
      } : {}),
      ...(isWebVitals ? { siab_web_vitals: true } : {}),
      ...(isNativeInteraction ? { siab_autocapture: true } : {}),
    },
  }
}

const afterIdle = (callback: () => void) => {
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout?: number }) => number }).requestIdleCallback
  if (idle) {
    idle(callback, { timeout: 2500 })
    return
  }
  window.setTimeout(callback, 750)
}

const setupPostHogAutocapture = () => {
  if (state.posthogStarted) return
  const config = state.config
  if (!config?.enabled || !config.posthogProjectToken || !config.posthogHost) return
  state.posthogStarted = true

  afterIdle(() => {
    void import("posthog-js").then((module) => {
      const posthog = (module.default ?? module) as unknown as PostHogClient
      state.posthog = posthog
      posthog.init(config.posthogProjectToken!, {
        api_host: config.posthogHost,
        ui_host: config.posthogUiHost,
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
          dom_event_allowlist: ["click", "submit", "change"],
          element_allowlist: ["a", "button", "form", "input", "select", "textarea", "label"],
          element_attribute_ignorelist: ["value", "placeholder", "name", "aria-label", "title"],
          capture_copied_text: false,
        },
        capture_dead_clicks: {
          element_attribute_ignorelist: ["value", "placeholder", "name", "aria-label", "title"],
        },
        before_send: sanitizeAutocaptureEvent,
        loaded(instance: PostHogClient) {
          if (state.consentGranted) activateConsentedPostHog(instance)
        },
      })
    }).catch(() => {
      state.posthogStarted = false
      state.posthog = null
    })
  })
}

const activateConsentedPostHog = (instance: PostHogClient) => {
  instance.opt_in_capturing?.({ captureEventName: false })
  instance.register(baseProperties())
  const config = state.config
  if (config?.tenantId) {
    instance.group?.(POSTHOG_TENANT_GROUP_TYPE, config.tenantId, {
      name: config.tenantName ?? config.tenantSlug ?? config.tenantId,
      slug: config.tenantSlug ?? undefined,
      domain: config.siteDomain ?? location.hostname,
      site_kind: "tenant",
    })
  }
  initializeAfterConsent()
}

const deviceType = () => {
  if (window.matchMedia("(pointer: coarse) and (max-width: 767px)").matches) return "mobile"
  if (window.matchMedia("(pointer: coarse) and (max-width: 1024px)").matches) return "tablet"
  return "desktop"
}

const browserProperties = () => {
  const ua = navigator.userAgent
  const browserMatch =
    ua.match(/Edg\/([\d.]+)/) ? ["Edge", ua.match(/Edg\/([\d.]+)/)?.[1]] :
    ua.match(/Chrome\/([\d.]+)/) && !ua.match(/Chromium/) ? ["Chrome", ua.match(/Chrome\/([\d.]+)/)?.[1]] :
    ua.match(/Firefox\/([\d.]+)/) ? ["Firefox", ua.match(/Firefox\/([\d.]+)/)?.[1]] :
    ua.match(/Version\/([\d.]+).*Safari/) ? ["Safari", ua.match(/Version\/([\d.]+).*Safari/)?.[1]] :
    ua.match(/OPR\/([\d.]+)/) ? ["Opera", ua.match(/OPR\/([\d.]+)/)?.[1]] :
    [null, null]
  const osMatch =
    ua.match(/Windows NT ([\d.]+)/) ? ["Windows", ua.match(/Windows NT ([\d.]+)/)?.[1]] :
    ua.match(/Android ([\d.]+)/) ? ["Android", ua.match(/Android ([\d.]+)/)?.[1]] :
    ua.match(/iPhone OS ([\d_]+)/) ? ["iOS", ua.match(/iPhone OS ([\d_]+)/)?.[1]?.replace(/_/g, ".")] :
    ua.match(/iPad.*OS ([\d_]+)/) ? ["iPadOS", ua.match(/iPad.*OS ([\d_]+)/)?.[1]?.replace(/_/g, ".")] :
    ua.match(/Mac OS X ([\d_]+)/) ? ["macOS", ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replace(/_/g, ".")] :
    ua.match(/Linux/) ? ["Linux", null] :
    [null, null]

  return {
    $browser: browserMatch[0],
    $browser_version: browserMatch[1],
    $os: osMatch[0],
    $os_version: osMatch[1],
    $device_type: deviceType(),
    // siab-responsive-ignore-next-line
    $viewport_width: window.innerWidth,
    // siab-responsive-ignore-next-line
    $viewport_height: window.innerHeight,
    screen_width: window.screen?.width ?? null,
    screen_height: window.screen?.height ?? null,
    browser_language: navigator.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    connection_effective_type: (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null,
  }
}

const referrerType = (domain: string | null) => {
  if (!domain) return "direct"
  if (domain === location.hostname) return "internal"
  const host = domain.toLowerCase()
  if (/(^|\.)google\.|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)ecosia\.org$/.test(host)) return "search"
  if (/(^|\.)facebook\.com$|(^|\.)instagram\.com$|(^|\.)linkedin\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$/.test(host)) return "social"
  return "external"
}

const trafficProperties = () => {
  let referrerDomain: string | null = null
  if (document.referrer) {
    try {
      referrerDomain = new URL(document.referrer).hostname
    } catch {
      referrerDomain = null
    }
  }
  return {
    referrer_domain: referrerDomain,
    $referring_domain: referrerDomain,
    referrer_type: referrerType(referrerDomain),
    device_type: deviceType(),
  }
}

const campaignProperties = () => {
  const params = new URLSearchParams(location.search)
  const get = (key: string) => params.get(key) || null
  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_term: get("utm_term"),
    utm_content: get("utm_content"),
    gclid: get("gclid"),
    fbclid: get("fbclid"),
    msclkid: get("msclkid"),
  }
}

const safeReferrerPath = () => {
  if (!document.referrer) return null
  try {
    const url = new URL(document.referrer)
    if (url.hostname === location.hostname) return url.pathname
    return url.hostname
  } catch {
    return null
  }
}

const sectionProperties = (section: Element) => ({
  section_id: section.getAttribute("data-siab-section-id") || null,
  section_type: section.getAttribute("data-siab-section-type") || "unknown",
  section_position: Number(section.getAttribute("data-siab-section-position") || 0),
  section_anchor: section.getAttribute("data-siab-section-anchor") || null,
  provider_variant: section.getAttribute("data-siab-provider-variant") || null,
  block_preset_id: section.getAttribute("data-siab-block-preset-id") || null,
  content_signature: section.getAttribute("data-siab-content-signature") || null,
})

const targetMetadata = (href: string | null) => {
  if (!href) return { target_type: "unknown", target_domain: null, target_path: null }
  if (href.startsWith("tel:")) return { target_type: "phone", target_domain: null, target_path: null }
  if (href.startsWith("mailto:")) return { target_type: "email", target_domain: null, target_path: null }
  if (href.startsWith("#") || href.startsWith("/")) {
    return { target_type: "internal", target_domain: null, target_path: href.split("?")[0] ?? href }
  }
  try {
    const url = new URL(href)
    const type = url.hostname.includes("wa.me") || url.hostname.includes("whatsapp") ? "whatsapp" : "external"
    return { target_type: type, target_domain: url.hostname, target_path: url.pathname }
  } catch {
    return { target_type: "unknown", target_domain: null, target_path: null }
  }
}

const capture = (event: string, properties: Record<string, unknown> = {}) => {
  const config = state.config
  if (!state.consentGranted || !config?.enabled || !config.posthogProjectToken || !config.posthogHost) return

  state.posthog?.capture?.(event, { ...baseProperties(), ...properties })
}

const captureJourneyStep = (step: string, properties: Record<string, unknown> = {}) => {
  state.journeyStepIndex += 1
  capture("site_journey_step", {
    journey_step_index: state.journeyStepIndex,
    journey_step: step,
    journey_from: safeReferrerPath(),
    ...properties,
  })
}

const closestSection = (target: EventTarget | null) =>
  target instanceof Element ? target.closest("[data-siab-analytics-section='true']") : null

const captureSectionEngaged = (section: Element) => {
  if (state.engagedSections.has(section)) return
  state.engagedSections.add(section)
  capture("site_section_engaged", sectionProperties(section))
}

const observeSections = () => {
  const sections = Array.from(document.querySelectorAll("[data-siab-analytics-section='true']"))
  if (!sections.length) return

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const section = entry.target
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!state.sectionVisibleSince.has(section)) state.sectionVisibleSince.set(section, performance.now())
        if (!state.viewedSections.has(section)) {
          window.setTimeout(() => {
            const visibleSince = state.sectionVisibleSince.get(section)
            if (!visibleSince || performance.now() - visibleSince < 500 || state.viewedSections.has(section)) return
            state.viewedSections.add(section)
            capture("site_section_viewed", sectionProperties(section))
          }, 500)
        }
        window.setTimeout(() => {
          const visibleSince = state.sectionVisibleSince.get(section)
          if (!visibleSince || performance.now() - visibleSince < 3000) return
          captureSectionEngaged(section)
        }, 3000)
      } else {
        state.sectionVisibleSince.delete(section)
      }
    }
  }, { threshold: [0, 0.5] })

  for (const section of sections) observer.observe(section)
}

const actionRole = (element: Element) =>
  element.getAttribute("data-siab-action-role") || "unknown"

const actionLabel = (element: Element) =>
  element.getAttribute("data-siab-action-label") || element.textContent?.trim().slice(0, 120) || null

const componentRole = (element: Element) => {
  if (element.closest("header")) return "header"
  if (element.closest("footer")) return "footer"
  if (element.closest("nav")) return "nav"
  return element.getAttribute("data-siab-action-role") || "unknown"
}

const trackedAction = (target: EventTarget | null) =>
  target instanceof Element ? target.closest<HTMLAnchorElement | HTMLButtonElement>("a,button") : null

const actionKey = (
  action: HTMLAnchorElement | HTMLButtonElement,
  section: Element | null,
  targetMeta: ReturnType<typeof targetMetadata>,
) => [
  section?.getAttribute("data-siab-section-id") || "global",
  componentRole(action),
  actionRole(action),
  action.id || "",
  actionLabel(action) || "",
  targetMeta.target_type,
  targetMeta.target_domain || "",
  targetMeta.target_path || "",
].join("|")

const clickKind = (
  action: HTMLAnchorElement | HTMLButtonElement,
  targetMeta: ReturnType<typeof targetMetadata>,
) => {
  if (["phone", "email", "whatsapp"].includes(targetMeta.target_type)) return "contact"
  const role = actionRole(action)
  if (role === "nav" || componentRole(action) === "header" || componentRole(action) === "footer" || componentRole(action) === "nav") {
    return "navigation"
  }
  return "cta"
}

const rememberAutocaptureAction = (
  eventType: AutocaptureActionSnapshot["eventType"],
  action: HTMLAnchorElement | HTMLButtonElement,
  section: Element | null,
  targetMeta: ReturnType<typeof targetMetadata>,
  extra: Record<string, unknown> = {},
) => {
  const timing = componentTimingProperties(action)
  state.lastAutocaptureAction = {
    at: performance.now(),
    eventType,
    properties: {
      ...(section ? sectionProperties(section) : {}),
      action_id: action.id || null,
      action_key: actionKey(action, section, targetMeta),
      action_role: actionRole(action),
      action_label: actionLabel(action),
      component_type: section?.getAttribute("data-siab-section-type") || "link",
      component_role: componentRole(action),
      interaction_type: eventType,
      siab_click_kind: clickKind(action, targetMeta),
      ...timing,
      ...targetMeta,
      ...extra,
    },
  }
}

const componentStats = (action: Element) => {
  let stats = state.componentStats.get(action)
  if (!stats) {
    stats = {
      views: 0,
      firstVisibleAt: null,
      visibleSince: null,
      visibleMs: 0,
      hoverStartedAt: null,
      hoverMs: 0,
    }
    state.componentStats.set(action, stats)
  }
  return stats
}

const componentTimingProperties = (action: HTMLAnchorElement | HTMLButtonElement, now = performance.now()) => {
  const stats = componentStats(action)
  const visibleMs = stats.visibleMs + (stats.visibleSince != null ? Math.max(0, now - stats.visibleSince) : 0)
  const hoverMs = stats.hoverMs + (stats.hoverStartedAt != null ? Math.max(0, now - stats.hoverStartedAt) : 0)

  return {
    component_view_count: stats.views,
    component_viewed_before_interaction: stats.views > 0,
    component_visible_ms_before_interaction: Math.round(visibleMs),
    component_hover_ms_before_interaction: Math.round(hoverMs),
    component_time_to_interaction_ms: stats.firstVisibleAt != null ? Math.round(now - stats.firstVisibleAt) : null,
  }
}

const observeComponents = () => {
  const actions = Array.from(document.querySelectorAll("a,button"))
  if (!actions.length) return

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const action = entry.target as HTMLAnchorElement | HTMLButtonElement
      const stats = componentStats(action)
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        const now = performance.now()
        if (stats.visibleSince == null) stats.visibleSince = now
        if (stats.firstVisibleAt == null) stats.firstVisibleAt = now
        if (!state.viewedComponents.has(action)) {
          window.setTimeout(() => {
            const latest = componentStats(action)
            if (latest.visibleSince == null || performance.now() - latest.visibleSince < 500 || state.viewedComponents.has(action)) return
            const section = closestSection(action)
            const href = action instanceof HTMLAnchorElement ? action.getAttribute("href") : null
            const targetMeta = targetMetadata(href)
            state.viewedComponents.add(action)
            latest.views += 1
            capture("site_component_viewed", {
              ...(section ? sectionProperties(section) : {}),
              action_id: action.id || null,
              action_key: actionKey(action, section, targetMeta),
              action_role: actionRole(action),
              action_label: actionLabel(action),
              component_type: section?.getAttribute("data-siab-section-type") || "link",
              component_role: componentRole(action),
              interaction_type: "view",
              ...targetMeta,
            })
          }, 500)
        }
      } else if (stats.visibleSince != null) {
        stats.visibleMs += Math.max(0, performance.now() - stats.visibleSince)
        stats.visibleSince = null
      }
    }
  }, { threshold: [0, 0.5] })

  for (const action of actions) observer.observe(action)
}

const setupDelegatedListeners = () => {
  document.addEventListener("pointerenter", (event) => {
    if ((event as PointerEvent).pointerType === "touch") return
    const action = trackedAction(event.target)
    if (!action) return
    const stats = componentStats(action)
    if (stats.hoverStartedAt == null) stats.hoverStartedAt = performance.now()
  }, { capture: true })

  document.addEventListener("pointerleave", (event) => {
    if ((event as PointerEvent).pointerType === "touch") return
    const action = trackedAction(event.target)
    if (!action) return
    const stats = componentStats(action)
    if (stats.hoverStartedAt == null) return
    stats.hoverMs += Math.max(0, performance.now() - stats.hoverStartedAt)
    stats.hoverStartedAt = null
  }, { capture: true })

  document.addEventListener("focusin", (event) => {
    const action = trackedAction(event.target)
    if (!action) return
    const stats = componentStats(action)
    if (stats.hoverStartedAt == null) stats.hoverStartedAt = performance.now()
  })

  document.addEventListener("focusout", (event) => {
    const action = trackedAction(event.target)
    if (!action) return
    const stats = componentStats(action)
    if (stats.hoverStartedAt == null) return
    stats.hoverMs += Math.max(0, performance.now() - stats.hoverStartedAt)
    stats.hoverStartedAt = null
  })

  document.addEventListener("click", (event) => {
    const target = event.target
    const action = trackedAction(target)
    const section = closestSection(target)
    if (section) captureSectionEngaged(section)
    if (!action) return

    const href = action instanceof HTMLAnchorElement ? action.getAttribute("href") : null
    const targetMeta = targetMetadata(href)
    rememberAutocaptureAction("click", action, section, targetMeta)
    const properties = {
      ...(section ? sectionProperties(section) : {}),
      action_id: action.id || null,
      action_key: actionKey(action, section, targetMeta),
      action_role: actionRole(action),
      action_label: actionLabel(action),
      ...componentTimingProperties(action),
      ...targetMeta,
    }
    captureJourneyStep("action-clicked", {
      ...(section ? sectionProperties(section) : {}),
      action_label: actionLabel(action),
      target_type: targetMeta.target_type,
      target_domain: targetMeta.target_domain,
      target_path: targetMeta.target_path,
    })

    if (["phone", "email", "whatsapp"].includes(targetMeta.target_type)) {
      const goals = state.config?.conversionGoals?.contactClicks ?? []
      if (goals.includes(targetMeta.target_type as "phone" | "email" | "whatsapp")) {
        capture("site_conversion_completed", { ...properties, conversion_source: "contact_click" })
      }
    }
  }, { capture: true })

  document.addEventListener("focusin", (event) => {
    const form = event.target instanceof Element ? event.target.closest<HTMLFormElement>("form[data-siab-analytics-form='true']") : null
    if (!form || state.startedForms.has(form)) return
    state.startedForms.add(form)
    const section = closestSection(form)
    if (section) captureSectionEngaged(section)
    capture("site_form_started", {
      ...(section ? sectionProperties(section) : {}),
      form_name: form.getAttribute("data-siab-form-name") || form.getAttribute("name") || null,
    })
    captureJourneyStep("form-started", {
      ...(section ? sectionProperties(section) : {}),
      form_name: form.getAttribute("data-siab-form-name") || form.getAttribute("name") || null,
    })
  })

  document.addEventListener("submit", (event) => {
    const form = event.target instanceof Element ? event.target.closest<HTMLFormElement>("form[data-siab-analytics-form='true']") : null
    if (!form) return
    const section = closestSection(form)
    capture("site_form_submitted", {
      ...(section ? sectionProperties(section) : {}),
      form_name: form.getAttribute("data-siab-form-name") || form.getAttribute("name") || null,
    })
    captureJourneyStep("form-submitted", {
      ...(section ? sectionProperties(section) : {}),
      form_name: form.getAttribute("data-siab-form-name") || form.getAttribute("name") || null,
    })
  }, { capture: true })

  document.addEventListener("change", (event) => {
    const field = event.target instanceof Element ? event.target.closest<HTMLElement>("input,select,textarea") : null
    if (!field) return
    const section = closestSection(field)
    const pseudoAction = field.closest("form")?.querySelector("button,[type='submit']") as HTMLAnchorElement | HTMLButtonElement | null
    if (!pseudoAction) return
    rememberAutocaptureAction("change", pseudoAction, section, targetMetadata(null), {
      field_type: field.tagName.toLowerCase(),
    })
  }, { capture: true })
}

const scrollDepth = () => {
  const doc = document.documentElement
  const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight)
  const depth = Math.round(Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)))
  state.maxScrollDepth = Math.max(state.maxScrollDepth, depth)
  return depth
}

const setupScrollDepth = () => {
  const thresholds = [25, 50, 75, 90]
  const onScroll = () => {
    const depth = scrollDepth()
    for (const threshold of thresholds) {
      if (depth >= threshold && !state.capturedScrollDepths.has(threshold)) {
        state.capturedScrollDepths.add(threshold)
        capture("site_scroll_depth_reached", {
          scroll_depth: threshold,
          interaction_type: "view",
        })
      }
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true })
  onScroll()
}

const initializeAfterConsent = () => {
  if (state.initialized) return
  state.initialized = true
  captureJourneyStep("page-viewed")
  observeSections()
  observeComponents()
  setupDelegatedListeners()
  setupScrollDepth()
}

state.config = readConfig()

window.SIABAnalytics = {
  grantConsent() {
    if (state.consentGranted) return
    state.consentGranted = true
    if (state.posthog) activateConsentedPostHog(state.posthog)
    else setupPostHogAutocapture()
  },
  revokeConsent() {
    const wasGranted = state.consentGranted
    state.consentGranted = false
    if (wasGranted && state.posthog) {
      state.posthog.opt_out_capturing?.()
      state.posthog.clear_opt_in_out_capturing?.()
    }
    window.localStorage.removeItem("siab_analytics_distinct_id")
    window.sessionStorage.removeItem("siab_analytics_session_id")
  },
}

const storedConsent = (() => {
  const storageKey = state.config?.consentStorageKey || legacyCookieConsentStorageKey
  try {
    const stored = (
      window.localStorage.getItem(storageKey) ??
      window.localStorage.getItem(legacyCookieConsentStorageKey) ??
      window.localStorage.getItem("siab-analytics-consent")
    )
    if (!stored) return null
    if (stored === "accepted" || stored === "declined") {
      return state.config?.consentVersion ? null : stored
    }
    const receipt = JSON.parse(stored) as {
      version?: unknown
      categories?: { analytics?: unknown }
    }
    if (String(receipt.version ?? "") !== String(state.config?.consentVersion ?? "1")) return null
    return receipt.categories?.analytics === true ? "accepted" : "declined"
  } catch {
    return null
  }
})()

state.consentGranted = storedConsent === "accepted"
setupPostHogAutocapture()
