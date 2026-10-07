"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Block accidental navigation while a form has unsaved work.
 *
 * Pass `when={true}` whenever the user has dirty state (or a save is
 * in flight). The hook installs three listeners:
 *
 *  1. A `beforeunload` listener that triggers the browser's native
 *     "Leave site?" prompt (mandatory native dialog — no API to
 *     substitute a custom one for tab close / hard refresh / address-
 *     bar nav).
 *  2. A capture-phase document-level click listener that intercepts
 *     internal `<a>` / `<Link>` clicks and surfaces a custom dialog
 *     before letting Next.js's router push the new route.
 *  3. A `popstate` listener that catches browser back/forward via the
 *     classic sentinel-pushState pattern: when the hook arms with
 *     `when=true`, we push a duplicate history entry, then restore the
 *     URL on every popstate (re-pushing the sentinel) and surface the
 *     same custom dialog instead.
 *
 * The custom dialog is rendered by the consumer using the returned
 * `pending` / `confirm` / `cancel` shape — this hook is headless.
 *
 * Catches:
 *  - tab/window close                     (beforeunload, native dialog)
 *  - F5 / hard refresh                    (beforeunload, native dialog)
 *  - typing a new URL into the address bar (beforeunload)
 *  - in-app `<Link>` and `<a>` clicks within the SPA (custom dialog)
 *  - browser back/forward (via popstate-pushState pattern, custom dialog)
 *
 * Trade-off: confirming "Discard changes" on a popstate dialog uses
 * `router.push(destination)` rather than `history.go(-N)` — that adds
 * one extra entry to history (the editor URL stays in the back stack
 * one position deep). Acceptable; in exchange we avoid back/forward
 * direction-counting and its edge cases.
 *
 * Bypass cases (the click guard does NOT block these):
 *  - external links (different origin)
 *  - `target="_blank"` anchors
 *  - modifier-key clicks (Ctrl/Cmd/Shift) — preserves middle-click /
 *    open-in-new-tab behaviour
 *  - anchors with `data-skip-nav-guard="true"` — escape hatch for
 *    in-dialog anchors and any other UI that needs to bypass the
 *    confirm prompt (also honored on any ancestor)
 *  - anchors with no real `href` (e.g. `role="button"` shells)
 */

export type Pending =
  | { kind: "click"; href: string }
  | { kind: "popstate"; href: string }
  | { kind: "reload" }
  | { kind: "programmatic" }
  | null

export type NavigationGuard = {
  pending: Pending
  confirm: () => void
  cancel: () => void
  /**
   * Run a programmatic navigation through the guard. When the form is
   * dirty (`when` true) this surfaces the unsaved-changes dialog and
   * defers `navigate` until the user confirms; otherwise it runs
   * immediately. Use it for back/close buttons and any other nav that
   * isn't an `<a>` click or browser back — those the listeners catch,
   * a `router.push()`/`router.back()` from an onClick they don't.
   */
  guardedNavigate: (navigate: () => void) => void
}

