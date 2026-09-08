/** Neobrutalism jacket for operator UI. Landing primitives stay in apps/landing. */

/** Keyboard-only. Mouse click must not leave a stuck ring (selects, buttons). */
export const neoFocus =
  "outline-none focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

/** Drop mouse/pen focus after `click` so :focus-visible does not sit on the control. */
export const blurAfterPointerClick = (event: {
  pointerType: string
  currentTarget: EventTarget | null
}): void => {
  if (event.pointerType !== "mouse" && event.pointerType !== "pen") return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  if (target.getAttribute("aria-haspopup")) return
  if (target.getAttribute("aria-expanded") === "true") return
  if (target.dataset.slot === "select-trigger") return
  if (target.dataset.slot === "dropdown-menu-trigger") return
  window.setTimeout(() => {
    if (document.activeElement === target) target.blur()
  }, 0)
}

const neoPressMotion =
  "transition-[translate,transform,box-shadow,background-color,color] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-boxShadowX active:translate-y-boxShadowY motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0 motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0"

/**
 * Landing-matched sit-down: rest 5px, hover 2px + 3px leftover, active 5px + none.
 * Nested in `.siab-neo-tray` the rest/hover slab is dropped so wrappers do not double-offset.
 */
export const neoPress =
  `${neoPressMotion} shadow-shadow hover:shadow-shadow-hover active:shadow-none disabled:hover:shadow-shadow in-[.siab-neo-tray]:shadow-none in-[.siab-neo-tray]:hover:shadow-none in-[.siab-neo-tray]:active:shadow-none motion-reduce:hover:shadow-shadow motion-reduce:in-[.siab-neo-tray]:hover:shadow-none`

/** Press motion without a rest slab. Use when the parent already owns the offset. */
export const neoPressFlat =
  `${neoPressMotion} shadow-none hover:shadow-none active:shadow-none`

/** Raised admin tile. Static offset — does not sit down. */
export const neoChrome =
  "rounded-none border-2 border-border bg-card text-foreground shadow-shadow"

/** Border-only tray for packed controls. Inner `neoPress` tiles flatten automatically. */
export const neoTray =
  "siab-neo-tray rounded-none border-2 border-border bg-card text-foreground"

export const neoField =
  `rounded-none border-2 border-border bg-card font-base text-foreground selection:bg-main selection:text-main-foreground placeholder:text-muted-foreground ${neoFocus} disabled:cursor-not-allowed disabled:opacity-50`
