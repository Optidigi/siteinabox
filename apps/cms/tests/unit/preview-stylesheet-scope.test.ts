import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")
const frontendRoot = path.join(repoRoot, "apps/cms/src/app/(frontend)")
const payloadRoot = path.join(repoRoot, "apps/cms/src/app/(payload)")
const previewImport = 'import "@/styles/site-renderer-preview.css"'
const canvasCssImport = '@import "@siteinabox/site-renderer/canvas.css";'
const canvasScope = ".site-renderer[data-siab-site-renderer]"

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

  it("imports renderer/provider preview CSS only from the isolated customer preview layout", () => {
    const importingFiles = [frontendRoot, payloadRoot].flatMap((root) => collectSourceFiles(root))
      .filter((file) => readFileSync(file, "utf8").includes("site-renderer-preview.css"))
      .map((file) => path.relative(repoRoot, file).split(path.sep).join("/"))

    expect(importingFiles.sort()).toEqual([
      "apps/cms/src/app/(frontend)/(site-preview)/layout.tsx",
    ])
    expect(read("apps/cms/src/app/(frontend)/(site-preview)/layout.tsx")).toContain(previewImport)
  })

  it("keeps shared renderer CSS out of the CMS frontend shell", () => {
    const frontendLayout = read("apps/cms/src/app/(frontend)/layout.tsx")
    const rendererCss = read("packages/site-renderer/src/styles.css")

    expect(frontendLayout).not.toContain('import "@siteinabox/site-renderer/styles.css"')
    expect(rendererCss).toMatch(/^:root\s*\{/m)
    expect(rendererCss).toMatch(/^body\s*\{/m)
    expect(rendererCss).toMatch(/^\*\s*\{/m)
  })

  it("loads only the scoped embedded renderer canvas stylesheet in CMS app CSS", () => {
    const siabCss = read("apps/cms/src/styles/siab.css")
    const globalsCss = read("apps/cms/src/styles/globals.css")

    expect(globalsCss).toContain('@import "./siab.css";')
    expect(globalsCss).toContain('@import "./shadcn.css";')
    expect(siabCss).toContain('@source "../../../../packages/site-renderer/src";')
    expect(siabCss).toContain(canvasCssImport)
    expect(siabCss).not.toContain("site-renderer-preview.css")
    expect(siabCss).not.toContain('@import "@siteinabox/site-renderer/styles.css"')
  })

  it("exports embedded renderer canvas CSS as a scoped package contract", () => {
    const packageJson = JSON.parse(read("packages/site-renderer/package.json")) as {
      exports?: Record<string, unknown>
    }
    const canvasCss = read("packages/site-renderer/src/canvas.css")

    expect(packageJson.exports?.["./canvas.css"]).toBe("./src/canvas.css")
    expect(canvasCss).not.toMatch(/(^|\n)\s*:root\s*\{/)
    expect(canvasCss).not.toMatch(/(^|\n)\s*body\s*\{/)
    expect(canvasCss).not.toMatch(/(^|\n)\s*\*\s*\{/)

    const ruleOpeners = canvasCss
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.endsWith("{"))
      .filter((line) => !line.startsWith("@"))

    expect(ruleOpeners.length).toBeGreaterThan(0)
    expect(ruleOpeners.every((line) => line.includes(canvasScope))).toBe(true)
  })
})
