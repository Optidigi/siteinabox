import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import {
  BACKGROUND_MODE_IDS,
  COLOR_SCHEME_IDS,
  FONT_SCHEME_IDS,
  NAVBAR_PLACEMENTS,
  SHAPE_SCHEME_IDS,
} from "@siteinabox/contracts"
import {
  defaultMastraMaintainReasoningEffort,
  defaultMastraModelId,
  mastraOpenAIProviderOptions,
} from "@/lib/ai-generation/mastraProvider"
import { sitegenCatalogDigest } from "@/lib/builder/catalogHonesty"
import { mergeThemePatch } from "@/lib/theme/normalizeTheme"
import type { BuilderChatMessage } from "@/lib/builder/thread"
import { maintainerIntentFromPlan, planBuilderTurn } from "@/lib/builder/planTurn"
import { applyMaintainerTurn } from "./runMaintainerTurn"
import { interpretMaintainerIntent } from "./interpretMaintainer"
import type { BuilderFacts } from "@/lib/builder/facts"
import {
  compactBlockForModel,
  defaultEnabledAppointments,
  loadSiteSnapshot,
  patchSection,
  pruneUnavailableBlocksIfPresent,
  removeUnavailableBlocks,
  replaceSection,
  setAppointments,
  setChrome,
  setContact,
  setHours,
  setSeo,
  setTheme,
  type AgentWriteContext,
  type SiteEditorSnapshot,
} from "./tools"

const actionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(240),
})

const WRITE_TOOL_NAMES = new Set([
  "setTheme",
  "setBlock",
  "replaceSection",
  "setChrome",
  "setSeo",
  "setHours",
  "setContact",
  "setAppointments",
  "removeUnavailableBlocks",
  "requestRegenerate",
])

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const

const SETTINGS_TOOLS = new Set(["setHours", "setContact", "setAppointments"])

export type SiteEditorTurnResult = {
  text: string
  applied: boolean
  regenerate: boolean
  snapshot: SiteEditorSnapshot
}

export type SiteEditorStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; result: SiteEditorTurnResult }
  | { type: "error"; message: string }

export const encodeSiteEditorSse = (event: SiteEditorStreamEvent): string =>
  `data: ${JSON.stringify(event)}\n\n`

export type SiteEditorTurnInput = {
  ctx: AgentWriteContext
  message: string
  pageSlug: string
  selectedBlockIndex?: number | null
  role?: string | null
  recentMessages?: BuilderChatMessage[]
  allowRegenerate?: boolean
  facts: BuilderFacts
}

const denySettingsIfEditor = (role: string | null | undefined, toolName: string): void => {
  if (SETTINGS_TOOLS.has(toolName) && role === "editor") {
    throw new Error("Alleen de eigenaar kan afspraken, openingstijden en contactgegevens wijzigen.")
  }
}

const modelContextFromSnapshot = (
  snapshot: SiteEditorSnapshot,
  selectedBlockIndex: number | null,
): Record<string, unknown> => ({
  selectedBlockIndex,
  theme: snapshot.theme,
  chrome: snapshot.chrome,
  contact: snapshot.contact,
  appointmentsEnabled: snapshot.appointmentsEnabled,
  seo: snapshot.page?.seo ?? null,
  blocks: (snapshot.page?.blocks ?? []).map(compactBlockForModel),
  colorSchemeIds: COLOR_SCHEME_IDS,
  fontSchemeIds: FONT_SCHEME_IDS,
  shapeSchemeIds: SHAPE_SCHEME_IDS,
  backgroundModeIds: BACKGROUND_MODE_IDS,
})

export const summarizeEditorToolResults = (
  results: unknown[],
): { applied: boolean; regenerate: boolean } => {
  let applied = false
  let regenerate = false
  for (const row of results) {
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    const payload = record.payload && typeof record.payload === "object"
      ? record.payload as Record<string, unknown>
      : record
    const name = typeof payload.toolName === "string"
      ? payload.toolName
      : typeof record.name === "string"
        ? record.name
        : undefined
    const failed = Boolean(record.error ?? payload.isError ?? payload.error)
    if (failed || !name) continue
    if (name === "requestRegenerate") regenerate = true
    if (WRITE_TOOL_NAMES.has(name)) applied = true
  }
  return { applied, regenerate }
}

