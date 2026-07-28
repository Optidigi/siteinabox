type TimingFields = {
  clientSlug: string
  domain?: string | null
}

const startedAt = () => performance.now()

const durationMs = (start: number) => Math.max(0, Math.round(performance.now() - start))

export function logPreviewCheckoutTiming(
  event: string,
  start: number,
  fields: TimingFields,
  extra?: Record<string, string | number | boolean | null | undefined>,
) {
  console.info("Preview checkout timing", {
    event,
    durationMs: durationMs(start),
    clientContextPresent: Boolean(fields.clientSlug),
    domainContextPresent: Boolean(fields.domain),
    ...extra,
  })
}

export function startPreviewCheckoutTimer() {
  return startedAt()
}
