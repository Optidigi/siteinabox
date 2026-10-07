import type { Config } from "@/payload-types"
import type { Payload } from "payload"
import { vi } from "vitest"
import { validBillingAgreement, validManagedDomain, validOrder, validPaymentAttempt, validRenewalCycle } from "./commerceBuilders"
import { generationRunFixture, tenantFixture, paginatedFixture, intakeSubmissionFixture, communicationPreferenceFixture, communicationPreferenceEventFixture, legalDocumentFixture, legalPublicationEventFixture, legalRequirementFixture, agreementAcceptanceFixture, siteReviewRevisionFixture, siteApprovalFixture, siteSettingsFixture } from "./generatedDocs"
import { asDocRecord } from "./payloadApi"
import { matchesWhere } from "./mockPayload"
import { createInitializedTestPayload } from "./testPayload"
import { payloadUpdateFixture, type PayloadUpdateOptions } from "./payloadUpdateFixture"

type Collection = "orders" | "payment-attempts" | "managed-domains" | "domain-renewal-cycles" | "billing-agreements" | "site-generation-runs" | "checkout-profiles" | "tenants" | "operational-alerts" | "site-settings" | "intake-submissions" | "communication-preferences" | "communication-preference-events" | "legal-documents" | "legal-publication-events" | "legal-requirements" | "agreement-acceptances" | "site-review-revisions" | "site-approvals"
export type GeneratedFixtureCollections = Partial<{ [C in Collection]: Config["collections"][C][] }>
type Document = Config["collections"][Collection]
type CreateOptions = Parameters<Payload["create"]>[0]
type Optimistic = { equals: number | string; field?: string; increment?: boolean }
type UpdateOptions = PayloadUpdateOptions & { optimistic?: Optimistic }
const isCollection = (value: string): value is Collection => ["orders", "payment-attempts", "managed-domains", "domain-renewal-cycles", "billing-agreements", "site-generation-runs", "checkout-profiles", "tenants", "operational-alerts", "site-settings", "intake-submissions", "communication-preferences", "communication-preference-events", "legal-documents", "legal-publication-events", "legal-requirements", "agreement-acceptances", "site-review-revisions", "site-approvals"].includes(value)

