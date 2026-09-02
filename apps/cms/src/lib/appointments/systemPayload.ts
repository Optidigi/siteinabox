import type { Payload, PayloadRequest, Where } from "payload"

export type AppointmentSystemRecord = {
  id: string | number
  [key: string]: unknown
}

export type AppointmentSystemPayload = {
  find(args: {
    collection: string
    where?: Where
    limit: number
    page?: number
    sort?: string
    depth: number
    overrideAccess: true
    req?: Partial<PayloadRequest>
  }): Promise<{
    docs: AppointmentSystemRecord[]
    totalDocs?: number
    hasNextPage?: boolean
  }>
  findByID(args: {
    collection: string
    id: string | number
    depth: number
    overrideAccess: true
    req?: Partial<PayloadRequest>
  }): Promise<AppointmentSystemRecord>
  create(args: {
    collection: string
    data: Record<string, unknown>
    depth: number
    overrideAccess: true
    req?: Partial<PayloadRequest>
    context?: Record<string, unknown>
  }): Promise<AppointmentSystemRecord>
  update(args: {
    collection: string
    id: string | number
    where?: Where
    data: Record<string, unknown>
    depth: number
    overrideAccess: true
    req?: Partial<PayloadRequest>
    user?: unknown
    context?: Record<string, unknown>
  }): Promise<AppointmentSystemRecord>
  delete(args: {
    collection: string
    id?: string | number
    where?: Where
    overrideAccess: true
    req?: Partial<PayloadRequest>
    context?: Record<string, unknown>
  }): Promise<unknown>
}

export const asAppointmentSystemPayload = (payload: Payload): AppointmentSystemPayload =>
  payload as unknown as AppointmentSystemPayload

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
