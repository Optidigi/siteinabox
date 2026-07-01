import { describe, expect, it } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"

const src = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), "utf-8")

describe("passwordless auth surface", () => {
  it("keeps CMS login passwordless by default with a host-gated password fallback", () => {
    const loginForm = src("src/components/forms/LoginForm.tsx")
    expect(loginForm).toContain("allowPasswordLogin")
    expect(loginForm).toContain("passwordMode")
    expect(loginForm).toContain("authClient.signIn.magicLink")
    expect(loginForm).toMatch(/passwordMode\s*&&\s*allowPasswordLogin/)
    expect(loginForm).toContain("passwordLogin")
    expect(loginForm).toContain("magicLinkLogin")

    const loginPage = src("src/app/(frontend)/login/page.tsx")
    expect(loginPage).toContain("isSuperAdminDomain")
    expect(loginPage).toContain("allowPasswordLogin")
  })

  it("blocks the Payload password-login endpoint outside the SIAB admin host", () => {
    const proxy = src("src/proxy.ts")
    expect(proxy).toContain('"/api/users/login"')
    expect(proxy).toContain("isPasswordLoginRequest")
    expect(proxy).toContain("buildPasswordLoginUnavailableResponse")
    expect(proxy).toMatch(/isPasswordLoginRequest\(req\)[\s\S]*?!isSuperAdminDomain/)
  })

  it("sets persistent Better Auth and Payload session durations from one server-side source", () => {
    const durations = src("src/lib/auth/sessionDurations.ts")
    expect(durations).toContain("CMS_SESSION_EXPIRES_IN_SECONDS")
    expect(durations).toContain("PREVIEW_SESSION_EXPIRES_IN_SECONDS")
    expect(durations).toContain("SESSION_UPDATE_AGE_SECONDS")

    expect(src("src/lib/betterAuth.ts")).toMatch(/expiresIn:\s*CMS_SESSION_EXPIRES_IN_SECONDS/)
    expect(src("src/lib/preview/betterAuth.ts")).toMatch(/expiresIn:\s*PREVIEW_SESSION_EXPIRES_IN_SECONDS/)
    expect(src("src/collections/Users.ts")).toMatch(/tokenExpiration:\s*CMS_SESSION_EXPIRES_IN_SECONDS/)
  })

  it("keeps SMTP provider setup out of Payload boot", () => {
    const payloadConfig = src("src/payload.config.ts")

    expect(payloadConfig).not.toContain("@payloadcms/email-nodemailer")
    expect(payloadConfig).not.toContain("nodemailerAdapter")
    expect(payloadConfig).not.toMatch(/\bemail:\s*emailAdapter\b/)
    expect(payloadConfig).toContain("src/lib/email/sendEmail.ts")
  })

  it("uses a configurable magic-link rate limit for CMS and preview auth", () => {
    const helper = src("src/lib/auth/magicLinkRateLimit.ts")
    expect(helper).toContain("SIAB_MAGIC_LINK_RATE_LIMIT_MAX")
    expect(helper).toContain("DEFAULT_MAGIC_LINK_RATE_LIMIT_MAX = 10")

    expect(src("src/lib/betterAuth.ts")).toContain("rateLimit: getMagicLinkRateLimit()")
    expect(src("src/lib/preview/betterAuth.ts")).toContain("rateLimit: getMagicLinkRateLimit()")
  })
})
