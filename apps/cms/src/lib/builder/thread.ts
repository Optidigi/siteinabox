import { z } from "zod"
import { BuilderFactsSchema, type BuilderFacts } from "./facts"

export const BuilderChoiceSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(8).max(80),
})

export type BuilderChoice = z.infer<typeof BuilderChoiceSchema>

export const CONTACT_CHOICES: BuilderChoice[] = [
  { id: "phone", label: "Vooral bellen" },
  { id: "whatsapp", label: "Via WhatsApp" },
  { id: "phone-whatsapp", label: "Bellen en WhatsApp" },
  { id: "appointment", label: "Afspraak maken" },
  { id: "form", label: "Een formulier" },
]

export const GENERATE_CHOICE: BuilderChoice = {
  id: "generate",
  label: "Maak de homepage",
}

export const FEEL_CHOICES: BuilderChoice[] = [
  { id: "feel-terracotta", label: "Warm terracotta, zacht" },
  { id: "feel-blue", label: "Strak blauw, modern" },
  { id: "feel-emerald", label: "Groen en praktisch" },
  { id: "feel-red", label: "Rood en opvallend" },
]

export const OPEN_PREVIEW_ACTION_ID = "open-preview" as const

export const OPEN_PREVIEW_ACTION = {
  id: OPEN_PREVIEW_ACTION_ID,
  label: "Bekijk je site",
}

export const BuilderMessageActionSchema = z.object({
  id: z.literal(OPEN_PREVIEW_ACTION_ID),
  label: z.string().trim().min(4).max(40),
})

export type BuilderMessageAction = z.infer<typeof BuilderMessageActionSchema>

export const BuilderChatMessageSchema = z.object({
  role: z.enum(["assistant", "user"]),
  text: z.string().trim().min(1).max(8000),
  choices: z.array(BuilderChoiceSchema).max(8).optional(),
  actions: z.array(BuilderMessageActionSchema).max(4).optional(),
})

export const BuilderLegalSchema = z.object({
  businessUseAccepted: z.boolean(),
  termsAccepted: z.boolean(),
  marketingOptIn: z.boolean().default(false),
})

export const BUILDER_STAGE_HEADLINE = "Wat gaan we bouwen?"

export const BUILDER_STAGE_PLACEHOLDER =
  "Bijv: Ik ben kapper in Tilburg, ik doe knippen, kleur en baard."

/** ChatGPT `--thread-content-max-width`: one well for landing, thread, and composer. */
export const BUILDER_CHAT_WELL_CLASS = "max-w-[40rem]"

export const defaultBuilderMessages = (): BuilderChatMessage[] => []

export const builderPreviewActions = (
  applied: boolean | undefined,
  clientSlug?: string | null,
): BuilderMessageAction[] | undefined =>
  applied && clientSlug ? [OPEN_PREVIEW_ACTION] : undefined

export const isBuilderAgentStage = (
  messages: BuilderChatMessage[],
  clientSlug: string | null | undefined,
): boolean =>
  !clientSlug && messages.length <= 1 && messages.every((entry) => entry.role === "assistant")

/** Drop a leftover landing greeting so the first user turn is the start of the thread. */
export const messagesForBuilderSession = (
  messages: BuilderChatMessage[],
  clientSlug?: string | null,
): BuilderChatMessage[] => {
  const firstUser = messages.findIndex((entry) => entry.role === "user")
  if (firstUser === -1) return clientSlug ? messages : []
  return firstUser === 0 ? messages : messages.slice(firstUser)
}

export const withOpenPreviewAction = (
  messages: BuilderChatMessage[],
  hasPreview: boolean,
): BuilderChatMessage[] => {
  if (!hasPreview) return messages
  if (messages.some((entry) => entry.actions?.some((action) => action.id === OPEN_PREVIEW_ACTION_ID))) {
    return messages
  }
  let lastAssistant = -1
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      lastAssistant = index
      break
    }
  }
  if (lastAssistant < 0) return messages
  return messages.map((entry, index) => (
    index === lastAssistant ? { ...entry, actions: [OPEN_PREVIEW_ACTION] } : entry
  ))
}

export const BuilderThreadSchema = z.object({
  customerEmail: z.string().trim().email().max(160),
  displayName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().max(40).default(""),
  legal: BuilderLegalSchema,
  messages: z.array(BuilderChatMessageSchema).max(200),
  facts: BuilderFactsSchema.nullable(),
  clientSlug: z.string().trim().min(1).max(120).nullable(),
})

export type BuilderChatMessage = z.infer<typeof BuilderChatMessageSchema>
export type BuilderLegal = z.infer<typeof BuilderLegalSchema>
export type BuilderThread = z.infer<typeof BuilderThreadSchema>
export type BuilderFactsState = BuilderFacts | null

export const BUILDER_LANDING_OPENER: BuilderChatMessage[] = [
  { role: "assistant", text: BUILDER_STAGE_HEADLINE },
]

export const normalizeBuilderEmail = (email: string): string => email.trim().toLowerCase()

export const legalIsAccepted = (legal: BuilderLegal): boolean =>
  legal.businessUseAccepted === true && legal.termsAccepted === true
