import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")
const cmsRoot = path.join(repoRoot, "apps/cms")
const appRoot = path.join(cmsRoot, "src/app")
const fullRendererStylesheetImport = 'import "@siteinabox/site-renderer/styles.css"'
const generatedRendererStylesheetImport = 'import "@/styles/generated-site-renderer.css"'
const fullRendererCssImport = '@import "@siteinabox/site-renderer/styles.css";'
const embeddedRendererRoutePattern = /\/(?:\(renderer-frame\)|\(editor-frame\)|renderer-iframe|renderer-frame|editor-frame|site-renderer-frame|embedded-renderer)\//

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

function collectSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) return collectSourceFiles(fullPath)
    return /\.(tsx?|jsx?|css)$/.test(entry) ? [fullPath] : []
  })
}

function sourcePath(relativePath: string) {
  return path.relative(repoRoot, path.join(cmsRoot, relativePath)).split(path.sep).join("/")
}

function findRendererHostSource() {
  const candidates = collectSourceFiles(path.join(cmsRoot, "src/components"))
    .filter((file) => /\.(tsx?|jsx?)$/.test(file))
    .map((file) => ({ file, source: readFileSync(file, "utf8") }))
    .filter(({ source }) => source.includes("data-siab-renderer-frame") || /<iframe\b/i.test(source))

  const explicitHost = candidates.find(({ file, source }) => (
    /PreviewCustomizer\.tsx?$/.test(file) ||
    source.includes("data-siab-renderer-frame")
  ))

  return explicitHost
    ? { relativePath: path.relative(repoRoot, explicitHost.file).split(path.sep).join("/"), source: explicitHost.source }
    : null
}

