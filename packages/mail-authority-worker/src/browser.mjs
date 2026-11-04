import { mailApplicationResources } from "@siteinabox/contracts/microsoft-mail-authority"
import { chromium } from "playwright"
import { randomBytes } from "node:crypto"
import { base32, code } from "./totp.mjs"
export const UI_PROFILE = "partner-center-users-2026-11-04"
export function blocked() {
  const error = Error("WORKER_SECURITY_BLOCKED")
  error.code = "WORKER_SECURITY_BLOCKED"
  return error
}
const password = () => `Aa9!${randomBytes(32).toString("base64url")}`
const visible = (locator) => locator.filter({ visible: true })
async function one(locator) {
  const found = visible(locator)
  await found.first().waitFor({ state: "visible", timeout: 15000 })
  if ((await found.count()) !== 1) throw blocked()
  return found
}
async function press(page, name) {
  await (await one(page.getByRole("button", { name, exact: true }))).click()
}
async function selectChoice(page, combo, label) {
  const input = await one(combo)
  if ((await input.evaluate((e) => e.tagName)) === "SELECT")
    await input.selectOption({ label })
  else {
    await input.click()
    await (
      await one(page.getByRole("option", { name: label, exact: true }))
    ).click()
  }
}
async function field(page, id, value) {
  const input = await one(page.locator(`#${id} input`))
  const host = page.locator(`#${id}`)
  if ((await host.getAttribute("disabled")) !== null) throw blocked()
  await input.fill(value)
}
async function accountShown(page, account) {
  const origin = new URL(page.url()).origin
  if (origin === "https://login.microsoftonline.com") {
    if (
      (await (await one(page.locator("#displayName"))).textContent())
        .trim()
        .toLowerCase() !== account.toLowerCase()
    )
      throw blocked()
  } else if (
    origin === "https://mysignins.microsoft.com" ||
    origin === "https://admin.microsoft.com" ||
    origin === "https://admin.cloud.microsoft"
  ) {
    if (
      !(await visible(page.locator("#mectrl_currentAccount_secondary")).count())
    )
      await (await one(page.locator("#mectrl_main_trigger"))).click()
    if (
      (
        await (
          await one(page.locator("#mectrl_currentAccount_secondary"))
        ).textContent()
      )
        .trim()
        .toLowerCase() !== account.toLowerCase()
    )
      throw blocked()
  } else if (origin === "https://partner.microsoft.com") {
    const editor = await one(page.locator("#addoredit-email input"))
    if (
      (await editor.inputValue()).trim().toLowerCase() !== account.toLowerCase()
    )
      throw blocked()
  } else throw blocked()
}
function microsoftOrigin(url) {
  return [
    "https://login.microsoftonline.com",
    "https://mysignins.microsoft.com",
    "https://admin.microsoft.com",
    "https://admin.cloud.microsoft",
    "https://partner.microsoft.com",
  ].includes(new URL(url).origin)
}
/** Only normal, bounded browser interactions. No portal API scraping, ROPC or MFA policy changes. */
export class MicrosoftBootstrapBrowser {
  constructor(
    config,
    {
      launch = () => chromium.launch({ headless: true, chromiumSandbox: true }),
    } = {},
  ) {
    this.config = config
    this.launch = launch
    this.active = new Set()
  }
  async preflight() {
    const browser = await this.launch()
    try {
      const page = await browser.newPage()
      await page.goto("about:blank")
      return browser.version()
    } finally {
      await browser.close()
    }
  }
  async close() {
    await Promise.allSettled([...this.active].map((browser) => browser.close()))
  }
  async run(step, job, state, checkpoint = async () => {}) {
    const browser = await this.launch()
    this.active.add(browser)
    const deadline = setTimeout(() => browser.close().catch(() => {}), 120000)
    deadline.unref()
    try {
      const partner = step === "create_admin" || step === "promote_admin"
      const context = await browser.newContext({
        locale: "en-US",
        storageState: partner ? state.partnerSession : state.customerSession,
        acceptDownloads: false,
      })
      const page = await context.newPage()
      page.setDefaultTimeout(15000)
      const next = { ...state }
      const save = async () => {
        await checkpoint(next)
      }
      // Reject navigation to unexpected sites; never allow a provider to redirect secrets to another origin.
      await context.route("**/*", async (route) => {
        const request = route.request(),
          url = new URL(request.url())
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame() &&
          !microsoftOrigin(url.href) &&
          url.origin !== new URL(this.config.redirectUri).origin
        )
          return route.abort()
        return route.fallback()
      })
      try {
        const account = `siab-bootstrap-${job.id.slice(0, 12)}@${job.initialDomain}`
        if (step === "create_admin") {
          await page.goto(
            `https://partner.microsoft.com/dashboard/v2/customers/${job.tenantId}/users`,
          )
          await this.signIn(
            page,
            this.config.partnerAccount,
            this.config.partnerPassword,
            this.config.partnerTotpSeed,
            () => {
              throw blocked()
            },
          )
          await this.partnerBound(page, job)
          if (
            await visible(
              page.getByText(/authorization failed|Access Denied/i),
            ).count()
          )
            throw blocked()
          // Never adopt an existing administrator, even if its name happens to match.
          if (await visible(page.getByText(account, { exact: true })).count())
            throw blocked()
          await press(page, "Add user")
          await field(page, "addoredit-firstname", "Siteinabox")
          await field(page, "addoredit-lastname", "Bootstrap")
          await field(
            page,
            "addoredit-displayname",
            `SIAB bootstrap ${job.id.slice(0, 12)}`,
          )
          await field(page, "addoredit-email", account)
          const location = visible(
            page.getByRole("combobox", { name: "Location", exact: true }),
          )
          if (await location.count())
            await selectChoice(page, location, this.config.location)
          await press(page, "Next")
          // The account is created without selecting a subscription or assigning a paid licence.
          const licenses = await one(
            page.getByRole("group", { name: "Licenses", exact: true }),
          )
          if (
            (await licenses.locator("input:checked").count()) ||
            (await licenses.getByRole("checkbox", { checked: true }).count())
          )
            throw blocked()
          await press(page, "Next")
          await accountShown(page, account)
          await this.partnerBound(page, job)
          await accountShown(page, account)
          await press(page, "Add")
          const temporary = await one(
            page.getByLabel("Temporary password", { exact: true }),
          )
          const temporaryPassword = await temporary.inputValue()
          if (
            typeof temporaryPassword !== "string" ||
            temporaryPassword.length < 8 ||
            temporaryPassword.length > 256
          )
            throw blocked()
          next.account = account
          next.password = temporaryPassword
          await save()
          next.partnerSession = await context.storageState({ indexedDB: true })
        } else if (step === "promote_admin") {
          if (next.account !== account || !next.password) throw blocked()
          await page.goto(
            `https://partner.microsoft.com/dashboard/v2/customers/${job.tenantId}/users`,
          )
          await this.signIn(
            page,
            this.config.partnerAccount,
            this.config.partnerPassword,
            this.config.partnerTotpSeed,
            () => {
              throw blocked()
            },
          )
          await this.partnerBound(page, job)
          const row = await one(
            page
              .getByRole("row")
              .filter({ has: page.getByText(account, { exact: true }) }),
          )
          await (await one(row.getByRole("link"))).click()
          await accountShown(page, account)
          await press(page, "Edit permissions")
          await (
            await one(
              page.getByRole("checkbox", {
                name: "Global administrator",
                exact: true,
              }),
            )
          ).check()
          await this.partnerBound(page, job)
          await accountShown(page, account)
          await press(page, "Save")
          await accountShown(page, account)
          await (
            await one(page.getByText("Global administrator", { exact: true }))
          ).waitFor()
          next.promoted = true
          next.partnerSession = await context.storageState({ indexedDB: true })
        } else if (step === "secure_admin") {
          if (
            next.account !== account ||
            next.promoted !== true ||
            !next.password
          )
            throw blocked()
          await page.goto("https://mysignins.microsoft.com/security-info")
          await this.signIn(
            page,
            account,
            next.password,
            next.seed,
            async (replacement) => {
              next.previousPassword = next.password
              next.password = replacement
              await save()
            },
          )
          await accountShown(page, account)
          if (!next.seed) {
            const registration = await visible(
              page.getByText("I want to use a different authenticator app", {
                exact: true,
              }),
            ).count()
            if (!registration) {
              await press(page, "Add sign-in method")
              await selectChoice(
                page,
                page.getByRole("combobox"),
                "Microsoft Authenticator",
              )
              await press(page, "Add")
            }
            await (
              await one(
                page.getByText("I want to use a different authenticator app", {
                  exact: true,
                }),
              )
            ).click()
            await press(page, "Next")
            await (
              await one(page.getByText("Can't scan image?", { exact: true }))
            ).click()
            next.seed = await this.manualSeed(page, account)
            await save()
            await press(page, "Next")
            await (
              await one(
                page.getByRole("textbox", { name: "Enter code", exact: true }),
              )
            ).fill(code(base32(next.seed)))
            await press(page, "Next")
            if (
              await visible(
                page.getByRole("button", { name: "Done", exact: true }),
              ).count()
            )
              await press(page, "Done")
            await page.waitForURL(
              "https://mysignins.microsoft.com/security-info",
              { waitUntil: "load" },
            )
            await (
              await one(page.getByText("Authenticator app", { exact: true }))
            ).waitFor()
          }
          // A fresh isolated sign-in proves the enrolled factor, rather than inferring success from setup UI.
          const fresh = await browser.newContext({
            locale: "en-US",
            acceptDownloads: false,
          })
          const proof = await fresh.newPage()
          try {
            await proof.goto("https://mysignins.microsoft.com/security-info")
            const authentication = await this.signIn(
              proof,
              account,
              next.password,
              next.seed,
              () => {
                throw blocked()
              },
            )
            if (!authentication.mfaSatisfied) throw blocked()
            await accountShown(proof, account)
            await (
              await one(proof.getByText("Authenticator app", { exact: true }))
            ).waitFor()
            next.customerSession = await fresh.storageState({ indexedDB: true })
          } finally {
            await fresh.close()
          }
          delete next.previousPassword
          next.securityVerified = true
        } else if (step === "approve_gdap") {
          if (next.account !== account || next.securityVerified !== true)
            throw blocked()
          await page.goto(
            `https://admin.microsoft.com/AdminPortal/Home#/partners/invitation/granularAdminRelationships/${job.targetRelationshipId}`,
          )
          await this.signIn(page, account, next.password, next.seed, () => {
            throw blocked()
          })
          await accountShown(page, account)
          await (
            await one(page.getByText(`SIAB mail ${job.runId}`, { exact: true }))
          ).waitFor()
          for (const role of [
            "User Administrator",
            "License Administrator",
            "Domain Name Administrator",
            "Exchange Administrator",
            "Cloud Application Administrator",
          ])
            await (await one(page.getByText(role, { exact: true }))).waitFor()
          if (
            !new URL(page.url()).hash.endsWith(
              "/granularAdminRelationships/" + job.targetRelationshipId,
            )
          )
            throw blocked()
          await accountShown(page, account)
          await press(page, "Approve all")
          await (
            await one(page.getByText(/relationship.*(approved|accepted)/i))
          ).waitFor()
          next.relationshipId = job.targetRelationshipId
          next.approved = true
          next.customerSession = await context.storageState({ indexedDB: true })
        } else if (step === "consent_application") {
          if (
            next.approved !== true ||
            next.relationshipId !== job.targetRelationshipId
          )
            throw blocked()
          for (const resource of mailApplicationResources) {
            await this.consentResource(
              page,
              context,
              job,
              account,
              next,
              resource,
            )
            next.consentedResources = [
              ...new Set([
                ...(next.consentedResources ?? []),
                resource.resource,
              ]),
            ]
            await save()
          }
          next.consented = true
          next.customerSession = await context.storageState({ indexedDB: true })
        } else if (step === "verify_completion") {
          if (
            next.account !== account ||
            next.securityVerified !== true ||
            next.approved !== true ||
            next.consented !== true ||
            next.relationshipId !== job.targetRelationshipId
          )
            throw blocked()
          // The CMS independently verifies live GDAP assignments and resource grants before workload writes.
          delete next.partnerSession
          delete next.customerSession
          next.finishedAt = new Date().toISOString()
        } else throw blocked()
        return next
      } finally {
        await context.close()
      }
    } finally {
      clearTimeout(deadline)
      try {
        await browser.close()
      } finally {
        this.active.delete(browser)
      }
    }
  }
  async consentResource(page, context, job, account, state, resource) {
    const stateToken = randomBytes(24).toString("base64url"),
      redirect = new URL(this.config.redirectUri)
    let receipt = false,
      acknowledge
    const acknowledgement = new Promise((resolve) => {
      acknowledge = resolve
    })
    const requested = resource.scopes.map(
      (scope) => resource.scopePrefix + "/" + scope,
    )
    await context.route(redirect.origin + "/**", async (route) => {
      const url = new URL(route.request().url())
      const granted = (url.searchParams.get("scope") ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((scope) =>
          scope.startsWith(resource.scopePrefix + "/")
            ? scope.slice(resource.scopePrefix.length + 1)
            : scope,
        )
        .sort()
      if (
        url.origin === redirect.origin &&
        url.pathname === redirect.pathname &&
        url.searchParams.get("state") === stateToken &&
        url.searchParams.get("tenant")?.toLowerCase() ===
          job.tenantId.toLowerCase() &&
        url.searchParams.get("admin_consent")?.toLowerCase() === "true" &&
        JSON.stringify(granted) === JSON.stringify([...resource.scopes].sort())
      ) {
        receipt = true
        acknowledge()
      }
      await route.abort()
    })
    const url = new URL(
      `https://login.microsoftonline.com/${job.tenantId}/v2.0/adminconsent`,
    )
    url.searchParams.set("client_id", job.applicationId)
    url.searchParams.set("redirect_uri", redirect.href)
    url.searchParams.set("state", stateToken)
    url.searchParams.set("scope", requested.join(" "))
    url.searchParams.set("mkt", "en-US")
    await page.goto(url.href).catch(() => {
      if (!receipt) throw blocked()
    })
    if (!receipt) {
      await this.signIn(page, account, state.password, state.seed, () => {
        throw blocked()
      })
      await accountShown(page, account)
      await (
        await one(page.getByText(this.config.applicationName, { exact: true }))
      ).waitFor()
      const labels = (
        await page.locator('.scope > [role="button"]').allTextContents()
      )
        .map((label) => label.trim())
        .sort()
      if (
        JSON.stringify(labels) !==
        JSON.stringify(
          [...this.config.consentPermissionLabels[resource.resource]].sort(),
        )
      )
        throw blocked()
      const organization = visible(
        page.getByRole("checkbox", {
          name: "Consent on behalf of your organization",
          exact: true,
        }),
      )
      if (await organization.count()) await organization.check()
      await accountShown(page, account)
      await press(page, "Accept")
      let timer
      try {
        await Promise.race([
          acknowledgement,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(blocked()), 15000)
          }),
        ])
      } finally {
        clearTimeout(timer)
      }
    }
    if (!receipt) throw blocked()
  }
  async partnerBound(page, job) {
    const u = new URL(page.url())
    if (
      u.origin !== "https://partner.microsoft.com" ||
      u.pathname !== `/dashboard/v2/customers/${job.tenantId}/users`
    )
      throw blocked()
  }
  async signIn(page, account, currentPassword, seed, changePassword) {
    let enteredPassword = currentPassword
    const used = new Set()
    let mfaSatisfied = false
    const once = (action) => {
      if (used.has(action)) throw blocked()
      used.add(action)
    }
    for (let attempt = 0; attempt < 18; attempt++) {
      if (!microsoftOrigin(page.url())) throw blocked()
      if (!page.url().startsWith("https://login.microsoftonline.com/"))
        return { mfaSatisfied }
      const picker = visible(
        page.getByRole("button", {
          name: `Sign in with ${account} work or school account.`,
          exact: true,
        }),
      )
      if (await picker.count()) {
        once("account_picker")
        await (await one(picker)).click()
        await picker.waitFor({ state: "hidden" })
      } else if (
        await visible(page.locator('input[name="loginfmt"]')).count()
      ) {
        once("username")
        await (await one(page.locator('input[name="loginfmt"]'))).fill(account)
        await press(page, "Next")
        await page
          .locator('input[name="loginfmt"]')
          .waitFor({ state: "hidden" })
      } else if (await visible(page.locator('input[name="passwd"]')).count()) {
        once("password")
        await accountShown(page, account)
        await this.passwordForm(page, 'input[name="passwd"]')
        await (
          await one(page.locator('input[name="passwd"]'))
        ).fill(enteredPassword)
        await accountShown(page, account)
        await this.passwordForm(page, 'input[name="passwd"]')
        await this.submitForm(page, 'input[name="passwd"]', account)
        await page.locator('input[name="passwd"]').waitFor({ state: "hidden" })
      } else if (
        await visible(page.locator('input[name="newpasswd"]')).count()
      ) {
        once("password_change")
        await accountShown(page, account)
        await this.passwordForm(page, 'input[name="newpasswd"]')
        const replacement = password()
        await changePassword(replacement)
        await page.locator('input[name="currentpasswd"]').fill(enteredPassword)
        await page.locator('input[name="newpasswd"]').fill(replacement)
        await page.locator('input[name="confirmnewpasswd"]').fill(replacement)
        enteredPassword = replacement
        await accountShown(page, account)
        await this.passwordForm(page, 'input[name="newpasswd"]')
        await this.submitForm(page, 'input[name="newpasswd"]', account)
        await page
          .locator('input[name="newpasswd"]')
          .waitFor({ state: "hidden" })
      } else if (await visible(page.locator("#idTxtBx_SAOTCC_OTC")).count()) {
        once("otp")
        if (!seed) throw blocked()
        await accountShown(page, account)
        await this.passwordForm(page, "#idTxtBx_SAOTCC_OTC")
        await page.locator("#idTxtBx_SAOTCC_OTC").fill(code(base32(seed)))
        await accountShown(page, account)
        await this.passwordForm(page, "#idTxtBx_SAOTCC_OTC")
        await this.submitForm(page, "#idTxtBx_SAOTCC_OTC", account)
        await page.locator("#idTxtBx_SAOTCC_OTC").waitFor({ state: "hidden" })
        mfaSatisfied = true
      } else if (
        await visible(
          page.getByText("More information required", { exact: true }),
        ).count()
      ) {
        once("security_registration")
        await press(page, "Next")
      } else if (
        await visible(
          page.getByRole("button", { name: "No", exact: true }),
        ).count()
      ) {
        once("stay_signed_in")
        await press(page, "No")
      } else if (
        await visible(
          page.getByRole("button", { name: "Accept", exact: true }),
        ).count()
      )
        return { mfaSatisfied }
      else throw blocked()
      await page.waitForLoadState("domcontentloaded")
    }
    throw blocked()
  }
  async submitForm(page, selector, account) {
    await accountShown(page, account)
    await this.passwordForm(page, selector)
    const form = await one(
      page.locator("form").filter({ has: page.locator(selector) }),
    )
    await (
      await one(
        form.locator(
          'input[type="submit"],button[type="submit"],button:not([type])',
        ),
      )
    ).click()
  }
  async passwordForm(page, selector) {
    const valid = await page.locator(selector).evaluate((e) => {
      const f = e.form
      if (!f) return false
      const view = e.ownerDocument.defaultView
      if (
        view.top !== view.self ||
        view.location.origin !== "https://login.microsoftonline.com"
      )
        return false
      const u = new URL(f.action)
      return (
        f.method.toLowerCase() === "post" &&
        u.origin === "https://login.microsoftonline.com" &&
        ["", "_self", "_top"].includes(f.target) &&
        !f.querySelector("[formaction],[formmethod],[formtarget]")
      )
    })
    if (!valid) throw blocked()
  }
  async manualSeed(page, account) {
    const url = new URL(page.url())
    if (
      url.origin !== "https://mysignins.microsoft.com" ||
      !["/security-info", "/register"].includes(url.pathname)
    )
      throw blocked()
    await accountShown(page, account)
    const raw = await page
      .locator('[data-testid="activation-url/key"]')
      .evaluate((element, expected) => {
        const table = element.closest("table")
        if (!table || !element.checkVisibility()) return null
        const label = table.querySelector(
          '[data-testid="activation-url/key-label"]',
        )
        if (label?.textContent.trim() !== "Secret key:") return null
        const row = [...table.querySelectorAll("tr")].find(
          (row) => row.cells?.[0]?.textContent.trim() === "Account name:",
        )
        if (!row || !row.cells[1]) return null
        const labelValue = row.cells[1].textContent.trim()
        const name = labelValue.includes(":")
          ? labelValue.slice(labelValue.lastIndexOf(":") + 1)
          : labelValue
        if (name.toLowerCase() !== expected.toLowerCase()) return null
        const value = element.textContent.trim()
        return /^[A-Za-z2-7]+={0,6}$/.test(value) ? value.toUpperCase() : null
      }, account)
    if (!raw) throw blocked()
    base32(raw)
    return raw
  }
}
