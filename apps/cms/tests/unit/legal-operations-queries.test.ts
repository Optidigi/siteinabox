import { describe, expect, it, vi } from "vitest"
import {
  getLegalAttentionItems,
  getLegalOperationsOverview,
  maskEmailRecipient,
} from "@/lib/queries/legalOperations"

const NOW = new Date("2026-07-11T12:00:00.000Z")

const tenant = { id: 7, name: "Voorbeeld BV", slug: "voorbeeld" }
const document = {
  id: 11,
  documentType: "terms",
  documentVersion: "2026-07-01",
  changeSummary: "De afspraken over betaling zijn verduidelijkt.",
  effectiveAt: "2026-07-01T00:00:00.000Z",
}

const records = {
  "legal-documents": [document],
  "legal-publication-events": [],
  "legal-requirements": [
    {
      id: 21,
      requirementKey: "upcoming",
      tenant,
      subjectEmail: "owner@voorbeeld.nl",
      document,
      action: "mandatory_reaccept",
      status: "notified",
      enforceAt: "2026-07-18T12:00:00.000Z",
    },
    {
      id: 22,
      requirementKey: "overdue",
      tenant,
      subjectEmail: "owner@voorbeeld.nl",
      document,
      action: "mandatory_reaccept",
      status: "pending",
      enforceAt: "2026-07-10T12:00:00.000Z",
    },
    {
      id: 23,
      requirementKey: "done",
      tenant,
      subjectEmail: "owner@voorbeeld.nl",
      document,
      action: "mandatory_reaccept",
      status: "satisfied",
      enforceAt: "2026-07-09T12:00:00.000Z",
    },
  ],
  "legal-notification-deliveries": [
    {
      id: 31,
      notificationKey: "retryable",
      requirement: 21,
      tenant,
      recipient: "finance.team@voorbeeld.nl",
      kind: "reminder",
      status: "failed",
      retryState: "retryable",
      attemptCount: 2,
      nextAttemptAt: "2026-07-11T12:10:00.000Z",
      lastAttemptAt: "2026-07-11T11:00:00.000Z",
      lastError: "Temporary provider error",
    },
    {
      id: 32,
      notificationKey: "permanent",
      requirement: 22,
      tenant,
      recipient: "owner@voorbeeld.nl",
      kind: "enforcement",
      status: "failed",
      retryState: "permanent",
      attemptCount: 5,
      nextAttemptAt: "2026-07-11T13:00:00.000Z",
      lastAttemptAt: "2026-07-11T10:00:00.000Z",
      lastError: "Recipient rejected",
    },
  ],
  "agreement-acceptances": [],
} as const

const payload = {
  find: vi.fn(async ({ collection, where }: { collection: keyof typeof records; where?: unknown }) => {
    const filter = JSON.stringify(where)
    const docs = collection === "legal-documents" && filter.includes("greater_than")
      ? []
      : collection === "legal-requirements" && filter.includes('"pending","notified","failed"')
        ? records[collection].filter((item) => item.status !== "satisfied")
        : [...records[collection]]
    return { docs, totalDocs: docs.length, hasNextPage: false }
  }),
  count: vi.fn(async ({ collection, where }: { collection: keyof typeof records; where?: unknown }) => {
    const filter = JSON.stringify(where)
    if (collection === "legal-documents") return { totalDocs: 1 }
    if (collection === "legal-notification-deliveries") return { totalDocs: 2 }
    if (collection === "legal-requirements" && filter.includes("less_than_equal")) return { totalDocs: 1 }
    if (collection === "legal-requirements") return { totalDocs: 2 }
    return { totalDocs: 0 }
  }),
  findByID: vi.fn(),
}

describe("legal operations queries", () => {
  it("returns the agreed overview metrics and excludes satisfied requirements", async () => {
    const overview = await getLegalOperationsOverview(payload as never, { now: NOW })
    const metrics = Object.fromEntries(overview.metrics.map((metric) => [metric.key, metric.value]))

    expect(metrics).toEqual({
      "registered-publications": 1,
      "open-requirements": 2,
      "overdue-requirements": 1,
      "failed-deliveries": 2,
    })
  })

  it("orders attention by operational urgency instead of source order", async () => {
    const rows = await getLegalAttentionItems(payload as never, { now: NOW })

    expect(rows.map((row) => [row.kind, row.title])).toEqual([
      ["delivery", "Definitieve verzendfout"],
      ["requirement", "Acceptatie te laat"],
      ["delivery", "Verzending opnieuw proberen"],
      ["requirement", "Acceptatie binnenkort vereist"],
    ])
    expect(rows.map((row) => row.status)).toEqual(["permanent", "overdue", "retryable", "upcoming"])
    expect(rows[0]).toMatchObject({ severity: "destructive", tenant: "Voorbeeld BV" })
    expect(rows.every((row) => row.href.startsWith("/legal/"))).toBe(true)
  })

  it("masks the recipient local part while retaining a useful domain", () => {
    const masked = maskEmailRecipient("finance.team@voorbeeld.nl")

    expect(masked.endsWith("@voorbeeld.nl")).toBe(true)
    expect(masked).not.toContain("finance.team")
    expect(masked).not.toBe("finance.team@voorbeeld.nl")
  })

  it("distinguishes permanent from retryable delivery failures without exposing the address", async () => {
    const rows = await getLegalAttentionItems(payload as never, { now: NOW })
    const deliveryRows = rows.filter((row) => row.kind === "delivery")

    expect(deliveryRows).toHaveLength(2)
    expect(deliveryRows.map((row) => row.status)).toEqual(["permanent", "retryable"])
    expect(deliveryRows.every((row) => row.subject.includes("@voorbeeld.nl"))).toBe(true)
    expect(deliveryRows.every((row) => !row.subject.includes("finance.team"))).toBe(true)
  })
})
