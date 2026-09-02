import * as React from "react"
import type { AppointmentSection } from "@siteinabox/contracts"
import { buttonVariants } from "@siteinabox/ui/components/button"
import { cn } from "@siteinabox/ui/lib/utils"
import { SiteCalendar, SiteCheckCircle, SiteChevronRight, SiteClock, SiteClose } from "../../icons/SiteIcons"
import { HeroBackground, resolveBackgroundMode } from "../hero/HeroShared"
import { Section, SectionInner } from "../shared"
import type { BlockRenderOptions, RendererElementPath } from "../types"

function fieldPath(options: BlockRenderOptions, field: string): RendererElementPath {
  return { blockIndex: options.index, field }
}

function editableText(
  options: BlockRenderOptions,
  name: "heading" | "body",
  value: string | null | undefined,
): React.ReactNode {
  return options.editSlots?.renderText
    ? options.editSlots.renderText({
      name,
      value: value ?? null,
      className: "",
      multiline: name === "body",
      elementPath: fieldPath(options, name),
    })
    : value
}

function AppointmentFlowMarkup({
  block,
  flowId,
  runtimeMode,
}: {
  block: AppointmentSection
  flowId: string
  runtimeMode: "public" | "preview"
}) {
  return (
    <div
      className="site-appointment-flow"
      data-siab-appointment-flow
      data-siab-appointment-flow-id={flowId}
    >
      <div className="site-appointment-flow-heading">
        <div>
          <p className="site-appointment-kicker">
            <SiteCalendar size={17} />
            <span>{block.availabilityLabel}</span>
          </p>
          <h3 className="site-appointment-flow-title" data-siab-appointment-step-title>
            Choose a time
          </h3>
        </div>
        <p className="site-appointment-timezone" data-siab-appointment-timezone>
          {runtimeMode === "preview" ? "Voorbeeldbeschikbaarheid" : "Lokale tijd"}
        </p>
      </div>

      <p className="site-appointment-status" data-siab-appointment-status role="status" aria-live="polite">
        Beschikbare momenten laden…
      </p>

      <div data-siab-appointment-calendar-step>
        <div className="site-appointment-calendar-head">
          <button
            type="button"
            className="site-appointment-icon-button"
            data-siab-appointment-prev-month
            aria-label="Previous month"
          >
            <SiteChevronRight className="rotate-180" size={18} />
          </button>
          <p className="site-appointment-month" data-siab-appointment-month>
            Availability
          </p>
          <button
            type="button"
            className="site-appointment-icon-button"
            data-siab-appointment-next-month
            aria-label="Next month"
          >
            <SiteChevronRight size={18} />
          </button>
        </div>

        <div className="site-appointment-weekdays" aria-hidden="true" data-siab-appointment-weekdays />
        <div
          className="site-appointment-calendar-grid"
          data-siab-appointment-calendar-grid
        />

        <div className="site-appointment-slots" data-siab-appointment-slots aria-live="polite">
          <p className="site-appointment-empty">Kies een beschikbare dag om tijden te zien.</p>
        </div>

        <div className="site-appointment-flow-actions">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "site-appointment-action")}
            data-siab-appointment-continue
            disabled
          >
            Continue
          </button>
        </div>
      </div>

      <form className="site-appointment-details" data-siab-appointment-details hidden>
        <div className="site-appointment-details-head">
          <div>
            <p className="site-appointment-kicker"><SiteClock size={17} /><span data-siab-appointment-details-label>Your details</span></p>
            <h3 className="site-appointment-flow-title" data-siab-appointment-details-title>Almost there</h3>
          </div>
          <p className="site-appointment-selected-slot" data-siab-appointment-selected-slot />
        </div>
        <div className="site-appointment-form-grid">
          <label className="site-appointment-field">
            <span data-siab-appointment-field-label="name">Name</span>
            <input name="visitorName" type="text" autoComplete="name" required maxLength={120} />
          </label>
          <label className="site-appointment-field">
            <span data-siab-appointment-field-label="email">Email address</span>
            <input name="visitorEmail" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label className="site-appointment-field">
            <span><span data-siab-appointment-field-label="phone">Phone number</span> <small data-siab-appointment-optional>(optional)</small></span>
            <input name="visitorPhone" type="tel" autoComplete="tel" maxLength={40} />
          </label>
          <label className="site-appointment-field site-appointment-field-wide">
            <span><span data-siab-appointment-field-label="note">What would you like to discuss?</span> <small data-siab-appointment-optional>(optional)</small></span>
            <textarea name="visitorNote" rows={3} maxLength={2000} />
          </label>
        </div>
        {block.privacyNote ? <p className="site-appointment-privacy-note">{block.privacyNote}</p> : null}
        <div className="site-appointment-flow-actions site-appointment-flow-actions-between">
          <button type="button" className="site-appointment-back" data-siab-appointment-back>
            Terug
          </button>
          <button type="submit" className={cn(buttonVariants({ variant: "default", size: "lg" }), "site-appointment-action")}>
            {block.bookingLabel}
          </button>
        </div>
      </form>

      <div className="site-appointment-confirmation" data-siab-appointment-confirmation hidden>
        <SiteCheckCircle className="site-appointment-confirmation-icon" size={42} />
        <h3 className="site-appointment-flow-title" data-siab-appointment-confirmation-heading>
          {block.confirmationHeading}
        </h3>
        <p data-siab-appointment-confirmation-body>{block.confirmationBody ?? ""}</p>
        <button type="button" className="site-appointment-back" data-siab-appointment-close-flow>
          Sluiten
        </button>
      </div>
    </div>
  )
}

