import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@siteinabox/ui/components/badge"
import { Button } from "@siteinabox/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@siteinabox/ui/components/card"
import { Alert, AlertDescription, AlertTitle } from "@siteinabox/ui/components/alert"
import { Input } from "@siteinabox/ui/components/input"
import { Label } from "@siteinabox/ui/components/label"
import { Textarea } from "@siteinabox/ui/components/textarea"
import { JsonSummaryBlock } from "@/components/generation/JsonSummaryBlock"
import { PreviewAccessShare } from "@/components/generation/PreviewAccessShare"
import { PageHeader } from "@/components/page-header"
import { updateTenantDomainVerificationAction } from "@/lib/actions/domainVerification"
import { createGenerationRunMollieCheckoutAction, recordGenerationRunPaymentAction } from "@/lib/actions/generationRunPayment"
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
  FileText,
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

const domainVerification = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as { status?: unknown; checkedAt?: unknown; checkedBy?: unknown; notes?: unknown }
    : null

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

const checklistBadge = (done: boolean, next: boolean) => {
  if (done) return <Badge variant="success">Done</Badge>
  if (next) return <Badge variant="default">Next</Badge>
  return <Badge variant="secondary">Waiting</Badge>
}

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
  const paymentSatisfied = payment.status === "completed" || payment.status === "waived"
  const promoted = promotionSummary(run.applyResult)
  const lifecycle = await getSnapshotLifecycleForGenerationRun(run)
  const domainCheck = domainVerification(lifecycle.tenant?.domainVerification)
  const domainVerified = domainCheck?.status === "verified"
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
  const draftReady = ["draft_ready", "preview_ready"].includes(run.status) || pageRecords.length > 0 || isLive
  const nextAction = summary.primaryAction
  const preparedPageCount = lifecycle.linkedPages.filter((page) => page.status === "published").length
  const pagesNeedPrepared = pageRecords.length > 0 && preparedPageCount < pageRecords.length
  const readyToGoLive = Boolean(tenantId) && lifecycle.publishBlockers.length === 0 && lifecycle.blockers.length === 0
  const checklist = [
    {
      label: "Open site",
      done: draftReady,
      helper: draftReady ? "Draft pages are available for review." : "The draft site is still being prepared.",
    },
    {
      label: "Send preview",
      done: isApproved || paymentSatisfied || domainVerified || isLive,
      helper: isApproved ? "Client approval is recorded." : "Share the preview and wait for approval.",
    },
    {
      label: "Prepare pages",
      done: !pagesNeedPrepared,
      helper: pagesNeedPrepared ? "Prepare the approved pages for launch." : "Pages are ready for launch.",
    },
    {
      label: "Payment",
      done: paymentSatisfied,
      helper: paymentSatisfied ? "Payment is complete or waived." : "Create a payment link or record a waiver.",
    },
    {
      label: "Domain verified",
      done: domainVerified || isLive,
      helper: domainVerified ? "Domain check is marked verified." : "Confirm DNS before going live.",
    },
    {
      label: "Go live",
      done: isLive,
      helper: isLive ? "The site has an active live version." : "Finish this step once all gates are clear.",
    },
    {
      label: "Live",
      done: isLive,
      helper: isLive ? "The live site is ready for visitors." : "Not live yet.",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Draft site #${run.id}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(run.status)}>
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

      <Card>
        <CardHeader>
          <CardTitle>Next action</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-lg font-semibold">{nextAction}</div>
            <div className="text-muted-foreground">{summary.helper}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {customerPreviewUrl && (
              <Button asChild variant={nextAction === "Open site" ? "default" : "outline"}>
                <a href={customerPreviewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 size-4" aria-hidden />
                  Open site
                </a>
              </Button>
            )}
            {isLive && liveUrl && (
              <Button asChild>
                <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 size-4" aria-hidden />
                  Live
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lifecycle checklist</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {checklist.map((step) => (
            <div key={step.label} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{step.label}</div>
                {checklistBadge(step.done, !step.done && step.label === nextAction)}
              </div>
              <div className="mt-2 text-muted-foreground">{step.helper}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <PreviewAccessShare
            generationRunId={run.id}
            defaultEmail={defaultPreviewEmail}
            previewUrl={customerPreviewUrl}
            disabledReason={previewDisabledReason}
          />
          <div>
            Tenant:{" "}
            {tenantSlug ? (
              <Link href={`/sites/${tenantSlug}`} className="font-medium hover:underline">
                {relationLabel(run.tenant)}
              </Link>
            ) : tenantId ? (
              <span className="font-medium">{relationLabel(run.tenant)}</span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div>Pages: {pageRecords.length}</div>
            <div className="flex flex-wrap gap-2">
              {pageRecords.map((page) => {
                const pageId = relationId(page)
                const label = relationLabel(page, "Page")
                return pageId && tenantSlug ? (
                  <Button key={pageId} asChild variant="outline" size="sm">
                    <Link href={`/sites/${tenantSlug}/pages/${pageId}`}>
                      <FileText className="mr-1 size-4" aria-hidden />
                      {label}
                    </Link>
                  </Button>
                ) : (
                  <Badge key={pageId ?? label} variant="secondary">{label}</Badge>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent id="payment" className="grid gap-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <div className="font-medium">Payment status</div>
                <div className="text-muted-foreground">
                  Mollie completion or manual waiver satisfies the payment gate. Payment does not make the site live.
                </div>
              </div>
              <Badge variant={paymentSatisfied ? "success" : "secondary"}>{displayStatus(payment.status)}</Badge>
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
                Payment
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Domain</CardTitle>
          </CardHeader>
          <CardContent id="domain" className="grid gap-3 text-sm">
            {tenantId && lifecycle.tenant ? (
              <form
                action={updateTenantDomainVerificationAction.bind(null, run.id, tenantId)}
                className="grid gap-3 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">Domain verified</div>
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
                  Domain verified
                </Button>
              </form>
            ) : (
              <div className="rounded-md border p-3 text-muted-foreground">Link a tenant before checking the domain.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Go live</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="grid gap-3">
            <div className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Client approval</div>
                  <div className="text-muted-foreground">
                    {isApproved ? "The customer has approved this site." : "Send the preview and wait for customer approval."}
                  </div>
                </div>
                <Badge variant={isApproved ? "success" : "secondary"}>{isApproved ? "Done" : "Waiting"}</Badge>
              </div>
              {!isApproved && customerPreviewUrl && (
                <div className="mt-3">
                  <Button asChild variant="outline">
                    <a href={customerPreviewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 size-4" aria-hidden />
                      Open preview
                    </a>
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Prepare pages</div>
                  <div className="text-muted-foreground">
                    {pagesNeedPrepared
                      ? isApproved
                        ? "Prepare the approved pages for launch."
                        : "Customer approval is required before pages can be prepared."
                      : "Pages are ready for launch."}
                  </div>
                </div>
                <Badge variant={!pagesNeedPrepared ? "success" : "secondary"}>{!pagesNeedPrepared ? "Done" : "Waiting"}</Badge>
              </div>
              {pagesNeedPrepared && (
                <form action={promoteGenerationRunPagesAction.bind(null, run.id)} className="mt-3">
                  <Button type="submit" variant="outline" disabled={!isApproved || pageRecords.length === 0}>
                    <CheckCircle2 className="mr-1 size-4" aria-hidden />
                    Prepare pages
                  </Button>
                </form>
              )}
            </div>

            <div className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Payment</div>
                  <div className="text-muted-foreground">
                    {paymentSatisfied ? "Payment is complete or waived." : "Complete payment before launch."}
                  </div>
                </div>
                <Badge variant={paymentSatisfied ? "success" : "secondary"}>{paymentSatisfied ? "Done" : "Waiting"}</Badge>
              </div>
              {!paymentSatisfied && (
                <div className="mt-3">
                  <Button asChild variant="outline">
                    <a href="#payment">
                      <CreditCard className="mr-1 size-4" aria-hidden />
                      Payment
                    </a>
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Domain</div>
                  <div className="text-muted-foreground">
                    {domainVerified ? "The customer domain has been checked." : "Check the customer domain before launch."}
                  </div>
                </div>
                <Badge variant={domainVerified ? "success" : "secondary"}>{domainVerified ? "Done" : "Waiting"}</Badge>
              </div>
              {!domainVerified && (
                <div className="mt-3">
                  <Button asChild variant="outline">
                    <a href="#domain">
                      <ShieldCheck className="mr-1 size-4" aria-hidden />
                      Check domain
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {!readyToGoLive && !isLive && (
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              Finish the waiting checks above before going live. Details are in Advanced.
            </div>
          )}

          <form action={publishGenerationRunSnapshotAction.bind(null, run.id, tenantId ?? "")} className="flex flex-wrap gap-2">
            <input type="hidden" name="reason" value="go live from manager dashboard" />
            <input type="hidden" name="activate" value="on" />
            <Button type="submit" disabled={!readyToGoLive || isLive}>
              <UploadCloud className="mr-1 size-4" aria-hidden />
              Go live
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
                <AlertTitle>Retry follow-up</AlertTitle>
                <AlertDescription>
                  No retry action is exposed here because the current intake service only retries during initial draft preparation.
                </AlertDescription>
              </Alert>

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
