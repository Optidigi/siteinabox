import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"

// Exercise the public DOM adapter from the exact dependency instance Payload
// consumes, including the cross-major happy-dom security override.
const cmsRequire = createRequire(new URL("../../package.json", import.meta.url))
const lexicalRequire = createRequire(cmsRequire.resolve("@payloadcms/richtext-lexical"))
const { withDOM } = lexicalRequire("@lexical/headless/dom")
const { createHeadlessEditor } = lexicalRequire("@lexical/headless")
const { $getRoot } = lexicalRequire("lexical")
const { $generateNodesFromDOM, $generateHtmlFromNodes } = lexicalRequire("@lexical/html")
const { HeadingNode } = lexicalRequire("@lexical/rich-text")
const { LinkNode } = lexicalRequire("@lexical/link")

test("Payload's headless DOM preserves HTML semantics through Lexical import/export", () => {
  const previousDocument = globalThis.document
  const html = withDOM(window => {
    const editor = createHeadlessEditor({ namespace: "SecurityPatchContract", nodes: [HeadingNode, LinkNode], onError: error => { throw error } })
    const document = new window.DOMParser().parseFromString('<h2>Heading</h2><p>Hello <strong>team</strong> <a href="https://example.test/path">link</a></p>', "text/html")
    editor.update(() => { $getRoot().append(...$generateNodesFromDOM(editor, document)) }, { discrete: true })
    return editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null))
  })
  withDOM(window => {
    const document = new window.DOMParser().parseFromString(html, "text/html")
    assert.equal(document.querySelector("h2")?.textContent, "Heading")
    assert.equal(document.querySelector("strong")?.textContent, "team")
    assert.equal(document.querySelector("a")?.href, "https://example.test/path")
    assert.match(document.body.textContent, /Hello team link/)
  })
  assert.equal(globalThis.document, previousDocument)
})

test("headless DOM restores ambient globals after conversion errors", () => {
  const previousDocument = globalThis.document
  assert.throws(() => withDOM(() => { throw new Error("synthetic conversion failure") }), /synthetic conversion failure/)
  assert.equal(globalThis.document, previousDocument)
})
