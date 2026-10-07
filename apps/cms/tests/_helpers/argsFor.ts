/** Verify the actual handler argument contract without altering the fixture. */
export function argsFor<T extends (...args: never[]) => unknown>(
  _fn: T,
  args: Parameters<T>[0],
): Parameters<T>[0] {
  return args
}

/** Access fixtures satisfy the same installed handler contract as callers. */
export const accessArgsFor = argsFor
