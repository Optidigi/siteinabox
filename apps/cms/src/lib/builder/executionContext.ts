import type { PayloadRequest } from "payload"

export type BuilderModelCall = Readonly<{
  model: "openai/gpt-5.6-luna"
  reasoningEffort: "low" | "medium"
  inputBytes: number
  maxOutputTokens: number
  maxSteps: number
}>

export type BuilderTokenUsage = Readonly<{
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number | null
  cacheCreationInputTokens: number | null
}>

// This authority is supplied by the verified-account reservation service.
// Model/tool input can never construct or replace it.
export interface BuilderExecutionContext {
  readonly signal: AbortSignal
  readonly deadlineAt: string
  assertActive(): Promise<void>
  modelCall<T>(
    limits: BuilderModelCall,
    generate: (signal: AbortSignal) => Promise<T>,
    usage: (result: T) => BuilderTokenUsage | null | Promise<BuilderTokenUsage | null>,
  ): Promise<T>
  withWrite<T>(mutation: (req: Partial<PayloadRequest>) => Promise<T>): Promise<T>
  recordGenerationReferences(references: {
    intakeSubmissionId?: number
    generationRunId?: number
  }): Promise<void>
}
