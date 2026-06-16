import { afterEach, describe, expect, it, vi } from "vitest"
import {
  fetchSiteManifestFromRepo,
  parseGitHubRepo,
} from "@/lib/github/siteRepoManifest"

const manifest = {
  version: 1,
  inlineMarks: { bold: true },
  blockTypes: { paragraph: true },
}

const githubFile = (json: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({
    type: "file",
    content: Buffer.from(JSON.stringify(json)).toString("base64"),
  }),
})

describe("siteRepo manifest fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("parses owner/repo and GitHub URL repo formats", () => {
    expect(parseGitHubRepo("optidigi/site-client")).toEqual({ owner: "optidigi", repo: "site-client" })
    expect(parseGitHubRepo("Optidigi/siteinabox:sites/ami-care")).toEqual({
      owner: "Optidigi",
      repo: "siteinabox",
      pathPrefix: "sites/ami-care",
    })
    expect(parseGitHubRepo("https://github.com/optidigi/site-client.git")).toEqual({
      owner: "optidigi",
      repo: "site-client",
    })
    expect(parseGitHubRepo("https://github.com/Optidigi/siteinabox/tree/main/sites/ami-care")).toEqual({
      owner: "Optidigi",
      repo: "siteinabox",
      ref: "main",
      pathPrefix: "sites/ami-care",
    })
    expect(parseGitHubRepo("git@github.com:optidigi/site-client.git")).toEqual({
      owner: "optidigi",
      repo: "site-client",
    })
    expect(parseGitHubRepo("https://example.com/optidigi/site-client")).toBeNull()
  })

  it("fetches siteManifest.json and validates it against manifestSchema", async () => {
    const fetchMock = vi.fn().mockResolvedValue(githubFile(manifest))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchSiteManifestFromRepo("optidigi/site-client", { token: "ghs_test" })

    expect(result).toEqual({
      ok: true,
      repo: "optidigi/site-client",
      path: "siteManifest.json",
      manifest,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/optidigi/site-client/contents/siteManifest.json",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer ghs_test" }),
        cache: "no-store",
      }),
    )
  })

  it("fetches a monorepo site package manifest by path and ref", async () => {
    const fetchMock = vi.fn().mockResolvedValue(githubFile(manifest))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchSiteManifestFromRepo("https://github.com/Optidigi/siteinabox/tree/main/sites/ami-care")

    expect(result).toEqual({
      ok: true,
      repo: "Optidigi/siteinabox",
      path: "sites/ami-care/siteManifest.json",
      manifest,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/Optidigi/siteinabox/contents/sites/ami-care/siteManifest.json?ref=main",
      expect.objectContaining({ cache: "no-store" }),
    )
  })

  it("falls back to siteManifest.example.json when the canonical manifest is absent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce(githubFile(manifest))
    vi.stubGlobal("fetch", fetchMock)

    const result = await fetchSiteManifestFromRepo("optidigi/site-client")

    expect(result.ok).toBe(true)
    expect(result.ok && result.path).toBe("siteManifest.example.json")
  })

  it("returns a validation error for manifest-shaped JSON that does not match the schema", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(githubFile({ version: 1, inlineMarks: {} })))

    const result = await fetchSiteManifestFromRepo("optidigi/site-client")

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/manifest schema/i)
  })
})
