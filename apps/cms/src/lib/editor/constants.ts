/**
 * Cumulative height of the sticky chrome above the canvas:
 *   SiteHeader (h-16) + PageMeta header (~py-3 + content) ≈ 120px = 7.5rem.
 * Used by the editor theme toolbar's sticky top and the sidebar <aside>'s top/height/maxHeight.
 */
export const CHROME_STACK_HEIGHT = "7.5rem"

/**
 * Page editor breakpoint. Tablets and cramped browser widths use the mobile
 * editor; the desktop canvas/sidebar editor starts at the smallest practical
 * laptop width.
 */
export const EDITOR_DESKTOP_BREAKPOINT = 1280

export { FLOATING_PILL_CLASS } from "@/components/editor/floating-pill"
