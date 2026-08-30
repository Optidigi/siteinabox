import { beforeAll, describe, expect, it } from "vitest"
import type { PayloadRequest } from "payload"

import { down, up } from "@/migrations/20260828_110000_rename_theme_background_mode"
import { getTestPayload } from "./_helpers"

let payload: Awaited<ReturnType<typeof getTestPayload>>

const executeRaw = (raw: string) => payload.db.execute({
  drizzle: payload.db.drizzle,
  raw,
})

describe("rename theme background mode migration", () => {
  beforeAll(async () => {
    payload = await getTestPayload()
  }, 30_000)

  it("migrates a persisted legacy tenant theme and reverses it safely", async () => {
    const tenant = await payload.create({
      collection: "tenants",
      data: {
        name: "Background mode migration fixture",
        slug: `background-mode-migration-${Date.now()}`,
        domain: `background-mode-migration-${Date.now()}.test`,
        status: "active",
      },
      overrideAccess: true,
    })

    await executeRaw(`
      UPDATE public.tenants
      SET theme = '{"version":3,"appearance":{"mode":"dark","heroBackground":"mesh"},"colors":{"schemeId":"monochrome"},"fonts":{"schemeId":"clear-modern"},"shape":{"schemeId":"soft"}}'::jsonb
      WHERE id = ${tenant.id};
    `)

    await up({ db: payload.db.drizzle, payload, req: {} as PayloadRequest })
    const migrated = await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })
    expect(migrated.theme).toEqual({
      version: 3,
      appearance: { mode: "dark", backgroundMode: "mesh" },
      colors: { schemeId: "monochrome" },
      fonts: { schemeId: "clear-modern" },
      shape: { schemeId: "soft" },
    })

    await down({ db: payload.db.drizzle, payload, req: {} as PayloadRequest })
    const restored = await payload.findByID({ collection: "tenants", id: tenant.id, overrideAccess: true })
    expect(restored.theme).toEqual({
      version: 3,
      appearance: { mode: "dark", heroBackground: "mesh" },
      colors: { schemeId: "monochrome" },
      fonts: { schemeId: "clear-modern" },
      shape: { schemeId: "soft" },
    })
  }, 30_000)
})
