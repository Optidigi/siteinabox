import {
  GenerationInputSchema,
  NormalizedIntakeSchema,
  SiteGenerationSpecSchema,
  type GenerationInput,
  type NormalizedIntake,
  type SiteGenerationSpec,
} from "@siteinabox/contracts/generation"
import { BACKGROUND_MODE_IDS, CTA_VARIANTS, FOOTER_VARIANTS, HERO_BLOCK_TYPES, HERO_VARIANTS, NAVBAR_PLACEMENTS, NAVBAR_VARIANTS, SERVICES_VARIANTS } from "@siteinabox/contracts"
import { hashStableValue } from "@/lib/intake/normalizeIntake"
import { loadMockSiteGenerationSpec, type MockGenerationFixture } from "@/lib/intake/mockGeneration"
import { SitegenOutputSchema } from "@/lib/sitegen/output-schema"
import {
  SITE_GENERATION_PROMPT_VERSION,
  SITE_GENERATION_SYSTEM_PROMPT,
} from "./prompts/siteGenerationPrompt"
import { buildSiteGenerationModelInput, type SiteGenerationModelInput } from "./siteGenerationInput"

export type SiteGenerationProviderName = "mock" | "openai"

export type SiteGenerationProviderRequest = {
  normalized: NormalizedIntake
  input: SiteGenerationModelInput
  inputHash: string
}

export type SiteGenerationProviderResult = {
  provider: SiteGenerationProviderName | string
  model: string
  promptVersion: string
  input: SiteGenerationModelInput
  inputHash: string
  outputHash?: string
  rawOutput?: string
  parsedOutput?: unknown
  spec?: SiteGenerationSpec
}

export interface SiteGenerationProvider {
  name: SiteGenerationProviderName | string
  model: string
  promptVersion: string
  generate(request: SiteGenerationProviderRequest): Promise<SiteGenerationProviderResult>
}

export type SiteGenerationProviderConfig = {
  provider?: SiteGenerationProviderName
  model?: string
  mockFixture?: MockGenerationFixture
  apiKey?: string
  baseUrl?: string
}

const outputHash = (value: unknown): string => hashStableValue(value)

const ensureEnabledSitegenBlocks = (input: SiteGenerationModelInput): void => {
  if (input.eligibleSections.length === 0) {
    throw new Error("Sitegen generation is paused: no approved section is eligible for this intake.")
  }
}

const stringValue = { type: "string" } as const
const nullableStringValue = { type: ["string", "null"] } as const
const backgroundModeValue = { type: ["string", "null"], enum: [...BACKGROUND_MODE_IDS, null] } as const
const actionValue = {
  type: "object",
  additionalProperties: false,
  required: ["label", "href"],
  properties: { label: stringValue, href: stringValue },
} as const
const optionalActionValue = { anyOf: [actionValue, { type: "null" }] } as const
const baseSectionProperties = {
  blockType: stringValue,
  anchor: nullableStringValue,
} as const

const navbarSchema = {
  type: "object",
  additionalProperties: false,
  required: ["variant", "placement"],
  properties: {
    variant: { type: "string", enum: [...NAVBAR_VARIANTS] },
    placement: { type: "string", enum: [...NAVBAR_PLACEMENTS] },
  },
} as const

const footerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["variant"],
  properties: {
    variant: { type: "string", enum: [...FOOTER_VARIANTS] },
  },
} as const

const sectionSchema = (
  blockType: string | readonly string[],
  properties: Record<string, unknown>,
  required: readonly string[],
) => ({
  type: "object",
  additionalProperties: false,
  required: [...required],
  properties: {
    ...baseSectionProperties,
    blockType: Array.isArray(blockType)
      ? { type: "string", enum: [...blockType] }
      : { type: "string", const: blockType },
    ...properties,
  },
})

