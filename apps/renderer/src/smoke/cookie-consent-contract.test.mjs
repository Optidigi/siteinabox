import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const pageSource = await readFile(new URL("../pages/[...path].astro", import.meta.url), "utf8")
const runtimeSource = await readFile(new URL("../client/analytics-runtime.ts", import.meta.url), "utf8")
const amicareSource = await readFile(new URL("../../../../packages/site-renderer/src/tenant-renderers/amicare/AmicarePage.tsx", import.meta.url), "utf8")
const chromeSource = await readFile(new URL("../../../../packages/site-renderer/src/chrome.tsx", import.meta.url), "utf8")

test("renderer contains no route-authored or tenant-authored consent presentation", () => {
  assert.doesNotMatch(pageSource, /renderer-cookie-consent|Cookievoorkeuren|Alles accepteren/)
  assert.doesNotMatch(amicareSource, /cookie-consent-banner|AmicareCookieConsent|data-cookie-consent/)
  assert.doesNotMatch(pageSource, /siab-analytics-config/)
  assert.doesNotMatch(chromeSource, /settings\.privacyDisclosure/)
  assert.doesNotMatch(amicareSource, /settings\.privacyDisclosure/)
})

test("analytics runtime still rejects stale consent for a future approved chrome", () => {
  assert.match(runtimeSource, /receipt\.version/)
  assert.match(runtimeSource, /state\.config\?\.consentVersion/)
  assert.match(runtimeSource, /receipt\.categories\?\.analytics === true/)
  assert.match(runtimeSource, /state\.config\?\.consentVersion \? null : stored/)
})
