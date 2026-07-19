import { z } from "zod"
import type { FieldNamesMarkedBoolean } from "react-hook-form"
import type { ElementPath } from "@/components/editor/elementPath"
import {
  remapSelectionAfterDelete,
  remapSelectionAfterInsert,
  remapSelectionAfterReorder,
} from "@/components/editor/elementPath"
import type { SiteChromeSelection } from "@/components/editor/sidebar/SiteChromeRow"
import { EditorBlockSchema, editorPageSeoSchema, type EditorBlock } from "@/lib/editor/editorBlock"
import { ensureEditorBlocks } from "@/lib/editor/ensureItemIds"
import type { EditorBlockSeed } from "@/lib/editor/pageEditorCommands"
import {
  appendEditorBlock,
  cloneEditorBlockAt,
  insertEditorBlock,
  removeEditorBlock,
  reorderEditorBlocks,
} from "@/lib/editor/pageEditorCommands"
import type { PageEditorDraft } from "@/lib/editor/pageDraftStore"
import type { FooterCompositionContract } from "@/lib/footerComposition"
import { chromeComparable, chromeDraftFromSettings, type SiteChromeDraft } from "@/lib/siteChromeDraft"
import type { ThemeTokens } from "@/lib/theme/schema"
import { normalizeThemeForSave } from "@/lib/theme/normalizeTheme"
import { countLeafDirty } from "@/lib/countLeafDirty"
import type { Page } from "@/payload-types"

export const createPageEditorSchema = (t: (key: string) => string) =>
  z.object({
    title: z.string().min(1, t("titleRequired")),
    slug: z.string().regex(/^[a-z0-9-]+$/, t("slugValidation")),
    status: z.enum(["draft", "published"], {
      message: t("statusValidation"),
    }),
    blocks: z.array(EditorBlockSchema),
    seo: editorPageSeoSchema,
  })

export type PageEditorFormValues = z.infer<ReturnType<typeof createPageEditorSchema>>

export const pageEditorDefaultValues = (initial?: Page): PageEditorFormValues =>
  initial
    ? {
        title: initial.title,
        slug: initial.slug ?? "",
        status: "published",
        blocks: ensureEditorBlocks((initial.blocks ?? []) as EditorBlock[]),
        seo: initial.seo ?? {},
      }
    : { title: "", slug: "", status: "published", blocks: [], seo: {} }

export const buildPageDraftKey = (
  tenantId: number | string,
  initial: Page | undefined,
  baseHref: string,
): string =>
  ["page", String(tenantId), initial ? String(initial.id) : "new", baseHref]
    .map(encodeURIComponent)
    .join(":")

export const isPageDraftStaleAgainstServer = (
  draft: PageEditorDraft,
  baselineUpdatedAt: string | null,
): boolean => {
  const serverUpdatedAt = baselineUpdatedAt ? Date.parse(baselineUpdatedAt) : 0
  return serverUpdatedAt > 0 && draft.savedAt <= serverUpdatedAt
}

export const deriveThemeDirty = (
  themeState: ThemeTokens | null,
  themeBaseline: ThemeTokens | null,
): boolean => JSON.stringify(themeState) !== JSON.stringify(themeBaseline)

export const deriveChromeDirty = (
  chromeDraft: SiteChromeDraft,
  chromeBaseline: SiteChromeDraft,
  footerContract: FooterCompositionContract | null,
): boolean =>
  JSON.stringify(chromeComparable(chromeDraft, footerContract)) !==
  JSON.stringify(chromeComparable(chromeBaseline, footerContract))

export const deriveNavDirty = (
  inHeader: boolean,
  inFooter: boolean,
  savedInHeader: boolean,
  savedInFooter: boolean,
  hasInitialPage: boolean,
): boolean => hasInitialPage && (inHeader !== savedInHeader || inFooter !== savedInFooter)

export type PageEditorDirtyInputs = {
  readOnly: boolean
  formDirty: boolean
  themeDirty: boolean
  navDirty: boolean
  chromeDirty: boolean
  dirtyFields: FieldNamesMarkedBoolean<PageEditorFormValues>
}

