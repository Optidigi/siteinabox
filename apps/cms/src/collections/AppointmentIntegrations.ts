import type { CollectionBeforeChangeHook, CollectionConfig } from "payload"
import { isSuperAdmin } from "@/access/isSuperAdmin"
import { adminEnumOption, adminText } from "@/lib/payloadAdminI18n"

const systemAccess = {
  create: isSuperAdmin,
  read: isSuperAdmin,
  update: () => false,
  delete: () => false,
}

const options = (values: readonly string[]) => values.map(adminEnumOption)

const lifecycleEnabled = (args: Parameters<CollectionBeforeChangeHook>[0], key: string): boolean =>
  args.req?.context?.[key] === true || args.context?.[key] === true

const protectFields = (
  args: Parameters<CollectionBeforeChangeHook>[0],
  key: string,
  label: string,
  allowed: ReadonlySet<string>,
) => {
  if (args.operation !== "update" || lifecycleEnabled(args, key)) return args.data
  const invalid = Object.keys(args.data ?? {}).find((field) => !allowed.has(field))
  if (invalid) throw new Error(`${label} field "${invalid}" is mutable only through its reviewed lifecycle.`)
  return args.data
}

const protectAppointmentNotification: CollectionBeforeChangeHook = (args) => protectFields(
  args,
  "appointmentNotificationLifecycleMutation",
  "Appointment notification",
  new Set(["status", "attemptCount", "nextAttemptAt", "leaseUntil", "lastAttemptAt", "sentAt", "provider", "providerMessageId", "retryState", "lastError"]),
)

const protectCalendarConnection: CollectionBeforeChangeHook = (args) => protectFields(
  args,
  "appointmentCalendarLifecycleMutation",
  "Appointment calendar connection",
  new Set(["status", "encryptedAccessToken", "encryptedRefreshToken", "accessTokenExpiresAt", "accountEmail", "calendarId", "calendarName", "scopes", "lastSyncedAt", "lastError"]),
)

const protectCalendarEvent: CollectionBeforeChangeHook = (args) => protectFields(
  args,
  "appointmentCalendarLifecycleMutation",
  "Appointment calendar event",
  new Set(["eventVersion", "providerEventId", "status", "operation", "attemptCount", "nextAttemptAt", "leaseUntil", "lastAttemptAt", "syncedAt", "lastError"]),
)

