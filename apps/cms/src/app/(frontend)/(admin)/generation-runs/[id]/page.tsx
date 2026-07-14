import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { JsonSummaryBlock } from "@/components/generation/JsonSummaryBlock"
import { PreviewAccessShare } from "@/components/generation/PreviewAccessShare"
import { ResponsiveOperationsCard } from "@/components/generation/ResponsiveOperationsCard"
import { OperationsRouteTabs } from "@/components/generation/OperationsRouteTabs"
import { PageHeader } from "@/components/page-header"
import { CheckoutStepper } from "@/components/preview/CheckoutStepper"
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
  Globe2,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
} from "lucide-react"

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date)
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

const postPaymentAutomationState = (value: unknown, noMessageFallback: string) => {
  const errors = jsonObject(value)
  const state = jsonObject(errors?.postPaymentAutomation)
  if (!state) return null
  const status = displayValue(state.status, "unknown")
  const step = displayValue(state.step, "unknown")
  const message = displayValue(state.message, noMessageFallback)
  const at = displayValue(state.at, "-")
  const snapshotId = state.snapshotId == null ? null : String(state.snapshotId)
  return { status, step, message, at, snapshotId }
}

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

type OperationsBadgeVariant = "success" | "outline" | "warning"

const workflowBadgeVariant = (state: string): OperationsBadgeVariant => {
  if (state === "Live") return "success"
  if (state === "Needs attention") return "warning"
  return "outline"
}