const createSiteEditorTools = (input: SiteEditorTurnInput) => {
  const pageSlug = input.pageSlug.trim() || "index"
  const selected = input.selectedBlockIndex
  const role = input.role
  const ctx = input.ctx

  const resolveIndex = (blockIndex: number | null | undefined): number | null =>
    blockIndex ?? selected ?? null

  const getSiteContext = createTool({
    id: "getSiteContext",
    description: "Read the current theme, page blocks, chrome, contact and SEO after a write.",
    inputSchema: z.object({}),
    execute: async () => {
      const snapshot = await loadSiteSnapshot(ctx, pageSlug)
      return modelContextFromSnapshot(snapshot, selected ?? null)
    },
  })

  const setThemeTool = createTool({
    id: "setTheme",
    description: "Patch the live ThemeTokenSpec (mode, backgroundMode, color/font/shape scheme IDs).",
    inputSchema: z.object({
      appearanceMode: z.enum(["light", "dark", "system"]).optional(),
      backgroundMode: z.enum(BACKGROUND_MODE_IDS).optional(),
      colorSchemeId: z.enum(COLOR_SCHEME_IDS).optional(),
      fontSchemeId: z.enum(FONT_SCHEME_IDS).optional(),
      shapeSchemeId: z.enum(SHAPE_SCHEME_IDS).optional(),
    }),
    execute: async (patch) => {
      const snapshot = await loadSiteSnapshot(ctx, pageSlug)
      const merged = mergeThemePatch(snapshot.theme, {
        appearance: {
          ...(patch.appearanceMode ? { mode: patch.appearanceMode } : {}),
          ...(patch.backgroundMode ? { backgroundMode: patch.backgroundMode } : {}),
        },
        ...(patch.colorSchemeId ? { colors: { schemeId: patch.colorSchemeId } } : {}),
        ...(patch.fontSchemeId ? { fonts: { schemeId: patch.fontSchemeId } } : {}),
        ...(patch.shapeSchemeId ? { shape: { schemeId: patch.shapeSchemeId } } : {}),
      })
      if (!merged) throw new Error("Could not merge theme patch.")
      const theme = await setTheme(ctx, merged)
      return { ok: true, theme }
    },
  })

  const setBlock = createTool({
    id: "setBlock",
    description: "Patch copy and allowed fields on a live catalog section. Rewrite services.items to real named services when titles are sentence fragments. Does not invent media IDs.",
    inputSchema: z.object({
      blockIndex: z.number().int().min(0).nullable().optional(),
      heading: z.string().trim().min(1).max(200).optional(),
      body: z.string().trim().min(1).max(4000).optional(),
      intro: z.string().trim().min(1).max(800).nullable().optional(),
      primaryAction: actionSchema.nullable().optional(),
      secondaryAction: actionSchema.nullable().optional(),
      backgroundMode: z.enum(BACKGROUND_MODE_IDS).nullable().optional(),
      highlights: z.array(z.object({ title: z.string().trim().min(1), body: z.string().trim().min(1) })).max(4).optional(),
      items: z.array(z.object({
        title: z.string().trim().min(1),
        body: z.string().trim().min(1),
        action: actionSchema.nullable().optional(),
      })).min(2).max(6).optional(),
      anchor: z.string().trim().min(1).max(80).nullable().optional(),
    }),
    execute: async ({ blockIndex, ...patch }) => {
      await patchSection(ctx, { pageSlug, blockIndex: resolveIndex(blockIndex), patch })
      return { ok: true }
    },
  })

  const replaceSectionTool = createTool({
    id: "replaceSection",
    description: "Switch a section to a live numbered variant (hero-01…05, services-01/02, cta-01/02, appointments-01).",
    inputSchema: z.object({
      blockIndex: z.number().int().min(0).nullable().optional(),
      variant: z.string().trim().min(3).max(40),
    }),
    execute: async ({ blockIndex, variant }) => {
      await replaceSection(ctx, { pageSlug, blockIndex: resolveIndex(blockIndex), variant })
      return { ok: true, variant }
    },
  })

  const setChromeTool = createTool({
    id: "setChrome",
    description: "Set navbar/footer numbered variants, navbar placement, or footer tagline.",
    inputSchema: z.object({
      navbarVariant: z.string().trim().min(1).max(40).optional(),
      navbarPlacement: z.enum(NAVBAR_PLACEMENTS).optional(),
      footerVariant: z.string().trim().min(1).max(40).optional(),
      footerTagline: z.string().trim().min(1).max(200).nullable().optional(),
    }),
    execute: async (chrome) => {
      await setChrome(ctx, chrome)
      return { ok: true }
    },
  })

  const setSeoTool = createTool({
    id: "setSeo",
    description: "Update the page SEO title and description. Do not set Open Graph images.",
    inputSchema: z.object({
      title: z.string().trim().min(1).max(120).nullable().optional(),
      description: z.string().trim().min(1).max(320).nullable().optional(),
    }),
    execute: async (seo) => {
      await setSeo(ctx, { pageSlug, ...seo })
      return { ok: true }
    },
  })

  const setHoursTool = createTool({
    id: "setHours",
    description: "Set weekday opening hours. Owner only.",
    inputSchema: z.object({
      open: z.string().regex(/^\d{2}:\d{2}$/),
      close: z.string().regex(/^\d{2}:\d{2}$/),
    }),
    execute: async ({ open, close }) => {
      denySettingsIfEditor(role, "setHours")
      await setHours(ctx, WEEKDAYS.map((day) => ({ day, open, close })))
      return { ok: true, open, close }
    },
  })

  const setContactTool = createTool({
    id: "setContact",
    description: "Set public phone and/or address. Owner only.",
    inputSchema: z.object({
      phone: z.string().trim().min(6).max(40).nullable().optional(),
      address: z.string().trim().min(3).max(160).nullable().optional(),
    }),
    execute: async (contact) => {
      denySettingsIfEditor(role, "setContact")
      await setContact(ctx, contact)
      return { ok: true }
    },
  })

  const setAppointmentsTool = createTool({
    id: "setAppointments",
    description: "Enable the native appointments module with default weekday windows. Owner only.",
    inputSchema: z.object({}),
    execute: async () => {
      denySettingsIfEditor(role, "setAppointments")
      await setAppointments(ctx, defaultEnabledAppointments())
      return { ok: true }
    },
  })

  const removeUnavailable = createTool({
    id: "removeUnavailableBlocks",
    description: "Remove non-catalog sections (about, process, work, reviews, pricing, faq, contact). Never removes hero, services, cta, or appointments. Do not invent replacements of those families.",
    inputSchema: z.object({}),
    execute: async () => removeUnavailableBlocks(ctx, pageSlug),
  })

  const requestRegenerate = createTool({
    id: "requestRegenerate",
    description: "Ask the application to regenerate the homepage from the stored brief. Only when the user explicitly wants a new first site, not for copy or theme tweaks.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!input.allowRegenerate) {
        throw new Error("Regenerate is not available in the CMS editor. Change theme, copy or variants instead.")
      }
      return { regenerate: true }
    },
  })

  return {
    getSiteContext,
    setTheme: setThemeTool,
    setBlock,
    replaceSection: replaceSectionTool,
    setChrome: setChromeTool,
    setSeo: setSeoTool,
    setHours: setHoursTool,
    setContact: setContactTool,
    setAppointments: setAppointmentsTool,
    removeUnavailableBlocks: removeUnavailable,
    ...(input.allowRegenerate ? { requestRegenerate } : {}),
  }
}

