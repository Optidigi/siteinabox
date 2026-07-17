import { z } from "zod"
import type { Page, SiteSettings } from "./site"
import type { ThemeTokenSpec } from "./generation"
import { PageSchema, SiteSettingsSchema, ThemeTokenSpecSchema } from "./runtime"

export const IFRAME_EDITOR_PROTOCOL_VERSION = 2
export const IFRAME_EDITOR_PROTOCOL_NAME = "siab.iframe-editor"

export const IFRAME_EDITOR_MESSAGE_TYPES = [
  "renderer.ready",
  "page.replace",
  "theme.patch",
  "selection.set",
  "selection.changed",
  "chrome.select",
  "editor.mobileMode.set",
  "navigation.requested",
  "error",
] as const

export type IframeEditorMessageType = (typeof IFRAME_EDITOR_MESSAGE_TYPES)[number]
export type IframeEditorProtocolVersion = typeof IFRAME_EDITOR_PROTOCOL_VERSION
export type IframeEditorRevision = number
export type IframeEditorFieldPath = readonly [string, ...string[]]

export type IframeEditorMessageBase<TType extends IframeEditorMessageType> = {
  protocol: typeof IFRAME_EDITOR_PROTOCOL_NAME
  schemaVersion: IframeEditorProtocolVersion
  type: TType
  messageId: string
}

export type RendererReadyMessage = IframeEditorMessageBase<"renderer.ready"> & {
  rendererId: string
  pageId?: string
}

export type PageReplaceMessage = IframeEditorMessageBase<"page.replace"> & {
  expectedRevision: IframeEditorRevision
  pageId: string
  page: Page
  settings?: SiteSettings
  theme?: ThemeTokenSpec | null
}

export type ThemePatchMessage = IframeEditorMessageBase<"theme.patch"> & {
  theme: ThemeTokenSpec | null
}

export type IframeEditorSelection = {
  pageId?: string
  blockId?: string
  fieldPath?: IframeEditorFieldPath
}

export type SelectionSetMessage = IframeEditorMessageBase<"selection.set"> & {
  selection: IframeEditorSelection | null
}

export type SelectionChangedMessage = IframeEditorMessageBase<"selection.changed"> & {
  selection: IframeEditorSelection | null
}

export type ChromeSelectMessage = IframeEditorMessageBase<"chrome.select"> & {
  selection: IframeEditorSelection
}

export type IframeEditorMobileMode = {
  mode: "fullPage" | "focusedSection"
  focusedBlockId?: string
  focusedBlockIndex?: number
  showChrome?: boolean
}

export type EditorMobileModeSetMessage = IframeEditorMessageBase<"editor.mobileMode.set"> & IframeEditorMobileMode

export type NavigationRequestedMessage = IframeEditorMessageBase<"navigation.requested"> & {
  pageId?: string
  href?: string
  reason?: "linkClick" | "formSubmit" | "programmatic"
}

export type IframeEditorErrorMessage = IframeEditorMessageBase<"error"> & {
  code: string
  message: string
}

export type IframeEditorMessage =
  | RendererReadyMessage
  | PageReplaceMessage
  | ThemePatchMessage
  | SelectionSetMessage
  | SelectionChangedMessage
  | ChromeSelectMessage
  | EditorMobileModeSetMessage
  | NavigationRequestedMessage
  | IframeEditorErrorMessage

export type IframeEditorMessageValidationIssue = {
  path: Array<string | number>
  message: string
}

export type IframeEditorMessageValidationResult =
  | { ok: true; message: IframeEditorMessage }
  | { ok: false; issues: IframeEditorMessageValidationIssue[] }

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict()
const idSchema = z.string().trim().min(1)
const revisionSchema = z.number().int().nonnegative()
const fieldPathSchema = z.array(idSchema).min(1) as unknown as z.ZodType<IframeEditorFieldPath>

const baseMessageShape = {
  protocol: z.literal(IFRAME_EDITOR_PROTOCOL_NAME),
  schemaVersion: z.literal(IFRAME_EDITOR_PROTOCOL_VERSION),
  messageId: idSchema,
}

const selectionSchema: z.ZodType<IframeEditorSelection> = strictObject({
  pageId: idSchema.optional(),
  blockId: idSchema.optional(),
  fieldPath: fieldPathSchema.optional(),
}).refine((selection) => selection.pageId != null || selection.blockId != null || selection.fieldPath != null, {
  message: "Selection must identify a page, block, or field",
})

export const RendererReadyMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("renderer.ready"),
  rendererId: idSchema,
  pageId: idSchema.optional(),
})

export const PageReplaceMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("page.replace"),
  expectedRevision: revisionSchema,
  pageId: idSchema,
  page: PageSchema,
  settings: SiteSettingsSchema.optional(),
  theme: ThemeTokenSpecSchema.nullable().optional(),
})

export const ThemePatchMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("theme.patch"),
  theme: ThemeTokenSpecSchema.nullable(),
})

export const SelectionSetMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("selection.set"),
  selection: selectionSchema.nullable(),
})

export const SelectionChangedMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("selection.changed"),
  selection: selectionSchema.nullable(),
})

export const ChromeSelectMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("chrome.select"),
  selection: selectionSchema,
})

const mobileModeShape = {
  mode: z.enum(["fullPage", "focusedSection"]),
  focusedBlockId: idSchema.optional(),
  focusedBlockIndex: z.number().int().nonnegative().optional(),
  showChrome: z.boolean().optional(),
}

export const EditorMobileModeSetMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("editor.mobileMode.set"),
  ...mobileModeShape,
})

export const NavigationRequestedMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("navigation.requested"),
  pageId: idSchema.optional(),
  href: z.string().trim().min(1).optional(),
  reason: z.enum(["linkClick", "formSubmit", "programmatic"]).optional(),
}).refine((message) => message.pageId != null || message.href != null, {
  message: "Navigation request must identify a page or href",
})

export const IframeEditorErrorMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("error"),
  code: idSchema,
  message: z.string().min(1),
})

export const IframeEditorMessageSchema: z.ZodType<IframeEditorMessage> = z.discriminatedUnion("type", [
  RendererReadyMessageSchema,
  PageReplaceMessageSchema,
  ThemePatchMessageSchema,
  SelectionSetMessageSchema,
  SelectionChangedMessageSchema,
  ChromeSelectMessageSchema,
  EditorMobileModeSetMessageSchema,
  NavigationRequestedMessageSchema,
  IframeEditorErrorMessageSchema,
])

export const isIframeEditorProtocolVersion = (value: unknown): value is IframeEditorProtocolVersion =>
  value === IFRAME_EDITOR_PROTOCOL_VERSION

export const isIframeEditorMessage = (value: unknown): value is IframeEditorMessage =>
  IframeEditorMessageSchema.safeParse(value).success

export const validateIframeEditorMessage = (
  value: unknown,
  options: { currentRevision?: IframeEditorRevision } = {},
): IframeEditorMessageValidationResult => {
  const parsed = IframeEditorMessageSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number"),
        message: issue.message,
      })),
    }
  }

  if (
    options.currentRevision != null
    && parsed.data.type === "page.replace"
    && parsed.data.expectedRevision !== options.currentRevision
  ) {
    return {
      ok: false,
      issues: [{
        path: ["expectedRevision"],
        message: `Stale revision ${parsed.data.expectedRevision}; expected ${options.currentRevision}`,
      }],
    }
  }

  return { ok: true, message: parsed.data }
}
