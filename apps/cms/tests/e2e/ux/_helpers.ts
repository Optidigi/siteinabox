import type { Page } from "@playwright/test"
import { readE2ESeed } from "../_seed"

/**
 * UX test helpers — separate from `tests/e2e/_setup.ts` because the runner
 * API-key seeding path that file uses doesn't exist in the workspace bootstrap.
 *
 * Auth strategy: each UX spec logs in once at the top via the real /login form
 * (so the audit's discovery that login itself works survives in CI). Reuses the
 * super-admin credentials saved by the workspace's Phase 0 bootstrap at
 * `frontend-auditer/.local-creds.json` (or env vars if set).
 */

type Creds = { email: string; password: string }

const seed = readE2ESeed()
export const AUDIT_SITE_SLUG = seed.audit.slug
export const AUDIT_SITE_NAME = seed.audit.name
export const AUDIT_TENANT_ID = seed.audit.tenantId
export const AUDIT_PAGE_ID = seed.audit.pageId
export const AUDIT_PAGE_URL = seed.audit.pageUrl
export const AUDIT_SECONDARY_PAGE_ID = seed.audit.secondaryPageId
export const AUDIT_SECONDARY_PAGE_URL = seed.audit.secondaryPageUrl
export const AUDIT_SITE_SETTINGS_ID = seed.audit.siteSettingsId
export const AUDIT_MEDIA_ID = seed.audit.mediaId
export const AUDIT_SITE_URL = `/sites/${AUDIT_SITE_SLUG}`
export const AUDIT_PAGES_URL = `${AUDIT_SITE_URL}/pages`
export const AUDIT_SETTINGS_URL = `${AUDIT_SITE_URL}/settings`
export const AUDIT_ONBOARDING_URL = `${AUDIT_SITE_URL}/onboarding`
export const AUDIT_FORMS_URL = `${AUDIT_SITE_URL}/forms`
export const AUDIT_USERS_URL = `${AUDIT_SITE_URL}/users`
export const AUDIT_MEDIA_URL = `${AUDIT_SITE_URL}/media`
export const AUDIT_EDIT_URL = `${AUDIT_SITE_URL}/edit`

export function getSuperAdminCreds(): Creds {
  const envEmail = process.env.UX_TEST_SA_EMAIL
  const envPw = process.env.UX_TEST_SA_PASSWORD
  if (envEmail && envPw) return { email: envEmail, password: envPw }
  return seed.superAdmin
}

export async function loginAsSuperAdmin(page: Page): Promise<void> {
  const creds = getSuperAdminCreds()
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[type="email"]', creds.email)
  await page.fill('input[type="password"]', creds.password)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL("/", { timeout: 30_000 })
}

/**
 * Canonical list of admin routes walked by the audit pass. Used by sweep specs
 * (e.g. document-title.spec.ts). Each entry's slug must exist in the seeded
 * tenant — the workspace bootstrap creates `audit-test`.
 */
export const ADMIN_ROUTES_AUTHENTICATED: ReadonlyArray<{ url: string; label: string }> = [
  { url: "/", label: "super-admin dashboard" },
  { url: "/sites", label: "sites list" },
  { url: AUDIT_SITE_URL, label: "site dashboard" },
  { url: AUDIT_PAGES_URL, label: "pages list" },
  { url: AUDIT_PAGE_URL, label: "page editor" },
  { url: AUDIT_SETTINGS_URL, label: "settings" },
  { url: AUDIT_ONBOARDING_URL, label: "onboarding" },
  { url: AUDIT_FORMS_URL, label: "forms list" },
  { url: AUDIT_USERS_URL, label: "team" },
  { url: AUDIT_MEDIA_URL, label: "media" }
]

export const ADMIN_ROUTES_UNAUTHENTICATED: ReadonlyArray<{ url: string; label: string }> = [
  { url: "/login", label: "login" }
]
