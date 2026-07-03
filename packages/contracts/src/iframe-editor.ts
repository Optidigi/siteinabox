import { z } from "zod"
import type { Block, MediaRef, Page, SiteSettings } from "./site"
import type { ThemeTokenSpec } from "./generation"
import { BlockSchema, MediaRefSchema, PageSchema, SiteSettingsSchema, ThemeTokenSpecSchema } from "./runtime"

export const IFRAME_EDITOR_PROTOCOL_VERSION = 1
export const IFRAME_EDITOR_PROTOCOL_NAME = "siab.iframe-editor"

export const IFRAME_EDITOR_MESSAGE_TYPES = [
  "renderer.ready",
  "renderer.ack",
  "renderer.reject",
  "page.replace",
  "theme.patch",
  "block.patch",
  "blocks.reorder",
  "blocks.insert",
  "blocks.delete",
  "selection.set",
  "selection.changed",
  "selection.scrollIntoView",
  "selection.pulsed",
  "geometry.changed",
  "field.input",
  "field.commit",
  "field.focus",
  "field.blur",
  "viewport.resize",
  "asset.pickRequested",
  "asset.picked",
  "asset.cancelled",
  "edit.start",
  "edit.cancel",
  "chrome.select",
  "chrome.patchRequested",
  "editor.view.set",
  "navigation.requested",
  "error",
] as const

export type IframeEditorMessageType = (typeof IFRAME_EDITOR_MESSAGE_TYPES)[number]
export type IframeEditorProtocolVersion = typeof IFRAME_EDITOR_PROTOCOL_VERSION
export type IframeEditorRevision = number
export type IframeEditorJson =
  | null
  | string
  | number
  | boolean
  | IframeEditorJson[]
  | { [key: string]: IframeEditorJson }

export type IframeEditorFieldPath = readonly [string, ...string[]]

export type IframeEditorMessageBase<TType extends IframeEditorMessageType> = {
  protocol: typeof IFRAME_EDITOR_PROTOCOL_NAME
  schemaVersion: IframeEditorProtocolVersion
  type: TType
  messageId: string
  sentAt?: string
}

export type IframeEditorRevisionedMessageBase<TType extends IframeEditorMessageType> =
  IframeEditorMessageBase<TType> & {
    expectedRevision: IframeEditorRevision
  }

export type RendererReadyMessage = IframeEditorMessageBase<"renderer.ready"> & {
  rendererId: string
  revision: IframeEditorRevision
  pageId?: string
  capabilities?: {
    selection?: boolean
    fieldEditing?: boolean
    assetPicking?: boolean
    viewportResize?: boolean
  }
}

export type RendererAckMessage = IframeEditorMessageBase<"renderer.ack"> & {
  acknowledgedMessageId: string
  revision: IframeEditorRevision
  pageId?: string
}

export type RendererRejectMessage = IframeEditorMessageBase<"renderer.reject"> & {
  rejectedMessageId: string
  code: string
  message: string
  revision?: IframeEditorRevision
  recoverable?: boolean
  details?: Record<string, IframeEditorJson>
}

export type PageReplaceMessage = IframeEditorRevisionedMessageBase<"page.replace"> & {
  pageId: string
  page: Page
  settings?: SiteSettings
  theme?: ThemeTokenSpec | null
}

export type ThemePatchMessage = IframeEditorRevisionedMessageBase<"theme.patch"> & {
  theme: ThemeTokenSpec | null
}

export type BlockPatchMessage = IframeEditorRevisionedMessageBase<"block.patch"> & {
  pageId: string
  blockId: string
  patch: Record<string, IframeEditorJson>
}

export type BlocksReorderMessage = IframeEditorRevisionedMessageBase<"blocks.reorder"> & {
  pageId: string
  blockIds: string[]
}

export type BlocksInsertMessage = IframeEditorRevisionedMessageBase<"blocks.insert"> & {
  pageId: string
  block: Block
  beforeBlockId?: string
  afterBlockId?: string
  index?: number
}

