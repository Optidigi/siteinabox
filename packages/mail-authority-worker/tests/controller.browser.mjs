import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium } from "playwright"
import { createMailBootstrapJob } from "@siteinabox/contracts/microsoft-mail-authority"
import { MicrosoftBootstrapBrowser } from "../src/browser.mjs"
import { WorkerStore, advanceJob } from "../src/worker.mjs"
import { base32, code } from "../src/totp.mjs"
const job = createMailBootstrapJob({
  runId: "42",
  orderId: "9",
  tenantId: "00000000-0000-4000-8000-000000000002",
  initialDomain: "fixture.onmicrosoft.com",
  domain: "fixture.test",
  applicationId: "00000000-0000-4000-8000-000000000003",
  partnerTenantId: "00000000-0000-4000-8000-000000000001",
  groupId: "00000000-0000-4000-8000-000000000004",
  sourceRelationshipId: "default",
  targetRelationshipId: "full",
})
const account = `siab-bootstrap-${job.id.slice(0, 12)}@${job.initialDomain}`
const permissions = [
  "Directory read",
  "Organization read",
  "Domain write",
  "User write",
  "License write",
  "Exchange manage",
]
const config = {
  partnerAccount: "operator@partner.test",
  partnerPassword: "synthetic-partner-password",
  partnerTotpSeed: "GEZDGNBVGY3TQOJQ",
  location: "Netherlands",
  redirectUri:
    "https://admin.fixture.test/operations/microsoft-mail/consent/callback",
  applicationName: "Siteinabox mail",
  consentPermissionLabels: {
    graph: permissions.slice(0, 5),
    exchange: permissions.slice(5),
  },
}
const identity = `<span id="mectrl_currentAccount_secondary">${account}</span>`
const email = `<div id="addoredit-email"><input aria-label="Email" value="${account}"></div>`
const seed = "GEZDGNBVGY3TQOJQ"
const redirectTo = (route, url) =>
  route.fulfill({
    contentType: "text/html",
    body: `<script>location.replace(${JSON.stringify(url)})</script>`,
  })
const form = (action, body) =>
  `<form method="post" action="https://login.microsoftonline.com${action}"><span id="displayName">${account}</span>${body}</form>`
