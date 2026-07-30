export const LANDING_ANALYTICS_EVENT = 'siab:landing-analytics';

export const LANDING_EVENT_NAMES = [
  'site_section_viewed',
  'site_section_engaged',
  'site_component_viewed',
  'site_scroll_depth_reached',
  'site_journey_step',
  'site_form_started',
  'site_form_submitted',
  'site_conversion_completed',
] as const;

export type LandingEventName = (typeof LANDING_EVENT_NAMES)[number];
export type LandingEventValue = string | number | boolean | null;

type SectionProperties = {
  section_id: string;
  section_position?: number;
  interaction_type?: string;
};

type ComponentProperties = {
  component_id: string;
  component_type: string;
  component_role: string;
  action_key?: string | null;
  action_placement?: string | null;
  item_id?: string | null;
  item_index?: number;
};

type JourneyProperties = {
  journey_name: string;
  journey_step: string;
  journey_position?: number;
  action_key?: string | null;
  action_role?: string | null;
  action_placement?: string | null;
  destination_type?: string | null;
  billing_period?: string;
  item_id?: string;
  item_index?: number;
  form_id?: string;
  form_type?: string;
  form_state?: string;
  error_category?: string;
  interaction_type?: string;
  target_type?: string;
  target_domain?: string | null;
  target_path?: string | null;
};

type FormProperties = {
  form_id: string;
  form_type: string;
  form_state: string;
};

type ConversionProperties = {
  conversion_source: string;
  form_id?: string;
  form_type?: string;
  form_state?: string;
  action_key?: string | null;
  action_placement?: string | null;
  destination_type?: string | null;
  target_type?: string;
  target_domain?: string | null;
  target_path?: string | null;
};

export type LandingEventPropertiesByName = {
  site_section_viewed: SectionProperties;
  site_section_engaged: SectionProperties & { interaction_type: string };
  site_component_viewed: ComponentProperties;
  site_scroll_depth_reached: { scroll_depth: 25 | 50 | 75 | 90 };
  site_journey_step: JourneyProperties;
  site_form_started: FormProperties;
  site_form_submitted: FormProperties;
  site_conversion_completed: ConversionProperties;
};

export type LandingAnalyticsDetail = {
  [EventName in LandingEventName]: {
    event: EventName;
    properties: LandingEventPropertiesByName[EventName];
  };
}[LandingEventName];

export type LandingEventCapture = <EventName extends LandingEventName>(
  event: EventName,
  properties: LandingEventPropertiesByName[EventName],
) => void;

export const captureLandingEvent: LandingEventCapture = (
  event,
  properties,
): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LANDING_ANALYTICS_EVENT, {
    detail: { event, properties },
  }));
};