const statusBadge = (variant: OperationsBadgeVariant, label: string) => (
  <Badge
    variant={variant}
    className={variant === "outline" ? "border-foreground/35 text-foreground" : undefined}
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
  const [t, locale] = await Promise.all([getTranslations("generationOperations"), getLocale()])
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
  const automationState = postPaymentAutomationState(run.errors, t("fallbacks.noMessage"))
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
    t("fallbacks.noDomain"),
  )
  const isLive = Boolean(lifecycle.activeSnapshotId)
  const summary = workflowSummaryForGenerationRun(run)
  const summaryLabel = summary.state === "Preview ready"
    ? t("states.Preview ready")
    : summary.state === "Checkout completed"
      ? t("states.Checkout completed")
      : summary.state === "Live"
        ? t("states.Live")
        : t("states.Needs attention")
  const previewPages = pageRecords
    .map((page) => {
      const pageId = relationId(page)
      if (!pageId) return null
      return {
        id: pageId,
        label: relationLabel(page, t("fallbacks.page")),
        slug: relationSlug(page),
      }
    })
    .filter((page): page is { id: string; label: string; slug: string | null } => Boolean(page))
  const previewDisabledReason =
    run.status !== "preview_ready"
      ? t("preview.disabled.notReady")
      : !tenantId
        ? t("preview.disabled.noTenant")
        : previewPages.length === 0
          ? t("preview.disabled.noPages")
          : null
  const previewClientSlug = lifecycle.tenant
    ? previewClientSlugFromDomain(lifecycle.tenant.domain, tenantSlug ?? relationLabel(run.tenant))
    : null
  const customerPreviewUrl = previewClientSlug ? `https://preview.siteinabox.nl/${previewClientSlug}` : null
  const liveUrl = lifecycle.tenant?.domain ? `https://${lifecycle.tenant.domain}` : null
  const defaultPreviewEmail = intakeContactEmail(run.intakeSubmission)
  const readyToGoLive = Boolean(tenantId) && lifecycle.publishBlockers.length === 0 && lifecycle.blockers.length === 0
  const checkoutComplete = isApproved && paymentSatisfied
  const statusSteps = [
    {
      id: "preview" as const,
      label: t("steps.preview"),
      complete: !previewDisabledReason,
      icon: ExternalLink,
    },
    {
      id: "checkout" as const,
      label: t("steps.checkout"),
      complete: paymentSatisfied,
      icon: CreditCard,
    },
    {
      id: "provisioning" as const,
      label: t("steps.provisioning"),
      complete: domainVerified && emailSendingVerified,
      icon: Globe2,
    },
    {
      id: "live" as const,
      label: t("steps.live"),
      complete: isLive,
      icon: CheckCircle2,
    },
  ]
  const retrySteps = [
    { step: "mollie_subscription" as const, label: t("recovery.retrySubscription"), helper: t("recovery.retrySubscriptionHelp") },
    { step: "domain_provisioning" as const, label: t("recovery.retryDomain"), helper: t("recovery.retryDomainHelp") },
    { step: "refresh_provisioning" as const, label: t("recovery.refreshProvisioning"), helper: t("recovery.refreshProvisioningHelp") },
    { step: "publish_activate" as const, label: t("recovery.retryPublish"), helper: t("recovery.retryPublishHelp") },
  ]
  const activeStatusStep = [...statusSteps].reverse().find((step) => step.complete)?.id ?? null
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("detail.title", { id: run.id })}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge
              variant={workflowBadgeVariant(summary.state)}
              className={summary.state !== "Live" && summary.state !== "Needs attention" ? "border-foreground/35 text-foreground" : undefined}
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {summaryLabel}
            </Badge>
            <span>{relationLabel(run.tenant, t("fallbacks.noTenant"))}</span>
          </span>
        }
        action={
          <Button asChild variant="outline">
            <Link href="/operations/runs">
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              {t("actions.back")}
            </Link>
          </Button>
        }
      />

      <OperationsRouteTabs activePath="/operations/runs" />

      {run.status === "failed" && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>{t("failure.title")}</AlertTitle>
          <AlertDescription>
            {t("failure.description")}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-2 xl:items-stretch">
        <ResponsiveOperationsCard
          title={t("preview.title")}
          defaultOpen
          contentClassName="grid gap-3 text-sm"
        >
          <div className="grid gap-3">
            <div>
              <div className="font-medium">{t("preview.email")}</div>
              <div className="text-muted-foreground">
                {t("preview.help")}
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
                  {t("actions.liveSite")}
                </a>
              </Button>
            )}
          </div>
        </ResponsiveOperationsCard>

        <ResponsiveOperationsCard
          title={t("client.title")}
          contentClassName="grid gap-4 text-sm lg:grid-cols-[1.3fr_1fr] xl:grid-cols-1"
        >
          <div className="grid gap-2">
            <div className="text-base font-medium">{relationLabel(run.tenant, t("draftSite"))}</div>
            <div className="text-muted-foreground">{defaultPreviewEmail ?? t("fallbacks.noIntakeEmail")}</div>
            <div className="break-all text-muted-foreground">{domainOrderDomain}</div>
          </div>
          <div className="grid gap-2 rounded-md bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <span>{t("client.payment")}</span>
              {statusBadge(paymentSatisfied ? "success" : "outline", displayStatus(payment.status))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{t("client.approval")}</span>
              {statusBadge(isApproved ? "success" : "outline", isApproved ? t("statuses.approved") : t("statuses.waiting"))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>{t("steps.live")}</span>
              {statusBadge(isLive ? "success" : "outline", isLive ? t("statuses.live") : t("statuses.notLive"))}
            </div>
          </div>
        </ResponsiveOperationsCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.status")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <CheckoutStepper
            steps={statusSteps.map(({ id, label, icon }) => ({ id, label, icon }))}
            activeStep={activeStatusStep}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sections.advanced")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground group-open:text-foreground">
              {t("sections.diagnostics")}
            </summary>
            <div className="mt-4 grid gap-4">
              <Alert>
                <RotateCcw className="size-4" aria-hidden />
                <AlertTitle>{t("recovery.title")}</AlertTitle>
                <AlertDescription>
                  {t("recovery.description")}
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{t("recovery.postPayment")}</div>
                    <div className="text-muted-foreground">
                      {t("recovery.postPaymentHelp")}
                    </div>
                  </div>
                  <Badge variant={automationState?.status === "activated" ? "success" : automationState?.status === "failed" ? "destructive" : "secondary"}>
                    {automationState ? displayStatus(automationState.status) : t("statuses.notRecorded")}
                  </Badge>
                </div>

                {automationState ? (
                  <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs md:grid-cols-2">
                    <div>
                      <div className="text-muted-foreground">{t("labels.step")}</div>
                      <div className="font-medium">{displayStatus(automationState.step)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t("columns.updated")}</div>
                      <div className="font-medium">{formatDate(automationState.at, locale)}</div>
                    </div>
                    {automationState.snapshotId && (
                      <div>
                        <div className="text-muted-foreground">{t("labels.snapshot")}</div>
                        <div className="font-medium">{automationState.snapshotId}</div>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <div className="text-muted-foreground">{t("labels.message")}</div>
                      <div className="font-medium">{automationState.message}</div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    {t("recovery.noStatus")}
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
                    {t("recovery.paymentRequired")}
                  </div>
                )}
              </div>

              <div id="checkout" className="grid gap-3 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t("checkout.title")}</div>
                    <div className="text-muted-foreground">
                      {t("checkout.description")}
                    </div>
                  </div>
                  <Badge variant={checkoutComplete ? "success" : "secondary"}>
                    {checkoutComplete ? t("statuses.approvedPaid") : isApproved ? displayStatus(payment.status) : t("statuses.waitingApproval")}
                  </Badge>
                </div>

                <form action={createGenerationRunMollieCheckoutAction.bind(null, run.id)} className="grid gap-3 rounded-md border p-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="mollie-customer-email">{t("checkout.customerEmail")}</Label>
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
                    {t("checkout.createLink")}
                  </Button>
                </form>

                <form action={recordGenerationRunPaymentAction.bind(null, run.id, "completed")} className="grid gap-3 rounded-md border p-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="payment-note">{t("labels.note")}</Label>
                    <Textarea id="payment-note" name="note" defaultValue={payment.note ?? ""} rows={3} />
                  </div>
                  <input type="hidden" name="provider" value={payment.provider ?? "manual"} />
                  <input type="hidden" name="externalReference" value={payment.externalReference ?? ""} />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={payment.status === "completed"}>
                      <CreditCard className="mr-1 size-4" aria-hidden />
                      {t("checkout.paymentReceived")}
                    </Button>
                    <Button
                      type="submit"
                      variant="outline"
                      formAction={recordGenerationRunPaymentAction.bind(null, run.id, "waived")}
                      disabled={payment.status === "waived"}
                    >
                      <ShieldCheck className="mr-1 size-4" aria-hidden />
                      {t("checkout.waivePayment")}
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
                        <div className="font-medium">{t("domain.title")}</div>
                        <div className="text-muted-foreground">
                          {t("domain.description")}
                        </div>
                      </div>
                      <Badge variant={domainVerified ? "success" : "secondary"}>
                        {String(domainCheck?.status ?? "not_checked")}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{t("domain.primary")}</div>
                      <div className="font-medium break-all">{lifecycle.tenant.domain}</div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="domain-verification-status">{t("labels.status")}</Label>
                        <select
                          id="domain-verification-status"
                          name="status"
                          defaultValue={String(domainCheck?.status ?? "not_checked")}
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="not_checked">{t("statuses.notChecked")}</option>
                          <option value="verified">{t("statuses.verified")}</option>
                          <option value="failed">{t("statuses.failed")}</option>
                        </select>
                      </div>
                      <div className="grid gap-1.5 md:col-span-2">
                        <Label htmlFor="domain-verification-notes">{t("labels.notes")}</Label>
                        <Textarea
                          id="domain-verification-notes"
                          name="notes"
                          defaultValue={typeof domainCheck?.notes === "string" ? domainCheck.notes : ""}
                          rows={2}
                          placeholder={t("domain.notesPlaceholder")}
                        />
                      </div>
                    </div>
                    <Button type="submit" variant="outline">
                      <ShieldCheck className="mr-1 size-4" aria-hidden />
                      {t("domain.check")}
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-md border p-3 text-muted-foreground">{t("domain.linkTenant")}</div>
                )}
              </div>

              <form action={publishGenerationRunSnapshotAction.bind(null, run.id, tenantId ?? "")} className="flex flex-wrap gap-2 rounded-md border p-3">
                <input type="hidden" name="reason" value="go live from manager dashboard" />
                <input type="hidden" name="activate" value="on" />
                <Button type="submit" disabled={!readyToGoLive || isLive}>
                  <UploadCloud className="mr-1 size-4" aria-hidden />
                  {t("actions.launchSite")}
                </Button>
                {isLive && liveUrl && (
                  <Button asChild variant="outline">
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 size-4" aria-hidden />
                      {t("steps.live")}
                    </a>
                  </Button>
                )}
              </form>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium">{t("labels.started")}</div>
                  <div className="mt-2 text-sm">{formatDate(run.startedAt, locale)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium">{t("labels.completed")}</div>
                  <div className="mt-2 text-sm">{formatDate(run.completedAt, locale)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium">{t("labels.validationIssues")}</div>
                  <div className="mt-2 text-2xl font-semibold">{new Intl.NumberFormat(locale).format(validationIssueCount)}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium">{t("labels.applyIssues")}</div>
                  <div className="mt-2 text-2xl font-semibold">{new Intl.NumberFormat(locale).format(applyIssueCount)}</div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-3 font-medium">{t("metadata.title")}</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-muted-foreground">{t("labels.status")}</div>
                    <div className="font-medium">{run.status}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("metadata.providerModel")}</div>
                    <div className="font-medium">{run.provider} / {run.model}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("metadata.promptVersion")}</div>
                    <div className="font-medium">{run.promptVersion}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("metadata.attempts")}</div>
                    <div className="font-medium">{new Intl.NumberFormat(locale).format(run.generationAttempts ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("metadata.settings")}</div>
                    <div className="font-medium">{settingsId ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("metadata.run")}</div>
                    <div className="font-medium">{run.id}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("metadata.inputHash")}</div>
                    <code className="break-all text-xs">{run.generationInputHash}</code>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("metadata.outputHash")}</div>
                    <code className="break-all text-xs">{run.generationOutputHash ?? "-"}</code>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("metadata.intakeHash")}</div>
                    <code className="break-all text-xs">{run.normalizedIntakeHash}</code>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("metadata.specHash")}</div>
                    <code className="break-all text-xs">{run.specHash ?? "-"}</code>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{t("promotion.title")}</div>
                    <div className="text-muted-foreground">
                      {t("promotion.description")}
                    </div>
                  </div>
                  <form action={promoteGenerationRunPagesAction.bind(null, run.id)}>
                    <Button type="submit" disabled={!isApproved || pageRecords.length === 0}>
                      <CheckCircle2 className="mr-1 size-4" aria-hidden />
                      {t("promotion.action")}
                    </Button>
                  </form>
                </div>
                {!isApproved && (
                  <div className="text-xs text-muted-foreground">{t("promotion.approvalRequired")}</div>
                )}
                {promoted && (
                  <div className="text-xs text-muted-foreground">
                    {t("promotion.lastPromoted", { date: formatDate(typeof promoted.promotedAt === "string" ? promoted.promotedAt : null, locale) })}
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="mb-3 font-medium">{t("technical.validation")}</div>
                  <div>
                    <JsonSummaryBlock value={run.validation} />
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-3 font-medium">{t("technical.applyResult")}</div>
                  <div>
                    <JsonSummaryBlock value={run.applyResult} />
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-3 font-medium">{t("technical.errors")}</div>
                  <div>
                    <JsonSummaryBlock value={run.errors} />
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="mb-3 font-medium">{t("technical.approvalPayment")}</div>
                  <div>
                    <JsonSummaryBlock value={{ clientApproval: run.clientApproval, payment: run.payment }} />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{t("snapshots.title")}</div>
                    <div className="text-muted-foreground">
                      {t("snapshots.description")}
                    </div>
                  </div>
                  <Badge variant={lifecycle.publishBlockers.length === 0 ? "success" : "secondary"}>
                    {lifecycle.publishBlockers.length === 0 ? t("statuses.publishable") : t("statuses.blocked")}
                  </Badge>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="text-muted-foreground">{t("snapshots.tenantStatus")}</div>
                    <div className="font-medium">{lifecycle.tenant?.status ?? "-"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("snapshots.domainVerification")}</div>
                    <div className="font-medium">{String(domainCheck?.status ?? "-")}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("snapshots.linkedPages")}</div>
                    <div className="font-medium">
                      {lifecycle.linkedPages.filter((page) => page.status === "published").length} / {pageRecords.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t("snapshots.active")}</div>
                    <div className="font-medium">{lifecycle.activeSnapshotId ?? t("statuses.none")}</div>
                  </div>
                </div>

                {(lifecycle.publishBlockers.length > 0 || lifecycle.blockers.length > 0 || lifecycle.manualBlockers.length > 0) && (
                  <div className="grid gap-2 rounded-md bg-muted/40 p-3 text-xs">
                    {lifecycle.publishBlockers.map((blocker) => (
                      <div key={blocker}>{t("snapshots.publishBlocker", { blocker })}</div>
                    ))}
                    {lifecycle.blockers.map((blocker) => (
                      <div key={blocker}>{t("snapshots.activationBlocker", { blocker })}</div>
                    ))}
                    {lifecycle.manualBlockers.map((blocker) => (
                      <div key={blocker}>{t("snapshots.manualBlocker", { blocker })}</div>
                    ))}
                  </div>
                )}

                {lifecycle.snapshots.length === 0 && (
                  <Alert>
                    <AlertCircle className="size-4" aria-hidden />
                    <AlertTitle>{t("snapshots.noneTitle")}</AlertTitle>
                    <AlertDescription>{t("snapshots.noneDescription")}</AlertDescription>
                  </Alert>
                )}
                {lifecycle.snapshots.length > 0 && !lifecycle.activeSnapshotId && (
                  <Alert>
                    <AlertCircle className="size-4" aria-hidden />
                    <AlertTitle>{t("snapshots.noActiveTitle")}</AlertTitle>
                    <AlertDescription>{t("snapshots.noActiveDescription")}</AlertDescription>
                  </Alert>
                )}

                <form action={publishGenerationRunSnapshotAction.bind(null, run.id, tenantId ?? "")} className="grid gap-3 border-t pt-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="publish-reason">{t("labels.reason")}</Label>
                    <Textarea id="publish-reason" name="reason" rows={2} placeholder={t("snapshots.reasonPlaceholder")} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="activate" className="size-4" />
                    {t("snapshots.publishActivate")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="manualActivation" className="size-4" />
                    {t("snapshots.manualOverride")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={!tenantId || lifecycle.publishBlockers.length > 0}>
                      <UploadCloud className="mr-1 size-4" aria-hidden />
                      {t("snapshots.publish")}
                    </Button>
                  </div>
                </form>
              </div>

              <div className="overflow-hidden rounded-md border">
                <div className="grid grid-cols-12 gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-3">{t("labels.snapshot")}</div>
                  <div className="col-span-2">{t("labels.status")}</div>
                  <div className="col-span-1">{t("labels.version")}</div>
                  <div className="col-span-3">{t("labels.published")}</div>
                  <div className="col-span-3">{t("columns.actions")}</div>
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
                      <div className="col-span-6 md:col-span-3">{formatDate(snapshot.publishedAt, locale)}</div>
                      <div className="col-span-12 flex flex-col gap-2 md:col-span-3">
                        <form action={activateSnapshotAction.bind(null, run.id, snapshot.id)} className="grid gap-2">
                          <input type="hidden" name="reason" value={`activate snapshot ${snapshot.id}`} />
                          <Button type="submit" size="sm" variant="outline" disabled={!canActivateNormally}>
                            <PlayCircle className="mr-1 size-4" aria-hidden />
                            {t("snapshots.activate")}
                          </Button>
                        </form>
                        <form action={activateSnapshotAction.bind(null, run.id, snapshot.id)} className="grid gap-2">
                          <input type="hidden" name="reason" value={`manual activate snapshot ${snapshot.id}`} />
                          <input type="hidden" name="manualActivation" value="true" />
                          <Button type="submit" size="sm" variant="outline" disabled={!canManualActivate}>
                            <ShieldCheck className="mr-1 size-4" aria-hidden />
                            {t("snapshots.manualActivation")}
                          </Button>
                        </form>
                        <form action={rollbackSnapshotAction.bind(null, run.id, snapshot.id)} className="grid gap-2">
                          <input type="hidden" name="reason" value={`rollback to snapshot ${snapshot.id}`} />
                          <Button type="submit" size="sm" variant="outline" disabled={!canRollbackNormally}>
                            <RotateCcw className="mr-1 size-4" aria-hidden />
                            {t("snapshots.rollback")}
                          </Button>
                        </form>
                        <form action={rollbackSnapshotAction.bind(null, run.id, snapshot.id)} className="grid gap-2">
                          <input type="hidden" name="reason" value={`manual rollback to snapshot ${snapshot.id}`} />
                          <input type="hidden" name="manualActivation" value="true" />
                          <Button type="submit" size="sm" variant="outline" disabled={!canManualRollback}>
                            <ShieldCheck className="mr-1 size-4" aria-hidden />
                            {t("snapshots.manualRollback")}
                          </Button>
                        </form>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-3 font-medium">{t("transitions.title")}</div>
                <div className="flex flex-col gap-2">
                  {workflow(run.statusTransitions).map((entry, index) => (
                    <div key={entry.id ?? `${entry.status}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
                      <span className="text-muted-foreground">{formatDate(entry.at, locale)}</span>
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
