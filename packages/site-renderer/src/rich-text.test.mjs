import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { RtRootSchema } from "@siteinabox/contracts"
import { RichTextRenderer } from "./rich-text/RichTextRenderer.tsx"

const corpus = JSON.parse(
  await readFile(new URL("../../../docs/contracts/rich-text-fixtures.json", import.meta.url), "utf8"),
)

globalThis.React = React

const expectedFragments = new Map([
  ["empty-block", []],
  ["paragraph-plain", ['<p class="rt-p">Hello world.</p>']],
  ["heading-and-paragraph", [
    '<h2 class="rt-h rt-h-2">Title</h2>',
    '<p class="rt-p">Body</p>',
  ]],
  ["marks-bold-italic-link", [
    '<p class="rt-p">',
    '<strong class="rt-b">bold</strong>',
    '<em class="rt-i">italic</em>',
    '<a class="rt-link" href="https://example.com">link</a>',
  ]],
  ["list-bullet", [
    '<ul class="rt-ul">',
    '<li class="rt-li"><p class="rt-p">one</p></li>',
    '<li class="rt-li"><p class="rt-p">two</p></li>',
  ]],
  ["themed-eyebrow", [
    '<div class="rt-themed rt-themed-eyebrow" data-rt-id="eyebrow">',
    "Over mij",
    '<h2 class="rt-h rt-h-2">About me</h2>',
  ]],
  ["inline-headline", [
    '<em class="rt-i">hart</em>',
    "Jeugdzorg met",
    "en toewijding.",
  ]],
])

test("rich-text fixture corpus stays valid and exercises the renderer DOM contract", () => {
  assert.equal(corpus.version, 1)
  assert.ok(Array.isArray(corpus.fixtures))
  assert.equal(new Set(corpus.fixtures.map((fixture) => fixture.name)).size, corpus.fixtures.length)
  assert.deepEqual([...expectedFragments.keys()].sort(), corpus.fixtures.map((fixture) => fixture.name).sort())

  for (const fixture of corpus.fixtures) {
    const value = RtRootSchema.parse(fixture.rt)
    const html = renderToStaticMarkup(React.createElement(RichTextRenderer, { value }))
    for (const fragment of expectedFragments.get(fixture.name)) {
      assert.ok(html.includes(fragment), `${fixture.name} is missing ${fragment}`)
    }
  }
})
