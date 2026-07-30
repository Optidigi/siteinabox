import {
  LANDING_EVENT_NAMES,
  type LandingAnalyticsDetail,
  type LandingEventCapture,
  type LandingEventName,
  type LandingEventValue,
} from '../../lib/landing-analytics';

export type LandingAnalyticsConfig = {
  projectToken: string;
  apiHost: string;
  uiHost: string;
  consentStorageKey: string;
  consentVersion: string;
  siteDomain: string;
  googleAnalyticsMeasurementId: string;
};

type PostHogClient = typeof import('posthog-js').default & {
  clear_opt_in_out_capturing?: () => void;
};

type AnalyticsWindow = Window & {
  dataLayer?: Array<IArguments | Record<string, unknown>>;
  gtag?: (...args: unknown[]) => void;
};

export type LandingAnalyticsRuntime = {
  capture: LandingEventCapture;
  captureDetail: (detail: LandingAnalyticsDetail) => void;
  hasConsent: () => boolean;
  initialize: () => Promise<void>;
  setConsent: (accepted: boolean) => void;
  setRecentAction: (properties: Record<string, LandingEventValue> | null) => void;
};

const semanticEventNames = new Set<string>(LANDING_EVENT_NAMES);
const googleKeyEventByConversionSource = {
  contact_form: 'generate_lead',
  contact_click: 'direct_contact_clicked',
  intake_handoff: 'intake_started',
} as const;
const semanticPropertyKeys = new Set([
  'section_id', 'section_position', 'component_id', 'component_type', 'component_role',
  'action_key', 'action_role', 'action_placement', 'destination_type', 'billing_period',
  'item_id', 'item_index', 'journey_name', 'journey_step', 'journey_position',
  'form_id', 'form_type', 'form_state', 'conversion_source', 'error_category',
  'interaction_type', 'scroll_depth', 'viewport_bucket', 'theme', 'content_version',
  'target_type', 'target_domain', 'target_path',
]);

const baselineSdkKeys = new Set([
  'token', 'distinct_id', '$device_id', '$cookieless_mode', '$lib', '$lib_version',
  '$time', '$insert_id', '$is_identified', '$browser', '$os', '$device_type',
]);

const isDevelopmentHost = (hostname: string) =>
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '::1'
  || hostname.endsWith('.test');

const viewportBucket = () => {
  if (window.innerWidth < 640) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
};

const theme = () =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

const referrerType = () => {
  if (!document.referrer) return 'direct';
  try {
    const host = new URL(document.referrer).hostname.toLowerCase();
    if (host === location.hostname) return 'internal';
    if (/(^|\.)google\.|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)ecosia\.org$/.test(host)) return 'search';
    if (/(^|\.)facebook\.com$|(^|\.)instagram\.com$|(^|\.)linkedin\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$/.test(host)) return 'social';
    return 'external';
  } catch {
    return 'direct';
  }
};

const sanitizeSemanticProperties = (properties: object) => {
  const sanitized: Record<string, LandingEventValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!semanticPropertyKeys.has(key)) continue;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      sanitized[key] = value;
      continue;
    }
    if (typeof value !== 'string') continue;
    const normalized = value.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (normalized) sanitized[key] = normalized;
  }
  return sanitized;
};

export const readLandingAnalyticsConfig = (): LandingAnalyticsConfig | null => {
  const node = document.querySelector<HTMLScriptElement>('#siab-analytics-config');
  if (!node?.textContent) return null;
  try {
    const parsed: unknown = JSON.parse(node.textContent);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    const requiredKeys = [
      'projectToken',
      'apiHost',
      'uiHost',
      'consentStorageKey',
      'consentVersion',
      'siteDomain',
      'googleAnalyticsMeasurementId',
    ] as const;
    if (!requiredKeys.every((key) => typeof value[key] === 'string' && value[key].length > 0)) {
      return null;
    }
    return {
      projectToken: String(value.projectToken),
      apiHost: String(value.apiHost),
      uiHost: String(value.uiHost),
      consentStorageKey: String(value.consentStorageKey),
      consentVersion: String(value.consentVersion),
      siteDomain: String(value.siteDomain),
      googleAnalyticsMeasurementId: String(value.googleAnalyticsMeasurementId),
    };
  } catch {
    return null;
  }
};

