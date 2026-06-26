import type { CollectionConfig } from "payload"
import {
  formatContractValidationIssues,
  PublishedSiteSnapshotSchema,
} from "@siteinabox/contracts/generation"

const allowedLifecycleUpdateFields = new Set([
  "status",
  "activatedAt",
  "rolledBackAt",
  "activationReason",
])

const isInternalLifecycleMutation = (args: {
  req?: { context?: Record<string, unknown> }
  context?: Record<string, unknown>
}): boolean =>
  args.req?.context?.publishSnapshotLifecycleMutation === true ||
  args.context?.publishSnapshotLifecycleMutation === true

const protectImmutableSnapshot = (args: any) => {
  if (args.operation !== "update") return args.data
  if (!isInternalLifecycleMutation(args)) {
    throw new Error("Published site snapshots are immutable. Use the publish activation flow for lifecycle changes.")
  }

  const changedFields = Object.keys(args.data ?? {})
  const immutableField = changedFields.find((field) => !allowedLifecycleUpdateFields.has(field))
  if (immutableField) {
    throw new Error(`Published site snapshot field "${immutableField}" is immutable after creation.`)
  }
  return args.data
}

export const snapshotStatusOptions = [
  { label: "Drafted", value: "drafted" },
  { label: "Active", value: "active" },
  { label: "Superseded", value: "superseded" },
  { label: "Rolled back", value: "rolled_back" },
]

export const PublishedSiteSnapshots: CollectionConfig = {
  slug: "published-site-snapshots",
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data?.snapshot) return data
        const parsed = PublishedSiteSnapshotSchema.safeParse(data.snapshot)
        if (!parsed.success) {
          throw new Error(`Published site snapshot failed contract validation: ${formatContractValidationIssues(parsed.error)}`)
        }
        return { ...data, snapshot: parsed.data }
      },
    ],
    beforeChange: [protectImmutableSnapshot],
  },
  access: {
    create: ({ req }) => req.user?.role === "super-admin",
    read: ({ req }) => req.user?.role === "super-admin",
    update: () => false,
    delete: () => false,
  },
  admin: {
    useAsTitle: "snapshotKey",
    defaultColumns: ["snapshotKey", "tenant", "status", "version", "domain", "publishedAt"],
    description: "Immutable published site snapshots consumed by the generic public renderer.",
  },
  fields: [
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      required: true,
      index: true,
    },
    {
      name: "sourceGenerationRun",
      type: "relationship",
      relationTo: "site-generation-runs",
      admin: { description: "Approved generation run used as the publish source, when applicable." },
    },
    { name: "snapshotKey", type: "text", required: true, unique: true },
    { name: "version", type: "number", required: true },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "drafted",
      options: snapshotStatusOptions,
    },
    { name: "domain", type: "text", required: true, index: true },
    { name: "snapshotHash", type: "text", required: true },
    { name: "snapshot", type: "json", required: true },
    { name: "publishedAt", type: "date", required: true },
    { name: "activatedAt", type: "date" },
    { name: "rolledBackAt", type: "date" },
    { name: "publishedBy", type: "relationship", relationTo: "users" },
    { name: "activationReason", type: "text" },
  ],
}
