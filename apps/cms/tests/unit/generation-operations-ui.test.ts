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
} from "@/lib/queries/generationOperations"

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")

describe("generation operations UI helpers", () => {
  it("builds failed, preview-ready, and needs-review run filters", () => {
    expect(generationRunWhere("failed")).toEqual({ status: { equals: "failed" } })
    expect(generationRunWhere("preview-ready")).toEqual({ status: { equals: "preview_ready" } })
    expect(generationRunWhere("needs-review")).toEqual({
      or: [
        { status: { equals: "draft_ready" } },
        { status: { equals: "preview_ready" } },
      ],
    })
  })

  it("stacks search with the selected run filter", () => {
    expect(generationRunWhere("failed", "gpt")).toEqual({
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
    expect(intakeSubmissionWhere("preview-ready", "sam@example.com")).toEqual({
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

    await listGenerationOperations({ page: 3, pageSize: 20, filter: "needs-review", q: "amblast" }, client)

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
    expect(calls[0].where).toEqual(generationRunWhere("needs-review", "amblast"))
    expect(calls[1].where).toEqual(intakeSubmissionWhere("needs-review", "amblast"))
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

    expect(action).toContain('requireRole(["super-admin"])')
    expect(action).toContain("publishSiteSnapshot")
    expect(action).toContain("activatePublishedSnapshot")
    expect(action).toContain("rollback: true")
    expect(detail).toContain("Snapshot lifecycle")
    expect(detail).toContain("Publish snapshot")
    expect(detail).toContain("Publish and activate immediately")
    expect(detail).toContain("Manual activation override for approval/payment only")
    expect(detail).toContain("Activate")
    expect(detail).toContain("Manual activate")
    expect(detail).toContain("Roll back")
    expect(detail).toContain("Manual rollback")
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
    expect(detail).toContain("Domain verification checklist")
    expect(detail).toContain("DNS remains manual")
    expect(detail).toContain("updateTenantDomainVerificationAction")
    expect(detail).not.toMatch(/cloudflare|route53|dnsimple/i)
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
    expect(share).toContain("Customer preview access")
    expect(share).toContain("navigator.clipboard.writeText")
    expect(action).toContain("previewAuth.api")
    expect(action).toContain("createOrRefreshPreviewGrant")
    expect(share).not.toMatch(/comment|feedback/i)
  })

  it("paginates across both runs and intake-only submissions", () => {
    const list = read("src/app/(frontend)/(admin)/generation-runs/page.tsx")

    expect(list).toContain("Math.max(result.runs.totalPages, result.intakes.totalPages)")
    expect(list).toContain("Math.max(result.runs.totalDocs, result.intakes.totalDocs)")
  })
})
