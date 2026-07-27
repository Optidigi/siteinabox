import { z } from "zod"
import { PublishedSiteSnapshotSchema } from "./runtime"

const DOMAIN_LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
const PUBLIC_DOMAIN_PATTERN = new RegExp(`^(?=.{1,253}$)(?:${DOMAIN_LABEL}\\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

export function normalizePublicDomainHost(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().toLowerCase()
  if (!raw || /[,/\\@?#\s]/.test(raw)) return null

  const withoutPort = raw.replace(/:\d+$/, "")
  const normalized = withoutPort.endsWith(".") ? withoutPort.slice(0, -1) : withoutPort
  return PUBLIC_DOMAIN_PATTERN.test(normalized) ? normalized : null
}

export const publicDomainHostSchema = z.string().refine(
  (value) => normalizePublicDomainHost(value) === value,
  "Expected a normalized public domain host",
)

export const rendererActiveDomainRoutingSchema = z.object({
  version: z.literal(1),
  requestedHost: publicDomainHostSchema,
  canonicalHost: publicDomainHostSchema,
  activeHosts: z.array(publicDomainHostSchema).min(1),
}).strict().superRefine((routing, context) => {
  if (!routing.activeHosts.includes(routing.canonicalHost)) {
    context.addIssue({
      code: "custom",
      path: ["activeHosts"],
      message: "activeHosts must include canonicalHost",
    })
  }
  if (!routing.activeHosts.includes(routing.requestedHost)) {
    context.addIssue({
      code: "custom",
      path: ["activeHosts"],
      message: "activeHosts must include requestedHost",
    })
  }
  if (new Set(routing.activeHosts).size !== routing.activeHosts.length) {
    context.addIssue({
      code: "custom",
      path: ["activeHosts"],
      message: "activeHosts must not contain duplicates",
    })
  }
})

const rendererRecordIdSchema = z.union([z.string().min(1), z.number().int()])

export const rendererSnapshotEnvelopeSchema = z.object({
  routing: rendererActiveDomainRoutingSchema,
  tenant: z.object({
    id: rendererRecordIdSchema,
    slug: z.string().min(1),
    domain: publicDomainHostSchema,
    status: z.literal("active"),
  }).strict(),
  snapshotId: rendererRecordIdSchema,
  snapshot: PublishedSiteSnapshotSchema,
}).strict().superRefine((envelope, context) => {
  if (envelope.tenant.domain !== envelope.routing.canonicalHost) {
    context.addIssue({
      code: "custom",
      path: ["tenant", "domain"],
      message: "Tenant domain must match the canonical routing host",
    })
  }
  if (envelope.snapshot.domain !== envelope.routing.canonicalHost) {
    context.addIssue({
      code: "custom",
      path: ["snapshot", "domain"],
      message: "Snapshot domain must match the canonical routing host",
    })
  }
  if (envelope.snapshot.tenantSlug !== envelope.tenant.slug) {
    context.addIssue({
      code: "custom",
      path: ["snapshot", "tenantSlug"],
      message: "Snapshot tenant slug must match the routed tenant",
    })
  }
  if (envelope.snapshot.tenantId !== String(envelope.tenant.id)) {
    context.addIssue({
      code: "custom",
      path: ["snapshot", "tenantId"],
      message: "Snapshot tenant ID must match the routed tenant",
    })
  }
})

export type RendererActiveDomainRouting = z.infer<typeof rendererActiveDomainRoutingSchema>
export type RendererSnapshotEnvelope = z.infer<typeof rendererSnapshotEnvelopeSchema>
