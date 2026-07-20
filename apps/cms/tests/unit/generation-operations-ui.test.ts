import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  generationRunWhere,
  getGenerationOperationsOverview,
  intakeSubmissionWhere,
  listGenerationOperations,
  listOperationRuns,
  relationId,
  relationLabel,
  relationSlug,
  summarizeJson,
  workflowSummaryForGenerationRun,
  workflowSummaryForIntakeSubmission,
} from "@/lib/queries/generationOperations"

import { asGenerationRun, cast } from "../_helpers/cast"
import { asFindClient } from "../_helpers/payloadFindClient"
import { asPayload, type MockFindArgs } from "../_helpers/mockPayload"
const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")

describe("generation operations UI helpers", () => {
  it("builds manager workflow run filters", () => {
    expect(generationRunWhere("all")).toEqual({
      or: [
        { status: { equals: "failed" } },
        {
          or: [
            { status: { equals: "draft_ready" } },
            { status: { equals: "preview_ready" } },
          ],
        },
      ],
    })
    expect(generationRunWhere("needs-attention")).toEqual({ status: { equals: "failed" } })
    expect(generationRunWhere("preview-ready")).toEqual({
      or: [
        { status: { equals: "draft_ready" } },
        { status: { equals: "preview_ready" } },
      ],
    })
    expect(generationRunWhere("checkout-completed")).toEqual(generationRunWhere("preview-ready"))
    expect(generationRunWhere("live")).toEqual(generationRunWhere("preview-ready"))
  })

  it("stacks search with the selected run filter", () => {
    expect(generationRunWhere("needs-attention", "gpt")).toEqual({
      and: [
        { status: { equals: "failed" } },
        {
          or: [
            { idempotencyKey: { like: "gpt" } },
            { provider: { like: "gpt" } },
            { model: { like: "gpt" } },
            { promptVersion: { like: "gpt" } },
            { specHash: { like: "gpt" } },
          ],
        },
      ],
    })
  })

  it("builds intake filters with business and contact search fields", () => {
    expect(intakeSubmissionWhere("needs-attention", "sam@example.com")).toEqual({
      and: [
        { status: { equals: "failed" } },
        {
          or: [
            { businessName: { like: "sam@example.com" } },
            { contactEmail: { like: "sam@example.com" } },
            { contactName: { like: "sam@example.com" } },
            { idempotencyKey: { like: "sam@example.com" } },
            { normalizedHash: { like: "sam@example.com" } },
          ],
        },
      ],
    })
  })

  it("queries runs and intake submissions with the same pagination and filter", async () => {
    const calls: MockFindArgs[] = []
    const client = asFindClient({
      async find(args: MockFindArgs) {
        calls.push(args)
        return {
          docs: [],
          totalDocs: 0,
          totalPages: 1,
          page: args.page,
          limit: args.limit,
          hasNextPage: false,
          hasPrevPage: false,
          nextPage: null,
          prevPage: null,
        }
      },
    })

    await listGenerationOperations({ page: 3, pageSize: 20, filter: "preview-ready", q: "" }, client)

    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      collection: "site-generation-runs",
      page: 3,
      limit: 20,
      overrideAccess: true,
      depth: 2,
      sort: "-updatedAt",
    })
    expect(calls[1]).toMatchObject({
      collection: "intake-submissions",
      page: 3,
      limit: 20,
      overrideAccess: true,
      depth: 2,
      sort: "-updatedAt",
    })
    expect(calls[0]!.where).toEqual(generationRunWhere("preview-ready", ""))
    expect(calls[1]!.where).toEqual(intakeSubmissionWhere("preview-ready", ""))
  })

  it("redacts secret-looking and raw provider fields in JSON summaries", () => {
    const summary = summarizeJson({
      message: "provider failed",
      apiKey: "sk-live",
      nested: {
        authorization: "Bearer token",
        rawOutput: "long raw model response",
        safe: "shown",
      },
    })

    expect(summary.kind).toBe("object")
    expect(summary).toMatchObject({
      value: {
        message: "provider failed",
        apiKey: "[redacted]",
        nested: {
          authorization: "[redacted]",
          rawOutput: "[redacted]",
          safe: "shown",
        },
      },
    })
  })

  it("extracts relationship ids, labels, and slugs for generated draft links", () => {
    expect(relationId(12)).toBe("12")
    expect(relationId({ id: 9, slug: "demo", name: "Demo" })).toBe("9")
    expect(relationLabel({ id: 9, slug: "demo", name: "Demo" })).toBe("Demo")
    expect(relationLabel(null, "Draft site")).toBe("Draft site")
    expect(relationSlug({ id: 9, slug: "demo", name: "Demo" })).toBe("demo")
  })

  it("maps intake submissions to manager-facing workflow labels", () => {
    expect(workflowSummaryForIntakeSubmission({ status: "normalized", generationRun: null })).toMatchObject({
      state: "Needs attention",
      label: "Intake not processed",
      primaryAction: "Open client",
    })
    expect(workflowSummaryForIntakeSubmission({ status: "submitted", generationRun: null })).toMatchObject({
      state: "Needs attention",
      label: "Intake not processed",
      primaryAction: "Open client",
    })
    expect(workflowSummaryForIntakeSubmission({ status: "normalized", generationRun: null, reviewedGenerationInput: { status: "admin-approved" } })).toMatchObject({
      state: "Needs attention",
      label: "Generation recovery",
      primaryAction: "Open client",
    })
    expect(workflowSummaryForIntakeSubmission({ status: "queued", generationRun: null })).toMatchObject({
      state: "Needs attention",
      label: "Not actionable",
    })
    expect(workflowSummaryForIntakeSubmission({ status: "failed", generationRun: null })).toMatchObject({
      state: "Needs attention",
      primaryAction: "Open client",
    })
  })

  it("maps generation runs to manager-facing workflow labels", () => {
    expect(workflowSummaryForGenerationRun({ status: "draft_ready", tenant: null })).toMatchObject({
      state: "Preview ready",
      label: "Prepare preview",
      primaryAction: "Open client",
    })
    expect(workflowSummaryForGenerationRun({ status: "preview_ready", clientApproval: null, payment: null, tenant: null })).toMatchObject({
      state: "Preview ready",
      label: "Send preview",
      primaryAction: "Send preview",
    })
    expect(workflowSummaryForGenerationRun({
      status: "preview_ready",
      clientApproval: { status: "approved" },
      payment: null,
      tenant: null,
    })).toMatchObject({
      state: "Preview ready",
      label: "Checkout open",
      primaryAction: "Open client",
    })
    expect(workflowSummaryForGenerationRun({
      status: "preview_ready",
      clientApproval: { status: "approved" },
      payment: { status: "completed" },
      tenant: cast({ domainVerification: { status: "not_checked" } }),
    })).toMatchObject({
      state: "Checkout completed",
      label: "Provisioning",
      primaryAction: "Open client",
    })
    expect(workflowSummaryForGenerationRun({
      status: "preview_ready",
      clientApproval: { status: "approved" },
      payment: { status: "completed" },
      tenant: cast({ domainVerification: { status: "verified" } }),
    })).toMatchObject({
      state: "Checkout completed",
      label: "Activating",
      primaryAction: "Open client",
    })
    expect(workflowSummaryForGenerationRun({
      status: "preview_ready",
      tenant: cast({ activeSnapshot: 42 }),
    })).toMatchObject({
      state: "Live",
      label: "Live",
      primaryAction: "Open client",
    })
  })
})

