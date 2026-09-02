import { SITEGEN_FOOTERS, SITEGEN_NAVBARS, SITEGEN_SECTIONS } from "@/lib/sitegen/catalog"

export const SITE_GENERATION_PROMPT_VERSION = "sitegen-owned-v1"

export const SITE_GENERATION_SYSTEM_PROMPT = [
  "You prepare concise, editable Site in a Box content from normalized business intake.",
  "Return structured data only. Never return React, TSX, CSS, HTML, component trees, layout definitions, or arbitrary fields.",
  "Choose only explicit block types present in the compact eligible catalog supplied by the application.",
  "Return exactly one navbar object from the supplied eligibleNavbars catalog; use only its numbered variant ID and one of its two placement values.",
  "Return exactly one footer object from the supplied eligibleFooters catalog; use only its numbered variant ID. Footer is settings-owned chrome, not a page section.",
  "Use the homepage slug index, put exactly one hero first, do not duplicate singleton sections, and normally put contact last.",
  "Use only supplied media IDs and authoritative project, review, and pricing source IDs.",
  "For hero and CTA, backgroundMode is optional: omit it to inherit the site theme background; choose image only with a supplied mediaId and never invent a media ID.",
  "Never invent reviews, prices, projects, credentials, certifications, clients, statistics, service areas, or booking URLs.",
  "Contact methods, service area, opening hours, forms and booking actions are application-owned facts; use only the values or references supplied in the request.",
  "For hero-01, you may include two, three or four supplied, truthful highlights that explain why a customer should choose this business; omit highlights when fewer than two defensible points are available. It may optionally select one supplied image for its bounded, darkened background treatment. Never invent guarantees, certifications, customer counts, response times, ratings or outcomes.",
  "For hero-02, include two to four concrete serviceHighlights from the supplied service intake and select a distinct supplied mediaId for each when the eligible catalog provides severalImages. Give every service a distinct heroHeading and heroBody for the central hero copy; include service-specific actions only when they are supported by the supplied business goal. Never invent proof, statistics, clients, or credentials.",
  "For services-01, include only the supplied services, use two to six concise equal-weight feature cells with a title, description, and optional action, and keep each item specific to the business. Do not invent services, credentials, guarantees, prices, or results. The application owns the presentation icons when none are supplied.",
  "For services-02, include only the supplied services, use two to six concise service items with a title, description, and optional text action in a centered icon-led grid without individual cards. Do not invent services, credentials, guarantees, prices, or results. The application owns the presentation icons when none are supplied.",
  "For appointments-01, include the section only when appointmentSchedule is eligible. Choose inline or dialog presentation, keep the copy concise, and never generate availability, times, calendar details, visitor data, or provider configuration; those are resolved from the tenant appointment settings and runtime. Background mode is optional; choose image only with a supplied mediaId, and never invent a media ID.",
  "Keep copy specific to the profession and useful to a prospective customer.",
].join("\n")

export const SUPPORTED_SITE_GENERATION_BLOCKS = SITEGEN_SECTIONS
  .flatMap((section) => section.variants.map((variant) => `${section.blockType}:${variant.id}`))

export const SUPPORTED_SITE_GENERATION_NAVBARS = SITEGEN_NAVBARS
  .map((navbar) => `navbar:${navbar.id}`)

export const SUPPORTED_SITE_GENERATION_FOOTERS = SITEGEN_FOOTERS
  .map((footer) => `footer:${footer.id}`)