export type BlocksDeleteMessage = IframeEditorRevisionedMessageBase<"blocks.delete"> & {
  pageId: string
  blockId: string
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

export type SelectionScrollIntoViewMessage = IframeEditorMessageBase<"selection.scrollIntoView"> & {
  selection: IframeEditorSelection
  behavior?: "auto" | "smooth"
  block?: "start" | "center" | "end" | "nearest"
}

export type SelectionPulsedMessage = IframeEditorMessageBase<"selection.pulsed"> & {
  selection: IframeEditorSelection
  pulseId?: string
  durationMs?: number
}

export type IframeEditorRect = {
  x: number
  y: number
  width: number
  height: number
}

export type IframeEditorFieldGeometry = {
  fieldPath: IframeEditorFieldPath
  rect: IframeEditorRect
}

export type IframeEditorBlockGeometry = {
  blockId: string
  rect: IframeEditorRect
  fields?: IframeEditorFieldGeometry[]
}

export type GeometryChangedMessage = IframeEditorMessageBase<"geometry.changed"> & {
  pageId: string
  revision: IframeEditorRevision
  viewport: {
    width: number
    height: number
    scrollX?: number
    scrollY?: number
  }
  blocks: IframeEditorBlockGeometry[]
}

export type FieldInputMessage = IframeEditorRevisionedMessageBase<"field.input"> & {
  pageId: string
  blockId: string
  fieldPath: IframeEditorFieldPath
  value: IframeEditorJson
}

export type FieldCommitMessage = IframeEditorRevisionedMessageBase<"field.commit"> & {
  pageId: string
  blockId: string
  fieldPath: IframeEditorFieldPath
  value: IframeEditorJson
}

export type FieldFocusMessage = IframeEditorMessageBase<"field.focus"> & {
  pageId: string
  blockId: string
  fieldPath: IframeEditorFieldPath
}

export type FieldBlurMessage = IframeEditorMessageBase<"field.blur"> & {
  pageId: string
  blockId: string
  fieldPath: IframeEditorFieldPath
}

export type ViewportResizeMessage = IframeEditorMessageBase<"viewport.resize"> & {
  width: number
  height: number
  deviceScaleFactor?: number
}

export type AssetPickRequestedMessage = IframeEditorMessageBase<"asset.pickRequested"> & {
  requestId: string
  pageId?: string
  blockId?: string
  fieldPath?: IframeEditorFieldPath
  acceptedTypes?: string[]
}

export type AssetPickedMessage = IframeEditorRevisionedMessageBase<"asset.picked"> & {
  requestId: string
  pageId: string
  blockId: string
  fieldPath: IframeEditorFieldPath
  asset: Exclude<MediaRef, null>
}

export type AssetCancelledMessage = IframeEditorMessageBase<"asset.cancelled"> & {
  requestId: string
  reason?: "user" | "unsupported" | "error"
  message?: string
}

export type EditStartMessage = IframeEditorRevisionedMessageBase<"edit.start"> & {
  pageId: string
  blockId: string
  fieldPath: IframeEditorFieldPath
  mode?: "text" | "richText" | "image" | "link" | "settings"
}

export type EditCancelMessage = IframeEditorRevisionedMessageBase<"edit.cancel"> & {
  pageId: string
  blockId: string
  fieldPath: IframeEditorFieldPath
  reason?: "escape" | "blur" | "selectionChanged" | "editor"
}

export type ChromeSelectMessage = IframeEditorMessageBase<"chrome.select"> & {
  selection: IframeEditorSelection
}

export type EditorViewSetMessage = IframeEditorMessageBase<"editor.view.set"> & {
  view: "canvas" | "sidebar"
}

export type ChromePatchRequestedMessage = IframeEditorRevisionedMessageBase<"chrome.patchRequested"> & {
  pageId: string
  blockId: string
  patch: Record<string, IframeEditorJson>
}

export type NavigationRequestedMessage = IframeEditorMessageBase<"navigation.requested"> & {
  pageId?: string
  href?: string
  reason?: "linkClick" | "formSubmit" | "programmatic"
}

export type IframeEditorErrorMessage = IframeEditorMessageBase<"error"> & {
  code: string
  message: string
  source?: "editor" | "renderer"
  recoverable?: boolean
  details?: Record<string, IframeEditorJson>
}

export type IframeEditorMessage =
  | RendererReadyMessage
  | RendererAckMessage
  | RendererRejectMessage
  | PageReplaceMessage
  | ThemePatchMessage
  | BlockPatchMessage
  | BlocksReorderMessage
  | BlocksInsertMessage
  | BlocksDeleteMessage
  | SelectionSetMessage
  | SelectionChangedMessage
  | SelectionScrollIntoViewMessage
  | SelectionPulsedMessage
  | GeometryChangedMessage
  | FieldInputMessage
  | FieldCommitMessage
  | FieldFocusMessage
  | FieldBlurMessage
  | ViewportResizeMessage
  | AssetPickRequestedMessage
  | AssetPickedMessage
  | AssetCancelledMessage
  | EditStartMessage
  | EditCancelMessage
  | ChromeSelectMessage
  | ChromePatchRequestedMessage
  | EditorViewSetMessage
  | NavigationRequestedMessage
  | IframeEditorErrorMessage

export type IframeEditorMessageValidationIssue = {
  path: Array<string | number>
  message: string
}

export type IframeEditorMessageValidationResult =
  | { ok: true; message: IframeEditorMessage }
  | { ok: false; issues: IframeEditorMessageValidationIssue[] }

const FORBIDDEN_IFRAME_PAYLOAD_KEYS = [
  "className",
  "classes",
  "dangerouslySetInnerHTML",
  "rawHtml",
  "html",
  "component",
  "jsx",
  "tsx",
  "script",
  "sourceCode",
  "filePath",
] as const

const FORBIDDEN_IFRAME_PAYLOAD_KEY_SET = new Set<string>(FORBIDDEN_IFRAME_PAYLOAD_KEYS)

const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict()
const idSchema = z.string().trim().min(1)
const revisionSchema = z.number().int().nonnegative()
const fieldPathSchema = z.array(idSchema).min(1) as unknown as z.ZodType<IframeEditorFieldPath>

const iframeEditorJsonSchema: z.ZodType<IframeEditorJson> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.array(iframeEditorJsonSchema),
    z.record(z.string(), iframeEditorJsonSchema).superRefine((value, ctx) => {
      addForbiddenIframePayloadIssues(value, ctx)
    }),
  ]),
)