describe("generation operations route access", () => {
  it("gates custom operations routes to super-admins", () => {
    for (const path of [
      "src/app/(frontend)/(admin)/operations/page.tsx",
      "src/app/(frontend)/(admin)/operations/intakes/page.tsx",
      "src/app/(frontend)/(admin)/operations/runs/page.tsx",
      "src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx",
      "src/app/(frontend)/(admin)/generation-runs/submissions/[id]/page.tsx",
    ]) {
      expect(read(path)).toContain('requireRole(["super-admin"])')
    }
  })

  it("keeps generation-run payment mutations super-admin only with Mollie isolated from Stripe", () => {
    const action = read("src/lib/actions/generationRunPayment.ts")
    const detail = read("src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx")

    expect(action).toContain('requireRole(["super-admin"])')
    expect(action).toContain('"completed"')
    expect(action).toContain('"waived"')
    expect(action).toContain("createMollieCheckoutForGenerationRun")
    expect(action).not.toMatch(/stripe/i)
    expect(detail).toContain("<CreditCard")
    expect(detail).toContain("<ShieldCheck")
    expect(detail).toContain('t("checkout.description")')
    expect(detail).not.toMatch(/stripe/i)
  })

  it("exposes Phase 8 snapshot lifecycle controls behind super-admin server actions", () => {
    const action = read("src/lib/actions/publishSnapshots.ts")
    const detail = read("src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx")
    const query = read("src/lib/queries/publishOperations.ts")
    const visiblePanel = detail.slice(detail.indexOf('title={t("preview.title")}'), detail.indexOf('t("sections.advanced")'))
    const advancedPanel = detail.slice(detail.indexOf('t("sections.advanced")'))

    expect(action).toContain('requireRole(["super-admin"])')
    expect(action).toContain("publishSiteSnapshot")
    expect(action).toContain("activatePublishedSnapshot")
    expect(action).toContain("rollback: true")
    expect(detail).toContain('t("sections.advanced")')
    expect(visiblePanel).toContain('title={t("preview.title")}')
    expect(visiblePanel).toContain('title={t("client.title")}')
    expect(visiblePanel).toContain('t("sections.status")')
    expect(detail).toContain('label: t("steps.checkout")')
    expect(detail).toContain('label: t("steps.provisioning")')
    expect(detail).toContain('label: t("steps.live")')
    expect(visiblePanel).not.toContain("promoteGenerationRunPagesAction.bind(null, run.id)")
    expect(visiblePanel).not.toContain('disabled={!isApproved || pageRecords.length === 0}')
    expect(visiblePanel).not.toContain("Create checkout link")
    expect(visiblePanel).not.toContain("Check domain")
    expect(visiblePanel).not.toContain('name="activate" value="on"')
    expect(visiblePanel).not.toContain("<CardTitle>Payment")
    expect(visiblePanel).not.toContain("<CardTitle>Domain")
    expect(visiblePanel).not.toContain("Publish snapshot")
    expect(visiblePanel).not.toContain("Publish and activate immediately")
    expect(visiblePanel).not.toContain("Manual activation override for approval/payment only")
    expect(visiblePanel).not.toContain("Activate snapshot")
    expect(visiblePanel).not.toContain("Manual activation")
    expect(visiblePanel).not.toContain("Rollback snapshot")
    expect(visiblePanel).not.toContain("Manual rollback")
    expect(advancedPanel).toContain("promoteGenerationRunPagesAction.bind(null, run.id)")
    expect(advancedPanel).toContain('disabled={!isApproved || pageRecords.length === 0}')
    expect(advancedPanel).toContain('t("checkout.createLink")')
    expect(advancedPanel).toContain('t("domain.title")')
    expect(advancedPanel).toContain('t("domain.check")')
    expect(advancedPanel).toContain('t("actions.launchSite")')
    expect(advancedPanel).toContain('name="activate" value="on"')
    expect(advancedPanel).toContain('t("snapshots.publish")')
    expect(advancedPanel).toContain('t("snapshots.publishActivate")')
    expect(advancedPanel).toContain('t("snapshots.manualOverride")')
    expect(advancedPanel).toContain('t("snapshots.activate")')
    expect(advancedPanel).toContain('t("snapshots.manualActivation")')
    expect(advancedPanel).toContain('t("snapshots.rollback")')
    expect(advancedPanel).toContain('t("snapshots.manualRollback")')
    expect(query).toContain("canActivatePublishedSnapshot")
    expect(query).toContain("All pages linked to this run must be promoted")
  })

  it("exposes Phase 9 manual domain verification controls without DNS automation", () => {
    const action = read("src/lib/actions/domainVerification.ts")
    const detail = read("src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx")

    expect(action).toContain('requireRole(["super-admin"])')
    expect(action).toContain("domainVerification")
    expect(action).toContain("checkedAt")
    expect(action).toContain("checkedBy")
    expect(detail).toContain('t("domain.title")')
    expect(detail).toContain('t("domain.description")')
    expect(detail).toContain("updateTenantDomainVerificationAction")
    const verificationPanel = detail.slice(
      detail.indexOf('t("domain.title")'),
      detail.indexOf('t("actions.launchSite")'),
    )
    expect(verificationPanel).not.toMatch(/cloudflare|route53|dnsimple/i)
  })

  it("exposes manager-facing intake review and guarded deletion while public intake auto-generates", () => {
    const action = read("src/lib/actions/reviewIntakeSubmission.ts")
    const detail = read("src/app/(frontend)/(admin)/generation-runs/submissions/[id]/page.tsx")
    const intakeRoute = read("src/app/(payload)/api/intake/route.ts")

    expect(action).toContain('requireRole(["super-admin"])')
    expect(action).toContain("prepareReviewedGenerationInputUpdate")
    expect(action).toContain("deleteSafeIntakeSubmissionAction")
    expect(action).toContain("payload.delete")
    expect(action).toContain("user,")
    expect(action).not.toContain("overrideAccess: true")
    expect(action).toContain("This request already has a generation run")
    expect(action).toContain("This request already has a tenant")
    expect(detail).toContain('t("status.title")')
    expect(detail).toContain('t("status.openDraft")')
    expect(detail).toContain('t("recovery.title")')
    expect(detail).toContain('t("recovery.approveBrief")')
    expect(detail).toContain('t("recovery.rerun")')
    expect(detail).toContain('t("recovery.deleteSafe")')
    expect(detail.indexOf('t("advanced.title")')).toBeLessThan(detail.indexOf('t("recovery.title")'))
    expect(detail).not.toContain("Manager actions")
    expect(detail).not.toContain("Generate draft")
    expect(detail).toContain('t("businessFacts.title")')
    expect(detail).toContain('t("brief.title")')
    expect(detail).toContain('t("design.title")')
    expect(detail).toContain('t("notes.title")')
    expect(detail).toContain('t("advanced.title")')
    expect(detail).toContain('t("technical.requestKey")')
    expect(detail).toContain('t("technical.fingerprint")')
    expect(detail).not.toContain("Reviewed GenerationInput")
    expect(detail).not.toContain("Approve for generation")
    expect(detail).not.toContain("Idempotency key")
    expect(detail).not.toContain("Normalized hash")
    expect(detail).toContain("defaultReviewedGenerationInput")
    expect(intakeRoute).toContain("processStoredIntakeSubmission")
  })

  it("exposes post-payment automation recovery only in Advanced", () => {
    const list = read("src/app/(frontend)/(admin)/generation-runs/page.tsx")
    const detail = read("src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx")
    const action = read("src/lib/actions/postPaymentAutomation.ts")

    expect(list).not.toContain("processIntakeSubmission(")
    expect(detail).not.toContain("processIntakeSubmission(")
    expect(action).toContain('requireRole(["super-admin"])')
    expect(action).toContain("retryPostPaymentAutomation")
    expect(detail).toContain('t("recovery.title")')
    expect(detail).toContain('t("recovery.postPayment")')
    expect(detail).toContain('t("recovery.retrySubscription")')
    expect(detail).toContain('t("recovery.retryDomain")')
    expect(detail).toContain('t("recovery.refreshProvisioning")')
    expect(detail).toContain('t("recovery.retryPublish")')
  })

  it("exposes Better Auth preview access from the generation-run detail without adding review comments", () => {
    const detail = read("src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx")
    const share = read("src/components/generation/PreviewAccessShare.tsx")
    const action = read("src/lib/actions/previewAccess.ts")

    expect(detail).toContain("<PreviewAccessShare")
    expect(detail).toContain('run.status !== "preview_ready"')
    expect(detail).toContain("https://preview.siteinabox.nl/")
    expect(detail).toContain("previewClientSlugFromDomain")
    expect(share).toContain('t("sendPreview")')
    expect(share).toContain("navigator.clipboard.writeText")
    expect(action).toContain("previewAuth.api")
    expect(action).toContain("createOrRefreshPreviewGrant")
    expect(share).not.toMatch(/comment|feedback/i)
  })

  it("presents the detail page as a manager-facing draft-site workflow", () => {
    const detail = read("src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx")

    expect(detail).toContain('t("detail.title"')
    expect(detail).toContain('t("preview.title")')
    expect(detail).toContain("ResponsiveOperationsCard")
    expect(detail).toContain('title={t("client.title")}')
    expect(detail).toContain('t("sections.status")')
    expect(detail).toContain('t("preview.email")')
    expect(detail).not.toContain("Next action")
    expect(detail).not.toContain("Client/site summary")
    expect(detail).not.toContain("Operations status")
    expect(detail).not.toContain("Automatic generation")
    expect(detail).not.toContain("Client feedback")
    expect(detail).not.toContain("Payment/subscription")
    expect(detail).not.toContain("Domain order")
    expect(detail).not.toContain("Live status")
    expect(detail).toContain('t("checkout.createLink")')
    expect(detail).toContain('t("checkout.waivePayment")')
    expect(detail).toContain('t("steps.provisioning")')
    expect(detail).toContain('t("domain.title")')
    expect(detail).toContain('t("actions.launchSite")')
    expect(detail).not.toContain("<CardTitle>Payment")
    expect(detail).not.toContain("<CardTitle>Domain")
    const advanced = detail.indexOf('t("sections.advanced")')
    expect(advanced).toBeGreaterThan(-1)
    expect(detail.indexOf('t("checkout.createLink")')).toBeGreaterThan(advanced)
    expect(detail.indexOf('t("domain.title")')).toBeGreaterThan(advanced)
    expect(detail.indexOf('t("actions.launchSite")')).toBeGreaterThan(advanced)
    expect(detail.indexOf('t("metadata.providerModel")')).toBeGreaterThan(advanced)
    expect(detail.indexOf('t("metadata.inputHash")')).toBeGreaterThan(advanced)
    expect(detail.indexOf('t("technical.applyResult")')).toBeGreaterThan(advanced)
    expect(detail.indexOf('t("transitions.title")')).toBeGreaterThan(advanced)
    expect(detail.indexOf('t("snapshots.publish")')).toBeGreaterThan(advanced)
    expect(detail.indexOf('t("snapshots.manualActivation")')).toBeGreaterThan(advanced)
    expect(detail.indexOf('t("snapshots.rollback")')).toBeGreaterThan(advanced)
  })

  it("presents operations as a legal-style overview plus resource registers", () => {
    const overview = read("src/app/(frontend)/(admin)/operations/page.tsx")
    const intakes = read("src/app/(frontend)/(admin)/operations/intakes/page.tsx")
    const runs = read("src/app/(frontend)/(admin)/operations/runs/page.tsx")

    expect(overview).toContain("<OperationsRouteTabs")
    expect(overview).toContain("<OperationsStatusStrip")
    expect(overview).toContain("<OperationsAttentionTable")
    expect(intakes).toContain('activePath="/operations/intakes"')
    expect(intakes).toContain("<OperationsListToolbar")
    expect(intakes).toContain("<OperationsTableFrame")
    expect(runs).toContain('activePath="/operations/runs"')
    expect(runs).toContain("<OperationsListToolbar")
    expect(runs).toContain("<OperationsTableFrame")
  })

  it("redirects legacy generation-run URLs to canonical operations routes", () => {
    const config = read("next.config.mjs")
    expect(config).toContain('source: "/generation-runs"')
    expect(config).toContain('destination: "/operations"')
    expect(config).toContain('destination: "/operations/intakes/:id"')
    expect(config).toContain('destination: "/operations/runs/:id"')
  })
})

