import type { Payload } from "payload"
import type { BuilderFacts } from "@/lib/builder/facts"
import { describeMaintainerIntent, interpretMaintainerIntent } from "./interpretMaintainer"
import { themeTokenSpecFromFacts } from "./themeFromFacts"
import {
  defaultEnabledAppointments,
  replaceSection,
  setAppointments,
  setContact,
  setHours,
  setTheme,
  updateSectionProps,
  type AgentWriteContext,
} from "./tools"

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const

const SETTINGS_INTENTS = new Set(["setAppointments", "setHours", "setContact"])

export const applyMaintainerTurn = async (input: {
  payload: Payload
  tenantId: string | number
  message: string
  facts: BuilderFacts
  pageSlug?: string | null
  selectedBlockIndex?: number | null
  role?: "super-admin" | "owner" | "editor" | "viewer" | string | null
  user?: AgentWriteContext["user"]
  intent?: ReturnType<typeof interpretMaintainerIntent>
}): Promise<{ text: string; applied: boolean; regenerate: boolean }> => {
  const intent = input.intent ?? interpretMaintainerIntent(input.message)
  const ctx: AgentWriteContext = { payload: input.payload, tenantId: input.tenantId, user: input.user }
  if (intent.kind === "none") {
    return { text: describeMaintainerIntent(intent, input.facts), applied: false, regenerate: false }
  }
  if (intent.kind === "regenerate") {
    return { text: describeMaintainerIntent(intent, input.facts), applied: false, regenerate: true }
  }
  if (SETTINGS_INTENTS.has(intent.kind) && input.role === "editor") {
    return {
      text: "Alleen de eigenaar kan afspraken, openingstijden en contactgegevens wijzigen.",
      applied: false,
      regenerate: false,
    }
  }
  if (intent.kind === "setTheme") {
    await setTheme(ctx, themeTokenSpecFromFacts(input.facts))
  } else if (intent.kind === "setAppointments") {
    await setAppointments(ctx, defaultEnabledAppointments())
  } else if (intent.kind === "setHours") {
    await setHours(ctx, WEEKDAYS.map((day) => ({ day, open: intent.open, close: intent.close })))
  } else if (intent.kind === "setContact") {
    await setContact(ctx, { phone: intent.phone ?? null, address: intent.address ?? null })
  } else if (intent.kind === "replaceSection") {
    await replaceSection(ctx, {
      pageSlug: input.pageSlug?.trim() || "index",
      blockIndex: input.selectedBlockIndex,
      variant: intent.variant,
    })
  } else {
    await updateSectionProps(ctx, {
      pageSlug: input.pageSlug?.trim() || "index",
      blockIndex: input.selectedBlockIndex,
      field: intent.field,
      value: intent.value,
    })
  }
  return { text: describeMaintainerIntent(intent, input.facts), applied: true, regenerate: false }
}
