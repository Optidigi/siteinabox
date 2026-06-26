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
} from "@/lib/queries/generationOperations"
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, FileText, PlayCircle, RotateCcw, ShieldCheck, UploadCloud } from "lucide-react"

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
      ? "Preview links are available after the run reaches preview_ready."
      : !tenantId
        ? "Preview links require a linked tenant."
        : previewPages.length === 0
          ? "Preview links require at least one linked page."
          : null
  const previewClientSlug = lifecycle.tenant
    ? previewClientSlugFromDomain(lifecycle.tenant.domain, tenantSlug ?? relationLabel(run.tenant))
    : null
  const customerPreviewUrl = previewClientSlug ? `https://preview.siteinabox.nl/${previewClientSlug}` : null
  const defaultPreviewEmail = intakeContactEmail(run.intakeSubmission)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Generation run #${run.id}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(run.status)}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {run.status}
            </Badge>
            <span>{run.provider}</span>
            <span className="text-muted-foreground">{run.model}</span>
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
          <AlertTitle>Generation failed</AlertTitle>
          <AlertDescription>
            Review the summarized error, validation, and apply result below. Raw provider output is intentionally not shown in this control-plane view.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <RotateCcw className="size-4" aria-hidden />
        <AlertTitle>Retry follow-up</AlertTitle>
        <AlertDescription>
          No retry action is exposed because the current intake service only retries during initial provider processing and then reuses identical failed runs by idempotency key.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Started</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{formatDate(run.startedAt)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{formatDate(run.completedAt)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Validation issues</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{validationIssueCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Apply issues</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{applyIssueCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Prompt version</div>
            <div className="font-medium">{run.promptVersion}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Attempts</div>
            <div className="font-medium">{run.generationAttempts ?? 0}</div>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated draft review</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <PreviewAccessShare
            generationRunId={run.id}
            defaultEmail={defaultPreviewEmail}
            previewUrl={customerPreviewUrl}
            disabledReason={previewDisabledReason}
          />
          <div className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">Promote selected run pages</div>
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
              <div className="mt-2 text-xs text-muted-foreground">Client approval is required before run pages can be promoted.</div>
            )}
            {promoted && (
              <div className="mt-2 text-xs text-muted-foreground">
                Last promoted {formatDate(typeof promoted.promotedAt === "string" ? promoted.promotedAt : null)}
              </div>
            )}
          </div>
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
          <div>Settings: {settingsId ?? "-"}</div>
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

      <Card>
        <CardHeader>
          <CardTitle>Snapshot lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <div className="grid gap-3 rounded-md border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium">Publish this generation run</div>
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
                <div className="font-medium">
                  {String(domainCheck?.status ?? "-")}
                </div>
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

            {tenantId && lifecycle.tenant && (
              <form
                action={updateTenantDomainVerificationAction.bind(null, run.id, tenantId)}
                className="grid gap-3 border-t pt-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">Domain verification checklist</div>
                    <div className="text-muted-foreground">
                      DNS remains manual. Confirm the customer domain and any aliases point at the renderer before marking verified.
                    </div>
                  </div>
                  <Badge variant={domainCheck?.status === "verified" ? "success" : "secondary"}>
                    {String(domainCheck?.status ?? "not_checked")}
                  </Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <div className="text-muted-foreground">Primary domain</div>
                    <div className="font-medium break-all">{lifecycle.tenant.domain}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Checked at</div>
                    <div className="font-medium">{formatDate(typeof domainCheck?.checkedAt === "string" ? domainCheck.checkedAt : null)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Checked by</div>
                    <div className="font-medium">{relationLabel(domainCheck?.checkedBy, "-")}</div>
                  </div>
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
                    <Label htmlFor="domain-verification-notes">Operator notes</Label>
                    <Textarea
                      id="domain-verification-notes"
                      name="notes"
                      defaultValue={typeof domainCheck?.notes === "string" ? domainCheck.notes : ""}
                      rows={2}
                      placeholder="Observed DNS target, proxy route, alias check, or failure reason"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="outline">
                    <ShieldCheck className="mr-1 size-4" aria-hidden />
                    Save domain check
                  </Button>
                </div>
              </form>
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
                        Activate
                      </Button>
                    </form>
                    <form action={activateSnapshotAction.bind(null, run.id, snapshot.id)} className="grid gap-2">
                      <input type="hidden" name="reason" value={`manual activate snapshot ${snapshot.id}`} />
                      <input type="hidden" name="manualActivation" value="true" />
                      <Button type="submit" size="sm" variant="outline" disabled={!canManualActivate}>
                        <ShieldCheck className="mr-1 size-4" aria-hidden />
                        Manual activate
                      </Button>
                    </form>
                    <form action={rollbackSnapshotAction.bind(null, run.id, snapshot.id)} className="grid gap-2">
                      <input type="hidden" name="reason" value={`rollback to snapshot ${snapshot.id}`} />
                      <Button type="submit" size="sm" variant="outline" disabled={!canRollbackNormally}>
                        <RotateCcw className="mr-1 size-4" aria-hidden />
                        Roll back
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
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Validation</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonSummaryBlock value={run.validation} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Apply result</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonSummaryBlock value={run.applyResult} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonSummaryBlock value={run.errors} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Client approval and payment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Operational payment gate</div>
                  <div className="text-muted-foreground">
                    Mollie completion or manual waiver satisfies the payment gate. Payment does not publish or activate a snapshot.
                  </div>
                </div>
                <Badge variant={paymentSatisfied ? "success" : "secondary"}>{displayStatus(payment.status)}</Badge>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <div className="text-muted-foreground">Provider</div>
                  <div className="font-medium">{payment.provider ?? "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">External reference</div>
                  <div className="font-medium break-all">{payment.externalReference ?? "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Completed at</div>
                  <div className="font-medium">{formatDate(payment.completedAt)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Waived at</div>
                  <div className="font-medium">{formatDate(payment.waivedAt)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Actor</div>
                  <div className="font-medium">{payment.actor ?? "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Updated</div>
                  <div className="font-medium">{formatDate(payment.updatedAt)}</div>
                </div>
              </div>
              {payment.note && <div className="text-muted-foreground">{payment.note}</div>}

              <form action={createGenerationRunMollieCheckoutAction.bind(null, run.id)} className="grid gap-3 border-t pt-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="mollie-customer-email">Mollie customer email</Label>
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
                  Create Mollie checkout
                </Button>
              </form>

              <form action={recordGenerationRunPaymentAction.bind(null, run.id, "completed")} className="grid gap-3 border-t pt-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="payment-provider">Provider</Label>
                    <Input id="payment-provider" name="provider" defaultValue={payment.provider ?? "manual"} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="payment-external-reference">External reference</Label>
                    <Input id="payment-external-reference" name="externalReference" defaultValue={payment.externalReference ?? ""} />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="payment-note">Operator note</Label>
                  <Textarea id="payment-note" name="note" defaultValue={payment.note ?? ""} rows={3} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={payment.status === "completed"}>
                    <CreditCard className="mr-1 size-4" aria-hidden />
                    Mark completed
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
            <JsonSummaryBlock value={{ clientApproval: run.clientApproval, payment: run.payment }} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status transitions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {workflow(run.statusTransitions).map((entry, index) => (
              <div key={entry.id ?? `${entry.status}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
                <span className="text-muted-foreground">{formatDate(entry.at)}</span>
                {entry.message && <span>{entry.message}</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
