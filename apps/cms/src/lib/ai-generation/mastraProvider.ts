import { Agent } from "@mastra/core/agent"
import { SITE_GENERATION_SYSTEM_PROMPT, SITE_GENERATION_PROMPT_VERSION } from "./prompts/siteGenerationPrompt"
import { SitegenOutputSchema } from "@/lib/sitegen/output-schema"
import { coerceSitegenModelJson } from "@/lib/sitegen/coerceModelJson"
import type { SiteGenerationProvider, SiteGenerationProviderConfig, SiteGenerationProviderRequest, SiteGenerationProviderResult } from "./providers"

const DEFAULT_MASTRA_MODEL = "openai/gpt-5.6-luna"
const REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const

export type MastraReasoningEffort = (typeof REASONING_EFFORTS)[number]

const ensureEnabledSitegenBlocks = (input: SiteGenerationProviderRequest["input"]): void => {
  if (input.eligibleSections.length === 0) {
    throw new Error("Sitegen generation is paused: no approved section is eligible for this intake.")
  }
}

type EnvLookup = Record<string, string | undefined>

export const defaultMastraModelId = (env: EnvLookup = process.env): string =>
  env.SITE_GENERATION_MASTRA_MODEL?.trim()
  || process.env.SITE_GENERATION_MASTRA_MODEL?.trim()
  || DEFAULT_MASTRA_MODEL

export const defaultMastraReasoningEffort = (env: EnvLookup = process.env): MastraReasoningEffort => {
  const value = (
    env.SITE_GENERATION_MASTRA_REASONING_EFFORT
    ?? process.env.SITE_GENERATION_MASTRA_REASONING_EFFORT
  )?.trim().toLowerCase()
  return REASONING_EFFORTS.includes(value as MastraReasoningEffort)
    ? (value as MastraReasoningEffort)
    : "high"
}

export const defaultMastraMaintainReasoningEffort = (env: EnvLookup = process.env): MastraReasoningEffort => {
  const value = (
    env.SITE_GENERATION_MASTRA_MAINTAIN_REASONING_EFFORT
    ?? process.env.SITE_GENERATION_MASTRA_MAINTAIN_REASONING_EFFORT
  )?.trim().toLowerCase()
  return REASONING_EFFORTS.includes(value as MastraReasoningEffort)
    ? (value as MastraReasoningEffort)
    : "medium"
}

export const defaultMastraChatReasoningEffort = (env: EnvLookup = process.env): MastraReasoningEffort => {
  const value = (
    env.SITE_GENERATION_MASTRA_CHAT_REASONING_EFFORT
    ?? process.env.SITE_GENERATION_MASTRA_CHAT_REASONING_EFFORT
  )?.trim().toLowerCase()
  return REASONING_EFFORTS.includes(value as MastraReasoningEffort)
    ? (value as MastraReasoningEffort)
    : "medium"
}

export const mastraOpenAIProviderOptions = (
  effort: MastraReasoningEffort = defaultMastraReasoningEffort(),
): { openai: { reasoningEffort: MastraReasoningEffort } } => ({
  openai: { reasoningEffort: effort },
})

export const parseMastraJsonObject = (result: { object?: unknown; text?: string }): unknown => {
  if (result.object != null) return result.object
  const text = typeof result.text === "string" ? result.text.trim() : ""
  if (!text) throw new Error("Mastra response did not include Sitegen JSON")
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced?.[1] ?? text).trim()
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("Mastra response did not include a JSON object")
  return JSON.parse(candidate.slice(start, end + 1)) as unknown
}

export const createMastraSiteGenerationProvider = (
  config: SiteGenerationProviderConfig = {},
): SiteGenerationProvider => {
  const model = config.model ?? defaultMastraModelId()
  const reasoningEffort = defaultMastraReasoningEffort()
  const providerOptions = mastraOpenAIProviderOptions(reasoningEffort)
  return {
    name: "mastra",
    model,
    promptVersion: SITE_GENERATION_PROMPT_VERSION,
    async generate(request: SiteGenerationProviderRequest): Promise<SiteGenerationProviderResult> {
      ensureEnabledSitegenBlocks(request.input)
      if (!process.env.OPENAI_API_KEY?.trim()) {
        throw new Error("OPENAI_API_KEY is required when SITE_GENERATION_PROVIDER=mastra")
      }
      const agent = new Agent({
        id: "siab-sitegen",
        name: "Site in a Box Sitegen",
        instructions: {
          role: "system",
          content: SITE_GENERATION_SYSTEM_PROMPT,
          providerOptions,
        },
        model,
      })
      // OpenAI structured output rejects Zod discriminatedUnion (`oneOf`) on
      // `pages[].sections`. Ask for JSON and validate with SitegenOutputSchema.
      const generated = await agent.generate(
        [
          "Return one JSON object only. No markdown, no commentary.",
          JSON.stringify(request.input),
        ].join("\n\n"),
        { providerOptions },
      )
      const parsedOutput = SitegenOutputSchema.parse(coerceSitegenModelJson(parseMastraJsonObject(generated)))
      return {
        provider: "mastra",
        model: `${model}:${reasoningEffort}`,
        promptVersion: SITE_GENERATION_PROMPT_VERSION,
        input: request.input,
        inputHash: request.inputHash,
        rawOutput: JSON.stringify(parsedOutput),
        parsedOutput,
      }
    },
  }
}
