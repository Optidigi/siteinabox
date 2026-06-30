import type { CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"

export const generationWorkflowStatuses = [
  "submitted",
  "normalized",
  "queued",
  "generating",
  "generated",
  "validating",
  "applying",
  "draft_ready",
  "preview_ready",
  "failed",
] as const

export const generationWorkflowStatusOptions = generationWorkflowStatuses.map((status) => ({
  label: status,
  value: status,
}))

export const IntakeSubmissions: CollectionConfig = {
  slug: "intake-submissions",
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin,
  },
  admin: {
    useAsTitle: "businessName",
    defaultColumns: ["businessName", "contactEmail", "status", "reviewedAt", "idempotencyKey", "createdAt"],
    description: "Operational intake submissions received from the future public intake form.",
  },
  fields: [
    { name: "businessName", type: "text", required: true },
    { name: "contactName", type: "text" },
    { name: "contactEmail", type: "email" },
    { name: "source", type: "text", required: true, defaultValue: "public-intake" },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "submitted",
      options: generationWorkflowStatusOptions,
    },
    {
      name: "idempotencyKey",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "Stable hash of the normalized intake plus mocked generation mode." },
    },
    { name: "raw", type: "json", required: true },
    { name: "normalized", type: "json" },
    { name: "normalizedHash", type: "text" },
    {
      name: "reviewedGenerationInput",
      type: "json",
      admin: {
        description: "Structured GenerationInput approved by an SIAB manager and ready for the generation handoff.",
      },
    },
    {
      name: "reviewNotes",
      type: "textarea",
      admin: { description: "Internal manager notes captured during intake review." },
    },
    { name: "reviewedAt", type: "date", admin: { readOnly: true } },
    { name: "reviewedBy", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    {
      name: "generationRun",
      type: "relationship",
      relationTo: "site-generation-runs",
      admin: { readOnly: true },
    },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      admin: { readOnly: true },
    },
    {
      name: "statusTransitions",
      type: "array",
      admin: { readOnly: true },
      fields: [
        { name: "status", type: "select", required: true, options: generationWorkflowStatusOptions },
        { name: "at", type: "date", required: true },
        { name: "message", type: "text" },
      ],
    },
    { name: "error", type: "json", admin: { readOnly: true } },
  ],
}
