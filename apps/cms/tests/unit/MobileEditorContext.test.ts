import { describe, it, expect } from "vitest"
import {
  MOBILE_INSPECTOR_COLLAPSED_SNAP,
  mobileEditorReducer,
  initialMobileEditorState,
  type MobileEditorState,
  type DrillFrame,
} from "@/components/editor/mobile/MobileEditorContext"
import type { ElementPath } from "@/components/editor/elementPath"

const path = (over: Partial<ElementPath> = {}): ElementPath => ({ blockIndex: 0, field: "headline", ...over })

describe("mobileEditorReducer", () => {
  it("initial state has no selection, collapsed snap, empty drill", () => {
    expect(initialMobileEditorState).toEqual<MobileEditorState>({
      selected: null,
      activeSnapPoint: MOBILE_INSPECTOR_COLLAPSED_SNAP,
      preFocusSnap: null,
      drillStack: [],
    })
  })

  it("SET_SELECTED with no subField sets selection and opens at the compact detent 0.42", () => {
    const next = mobileEditorReducer(initialMobileEditorState, { type: "SET_SELECTED", path: path() })
    expect(next.selected).toEqual(path())
    expect(next.activeSnapPoint).toBe(0.42)
    expect(next.drillStack).toEqual([])
  })

  it("SET_SELECTED on an array sub-field initialises 2-frame drill stack (item + sub-field)", () => {
    const p: ElementPath = { blockIndex: 1, field: "features", itemIndex: 2, subField: "icon" }
    const next = mobileEditorReducer(initialMobileEditorState, { type: "SET_SELECTED", path: p })
    expect(next.selected).toEqual(p)
    expect(next.drillStack).toEqual<DrillFrame[]>([
      { blockIndex: 1, field: "features", itemIndex: 2 },
      { blockIndex: 1, field: "features", itemIndex: 2, subField: "icon" },
    ])
    expect(next.activeSnapPoint).toBe(0.42)
  })

  it("POP_DRILL from a sub-field frame lands on the parent item frame", () => {
    const seeded: MobileEditorState = {
      selected: { blockIndex: 1, field: "features", itemIndex: 2, subField: "icon" },
      activeSnapPoint: 0.42,
      preFocusSnap: null,
      drillStack: [
        { blockIndex: 1, field: "features", itemIndex: 2 },
        { blockIndex: 1, field: "features", itemIndex: 2, subField: "icon" },
      ],
    }
    const next = mobileEditorReducer(seeded, { type: "POP_DRILL" })
    expect(next.drillStack).toEqual<DrillFrame[]>([
      { blockIndex: 1, field: "features", itemIndex: 2 },
    ])
  })

  it("CLEAR_SELECTION resets to the collapsed snap and empties drill", () => {
    const seeded: MobileEditorState = { selected: path(), activeSnapPoint: 0.92, preFocusSnap: 0.42, drillStack: [{ blockIndex: 0, field: "features", itemIndex: 1 }] }
    const next = mobileEditorReducer(seeded, { type: "CLEAR_SELECTION" })
    expect(next.selected).toBeNull()
    expect(next.activeSnapPoint).toBe(MOBILE_INSPECTOR_COLLAPSED_SNAP)
    expect(next.drillStack).toEqual([])
  })

  it("RESTORE_PRE_FOCUS_SNAP after CLEAR_SELECTION cannot reopen or expand the idle sheet", () => {
    const seeded: MobileEditorState = { selected: path(), activeSnapPoint: 0.92, preFocusSnap: 0.42, drillStack: [{ blockIndex: 0, field: "features", itemIndex: 1 }] }
    const cleared = mobileEditorReducer(seeded, { type: "CLEAR_SELECTION" })
    const restored = mobileEditorReducer(cleared, { type: "RESTORE_PRE_FOCUS_SNAP" })

    expect(restored.selected).toBeNull()
    expect(restored.activeSnapPoint).toBe(MOBILE_INSPECTOR_COLLAPSED_SNAP)
    expect(restored.preFocusSnap).toBeNull()
    expect(restored.drillStack).toEqual([])
  })

  it("PUSH_DRILL appends a frame", () => {
    const next = mobileEditorReducer(initialMobileEditorState, { type: "PUSH_DRILL", frame: { blockIndex: 0, field: "features", itemIndex: 0 } })
    expect(next.drillStack).toEqual([{ blockIndex: 0, field: "features", itemIndex: 0 }])
  })

  it("POP_DRILL removes the last frame", () => {
    const seeded: MobileEditorState = {
      selected: null,
      activeSnapPoint: 0.42,
      preFocusSnap: null,
      drillStack: [{ blockIndex: 0, field: "features", itemIndex: 0 }, { blockIndex: 0, field: "features", itemIndex: 1 }],
    }
    const next = mobileEditorReducer(seeded, { type: "POP_DRILL" })
    expect(next.drillStack).toEqual([{ blockIndex: 0, field: "features", itemIndex: 0 }])
  })

  it("POP_DRILL on an empty stack is a no-op", () => {
    const next = mobileEditorReducer(initialMobileEditorState, { type: "POP_DRILL" })
    expect(next).toEqual(initialMobileEditorState)
  })

  it("EXPAND_TO updates the snap point", () => {
    const next = mobileEditorReducer({ ...initialMobileEditorState, selected: path() }, { type: "EXPAND_TO", snap: 0.92 })
    expect(next.activeSnapPoint).toBe(0.92)
    expect(next.selected).toEqual(path())
  })

  it("SET_SELECTED on a non-array path clears any pre-existing drill stack", () => {
    const seeded: MobileEditorState = {
      selected: null,
      activeSnapPoint: 0.42,
      preFocusSnap: null,
      drillStack: [{ blockIndex: 0, field: "features", itemIndex: 0 }],
    }
    const next = mobileEditorReducer(seeded, { type: "SET_SELECTED", path: path({ blockIndex: 2, field: "headline" }) })
    expect(next.selected).toEqual(path({ blockIndex: 2, field: "headline" }))
    expect(next.drillStack).toEqual([])
  })

  it("CLEAR_DRILL preserves selection and snap point", () => {
    const seeded: MobileEditorState = {
      selected: path(),
      activeSnapPoint: 0.92,
      preFocusSnap: null,
      drillStack: [{ blockIndex: 0, field: "features", itemIndex: 0 }],
    }
    const next = mobileEditorReducer(seeded, { type: "CLEAR_DRILL" })
    expect(next.selected).toEqual(path())
    expect(next.activeSnapPoint).toBe(0.92)
    expect(next.drillStack).toEqual([])
  })

  it("EXPAND_TO returns a new state object even when snap is unchanged", () => {
    const seeded: MobileEditorState = { selected: path(), activeSnapPoint: 0.42, preFocusSnap: null, drillStack: [] }
    const next = mobileEditorReducer(seeded, { type: "EXPAND_TO", snap: 0.42 })
    expect(next).not.toBe(seeded)
    expect(next.activeSnapPoint).toBe(0.42)
  })

  it("FOCUS_POP pops 0.42 → 0.92 and remembers the compact detent", () => {
    const selected = mobileEditorReducer(initialMobileEditorState, { type: "SET_SELECTED", path: path() })
    const next = mobileEditorReducer(selected, { type: "FOCUS_POP" })
    expect(next.activeSnapPoint).toBe(0.92)
    expect(next.preFocusSnap).toBe(0.42)
  })

  it("RESTORE_PRE_FOCUS_SNAP returns to the remembered compact detent", () => {
    const selected = mobileEditorReducer(initialMobileEditorState, { type: "SET_SELECTED", path: path() })
    const focused = mobileEditorReducer(selected, { type: "FOCUS_POP" })
    const restored = mobileEditorReducer(focused, { type: "RESTORE_PRE_FOCUS_SNAP" })
    expect(restored.activeSnapPoint).toBe(0.42)
    expect(restored.preFocusSnap).toBeNull()
  })

  it("EXPAND_TO clears the remembered focus detent so manual snaps win", () => {
    const selected = mobileEditorReducer(initialMobileEditorState, { type: "SET_SELECTED", path: path() })
    const focused = mobileEditorReducer(selected, { type: "FOCUS_POP" })
    const expanded = mobileEditorReducer(focused, { type: "EXPAND_TO", snap: 0.92 })
    expect(expanded.activeSnapPoint).toBe(0.92)
    expect(expanded.preFocusSnap).toBeNull()
  })

  it("FOCUS_POP at the editing detent (0.92) is a no-op", () => {
    const seeded: MobileEditorState = { selected: path(), activeSnapPoint: 0.92, preFocusSnap: null, drillStack: [] }
    const next = mobileEditorReducer(seeded, { type: "FOCUS_POP" })
    expect(next).toBe(seeded)
  })
})
