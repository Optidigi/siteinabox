import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  generationRunWhere,
  intakeSubmissionWhere,
  listGenerationOperations,
  relationId,
  relationLabel,
  relationSlug,
  summarizeJson,
  workflowSummaryForGenerationRun,
  workflowSummaryForIntakeSubmission,
} from "@/lib/queries/generationOperations"

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")

describe("generation operations UI helpers", () => {
  it("builds manager workflow run filters", () => {
    expect(generationRunWhere("needs-attention")).toEqual({ status: { equals: "failed" } })
    expect(generationRunWhere("new-requests")).toEqual({
      or: [
        { status: { equals: "submitted" } },
        { status: { equals: "normalized" } },
      ],
    })
    expect(generationRunWhere("draft-sites")).toEqual({
      or: [
        { status: { equals: "queued" } },
        { status: { equals: "generating" } },
        { status: { equals: "generated" } },
        { status: { equals: "validating" } },
        { status: { equals: "applying" } },
        { status: { equals: "draft_ready" } },
      ],
    })
    expect(generationRunWhere("waiting-on-client")).toEqual({ status: { equals: "preview_ready" } })
    expect(generationRunWhere("ready-to-go-live")).toEqual({ status: { equals: "preview_ready" } })
    expect(generationRunWhere("live")).toEqual({ status: { equals: "preview_ready" } })
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
    expect(intakeSubmissionWhere("waiting-on-client", "sam@example.com")).toEqual({
      and: [
        { status: { equals: "preview_ready" } },
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
    const calls: any[] = []
    const client = {
      async find(args: any) {
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
    }

    await listGenerationOperations({ page: 3, pageSize: 20, filter: "waiting-on-client", q: "" }, client)

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
    expect(calls[0].where).toEqual(generationRunWhere("waiting-on-client", ""))
    expect(calls[1].where).toEqual(intakeSubmissionWhere("waiting-on-client", ""))
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
    expect(relationSlug({ id: 9, slug: "demo", name: "Demo" })).toBe("demo")
  })

  it("maps intake submissions to manager-facing workflow labels", () => {
    expect(workflowSummaryForIntakeSubmission({ status: "normalized", generationRun: null } as any)).toMatchObject({
      state: "New requests",
      label: "New request",
      primaryAction: "Approve brief",
    })
    expect(workflowSummaryForIntakeSubmission({ status: "submitted", generationRun: null } as any)).toMatchObject({
      state: "New requests",
      label: "New request",
      primaryAction: "Approve brief",
    })
    expect(workflowSummaryForIntakeSubmission({ status: "queued", generationRun: null } as any)).toMatchObject({
      state: "Draft sites",
      label: "Generate draft",
    })
    expect(workflowSummaryForIntakeSubmission({ status: "failed", generationRun: null } as any)).toMatchObject({
      state: "Needs attention",
      primaryAction: "Review intake",
    })
  })

  it("maps generation runs to manager-facing workflow labels", () => {
    expect(workflowSummaryForGenerationRun({ status: "draft_ready", tenant: null } as any)).toMatchObject({
      state: "Draft sites",
      label: "Draft site",
      primaryAction: "Open site",
    })
    expect(workflowSummaryForGenerationRun({ status: "preview_ready", clientApproval: null, payment: null, tenant: null } as any)).toMatchObject({
      state: "Waiting on client",
      label: "Send preview",
      primaryAction: "Send preview",
    })
    expect(workflowSummaryForGenerationRun({
      status: "preview_ready",
      clientApproval: { status: "approved" },
      payment: null,
      tenant: null,
    } as any)).toMatchObject({
      state: "Waiting on client",
      label: "Approved",
      primaryAction: "Waive payment",
    })
    expect(workflowSummaryForGenerationRun({
      status: "preview_ready",
      clientApproval: { status: "approved" },
      payment: { status: "completed" },
      tenant: { domainVerification: { status: "not_checked" } },
    } as any)).toMatchObject({
      state: "Waiting on client",
      label: "Payment",
      primaryAction: "Domain verified",
    })
    expect(workflowSummaryForGenerationRun({
      status: "preview_ready",
      clientApproval: { status: "approved" },
      payment: { status: "completed" },
      tenant: { domainVerification: { status: "verified" } },
    } as any)).toMatchObject({
      state: "Ready to go live",
      label: "Domain verified",
      primaryAction: "Go live",
    })
    expect(workflowSummaryForGenerationRun({
      status: "preview_ready",
      tenant: { activeSnapshot: 42 },
    } as any)).toMatchObject({
      state: "Live",
      label: "Live",
      primaryAction: "Open site",
    })
  })
})

describe("generation operations route access", () => {
  it("gates custom operations routes to super-admins", () => {
    for (const path of [
      "src/app/(frontend)/(admin)/generation-runs/page.tsx",
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
    expect(detail).toContain("Mollie completion or manual waiver satisfies the payment gate")
    expect(detail).not.toMatch(/stripe/i)
  })

  it("exposes Phase 8 snapshot lifecycle controls behind super-admin server actions", () => {
    const action = read("src/lib/actions/publishSnapshots.ts")
    const detail = read("src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx")
    const query = read("src/lib/queries/publishOperations.ts")
    const goLivePanel = detail.slice(detail.indexOf("<CardTitle>Go live"), detail.indexOf("<CardTitle>Advanced"))
    const advancedPanel = detail.slice(detail.indexOf("<CardTitle>Advanced"))

    expect(action).toContain('requireRole(["super-admin"])')
    expect(action).toContain("publishSiteSnapshot")
    expect(action).toContain("activatePublishedSnapshot")
    expect(action).toContain("rollback: true")
    expect(detail).toContain("Advanced")
    expect(detail.indexOf("Advanced")).toBeLessThan(detail.indexOf("Snapshot lifecycle"))
    expect(goLivePanel).toContain("Client approval")
    expect(goLivePanel).toContain("Prepare pages")
    expect(goLivePanel).toContain("promoteGenerationRunPagesAction.bind(null, run.id)")
    expect(goLivePanel).toContain('disabled={!isApproved || pageRecords.length === 0}')
    expect(goLivePanel).toContain("Payment")
    expect(goLivePanel).toContain("Check domain")
    expect(goLivePanel).toContain("Go live")
    expect(goLivePanel).toContain('name="activate" value="on"')
    expect(goLivePanel).not.toContain("Publish snapshot")
    expect(goLivePanel).not.toContain("Publish and activate immediately")
    expect(goLivePanel).not.toContain("Manual activation override for approval/payment only")
    expect(goLivePanel).not.toContain("Activate snapshot")
    expect(goLivePanel).not.toContain("Manual activation")
    expect(goLivePanel).not.toContain("Rollback snapshot")
    expect(goLivePanel).not.toContain("Manual rollback")
    expect(advancedPanel).toContain("Publish snapshot")
    expect(advancedPanel).toContain("Publish and activate immediately")
    expect(advancedPanel).toContain("Manual activation override for approval/payment only")
    expect(advancedPanel).toContain("Activate snapshot")
    expect(advancedPanel).toContain("Manual activation")
    expect(advancedPanel).toContain("Rollback snapshot")
    expect(advancedPanel).toContain("Manual rollback")
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
    expect(detail).toContain("Domain verified")
    expect(detail).toContain("DNS remains manual")
    expect(detail).toContain("updateTenantDomainVerificationAction")
    expect(detail).not.toMatch(/cloudflare|route53|dnsimple/i)
  })

  it("exposes manager-facing intake review and guarded deletion without public auto-generation", () => {
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
    expect(detail).toContain("Manager actions")
    expect(detail).toContain("Approve brief")
    expect(detail).toContain("Generate draft")
    expect(detail).toContain("Delete request if safe")
    expect(detail).toContain("Business facts")
    expect(detail).toContain("Website brief")
    expect(detail).toContain("Design preferences")
    expect(detail).toContain("Notes")
    expect(detail).toContain("Advanced")
    expect(detail).toContain("Request key")
    expect(detail).toContain("Data fingerprint")
    expect(detail).not.toContain("Reviewed GenerationInput")
    expect(detail).not.toContain("Approve for generation")
    expect(detail).not.toContain("Idempotency key")
    expect(detail).not.toContain("Normalized hash")
    expect(detail).toContain("defaultReviewedGenerationInput")
    expect(intakeRoute).not.toContain("processIntakeSubmission(")
  })

  it("does not expose a retry mutation in the operations UI", () => {
    const list = read("src/app/(frontend)/(admin)/generation-runs/page.tsx")
    const detail = read("src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx")

    expect(list).not.toContain("processIntakeSubmission(")
    expect(detail).not.toContain("processIntakeSubmission(")
    expect(detail).toContain("Retry follow-up")
  })

  it("exposes Better Auth preview access from the generation-run detail without adding review comments", () => {
    const detail = read("src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx")
    const share = read("src/components/generation/PreviewAccessShare.tsx")
    const action = read("src/lib/actions/previewAccess.ts")

    expect(detail).toContain("<PreviewAccessShare")
    expect(detail).toContain('run.status !== "preview_ready"')
    expect(detail).toContain("https://preview.siteinabox.nl/")
    expect(detail).toContain("previewClientSlugFromDomain")
    expect(share).toContain("Send preview")
    expect(share).toContain("navigator.clipboard.writeText")
    expect(action).toContain("previewAuth.api")
    expect(action).toContain("createOrRefreshPreviewGrant")
    expect(share).not.toMatch(/comment|feedback/i)
  })

  it("presents the detail page as a manager-facing draft-site workflow", () => {
    const detail = read("src/app/(frontend)/(admin)/generation-runs/[id]/page.tsx")

    expect(detail).toContain("Draft site #")
    expect(detail).toContain("Next action")
    expect(detail).toContain("Lifecycle checklist")
    expect(detail).toContain("Open site")
    expect(detail).toContain("Send preview")
    expect(detail).toContain("Payment")
    expect(detail).toContain("Waive payment")
    expect(detail).toContain("Domain verified")
    expect(detail).toContain("Go live")
    expect(detail).toContain("Live")
    expect(detail.indexOf("Advanced")).toBeLessThan(detail.indexOf("Provider/model"))
    expect(detail.indexOf("Advanced")).toBeLessThan(detail.indexOf("Input hash"))
    expect(detail.indexOf("Advanced")).toBeLessThan(detail.indexOf("Apply result"))
    expect(detail.indexOf("Advanced")).toBeLessThan(detail.indexOf("Status transitions"))
    expect(detail.indexOf("Advanced")).toBeLessThan(detail.indexOf("Publish snapshot"))
    expect(detail.indexOf("Advanced")).toBeLessThan(detail.indexOf("Manual activation"))
    expect(detail.indexOf("Advanced")).toBeLessThan(detail.indexOf("Rollback snapshot"))
  })

  it("paginates across both runs and intake-only submissions", () => {
    const list = read("src/app/(frontend)/(admin)/generation-runs/page.tsx")

    expect(list).toContain("Math.max(result.runs.totalPages, result.intakes.totalPages)")
    expect(list).toContain("Math.max(result.runs.totalDocs, result.intakes.totalDocs)")
  })
})
