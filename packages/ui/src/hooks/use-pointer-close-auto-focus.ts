import * as React from "react"

/** Prevent Radix from returning focus to a trigger after a mouse/pen close. */
export function usePointerCloseAutoFocus() {
  const pointerCloseRef = React.useRef(false)

  return {
    onPointerDown: (event: { pointerType: string }) => {
      pointerCloseRef.current = event.pointerType === "mouse" || event.pointerType === "pen"
    },
    onKeyDown: () => {
      pointerCloseRef.current = false
    },
    onPointerDownOutside: () => {
      pointerCloseRef.current = true
    },
    onCloseAutoFocus: (event: { preventDefault: () => void }) => {
      if (!pointerCloseRef.current) return
      event.preventDefault()
      pointerCloseRef.current = false
      window.setTimeout(() => {
        const active = document.activeElement
        if (!(active instanceof HTMLElement)) return
        if (
          active.getAttribute("aria-haspopup")
          || active.dataset.slot === "dropdown-menu-trigger"
          || active.dataset.slot === "select-trigger"
        ) {
          active.blur()
        }
      }, 0)
    },
  }
}
