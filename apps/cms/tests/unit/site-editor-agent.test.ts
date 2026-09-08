import { describe, expect, it, vi } from "vitest"
import { compactBlockForModel, patchSection, removeUnavailableBlocks } from "@/lib/agent/tools"
import { encodeSiteEditorSse, runExistingSiteTurn, summarizeEditorToolResults } from "@/lib/agent/siteEditorAgent"
import { canUseMastraSiteEditor } from "@/lib/builder/extractWithMastra"
import { heuristicExtractBuilderFacts } from "@/lib/builder/facts"

describe("site editor harness", () => {
  it("treats Mastra tools as available only with provider plus API key", () => {
    expect(canUseMastraSiteEditor({ SITE_GENERATION_PROVIDER: "mastra" })).toBe(false)
    expect(canUseMastraSiteEditor({
      SITE_GENERATION_PROVIDER: "mastra",
      OPENAI_API_KEY: "sk-test",
    })).toBe(true)
    expect(canUseMastraSiteEditor({
      SITE_GENERATION_PROVIDER: "mock",
      OPENAI_API_KEY: "sk-test",
    })).toBe(false)
  })

  it("counts writes from tool results and ignores getSiteContext", () => {
    expect(summarizeEditorToolResults([
      { payload: { toolName: "getSiteContext" } },
      { payload: { toolName: "setTheme" } },
    ])).toEqual({ applied: true, regenerate: false })
    expect(summarizeEditorToolResults([
      { name: "getSiteContext" },
    ])).toEqual({ applied: false, regenerate: false })
    expect(summarizeEditorToolResults([
      { payload: { toolName: "requestRegenerate" } },
    ])).toEqual({ applied: true, regenerate: true })
    expect(summarizeEditorToolResults([
      { payload: { toolName: "removeUnavailableBlocks" } },
    ])).toEqual({ applied: true, regenerate: false })
    expect(summarizeEditorToolResults([
      { payload: { toolName: "setBlock", isError: true } },
    ])).toEqual({ applied: false, regenerate: false })
  })

  it("compacts blocks for the model without leaking full media objects", () => {
    expect(compactBlockForModel({
      blockType: "hero",
      variant: "hero-01",
      heading: "Hovenier Eindhoven",
      body: "Tuinen die blijven.",
      image: { id: 99, url: "https://example.test/secret.jpg", filename: "secret.jpg" },
      items: [{ title: "Snoeien", body: "..." }],
    }, 0)).toMatchObject({
      index: 0,
      blockType: "hero",
      variant: "hero-01",
      heading: "Hovenier Eindhoven",
      itemTitles: ["Snoeien"],
      live: true,
    })
    expect(compactBlockForModel({
      blockType: "about",
      variant: "about-01",
      heading: "Over ons",
    }, 3)).toMatchObject({ live: false, blockType: "about" })
  })

  it("patches heading and body on the selected block without rewriting media", async () => {
    const payload = {
      find: vi.fn(async () => ({
        docs: [{
          id: 4,
          slug: "index",
          blocks: [{ blockType: "hero", variant: "hero-01", heading: "Oud", body: "Oud", image: 12 }],
        }],
      })),
      update: vi.fn(async (args: { data: { blocks: Array<Record<string, unknown>> } }) => args.data),
    }
    await patchSection(
      { payload: payload as never, tenantId: 7 },
      { pageSlug: "index", blockIndex: 0, patch: { heading: "Nieuw", body: "Scherper aanbod." } },
    )
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "pages",
      data: {
        blocks: [expect.objectContaining({
          heading: "Nieuw",
          body: "Scherper aanbod.",
          image: 12,
          variant: "hero-01",
        })],
      },
    }))
  })

  it("refuses unavailable families on the regex fallback path without writing", async () => {
    const previous = process.env.SITE_GENERATION_PROVIDER
    process.env.SITE_GENERATION_PROVIDER = "mock"
    const payload = {
      find: vi.fn(async () => ({ docs: [{ id: 7, slug: "index", blocks: [], chrome: { navbar: { variant: "navbar-01", placement: "sticky" }, footer: { variant: "footer-01" } } }] })),
      update: vi.fn(),
      findByID: vi.fn(async () => ({ id: 3, theme: null })),
    }
    const result = await runExistingSiteTurn({
      ctx: { payload: payload as never, tenantId: 3 },
      message: "Voeg een FAQ pagina en een portfolio toe.",
      pageSlug: "index",
      facts: heuristicExtractBuilderFacts("Voeg een FAQ pagina en een portfolio toe.", null),
      useMastra: false,
      allowRegenerate: false,
    })
    process.env.SITE_GENERATION_PROVIDER = previous
    expect(result.applied).toBe(false)
    expect(result.text).toMatch(/catalogus/i)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("refuses to patch copy on unavailable families", async () => {
    const payload = {
      find: vi.fn(async () => ({
        docs: [{
          id: 4,
          slug: "index",
          blocks: [{ blockType: "about", variant: "about-01", heading: "Over" }],
        }],
      })),
      update: vi.fn(),
    }
    await expect(patchSection(
      { payload: payload as never, tenantId: 7 },
      { pageSlug: "index", blockIndex: 0, patch: { heading: "Nieuw" } },
    )).rejects.toThrow(/catalog/)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("removes pending unavailable families and keeps catalog sections", async () => {
    const payload = {
      find: vi.fn(async () => ({
        docs: [{
          id: 4,
          slug: "index",
          blocks: [
            { blockType: "hero", variant: "hero-01", heading: "Hero" },
            { blockType: "about", variant: "about-01", heading: "Over" },
            { blockType: "services", variant: "services-01", heading: "Diensten" },
            { blockType: "faq", variant: "faq-01", heading: "FAQ" },
            { blockType: "cta", variant: "cta-01", heading: "Contact" },
          ],
        }],
      })),
      update: vi.fn(async (args: { data: { blocks: Array<Record<string, unknown>> } }) => args.data),
    }
    const result = await removeUnavailableBlocks({ payload: payload as never, tenantId: 7 }, "index")
    expect(result).toEqual({ removed: 2, remaining: 3 })
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        blocks: [
          expect.objectContaining({ blockType: "hero" }),
          expect.objectContaining({ blockType: "services" }),
          expect.objectContaining({ blockType: "cta" }),
        ],
      },
    }))
  })

  it("no-ops prune when every block is already in the live catalog", async () => {
    const { pruneUnavailableBlocksIfPresent } = await import("@/lib/agent/tools")
    const payload = {
      find: vi.fn(async () => ({
        docs: [{
          id: 4,
          slug: "index",
          blocks: [{ blockType: "hero", variant: "hero-01" }],
        }],
      })),
      update: vi.fn(),
    }
    await expect(pruneUnavailableBlocksIfPresent({ payload: payload as never, tenantId: 7 }, "index"))
      .resolves.toEqual({ removed: 0, remaining: 1 })
    expect(payload.update).not.toHaveBeenCalled()
  })

  it("encodes SSE events for the agent stream contract", () => {
    const delta = encodeSiteEditorSse({ type: "delta", text: "Ik " })
    expect(delta).toBe("data: {\"type\":\"delta\",\"text\":\"Ik \"}\n\n")
    const done = encodeSiteEditorSse({
      type: "done",
      result: {
        text: "Klaar.",
        applied: true,
        regenerate: false,
        snapshot: { theme: null, page: null, chrome: { navbarVariant: null, navbarPlacement: null, footerVariant: null, footerTagline: null }, contact: { phone: null, address: null }, appointmentsEnabled: false },
      },
    })
    expect(done.startsWith("data: ")).toBe(true)
    expect(done.endsWith("\n\n")).toBe(true)
    expect(JSON.parse(done.slice(6).trim()).type).toBe("done")
  })

  it("tells the maintainer to speak about preview without markdown", async () => {
    const { readFileSync } = await import("node:fs")
    const source = readFileSync("src/lib/agent/siteEditorAgent.ts", "utf8")
    expect(source).toContain("preview-site")
    expect(source).toContain("Geen markdown")
    expect(source).toContain("in de preview staat")
    expect(source).not.toContain("wat er nu live staat")
  })
})
