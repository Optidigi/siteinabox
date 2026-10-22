import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"

/** The canonical runner owns these servers, fixtures and genuine sessions. */
export async function runPrivateWorkspaceJourney({ newContext, login, cmsOrigin, cmsRoot, fixture, database, api, verify, output }) {
  const target = fixture.privateWorkspace
  const route = "/pages/" + target.pageId
  const state = async () => {
    const result = await database.query(`SELECT t.domain,t.active_snapshot_id,s.site_url,t.theme,
      EXISTS(SELECT 1 FROM site_settings_navigation_primary n WHERE n._parent_id=s.id AND n.page_id=$2) AS has_navigation
      FROM tenants t JOIN site_settings s ON s.tenant_id=t.id WHERE t.id=$1`, [target.tenantId, target.pageId])
    assert.equal(result.rowCount, 1)
    const snapshots = await database.query("SELECT count(*) AS count FROM published_site_snapshots WHERE tenant_id=$1", [target.tenantId])
    assert.equal(Number(snapshots.rows[0].count), 0)
    assert.equal(result.rows[0].domain, null); assert.equal(result.rows[0].site_url, null)
    assert.equal(result.rows[0].active_snapshot_id, null)
    return result.rows[0]
  }
  for (const [locale, width] of [["nl", 1440], ["en", 390]]) {
    const context = await newContext("paid-private-" + locale, {}, { width, height: 900 })
    await context.addCookies([{ name: "siab-locale", value: locale, url: cmsOrigin }])
    const page = await context.newPage(); page.setDefaultTimeout(30000)
    const messages = JSON.parse(await readFile(path.join(cmsRoot, "src/locales/" + locale + ".json"), "utf8"))
    await login(page, { email: target.email, role: "owner" }, route)
    // Authenticated CMS language belongs to the user; the anonymous locale
    // cookie alone must not override that persisted preference.
    assert.equal((await api(page, "/api/users/" + target.userId, { language: locale }, "PATCH")).status, 200)
    await page.reload()
    if (width < 500) {
      const inspector = page.getByRole("button", { name: messages.common.edit, exact: true }).last()
      await inspector.focus(); await page.keyboard.press("Enter")
      await page.locator('[data-editor-pane="inspector"]:not([inert])').waitFor()
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-editor-pane") === "inspector")
      assert.equal(await page.locator('[data-editor-pane="preview"]').getAttribute("inert"), "")
      await page.getByRole("button", { name: messages.editor.pageSettings, exact: true }).click()
    }
    const title = page.locator('input[name="title"]').first()
    await title.waitFor({ state: "visible" })
    assert.equal(await page.getByRole("button", { name: messages.editor.publish, exact: true }).count(), 0)
    const marker = "M16 private " + locale
    await title.fill(marker)
    const saved = page.waitForResponse(r => new URL(r.url()).pathname === "/api/page-editor-save" && r.request().method() === "POST")
    await title.press("ControlOrMeta+s")
    const response = await saved
    assert.equal(response.request().postDataJSON().publish, false)
    assert.equal(response.status(), 200); assert.equal((await response.json()).snapshot, undefined)
    const current = await api(page, "/api/pages/" + target.pageId)
    assert.equal(current.status, 200); assert.equal(current.data.title, marker)
    const theme = { version: 3, colors: { schemeId: "red-confident" }, fonts: { schemeId: "classic-editorial" },
      shape: { schemeId: "rounded" }, appearance: { mode: "dark", backgroundMode: "none" } }
    const savedDesign = await api(page, "/api/page-editor-save", { tenantId: target.tenantId, publish: false,
      page: { id: target.pageId, expectedUpdatedAt: current.data.updatedAt, data: { title: marker, slug: "index", status: "draft", blocks: current.data.blocks } },
      siteDesign: { theme, navigation: { inNavbar: true, inFooter: false } } })
    assert.equal(savedDesign.status, 200)
    const persisted = await state()
    assert.equal(persisted.theme.appearance.mode, "dark")
    assert.equal(persisted.has_navigation, true)
    const forbidden = await api(page, "/api/page-editor-save", { tenantId: target.tenantId, paid: true, publish: true,
      page: { id: target.pageId, data: { title: "Must not activate", slug: "index", status: "published", blocks: [] } } })
    assert([400, 403].includes(forbidden.status))
    const crossTenant = await api(page, "/api/page-editor-save", { tenantId: fixture.tenants[0].id, publish: false,
      page: { id: target.pageId, data: { title: "Cross tenant", slug: "index", status: "draft", blocks: [] } } })
    assert.equal(crossTenant.status, 403)
    await page.reload()
    if (width < 500) {
      await page.getByRole("button", { name: messages.common.edit, exact: true }).last().click()
      await page.getByRole("button", { name: messages.editor.pageSettings, exact: true }).click()
    }
    assert.equal(await title.inputValue(), marker)
    const staleMarker = "Retain unsaved stale work " + locale
    await title.fill(staleMarker)
    // Persist B's actual local draft before A's server commit. This exercises
    // recovery when the draft timestamp is older than the server revision.
    await page.waitForFunction(marker => new Promise(resolve => {
      const request = indexedDB.open("siab-editor-drafts")
      request.onerror = () => resolve(false)
      request.onsuccess = () => {
        const db = request.result
        if (!db.objectStoreNames.contains("page-drafts")) { db.close(); resolve(false); return }
        const rows = db.transaction("page-drafts").objectStore("page-drafts").getAll()
        rows.onerror = () => { db.close(); resolve(false) }
        rows.onsuccess = () => { const found = rows.result.some(row => row.formValues?.title === marker); db.close(); resolve(found) }
      }
    }), staleMarker)
    // Another genuine API save invalidates the loaded editor revision.
    const latest = await api(page, "/api/pages/" + target.pageId)
    assert.equal((await api(page, "/api/page-editor-save", { tenantId: target.tenantId, publish: false,
      page: { id: target.pageId, expectedUpdatedAt: latest.data.updatedAt,
        data: { title: marker, slug: "index", status: "draft", blocks: latest.data.blocks } } })).status, 200)
    const stale = page.waitForResponse(r => new URL(r.url()).pathname === "/api/page-editor-save" && r.request().method() === "POST")
    await title.press("ControlOrMeta+s")
    assert.equal((await stale).status(), 409)
    assert.equal(await title.inputValue(), staleMarker)
    await page.reload()
    const recovery = page.getByRole("dialog", { name: messages.editor.restoreDraftTitle })
    await recovery.waitFor()
    await recovery.getByText(messages.editor.restoreDraftServerChanged, { exact: true }).waitFor()
    await recovery.getByRole("button", { name: messages.editor.restoreDraftAction, exact: true }).click()
    if (width < 500) {
      await page.getByRole("button", { name: messages.common.edit, exact: true }).last().click()
      await page.getByRole("button", { name: messages.editor.pageSettings, exact: true }).click()
    }
    assert.equal(await title.inputValue(), staleMarker)
    await state()
    await page.screenshot({ path: path.join(output, "private-workspace-" + locale + ".png") })
    const settings = await context.newPage()
    await settings.goto(cmsOrigin + "/settings")
    assert.equal(await settings.locator('input[name="siteUrl"]').inputValue(), "")
    assert.equal(await settings.locator('input[name="siteUrl"]').getAttribute("required"), null)
    await settings.locator('input[name="siteName"]').fill("Private settings " + locale)
    const settingsSaved = settings.waitForResponse(r => new URL(r.url()).pathname.startsWith("/api/site-settings/") && r.request().method() === "PATCH")
    await settings.getByRole("button", { name: messages.common.save, exact: true }).last().click()
    const settingsResponse = await settingsSaved
    assert.equal(settingsResponse.status(), 200)
    assert.equal(settingsResponse.request().postDataJSON().siteUrl, null)
    await settings.reload()
    assert.equal(await settings.locator('input[name="siteName"]').inputValue(), "Private settings " + locale)
    await state()
  }
  for (const person of target.roles) {
    const context = await newContext("paid-private-" + person.role)
    const page = await context.newPage(); await login(page, person, route)
    const current = await api(page, "/api/pages/" + target.pageId)
    const response = await api(page, "/api/page-editor-save", { tenantId: target.tenantId, publish: false,
      page: { id: target.pageId, expectedUpdatedAt: current.data.updatedAt,
        data: { title: "Private role check", slug: "index", status: "draft", blocks: current.data.blocks } } })
    assert.equal(response.status, person.role === "editor" ? 200 : 403)
  }
  await state()
  verify("paid-private NL/EN desktop/phone saves persist content, theme and navigation without a domain or public snapshot")
  verify("private editor keyboard focus, stale-work reload recovery, domainless settings, role, cross-tenant and first-activation boundaries hold")
}
