import type { Access, FieldAccess, PayloadRequest } from "payload"
import { createTestPayload, createTestRequest } from "./testPayload"

type AccessInput = Parameters<Access<unknown>>[0]
type FieldAccessInput = Parameters<FieldAccess<Record<string, unknown> & { id: number | string }, Record<string, unknown>>>[0]
const baseRequest = await createTestRequest(createTestPayload())

type Input<T> = Omit<Partial<T>, "req"> & { req?: Partial<PayloadRequest> }

/** Complete the actual request contract; callers supply truthful generated users. */
export function accessArgs(partial: Input<AccessInput>): AccessInput {
  return { ...partial, req: { ...baseRequest, ...partial.req } }
}

export function fieldAccessArgs(partial: Input<FieldAccessInput>): FieldAccessInput {
  return { ...partial, req: { ...baseRequest, ...partial.req } }
}
