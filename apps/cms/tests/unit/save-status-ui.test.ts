import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { countLeafErrors } from "@/lib/countLeafErrors"
import { deriveSaveStatus } from "@/lib/deriveSaveStatus"

const read = (path: string) => readFileSync(path, "utf8")
const legacyImport = 'from "' + "so" + 'nner"'
const legacyCall = "to" + "ast."
const legacyUiPath = "@siteinabox/ui/components/" + "so" + "nner"
const legacyHost = "<To" + "aster"

describe("FE-80 save status UI", () => {
  it("uses the registry-owned merged save status primitives", () => {
    const statusBar = read("src/components/save-ui/save-status-bar.tsx")
    const statusBadge = read("src/components/save-ui/status-badge.tsx")
    const mobilePill = read("src/components/save-ui/mobile-save-pill.tsx")
    const statusFeedback = read("src/components/status-feedback.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")
    const settingsForm = read("src/components/forms/SettingsForm.tsx")
    const tenantForm = read("src/components/forms/TenantEditForm.tsx")
    const userForm = read("src/components/forms/UserEditForm.tsx")
    const profileForm = read("src/components/forms/ProfileForm.tsx")
    const formSubmissionSheet = read("src/components/forms/FormSubmissionSheet.tsx")
    const navigation = read("src/components/navigation/NavigationManager.tsx")
    const appLayout = read("src/app/(frontend)/layout.tsx")

    expect(statusBar).toContain("@/components/save-ui/status-badge")
    expect(statusBar).toContain("<StatusBadge")
    expect(statusBar).toContain("getStatusBadgeClassName")
    expect(statusBar).toContain("setShowSaved(true)")
    expect(statusBar).toContain('status === "saved" ? "success"')
    expect(statusBar).toContain("CheckCircle2")
    expect(statusBar).not.toContain(legacyImport)
    expect(statusBar).not.toContain(legacyCall)
    expect(statusBadge).toContain("export function StatusBadge")
    expect(statusBadge).toContain("h-8 px-3 rounded-md")
    expect(statusBadge).toContain("bg-success/75 supports-[backdrop-filter]:bg-success/65")
    expect(statusBadge).toContain("bg-destructive/75 supports-[backdrop-filter]:bg-destructive/65")
    expect(statusBar).toContain("useCspStyleRule")
    expect(statusBar).toContain("save-status-bar-position")
    expect(statusBar).toContain("bottom:calc(env(safe-area-inset-bottom, 0px) + 4.75rem)")
    expect(mobilePill).toContain('displayStatus === "error" ? t("saveFailed")')
    expect(mobilePill).toContain("2_000")
    expect(statusFeedback).toContain("@/components/save-ui/status-badge")
    expect(statusFeedback).toContain("useStatusFeedback")
    expect(statusFeedback).toContain("loading:")
    expect(statusFeedback).toContain("success:")
    expect(statusFeedback).toContain("error:")
    expect(statusFeedback).toContain("currentAdminSidebarOffset")
    expect(statusFeedback).toContain("md:left-[calc(50%+1.5rem)]")
    expect(statusFeedback).toContain("md:left-[calc(50%+8rem)]")
    expect(statusFeedback).not.toContain('left: `calc(50% + ${sidebarOffset} / 2)`')
    expect(statusFeedback).not.toContain(legacyImport)
    expect(statusFeedback).not.toContain(legacyCall)
    expect(appLayout).toContain("<StatusFeedbackProvider>")
    expect(appLayout).not.toContain(legacyHost)
    expect(appLayout).not.toContain(legacyUiPath)

    for (const source of [pageForm, settingsForm, tenantForm, userForm, profileForm, formSubmissionSheet, navigation]) {
      expect(source).toContain("@/components/save-ui/save-status-bar")
      expect(source).not.toContain("@/components/save-status/")
    }
    for (const source of [pageForm, settingsForm, tenantForm, userForm, navigation]) {
      expect(source).toContain("@/components/save-ui/mobile-save-pill")
    }

    expect(navigation).not.toContain(legacyCall)
    expect(navigation).not.toContain(legacyImport)
    expect(settingsForm).not.toContain(legacyCall)
    expect(tenantForm).not.toContain(legacyCall)
    expect(userForm).not.toContain(legacyCall)
    expect(profileForm).not.toContain(legacyCall)
    expect(formSubmissionSheet).not.toContain(legacyCall)
    for (const source of [pageForm, settingsForm, tenantForm, userForm, profileForm, formSubmissionSheet, navigation]) {
      expect(source).not.toContain(legacyImport)
      expect(source).not.toContain(legacyCall)
    }
  })

  it("passes validation error counts into save affordances that can block on form errors", () => {
    const settingsForm = read("src/components/forms/SettingsForm.tsx")
    const tenantForm = read("src/components/forms/TenantEditForm.tsx")
    const userForm = read("src/components/forms/UserEditForm.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")
    const profileForm = read("src/components/forms/ProfileForm.tsx")

    for (const source of [settingsForm, tenantForm, userForm, pageForm]) {
      expect(source).toContain("countLeafErrors(form.formState.errors)")
      expect(source).toContain("errorCount={errorCount}")
    }
    expect(profileForm).toContain("countLeafErrors(nameForm.formState.errors)")
    expect(profileForm).toContain("errorCount={nameErrorCount}")
    expect(pageForm).toContain("{isDesktop && (")
    expect(settingsForm).toContain("errorCount > 0 || saveFailed")
    expect(tenantForm).toContain("errorCount > 0 || saveFailed")
    expect(userForm).toContain("errorCount > 0 || saveFailed")
  })

  it("counts nested react-hook-form leaf errors without counting grouping objects", () => {
    expect(countLeafErrors({
      title: { message: "Required", type: "required" },
      blocks: [
        {
          fields: {
            heading: { message: "Too short", type: "min" },
            image: undefined,
          },
        },
        {
          fields: {
            links: [
              null,
              { url: { type: "pattern" } },
            ],
          },
        },
      ],
    })).toBe(3)
  })

  it("treats saved as an explicit post-save flash, not a generic clean-state fallback", () => {
    expect(deriveSaveStatus({
      pending: false,
      hasError: false,
      isDirty: false,
      showSaved: true,
    })).toBe("saved")
    expect(deriveSaveStatus({
      pending: false,
      hasError: false,
      isDirty: false,
      showSaved: false,
    })).toBe("idle")

    const pageForm = read("src/components/forms/PageForm.tsx")
    const settingsForm = read("src/components/forms/SettingsForm.tsx")
    const tenantForm = read("src/components/forms/TenantEditForm.tsx")
    const userForm = read("src/components/forms/UserEditForm.tsx")
    const profileForm = read("src/components/forms/ProfileForm.tsx")
    const formSubmissionSheet = read("src/components/forms/FormSubmissionSheet.tsx")
    const navigation = read("src/components/navigation/NavigationManager.tsx")

    for (const source of [pageForm, settingsForm, tenantForm, userForm, profileForm, formSubmissionSheet, navigation]) {
      expect(source).toContain("deriveSaveStatus")
      expect(source).not.toContain("lastSavedAt")
      expect(source).not.toContain("nameLastSavedAt")
    }
    expect(pageForm).toContain("setShowSaved(false)")
    expect(settingsForm).toContain("form.watch(() => setShowSaved(false))")
    expect(tenantForm).toContain("form.watch(() => setShowSaved(false))")
    expect(userForm).toContain("form.watch(() => setShowSaved(false))")
    expect(profileForm).toContain("nameForm.watch(() => setShowNameSaved(false))")
    expect(formSubmissionSheet).toContain("onValueChange={(next) => { setShowSaved(false); setStatus(next) }}")
    expect(navigation).toContain("if (isDirty) setShowSaved(false)")
  })
})