const iframeEditorJsonRecordSchema = z
  .record(z.string(), iframeEditorJsonSchema)
  .refine((value) => Object.keys(value).length > 0, { message: "Patch payload must not be empty" })
  .superRefine((value, ctx) => {
    addForbiddenIframePayloadIssues(value, ctx)
  })

const baseMessageShape = {
  protocol: z.literal(IFRAME_EDITOR_PROTOCOL_NAME),
  schemaVersion: z.literal(IFRAME_EDITOR_PROTOCOL_VERSION),
  messageId: idSchema,
  sentAt: z.string().optional(),
}

const revisionedMessageShape = {
  ...baseMessageShape,
  expectedRevision: revisionSchema,
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
  revision: revisionSchema,
  pageId: idSchema.optional(),
  capabilities: strictObject({
    selection: z.boolean().optional(),
    fieldEditing: z.boolean().optional(),
    assetPicking: z.boolean().optional(),
    viewportResize: z.boolean().optional(),
  }).optional(),
})

export const RendererAckMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("renderer.ack"),
  acknowledgedMessageId: idSchema,
  revision: revisionSchema,
  pageId: idSchema.optional(),
})

export const RendererRejectMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("renderer.reject"),
  rejectedMessageId: idSchema,
  code: idSchema,
  message: z.string().min(1),
  revision: revisionSchema.optional(),
  recoverable: z.boolean().optional(),
  details: iframeEditorJsonRecordSchema.optional(),
})

export const PageReplaceMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("page.replace"),
  pageId: idSchema,
  page: PageSchema,
  settings: SiteSettingsSchema.optional(),
  theme: ThemeTokenSpecSchema.nullable().optional(),
})

export const ThemePatchMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("theme.patch"),
  theme: ThemeTokenSpecSchema.nullable(),
})

export const BlockPatchMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("block.patch"),
  pageId: idSchema,
  blockId: idSchema,
  patch: iframeEditorJsonRecordSchema,
})

export const BlocksReorderMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("blocks.reorder"),
  pageId: idSchema,
  blockIds: z.array(idSchema).min(1).refine((ids) => new Set(ids).size === ids.length, {
    message: "Block ids must be unique",
  }),
})

export const BlocksInsertMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("blocks.insert"),
  pageId: idSchema,
  block: BlockSchema,
  beforeBlockId: idSchema.optional(),
  afterBlockId: idSchema.optional(),
  index: z.number().int().nonnegative().optional(),
}).refine(
  (message) => [message.beforeBlockId, message.afterBlockId, message.index].filter((value) => value != null).length <= 1,
  { message: "Only one insert position may be provided" },
)

export const BlocksDeleteMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("blocks.delete"),
  pageId: idSchema,
  blockId: idSchema,
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

export const SelectionScrollIntoViewMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("selection.scrollIntoView"),
  selection: selectionSchema,
  behavior: z.enum(["auto", "smooth"]).optional(),
  block: z.enum(["start", "center", "end", "nearest"]).optional(),
})

export const SelectionPulsedMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("selection.pulsed"),
  selection: selectionSchema,
  pulseId: idSchema.optional(),
  durationMs: z.number().int().positive().optional(),
})

export const ChromeSelectMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("chrome.select"),
  selection: selectionSchema,
})

export const EditorViewSetMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("editor.view.set"),
  view: z.enum(["canvas", "sidebar"]),
})

const iframeEditorRectSchema = strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
})

export const GeometryChangedMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("geometry.changed"),
  pageId: idSchema,
  revision: revisionSchema,
  viewport: strictObject({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    scrollX: z.number().optional(),
    scrollY: z.number().optional(),
  }),
  blocks: z.array(strictObject({
    blockId: idSchema,
    rect: iframeEditorRectSchema,
    fields: z.array(strictObject({
      fieldPath: fieldPathSchema,
      rect: iframeEditorRectSchema,
    })).optional(),
  })),
})

