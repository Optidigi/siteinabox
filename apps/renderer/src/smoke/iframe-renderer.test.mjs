import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../")
const routePath = resolve(root, "src/pages/_renderer/editor.astro")
const runtimePath = resolve(root, "src/client/renderer-editor-runtime.tsx")

test("renderer editor iframe route loads renderer CSS and runtime", async () => {
  const route = await readFile(routePath, "utf8")

  assert.match(route, /import "\.\.\/styles\/site\.css"/)
  assert.match(route, /renderer-editor-runtime/)
  assert.match(route, /data-siab-renderer-frame="editor"/)
})

test("renderer editor iframe files do not import CMS CSS or CMS source", async () => {
  const [route, runtime] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(runtimePath, "utf8"),
  ])
  const source = `${route}\n${runtime}`

  assert.doesNotMatch(source, /apps\/cms/)
  assert.doesNotMatch(source, /from ["'][^"']*cms/i)
  assert.doesNotMatch(source, /import ["'][^"']*cms/i)
  assert.doesNotMatch(source, /cms\.css/i)
})

test("renderer editor iframe runtime speaks the structured renderer protocol", async () => {
  const runtime = await readFile(runtimePath, "utf8")

  assert.match(runtime, /@siteinabox\/contracts\/iframe-editor/)
  assert.match(runtime, /IFRAME_EDITOR_PROTOCOL_NAME/)
  assert.match(runtime, /validateIframeEditorMessage/)
  assert.match(runtime, /"renderer\.ready"/)
  assert.match(runtime, /"page\.replace"/)
  assert.match(runtime, /"theme\.patch"/)
  assert.match(runtime, /"block\.patch"/)
  assert.doesNotMatch(runtime, /renderer\.updatePage/)
  assert.doesNotMatch(runtime, /renderer\.updateTheme/)
  assert.doesNotMatch(runtime, /renderer\.replaceBlock/)
  assert.match(runtime, /SitePageRenderer/)
})