const sectionSchemas = [
  sectionSchema(HERO_BLOCK_TYPES, {
    variant: { type: "string", enum: [...HERO_VARIANTS] },
    backgroundMode: backgroundModeValue,
    heading: stringValue,
    body: stringValue,
    primaryAction: actionValue,
    secondaryAction: optionalActionValue,
    mediaId: nullableStringValue,
    highlights: { type: "array", minItems: 2, maxItems: 3, items: { type: "object", additionalProperties: false, required: ["title", "body"], properties: { title: stringValue, body: stringValue } } },
    serviceHighlights: { type: ["array", "null"], minItems: 2, maxItems: 4, items: { type: "object", additionalProperties: false, required: ["title", "body", "heroHeading", "heroBody", "primaryAction", "secondaryAction"], properties: { title: stringValue, body: stringValue, heroHeading: stringValue, heroBody: stringValue, primaryAction: optionalActionValue, secondaryAction: optionalActionValue, mediaId: nullableStringValue } } },
  }, ["blockType", "variant", "anchor", "heading", "body", "primaryAction", "secondaryAction", "mediaId"]),
  sectionSchema("services", {
    variant: { type: "string", enum: [...SERVICES_VARIANTS] },
    heading: stringValue,
    intro: nullableStringValue,
    items: { type: "array", minItems: 2, maxItems: 6, items: { type: "object", additionalProperties: false, required: ["title", "body", "action"], properties: { title: stringValue, body: stringValue, action: optionalActionValue } } },
  }, ["blockType", "variant", "anchor", "heading", "intro", "items"]),
  sectionSchema("about", {
    heading: stringValue,
    body: stringValue,
    mediaId: nullableStringValue,
    highlights: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["title", "text"], properties: { title: stringValue, text: nullableStringValue } } },
  }, ["blockType", "anchor", "heading", "body", "mediaId", "highlights"]),
  sectionSchema("process", {
    heading: stringValue,
    intro: nullableStringValue,
    steps: { type: "array", minItems: 2, maxItems: 6, items: { type: "object", additionalProperties: false, required: ["title", "body"], properties: { title: stringValue, body: stringValue } } },
  }, ["blockType", "anchor", "heading", "intro", "steps"]),
  sectionSchema("work", {
    heading: stringValue,
    intro: nullableStringValue,
    projects: { type: "array", minItems: 1, maxItems: 6, items: { type: "object", additionalProperties: false, required: ["sourceId", "title", "summary", "mediaIds", "action"], properties: { sourceId: stringValue, title: stringValue, summary: nullableStringValue, mediaIds: { type: "array", maxItems: 8, items: stringValue }, action: optionalActionValue } } },
  }, ["blockType", "anchor", "heading", "intro", "projects"]),
  sectionSchema("reviews", {
    heading: stringValue,
    intro: nullableStringValue,
    reviewSourceIds: { type: "array", minItems: 1, maxItems: 6, items: stringValue },
  }, ["blockType", "anchor", "heading", "intro", "reviewSourceIds"]),
  sectionSchema("pricing", {
    heading: stringValue,
    intro: nullableStringValue,
    pricingSourceIds: { type: "array", minItems: 1, maxItems: 4, items: stringValue },
  }, ["blockType", "anchor", "heading", "intro", "pricingSourceIds"]),
  sectionSchema("faq", {
    heading: stringValue,
    intro: nullableStringValue,
    items: { type: "array", minItems: 2, maxItems: 10, items: { type: "object", additionalProperties: false, required: ["question", "answer"], properties: { question: stringValue, answer: stringValue } } },
  }, ["blockType", "anchor", "heading", "intro", "items"]),
  sectionSchema("cta", {
    variant: { type: "string", enum: [...CTA_VARIANTS] },
    backgroundMode: backgroundModeValue,
    heading: stringValue,
    body: nullableStringValue,
    primaryAction: actionValue,
    secondaryAction: optionalActionValue,
    mediaId: nullableStringValue,
  }, ["blockType", "variant", "anchor", "heading", "body", "primaryAction", "secondaryAction", "mediaId"]),
  sectionSchema("contact", {
    heading: stringValue,
    body: nullableStringValue,
    bookingAction: optionalActionValue,
    serviceArea: { type: "array", maxItems: 8, items: stringValue },
    openingHours: nullableStringValue,
  }, ["blockType", "anchor", "heading", "body", "bookingAction", "serviceArea", "openingHours"]),
] as const

/** JSON Schema sent to a structured-output capable model. It contains only the shallow Sitegen projection. */
export const siteGenerationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["navbar", "footer", "pages"],
  properties: {
    navbar: navbarSchema,
    footer: footerSchema,
    pages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["slug", "title", "sections"],
        properties: {
          slug: stringValue,
          title: stringValue,
          sections: { type: "array", minItems: 1, items: { anyOf: [...sectionSchemas] } },
        },
      },
    },
  },
} as const

