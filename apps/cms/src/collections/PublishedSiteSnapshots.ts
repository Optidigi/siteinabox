import type { CollectionConfig } from "payload"
import { adminText } from "@/lib/payloadAdminI18n"
import {
  formatContractValidationIssues,
  schemaForPublishedSiteSnapshot,
} from "@siteinabox/contracts/generation"
import { relationshipId } from "@/lib/relationshipId"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"

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

const relationshipFields = new Set(["tenant", "sourceGenerationRun", "publishedBy"])

const stableStringify = (value: unknown): string => {
  if (value == null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
}

const immutableFieldIsUnchanged = (field: string, nextValue: unknown, originalDoc: Record<string, unknown> | undefined): boolean => {
  if (!originalDoc || !(field in originalDoc)) return false
  const originalValue = originalDoc[field]
  if (relationshipFields.has(field)) return relationshipId(nextValue as any) === relationshipId(originalValue as any)
  return stableStringify(nextValue) === stableStringify(originalValue)
}

const normalizeSnapshotTheme = (snapshot: unknown): unknown => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return snapshot
  const record = snapshot as Record<string, unknown>
  return {
    ...record,
    theme: normalizeThemeForSave(record.theme),
  }
}

export const protectImmutableSnapshot = (args: any) => {
  if (args.operation !== "update") return args.data
  if (!isInternalLifecycleMutation(args)) {
    throw new Error("Published site snapshots are immutable. Use the publish activation flow for lifecycle changes.")
  }

  const changedFields = Object.keys(args.data ?? {})
  const immutableField = changedFields.find((field) =>
    !allowedLifecycleUpdateFields.has(field) &&
    !immutableFieldIsUnchanged(field, args.data?.[field], args.originalDoc),
  )
  if (immutableField) {
    throw new Error(`Published site snapshot field "${immutableField}" is immutable after creation.`)
  }
  return args.data
}

export const snapshotStatusOptions = [
  { label: { en: "Drafted", nl: "Concept" }, value: "drafted" },
  { label: { en: "Active", nl: "Actief" }, value: "active" },
  { label: { en: "Superseded", nl: "Vervangen" }, value: "superseded" },
  { label: { en: "Rolled back", nl: "Teruggedraaid" }, value: "rolled_back" },
]

export const PublishedSiteSnapshots: CollectionConfig = {
  slug: "published-site-snapshots",
  labels: { singular: { en: "Published site snapshot", nl: "Gepubliceerde siteversie" }, plural: { en: "Published site snapshots", nl: "Gepubliceerde siteversies" } },
  hooks: {
    beforeValidate: [
      (args) => {
        const { data, operation, originalDoc } = args
        if (!data?.snapshot) return data
        if (
          operation === "update" &&
          isInternalLifecycleMutation(args) &&
          immutableFieldIsUnchanged("snapshot", data.snapshot, originalDoc)
        ) {
          return data
        }
        const snapshot = normalizeSnapshotTheme(data.snapshot)
        const parsed = schemaForPublishedSiteSnapshot(snapshot as any).safeParse(snapshot)
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
    description: adminText("Immutable published site snapshots consumed by the generic public renderer.", "Onveranderlijke gepubliceerde siteversies die door de algemene openbare renderer worden gebruikt."),
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
      admin: { description: adminText("Approved generation run used as the publish source, when applicable.", "Goedgekeurde generatieronde die waar van toepassing als publicatiebron wordt gebruikt.") },
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
