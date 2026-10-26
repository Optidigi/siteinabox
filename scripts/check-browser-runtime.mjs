import { readFile, access } from "node:fs/promises"
import { constants } from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { infrastructure } from "./infrastructure-images.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const app = process.argv[2]
if (!["cms", "landing", "renderer"].includes(app) || process.argv.slice(3).some(arg => arg !== "--dns")) throw new Error("Choose the application browser runtime")
const require = createRequire(path.join(root, "apps", app, "package.json"))
const version = require("playwright/package.json").version
if (version !== infrastructure.ciBrowser.version) throw new Error("Browser container and package Playwright versions differ")
if (process.versions.node !== (await readFile(path.join(root, ".nvmrc"), "utf8")).trim() || !process.release.lts) throw new Error("Browser verification requires the governed Node LTS")
if (process.argv.includes("--dns") && !/\b9\.\d+/.test(execFileSync(process.env.SIAB_TEST_BIND_VALIDATOR_PATH || "/usr/bin/named-checkzone", ["-v"], { encoding: "utf8" }))) throw new Error("Real BIND tooling is required")
if (app === "cms") {
  for (const [command, args] of [["python3", ["--version"]], ["openssl", ["version"]], ["git", ["--version"]]]) execFileSync(command, args, { stdio: "ignore", timeout: 5_000 })
}
const { chromium } = require("playwright")
await access(chromium.executablePath(), constants.X_OK)
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setContent("<!doctype html><html><body><p>Siteinabox browser verification</p></body></html>")
  if (await page.locator("p").textContent() !== "Siteinabox browser verification") throw new Error("The actual browser cannot render")
} finally { await browser.close() }
console.log(`Verified real Chromium and Playwright ${version} under governed Node LTS${process.argv.includes("--dns") ? " with BIND" : ""}`)