export function useNavigationGuard(
  when: boolean,
  message: string = "You have unsaved changes. Leave anyway?"
): NavigationGuard {
  const router = useRouter()
  const [pending, setPending] = useState<Pending>(null)
  // Captured once per arm so popstate can know which URL to restore to.
  const anchorUrl = useRef<string>("")
  // Set true immediately before our own programmatic navigation that
  // came from a popstate confirm; the popstate listener will skip its
  // restore-and-reblock branch on the next firing.
  const bypassPopstate = useRef(false)
  // Set true immediately before our own programmatic `location.reload()`
  // (after the user clicks "Discard changes" on a keyboard-reload
  // intercept). The beforeunload listener checks this flag and skips its
  // preventDefault when set, so the OS-native dialog does NOT fire on top
  // of our custom one.
  const bypassUnload = useRef(false)
  // Holds the deferred navigation callback for a `kind: "programmatic"`
  // pending (a back/close button) — run on confirm, dropped on cancel.
  const pendingNav = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!when) return

    const beforeUnload = (e: BeforeUnloadEvent) => {
      // Programmatic reload triggered by our own confirm(reload) flow —
      // suppress the OS-native prompt so the custom dialog is the only
      // one the user sees.
      if (bypassUnload.current) return
      e.preventDefault()
      // returnValue is the load-bearing piece; the string is ignored by
      // most browsers but some legacy ones still surface it.
      e.returnValue = message
    }

    // Intercept keyboard reload (Cmd+R / Ctrl+R / F5) BEFORE the browser
    // fires its own reload. preventDefault on a keydown for these keys
    // cancels the reload entirely; we then surface the custom dialog so
    // the user can confirm or keep editing. The browser TOOLBAR refresh
    // button is NOT interceptable from JS — beforeunload remains the
    // only signal there, and the OS-native dialog is mandatory. So this
    // covers the keyboard path only; it's the most common reload UX.
    const onReloadKeydown = (e: KeyboardEvent) => {
      if (!when) return
      const isCtrlOrCmdR =
        (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "r"
      const isF5 = e.key === "F5" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey
      if (!isCtrlOrCmdR && !isF5) return
      e.preventDefault()
      e.stopPropagation()
      setPending({ kind: "reload" })
    }

    const onClick = (e: MouseEvent) => {
      // `when` is closed-over; this listener is only registered when
      // `when` is true, but we guard defensively in case React re-runs.
      if (!when) return

      // Modifier keys mean "open in new tab" / "download" / "save" —
      // never block those.
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
      // Only left-button clicks navigate.
      if (e.button !== 0) return

      // Find the nearest <a> ancestor. composedPath() is friendlier to
      // shadow DOM, but closest() is sufficient for our DOM and easier
      // to reason about.
      const target = e.target as Element | null
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null
      if (!anchor) return

      // Escape hatch for any UI that needs to opt out (dialog content,
      // future special cases).
      if (anchor.dataset.skipNavGuard === "true") return
      if (anchor.closest("[data-skip-nav-guard='true']")) return

      // No href / role=button shells — let those run their own onClick.
      const href = anchor.getAttribute("href")
      if (!href) return

      // External target (new tab/window) — let it through.
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return

      // Cross-origin — browser handles its own unload, beforeunload
      // covers it.
      if (anchor.origin !== window.location.origin) return

      // Same-origin in-app navigation: intercept and surface dialog.
      e.preventDefault()
      e.stopPropagation()
      setPending({
        kind: "click",
        href: anchor.pathname + anchor.search + anchor.hash
      })
    }

    // Capture the anchor URL — the page we're guarding. We restore to
    // this URL whenever a popstate moves us off it.
    //
    // Sentinel pushState pattern (load-bearing, do NOT remove again):
    // we push a duplicate-URL entry on top of the current one, preserving
    // Next's existing `history.state` (which carries `__NA` and the
    // App Router tree). On the first back press the browser pops onto
    // this sentinel — same URL as before — so Next's own popstate
    // listener sees no path change and its `dispatchTraverseAction`
    // is a no-op (no unmount). Our handler then opens the dialog from
    // a still-mounted PageForm.
    //
    // An earlier wave deleted this sentinel because the same-path
    // branch silently re-pushed without surfacing the dialog, which
    // looked like the sentinel was "trapping" the user. The actual
    // bug was that branch swallowing the event — fixed below by also
    // calling `setPending` there. Without the sentinel popstate is a
    // real cross-route navigation, Next's transition unmounts
    // PageForm before our `setPending` can paint, and the dialog
    // never appears.
    anchorUrl.current = window.location.href
    window.history.pushState(window.history.state, "", anchorUrl.current)

    const onPopState = () => {
      if (bypassPopstate.current) {
        bypassPopstate.current = false
        // we initiated this; let it proceed
        return
      }

      // First back press lands here: same pathname (we just popped
      // off the sentinel). Re-arm the sentinel for the *next* back
      // press, then open the dialog — silently re-pushing without
      // setPending was the original "trap" symptom.
      const anchorPath = new URL(anchorUrl.current).pathname
      if (window.location.pathname === anchorPath) {
        window.history.pushState(window.history.state, "", anchorUrl.current)
        setPending({ kind: "popstate", href: anchorUrl.current })
        return
      }

      // Different pathname — sentinel didn't hold (e.g. user
      // double-tapped back, or first-load edge case where the
      // sentinel hadn't armed yet). Restore URL visually via push,
      // open dialog with the destination the user actually wanted.
      // (Race: PageForm may still unmount before paint here. The
      // sentinel branch above is the reliable path; this is fallback.)
      const destination = window.location.href
      window.history.pushState(window.history.state, "", anchorUrl.current)
      setPending({ kind: "popstate", href: destination })
    }

    window.addEventListener("beforeunload", beforeUnload)
    // Capture phase is non-negotiable — Next.js's <Link> registers its
    // own click handler that intercepts before any document-level
    // bubble-phase listener can run.
    document.addEventListener("click", onClick, true)
    // keydown for reload-shortcut intercept. Capture phase so we run
    // before any in-page handler that might stop propagation.
    document.addEventListener("keydown", onReloadKeydown, true)
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("keydown", onReloadKeydown, true)
      window.removeEventListener("popstate", onPopState)
    }
    // `router` is stable across renders in Next.js 13+ App Router —
    // including it in deps would cause unnecessary listener teardown +
    // re-registration on every parent re-render (PageForm re-renders
    // on every keystroke under RHF default mode).
  }, [when, message])

  const confirm = () => {
    if (!pending) return
    if (pending.kind === "programmatic") {
      // Back/close button (or other onClick-driven nav) — run the
      // deferred callback now that the user has confirmed the discard.
      const navigate = pendingNav.current
      pendingNav.current = null
      setPending(null)
      navigate?.()
      return
    }
    if (pending.kind === "reload") {
      // Suppress beforeunload during our own programmatic reload so the
      // OS-native prompt does NOT show on top of the (now-confirming)
      // custom dialog.
      bypassUnload.current = true
      window.location.reload()
      return
    }
    if (pending.kind === "popstate") {
      bypassPopstate.current = true
      // Two cases — both leave us sitting on a fresh sentinel above the
      // editor entry, but they need different exits:
      //
      //  - same-path branch (typical back press, sentinel held): we
      //    don't know where the user came from before the editor.
      //    Stack is [..., prev, editor, sentinel-new]; `go(-2)` pops
      //    both back to `prev`, honouring the back-button intent.
      //
      //  - different-path branch (sentinel didn't hold, e.g. forward
      //    press onto a different URL): we DO have the destination
      //    they wanted. router.push gets us there in a direction-
      //    agnostic way.
      if (pending.href === anchorUrl.current) {
        window.history.go(-2)
      } else {
        const u = new URL(pending.href)
        router.push(u.pathname + u.search + u.hash)
      }
    } else if (pending.kind === "click") {
      router.push(pending.href)
    }
    setPending(null)
  }

  const cancel = () => {
    // For popstate the URL is already restored by the listener's
    // pushState; for click we never navigated; for reload we never
    // called location.reload; for programmatic we never ran the
    // callback. Either way, clear pending state. Reset bypassUnload +
    // pendingNav defensively.
    bypassUnload.current = false
    pendingNav.current = null
    setPending(null)
  }

  const guardedNavigate = (navigate: () => void) => {
    if (when) {
      pendingNav.current = navigate
      setPending({ kind: "programmatic" })
    } else {
      navigate()
    }
  }

  return { pending, confirm, cancel, guardedNavigate }
}