const SITE_EDITOR_INSTRUCTIONS = [
  "Je bent de site-editor voor Site in a Box. Je past alleen de preview-site aan via tools — de site is niet live.",
  sitegenCatalogDigest(),
  "Antwoord in het Nederlands. Geen markdown, geen sterretjes, geen **vet**. Schrijf specifieke, scanbare teksten voor een bezoeker. Verzin geen reviews, prijzen, KVK, klanten, statistieken of media-IDs.",
  "FAQ, over-ons, portfolio, reviews en prijzenblokken bestaan niet als eigen blok. Zeg dat eerlijk en werk het verzoek uit in hero, diensten of CTA.",
  "Blokken met live:false zijn oude families die niet in de catalogus zitten. Roep removeUnavailableBlocks aan als die aanwezig zijn. Verzin geen about, FAQ of contactblok als vervanging.",
  "Diensten: items zijn echte dienstnamen (tuinaanleg, onderhoud), geen zinsbrokken. Herschrijf rommelige services.items met setBlock.",
  "Thema: gebruik alleen de aangeleverde scheme IDs. Groen → emerald-calm, blauw → blue-professional, rood → red-confident, donker → appearanceMode dark.",
  "Roep tools aan voor echte wijzigingen. getSiteContext na een write als je verder moet puzzelen. Geen React, HTML of CSS.",
  "Na tools: één korte bevestiging van wat er nu in de preview staat.",
].join(" ")