export const aggregatePageEditorDirty = (inputs: PageEditorDirtyInputs): boolean =>
  !inputs.readOnly &&
  (inputs.formDirty || inputs.themeDirty || inputs.navDirty || inputs.chromeDirty)

export const countPageEditorDirtyLeaves = (inputs: PageEditorDirtyInputs): number => {
  if (inputs.readOnly) return 0
  return (
    countLeafDirty(inputs.dirtyFields) +
    (inputs.themeDirty ? 1 : 0) +
    (inputs.navDirty ? 1 : 0) +
    (inputs.chromeDirty ? 1 : 0)
  )
}

export const pageEditorHasRecoverableDraftWork = (
  formDirty: boolean,
  themeDirty: boolean,
  navDirty: boolean,
  chromeDirty: boolean,
): boolean => formDirty || themeDirty || navDirty || chromeDirty

export const mergeRestoredChromeDraft = (
  siteSettings: unknown,
  footerContract: FooterCompositionContract | null,
  chromePartial: unknown,
): SiteChromeDraft => {
  const baseline = chromeDraftFromSettings(siteSettings, footerContract)
  const partial = chromePartial as Partial<SiteChromeDraft> | null | undefined
  if (!partial) return baseline
  return {
    ...baseline,
    ...partial,
    header: { ...baseline.header, ...partial.header },
    footer: { ...baseline.footer, ...partial.footer },
  }
}

export const normalizeWatchedBlocks = (blocks: EditorBlock[]): EditorBlock[] | null => {
  const normalized = ensureEditorBlocks(blocks)
  return JSON.stringify(normalized) !== JSON.stringify(blocks) ? normalized : null
}

export type BlockCommandResult = {
  blocks: EditorBlock[]
  selection: ElementPath | null
}

export const editorReorderBlocks = (
  blocks: EditorBlock[],
  selection: ElementPath | null,
  from: number,
  to: number,
): BlockCommandResult => ({
  blocks: reorderEditorBlocks(blocks, from, to),
  selection: remapSelectionAfterReorder(selection, from, to),
})

export const editorRemoveBlock = (
  blocks: EditorBlock[],
  selection: ElementPath | null,
  index: number,
): BlockCommandResult => ({
  blocks: removeEditorBlock(blocks, index),
  selection: remapSelectionAfterDelete(selection, index),
})

export const editorCloneBlockAt = (
  blocks: EditorBlock[],
  selection: ElementPath | null,
  index: number,
): BlockCommandResult | null => {
  const result = cloneEditorBlockAt(blocks, index)
  if (!result) return null
  return {
    blocks: result.blocks,
    selection: remapSelectionAfterInsert(selection, result.insertedIndex),
  }
}

export const editorInsertBlockAt = (
  blocks: EditorBlock[],
  index: number,
  seed: EditorBlockSeed,
): BlockCommandResult => ({
  blocks: insertEditorBlock(blocks, index, seed),
  selection: { blockIndex: index, field: "" },
})

export const editorAppendBlock = (
  blocks: EditorBlock[],
  seed: EditorBlockSeed,
): BlockCommandResult => {
  const next = appendEditorBlock(blocks, seed)
  return {
    blocks: next,
    selection: { blockIndex: next.length - 1, field: "" },
  }
}

export const selectElementPath = (
  readOnly: boolean,
  current: ElementPath | null,
  next: ElementPath | null | ((previous: ElementPath | null) => ElementPath | null),
): { selection: ElementPath | null; chromeSelection: SiteChromeSelection | null } | null => {
  if (readOnly) return null
  const resolved = typeof next === "function" ? next(current) : next
  return { selection: resolved, chromeSelection: null }
}

export const selectChromeZone = (
  readOnly: boolean,
  zone: SiteChromeSelection,
): { selection: ElementPath | null; chromeSelection: SiteChromeSelection } | null => {
  if (readOnly) return null
  return { selection: null, chromeSelection: zone }
}

export const clearEditorSelection = (): {
  selection: ElementPath | null
  chromeSelection: SiteChromeSelection | null
} => ({
  selection: null,
  chromeSelection: null,
})

export const seedThemeState = (
  theme: ThemeTokens | null | undefined,
  cachedTheme: ThemeTokens | null | undefined,
): ThemeTokens | null => normalizeThemeForSave(theme ?? cachedTheme ?? null)
