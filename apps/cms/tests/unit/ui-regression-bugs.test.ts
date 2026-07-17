import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("observed UI bug regressions", () => {
  it("keeps the sidebar selected accent on the brand token", () => {
    const sidebar = read("src/components/layout/AppSidebar.tsx")

    expect(sidebar).toContain("[--sidebar-primary:var(--brand)]")
    expect(sidebar).toContain("[--sidebar-primary-foreground:var(--brand-foreground)]")
  })

  it("renders the typed confirmation phrase through next-intl rich markup", () => {
    const dialog = read("src/components/typed-confirm-dialog.tsx")
    const en = read("src/locales/en.json")
    const nl = read("src/locales/nl.json")

    expect(dialog).toContain('t.rich("typeToConfirm"')
    expect(en).toContain('"typeToConfirm": "Type <phrase></phrase> to confirm:"')
    expect(nl).toContain('"typeToConfirm": "Typ <phrase></phrase> om te bevestigen:"')
  })


  it("resets pending state when API key fetches throw before a response exists", () => {
    const manager = read("src/components/forms/ApiKeyManager.tsx")

    expect(manager).toContain('const tCommon = useTranslations("common")')
    expect(manager).toContain("try {")
    expect(manager).toContain("status.error(tCommon(\"networkError\"))")
    expect(manager).toContain("finally {\n      setPending(false)\n    }")
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
    const form = read("src/components/forms/UserInviteForm.tsx")
    const selectedSiteRoute = read("src/app/(frontend)/(admin)/sites/[slug]/users/page.tsx")
    const tenantRoute = read("src/app/(frontend)/(admin)/users/page.tsx")

    expect(form).toContain("canInviteOwners = false")
    expect(form).toContain('canInviteOwners ? ["owner", "editor", "viewer"] : ["editor", "viewer"]')
    expect(selectedSiteRoute).toContain('canInviteOwners={user.role === "super-admin"}')
    expect(tenantRoute).toContain("<UserInviteForm tenantId={tenantId} />")
  })

  it("guards mobile navigation save when there are no changes or a save is already running", () => {
    const manager = read("src/components/navigation/NavigationManager.tsx")

    expect(manager).toContain("const save = async () => {\n    if (!isDirty || saving) return")
    expect(manager).toContain("<MobileSavePill status={saveStatus} dirtyCount={dirtyCount} onSave={save} />")
  })

  it("disables the shared mobile save pill when the form is clean, saved, or already saving", () => {
    const pill = read("src/components/save-ui/mobile-save-pill.tsx")

    expect(pill).toContain('displayStatus === "idle"')
    expect(pill).toContain('displayStatus === "saved"')
    expect(pill).toContain('displayStatus === "saving"')
    expect(pill).toContain("disabled={disabled}")
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
