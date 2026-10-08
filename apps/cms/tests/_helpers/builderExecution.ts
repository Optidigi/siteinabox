import type { BuilderExecutionContext } from "@/lib/builder/executionContext"

/** Offline unit authority; never imported by application code. */
export const offlineBuilderExecution = (): BuilderExecutionContext => {
  const signal = new AbortController().signal
  return {
    signal,
    deadlineAt: new Date(Date.now() + 90000).toISOString(),
    assertActive: async () => { signal.throwIfAborted() },
    modelCall: async (_limits, generate) => generate(signal),
    withWrite: async (mutation) => mutation({ transactionID: "offline-unit-fixture" }),
    recordGenerationReferences: async () => {},
  }
}
