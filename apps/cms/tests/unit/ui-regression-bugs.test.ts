// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import { createElement } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = ((key: string) => key) as ((key: string) => string) & {
      rich: (_key: string, values: { phrase: () => unknown }) => unknown
    }
    translate.rich = (_key, values) => values.phrase()
    return translate
  },
}))

const statusMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}))

vi.mock("@/components/status-feedback", () => ({
  useStatusFeedback: () => statusMocks,
}))

import { TypedConfirmDialog } from "@/components/typed-confirm-dialog"
import { MobileSavePill } from "@/components/save-ui/mobile-save-pill"
import { ApiKeyManager } from "@/components/forms/ApiKeyManager"

const read = (path: string) => readFileSync(path, "utf8")

describe("observed UI bug regressions", () => {
  it("keeps the sidebar selected accent on the brand token", () => {
    const sidebar = read("src/components/layout/AppSidebar.tsx")

    expect(sidebar).toContain("[--sidebar-primary:var(--brand)]")
    expect(sidebar).toContain("[--sidebar-primary-foreground:var(--brand-foreground)]")
  })

  it("renders the typed confirmation phrase and enables confirmation only for an exact match", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()

    render(createElement(TypedConfirmDialog, {
      open: true,
      onOpenChange,
      title: "Delete user",
      description: "This cannot be undone.",
      confirmPhrase: "example@example.com",
      confirmLabel: "Delete",
      onConfirm,
    }))

    expect(screen.getByText("example@example.com")).toBeTruthy()
    const input = screen.getByRole("textbox")
    const confirm = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    fireEvent.change(input, { target: { value: "example@example.co" } })
    expect(confirm.disabled).toBe(true)

    fireEvent.change(input, { target: { value: " example@example.com " } })
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })


  it("resets API-key pending state when the enable request fails before a response exists", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network offline"))
    vi.stubGlobal("fetch", fetchMock)
    statusMocks.error.mockReset()

    const user = { id: 42, enableAPIKey: false } as Parameters<typeof ApiKeyManager>[0]["user"]
    render(createElement(ApiKeyManager, { user }))

    const toggle = screen.getByRole("switch", { name: "API key" }) as HTMLButtonElement
    fireEvent.click(toggle)

    await waitFor(() => expect(statusMocks.error).toHaveBeenCalledWith("networkError"))
    expect(toggle.disabled).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it("resets pending state when create-user network work throws", () => {
    const form = read("src/components/forms/CreateUserForm.tsx")

    expect(form).toContain("try {")
    expect(form).toContain("status.error(tCommon(\"networkError\"))")
    expect(form).toContain("finally {\n      setPending(false)\n    }")
    expect(form).toContain("const patchRes = await fetch(`/api/users/${newId}`")
  })

  it("resets pending state when user-edit save fetch throws", () => {
    const form = read("src/components/forms/UserEditForm.tsx")

    expect(form).toContain("try {")
    expect(form).toContain("status.error(tCommon(\"networkError\"))")
    expect(form).toContain("finally {\n      setSavePending(false)\n    }")
    expect(form).toContain("const res = await fetch(`/api/users/${user.id}`")
  })

  it("does not offer owner invites unless the route explicitly allows them", () => {
    const selectedSiteRoute = read("src/app/(frontend)/(admin)/sites/[slug]/users/page.tsx")
    const tenantRoute = read("src/app/(frontend)/(admin)/users/page.tsx")

    expect(selectedSiteRoute).toContain('canInviteOwners={user.role === "super-admin"}')
    expect(tenantRoute).toContain("<UserInviteForm tenantId={tenantId} />")
  })

  it("guards mobile navigation save when there are no changes or a save is already running", () => {
    const manager = read("src/components/navigation/NavigationManager.tsx")

    expect(manager).toContain("const save = async () => {\n    if (!isDirty || saving) return")
    expect(manager).toContain("<MobileSavePill status={saveStatus} dirtyCount={dirtyCount} onSave={save} />")
  })

  it("disables the shared mobile save pill when the form is clean, saved, or already saving", () => {
    const onSave = vi.fn()
    const view = render(createElement(MobileSavePill, { status: "idle", onSave }))

    expect((screen.getByRole("button", { name: "saved" }) as HTMLButtonElement).disabled).toBe(true)

    view.rerender(createElement(MobileSavePill, { status: "saved", onSave }))
    expect((screen.getByRole("button", { name: "saved" }) as HTMLButtonElement).disabled).toBe(true)

    view.rerender(createElement(MobileSavePill, { status: "saving", onSave }))
    expect((screen.getByRole("button", { name: "saving" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("reads analytics measuredFromVisitors as a raw ICU template", () => {
    const adminAnalytics = read("src/app/(frontend)/(admin)/analytics/page.tsx")
    const tenantAnalytics = read("src/app/(frontend)/(admin)/sites/[slug]/analytics/page.tsx")

    expect(adminAnalytics).toContain('measuredFromVisitors: t.raw("measuredFromVisitors")')
    expect(adminAnalytics).not.toContain('measuredFromVisitors: t("measuredFromVisitors")')
    expect(tenantAnalytics).toContain('measuredFromVisitors: t.raw("measuredFromVisitors")')
    expect(tenantAnalytics).not.toContain('measuredFromVisitors: t("measuredFromVisitors")')
  })

  it("allows common tenant-local hosts for Next dev resources", () => {
    const nextConfig = read("next.config.mjs")

    expect(nextConfig).toContain('"t1.test"')
    expect(nextConfig).toContain('"*.test"')
    expect(nextConfig).toContain('"*.localhost"')
    expect(nextConfig).toContain('"*.lvh.me"')
    expect(nextConfig).toContain('"*.localtest.me"')
    expect(nextConfig).toContain("SIAB_ALLOWED_DEV_ORIGINS")
  })
})
