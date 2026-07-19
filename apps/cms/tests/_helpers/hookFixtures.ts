import { argsFor } from "./argsFor"

export type BeforeOperationHook = (args: {
  args: { data: unknown; req: unknown }
  collection: Record<string, unknown>
  context: unknown
  operation: string
  overrideAccess: boolean
  req: unknown
}) => unknown | Promise<unknown>

export type BeforeValidateHook = (args: {
  collection: Record<string, unknown>
  context: unknown
  data: unknown
  operation: string
  originalDoc: unknown
  req: unknown
}) => unknown | Promise<unknown>

export function asBeforeOperationHook(fn: unknown): BeforeOperationHook {
  return fn as BeforeOperationHook
}

export function asBeforeValidateHook(fn: unknown): BeforeValidateHook {
  return fn as BeforeValidateHook
}

export function callBeforeOpHook(
  hook: BeforeOperationHook,
  opts: {
    operation: "create" | "update" | "forgotPassword" | "delete" | "login"
    req: Record<string, unknown>
    data?: unknown
    context?: unknown
  },
) {
  return Promise.resolve().then(() => hook({
    args: { data: opts.data ?? null, req: opts.req },
    collection: {},
    context: opts.context ?? opts.req.context ?? {},
    operation: opts.operation,
    overrideAccess: false,
    req: opts.req,
  }))
}

export function hookArgsFor<T extends (...args: never[]) => unknown>(
  fn: T,
  partial: Record<string, unknown>,
): Parameters<T>[0] {
  return argsFor(fn, partial)
}
