import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { Payload } from "payload"
import { getTestPayload } from "./_helpers"
import { boundWorkspace, securedPayment } from "../_helpers/privateWorkspaceFixture"
import { hasManualWorkspaceAccess } from "@/lib/workspace/manualAccess"
import { NextRequest } from "next/server"
import { createArgs } from "../_helpers/payloadApi"
import { themeSchema } from "@/lib/theme/schema"
import { Client } from "pg"
import { mkdir, writeFile, rm } from "node:fs/promises"
import path from "node:path"

let payload: Payload
beforeAll(async () => { payload = await getTestPayload() })
afterAll(async () => { await payload?.destroy() })


describe("workspace manual capabilities and private persistence", () => {
  it("does not grant manual CMS writes from a free workspace's Payload owner role", async () => {
    const { user, page, tenant } = await boundWorkspace(payload, "m16-free", "m16-free.test")
    await expect(payload.update({ collection: "pages", id: page.id, user, overrideAccess: false,
      data: { title: "Forged paid control" } })).rejects.toThrow()
    expect((await payload.findByID({ collection: "pages", id: page.id, overrideAccess: true })).title).toBe("Private AI draft")
    const themeBefore = (await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })).theme
    const session = await payload.login({ collection: "users", data: { email: user.email, password: "Synthetic-password-42!" } })
    const { POST } = await import("@/app/(payload)/api/tenant-theme/route")
    const response = await POST(new NextRequest("https://admin.siteinabox.nl/api/tenant-theme", {
      method: "POST", headers: { "content-type": "application/json", cookie: `payload-token=${session.token}` },
      body: JSON.stringify({ tenantId: tenant.id, paid: true, theme: { version: 3, colors: { schemeId: "red-confident" },
        fonts: { schemeId: "classic-editorial" }, shape: { schemeId: "rounded" }, appearance: { mode: "dark" } } }),
    }))
    expect(response.status).toBe(403)
    expect((await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })).theme).toEqual(themeBefore)
  })

  it("persists paid pre-live page, theme and navigation without a public domain or snapshot", async () => {
    const { tenant, user, page } = await boundWorkspace(payload, "m16-private", null)
    await securedPayment(payload, tenant.id, user.email)
    expect(await hasManualWorkspaceAccess(payload, String(tenant.id))).toBe(true)
    const settings = await payload.create(createArgs("site-settings",
      { tenant: tenant.id, siteName: "Private paid workspace", siteUrl: null, navigation: { primary: [], footer: [] } },
      { overrideAccess: true, context: { skipProjection: true } }))
    const session = await payload.login({ collection: "users", data: { email: user.email, password: "Synthetic-password-42!" } })
    const { POST } = await import("@/app/(payload)/api/page-editor-save/route")
    const response = await POST(new NextRequest("https://admin.siteinabox.nl/api/page-editor-save", {
      method: "POST", headers: { "content-type": "application/json", cookie: `payload-token=${session.token}` },
      body: JSON.stringify({ tenantId: tenant.id, publish: false, page: { id: page.id, expectedUpdatedAt: page.updatedAt,
        data: { title: "Private paid edit", slug: "index", status: "draft", blocks: [] } }, siteDesign: {
          theme: { version: 3, colors: { schemeId: "red-confident" }, fonts: { schemeId: "classic-editorial" },
            shape: { schemeId: "rounded" }, appearance: { mode: "dark" } }, navigation: { inNavbar: true, inFooter: false },
        } }),
    }))
    expect(response.status).toBe(200)
    expect((await response.json()).snapshot).toBeUndefined()
    const second = await payload.login({ collection: "users", data: { email: user.email, password: "Synthetic-password-42!" } })
    const { user: returning } = await payload.auth({ headers: new Headers({ cookie: `payload-token=${second.token}` }) })
    expect(returning?.id).toBe(user.id)
    expect((await payload.findByID({ collection: "pages", id: page.id, user: returning!, overrideAccess: false })).title).toBe("Private paid edit")
    const savedTenant = await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })
    expect(savedTenant.domain).toBeNull()
    expect(themeSchema.parse(savedTenant.theme).appearance.mode).toBe("dark")
    expect(savedTenant.activeSnapshot ?? null).toBeNull()
    const savedSettings = await payload.findByID({ collection: "site-settings", id: settings.id, depth: 0, overrideAccess: true })
    expect(savedSettings.siteUrl).toBeNull()
    expect(savedSettings.navigation?.primary?.[0]?.page).toBe(page.id)
    expect((await payload.find({ collection: "published-site-snapshots", overrideAccess: true })).totalDocs).toBe(0)
    const forbiddenPublish = await POST(new NextRequest("https://admin.siteinabox.nl/api/page-editor-save", {
      method: "POST", headers: { "content-type": "application/json", cookie: `payload-token=${second.token}` },
      body: JSON.stringify({ tenantId: tenant.id, publish: true, page: { id: page.id,
        data: { title: "Must not activate", slug: "index", status: "published", blocks: [] } } }),
    }))
    expect(forbiddenPublish.status).toBe(403)
    expect((await payload.findByID({ collection: "pages", id: page.id, overrideAccess: true })).title).toBe("Private paid edit")
    expect((await payload.find({ collection: "published-site-snapshots", overrideAccess: true })).totalDocs).toBe(0)
  })

  it("rejects a stale shared theme even when the page itself is current", async () => {
    const { tenant, user, page } = await boundWorkspace(payload, "m16-theme-stale", null)
    await securedPayment(payload, tenant.id, user.email)
    const baseline = (await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })).theme
    const theme = themeSchema.parse({ version: 3, colors: { schemeId: "red-confident" },
      fonts: { schemeId: "classic-editorial" }, shape: { schemeId: "rounded" }, appearance: { mode: "dark" } })
    await payload.update({ collection: "tenants", id: tenant.id, overrideAccess: true, data: { theme } })
    const session = await payload.login({ collection: "users", data: { email: user.email, password: "Synthetic-password-42!" } })
    const { POST } = await import("@/app/(payload)/api/page-editor-save/route")
    const response = await POST(new NextRequest("https://admin.siteinabox.nl/api/page-editor-save", {
      method: "POST", headers: { "content-type": "application/json", cookie: `payload-token=${session.token}` },
      body: JSON.stringify({ tenantId: tenant.id, publish: false, page: { id: page.id, expectedUpdatedAt: page.updatedAt,
        data: { title: "Stale theme must roll back page", slug: "index", status: "draft", blocks: [] } },
        siteDesign: { theme: { ...theme, appearance: { ...theme.appearance, mode: "light" } }, expectedTheme: baseline ?? null } }),
    }))
    expect(response.status).toBe(409)
    expect((await payload.findByID({ collection: "pages", id: page.id, overrideAccess: true })).title).toBe(page.title)
    expect(themeSchema.parse((await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })).theme)).toEqual(theme)
  })

  it("reports committed persistence when disk refresh fails, without publishing or replaying", async () => {
    const { tenant, user, page } = await boundWorkspace(payload, "m16-projection", null)
    await securedPayment(payload, tenant.id, user.email)
    const session = await payload.login({ collection: "users", data: { email: user.email, password: "Synthetic-password-42!" } })
    const { POST } = await import("@/app/(payload)/api/page-editor-save/route")
    const directory = path.join(process.env.DATA_DIR!, "tenants", String(tenant.id))
    await mkdir(directory, { recursive: true })
    const blocker = path.join(directory, "pages")
    // This unique fixture owns the path; a real file deliberately prevents
    // mkdir for the projection. No filesystem or hook mock hides the boundary.
    await writeFile(blocker, "Synthetic unavailable projection directory", { flag: "wx" })
    try {
      const response = await POST(new NextRequest("https://admin.siteinabox.nl/api/page-editor-save", {
        method: "POST", headers: { "content-type": "application/json", cookie: `payload-token=${session.token}` },
        body: JSON.stringify({ tenantId: tenant.id, publish: false, page: { id: page.id, expectedUpdatedAt: page.updatedAt,
          data: { title: "Saved despite refresh failure", slug: "index", status: "published", blocks: page.blocks } } }),
      }))
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ ok: true, warning: "E_CUSTOMER_PROJECTION_PENDING", page: { id: page.id } })
      expect((await payload.findByID({ collection: "pages", id: page.id, overrideAccess: true })).title).toBe("Saved despite refresh failure")
      expect((await payload.find({ collection: "published-site-snapshots", overrideAccess: true })).totalDocs).toBe(0)
    } finally { await rm(blocker) }
  })

  it("rejects a concurrent stale save instead of silently overwriting the first writer", async () => {
    const { tenant, user, page } = await boundWorkspace(payload, "m16-stale", null)
    await securedPayment(payload, tenant.id, user.email)
    const session = await payload.login({ collection: "users", data: { email: user.email, password: "Synthetic-password-42!" } })
    const { POST } = await import("@/app/(payload)/api/page-editor-save/route")
    let releaseFirst!: () => void
    let firstEntered!: () => void
    const held = new Promise<void>(resolve => { releaseFirst = resolve })
    const entered = new Promise<void>(resolve => { firstEntered = resolve })
    const hooks = payload.collections.pages.config.hooks.beforeChange
    const holdFirst: NonNullable<typeof hooks>[number] = async args => {
      if (args.data.title === "First committed edit") { firstEntered(); await held }
      return args.data
    }
    if (!hooks) throw new Error("Page hooks unavailable")
    hooks.push(holdFirst)
    const monitor = new Client({ connectionString: process.env.DATABASE_URI, query_timeout: 5000 })
    const request = (title: string) => POST(new NextRequest("https://admin.siteinabox.nl/api/page-editor-save", {
      method: "POST", headers: { "content-type": "application/json", cookie: `payload-token=${session.token}` },
      body: JSON.stringify({ tenantId: tenant.id, publish: false, page: { id: page.id, expectedUpdatedAt: page.updatedAt,
        data: { title, slug: "index", status: "draft", blocks: [] } } }),
    }))
    const pending: Promise<Response>[] = []
    try {
      await monitor.connect()
      pending.push(request("First committed edit"))
      await entered
      let secondDone = false
      const second = request("Stale competing edit").finally(() => { secondDone = true })
      pending.push(second)
      // Observe either completion or an actual database wait, then release the
      // held writer. Assertions concern API outcomes and persisted data, not SQL.
      const deadline = Date.now() + 5000
      while (!secondDone && Date.now() < deadline) {
        const waiting = await monitor.query<{ blocked: boolean }>(`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
            AND pid<>pg_backend_pid() AND wait_event_type='Lock') AS blocked`)
        if (waiting.rows[0]?.blocked) break
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      releaseFirst()
      const responses = await Promise.all(pending)
      expect(responses.map(result => result.status).sort()).toEqual([200, 409])
      expect((await payload.findByID({ collection: "pages", id: page.id, overrideAccess: true })).title).toBe("First committed edit")
    } finally {
      releaseFirst()
      await Promise.allSettled(pending)
      hooks.splice(hooks.indexOf(holdFirst), 1)
      await monitor.end()
    }
  })
})
