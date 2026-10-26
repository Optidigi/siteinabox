const DAY = 86_400_000
export function mailRenewalDecision(input: { now: Date; termStartsAt: string; termEndsAt: string; paidNextPeriod: boolean; cancellationState?: unknown }) {
  const start = Date.parse(input.termStartsAt), end = Date.parse(input.termEndsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "review" as const
  if (input.cancellationState) return "reconcile_cancellation" as const
  if (input.paidNextPeriod) return "covered" as const
  if (input.now.getTime() >= end) return "review" as const
  if (end - input.now.getTime() <= 14 * DAY) return input.now.getTime() - start >= 7 * DAY ? "schedule_term_end" as const : "review" as const
  if (end - input.now.getTime() <= 45 * DAY) return "prepare_renewal" as const
  return "not_due" as const
}
