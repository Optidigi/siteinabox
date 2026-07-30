import {
  LANDING_ANALYTICS_EVENT,
  LANDING_EVENT_NAMES,
  type LandingAnalyticsDetail,
  type LandingEventValue,
} from '../../lib/landing-analytics';
import type { LandingAnalyticsRuntime } from './runtime';

const targetProperties = (anchor: HTMLAnchorElement | null) => {
  if (!anchor) return { target_type: 'unknown', target_domain: null, target_path: null };
  const href = anchor.getAttribute('href') || '';
  if (href.startsWith('tel:')) return { target_type: 'phone', target_domain: null, target_path: null };
  if (href.startsWith('mailto:')) return { target_type: 'email', target_domain: null, target_path: null };
  if (href.startsWith('/') || href.startsWith('#')) {
    return { target_type: 'internal', target_domain: null, target_path: href.split('?')[0] };
  }
  try {
    const url = new URL(href, location.href);
    return {
      target_type: url.hostname.includes('wa.me') || url.hostname.includes('whatsapp')
        ? 'whatsapp'
        : 'external',
      target_domain: url.hostname,
      target_path: url.pathname,
    };
  } catch {
    return { target_type: 'unknown', target_domain: null, target_path: null };
  }
};

const setupSemanticTracking = (runtime: LandingAnalyticsRuntime) => {
  const viewedSections = new WeakSet<Element>();
  const engagedSections = new WeakSet<Element>();
  const viewedComponents = new WeakSet<Element>();
  const viewTimers = new WeakMap<Element, number>();
  const engagementTimers = new WeakMap<Element, number>();
  const pendingTimers = new Set<number>();

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      pendingTimers.delete(timer);
      callback();
    }, delay);
    pendingTimers.add(timer);
    return timer;
  };
  const cancel = (timer: number | undefined) => {
    if (timer === undefined) return;
    window.clearTimeout(timer);
    pendingTimers.delete(timer);
  };
  const sectionProperties = (section: HTMLElement) => ({
    section_id: section.dataset.analyticsSection ?? 'unknown',
    section_position: Number(section.dataset.analyticsPosition ?? '0'),
  });
  const markSectionViewed = (section: HTMLElement) => {
    if (viewedSections.has(section)) return;
    viewedSections.add(section);
    runtime.capture('site_section_viewed', sectionProperties(section));
  };
  const markSectionEngaged = (section: HTMLElement, interactionType: string) => {
    markSectionViewed(section);
    if (engagedSections.has(section)) return;
    engagedSections.add(section);
    runtime.capture('site_section_engaged', {
      ...sectionProperties(section),
      interaction_type: interactionType,
    });
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const section = entry.target as HTMLElement;
      cancel(viewTimers.get(section));
      cancel(engagementTimers.get(section));
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
      if (!viewedSections.has(section)) {
        viewTimers.set(section, schedule(() => markSectionViewed(section), 500));
      }
      if (!engagedSections.has(section)) {
        engagementTimers.set(section, schedule(() => markSectionEngaged(section, 'dwell'), 3000));
      }
    }
  }, { threshold: [0.5] });

  const listenerCleanups: Array<() => void> = [];
  document.querySelectorAll<HTMLElement>('[data-analytics-section]').forEach((section) => {
    const markClickEngagement = () => markSectionEngaged(section, 'click');
    const markInputEngagement = () => markSectionEngaged(section, 'input');
    sectionObserver.observe(section);
    section.addEventListener('click', markClickEngagement, { passive: true });
    section.addEventListener('input', markInputEngagement, { passive: true });
    listenerCleanups.push(() => {
      section.removeEventListener('click', markClickEngagement);
      section.removeEventListener('input', markInputEngagement);
    });
  });

  const componentObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const component = entry.target as HTMLElement;
      cancel(viewTimers.get(component));
      if (!entry.isIntersecting || entry.intersectionRatio < 0.5 || viewedComponents.has(component)) continue;
      viewTimers.set(component, schedule(() => {
        if (viewedComponents.has(component)) return;
        viewedComponents.add(component);
        runtime.capture('site_component_viewed', {
          component_id: component.dataset.analyticsComponent ?? 'unknown',
          component_type: component.dataset.analyticsComponentType ?? 'component',
          component_role: component.dataset.analyticsComponentRole ?? 'content',
          action_key: component.dataset.analyticsAction ?? null,
          action_placement: component.dataset.analyticsPlacement ?? null,
          item_id: component.dataset.analyticsItem ?? null,
          item_index: Number(component.dataset.analyticsIndex ?? '0'),
        });
      }, 500));
    }
  }, { threshold: [0.5] });
  document.querySelectorAll<HTMLElement>('[data-analytics-component]').forEach((component) => {
    componentObserver.observe(component);
  });

  const reachedDepths = new Set<25 | 50 | 75 | 90>();
  const recordScrollDepth = () => {
    const available = document.documentElement.scrollHeight - window.innerHeight;
    if (available <= 0) return;
    const depth = Math.round((window.scrollY / available) * 100);
    for (const threshold of [25, 50, 75, 90] as const) {
      if (depth < threshold || reachedDepths.has(threshold)) continue;
      reachedDepths.add(threshold);
      runtime.capture('site_scroll_depth_reached', { scroll_depth: threshold });
    }
  };
  window.addEventListener('scroll', recordScrollDepth, { passive: true });
  window.addEventListener('resize', recordScrollDepth, { passive: true });
  recordScrollDepth();

  return () => {
    sectionObserver.disconnect();
    componentObserver.disconnect();
    pendingTimers.forEach((timer) => window.clearTimeout(timer));
    pendingTimers.clear();
    window.removeEventListener('scroll', recordScrollDepth);
    window.removeEventListener('resize', recordScrollDepth);
    listenerCleanups.forEach((cleanup) => cleanup());
  };
};