async function fixtureLaunch(
  currentStep,
  effects,
  {
    rejectOtp = false,
    wrongEditor = false,
    extraPermission = false,
    deny = false,
    selectedLicense = false,
    freshWithoutMfa = false,
    showAccountPicker = false,
    swapPasswordIdentity = false,
  } = {},
) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE localhost"],
  })
  const original = browser.newContext.bind(browser)
  let contexts = 0
  browser.newContext = async (options) => {
    const context = await original(options)
    const number = ++contexts
    let authenticated = false
    await context.route("**/*", async (route) => {
      const req = route.request(),
        u = new URL(req.url())
      let html = ""
      const post = new URLSearchParams(req.postData() ?? "")
      if (u.hostname === "partner.microsoft.com") {
        if (deny)
          html = "<p>Access Denied. Caller should have a valid entra role.</p>"
        else if (currentStep === "create_admin")
          html = `<button onclick="document.querySelector('#wizard').hidden=false">Add user</button><div id=wizard hidden><div id=addoredit-firstname><input></div><div id=addoredit-lastname><input></div><div id=addoredit-displayname><input></div><div id=addoredit-email><input></div><fieldset aria-label=Licenses><label><input type=checkbox ${selectedLicense ? "checked" : ""}>Existing product</label></fieldset><button onclick="window.stage=(window.stage??0)+1;if(window.stage===2)document.querySelector('#create').hidden=false">Next</button><button id=create hidden onclick="fetch('/effect/create',{method:'POST'});document.querySelector('#temporary').hidden=false">Add</button><input id=temporary hidden aria-label="Temporary password" value="Sy9!pQ2w"></div>`
        else if (req.method() === "POST") {
          effects.create++
          return route.fulfill({ json: { ok: true } })
        } else
          html = `<table><tr><td><a href="#editor" onclick="document.querySelector('#editor').hidden=false">${account}</a></td></tr></table><div id=editor hidden>${wrongEditor ? email.replace(account, "other@fixture.onmicrosoft.com") : email}<button onclick="document.querySelector('#roles').hidden=false">Edit permissions</button><div id=roles hidden><label><input type=checkbox>Global administrator</label><button onclick="fetch('/effect/promote',{method:'POST'});document.querySelector('#roles').hidden=true;document.querySelector('#verified').hidden=false">Save</button></div><p id=verified hidden>Global administrator</p></div>`
        if (req.method() === "POST") {
          if (u.pathname === "/effect/create") effects.create++
          else effects.promote++
          return route.fulfill({ json: { ok: true } })
        }
      } else if (u.hostname === "mysignins.microsoft.com") {
        if (!authenticated)
          return redirectTo(
            route,
            `https://login.microsoftonline.com/${job.tenantId}/login`,
          )
        html =
          identity +
          (effects.enrolled
            ? "<p>Authenticator app</p>"
            : `<button onclick="document.querySelector('#method').hidden=false">Add sign-in method</button><div id=method hidden><select aria-label=Method><option>Microsoft Authenticator</option></select><button onclick="document.querySelector('#alternate').hidden=false">Add</button></div><div id=alternate hidden><a href="#" onclick="document.querySelector('#method').hidden=true;document.querySelector('#setup').hidden=false">I want to use a different authenticator app</a></div><div id=setup hidden><button onclick="document.querySelector('#manual').hidden=false">Next</button></div><div id=manual hidden><a href="#" onclick="document.querySelector('#setup').hidden=true;document.querySelector('#manual-table').hidden=false;document.querySelector('#enrollment-next').hidden=false">Can't scan image?</a><table id=manual-table hidden><tr><td>Account name:</td><td>Microsoft:${account}</td></tr><tr><td data-testid="activation-url/key-label">Secret key:</td><td data-testid="activation-url/key">${seed.toLowerCase()}</td></tr></table><button id=enrollment-next hidden onclick="document.querySelector('#manual').hidden=true;document.querySelector('#verify').hidden=false">Next</button></div><form id=verify hidden method=post action="https://login.microsoftonline.com/fixture-enroll"><input aria-label="Enter code" name="code"><button>Next</button></form>`)
      } else if (
        u.hostname === "login.microsoftonline.com" &&
        u.pathname.endsWith("/adminconsent")
      ) {
        const redirect = new URL(config.redirectUri)
        redirect.searchParams.set("state", u.searchParams.get("state"))
        redirect.searchParams.set("tenant", job.tenantId)
        redirect.searchParams.set("admin_consent", "True")
        redirect.searchParams.set("scope", u.searchParams.get("scope"))
        const requestedPermissions = u.searchParams
          .get("scope")
          .includes("outlook.office365.com")
          ? permissions.slice(5)
          : permissions.slice(0, 5)
        html = `<span id=displayName>${account}</span><h1>Siteinabox mail</h1><div>${[...requestedPermissions, ...(extraPermission ? ["Unexpected extra privilege"] : [])].map((p) => `<div class=scope><div role=button class="toggle table">${p}</div></div>`).join("")}</div><button onclick="location.href='${redirect.href}'">Accept</button>`
      } else if (u.hostname === "login.microsoftonline.com") {
        if (u.pathname.endsWith("/login") && showAccountPicker)
          html = `<button onclick="location.href='https://login.microsoftonline.com/typed-login'">Sign in with ${account} work or school account.</button>`
        else if (u.pathname.endsWith("/login") || u.pathname === "/typed-login")
          html = form(
            "/fixture-username",
            "<input name=loginfmt><button>Next</button>",
          )
        else if (u.pathname === "/fixture-username") {
          assert.equal(post.get("loginfmt") === account, true)
          html = form(
            "/fixture-password",
            `<input name=passwd type=password ${swapPasswordIdentity ? "oninput=\"document.querySelector('#displayName').textContent='other@fixture.onmicrosoft.com'\"" : ""}><button>Sign in</button>`,
          )
        } else if (u.pathname === "/fixture-password") {
          effects.passwordSubmissions = (effects.passwordSubmissions ?? 0) + 1
          if (freshWithoutMfa && number > 1) {
            authenticated = true
            return redirectTo(
              route,
              "https://mysignins.microsoft.com/security-info",
            )
          }
          assert.equal(
            post.get("passwd") === (effects.password ?? "Sy9!pQ2w"),
            true,
          )
          if (number === 1 && !effects.password)
            html = form(
              "/fixture-change",
              "<input name=currentpasswd type=password><input name=newpasswd type=password><input name=confirmnewpasswd type=password><button>Sign in</button>",
            )
          else
            html = form(
              "/fixture-otp",
              "<input id=idTxtBx_SAOTCC_OTC name=otc><button id=idSubmit_SAOTCC_Continue>Verify</button>",
            )
        } else if (u.pathname === "/fixture-change") {
          effects.password = post.get("newpasswd")
          effects.passwordChanges++
          assert.equal(post.get("confirmnewpasswd") === effects.password, true)
          authenticated = true
          return redirectTo(
            route,
            "https://mysignins.microsoft.com/security-info",
          )
        } else if (u.pathname === "/fixture-enroll") {
          assert.equal(post.get("code") === code(base32(seed)), true)
          effects.enrolled = true
          effects.enrollments++
          authenticated = true
          return redirectTo(
            route,
            "https://mysignins.microsoft.com/security-info",
          )
        } else if (u.pathname === "/fixture-otp") {
          effects.otpSubmissions++
          assert.equal(post.get("otc") === code(base32(seed)), true)
          if (rejectOtp)
            html = form(
              "/fixture-otp",
              "<input id=idTxtBx_SAOTCC_OTC name=otc><button id=idSubmit_SAOTCC_Continue>Verify</button>",
            )
          else {
            authenticated = true
            return redirectTo(
              route,
              "https://mysignins.microsoft.com/security-info",
            )
          }
        } else throw Error("Unexpected synthetic login route")
      } else if (u.hostname === "admin.microsoft.com")
        html =
          identity +
          `<p>SIAB mail ${job.runId}</p>` +
          [
            "User Administrator",
            "License Administrator",
            "Domain Name Administrator",
            "Exchange Administrator",
            "Cloud Application Administrator",
            "Security Administrator",
          ]
            .map((r) => `<p>${r}</p>`)
            .join("") +
          "<button onclick=\"this.remove();document.querySelector('#approved').hidden=false\">Approve all</button><p id=approved hidden>relationship approved</p>"
      else {
        effects.unexpectedOutbound ??= []
        effects.unexpectedOutbound.push(u.origin)
        return route.abort()
      }
      return route.fulfill({ contentType: "text/html", body: html })
    })
    return context
  }
  return browser
}
const effects = () => ({
  create: 0,
  promote: 0,
  passwordChanges: 0,
  enrollments: 0,
  otpSubmissions: 0,
})
test("actual browser controller completes the six-step offline flow and persists privileged changes once", async () => {
  const root = await mkdtemp(join(tmpdir(), "siab-bootstrap-browser-")),
    store = new WorkerStore(root, Buffer.alloc(32, 1), Buffer.alloc(32, 2)),
    seen = effects()
  let step = ""
  const driver = new MicrosoftBootstrapBrowser(config, {
    launch: () => fixtureLaunch(step, seen),
  })
  const realRun = driver.run.bind(driver)
  driver.run = async (name, ...args) => {
    step = name
    try {
      return await realRun(name, ...args)
    } catch (e) {
      console.error({
        step,
        error: e.message.split("\n").slice(0, 5).join(" "),
      })
      throw e
    }
  }
  let receipt
  for (let n = 0; n < 6; n++) {
    receipt = await advanceJob(job, store, driver)
    assert.notEqual(receipt.phase, "uncertain")
    assert.notEqual(receipt.phase, "blocked")
  }
  assert.equal(receipt.phase, "complete")
  assert.equal(receipt.relationshipId, job.targetRelationshipId)
  assert.equal(seen.passwordChanges, 1)
  assert.equal(seen.enrollments, 1)
  assert.equal(seen.otpSubmissions, 1)
  const after = { ...seen }
  await advanceJob(job, store, driver)
  assert.deepEqual(seen, after)
  await driver.close()
})
test("denied authority and wrong selected editor fail before a privileged save", async () => {
  for (const variant of [
    { deny: true },
    { wrongEditor: true },
    { selectedLicense: true },
  ]) {
    const seen = effects(),
      step =
        variant.deny || variant.selectedLicense
          ? "create_admin"
          : "promote_admin",
      driver = new MicrosoftBootstrapBrowser(config, {
        launch: () => fixtureLaunch(step, seen, variant),
      })
    await assert.rejects(
      driver.run(step, job, {
        account,
        password: "Sy9!pQ2w",
      }),
    )
    assert.equal(seen.create + seen.promote, 0)
    await driver.close()
  }
})
test("a rejected MFA code is never retried and cannot mark the account secure", async () => {
  const seen = {
    ...effects(),
    password: "synthetic-new-password",
    enrolled: true,
  }
  const driver = new MicrosoftBootstrapBrowser(config, {
    launch: () => fixtureLaunch("secure_admin", seen, { rejectOtp: true }),
  })
  await assert.rejects(
    driver.run("secure_admin", job, {
      account,
      password: seen.password,
      seed,
      promoted: true,
    }),
  )
  assert.equal(seen.otpSubmissions, 1)
  await driver.close()
})
test("unexpected consent permissions are not accepted", async () => {
  const seen = effects(),
    driver = new MicrosoftBootstrapBrowser(config, {
      launch: () =>
        fixtureLaunch("consent_application", seen, { extraPermission: true }),
    })
  await assert.rejects(
    driver.run("consent_application", job, {
      account,
      password: "synthetic",
      seed,
      approved: true,
      relationshipId: job.targetRelationshipId,
    }),
  )
  await driver.close()
})

