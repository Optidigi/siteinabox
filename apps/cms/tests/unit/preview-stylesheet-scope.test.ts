import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")
const frontendRoot = path.join(repoRoot, "apps/cms/src/app/(frontend)")
const payloadRoot = path.join(repoRoot, "apps/cms/src/app/(payload)")
const previewImport = 'import "@/styles/site-renderer-preview.css"'

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) return collectSourceFiles(fullPath)
    return /\.(tsx?|jsx?)$/.test(entry) ? [fullPath] : []
  })
}

describe("CMS preview renderer stylesheet scope", () => {
  it("does not import renderer/provider preview CSS from the frontend or admin shell", () => {
    expect(read("apps/cms/src/app/(frontend)/layout.tsx")).not.toContain("site-renderer-preview.css")
    expect(read("apps/cms/src/app/(frontend)/(admin)/layout.tsx")).not.toContain("site-renderer-preview.css")
    expect(read("apps/cms/src/app/(payload)/layout.tsx")).not.toContain("site-renderer-preview.css")
  })

  it("imports renderer/provider preview CSS only from the customer preview route group layout", () => {
    const importingFiles = [frontendRoot, payloadRoot].flatMap((root) => collectSourceFiles(root))
      .filter((file) => readFileSync(file, "utf8").includes("site-renderer-preview.css"))
      .map((file) => path.relative(repoRoot, file).split(path.sep).join("/"))

    expect(importingFiles).toEqual(["apps/cms/src/app/(frontend)/(site-preview)/layout.tsx"])
    const [previewLayout] = importingFiles
    expect(previewLayout).toBeDefined()
    expect(read(previewLayout as string)).toContain(previewImport)
  })

  it("keeps shared renderer CSS out of the CMS frontend shell", () => {
    const frontendLayout = read("apps/cms/src/app/(frontend)/layout.tsx")
    const rendererCss = read("packages/site-renderer/src/styles.css")

    expect(frontendLayout).not.toContain('import "@siteinabox/site-renderer/styles.css"')
    expect(rendererCss).toMatch(/^:root\s*\{/m)
    expect(rendererCss).toMatch(/^body\s*\{/m)
    expect(rendererCss).toMatch(/^\*\s*\{/m)
  })
})