export const bindLandingAnalytics = (runtime: LandingAnalyticsRuntime) => {
  let stopSemanticTracking: (() => void) | null = null;
  const startSemanticTracking = () => {
    stopSemanticTracking?.();
    stopSemanticTracking = setupSemanticTracking(runtime);
  };
  const stopTracking = () => {
    stopSemanticTracking?.();
    stopSemanticTracking = null;
  };
  if (runtime.hasConsent()) startSemanticTracking();

  const clickHandler = (event: MouseEvent) => {
    const element = event.target instanceof Element ? event.target : null;
    const settings = element?.closest<HTMLElement>('[data-consent-settings]');
    if (settings) {
      const banner = document.querySelector<HTMLElement>('[data-siab-cookie-consent]');
      banner?.removeAttribute('hidden');
      banner?.querySelector<HTMLButtonElement>('[data-consent-action]')?.focus();
      return;
    }
    const consent = element?.closest<HTMLButtonElement>('[data-consent-action]');
    if (consent) {
      const accepted = consent.dataset.consentAction === 'accept';
      runtime.setConsent(accepted);
      if (accepted) startSemanticTracking();
      else stopTracking();
      return;
    }

    const action = element?.closest<HTMLElement>('[data-analytics-action]') ?? null;
    const anchor = element?.closest<HTMLAnchorElement>('a') ?? null;
    const actionKey = action?.dataset.analyticsAction ?? null;
    const actionPlacement = action?.dataset.analyticsPlacement ?? null;
    const destinationType = action?.dataset.analyticsDestination ?? null;
    if (!anchor) {
      if (actionKey) {
        runtime.capture('site_journey_step', {
          journey_name: 'landing_interaction',
          journey_step: actionKey,
          action_key: actionKey,
          action_role: action?.closest('nav') ? 'nav' : 'control',
          action_placement: actionPlacement,
          destination_type: destinationType,
          interaction_type: 'click',
        });
      }
      return;
    }

    const target = targetProperties(anchor);
    const actionRole = anchor.closest('nav') ? 'nav' : anchor.closest('footer') ? 'footer' : 'link';
    const recentAction: Record<string, LandingEventValue> = {
      action_key: actionKey,
      action_role: actionRole,
      action_placement: actionPlacement,
      destination_type: destinationType ?? target.target_type,
      component_type: anchor.closest('section')?.id || 'link',
      component_role: actionRole,
      interaction_type: 'click',
      siab_click_kind: ['phone', 'email', 'whatsapp'].includes(target.target_type) ? 'contact' : 'cta',
      ...target,
    };
    runtime.setRecentAction(recentAction);
    window.setTimeout(() => runtime.setRecentAction(null), 0);

    if (actionKey) {
      runtime.capture('site_journey_step', {
        journey_name: 'landing_conversion',
        journey_step: actionKey,
        action_key: actionKey,
        action_role: actionRole,
        action_placement: actionPlacement,
        destination_type: destinationType ?? target.target_type,
        interaction_type: 'click',
        ...target,
      });
    }
    const contactConversion = ['phone', 'email', 'whatsapp'].includes(target.target_type);
    if (contactConversion || action?.dataset.analyticsConversion === 'true') {
      runtime.capture('site_conversion_completed', {
        conversion_source: action?.dataset.analyticsConversionSource
          ?? (contactConversion ? 'contact_click' : 'intake_handoff'),
        action_key: actionKey,
        action_placement: actionPlacement,
        destination_type: destinationType ?? target.target_type,
        ...target,
      });
    }
  };

  const customEventHandler = (event: Event) => {
    const detail = (event as CustomEvent<LandingAnalyticsDetail>).detail;
    if (!detail || !LANDING_EVENT_NAMES.includes(detail.event)) return;
    runtime.captureDetail(detail);
  };
  document.addEventListener('click', clickHandler, true);
  window.addEventListener(LANDING_ANALYTICS_EVENT, customEventHandler);

  return () => {
    stopTracking();
    document.removeEventListener('click', clickHandler, true);
    window.removeEventListener(LANDING_ANALYTICS_EVENT, customEventHandler);
  };
};
