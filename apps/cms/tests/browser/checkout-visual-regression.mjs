/**
 * Deterministic evidence matrix for the checkout refactor. The output is
 * deliberately separate from canonical expectations: callers choose a fresh
 * CHECKOUT_VISUAL_MATRIX_DIR and review/promote images explicitly.
 */
export const checkoutVisualCases = Object.freeze([
  { id: "phone-320-light-en-domain-results", scenario: "domain-results", width: 320, height: 568, theme: "light", locale: "en" },
  { id: "phone-320-dark-en-declaration-block", scenario: "declaration-block", width: 320, height: 568, theme: "dark", locale: "en" },
  { id: "phone-320-dark-en-transfer-action", scenario: "fulfilment-action-transfer", width: 320, height: 568, theme: "dark", locale: "en" },
  { id: "phone-375-light-nl-review-ready", scenario: "review-ready", width: 375, height: 812, theme: "light", locale: "nl" },
  { id: "tablet-768-dark-nl-existing-ready", scenario: "existing-ready", width: 768, height: 900, theme: "dark", locale: "nl" },
  { id: "boundary-880-light-en-review-ready", scenario: "review-ready", width: 880, height: 900, theme: "light", locale: "en" },
  { id: "desktop-light-en-review-ready", scenario: "review-ready", width: 1280, height: 900, theme: "light", locale: "en" },
  { id: "desktop-light-en-review-ready-1440", scenario: "review-ready", width: 1440, height: 1000, theme: "light", locale: "en" },
  { id: "desktop-dark-en-existing-ready", scenario: "existing-ready", width: 1280, height: 900, theme: "dark", locale: "en" },
  { id: "desktop-dark-nl-payment-failed", scenario: "payment-failed", width: 1280, height: 900, theme: "dark", locale: "nl" },
  { id: "desktop-dark-en-fulfilment-complete", scenario: "fulfilment-complete", width: 1280, height: 900, theme: "dark", locale: "en" },
])

export const intentionalPrototypeDifferences = Object.freeze([
  "Repository preview/CMS chrome and real logo replace prototype chrome.",
  "The customer checkout presents the two required confirmations for Terms/Privacy and website approval.",
  "Server-owned quote/profile/domain data replaces prototype sample values and client calculations.",
  "The authoritative six-stage fulfilment projection replaces the prototype's shortened timeline.",
  "Repository semantic tokens, primitives, and Lucide icons replace prototype inline CSS and SVG.",
  "The development state picker and prototype theme/locale controls never enter customer UI.",
])

export const checkoutGeometry = async (page) => page.evaluate(() => {
  const visible = (selector) => {
    const node = document.querySelector(selector)
    return Boolean(node && node.getBoundingClientRect().width && node.getBoundingClientRect().height)
  }
  const mobileProgress = document.querySelector("[data-checkout-mobile-progress]")
  const shell = document.querySelector("[data-checkout-shell]")
  const domainInput = document.querySelector("#checkout-domain")
  const domainAction = document.querySelector("#checkout-domain-form button[type=submit]")
  return {
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    headingCount: document.querySelectorAll("h1").length,
    legalCheckboxCount: document.querySelectorAll('[role="checkbox"]').length,
    mobileActionVisible: visible("[data-checkout-action-bar]"),
    desktopSummaryVisible: visible("[data-checkout-summary]"),
    mobileProgressHeight: mobileProgress?.getBoundingClientRect().height ?? null,
    shellWidth: shell ? Math.round(shell.getBoundingClientRect().width) : null,
    domainInputHeight: domainInput ? Math.round(domainInput.getBoundingClientRect().height) : null,
    domainActionHeight: domainAction ? Math.round(domainAction.getBoundingClientRect().height) : null,
  }
})

export const assertCheckoutGeometry = (assert, visualCase, geometry) => {
  assert.equal(geometry.horizontalOverflow, false, `${visualCase.id} has horizontal overflow.`)
  assert.equal(geometry.headingCount, 1, `${visualCase.id} must have exactly one h1.`)
  const expectedShellWidth = visualCase.width >= 880
    ? Math.min(visualCase.width - 40, 1184)
    : visualCase.width < 560
      ? visualCase.width - 20
      : Math.min(visualCase.width - 28, 720)
  assert.equal(geometry.shellWidth, expectedShellWidth, `${visualCase.id} shell geometry drifted.`)
  if (visualCase.scenario.startsWith("domain") || visualCase.scenario.startsWith("existing")) {
    assert.equal(geometry.domainInputHeight, 48, `${visualCase.id} domain input must be 48px.`)
    assert.equal(geometry.domainActionHeight, visualCase.width < 560 ? 44 : 48, `${visualCase.id} domain action height drifted.`)
  }
  if (visualCase.width < 880) {
    assert.equal(geometry.desktopSummaryVisible, false, `${visualCase.id} exposes the desktop rail below 880px.`)
    if (geometry.mobileProgressHeight != null) {
      assert.ok(geometry.mobileProgressHeight <= 56, `${visualCase.id} progress exceeds 56px.`)
    }
  } else {
    assert.equal(geometry.mobileActionVisible, false, `${visualCase.id} exposes the mobile bar at/above 880px.`)
  }
  if (visualCase.scenario.startsWith("fulfilment-") || visualCase.scenario.startsWith("payment-")) {
    assert.equal(geometry.legalCheckboxCount, 0, `${visualCase.id} exposes editable legal controls during lifecycle.`)
  } else if (["review-ready", "declaration-block"].includes(visualCase.scenario)) {
    assert.equal(geometry.legalCheckboxCount, 2, `${visualCase.id} must expose exactly two legal controls.`)
  }
}
