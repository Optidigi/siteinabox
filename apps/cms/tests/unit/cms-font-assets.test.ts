import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import fontAssets from "@/styles/font-assets.json"

const root = path.resolve(import.meta.dirname, "../..")
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex")

describe("preserved CMS font assets", () => {
  it("retains the reviewed build's complete face, glyph, weight and fallback declarations", () => {
    const css = readFileSync(path.join(root, "src/styles/fonts.css"), "utf8")
    const faces = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map((match) => {
      const entries = match[1]!.split(";").map(value => value.trim()).filter(Boolean).map(value => {
        const colon = value.indexOf(":")
        const key = value.slice(0, colon).trim()
        let declaration = value.slice(colon + 1).trim()
        if (key === "src") declaration = declaration.replace(/url\(([^)]+)\)/g, (_match, raw: string) => {
          const url = raw.replaceAll('"', "")
          expect(url).toMatch(/^\/fonts\/cms\/[a-z-]+-[a-f0-9]{16}\.woff2$/)
          return `url(sha256:${hash(readFileSync(path.join(root, "public", url)))})`
        })
        return [key, declaration]
      })
      return Object.fromEntries(entries.sort(([left], [right]) => left!.localeCompare(right!)))
    })
    expect(faces).toHaveLength(49)
    // Independent golden receipt from the successful b2b54f43 build, before
    // vendoring. Includes the actual font-byte hashes and both Arial metrics.
    expect(hash(JSON.stringify(faces))).toBe("31d4a42b09815e2932df1beaea4786e709509a3223978cfad4e6be92de95f972")
    const remainder = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@font-face\s*\{[^}]+\}/g, "").trim()
    const variables = remainder.match(/^\.cms-fonts\s*\{([^}]+)\}$/)?.[1]
    expect(variables).toBeDefined()
    const entries = variables!.split(";").map(value => value.trim()).filter(Boolean).map(value => {
      const colon = value.indexOf(":")
      return [value.slice(0, colon).trim(), value.slice(colon + 1).split(",").map(family => family.trim().replace(/^"|"$/g, ""))] as const
    })
    expect(entries).toHaveLength(2)
    expect(Object.fromEntries(entries)).toEqual({
      "--font-sans": ["Inter", "Inter Fallback"],
      "--font-mono": ["JetBrains Mono", "JetBrains Mono Fallback"],
    })
  })

  it("binds every font and complete license to retained provenance", () => {
    expect(fontAssets.assets).toHaveLength(13)
    for (const asset of fontAssets.assets) {
      const bytes = readFileSync(path.join(root, "public/fonts/cms", asset.file))
      expect(bytes.length).toBe(asset.size)
      expect(hash(bytes)).toBe(asset.sha256)
    }
    for (const license of fontAssets.licenses) {
      const bytes = readFileSync(path.join(root, "public/fonts/cms", license.file))
      expect(hash(bytes)).toBe(license.sha256)
      expect(bytes.toString()).toContain("SIL OPEN FONT LICENSE")
    }
    expect(fontAssets.assets.filter(asset => asset.preload).map(asset => asset.file).sort()).toEqual([
      "inter-c940764593d0fe5d.woff2",
      "jetbrains-mono-2c32b9b3ee358c11.woff2",
    ])
  })
})
