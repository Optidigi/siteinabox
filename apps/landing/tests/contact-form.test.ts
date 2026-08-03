import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = resolve(import.meta.dirname, "../../..")
const contactForm = readFileSync(resolve(repoRoot, "apps/landing/src/components/forms/ContactForm.astro"), "utf8")
const turnstile = readFileSync(resolve(repoRoot, "apps/landing/src/components/forms/Turnstile.astro"), "utf8")
const nginxConfig = readFileSync(resolve(repoRoot, "apps/landing/nginx.conf"), "utf8")

describe("landing contact form", () => {
  it("posts to the CMS platform contact endpoint instead of Web3Forms", () => {
    expect(contactForm).toContain('action="/api/contact"')
    expect(contactForm).toContain('name="source"')
    expect(contactForm).not.toContain("api.web3forms.com")
    expect(contactForm).not.toContain("PUBLIC_WEB3FORMS_KEY")
    expect(contactForm).not.toContain("data-siab-simulate")
  })

  it("does not allow Web3Forms in the landing CSP", () => {
    expect(nginxConfig).not.toContain("api.web3forms.com")
  })

  it("uses a public Turnstile site key and the platform contact action", () => {
    expect(turnstile).toContain("PUBLIC_TURNSTILE_SITE_KEY")
    expect(turnstile).toContain('data-action="platform-contact"')
    expect(turnstile).toContain("challenges.cloudflare.com/turnstile/v0/api.js")
    expect(turnstile).not.toContain("TURNSTILE_SECRET_KEY")
    expect(contactForm).toContain('name="cf-turnstile-response"')
  })

  it("allows only the Turnstile origins required by the widget", () => {
    expect(nginxConfig).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com")
    expect(nginxConfig).toContain("frame-src https://challenges.cloudflare.com")
  })
})