export const createLandingAnalyticsRuntime = (
  config: LandingAnalyticsConfig,
): LandingAnalyticsRuntime => {
  const analyticsWindow = window as AnalyticsWindow;
  let started = false;
  let consentGranted = false;
  let posthog: PostHogClient | null = null;
  let recentAction: Record<string, LandingEventValue> | null = null;
  let googleAnalyticsStarted = false;
  const pendingSemanticEvents: Array<{
    event: LandingEventName;
    properties: Record<string, LandingEventValue>;
  }> = [];

  const environment = () => isDevelopmentHost(location.hostname) ? 'development' : 'production';
  const baseProperties = () => ({
    schema_version: 1,
    analytics_surface: 'site',
    analytics_tier: 'consented',
    site_kind: 'platform',
    environment: environment(),
    tenant_id: null,
    tenant_slug: null,
    tenant_name: null,
    site_id: 'platform:siteinabox',
    site_domain: config.siteDomain,
    page_path: location.pathname,
    viewport_bucket: viewportBucket(),
    theme: theme(),
    content_version: 'landing-retroui-v1',
  });
  const baselineProperties = () => ({
    schema_version: 1,
    analytics_surface: 'site',
    analytics_tier: 'baseline',
    site_kind: 'platform',
    environment: environment(),
    tenant_id: null,
    tenant_slug: null,
    site_id: 'platform:siteinabox',
    site_domain: config.siteDomain,
    page_path: location.pathname,
    $current_url: `${location.origin}${location.pathname}`,
    $host: location.hostname,
    $pathname: location.pathname,
    referrer_type: referrerType(),
    $geoip_disable: true,
    $process_person_profile: false,
  });
  const minimizedBaselineProperties = (properties: Record<string, unknown>, webVitals: boolean) => {
    const minimized: Record<string, unknown> = { ...baselineProperties() };
    for (const [key, value] of Object.entries(properties)) {
      if (baselineSdkKeys.has(key) || (webVitals && key.startsWith('$web_vitals_'))) {
        minimized[key] = value;
      }
    }
    if (webVitals) minimized.siab_web_vitals = true;
    return minimized;
  };

  const receipt = () => {
    try {
      const value = localStorage.getItem(config.consentStorageKey);
      if (!value) return null;
      const parsed = JSON.parse(value) as {
        version?: unknown;
        categories?: { analytics?: unknown };
      };
      if (parsed.version !== config.consentVersion) return null;
      return typeof parsed.categories?.analytics === 'boolean'
        ? parsed.categories.analytics
        : null;
    } catch {
      return null;
    }
  };

  const googleAnalyticsCookieNames = () => [
    '_ga',
    `_ga_${config.googleAnalyticsMeasurementId.replace(/^G-/, '').replaceAll('-', '_')}`,
  ];
  const clearGoogleAnalyticsCookies = () => {
    const domains = ['', location.hostname, `.${location.hostname.replace(/^www\./, '')}`];
    for (const name of googleAnalyticsCookieNames()) {
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ''} SameSite=Lax`;
      }
    }
  };
  const disableGoogleAnalytics = () => {
    analyticsWindow.gtag?.('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    clearGoogleAnalyticsCookies();
  };
  const initializeGoogleAnalytics = () => {
    const measurementId = config.googleAnalyticsMeasurementId;
    if (googleAnalyticsStarted || !/^G-[A-Z0-9]+$/.test(measurementId)) return;
    googleAnalyticsStarted = true;
    analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
    function gtag(this: void) {
      // eslint-disable-next-line prefer-rest-params -- Google's gtag.js contract requires Arguments rows.
      analyticsWindow.dataLayer!.push(arguments);
    }
    analyticsWindow.gtag = analyticsWindow.gtag ?? gtag;
    analyticsWindow.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    analyticsWindow.gtag('js', new Date());
    analyticsWindow.gtag('config', measurementId, {
      send_page_view: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      analytics_surface: 'site',
      site_kind: 'platform',
      environment: environment(),
      theme: theme(),
      content_version: 'landing-retroui-v1',
      debug_mode: environment() === 'development',
    });
    const script = document.createElement('script');
    script.id = 'siab-google-analytics';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.onerror = () => {
      googleAnalyticsStarted = false;
      script.remove();
    };
    document.head.append(script);
  };

  const flushSemanticEvents = () => {
    if (!posthog || !consentGranted) return;
    for (const entry of pendingSemanticEvents.splice(0)) {
      posthog.capture(entry.event, { ...baseProperties(), ...entry.properties });
    }
  };
  const activateConsented = (instance: PostHogClient) => {
    instance.opt_in_capturing({ captureEventName: false });
    instance.register(baseProperties());
    flushSemanticEvents();
  };
  const sendSemanticEvent = (event: LandingEventName, properties: object) => {
    if (!consentGranted || !semanticEventNames.has(event)) return;
    const sanitized = sanitizeSemanticProperties(properties);
    if (posthog) posthog.capture(event, { ...baseProperties(), ...sanitized });
    else if (pendingSemanticEvents.length < 50) {
      pendingSemanticEvents.push({ event, properties: sanitized });
    }
    const googleProperties = {
      ...sanitized,
      page_path: location.pathname,
      viewport_bucket: viewportBucket(),
      theme: theme(),
      content_version: 'landing-retroui-v1',
      environment: environment(),
    };
    analyticsWindow.gtag?.('event', event, googleProperties);

    if (event === 'site_conversion_completed') {
      const conversionSource = sanitized.conversion_source;
      if (
        typeof conversionSource === 'string'
        && conversionSource in googleKeyEventByConversionSource
      ) {
        analyticsWindow.gtag?.(
          'event',
          googleKeyEventByConversionSource[
            conversionSource as keyof typeof googleKeyEventByConversionSource
          ],
          googleProperties,
        );
      }
    }
  };
  const captureDetail = (detail: LandingAnalyticsDetail) =>
    sendSemanticEvent(detail.event, detail.properties);
  const capture: LandingEventCapture = (event, properties) =>
    sendSemanticEvent(event, properties);

  const initialize = async () => {
    if (started) return;
    started = true;
    try {
      const module = await import('posthog-js');
      posthog = module.default as PostHogClient;
    } catch {
      started = false;
      return;
    }
    posthog.init(config.projectToken, {
      api_host: config.apiHost,
      ui_host: config.uiHost,
      defaults: '2026-01-30',
      capture_pageview: true,
      capture_pageleave: true,
      disable_scroll_properties: false,
      capture_performance: {
        web_vitals: true,
        web_vitals_allowed_metrics: ['CLS', 'FCP', 'INP', 'LCP'],
        web_vitals_attribution: true,
      },
      cookieless_mode: 'on_reject',
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      person_profiles: 'identified_only',
      disable_session_recording: true,
      enable_recording_console_log: false,
      enable_heatmaps: false,
      disable_surveys: true,
      autocapture: {
        dom_event_allowlist: ['click', 'submit'],
        element_allowlist: ['a', 'button', 'form'],
        element_attribute_ignorelist: ['value', 'placeholder', 'name', 'aria-label', 'title'],
        capture_copied_text: false,
      },
      before_send(event) {
        if (!event) return null;
        const allowed = ['$pageview', '$pageleave', '$autocapture', '$web_vitals', ...LANDING_EVENT_NAMES];
        if (!allowed.includes(event.event)) return null;
        const properties = event.properties ?? {};
        if (!consentGranted) {
          const webVitals = event.event === '$web_vitals';
          if (event.event !== '$pageview' && !webVitals) return null;
          return { ...event, properties: minimizedBaselineProperties(properties, webVitals) };
        }
        delete properties.$el_text;
        delete properties.$element_text;
        delete properties.$elements;
        delete properties.$elements_chain;
        return {
          ...event,
          properties: {
            ...properties,
            ...baseProperties(),
            ...(event.event === '$autocapture' ? recentAction ?? {} : {}),
            ...(event.event === '$autocapture' ? { siab_autocapture: true } : {}),
          },
        };
      },
      loaded(instance) {
        if (consentGranted) activateConsented(instance as PostHogClient);
      },
    });
  };

  const storedConsent = receipt();
  consentGranted = storedConsent === true;
  if (storedConsent !== null) {
    document.querySelector<HTMLElement>('[data-siab-cookie-consent]')?.setAttribute('hidden', '');
  }
  if (consentGranted) initializeGoogleAnalytics();

  return {
    capture,
    captureDetail,
    hasConsent: () => consentGranted,
    initialize,
    setConsent(accepted) {
      try {
        localStorage.setItem(config.consentStorageKey, JSON.stringify({
          version: config.consentVersion,
          categories: { necessary: true, analytics: accepted },
        }));
      } catch {
        // The active page still honors the choice when preference storage is unavailable.
      }
      document.querySelector<HTMLElement>('[data-siab-cookie-consent]')?.setAttribute('hidden', '');
      consentGranted = accepted;
      if (accepted) {
        initializeGoogleAnalytics();
        if (posthog) activateConsented(posthog);
        else void initialize();
        return;
      }
      pendingSemanticEvents.length = 0;
      disableGoogleAnalytics();
      if (posthog) {
        posthog.opt_out_capturing();
        posthog.clear_opt_in_out_capturing?.();
      }
    },
    setRecentAction(properties) {
      recentAction = properties;
    },
  };
};
