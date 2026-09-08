import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8")

describe("legacy /intake builder handoff", () => {
  it("redirects production /intake to the preview builder, not localhost", () => {
    const page = read("../src/pages/index.astro")
    const nginx = read("../nginx.conf")

    expect(page).toContain("Astro.redirect(builderUrl, 302)")
    expect(page).toContain("https://preview.siteinabox.nl/builder?intent=register")
    expect(page).toContain("import.meta.env.PROD")
    expect(page).not.toContain("import.meta.env.DEV")
    expect(nginx).toContain("return 302 https://preview.siteinabox.nl/builder?intent=register;")
    expect(nginx).toContain("location = /intake")
    expect(nginx).toContain("location ^~ /intake/")
  })
})