describe("renderer iframe source contract", () => {
  it("keeps customer preview on the shared iframe renderer host", () => {
    const previewCustomizer = read(sourcePath("src/components/preview/PreviewCustomizer.tsx"))

    expect(previewCustomizer).toContain("/renderer-frame/preview/")
    expect(previewCustomizer).toContain("data-siab-renderer-frame")
    expect(previewCustomizer).toMatch(/<iframe\b/i)
    expect(previewCustomizer.includes("@/components/editor/canvas/CanvasMode")).toBe(false)
    expect(previewCustomizer.includes("<CanvasMode")).toBe(false)
    expect(previewCustomizer.includes("SitePageRenderer")).toBe(false)
  })

  it("defines the generated-site iframe host as a CMS shell without renderer DOM or CSS imports", () => {
    const host = findRendererHostSource()

    expect(host).not.toBeNull()
    if (!host) return
    expect(host.relativePath).toBe("apps/cms/src/components/preview/PreviewCustomizer.tsx")
    expect(/<iframe\b/i.test(host.source)).toBe(true)
    expect(/\bsandbox=/.test(host.source)).toBe(true)
    expect(host.source.includes("@/components/editor/canvas/CanvasMode")).toBe(false)
    expect(host.source.includes("@siteinabox/site-renderer")).toBe(false)
    expect(host.source.includes("@siteinabox/site-renderer/styles.css")).toBe(false)
    expect(host.source.includes("site-renderer-canvas.css")).toBe(false)
    expect(host.source.includes("<SitePageRenderer")).toBe(false)
  })

  it("loads full renderer CSS only inside the embedded renderer route, not CMS layouts", () => {
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
    const generatedRendererCss = read("apps/cms/src/styles/generated-site-renderer.css")

    expect(read("apps/cms/src/app/(frontend)/layout.tsx").includes(fullRendererStylesheetImport)).toBe(false)
    expect(read("apps/cms/src/app/(frontend)/(admin)/layout.tsx").includes(fullRendererStylesheetImport)).toBe(false)
    expect(read("apps/cms/src/app/(frontend)/(site-preview)/layout.tsx").includes(fullRendererStylesheetImport)).toBe(false)
    expect(read("apps/cms/src/app/(frontend)/layout.tsx").includes(generatedRendererStylesheetImport)).toBe(false)
    expect(read("apps/cms/src/app/(frontend)/(admin)/layout.tsx").includes(generatedRendererStylesheetImport)).toBe(false)
    expect(read("apps/cms/src/app/(frontend)/(site-preview)/layout.tsx").includes(generatedRendererStylesheetImport)).toBe(false)
    expect(directRendererCssImportingFiles).toEqual([])
    expect(generatedRendererStylesheetImportingFiles.length).toBeGreaterThan(0)
    expect(generatedRendererStylesheetImportingFiles.every((file) => embeddedRendererRoutePattern.test(file))).toBe(true)
    expect(generatedRendererCss).toContain(fullRendererCssImport)
  })

  it("uses the shared iframe-editor protocol for customer preview messages", () => {
    const previewCustomizer = read(sourcePath("src/components/preview/PreviewCustomizer.tsx"))
    const frameRuntime = read(sourcePath("src/components/renderer-frame/RendererFrameRuntime.tsx"))
    const contracts = read("packages/contracts/src/iframe-editor.ts")

    expect(contracts).toContain('IFRAME_EDITOR_PROTOCOL_NAME = "siab.iframe-editor"')
    expect(contracts).toContain('"renderer.ready"')
    expect(contracts).toContain('"render.snapshot"')
    expect(previewCustomizer).toContain("@siteinabox/contracts")
    expect(previewCustomizer).toContain("IFRAME_EDITOR_PROTOCOL_NAME")
    expect(previewCustomizer).toContain('type: "render.snapshot"')
    expect(previewCustomizer).not.toContain("siab.renderer.")
    expect(frameRuntime).toContain("@siteinabox/contracts")
    expect(frameRuntime).toContain("validateIframeEditorMessage")
    expect(frameRuntime).toContain('mode = "preview"')
    expect(frameRuntime).toContain('mode?: "preview" | "editor"')
    expect(frameRuntime).toContain('mode === "preview" && message.type !== "render.snapshot"')
    expect(frameRuntime).toContain("if (mode !== \"preview\") return")
    expect(frameRuntime).toContain('type: "renderer.ready"')
    expect(frameRuntime).not.toContain("capabilities:")
    expect(contracts).not.toContain("fieldEditing")
    expect(contracts).not.toContain("assetPicking")
    expect(contracts).not.toContain("viewportResize")
    expect(frameRuntime).not.toContain("siab.renderer.")
  })

  it("passes the request CSP nonce through the renderer-frame shell into the active-variant renderer", () => {
    const layout = read("apps/cms/src/app/(renderer-frame)/layout.tsx")
    const frameRuntime = read(sourcePath("src/components/renderer-frame/RendererFrameRuntime.tsx"))

    expect(layout).toContain('import { headers } from "next/headers"')
    expect(layout).toContain('import { CspNonceProvider } from "@siteinabox/ui/lib/csp-nonce"')
    expect(layout).toContain('const nonce = (await headers()).get("x-csp-nonce") ?? undefined')
    expect(layout).toContain("<CspNonceProvider nonce={nonce}>")
    expect(layout.indexOf("<CspNonceProvider nonce={nonce}>")).toBeLessThan(
      layout.indexOf("{children}"),
    )

    expect(frameRuntime).toContain('import { useCspNonce } from "@siteinabox/ui/lib/csp-nonce"')
    expect(frameRuntime).toContain("const cspNonce = useCspNonce()")
    expect(frameRuntime).toContain("nonce={cspNonce}")
    expect(frameRuntime.indexOf("const cspNonce = useCspNonce()")).toBeLessThan(
      frameRuntime.indexOf("<ClientSitePageRenderer"),
    )
    expect(frameRuntime.indexOf("nonce={cspNonce}")).toBeGreaterThan(
      frameRuntime.indexOf("<SitePageRenderer"),
    )
  })
})
