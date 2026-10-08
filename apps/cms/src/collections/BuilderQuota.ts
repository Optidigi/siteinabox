import type { CollectionConfig, Field } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"

const counters = (names: string[]): Field[] => names.map((name) => ({ name, type: "number", required: true, defaultValue: 0, min: 0, max: Number.MAX_SAFE_INTEGER - 1, validate: (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 || "A safe nonnegative integer is required." }))
const access = { create: () => false, read: isSuperAdmin, update: () => false, delete: () => false }

// Durable accounting is independent of threads, drafts and tenant deletion.
export const BuilderQuotaAccounts: CollectionConfig = {
  slug: "builder-quota-accounts", lockDocuments: false, access,
  admin: { useAsTitle: "customerEmail" },
  fields: [
    { name: "customerEmail", type: "email", required: true, unique: true, index: true },
    ...counters(["visibleUsed", "visibleReserved", "chargedCostUnits", "attempts", "revision", "ingressRequests"]),
    { name: "ingressDay", type: "text", required: true, defaultValue: "1970-01-01" },
    { name: "activeOperationKey", type: "text" },
    { name: "ingressToken", type: "text" },
    { name: "lastActivityAt", type: "date", required: true, index: true },
  ],
}
export const BuilderQuotaGlobal: CollectionConfig = {
  slug: "builder-quota-global", lockDocuments: false, access,
  fields: [
    { name: "key", type: "text", required: true, unique: true },
    ...counters(["activeOperations", "chargedCostUnits", "attempts", "revision", "ingressRequests"]),
    { name: "ingressDay", type: "text", required: true, defaultValue: "1970-01-01" },
  ],
}
export const BuilderOperations: CollectionConfig = {
  slug: "builder-operations", lockDocuments: false, access,
  admin: { useAsTitle: "operationKey" },
  fields: [
    { name: "operationKey", type: "text", required: true, unique: true },
    { name: "operationId", type: "text", required: true },
    { name: "customerEmail", type: "email", required: true, index: true },
    { name: "messageHash", type: "text", required: true },
    { name: "state", type: "select", required: true, index: true, options: ["reserved", "running", "succeeded", "failed", "interrupted"] },
    { name: "reservationToken", type: "text", required: true },
    ...counters(["revision", "reservedCostUnits", "settledCostUnits", "dispatchedCostUnits", "knownCostUnits", "modelCalls", "weightedSteps", "unknownCalls", "outstandingCalls"]),
    { name: "costKnown", type: "checkbox", required: true, defaultValue: true },
    { name: "slotHeld", type: "checkbox", required: true, defaultValue: true },
    { name: "startedAt", type: "date", required: true },
    { name: "deadlineAt", type: "date", required: true, index: true },
    { name: "settledAt", type: "date" },
    { name: "errorCode", type: "text", maxLength: 120 },
    { name: "result", type: "json" },
    { name: "intakeSubmissionId", type: "number" },
    { name: "generationRunId", type: "number" },
    { name: "configurationRevision", type: "text", required: true },
  ],
}
