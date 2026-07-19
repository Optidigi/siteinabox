import type { PayloadRequest } from "payload"

export type FieldValidateContext = {
  siblingData?: Record<string, unknown>
  req?: PayloadRequest
}

export type FieldAdminConditionContext = {
  type?: string
  [key: string]: unknown
}