export const AppointmentNotificationDeliveries: CollectionConfig = {
  slug: "appointment-notification-deliveries",
  lockDocuments: false,
  labels: { singular: { en: "Appointment notification", nl: "Afspraakmelding" }, plural: { en: "Appointment notifications", nl: "Afspraakmeldingen" } },
  access: systemAccess,
  hooks: { beforeChange: [protectAppointmentNotification] },
  admin: {
    hidden: true,
    useAsTitle: "notificationKey",
    defaultColumns: ["appointment", "recipientKind", "kind", "status", "nextAttemptAt"],
    description: adminText("System-managed appointment email outbox.", "Door het systeem beheerd postvak voor afspraakmails."),
  },
  fields: [
    { name: "notificationKey", type: "text", required: true, unique: true, index: true },
    { name: "appointment", type: "relationship", relationTo: "appointments", required: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", required: true, index: true },
    { name: "recipientEmail", type: "email", admin: { description: adminText("Resolved recipient for this appointment event; tenant recipients are created from the current notification subscription.", "Vastgelegde ontvanger voor deze afspraakgebeurtenis; klantontvangers worden aangemaakt vanuit het actuele meldingsabonnement.") } },
    { name: "recipientKind", type: "select", required: true, options: options(["visitor", "tenant"]), index: true },
    { name: "kind", type: "select", required: true, options: options(["confirmation", "cancelled", "rescheduled"]), index: true },
    { name: "eventVersion", type: "number", required: true, min: 1 },
    { name: "templateVersion", type: "text", required: true },
    { name: "status", type: "select", required: true, defaultValue: "queued", options: options(["queued", "processing", "sent", "failed", "cancelled"]), index: true },
    { name: "attemptCount", type: "number", required: true, defaultValue: 0, min: 0 },
    { name: "nextAttemptAt", type: "date", required: true, index: true },
    { name: "leaseUntil", type: "date", index: true },
    { name: "lastAttemptAt", type: "date" },
    { name: "sentAt", type: "date", index: true },
    { name: "provider", type: "text" },
    { name: "providerMessageId", type: "text" },
    { name: "retryState", type: "select", options: options(["none", "retryable", "permanent"]) },
    { name: "lastError", type: "textarea" },
  ],
}

export const AppointmentCalendarOAuthStates: CollectionConfig = {
  slug: "appointment-calendar-oauth-states",
  lockDocuments: false,
  labels: { singular: { en: "Appointment calendar OAuth state", nl: "OAuth-status afspraakagenda" }, plural: { en: "Appointment calendar OAuth states", nl: "OAuth-statussen afspraakagenda" } },
  access: systemAccess,
  admin: { hidden: true, useAsTitle: "stateDigest" },
  fields: [
    { name: "stateDigest", type: "text", required: true, unique: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", required: true, index: true },
    { name: "user", type: "relationship", relationTo: "users", required: true, index: true },
    { name: "provider", type: "select", required: true, options: options(["google", "microsoft"]), index: true },
    { name: "encryptedCodeVerifier", type: "text", required: true },
    { name: "returnPath", type: "text", required: true },
    { name: "expiresAt", type: "date", required: true, index: true },
    { name: "usedAt", type: "date", index: true },
  ],
}

export const AppointmentCalendarConnections: CollectionConfig = {
  slug: "appointment-calendar-connections",
  lockDocuments: false,
  labels: { singular: { en: "Appointment calendar connection", nl: "Koppeling afspraakagenda" }, plural: { en: "Appointment calendar connections", nl: "Koppelingen afspraakagenda" } },
  access: systemAccess,
  hooks: { beforeChange: [protectCalendarConnection] },
  admin: {
    hidden: true,
    useAsTitle: "connectionKey",
    defaultColumns: ["tenant", "provider", "accountEmail", "status", "lastSyncedAt"],
    description: adminText("System-managed encrypted calendar connections.", "Door het systeem beheerde versleutelde agendakoppelingen."),
  },
  fields: [
    { name: "connectionKey", type: "text", required: true, unique: true, index: true },
    { name: "tenant", type: "relationship", relationTo: "tenants", required: true, index: true },
    { name: "provider", type: "select", required: true, options: options(["google", "microsoft"]), index: true },
    { name: "accountEmail", type: "email", required: true },
    { name: "calendarId", type: "text", required: true },
    { name: "calendarName", type: "text", required: true },
    { name: "status", type: "select", required: true, defaultValue: "connected", options: options(["connected", "reauth_required", "revoked", "error"]), index: true },
    { name: "encryptedAccessToken", type: "text" },
    { name: "encryptedRefreshToken", type: "text" },
    { name: "accessTokenExpiresAt", type: "date" },
    { name: "scopes", type: "json", required: true },
    { name: "connectedBy", type: "relationship", relationTo: "users", required: true },
    { name: "lastSyncedAt", type: "date", index: true },
    { name: "lastError", type: "textarea" },
  ],
}

export const AppointmentCalendarEvents: CollectionConfig = {
  slug: "appointment-calendar-events",
  lockDocuments: false,
  labels: { singular: { en: "Appointment calendar event", nl: "Agenda-afspraak" }, plural: { en: "Appointment calendar events", nl: "Agenda-afspraken" } },
  access: systemAccess,
  hooks: { beforeChange: [protectCalendarEvent] },
  admin: {
    hidden: true,
    useAsTitle: "eventKey",
    defaultColumns: ["appointment", "connection", "status", "operation", "nextAttemptAt"],
    description: adminText("System-managed calendar synchronization outbox.", "Door het systeem beheerd postvak voor agendasynchronisatie."),
  },
  fields: [
    { name: "eventKey", type: "text", required: true, unique: true, index: true },
    { name: "appointment", type: "relationship", relationTo: "appointments", required: true, index: true },
    { name: "connection", type: "relationship", relationTo: "appointment-calendar-connections", required: true, index: true },
    { name: "eventVersion", type: "number", required: true, defaultValue: 1, min: 1, index: true },
    { name: "providerEventId", type: "text", index: true },
    { name: "status", type: "select", required: true, defaultValue: "queued", options: options(["queued", "processing", "synced", "failed", "cancelled"]), index: true },
    { name: "operation", type: "select", required: true, defaultValue: "upsert", options: options(["upsert", "delete"]), index: true },
    { name: "attemptCount", type: "number", required: true, defaultValue: 0, min: 0 },
    { name: "nextAttemptAt", type: "date", required: true, index: true },
    { name: "leaseUntil", type: "date", index: true },
    { name: "lastAttemptAt", type: "date" },
    { name: "syncedAt", type: "date", index: true },
    { name: "lastError", type: "textarea" },
  ],
}
