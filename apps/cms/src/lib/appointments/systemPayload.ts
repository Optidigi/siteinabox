import type { Payload } from "payload"

export type AppointmentSystemPayload = Pick<Payload, "find" | "findByID" | "create" | "update" | "delete">

export const asAppointmentSystemPayload = (payload: AppointmentSystemPayload): AppointmentSystemPayload => payload

export const relationId = (value: unknown): string | null => {
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const id = (value as { id?: unknown }).id
  return typeof id === "string" || typeof id === "number" ? String(id) : null
}

export const recordText = (record: unknown, field: string): string | null => {
  const value = record && typeof record === "object" && !Array.isArray(record)
    ? (record as Record<string, unknown>)[field]
    : undefined
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export const recordNumber = (record: unknown, field: string, fallback = 0): number => {
  const value = Number(record && typeof record === "object" && !Array.isArray(record)
    ? (record as Record<string, unknown>)[field]
    : undefined)
  return Number.isFinite(value) ? value : fallback
}