describe("operations overview and registers", () => {
  const result = (docs: unknown[]) => ({ docs, totalDocs: docs.length, totalPages: 1, page: 1, limit: 250, hasNextPage: false, hasPrevPage: false, nextPage: null, prevPage: null })

  it("computes overview metrics from the complete active data set", async () => {
    const client = asFindClient({
      async find(args: MockFindArgs) {
        if (args.collection === "site-generation-runs") return result([
          { id: 1, status: "draft_ready", updatedAt: "2026-07-14T10:00:00Z", tenant: { name: "Preview site" } },
          { id: 2, status: "failed", updatedAt: "2026-07-14T11:00:00Z", tenant: { name: "Broken site" } },
        ])
        return result([{ id: 3, status: "failed", businessName: "Broken intake", updatedAt: "2026-07-14T12:00:00Z" }])
      },
    })
    const overview = await getGenerationOperationsOverview(client)
    expect(overview.metrics.map((metric) => [metric.key, metric.value])).toEqual([
      ["preview-ready", 1], ["checkout-completed", 0], ["live", 0], ["needs-attention", 2],
    ])
    expect(overview.attention.map((row) => row.title)).toEqual(["Broken intake", "Broken site"])
  })

  it("filters site runs by derived workflow state before paginating", async () => {
    const client = asFindClient({ async find() { return result([
      { id: 1, status: "preview_ready", tenant: { activeSnapshot: 5 } },
      { id: 2, status: "failed", tenant: { name: "Broken" } },
      { id: 3, status: "draft_ready", tenant: { name: "Preview" } },
    ]) } })
    const runs = await listOperationRuns({ filter: "needs-attention", page: 1, pageSize: 1 }, client)
    expect(runs.totalDocs).toBe(1)
    expect(runs.docs[0]?.id).toBe(2)
  })
})