test("fresh sign-in without an actual MFA challenge is not accepted as factor proof", async () => {
  const seen = {
    ...effects(),
    password: "synthetic-new-password",
    enrolled: true,
  }
  const driver = new MicrosoftBootstrapBrowser(config, {
    launch: () =>
      fixtureLaunch("secure_admin", seen, { freshWithoutMfa: true }),
  })
  await assert.rejects(
    driver.run("secure_admin", job, {
      account,
      password: seen.password,
      seed,
      promoted: true,
    }),
  )
  assert.equal(seen.otpSubmissions, 1)
  await driver.close()
})
test("the exact account picker is supported without selecting another identity", async () => {
  const seen = {
    ...effects(),
    password: "synthetic-new-password",
    enrolled: true,
  }
  const driver = new MicrosoftBootstrapBrowser(config, {
    launch: () =>
      fixtureLaunch("secure_admin", seen, { showAccountPicker: true }),
  })
  const result = await driver.run("secure_admin", job, {
    account,
    password: seen.password,
    seed,
    promoted: true,
  })
  assert.equal(result.securityVerified, true)
  assert.equal(seen.otpSubmissions, 2)
  await driver.close()
})
test("an identity change during password entry prevents submitting that password", async () => {
  const seen = {
    ...effects(),
    password: "synthetic-new-password",
    enrolled: true,
  }
  const driver = new MicrosoftBootstrapBrowser(config, {
    launch: () =>
      fixtureLaunch("secure_admin", seen, { swapPasswordIdentity: true }),
  })
  await assert.rejects(
    driver.run("secure_admin", job, {
      account,
      password: seen.password,
      seed,
      promoted: true,
    }),
  )
  assert.equal(seen.passwordSubmissions ?? 0, 0)
  await driver.close()
})

test("browser allocation failure closes the process before returning an uncertain action", async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE localhost"],
  })
  browser.newContext = async () => {
    throw Error("Synthetic context allocation failure")
  }
  const driver = new MicrosoftBootstrapBrowser(config, {
    launch: async () => browser,
  })
  try {
    await assert.rejects(driver.run("create_admin", job, {}))
    assert.equal(browser.isConnected(), false)
    assert.equal(driver.active.size, 0)
  } finally {
    await browser.close()
    await driver.close()
  }
})
