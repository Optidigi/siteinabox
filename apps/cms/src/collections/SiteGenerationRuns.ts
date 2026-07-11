import type { CollectionConfig } from "payload"
import { adminText } from "@/lib/payloadAdminI18n"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import { generationWorkflowStatusOptions } from "@/collections/IntakeSubmissions"

export const SiteGenerationRuns: CollectionConfig = {
  slug: "site-generation-runs",
  labels: { singular: { en: "Site generation run", nl: "Sitegeneratieronde" }, plural: { en: "Site generation runs", nl: "Sitegeneratierondes" } },
  access: {
    create: isSuperAdmin,
    read: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin,
  },
  admin: {
    useAsTitle: "idempotencyKey",
    defaultColumns: ["status", "provider", "model", "promptVersion", "specHash", "tenant", "createdAt"],
    description: adminText("Traceable AI generation runs that apply validated SiteGenerationSpec data to draft CMS content.", "Traceerbare AI-generatierondes die gevalideerde SiteGenerationSpec-gegevens toepassen op CMS-conceptinhoud."),
  },
  fields: [
    {
      name: "intakeSubmission",
      type: "relationship",
      relationTo: "intake-submissions",
      required: true,
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "queued",
      options: generationWorkflowStatusOptions,
    },
    {
      name: "idempotencyKey",
      type: "text",
      required: true,
      unique: true,
      admin: { description: adminText("Stable key for one normalized intake, provider, model, and prompt version.", "Stabiele sleutel voor één genormaliseerde intake, provider, model en promptversie.") },
    },
    { name: "normalizedIntake", type: "json", required: true },
    { name: "normalizedIntakeHash", type: "text", required: true },
    { name: "provider", type: "text", required: true, defaultValue: "mock" },
    { name: "model", type: "text", required: true, defaultValue: "fixture:generic" },
    { name: "promptVersion", type: "text", required: true },
    { name: "generationInputHash", type: "text", required: true },
    { name: "generationInput", type: "json" },
    { name: "generationOutputHash", type: "text" },
    { name: "rawOutput", type: "json" },
    { name: "parsedOutput", type: "json" },
    { name: "generationAttempts", type: "number", defaultValue: 0 },
    { name: "mockFixture", type: "text", defaultValue: "generic" },
    { name: "specHash", type: "text" },
    { name: "spec", type: "json" },
    { name: "validation", type: "json" },
    { name: "applyResult", type: "json" },
    {
      name: "tenant",
      type: "relationship",
      relationTo: "tenants",
      admin: { readOnly: true },
    },
    {
      name: "pages",
      type: "relationship",
      relationTo: "pages",
      hasMany: true,
      admin: { readOnly: true },
    },
    {
      name: "settings",
      type: "relationship",
      relationTo: "site-settings",
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
    { name: "startedAt", type: "date" },
    { name: "completedAt", type: "date" },
    {
      name: "clientApproval",
      type: "json",
      admin: {
        readOnly: true,
        description: adminText("Client preview approval state recorded from the token-backed preview/customizer.", "Goedkeuringsstatus van de klantpreview, vastgelegd vanuit de tokenbeveiligde preview/customizer."),
      },
    },
    {
      name: "payment",
      type: "json",
      admin: {
        readOnly: true,
        description: adminText("Provider-neutral operational payment gate with status and audit metadata.", "Providerneutrale operationele betalingscontrole met status- en auditmetadata."),
      },
    },
    {
      name: "domainOrder",
      type: "json",
      admin: {
        readOnly: true,
        description: adminText("Customer-selected domain order and provisioning state for preview checkout.", "Door de klant gekozen domeinbestelling en inrichtingsstatus voor de previewcheckout."),
      },
    },
    { name: "errors", type: "json" },
  ],
}
