import { spawn } from "node:child_process"
import { once } from "node:events"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const cmsRoot = path.resolve(import.meta.dirname, "../..")
const releaseRunbook = path.resolve(
  cmsRoot,
  "../../docs/runbooks/commerce-release.md",
)

describe("artifact-contained commerce CLI safety", () => {
  const scripts = [
    "check-commerce-edge-inventory.ts",
    "check-commerce-production-readiness.ts",
    "reconcile-commerce-edge-routing.ts",
  ]

  it.each(scripts)("%s disables background jobs before loading Payload config", (name) => {
    const source = readFileSync(path.join(cmsRoot, "scripts", name), "utf8")
    const disableAt = source.indexOf(
      'process.env.PAYLOAD_DISABLE_JOBS_AUTORUN = "1"',
    )
    const configImportAt = source.indexOf('import("@/payload.config")')

    expect(disableAt).toBeGreaterThanOrEqual(0)
    expect(configImportAt).toBeGreaterThan(disableAt)
    expect(source).not.toMatch(/^import config from ["']@\/payload\.config["']/m)
    const destroyAt = source.indexOf("await payload.destroy()")
    const successExitAt = source.indexOf("(code) => process.exit(code)")
    const failureExitAt = source.lastIndexOf("process.exit(1)")
    expect(destroyAt).toBeGreaterThan(configImportAt)
    expect(successExitAt).toBeGreaterThan(destroyAt)
    expect(failureExitAt).toBeGreaterThan(successExitAt)
  })

  it("disables Payload telemetry for deterministic private operations", () => {
    const source = readFileSync(
      path.join(cmsRoot, "src/payload.config.ts"),
      "utf8",
    )
    expect(source).toMatch(/telemetry:\s*false/)
  })

  it("keeps production capability preflight strictly read-only", () => {
    const source = readFileSync(
      path.join(
        cmsRoot,
        "src/lib/commerce/providerCapabilityPreflight.ts",
      ),
      "utf8",
    )
    expect(source).not.toContain("reconcileCloudflareTunnel")
    expect(source).not.toMatch(
      /\b(createMollie|createOpenProvider|createCloudflare|renewOpenProvider|transferOpenProvider|putTunnelConfiguration)\b/,
    )
    expect(source).toContain("inspectCloudflareTunnel")
    expect(source).toContain("inspectMollieProfileCapabilities")
    expect(source).toContain("getOpenProviderResellerBalance")
  })

  it("passes the no-autorun interlock to all documented one-off containers", () => {
    const runbook = readFileSync(releaseRunbook, "utf8")
    expect(runbook.match(/-e PAYLOAD_DISABLE_JOBS_AUTORUN=1/g)).toHaveLength(3)
  })

  it.runIf(Boolean(process.env.DATABASE_URI))(
    "exits promptly when a post-initialization inventory query fails",
    async () => {
      const configuredDatabaseUrl = process.env.DATABASE_URI
      if (!configuredDatabaseUrl) {
        throw new Error("DATABASE_URI is required for this conditional test")
      }
      const databaseUrl = new URL(configuredDatabaseUrl)
      databaseUrl.searchParams.set(
        "options",
        "-csearch_path=siab_cli_missing_schema",
      )
      const child = spawn(
        "pnpm",
        ["exec", "tsx", "scripts/check-commerce-edge-inventory.ts"],
        {
          cwd: cmsRoot,
          env: {
            ...process.env,
            BETTER_AUTH_SECRET:
              "ci-cli-failure-auth-secret-ci-cli-failure-auth-secret",
            DATABASE_URI: databaseUrl.toString(),
            NODE_ENV: "production",
            PAYLOAD_DISABLE_JOBS_AUTORUN: "1",
            PAYLOAD_SECRET:
              "ci-cli-failure-payload-secret-ci-cli-failure-payload-secret",
          },
          stdio: "ignore",
        },
      )
      const timeout = setTimeout(() => child.kill("SIGKILL"), 15_000)
      const [code, signal] = await once(child, "exit")
      clearTimeout(timeout)

      expect(signal).toBeNull()
      expect(code).toBe(1)
    },
    20_000,
  )
})
