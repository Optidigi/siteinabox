/**
 * Single source of truth for "is the canvas currently in a click-to-select
 * (rather than click-to-edit) view?" — consumed by every inline primitive
 * and by the iframe frame canvas (`FrameCanvasSurface` / `CanvasSurface`) gap-button
 * / empty-state gates.
 *
 * Negated form (`view !== "canvas"`) intentionally defaults any future view
 * variants to read-only — the safer gate for select-only paths.
 */
export type CanvasView = "canvas" | "sidebar" | "mobile" | "preview"

export function isReadOnlyView(view: CanvasView): boolean {
  return view !== "canvas"
}

export function isCustomerPreviewView(view: CanvasView): boolean {
  return view === "preview"
}