/** A bounded in-memory model of the actual generated collections used by commerce rehearsals. */
export async function createGeneratedPayloadStore(input: {
  collections: GeneratedFixtureCollections
  nextId?: number
  unique?: Array<{ collection: Collection; fields: string[] }>
  hooks?: {
    beforeCreate?: (args: CreateOptions, collections: GeneratedFixtureCollections) => void | Promise<void>
    beforeUpdate?: (args: UpdateOptions, collections: GeneratedFixtureCollections) => void | Promise<void>
  }
}) {
  const payload = await createInitializedTestPayload()
  const collections = input.collections
  let nextId = input.nextId ?? 1000
  let transactionSnapshot: GeneratedFixtureCollections | null = null
  const createFailures: Array<(args: CreateOptions) => Error | undefined> = []
  const updateFailures: Array<(args: UpdateOptions) => Error | undefined> = []
  const documents = (collection: string): Document[] => {
    if (!isCollection(collection)) throw new Error(`Unexpected collection ${collection}`)
    return collections[collection] ?? []
  }
  const find = vi.spyOn(payload, "find").mockImplementation(async args => {
    let docs = documents(args.collection).filter(doc => matchesWhere({ ...doc }, args.where))
    if (typeof args.sort === "string") {
      const sort = args.sort
      const descending = sort.startsWith("-")
      const field = descending ? sort.slice(1) : sort
      docs = [...docs].sort((left, right) => {
        const a = asDocRecord(left)[field], b = asDocRecord(right)[field]
        const compared = typeof a === "number" && typeof b === "number" ? a - b : String(a ?? "").localeCompare(String(b ?? ""))
        return descending ? -compared : compared
      })
    }
    const totalDocs = docs.length
    if (args.limit != null) docs = docs.slice(0, args.limit)
    return paginatedFixture(docs, { totalDocs })
  })
  const findByID = vi.spyOn(payload, "findByID").mockImplementation(async args => {
    const doc = documents(args.collection).find(entry => String(entry.id) === String(args.id))
    if (!doc) throw new Error(`Missing ${args.collection} ${args.id}`)
    return doc
  })
  const create = vi.spyOn(payload, "create").mockImplementation(async args => {
    const injectedFailure = createFailures.shift()?.(args)
    if (injectedFailure) throw injectedFailure
    await input.hooks?.beforeCreate?.(args, collections)
    for (const constraint of input.unique ?? []) {
      if (constraint.collection !== args.collection) continue
      if (documents(args.collection).some(doc => constraint.fields.every(field => String(asDocRecord(doc)[field]) === String(asDocRecord(args.data)[field])))) throw new Error(`duplicate key value violates ${args.collection}.${constraint.fields.join("_")}`)
    }
    const id = nextId++
    switch (args.collection) {
      case "intake-submissions": { const doc = Object.assign(intakeSubmissionFixture({ id }), args.data); (collections["intake-submissions"] ??= []).push(doc); return doc }
      case "communication-preferences": { const doc = Object.assign(communicationPreferenceFixture({ id }), args.data); (collections["communication-preferences"] ??= []).push(doc); return doc }
      case "communication-preference-events": { const doc = Object.assign(communicationPreferenceEventFixture({ id }), args.data); (collections["communication-preference-events"] ??= []).push(doc); return doc }
      case "legal-documents": { const doc = Object.assign(legalDocumentFixture({ id }), args.data); (collections["legal-documents"] ??= []).push(doc); return doc }
      case "legal-publication-events": { const doc = Object.assign(legalPublicationEventFixture({ id }), args.data); (collections["legal-publication-events"] ??= []).push(doc); return doc }
      case "legal-requirements": { const doc = Object.assign(legalRequirementFixture({ id }), args.data); (collections["legal-requirements"] ??= []).push(doc); return doc }
      case "agreement-acceptances": { const doc = Object.assign(agreementAcceptanceFixture({ id }), args.data); (collections["agreement-acceptances"] ??= []).push(doc); return doc }
      case "site-review-revisions": { const doc = Object.assign(siteReviewRevisionFixture({ id }), args.data); (collections["site-review-revisions"] ??= []).push(doc); return doc }
      case "site-approvals": { const doc = Object.assign(siteApprovalFixture({ id }), args.data); (collections["site-approvals"] ??= []).push(doc); return doc }
      case "site-settings": { const doc = Object.assign(siteSettingsFixture({ id }), args.data); (collections["site-settings"] ??= []).push(doc); return doc }
      case "orders": { const doc = Object.assign(validOrder({ id }), args.data); (collections.orders ??= []).push(doc); return doc }
      case "payment-attempts": { const doc = Object.assign(validPaymentAttempt({ id }), args.data); (collections["payment-attempts"] ??= []).push(doc); return doc }
      case "managed-domains": { const doc = Object.assign(validManagedDomain({ id }), args.data); (collections["managed-domains"] ??= []).push(doc); return doc }
      case "domain-renewal-cycles": { const doc = Object.assign(validRenewalCycle({ id }), args.data); (collections["domain-renewal-cycles"] ??= []).push(doc); return doc }
      case "billing-agreements": { const doc = Object.assign(validBillingAgreement({ id }), args.data); (collections["billing-agreements"] ??= []).push(doc); return doc }
      case "site-generation-runs": { const doc = Object.assign(generationRunFixture({ id }), args.data); (collections["site-generation-runs"] ??= []).push(doc); return doc }
      case "tenants": { const doc = Object.assign(tenantFixture({ id }), args.data); (collections.tenants ??= []).push(doc); return doc }
      case "operational-alerts": {
        const at = "2026-07-30T10:00:00.000Z"
        const doc: Config["collections"]["operational-alerts"] = { id, severity: "error", status: "open", source: "domains", dedupeKey: "fixture", message: "Fixture alert", occurrenceCount: 1, firstSeenAt: at, lastSeenAt: at, createdAt: at, updatedAt: at }
        Object.assign(doc, args.data); (collections["operational-alerts"] ??= []).push(doc); return doc
      }
      default: throw new Error(`Unsupported create collection ${args.collection}`)
    }
  })
  const update = vi.fn(async (args: UpdateOptions) => {
    const injectedFailure = updateFailures.shift()?.(args)
    if (injectedFailure) throw injectedFailure
    await input.hooks?.beforeUpdate?.(args, collections)
    if (args.where) {
      const docs = documents(args.collection).filter(doc => matchesWhere({ ...doc }, args.where))
      for (const doc of docs) Object.assign(doc, args.data)
      return { docs, errors: [], totalDocs: docs.length }
    }
    const doc = documents(args.collection).find(entry => String(entry.id) === String(args.id))
    if (!doc) throw new Error(`Missing ${args.collection} ${args.id}`)
    if (args.optimistic) {
      const field = args.optimistic.field ?? "contractingPartyProfileVersion"
      const current = asDocRecord(doc)[field]
      if (String(current) !== String(args.optimistic.equals)) throw new Error(`Optimistic update conflict for ${args.collection} ${args.id} at ${field}.`)
      if (args.optimistic.increment !== false) {
        if (typeof current !== "number") throw new Error(`Optimistic update field ${args.collection}.${field} is not numeric.`)
        Object.assign(doc, { [field]: current + 1 })
      }
    }
    Object.assign(doc, args.data)
    return doc
  })
  vi.spyOn(payload, "update").mockImplementation(payloadUpdateFixture(update))
  const beginTransaction = vi.spyOn(payload.db, "beginTransaction").mockImplementation(async () => {
    if (transactionSnapshot) throw new Error("A test transaction is already active.")
    transactionSnapshot = structuredClone(collections)
    return "test-transaction"
  })
  const commitTransaction = vi.spyOn(payload.db, "commitTransaction").mockImplementation(async () => {
    if (!transactionSnapshot) throw new Error("No test transaction is active.")
    transactionSnapshot = null
  })
  const rollbackTransaction = vi.spyOn(payload.db, "rollbackTransaction").mockImplementation(async () => {
    if (!transactionSnapshot) throw new Error("No test transaction is active.")
    for (const key of Object.keys(collections)) if (isCollection(key)) delete collections[key]
    Object.assign(collections, transactionSnapshot)
    transactionSnapshot = null
  })
  const transaction = async <Result>(operation: (transactionID: string) => Promise<Result>): Promise<Result> => {
    const transactionID = await beginTransaction()
    if (typeof transactionID !== "string") throw new Error("Expected fixture transaction")
    try { const result = await operation(transactionID); await commitTransaction(transactionID); return result }
    catch (error) { await rollbackTransaction(transactionID); throw error }
  }
  const injectCreateFailureOnce = (failure: Error | ((args: CreateOptions) => Error | undefined)) => createFailures.push(typeof failure === "function" ? failure : () => failure)
  const injectUpdateFailureOnce = (failure: Error | ((args: UpdateOptions) => Error | undefined)) => updateFailures.push(typeof failure === "function" ? failure : () => failure)
  return { collections, payload, find, findByID, create, update, beginTransaction, commitTransaction, rollbackTransaction, transaction, injectCreateFailureOnce, injectUpdateFailureOnce }
}