export function AppointmentBlockView({
  block,
  options,
}: {
  block: AppointmentSection
  options: BlockRenderOptions
}) {
  const headingId = `siab-appointment-heading-${options.index}`
  const bodyId = block.body ? `siab-appointment-body-${options.index}` : undefined
  const flowId = `siab-appointment-flow-${options.index}`
  const heading = editableText(options, "heading", block.heading)
  const body = editableText(options, "body", block.body)
  const runtimeMode = options.appointmentMode ?? "public"
  const anchor = options.sectionAttributes?.id
  const selectedBackgroundMode = resolveBackgroundMode(options, block.backgroundMode)
  // The appointment panel has a supplied image-led base. `none` disables
  // additive treatments but keeps that base when media is available; this is
  // intentionally local because CTA/hero-01/02 use `none` as no background.
  const backgroundMode = selectedBackgroundMode === "none" && block.image ? "image" : selectedBackgroundMode
  const hasImageBackground = backgroundMode === "image" && Boolean(block.image)
  const copyClassName = cn(
    "relative z-20",
    backgroundMode === "mesh" && "hero-mesh-copy-safe",
    hasImageBackground && "hero-on-media-actions [&_h2]:text-[var(--on-media)]",
  )

  return (
    <Section
      options={options}
      id={anchor}
      aria-labelledby={headingId}
      {...(bodyId ? { "aria-describedby": bodyId } : {})}
      data-siab-appointments-design={block.variant}
      data-siab-appointment-block="true"
      data-siab-appointment-runtime={runtimeMode}
      data-siab-appointment-presentation={block.presentation}
      data-siab-appointment-anchor={anchor ?? undefined}
      data-siab-appointment-booking-label={block.bookingLabel}
      data-siab-appointment-confirmation-heading={block.confirmationHeading}
      data-siab-appointment-confirmation-body={block.confirmationBody ?? undefined}
      data-siab-appointment-background-mode={backgroundMode}
      className="site-appointments"
    >
      <SectionInner className="site-appointments-inner">
        <div
          className={cn(
            "site-appointments-panel relative isolate overflow-hidden",
            hasImageBackground && "site-appointments-panel-on-media",
          )}
          data-siab-effect-hover-target="true"
        >
          <HeroBackground
            mode={backgroundMode}
            media={block.image}
            options={options}
            fallbackAlt={block.heading}
            className="site-appointments-background"
          />
          <div className={cn("site-appointments-panel-content", copyClassName)}>
            {block.presentation === "inline" ? (
              <div className="site-appointments-layout site-appointments-layout-inline">
                <div className="site-appointments-copy">
                  <p className="site-appointment-kicker"><SiteCalendar size={18} /><span>{block.availabilityLabel}</span></p>
                  <h2 id={headingId} className="site-appointments-title">{heading}</h2>
                  {block.body ? <p id={bodyId} className="site-appointments-body">{body}</p> : null}
                </div>
                <AppointmentFlowMarkup block={block} flowId={flowId} runtimeMode={runtimeMode} />
              </div>
            ) : (
              <div className="site-appointments-launcher">
                <div className="site-appointments-copy">
                  <p className="site-appointment-kicker"><SiteCalendar size={18} /><span>{block.availabilityLabel}</span></p>
                  <h2 id={headingId} className="site-appointments-title">{heading}</h2>
                  {block.body ? <p id={bodyId} className="site-appointments-body">{body}</p> : null}
                </div>
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "default", size: "lg" }), "site-appointment-launcher-button")}
                  data-siab-appointment-open
                  aria-controls={`${flowId}-dialog`}
                >
                  {block.bookingLabel}
                </button>
              </div>
            )}
          </div>
        </div>

        {block.presentation === "dialog" ? (
          <dialog
            id={`${flowId}-dialog`}
            className="site-appointment-dialog"
            data-siab-appointment-dialog
            data-siab-effect-hover-target="true"
            aria-labelledby={`${flowId}-dialog-title`}
          >
            <div className="site-appointment-dialog-layout">
              <div className={cn("site-appointment-dialog-rail relative isolate overflow-hidden", hasImageBackground && "site-appointments-panel-on-media")}>
                <HeroBackground
                  mode={backgroundMode}
                  media={block.image}
                  options={options}
                  fallbackAlt={block.heading}
                  className="site-appointment-dialog-rail-background"
                />
                <div className={copyClassName}>
                  <p className="site-appointment-kicker"><SiteCalendar size={18} /><span>{block.availabilityLabel}</span></p>
                  <h2 id={`${flowId}-dialog-title`} className="site-appointments-title">{heading}</h2>
                  {block.body ? <p className="site-appointments-body">{body}</p> : null}
                </div>
              </div>
              <div className="site-appointment-dialog-main">
                <button type="button" className="site-appointment-dialog-close" data-siab-appointment-close data-siab-appointment-dialog-close aria-label="Close">
                  <SiteClose size={20} />
                </button>
                <AppointmentFlowMarkup block={block} flowId={flowId} runtimeMode={runtimeMode} />
              </div>
            </div>
          </dialog>
        ) : null}
        <noscript>
          <p className="site-appointment-noscript" data-siab-appointment-no-script>
            JavaScript is required to choose an appointment time.
          </p>
        </noscript>
      </SectionInner>
    </Section>
  )
}
