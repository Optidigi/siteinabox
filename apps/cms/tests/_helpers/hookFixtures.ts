import type { User } from "@/payload-types"
import { buildConfig, type CollectionBeforeOperationHook, type CollectionBeforeValidateHook, type PayloadRequest, type RequestContext } from "payload"
import { postgresAdapter } from "@payloadcms/db-postgres"
import { createTestPayload, createTestRequest } from "./testPayload"
import { argsFor } from "./argsFor"

export type BeforeOperationHook = CollectionBeforeOperationHook
export type BeforeValidateHook = CollectionBeforeValidateHook<User>
const configuration = await buildConfig({
  secret: "unit-hook-fixture-secret",
  db: postgresAdapter({ pool: { connectionString: "postgresql://fixture:fixture@localhost/fixture" } }),
  collections: [
    "users",
    "pages",
    "media",
    "domain-migrations",
    "site-settings",
    "tenants",
    "orders",
    "checkout-profiles",
    "payment-attempts",
    "billing-agreements",
    "managed-domains",
    "domain-renewal-cycles",
    "accounting-documents",
    "commerce-notification-deliveries",
    "migration-source-authorizations",
    "published-site-snapshots",
    "legal-documents",
    "legal-publication-events",
    "agreement-acceptances",
    "site-review-revisions",
    "site-approvals",
    "communication-preference-events",
  ].map((slug) => ({ slug, auth: slug === "users", fields: [] })),
})
const baseRequest = await createTestRequest(createTestPayload())

export function hookCollection(slug = "users") {
  const collection = configuration.collections.find((collection) => collection.slug === slug)
  if (!collection) throw new Error(`Unknown fixture collection: ${slug}`)
  return collection
}

export function hookRequest(partial: Partial<PayloadRequest> = {}): PayloadRequest {
  return { ...baseRequest, ...partial }
}

export function asBeforeOperationHook(fn: BeforeOperationHook | undefined): BeforeOperationHook {
  if (!fn) throw new Error("Expected beforeOperation hook")
  return fn
}

export function asBeforeValidateHook(fn: BeforeValidateHook | undefined): BeforeValidateHook {
  if (!fn) throw new Error("Expected beforeValidate hook")
  return fn
}

export function callBeforeOpHook(hook: BeforeOperationHook, opts: {
  operation: "create" | "update" | "forgotPassword" | "delete" | "login"
  req: Partial<PayloadRequest>
  data?: Record<string, unknown>
  context?: RequestContext
}) {
  const req = hookRequest(opts.req)
  const collection = hookCollection()
  const common = { collection, context: opts.context ?? req.context, overrideAccess: false, req }
  const operationCollection = { config: collection, customIDType: "number" as const }
  return Promise.resolve().then(() => {
    switch (opts.operation) {
      case "create": return hook({ ...common, operation: "create", args: { collection: operationCollection, req, data: opts.data ?? {} } })
      case "update": return hook({ ...common, operation: "update", args: { collection: operationCollection, req, data: opts.data ?? {}, where: {} } })
      case "forgotPassword": return hook({ ...common, operation: "forgotPassword", args: { collection: operationCollection, req, data: { email: "fixture@example.com", password: "fixture-password", ...opts.data } } })
      case "login": return hook({ ...common, operation: "login", args: { collection: operationCollection, req, data: { email: "fixture@example.com", password: "fixture-password", ...opts.data } } })
      case "delete": return hook({ ...common, operation: "delete", args: { collection: operationCollection, req, where: {} } })
    }
  })
}

export function hookArgsFor<T extends (...args: never[]) => unknown>(fn: T, partial: Parameters<T>[0]): Parameters<T>[0] {
  return argsFor(fn, partial)
}
