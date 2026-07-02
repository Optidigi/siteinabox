import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { cn } from "@siteinabox/ui/lib/utils"
import { JsonSummaryBlock } from "@/components/generation/JsonSummaryBlock"
import { PreviewAccessShare } from "@/components/generation/PreviewAccessShare"
import { ResponsiveOperationsCard } from "@/components/generation/ResponsiveOperationsCard"
import { PageHeader } from "@/components/page-header"
import { updateTenantDomainVerificationAction } from "@/lib/actions/domainVerification"
import { createGenerationRunMollieCheckoutAction, recordGenerationRunPaymentAction } from "@/lib/actions/generationRunPayment"
import { retryPostPaymentAutomationAction } from "@/lib/actions/postPaymentAutomation"
import {
  activateSnapshotAction,
  publishGenerationRunSnapshotAction,
  rollbackSnapshotAction,
} from "@/lib/actions/publishSnapshots"
import { promoteGenerationRunPagesAction } from "@/lib/actions/promoteGenerationRunPages"
import { statusVariant } from "@/lib/badge-helpers"
import { requireRole } from "@/lib/authGate"
import { normalizeGenerationRunPaymentState } from "@/lib/payments/generationRunPayment"
import { previewClientSlugFromDomain } from "@/lib/preview/previewAccess"
import { getSnapshotLifecycleForGenerationRun } from "@/lib/queries/publishOperations"
import {
  extractIssueCount,
  getGenerationRunForOperations,
  relationId,
  relationLabel,
  relationSlug,
  workflowSummaryForGenerationRun,
} from "@/lib/queries/generationOperations"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
} from "lucide-react"

const formatDate = (value?: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("nl-NL")
}

const workflow = (entries: NonNullable<Awaited<ReturnType<typeof getGenerationRunForOperations>>>["statusTransitions"]) =>
  entries?.length ? entries : []

const approvalStatus = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as { status?: unknown }).status
    : undefined

const displayStatus = (value: string) => value.replace(/_/g, " ")

const jsonField = (value: unknown, key: string): unknown =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined

const displayValue = (value: unknown, fallback = "-") =>
  typeof value === "string" && value.trim() ? value : fallback

const jsonObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

const domainVerification = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as { status?: unknown; checkedAt?: unknown; checkedBy?: unknown; notes?: unknown }
    : null

const postPaymentAutomationState = (value: unknown) => {
  const errors = jsonObject(value)
  const state = jsonObject(errors?.postPaymentAutomation)
  if (!state) return null
  const status = displayValue(state.status, "unknown")
  const step = displayValue(state.step, "unknown")
  const message = displayValue(state.message, "No message recorded")
  const at = displayValue(state.at, "-")
  const snapshotId = state.snapshotId == null ? null : String(state.snapshotId)
  return { status, step, message, at, snapshotId }
}

const retrySteps = [
  {
    step: "mollie_subscription" as const,
    label: "Retry subscription",
    helper: "Creates the missing Mollie renewal subscription when payment is complete.",
  },
  {
    step: "domain_provisioning" as const,
    label: "Retry domain provisioning",
    helper: "Retries OpenProvider registration plus Cloudflare DNS and sender setup.",
  },
  {
    step: "refresh_provisioning" as const,
    label: "Refresh provisioning",
    helper: "Refreshes tenant sender state and re-checks activation gates.",
  },
  {
    step: "publish_activate" as const,
    label: "Retry publish + activation",
    helper: "Reuses an existing run snapshot or publishes and activates a new one.",
  },
]

const promotionSummary = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const promotion = (value as { promotion?: unknown }).promotion
  return promotion && typeof promotion === "object" && !Array.isArray(promotion)
    ? promotion as Record<string, unknown>
    : null
}

const intakeContactEmail = (value: unknown): string | null => {
  if (!value || typeof value !== "object") return null
  const email = (value as { contactEmail?: unknown }).contactEmail
  return typeof email === "string" && email ? email : null
}

type OperationsBadgeVariant = "success" | "default" | "warning"

const workflowBadgeVariant = (state: string): OperationsBadgeVariant => {
  if (state === "Live") return "success"
  if (state === "Needs attention") return "warning"
  return "default"
}

const statusBadge = (variant: OperationsBadgeVariant, label: string) => (
  <Badge
    variant={variant}
    className={variant === "default" ? "bg-foreground text-background" : undefined}
  >
    {label}
  </Badge>
)

export const dynamic = "force-dynamic"

