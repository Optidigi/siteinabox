import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock("react-hook-form", () => ({
  useForm: () => ({
    reset: vi.fn(),
  }),
}))

vi.mock("@siteinabox/ui/components/button", () => ({
  Button: "button",
}))

vi.mock("@siteinabox/ui/components/form", () => ({
  Form: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/editor/canvas/BlockPresetsContext", () => ({
  BlockPresetsProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/editor/iframe/PageEditorFrameHost", () => ({
  PageEditorFrameHost: () => null,
}))

vi.mock("@/components/editor/canvas/CanvasSelectionContext", () => ({
  CanvasSelectionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/editor/canvas/SiteChromePreview", () => ({
  SiteChromeActionFrame: ({ children }: { children: React.ReactNode }) => children,
  SiteChromePreview: () => null,
}))

vi.mock("@/components/editor/RtManifestContext", () => ({
  RtManifestProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/components/editor/theme/theme-bar", () => ({
  ThemeBar: () => null,
}))

vi.mock("@/lib/actions/previewCustomizer", () => ({
  setPreviewTheme: vi.fn(),
}))

describe("PreviewCustomizer stale theme save guard", () => {
  it("accepts the response for the latest local theme version", async () => {
    const { shouldApplyPreviewThemeSaveResponse } = await import("@/components/preview/PreviewCustomizer")

    expect(shouldApplyPreviewThemeSaveResponse({
      latestSerializedTheme: "{\"radius\":\"0.5rem\"}",
      latestVersion: 2,
      requestSerializedTheme: "{\"radius\":\"0.5rem\"}",
      requestVersion: 2,
    })).toBe(true)
  })

  it("rejects an older response after a newer local theme edit", async () => {
    const { shouldApplyPreviewThemeSaveResponse } = await import("@/components/preview/PreviewCustomizer")

    expect(shouldApplyPreviewThemeSaveResponse({
      latestSerializedTheme: "{\"radius\":\"1.5rem\"}",
      latestVersion: 3,
      requestSerializedTheme: "{\"radius\":\"0.5rem\"}",
      requestVersion: 2,
    })).toBe(false)
  })

  it("starts a queued save only when no write is in flight and pending differs from persisted", async () => {
    const { shouldStartPreviewThemeSave } = await import("@/components/preview/PreviewCustomizer")

    expect(shouldStartPreviewThemeSave({
      hasInFlightSave: false,
      pendingSerializedTheme: "{\"mode\":\"dark\"}",
      persistedSerializedTheme: "{}",
    })).toBe(true)

    expect(shouldStartPreviewThemeSave({
      hasInFlightSave: true,
      pendingSerializedTheme: "{\"mode\":\"dark\"}",
      persistedSerializedTheme: "{}",
    })).toBe(false)

    expect(shouldStartPreviewThemeSave({
      hasInFlightSave: false,
      pendingSerializedTheme: "{\"mode\":\"dark\"}",
      persistedSerializedTheme: "{\"mode\":\"dark\"}",
    })).toBe(false)

    expect(shouldStartPreviewThemeSave({
      hasInFlightSave: false,
      pendingRequiresWrite: true,
      pendingSerializedTheme: "{}",
      persistedSerializedTheme: "{}",
    })).toBe(true)
  })

  it("blocks customer navigation only while a theme save is pending or in flight", async () => {
    const { shouldBlockPreviewCustomerNavigation } = await import("@/components/preview/PreviewCustomizer")

    expect(shouldBlockPreviewCustomerNavigation("saving")).toBe(true)
    expect(shouldBlockPreviewCustomerNavigation("idle")).toBe(false)
    expect(shouldBlockPreviewCustomerNavigation("saved")).toBe(false)
    expect(shouldBlockPreviewCustomerNavigation("error")).toBe(false)
  })

  it("wires blocked customer navigation into the command bar links", () => {
    const source = readFileSync("src/components/preview/PreviewCustomizer.tsx", "utf8")

    expect(source).toContain("customerNavigationBlocked={customerNavigationBlocked}")
    expect(source).toContain("href={customerNavigationBlocked ? undefined : reviewHref}")
    expect(source).toContain("href={customerNavigationBlocked ? undefined : checkoutHref}")
    expect(source).toContain("\"aria-disabled\": true")
    expect(source).toContain("tabIndex: -1")
  })
})