const createEditorAgent = (input: SiteEditorTurnInput) => {
  const effort = defaultMastraMaintainReasoningEffort()
  const providerOptions = mastraOpenAIProviderOptions(effort)
  return {
    providerOptions,
    agent: new Agent({
      id: "siab-site-editor",
      name: "Site in a Box site editor",
      instructions: {
        role: "system",
        content: SITE_EDITOR_INSTRUCTIONS,
        providerOptions,
      },
      model: defaultMastraModelId(),
      tools: createSiteEditorTools(input),
    }),
  }
}

const editorPrompt = (input: SiteEditorTurnInput, snapshot: SiteEditorSnapshot): string => {
  const history = (input.recentMessages ?? []).slice(-8)
    .map((entry) => `${entry.role}: ${entry.text}`)
    .join("\n")
  return [
    history,
    input.message,
    `Geselecteerd blokindex: ${input.selectedBlockIndex ?? "geen"}.`,
    `Huidige site JSON: ${JSON.stringify(modelContextFromSnapshot(snapshot, input.selectedBlockIndex ?? null))}`,
  ].filter(Boolean).join("\n\n")
}

const resultFromGenerated = async (
  generated: { text?: unknown; toolResults?: unknown; steps?: Array<{ toolResults?: unknown }> },
  snapshotBefore: SiteEditorSnapshot,
  ctx: AgentWriteContext,
  pageSlug: string,
): Promise<SiteEditorTurnResult> => {
  const toolResults = [
    ...(Array.isArray(generated.toolResults) ? generated.toolResults : []),
    ...(Array.isArray(generated.steps)
      ? generated.steps.flatMap((step) => Array.isArray(step.toolResults) ? step.toolResults : [])
      : []),
  ]
  const { applied: wrote, regenerate } = summarizeEditorToolResults(toolResults)
  const pruned = await pruneUnavailableBlocksIfPresent(ctx, pageSlug)
  const applied = wrote || pruned.removed > 0
  const snapshot = applied ? await loadSiteSnapshot(ctx, pageSlug) : snapshotBefore
  const text = typeof generated.text === "string" && generated.text.trim().length >= 8
    ? generated.text.trim()
    : applied
      ? "Ik heb de preview aangepast."
      : "Ik heb niets gewijzigd. Zeg wat er anders moet aan thema, teksten of catalogusvariant."
  return { text, applied, regenerate, snapshot }
}

const iterateTextStream = async function* (stream: AsyncIterable<string>): AsyncGenerator<string> {
  for await (const chunk of stream) {
    if (chunk) yield chunk
  }
}

