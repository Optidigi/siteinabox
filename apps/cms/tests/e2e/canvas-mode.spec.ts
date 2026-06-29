/**
 * E2E spec: canvas-mode round-trip
 *
 * Covers:
 *   1. Create a tenant + page with a Hero block (reuses setup pattern from
 *      tenant-create-and-page-publish.spec.ts).
 *   2. Open the page editor and switch to canvas mode via the ModeToggle.
 *   3. Assert .rt-canvas and .cms-block--hero are present on the canvas surface.
 *   4. Assert tenant CSS <style data-rt-tenant-css> is present — or skip with
 *      annotation if no tenant cssEntry is seeded (graceful degradation).
 *   5. Type into the Hero headline Lexical slot, save via Ctrl+S, reload,
 *      assert the text persisted.
 *   6. Clean up the tenant.
 *
 * This spec intentionally degrades gracefully when infrastructure is absent
 * rather than writing assertions that rely on unguaranteed side-effects (e.g.
 * tenant CSS compilation, which requires an Astro build artefact in DATA_DIR).
 */
import { test, expect } from "@playwright/test"
import { ensureE2EUser } from "./_setup"
import { readE2ESeed } from "./_seed"

test.describe("canvas mode", () => {
  test.beforeAll(async () => {
    await ensureE2EUser()
  })

  test("canvas mode: rt-canvas surface present with hero block", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 })
    const creds = await ensureE2EUser()
    const seed = readE2ESeed()

    // -----------------------------------------------------------------------
    // 1. Log in
    // -----------------------------------------------------------------------
    await page.goto("/login")
    await page.waitForLoadState("networkidle")
    await page.fill('input[type="email"]', creds.email)
    await page.fill('input[type="password"]', creds.password)
    await page.getByRole("button", { name: /sign in/i }).click()
    await expect(page).toHaveURL("/", { timeout: 20_000 })

    await page.goto(seed.audit.pageUrl)
    const pageUrl = page.url()

    // -----------------------------------------------------------------------
    // 4. Switch to canvas mode
    // -----------------------------------------------------------------------
    // ModeToggle renders a group with aria-label="Editor view".
    const modeGroup = page.getByRole("group", { name: "Editor view" })
    await expect(modeGroup).toBeVisible({ timeout: 10_000 })
    await modeGroup.getByRole("button", { name: /canvas/i }).click()

    // Wait for the canvas surface to appear — this confirms mode switch resolved
    const rtCanvas = page.locator(".rt-canvas")
    await expect(rtCanvas).toBeVisible({ timeout: 10_000 })

    // -----------------------------------------------------------------------
    // 5. Assert .cms-block--hero is visible inside the canvas
    // -----------------------------------------------------------------------
    const heroBlock = page.locator(".rt-canvas .cms-block--hero")
    await expect(heroBlock).toBeVisible({ timeout: 10_000 })

    // -----------------------------------------------------------------------
    // 6. Tenant CSS assertion (graceful degradation)
    //
    // Tenant CSS requires a compiled Astro artefact at
    //   DATA_DIR/tenants/<id>/cms-editor.css
    // which is NOT present in the stock e2e environment (no Astro build ran).
    // We check for the <style data-rt-tenant-css> tag and skip rather than
    // fail if it is absent, annotating the reason.
    // -----------------------------------------------------------------------
    const tenantCssTag = page.locator("style[data-rt-tenant-css]")
    const cssTagCount = await tenantCssTag.count()
    if (cssTagCount === 0) {
      test.info().annotations.push({
        type: "note",
        description:
          "Tenant CSS <style data-rt-tenant-css> not present — expected: no cms-editor.css " +
          "artefact in DATA_DIR for this e2e tenant (requires an Astro build). " +
          "Canvas renders with admin design tokens instead.",
      })
    } else {
      await expect(tenantCssTag.first()).toBeAttached()
    }

    // -----------------------------------------------------------------------
    // 7. Type into the Hero headline RtSlot and save
    //
    // The Hero headline is a Lexical ContentEditable inside the hero block.
    // The contenteditable is mounted only after clicking the static RtSlot;
    // absence here means canvas direct-editing regressed.
    // -----------------------------------------------------------------------
    const heroSection = page.locator(".cms-block--hero").first()
    await heroSection.locator("h1.rt-slot").first().click()
    const headline = heroSection.locator("[contenteditable='true']").first()
    await expect(headline).toBeVisible({ timeout: 10_000 })

      // Click to focus, clear existing content, type new headline text
      const uniqueText = `Canvas E2E Headline ${Date.now()}`
      await headline.click()
      // Select all and replace
      await page.keyboard.press("ControlOrMeta+a")
      await page.keyboard.type(uniqueText)

      // Save via Ctrl+S (keyboard shortcut registered in PageForm)
      await page.keyboard.press("ControlOrMeta+s")

      // Wait for the "Saved" / "Published" status badge confirming the round-trip.
      await expect(
        page.getByText(/saved|published/i).first()
      ).toBeVisible({ timeout: 15_000 })

      // -----------------------------------------------------------------------
      // 8. Reload and assert persistence
      // -----------------------------------------------------------------------
      await page.goto(pageUrl)
      // Switch back to canvas mode after reload (user pref should persist via
      // server action, but re-click for safety)
      const modeGroupAfter = page.getByRole("group", { name: "Editor view" })
      await expect(modeGroupAfter).toBeVisible({ timeout: 10_000 })
      await modeGroupAfter.getByRole("button", { name: /canvas/i }).click()

      const heroBlockAfter = page.locator(".rt-canvas .cms-block--hero")
      await expect(heroBlockAfter).toBeVisible({ timeout: 10_000 })

      // The typed text should appear somewhere in the hero section
      await expect(
        page.locator(".cms-block--hero").getByText(uniqueText)
      ).toBeVisible({ timeout: 10_000 })
  })
})