export default async function GenerationRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(["super-admin"])
  const { id } = await params
  const run = await getGenerationRunForOperations(id)
  if (!run) notFound()

  const tenantSlug = relationSlug(run.tenant)
  const tenantId = relationId(run.tenant)
  const settingsId = relationId(run.settings)
  const pageRecords = Array.isArray(run.pages) ? run.pages : []
  const validationIssueCount = extractIssueCount(run.validation)
  const applyIssueCount = extractIssueCount(run.applyResult)
  const isApproved = approvalStatus(run.clientApproval) === "approved"
  const payment = normalizeGenerationRunPaymentState(run.payment)
  const automationState = postPaymentAutomationState(run.errors)
  const paymentSatisfied = payment.status === "completed" || payment.status === "waived"
  const promoted = promotionSummary(run.applyResult)
  const lifecycle = await getSnapshotLifecycleForGenerationRun(run)
  const domainCheck = domainVerification(lifecycle.tenant?.domainVerification)
  const domainVerified = domainCheck?.status === "verified"
  const emailSending = lifecycle.tenant?.emailSending
  const emailSendingStatus = displayValue(jsonField(emailSending, "status"), "not_configured")
  const emailSendingVerified = emailSendingStatus === "verified"
  const domainOrderStatus = displayValue(jsonField(run.domainOrder, "status"), "not_started")
  const domainOrderDomain = displayValue(
    jsonField(run.domainOrder, "domain")
      ?? jsonField(run.domainOrder, "requestedDomain")
      ?? lifecycle.tenant?.domain,
    "No domain selected",
  )
  const isLive = Boolean(lifecycle.activeSnapshotId)
  const summary = workflowSummaryForGenerationRun(run)
  const previewPages = pageRecords
    .map((page) => {
      const pageId = relationId(page)
      if (!pageId) return null
      return {
        id: pageId,
        label: relationLabel(page, "Page"),
        slug: relationSlug(page),
      }
    })
    .filter((page): page is { id: string; label: string; slug: string | null } => Boolean(page))
  const previewDisabledReason =
    run.status !== "preview_ready"
      ? "Preview links are available after the draft is ready for review."
      : !tenantId
        ? "Preview links require a linked tenant."
        : previewPages.length === 0
          ? "Preview links require at least one linked page."
          : null
  const previewClientSlug = lifecycle.tenant
    ? previewClientSlugFromDomain(lifecycle.tenant.domain, tenantSlug ?? relationLabel(run.tenant))
    : null
  const customerPreviewUrl = previewClientSlug ? `https://preview.siteinabox.nl/${previewClientSlug}` : null
  const liveUrl = lifecycle.tenant?.domain ? `https://${lifecycle.tenant.domain}` : null
  const defaultPreviewEmail = intakeContactEmail(run.intakeSubmission)
  const readyToGoLive = Boolean(tenantId) && lifecycle.publishBlockers.length === 0 && lifecycle.blockers.length === 0
  const checkoutComplete = isApproved && paymentSatisfied
  const statusPanels = [
    {
      label: "Preview",
      value: customerPreviewUrl ? "Ready" : "Not ready",
      complete: !previewDisabledReason,
      badge: statusBadge("default", previewDisabledReason ? "waiting" : "ready"),
    },
    {
      label: "Checkout",
      value: displayStatus(payment.status),
      complete: paymentSatisfied,
      badge: statusBadge(paymentSatisfied ? "success" : "default", paymentSatisfied ? "complete" : displayStatus(payment.status)),
    },
    {
      label: "Provisioning",
      value: domainVerified && emailSendingVerified ? "Ready" : displayStatus(domainOrderStatus),
      complete: domainVerified && emailSendingVerified,
      badge: statusBadge(domainVerified && emailSendingVerified ? "success" : "default", domainVerified && emailSendingVerified ? "ready" : "waiting"),
    },
    {
      label: "Live",
      value: isLive ? "Live" : "Not live",
      complete: isLive,
      badge: statusBadge(isLive ? "success" : "default", isLive ? "live" : readyToGoLive ? "ready" : "waiting"),
    },
  ]
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Draft site #${run.id}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge
              variant={workflowBadgeVariant(summary.state)}
              className={summary.state !== "Live" && summary.state !== "Needs attention" ? "bg-foreground text-background" : undefined}
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {summary.state}
            </Badge>
            <span>{relationLabel(run.tenant, "No tenant linked")}</span>
          </span>
        }
        action={
          <Button asChild variant="outline">
            <Link href="/generation-runs">
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              Back
            </Link>
          </Button>
        }
      />

      {run.status === "failed" && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>Draft failed</AlertTitle>
          <AlertDescription>
            Review the Advanced section for diagnostics. Raw AI output is intentionally not shown in this control-plane view.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-start">
        <ResponsiveOperationsCard
          title="Send preview"
          defaultOpen
          contentClassName="grid gap-3 text-sm"
        >
          <div className="grid gap-3">
            <div>
              <div className="font-medium">Preview email</div>
              <div className="text-muted-foreground">
                Manual preview send is the normal operator gate.
              </div>
            </div>
            <PreviewAccessShare
              generationRunId={run.id}
              defaultEmail={defaultPreviewEmail}
              previewUrl={customerPreviewUrl}
              disabledReason={previewDisabledReason}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {isLive && liveUrl && (
              <Button asChild>
                <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 size-4" aria-hidden />
                  Live site
                </a>
              </Button>
            )}
          </div>
        </ResponsiveOperationsCard>

        <ResponsiveOperationsCard
          title="Client"
          contentClassName="grid gap-4 text-sm lg:grid-cols-[1.3fr_1fr] xl:grid-cols-1"
        >
          <div className="grid gap-2">
            <div className="text-base font-medium">{relationLabel(run.tenant, "Draft site")}</div>
            <div className="text-muted-foreground">{defaultPreviewEmail ?? "No intake email"}</div>
            <div className="break-all text-muted-foreground">{domainOrderDomain}</div>
          </div>
          <div className="grid gap-2 rounded-md bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <span>Payment</span>
              {statusBadge(paymentSatisfied ? "success" : "default", displayStatus(payment.status))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Approval</span>
              {statusBadge(isApproved ? "success" : "default", isApproved ? "approved" : "waiting")}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Live</span>
              {statusBadge(isLive ? "success" : "default", isLive ? "live" : "not live")}
            </div>
          </div>
        </ResponsiveOperationsCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-4">
          {statusPanels.map((panel) => (
            <div
              key={panel.label}
              className={cn(
                "rounded-md border p-3 transition-colors",
                panel.complete && "border-success/40 bg-success/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-muted-foreground">{panel.label}</div>
                {panel.badge}
              </div>
              <div className="mt-2 font-medium">{panel.value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground group-open:text-foreground">
              Diagnostics and technical controls
            </summary>
            <div className="mt-4 grid gap-4">
              <Alert>
                <RotateCcw className="size-4" aria-hidden />
                <AlertTitle>Automation recovery</AlertTitle>
                <AlertDescription>
                  Failed post-payment automation can be retried here. Normal preview sending remains manual.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">Post-payment automation</div>
                    <div className="text-muted-foreground">
                      Subscription, domain provisioning, sender refresh, and publish/activation recovery.
                    </div>
                  </div>
                  <Badge variant={automationState?.status === "activated" ? "success" : automationState?.status === "failed" ? "destructive" : "secondary"}>
                    {automationState ? displayStatus(automationState.status) : "not recorded"}
                  </Badge>
                </div>

                {automationState ? (
                  <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs md:grid-cols-2">
                    <div>
                      <div className="text-muted-foreground">Step</div>
                      <div className="font-medium">{displayStatus(automationState.step)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Updated</div>
                      <div className="font-medium">{formatDate(automationState.at)}</div>
                    </div>
                    {automationState.snapshotId && (
                      <div>
                        <div className="text-muted-foreground">Snapshot</div>
                        <div className="font-medium">{automationState.snapshotId}</div>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <div className="text-muted-foreground">Message</div>
                      <div className="font-medium">{automationState.message}</div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    No post-payment automation status has been recorded for this run yet.
                  </div>
                )}

                <div className="grid gap-2 md:grid-cols-2">
                  {retrySteps.map((item) => (
                    <form
                      key={item.step}
                      action={retryPostPaymentAutomationAction.bind(null, run.id, item.step)}
                      className="grid gap-2 rounded-md border p-3"
                    >
                      <div>
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.helper}</div>
                      </div>
                      <Button type="submit" variant="outline" size="sm" disabled={!paymentSatisfied}>
                        <RotateCcw className="mr-1 size-4" aria-hidden />
                        {item.label}
                      </Button>
                    </form>
                  ))}
                </div>
                {!paymentSatisfied && (
                  <div className="text-xs text-muted-foreground">
                    Payment must be completed or waived before automation recovery can run.
                  </div>
                )}
              </div>

              <div id="checkout" className="grid gap-3 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Client checkout controls</div>
                    <div className="text-muted-foreground">
                      Client approval plus Mollie completion or a manual waiver satisfies checkout. Checkout does not make the site live.
                    </div>
                  </div>
                  <Badge variant={checkoutComplete ? "success" : "secondary"}>
                    {checkoutComplete ? "approved and paid" : isApproved ? displayStatus(payment.status) : "waiting for approval"}
                  </Badge>
                </div>

                <form action={createGenerationRunMollieCheckoutAction.bind(null, run.id)} className="grid gap-3 rounded-md border p-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="mollie-customer-email">Customer email</Label>
                    <Input
                      id="mollie-customer-email"
                      name="customerEmail"
                      type="email"
                      defaultValue={payment.customerEmail ?? defaultPreviewEmail ?? ""}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <Button type="submit" variant="outline" disabled={!isApproved || paymentSatisfied}>
                    <CreditCard className="mr-1 size-4" aria-hidden />
                    Create checkout link
                  </Button>
                </form>

                <form action={recordGenerationRunPaymentAction.bind(null, run.id, "completed")} className="grid gap-3 rounded-md border p-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="payment-note">Note</Label>
                    <Textarea id="payment-note" name="note" defaultValue={payment.note ?? ""} rows={3} />
                  </div>
                  <input type="hidden" name="provider" value={payment.provider ?? "manual"} />
                  <input type="hidden" name="externalReference" value={payment.externalReference ?? ""} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={payment.status === "completed"}>
                      <CreditCard className="mr-1 size-4" aria-hidden />
                      Payment received
                    </Button>
                    <Button
                      type="submit"
                      variant="outline"
                      formAction={recordGenerationRunPaymentAction.bind(null, run.id, "waived")}
                      disabled={payment.status === "waived"}
                    >
                      <ShieldCheck className="mr-1 size-4" aria-hidden />
                      Waive payment
                    </Button>
                  </div>
                </form>
              </div>

              <div id="launch-domain" className="grid gap-3 rounded-md border p-3 text-sm">
                {tenantId && lifecycle.tenant ? (
                  <form
                    action={updateTenantDomainVerificationAction.bind(null, run.id, tenantId)}
                    className="grid gap-3 rounded-md border p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">Domain verification controls</div>
                        <div className="text-muted-foreground">
                          DNS remains manual. Confirm the customer domain and any aliases point at the renderer before marking verified.
                        </div>
                      </div>
                      <Badge variant={domainVerified ? "success" : "secondary"}>
                        {String(domainCheck?.status ?? "not_checked")}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Primary domain</div>
                      <div className="font-medium break-all">{lifecycle.tenant.domain}</div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="domain-verification-status">Status</Label>
                        <select
                          id="domain-verification-status"
                          name="status"
                          defaultValue={String(domainCheck?.status ?? "not_checked")}
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="not_checked">Not checked</option>
                          <option value="verified">Verified</option>
                          <option value="failed">Failed</option>
                        </select>
                      </div>
                      <div className="grid gap-1.5 md:col-span-2">
                        <Label htmlFor="domain-verification-notes">Notes</Label>
                        <Textarea
                          id="domain-verification-notes"
                          name="notes"
                          defaultValue={typeof domainCheck?.notes === "string" ? domainCheck.notes : ""}
                          rows={2}
                          placeholder="Observed DNS target, proxy route, alias check, or failure reason"
                        />
                      </div>
                    </div>
                    <Button type="submit" variant="outline">
                      <ShieldCheck className="mr-1 size-4" aria-hidden />
                      Check domain
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-md border p-3 text-muted-foreground">Link a tenant before checking the domain.</div>
                )}
              </div>

              <form action={publishGenerationRunSnapshotAction.bind(null, run.id, tenantId ?? "")} className="flex flex-wrap gap-2 rounded-md border p-3">
                <input type="hidden" name="reason" value="go live from manager dashboard" />
                <input type="hidden" name="activate" value="on" />
                <Button type="submit" disabled={!readyToGoLive || isLive}>
                  <UploadCloud className="mr-1 size-4" aria-hidden />
                  Launch site
                </Button>
                {isLive && liveUrl && (
                  <Button asChild variant="outline">
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 size-4" aria-hidden />
                      Live
                    </a>
                  </Button>
                )}
              </form>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium">Started</div>
                  <div className="mt-2 text-sm">{formatDate(run.startedAt)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium">Completed</div>
                  <div className="mt-2 text-sm">{formatDate(run.completedAt)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium">Validation issues</div>
                  <div className="mt-2 text-2xl font-semibold">{validationIssueCount}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium">Apply issues</div>
                  <div className="mt-2 text-2xl font-semibold">{applyIssueCount}</div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-3 font-medium">Run metadata</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-muted-foreground">Status</div>
                    <div className="font-medium">{run.status}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Provider/model</div>
                    <div className="font-medium">{run.provider} / {run.model}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Prompt version</div>
                    <div className="font-medium">{run.promptVersion}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Attempts</div>
                    <div className="font-medium">{run.generationAttempts ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Settings</div>
                    <div className="font-medium">{settingsId ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Generation run</div>
                    <div className="font-medium">{run.id}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Input hash</div>
                    <code className="break-all text-xs">{run.generationInputHash}</code>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Output hash</div>
                    <code className="break-all text-xs">{run.generationOutputHash ?? "-"}</code>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Normalized intake hash</div>
                    <code className="break-all text-xs">{run.normalizedIntakeHash}</code>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Spec hash</div>
                    <code className="break-all text-xs">{run.specHash ?? "-"}</code>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">Promote pages</div>
                    <div className="text-muted-foreground">
                      Promotes only pages linked to this approved run. Promotion does not publish or activate a snapshot.
                    </div>
                  </div>
                  <form action={promoteGenerationRunPagesAction.bind(null, run.id)}>
                    <Button type="submit" disabled={!isApproved || pageRecords.length === 0}>
                      <CheckCircle2 className="mr-1 size-4" aria-hidden />
                      Promote pages
                    </Button>
                  </form>
                </div>
                {!isApproved && (
                  <div className="text-xs text-muted-foreground">Client approval is required before run pages can be promoted.</div>
                )}
                {promoted && (
                  <div className="text-xs text-muted-foreground">
                    Last promoted {formatDate(typeof promoted.promotedAt === "string" ? promoted.promotedAt : null)}
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="mb-3 font-medium">Validation</div>
                  <div>
                    <JsonSummaryBlock value={run.validation} />
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-3 font-medium">Apply result</div>
                  <div>
                    <JsonSummaryBlock value={run.applyResult} />
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-3 font-medium">Errors</div>
                  <div>
                    <JsonSummaryBlock value={run.errors} />
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-3 font-medium">Client approval and payment</div>
                  <div>
                    <JsonSummaryBlock value={{ clientApproval: run.clientApproval, payment: run.payment }} />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">Snapshot lifecycle</div>
                    <div className="text-muted-foreground">
                      Publishing freezes promoted CMS pages into an immutable snapshot. Activation is a separate live-renderer switch unless selected here.
                    </div>
                  </div>
                  <Badge variant={lifecycle.publishBlockers.length === 0 ? "success" : "secondary"}>
                    {lifecycle.publishBlockers.length === 0 ? "publishable" : "blocked"}
                  </Badge>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="text-muted-foreground">Tenant status</div>
                    <div className="font-medium">{lifecycle.tenant?.status ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Domain verification</div>
                    <div className="font-medium">{String(domainCheck?.status ?? "-")}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Linked published pages</div>
                    <div className="font-medium">
                      {lifecycle.linkedPages.filter((page) => page.status === "published").length} / {pageRecords.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Active snapshot</div>
                    <div className="font-medium">{lifecycle.activeSnapshotId ?? "none"}</div>
                  </div>
                </div>

                {(lifecycle.publishBlockers.length > 0 || lifecycle.blockers.length > 0 || lifecycle.manualBlockers.length > 0) && (
                  <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs">
                    {lifecycle.publishBlockers.map((blocker) => (
                      <div key={blocker}>Publish blocker: {blocker}</div>
                    ))}
                    {lifecycle.blockers.map((blocker) => (
                      <div key={blocker}>Activation blocker: {blocker}</div>
                    ))}
                    {lifecycle.manualBlockers.map((blocker) => (
                      <div key={blocker}>Manual activation safety blocker: {blocker}</div>
                    ))}
                  </div>
                )}

                {lifecycle.snapshots.length === 0 && (
                  <Alert>
                    <AlertCircle className="size-4" aria-hidden />
                    <AlertTitle>No snapshots yet</AlertTitle>
                    <AlertDescription>Publish this run after linked pages are promoted to create the first snapshot.</AlertDescription>
                  </Alert>
                )}
                {lifecycle.snapshots.length > 0 && !lifecycle.activeSnapshotId && (
                  <Alert>
                    <AlertCircle className="size-4" aria-hidden />
                    <AlertTitle>No active snapshot</AlertTitle>
                    <AlertDescription>The tenant has snapshots, but none is active for the renderer.</AlertDescription>
                  </Alert>
                )}

                <form action={publishGenerationRunSnapshotAction.bind(null, run.id, tenantId ?? "")} className="grid gap-3 border-t pt-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="publish-reason">Reason</Label>
                    <Textarea id="publish-reason" name="reason" rows={2} placeholder="Operator note for publish or activation" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="activate" className="size-4" />
                    Publish and activate immediately
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="manualActivation" className="size-4" />
                    Manual activation override for approval/payment only
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={!tenantId || lifecycle.publishBlockers.length > 0}>
                      <UploadCloud className="mr-1 size-4" aria-hidden />
                      Publish snapshot
                    </Button>
                  </div>
                </form>
              </div>

              <div className="overflow-hidden rounded-md border">
                <div className="grid grid-cols-12 gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-3">Snapshot</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-1">Version</div>
                  <div className="col-span-3">Published</div>
                  <div className="col-span-3">Actions</div>
                </div>
                {lifecycle.snapshots.map((snapshot) => {
                  const isActive = String(snapshot.id) === String(lifecycle.activeSnapshotId) || snapshot.status === "active"
                  const canActivateNormally = !isActive && lifecycle.blockers.length === 0
                  const canManualActivate = !isActive && lifecycle.manualBlockers.length === 0
                  const canRollbackNormally = canActivateNormally && Boolean(lifecycle.activeSnapshotId)
                  const canManualRollback = canManualActivate && Boolean(lifecycle.activeSnapshotId)
                  return (
                    <div key={snapshot.id} className="grid grid-cols-12 gap-2 border-b px-3 py-3 last:border-b-0">
                      <div className="col-span-12 min-w-0 md:col-span-3">
                        <div className="truncate font-medium">{snapshot.snapshotKey}</div>
                        <code className="break-all text-xs text-muted-foreground">{snapshot.snapshotHash}</code>
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Badge variant={isActive ? "success" : "secondary"}>{snapshot.status}</Badge>
                      </div>
                      <div className="col-span-2 md:col-span-1">{snapshot.version}</div>
                      <div className="col-span-6 md:col-span-3">{formatDate(snapshot.publishedAt)}</div>
                      <div className="col-span-12 flex flex-col gap-2 md:col-span-3">
                        <form action={activateSnapshotAction.bind(null, run.id, snapshot.id)} className="grid gap-2">
                          <input type="hidden" name="reason" value={`activate snapshot ${snapshot.id}`} />
                          <Button type="submit" size="sm" variant="outline" disabled={!canActivateNormally}>
                            <PlayCircle className="mr-1 size-4" aria-hidden />
                            Activate snapshot
                          </Button>
                        </form>
                        <form action={activateSnapshotAction.bind(null, run.id, snapshot.id)} className="grid gap-2">
                          <input type="hidden" name="reason" value={`manual activate snapshot ${snapshot.id}`} />
                          <input type="hidden" name="manualActivation" value="true" />
                          <Button type="submit" size="sm" variant="outline" disabled={!canManualActivate}>
                            <ShieldCheck className="mr-1 size-4" aria-hidden />
                            Manual activation
                          </Button>
                        </form>
                        <form action={rollbackSnapshotAction.bind(null, run.id, snapshot.id)} className="grid gap-2">
                          <input type="hidden" name="reason" value={`rollback to snapshot ${snapshot.id}`} />
                          <Button type="submit" size="sm" variant="outline" disabled={!canRollbackNormally}>
                            <RotateCcw className="mr-1 size-4" aria-hidden />
                            Rollback snapshot
                          </Button>
                        </form>
                        <form action={rollbackSnapshotAction.bind(null, run.id, snapshot.id)} className="grid gap-2">
                          <input type="hidden" name="reason" value={`manual rollback to snapshot ${snapshot.id}`} />
                          <input type="hidden" name="manualActivation" value="true" />
                          <Button type="submit" size="sm" variant="outline" disabled={!canManualRollback}>
                            <ShieldCheck className="mr-1 size-4" aria-hidden />
                            Manual rollback
                          </Button>
                        </form>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-3 font-medium">Status transitions</div>
                <div className="flex flex-col gap-2">
                  {workflow(run.statusTransitions).map((entry, index) => (
                    <div key={entry.id ?? `${entry.status}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
                      <span className="text-muted-foreground">{formatDate(entry.at)}</span>
                      {entry.message && <span>{entry.message}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}
