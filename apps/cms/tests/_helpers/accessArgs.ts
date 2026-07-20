import type { Access, FieldAccess } from "payload"

type AccessInput = Parameters<Access>[0]
type FieldAccessInput = Parameters<FieldAccess>[0]

/** Build partial access-check fixtures without `any`. */
export function accessArgs(partial: Record<string, unknown>): AccessInput {
  return partial as unknown as AccessInput
}

/** Build partial field-access fixtures without `any`. */
export function fieldAccessArgs(partial: Record<string, unknown>): FieldAccessInput {
  return partial as unknown as FieldAccessInput
}
