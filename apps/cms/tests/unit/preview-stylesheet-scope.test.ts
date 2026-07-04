import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")
const appRoot = path.join(repoRoot, "apps/cms/src/app")
const frontendRoot = path.join(repoRoot, "apps/cms/src/app/(frontend)")
const payloadRoot = path.join(repoRoot, "apps/cms/src/app/(payload)")
const fullRendererStylesheetImport = 'import "@siteinabox/site-renderer/styles.css"'
const generatedRendererStylesheetImport = 'import "@/styles/generated-site-renderer.css"'
const canvasStylesheetImport = 'import "@/styles/site-renderer-canvas.css"'
const fullRendererCssImport = '@import "@siteinabox/site-renderer/styles.css";'
const canvasCssImport = '@import "@siteinabox/site-renderer/canvas.css";'
const canvasScope = ".site-renderer[data-siab-site-renderer]"
const embeddedRendererRoutePattern = /\/(?:\(renderer-frame\)|\(editor-frame\)|renderer-iframe|renderer-frame|editor-frame|site-renderer-frame|embedded-renderer)\//

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

  it("does not import renderer/provider preview CSS from CMS route layouts", () => {
    const importingFiles = [frontendRoot, payloadRoot].flatMap((root) => collectSourceFiles(root))
      .filter((file) => readFileSync(file, "utf8").includes("site-renderer-preview.css"))
      .map((file) => path.relative(repoRoot, file).split(path.sep).join("/"))

    expect(importingFiles.sort()).toEqual([])
  })

  it("keeps shared renderer CSS out of the CMS frontend shell", () => {
    const frontendLayout = read("apps/cms/src/app/(frontend)/layout.tsx")
    const rendererCss = read("packages/site-renderer/src/styles.css")

    expect(frontendLayout).not.toContain(fullRendererStylesheetImport)
    expect(rendererCss).toMatch(/^:root\s*\{/m)
    expect(rendererCss).toMatch(/^body\s*\{/m)
    expect(rendererCss).toMatch(/^\*\s*\{/m)
  })

  it("loads full shared renderer CSS only from the embedded customer preview renderer route", () => {
    const sourceFiles = collectSourceFiles(appRoot)
      .filter((file) => /\.(tsx?|jsx?)$/.test(file))
    const directRendererCssImportingFiles = sourceFiles
      .filter((file) => readFileSync(file, "utf8").includes(fullRendererStylesheetImport))
      .map((file) => path.relative(repoRoot, file).split(path.sep).join("/"))
      .sort()
    const generatedRendererStylesheetImportingFiles = sourceFiles
      .filter((file) => readFileSync(file, "utf8").includes(generatedRendererStylesheetImport))
      .map((file) => path.relative(repoRoot, file).split(path.sep).join("/"))
      .sort()

    expect(read("apps/cms/src/app/(frontend)/(site-preview)/layout.tsx").includes(fullRendererStylesheetImport)).toBe(false)
    expect(read("apps/cms/src/app/(frontend)/(site-preview)/layout.tsx").includes(generatedRendererStylesheetImport)).toBe(false)
    expect(read("apps/cms/src/styles/generated-site-renderer.css")).toContain(fullRendererCssImport)
    expect(directRendererCssImportingFiles).toEqual([])
    expect(generatedRendererStylesheetImportingFiles.length).toBeGreaterThan(0)
    expect(generatedRendererStylesheetImportingFiles.every((file) => embeddedRendererRoutePattern.test(file))).toBe(true)
  })

  it("keeps renderer canvas CSS out of CMS app-global CSS", () => {
    const siabCss = read("apps/cms/src/styles/siab.css")
    const globalsCss = read("apps/cms/src/styles/globals.css")

    expect(globalsCss).toContain('@import "./siab.css";')
    expect(globalsCss).toContain('@import "./shadcn.css";')
    expect(siabCss).toContain('@source "../../../../packages/site-renderer/src";')
    expect(siabCss).not.toContain(canvasCssImport)
    expect(siabCss).not.toContain("site-renderer-preview.css")
    expect(siabCss).not.toContain(fullRendererStylesheetImport)
  })

  it("loads scoped embedded renderer canvas CSS only from editor route layouts", () => {
    const canvasStylesheet = read("apps/cms/src/styles/site-renderer-canvas.css")
    const editorFrameRoot = path.join(repoRoot, "apps/cms/src/app/(editor-frame)")
    const importingFiles = [frontendRoot, payloadRoot, editorFrameRoot].flatMap((root) => collectSourceFiles(root))
      .filter((file) => readFileSync(file, "utf8").includes("site-renderer-canvas.css"))
      .map((file) => path.relative(repoRoot, file).split(path.sep).join("/"))

    expect(canvasStylesheet).toContain(canvasCssImport)
    expect(importingFiles.sort()).toEqual([
      "apps/cms/src/app/(editor-frame)/layout.tsx",
      "apps/cms/src/app/(frontend)/(admin)/pages/[id]/layout.tsx",
      "apps/cms/src/app/(frontend)/(admin)/pages/new/layout.tsx",
      "apps/cms/src/app/(frontend)/(admin)/sites/[slug]/pages/[id]/layout.tsx",
      "apps/cms/src/app/(frontend)/(admin)/sites/[slug]/pages/new/layout.tsx",
    ])
    for (const file of importingFiles) expect(read(file)).toContain(canvasStylesheetImport)
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
      .filter((line) => !["from {", "to {", "0% {", "50% {", "100% {"].includes(line))

    expect(ruleOpeners.length).toBeGreaterThan(0)
    expect(ruleOpeners.every((line) => line.includes(canvasScope))).toBe(true)
    expect(canvasCss).toContain(".site-renderer[data-siab-site-renderer][data-tenant-renderer=\"amicare\"] .animate-fade-up")
    expect(canvasCss).toContain(".site-renderer[data-siab-site-renderer][data-tenant-renderer=\"amicare\"] .cms-block--richtext .rt-themed-eyebrow")
  })

  it("loads shadcn CSS for editor UI in the embedded editor frame", () => {
    const editorFrameLayout = read("apps/cms/src/app/(editor-frame)/layout.tsx")
    const canvasStylesheet = read("apps/cms/src/styles/site-renderer-canvas.css")

    expect(editorFrameLayout).toContain('import "@/styles/shadcn.css"')
    expect(editorFrameLayout.indexOf('import "@/styles/generated-site-renderer.css"')).toBeLessThan(
      editorFrameLayout.indexOf('import "@/styles/shadcn.css"'),
    )
    expect(canvasStylesheet).not.toContain("--foreground:")
    expect(canvasStylesheet).not.toContain("--popover:")
  })

  it("covers Amicare canvas shell utilities without leaking Tailwind globals into admin", () => {
    const canvasCss = read("packages/site-renderer/src/canvas.css")

    expect(canvasCss).toContain(".site-renderer[data-siab-site-renderer][data-tenant-renderer=\"amicare\"] :where(.sticky)")
    expect(canvasCss).toContain(".site-renderer[data-siab-site-renderer][data-tenant-renderer=\"amicare\"] :where(.flex)")
    expect(canvasCss).toContain(".site-renderer[data-siab-site-renderer][data-tenant-renderer=\"amicare\"] :where(.w-full)")
    expect(canvasCss).toContain(".site-renderer[data-siab-site-renderer][data-tenant-renderer=\"amicare\"] :where(.aspect-\\[4\\/5\\])")
    expect(canvasCss).toContain(".site-renderer[data-siab-site-renderer][data-tenant-renderer=\"amicare\"] :where(.object-cover)")
    expect(canvasCss).toContain(".site-renderer[data-siab-site-renderer][data-tenant-renderer=\"amicare\"] [class~=\"@min-[48rem]/site-frame:aspect-[4/3]\"]")
    expect(canvasCss).toContain(".site-renderer[data-siab-site-renderer][data-tenant-renderer=\"amicare\"] [class~=\"@min-[48rem]/site-frame:px-12\"]")
    for (const count of [1, 2, 3, 4, 5, 6]) {
      expect(canvasCss).toContain(`.site-renderer[data-siab-site-renderer][data-tenant-renderer="amicare"] [class~="@min-[48rem]/site-frame:grid-cols-${count}"]`)
    }
    expect(canvasCss).toContain(".site-renderer[data-siab-site-renderer][data-tenant-renderer=\"amicare\"] [class~=\"@min-[64rem]/site-frame:px-20\"]")
    expect(canvasCss).not.toMatch(/(^|\n)\s*\.sticky\s*\{/)
    expect(canvasCss).not.toMatch(/(^|\n)\s*\.flex\s*\{/)
    expect(canvasCss).not.toMatch(/(^|\n)\s*\.w-full\s*\{/)
    expect(canvasCss).not.toMatch(/(^|\n)\s*\.grid-cols-[1-6]\s*\{/)
  })
})