const extractOpenAIOutputText = (response: unknown): string => {
  if (!response || typeof response !== "object" || Array.isArray(response)) throw new Error("OpenAI response was not an object")
  const record = response as Record<string, unknown>
  if (typeof record.output_text === "string") return record.output_text
  const output = Array.isArray(record.output) ? record.output : []
  const text = output.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const rawContent = (item as Record<string, unknown>).content
    const content: unknown[] = Array.isArray(rawContent) ? rawContent : []
    return content.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
      const value = entry as Record<string, unknown>
      return value.type === "output_text" && typeof value.text === "string" ? [value.text] : []
    })
  }).join("")
  if (text.trim()) return text
  throw new Error("OpenAI response did not include output text")
}

export const createMockSiteGenerationProvider = (
  fixture: MockGenerationFixture = "generic",
): SiteGenerationProvider => ({
  name: "mock",
  model: `fixture:${fixture}`,
  promptVersion: SITE_GENERATION_PROMPT_VERSION,
  async generate(request) {
    const spec = loadMockSiteGenerationSpec(request.normalized, fixture)
    return {
      provider: "mock",
      model: `fixture:${fixture}`,
      promptVersion: SITE_GENERATION_PROMPT_VERSION,
      input: request.input,
      inputHash: request.inputHash,
      outputHash: outputHash(spec),
      rawOutput: JSON.stringify(spec),
      parsedOutput: spec,
      spec,
    }
  },
})

export const createOpenAISiteGenerationProvider = (config: SiteGenerationProviderConfig = {}): SiteGenerationProvider => {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY
  const model = config.model ?? process.env.SITE_GENERATION_OPENAI_MODEL ?? "gpt-5.5"
  const baseUrl = (config.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")

  return {
    name: "openai",
    model,
    promptVersion: SITE_GENERATION_PROMPT_VERSION,
    async generate(request) {
  ensureEnabledSitegenBlocks(request.input)
      if (!apiKey) throw new Error("OPENAI_API_KEY is required when SITE_GENERATION_PROVIDER=openai")
      const response = await fetch(`${baseUrl}/responses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          store: false,
          input: [
            { role: "developer", content: SITE_GENERATION_SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(request.input) },
          ],
          text: { format: { type: "json_schema", name: "sitegen_owned_sections", strict: true, schema: siteGenerationJsonSchema } },
        }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const errorRecord = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).error : null
        const message = errorRecord && typeof errorRecord === "object" && !Array.isArray(errorRecord) && typeof (errorRecord as Record<string, unknown>).message === "string"
          ? (errorRecord as Record<string, unknown>).message as string
          : `OpenAI request failed with ${response.status}`
        throw new Error(message)
      }
      const rawOutput = extractOpenAIOutputText(body)
      const parsedOutput: unknown = JSON.parse(rawOutput)
      const parsed = SitegenOutputSchema.safeParse(parsedOutput)
      if (!parsed.success) throw new Error(`Structured Sitegen output failed validation: ${parsed.error.message}`)
      return {
        provider: "openai",
        model,
        promptVersion: SITE_GENERATION_PROMPT_VERSION,
        input: request.input,
        inputHash: request.inputHash,
        outputHash: outputHash(parsed.data),
        rawOutput,
        parsedOutput: parsed.data,
      }
    },
  }
}

export const resolveSiteGenerationProvider = (config: SiteGenerationProviderConfig = {}): SiteGenerationProvider => {
  const provider = config.provider ?? (process.env.SITE_GENERATION_PROVIDER as SiteGenerationProviderName | undefined) ?? "mock"
  return provider === "openai" ? createOpenAISiteGenerationProvider(config) : createMockSiteGenerationProvider(config.mockFixture)
}

export const createSiteGenerationProviderRequest = (
  normalized: NormalizedIntake,
  generationInput?: GenerationInput,
): SiteGenerationProviderRequest => {
  const parsedNormalized = NormalizedIntakeSchema.parse(normalized)
  const parsedGenerationInput = generationInput ? GenerationInputSchema.parse(generationInput) : undefined
  const input = buildSiteGenerationModelInput(parsedNormalized, parsedGenerationInput)
  return {
    normalized: parsedNormalized,
    input,
    inputHash: hashStableValue({ promptVersion: SITE_GENERATION_PROMPT_VERSION, input }),
  }
}

export const parseGeneratedSiteSpec = (value: unknown): SiteGenerationSpec => SiteGenerationSpecSchema.parse(value)
