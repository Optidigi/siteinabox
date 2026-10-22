import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"

/** M14 extends the canonical built-app runner; no second server or route mocks. */
export async function runVerifiedCustomerJourney(harness) {
  const { newContext, cmsOrigin, cmsRoot, env, fixture, database, api, rememberCookies, secrets, output, verify, control } = harness
  const pages = []
  const email = fixture.freeEmail
  const marker = "Maak mijn website. M14 durable workspace marker"
  const accountState = async () => {
    const result = await database.query(`SELECT a.id, a.verified_at, a.tenant_id, b.customer_account_id, b.display_name,
      b.messages, b.client_slug, t.domain FROM customer_accounts a
      JOIN builder_sessions b ON b.customer_email=a.email LEFT JOIN tenants t ON t.id=a.tenant_id WHERE a.email=$1`, [email])
    assert.equal(result.rowCount, 1)
    return { ...result.rows[0], verified_at: result.rows[0].verified_at.toISOString() }
  }
  async function capturedLink(before) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const files = (await readdir(env.DATA_DIR)).filter(name => /^mail-[\w-]+\.json$/.test(name) && !before.has(name))
      if (files.length) {
        assert.equal(files.length, 1, "One user request must produce one captured verification message")
        const { verificationURL } = JSON.parse(await readFile(path.join(env.DATA_DIR, files[0]), "utf8"))
        const url = new URL(verificationURL)
        assert.equal(url.origin, cmsOrigin)
        assert.equal(url.pathname, "/api/preview-auth/magic-link/verify")
        const token = url.searchParams.get("token")
        assert(token && token.length >= 16)
        secrets.add(url.href); secrets.add(token)
        return url.href
      }
      await delay(250)
    }
    throw new Error("The explicit mail double did not capture a verification link")
  }
  let original
  for (const [index, [locale, width]] of [["nl", 1440], ["en", 390], ["nl", 390], ["en", 1440]].entries()) {
    const context = await newContext("free-" + locale + "-" + width, {}, { width, height: width < 500 ? 844 : 1000 })
    await context.addCookies([{ name: "siab-locale", value: locale, url: cmsOrigin }])
    const page = await context.newPage(); page.setDefaultTimeout(30000)
    const messages = JSON.parse(await readFile(path.join(cmsRoot, "src/locales/" + locale + ".json"), "utf8"))
    const response = await page.goto(cmsOrigin + "/login" + (index === 0 ? "?intent=register" : ""))
    assert.equal(await page.evaluate(() => innerWidth), width)
    assert.equal((await response.serverAddr()).ipAddress, "127.0.0.1")
    await page.getByRole("heading", { name: index === 0 ? messages.auth.createAccount : messages.auth.signIn, exact: true }).waitFor()
    await page.screenshot({ path: path.join(output, "identity-login-" + locale + "-" + width + ".png") })
    if (index === 0) {
      await page.locator('input[name="displayName"]').fill("Unverified replacement must not overwrite saved work")
      await page.getByRole("checkbox").nth(0).check(); await page.getByRole("checkbox").nth(1).check()
    }
    await page.locator('input[name="email"]').fill(email)
    const before = new Set(await readdir(env.DATA_DIR))
    const button = page.getByRole("button", { name: index === 0 ? messages.auth.sendRegisterLink : messages.auth.continueWithMagicLink, exact: true })
    await button.focus(); await page.keyboard.press("Enter")
    const link = await capturedLink(before)
    await page.getByRole("status").filter({ hasText: messages.auth.magicLinkGenericSuccess }).waitFor()
    if (index === 0) {
      const duplicate = await Promise.all(Array.from({ length: 4 }, () => api(page,
        "/api/preview-auth/sign-in/magic-link", { email, callbackURL: "/builder", errorCallbackURL: "/login" })))
      assert(duplicate.every(result => result.status === 200))
      assert.equal((await readdir(env.DATA_DIR)).filter(name => /^mail-[\w-]+\.json$/.test(name) && !before.has(name)).length, 1)
      const unsafe = new URL(link); unsafe.searchParams.set("callbackURL", "/builder/another-account")
      await page.goto(unsafe.href)
      assert.equal(new URL(page.url()).pathname, "/login")
      await page.getByRole("alert").filter({ hasText: messages.auth.magicLinkSession }).waitFor()
      assert(await page.getByRole("button", { name: messages.auth.continueWithMagicLink, exact: true }).isEnabled())
      verify("simultaneous account-link replays retain one delivery and reject callback substitution before consumption")
    }
    await page.goto(link); await page.waitForURL(url => url.pathname === "/builder" || url.pathname.startsWith("/builder/"))
    const replay = await context.newPage()
    await replay.goto(link)
    assert.equal(new URL(replay.url()).pathname, "/login")
    await replay.getByRole("alert").filter({ hasText: messages.auth.magicLinkSession }).waitFor()
    assert(await replay.getByRole("button", { name: messages.auth.continueWithMagicLink, exact: true }).isEnabled())
    await replay.close()
    await page.getByRole("textbox", { name: messages.auth.customerMessage }).waitFor()
    await rememberCookies(context)
    if (index === 0) {
      const initial = await accountState()
      assert.equal(initial.customer_account_id, initial.id)
      assert.equal(initial.display_name, "M14 Free customer", "Registration cannot overwrite an existing saved brief")
      await control("unverify")
      assert.equal((await api(page, "/api/builder/chat", { message: "Must not dispatch for an unverified account" })).status, 403)
      await control("restore-verification")
      assert.equal((await accountState()).verified_at, initial.verified_at)
      const composer = page.getByRole("textbox", { name: messages.auth.customerMessage })
      await composer.fill(marker)
      const saved = page.waitForResponse(r => new URL(r.url()).pathname === "/api/builder/chat" && r.request().method() === "POST")
      await composer.press("Enter")
      const result = await saved
      assert.equal(result.status(), 200)
      assert.equal((await result.json()).applied, true, "The existing mock generation path must apply a private workspace")
      original = await accountState()
      assert(original.tenant_id, "The generated website must bind to the verified account")
      assert(original.messages.some(message => message.role === "user" && message.text === marker))
      assert.equal(original.verified_at, initial.verified_at)
      const maintained = await api(page, "/api/builder/chat", { message: "Maak het thema groen en donker." })
      assert.equal(maintained.status, 200)
      assert.equal(maintained.data.applied, true, "The returning customer must execute the guarded maintainer path")
      const theme = await database.query("SELECT theme FROM tenants WHERE id=$1", [original.tenant_id])
      assert.equal(theme.rows[0].theme.appearance.mode, "dark")
      assert.equal((await accountState()).verified_at, initial.verified_at)
      verify("returning customer applies a local maintainer theme change without losing workspace authority")
    } else {
      const state = await accountState()
      assert.equal(state.id, original.id); assert.equal(state.verified_at, original.verified_at)
      assert.equal(state.tenant_id, original.tenant_id)
      await page.getByText(marker, { exact: true }).waitFor()
    }
    await page.screenshot({ path: path.join(output, "identity-workspace-" + locale + "-" + width + ".png") })
    pages.push({ page, context })
  }
  assert.equal(Number((await database.query("SELECT count(*) AS count FROM customer_accounts WHERE email=$1", [email])).rows[0].count), 1)
  assert.equal(Number((await database.query("SELECT count(*) AS count FROM builder_sessions WHERE customer_email=$1", [email])).rows[0].count), 1)
  assert.equal((await api(pages[0].page, "/api/builder/chat", { message: "Forged tenant", tenantId: fixture.tenants[1].id })).status, 400)
  assert.equal((await api(pages[0].page, "/api/customer-accounts/" + original.id, { verifiedAt: "2099-01-01T00:00:00Z" }, "PATCH")).status, 403)
  const ownReturn = await pages[0].page.goto(cmsOrigin + "/builder/not-this-customers-site")
  assert.equal(new URL(ownReturn.url()).pathname, "/builder", "Unknown slugs must redirect to the owned root")
  await pages[0].page.waitForURL(url => url.pathname === "/builder" || url.pathname === "/builder/" + original.client_slug)
  await pages[0].page.getByText(marker, { exact: true }).waitFor()
  assert.equal((await pages[0].page.locator("body").innerText()).includes(fixture.pages[1].title), false)
  verify("verified free account resumes one private workspace and original anchor across NL/EN desktop/phone sessions")
  verify("unverified and substituted identity/tenant requests deny before private mutation or generation")
  return {
    accountId: original.id,
    tenantId: original.tenant_id,
    domain: original.domain,
    async afterRestart() {
      for (const { page } of pages) {
        await page.reload(); await page.getByText(marker, { exact: true }).waitFor()
      }
      const current = await accountState()
      assert.equal(current.id, original.id); assert.equal(current.verified_at, original.verified_at)
      assert.equal(current.tenant_id, original.tenant_id)
      verify("free identity, session and workspace return after restart without resetting the verification anchor")
    },
    async assertRevoked() {
      const before = await accountState()
      for (const { page, context } of pages) {
        await rememberCookies(context)
        await page.goto(cmsOrigin + "/builder"); await page.waitForURL(url => url.pathname === "/login")
        assert([401, 403].includes((await api(page, "/api/builder/chat", { message: "Revoked session must not mutate" })).status))
      }
      assert.deepEqual((await accountState()).messages, before.messages)
      assert.equal((await accountState()).verified_at, original.verified_at)
      const mailFiles = (await readdir(env.DATA_DIR)).filter(name => /^mail-[\w-]+\.json$/.test(name)).length
      assert.equal((await api(pages[0].page, "/api/preview-auth/sign-in/magic-link", { email, callbackURL: "/builder" })).status, 200)
      assert.equal((await readdir(env.DATA_DIR)).filter(name => /^mail-[\w-]+\.json$/.test(name)).length, mailFiles)
      verify("account revocation denies all existing device sessions without replacing identity or mutating saved work")
    },
  }
}
