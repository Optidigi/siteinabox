import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook, CollectionConfig } from "payload"
import { ValidationError } from "payload"
import { AppointmentSources, AppointmentStatuses } from "@siteinabox/contracts"
import { canRead } from "@/access/roleHelpers"
import { validateTenantExists } from "@/hooks/validateTenantExists"
import { adminText, adminValidationText } from "@/lib/payloadAdminI18n"

const validateAppointmentTimes: CollectionBeforeValidateHook = ({ collection, data, req }) => {
  const record = data as Record<string, unknown> | undefined
  const startAt = typeof record?.startAt === "string" || record?.startAt instanceof Date
    ? new Date(record.startAt)
    : null
  const endAt = typeof record?.endAt === "string" || record?.endAt instanceof Date
    ? new Date(record.endAt)
    : null
  const errors: Array<{ path: string; message: string }> = []
  if (startAt && Number.isNaN(startAt.getTime())) {
    errors.push({ path: "startAt", message: adminValidationText(req.i18n?.language, "Use a valid start date and time.", "Gebruik een geldige startdatum en -tijd.") })
  }
  if (endAt && Number.isNaN(endAt.getTime())) {
    errors.push({ path: "endAt", message: adminValidationText(req.i18n?.language, "Use a valid end date and time.", "Gebruik een geldige einddatum en -tijd.") })
  }
  if (startAt && endAt && !Number.isNaN(startAt.getTime()) && !Number.isNaN(endAt.getTime()) && endAt <= startAt) {
    errors.push({ path: "endAt", message: adminValidationText(req.i18n?.language, "The end must be after the start.", "De eindtijd moet na de starttijd liggen.") })
  }
  if (errors.length > 0) throw new ValidationError({ collection: collection?.slug ?? "appointments", errors })
  return data
}

const protectAppointmentLifecycle: CollectionBeforeChangeHook = ({ data, operation, req, context }) => {
  if (operation !== "update" || req.context?.appointmentLifecycleMutation === true || context?.appointmentLifecycleMutation === true) return data
  const mutableAttempt = Object.keys(data ?? {}).find((field) =>
    ["status", "startAt", "endAt", "eventVersion", "managementTokenDigest", "managementTokenExpiresAt", "encryptedManagementToken"].includes(field),
  )
  if (mutableAttempt) {
    throw new Error("Appointments can only change through the reviewed appointment lifecycle.")
  }
  return data
}

export const Appointments: CollectionConfig = {
  slug: "appointments",
  labels: {
    singular: { en: "Appointment", nl: "Afspraak" },
    plural: { en: "Appointments", nl: "Afspraken" },
  },
  access: {
    read: canRead,
    // The agenda UI and public booking service are the only reviewed writers.
    // Keeping the hidden ledger closed to generic Payload mutations prevents a
    // tenant user from bypassing overlap and side-effect lifecycle checks.
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  admin: {
    hidden: true,
    useAsTitle: "visitorName",
    defaultColumns: ["startAt", "visitorName", "visitorEmail", "status", "createdAt"],
    description: adminText("Tenant-scoped appointment ledger. Use the Appointments screen for the agenda; the collection is hidden from the generic Payload admin.", "Afsprakenadministratie per klant. Gebruik het Afspraken-scherm voor de agenda; deze collectie is verborgen in de algemene Payload-admin."),
  },
  fields: [
    { name: "status", type: "select", required: true, defaultValue: "confirmed", options: AppointmentStatuses.map((value) => ({ label: value, value })), index: true },
    { name: "startAt", type: "date", required: true, index: true },
    { name: "endAt", type: "date", required: true, index: true },
    { name: "timezone", type: "text", required: true },
    { name: "durationMinutes", type: "number", required: true, min: 5, max: 480 },
    { name: "visitorName", type: "text", required: true, maxLength: 120 },
    { name: "visitorEmail", type: "email", required: true },
    { name: "visitorPhone", type: "text", maxLength: 40 },
    { name: "visitorNote", type: "textarea", maxLength: 2000 },
    { name: "pageUrl", type: "text", maxLength: 2048 },
    { name: "source", type: "select", required: true, defaultValue: "website", options: AppointmentSources.map((value) => ({ label: value, value })), index: true },
    { name: "eventVersion", type: "number", required: true, defaultValue: 1, min: 1 },
    { name: "managementTokenDigest", type: "text", index: true, admin: { hidden: true } },
    { name: "managementTokenExpiresAt", type: "date", index: true, admin: { hidden: true } },
    { name: "encryptedManagementToken", type: "text", admin: { hidden: true } },
  ],
  hooks: {
    beforeValidate: [validateTenantExists, validateAppointmentTimes],
    beforeChange: [protectAppointmentLifecycle],
  },
}