export const FieldInputMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("field.input"),
  pageId: idSchema,
  blockId: idSchema,
  fieldPath: fieldPathSchema,
  value: iframeEditorJsonSchema,
})

export const FieldCommitMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("field.commit"),
  pageId: idSchema,
  blockId: idSchema,
  fieldPath: fieldPathSchema,
  value: iframeEditorJsonSchema,
})

export const FieldFocusMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("field.focus"),
  pageId: idSchema,
  blockId: idSchema,
  fieldPath: fieldPathSchema,
})

export const FieldBlurMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("field.blur"),
  pageId: idSchema,
  blockId: idSchema,
  fieldPath: fieldPathSchema,
})

export const ViewportResizeMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("viewport.resize"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  deviceScaleFactor: z.number().positive().optional(),
})

export const AssetPickRequestedMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("asset.pickRequested"),
  requestId: idSchema,
  pageId: idSchema.optional(),
  blockId: idSchema.optional(),
  fieldPath: fieldPathSchema.optional(),
  acceptedTypes: z.array(z.string().trim().min(1)).min(1).optional(),
})

export const AssetPickedMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("asset.picked"),
  requestId: idSchema,
  pageId: idSchema,
  blockId: idSchema,
  fieldPath: fieldPathSchema,
  asset: MediaRefSchema.refine((value) => value !== null, {
    message: "Picked asset must not be null",
  }) as z.ZodType<Exclude<MediaRef, null>>,
})

export const AssetCancelledMessageSchema = strictObject({
  ...baseMessageShape,
  type: z.literal("asset.cancelled"),
  requestId: idSchema,
  reason: z.enum(["user", "unsupported", "error"]).optional(),
  message: z.string().min(1).optional(),
})

export const EditStartMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("edit.start"),
  pageId: idSchema,
  blockId: idSchema,
  fieldPath: fieldPathSchema,
  mode: z.enum(["text", "richText", "image", "link", "settings"]).optional(),
})

export const EditCancelMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("edit.cancel"),
  pageId: idSchema,
  blockId: idSchema,
  fieldPath: fieldPathSchema,
  reason: z.enum(["escape", "blur", "selectionChanged", "editor"]).optional(),
})

export const ChromePatchRequestedMessageSchema = strictObject({
  ...revisionedMessageShape,
  type: z.literal("chrome.patchRequested"),
  pageId: idSchema,
  blockId: idSchema,
  patch: iframeEditorJsonRecordSchema,
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
  source: z.enum(["editor", "renderer"]).optional(),
  recoverable: z.boolean().optional(),
  details: iframeEditorJsonRecordSchema.optional(),
})

export const IframeEditorMessageSchema: z.ZodType<IframeEditorMessage> = z.discriminatedUnion("type", [
  RendererReadyMessageSchema,
  RendererAckMessageSchema,
  RendererRejectMessageSchema,
  PageReplaceMessageSchema,
  ThemePatchMessageSchema,
  BlockPatchMessageSchema,
  BlocksReorderMessageSchema,
  BlocksInsertMessageSchema,
  BlocksDeleteMessageSchema,
  SelectionSetMessageSchema,
  SelectionChangedMessageSchema,
  SelectionScrollIntoViewMessageSchema,
  SelectionPulsedMessageSchema,
  ChromeSelectMessageSchema,
  ChromePatchRequestedMessageSchema,
  EditorViewSetMessageSchema,
  GeometryChangedMessageSchema,
  FieldInputMessageSchema,
  FieldCommitMessageSchema,
  FieldFocusMessageSchema,
  FieldBlurMessageSchema,
  ViewportResizeMessageSchema,
  AssetPickRequestedMessageSchema,
  AssetPickedMessageSchema,
  AssetCancelledMessageSchema,
  EditStartMessageSchema,
  EditCancelMessageSchema,
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

  // Theme preview must not participate in the revision stream — page.replace
  // can race ahead while the user edits, which would drop palette/font/shape
  // updates if theme.patch shared the same revision gate.
  if (parsed.data.type === "theme.patch") {
    return { ok: true, message: parsed.data }
  }

  if (
    options.currentRevision != null &&
    "expectedRevision" in parsed.data &&
    parsed.data.expectedRevision !== options.currentRevision
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

function addForbiddenIframePayloadIssues(
  value: Record<string, IframeEditorJson>,
  ctx: z.RefinementCtx,
  path: Array<string | number> = [],
): void {
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = [...path, key]
    if (FORBIDDEN_IFRAME_PAYLOAD_KEY_SET.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: entryPath,
        message: `Iframe editor messages must not include ${key}`,
      })
    }

    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      addForbiddenIframePayloadIssues(entry as Record<string, IframeEditorJson>, ctx, entryPath)
    }
  }
}
