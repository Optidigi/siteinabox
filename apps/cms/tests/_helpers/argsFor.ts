/** Build partial hook/collection handler args without `any`. */
export function argsFor<T extends (...args: never[]) => unknown>(
  _fn: T,
  partial: Record<string, unknown>,
): Parameters<T>[0] {
  return partial as Parameters<T>[0]
}

/** Build partial access-check fixtures without `any`. */
export function accessArgsFor<T extends (...args: never[]) => unknown>(
  _fn: T,
  partial: Record<string, unknown>,
): Parameters<T>[0] {
  return partial as Parameters<T>[0]
}