export async function runSiteEditorAgent(input: SiteEditorTurnInput): Promise<SiteEditorTurnResult> {
  const pageSlug = input.pageSlug.trim() || "index"
  const snapshotBefore = await loadSiteSnapshot(input.ctx, pageSlug)
  const { agent, providerOptions } = createEditorAgent(input)
  const generated = await agent.generate(editorPrompt(input, snapshotBefore), {
    toolChoice: "auto",
    providerOptions,
  })
  return resultFromGenerated(generated, snapshotBefore, input.ctx, pageSlug)
}

export async function* streamSiteEditorAgent(input: SiteEditorTurnInput): AsyncGenerator<SiteEditorStreamEvent> {
  const pageSlug = input.pageSlug.trim() || "index"
  const snapshotBefore = await loadSiteSnapshot(input.ctx, pageSlug)
  const { agent, providerOptions } = createEditorAgent(input)
  const streamed = await agent.stream(editorPrompt(input, snapshotBefore), {
    toolChoice: "auto",
    providerOptions,
  })
  for await (const chunk of iterateTextStream(streamed.textStream)) {
    yield { type: "delta", text: chunk }
  }
  const generated = await streamed.getFullOutput()
  yield { type: "done", result: await resultFromGenerated(generated, snapshotBefore, input.ctx, pageSlug) }
}

const regexExistingSiteTurn = async (input: SiteEditorTurnInput): Promise<SiteEditorTurnResult> => {
  const plan = await planBuilderTurn({
    message: input.message,
    previous: input.facts,
    recentMessages: input.recentMessages,
    hasExistingSite: true,
  })
  if (plan.decision === "refuse" || plan.decision === "ask") {
    const snapshot = await loadSiteSnapshot(input.ctx, input.pageSlug.trim() || "index")
    return { text: plan.reply, applied: false, regenerate: false, snapshot }
  }
  const fallback = await applyMaintainerTurn({
    payload: input.ctx.payload,
    tenantId: input.ctx.tenantId,
    message: input.message,
    facts: plan.facts,
    pageSlug: input.pageSlug,
    selectedBlockIndex: input.selectedBlockIndex,
    role: input.role,
    user: input.ctx.user,
    intent: maintainerIntentFromPlan(plan, input.message),
  })
  const snapshot = await loadSiteSnapshot(input.ctx, input.pageSlug.trim() || "index")
  return {
    text: fallback.applied || fallback.regenerate ? fallback.text : plan.reply,
    applied: fallback.applied,
    regenerate: fallback.regenerate,
    snapshot,
  }
}

const mastraFallbackTurn = async (input: SiteEditorTurnInput): Promise<SiteEditorTurnResult> => {
  const fallback = await applyMaintainerTurn({
    payload: input.ctx.payload,
    tenantId: input.ctx.tenantId,
    message: input.message,
    facts: input.facts,
    pageSlug: input.pageSlug,
    selectedBlockIndex: input.selectedBlockIndex,
    role: input.role,
    user: input.ctx.user,
    intent: interpretMaintainerIntent(input.message),
  })
  const snapshot = await loadSiteSnapshot(input.ctx, input.pageSlug.trim() || "index")
  return { text: fallback.text, applied: fallback.applied, regenerate: fallback.regenerate, snapshot }
}

export async function runExistingSiteTurn(input: SiteEditorTurnInput & {
  useMastra: boolean
}): Promise<SiteEditorTurnResult> {
  if (input.useMastra) {
    try {
      return await runSiteEditorAgent(input)
    } catch {
      return mastraFallbackTurn(input)
    }
  }
  return regexExistingSiteTurn(input)
}

export async function* streamExistingSiteTurn(input: SiteEditorTurnInput & {
  useMastra: boolean
}): AsyncGenerator<SiteEditorStreamEvent> {
  if (input.useMastra) {
    try {
      yield* streamSiteEditorAgent(input)
      return
    } catch {
      yield { type: "done", result: await mastraFallbackTurn(input) }
      return
    }
  }
  yield { type: "done", result: await regexExistingSiteTurn(input) }
}
