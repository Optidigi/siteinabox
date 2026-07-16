import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { SitePageRenderer, v1FixturePage, v1FixtureSettings } from "@siteinabox/site-renderer"
import type { SiteSettings } from "@siteinabox/contracts"

const renderGenericSite = (settings: SiteSettings) =>
  renderToStaticMarkup(
    <SitePageRenderer
      page={{ ...v1FixturePage, blocks: [] }}
      settings={settings}
      includeThemeStyle={false}
    />,
  )

describe("generic site renderer maintenance banner", () => {
  it("renders the configured maintenance message without replacing the chrome banner", () => {
    const html = renderGenericSite({
      ...v1FixtureSettings,
      maintenance: {
        enabled: true,
        message: "We are updating this site tonight.",
        variant: "shadcnui-blocks.banner-02",
      },
    })

    expect(html).toContain('data-provider-variant="shadcnui-blocks.banner-01"')
    expect(html).toContain("Reusable chrome variants are available for generated sites.")
    expect(html).toContain('data-provider-variant="shadcnui-blocks.banner-02"')
    expect(html).toContain("We are updating this site tonight.")
  })

  it("omits maintenance chrome when maintenance is disabled", () => {
    const html = renderGenericSite({
      ...v1FixtureSettings,
      maintenance: {
        enabled: false,
        message: "Hidden maintenance message.",
      },
    })

    expect(html).not.toContain("data-siab-site-maintenance-banner")
    expect(html).not.toContain("Hidden maintenance message.")
    expect(html).toContain('data-provider-variant="shadcnui-blocks.banner-01"')
  })
})
