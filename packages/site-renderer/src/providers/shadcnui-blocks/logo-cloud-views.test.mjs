import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  logoCloud01CmsLike,
  logoCloud01Long,
  logoCloud01MaxItems,
  logoCloud01MissingImage,
  logoCloud01Sparse,
} from "./typed/fixtures/logo-cloud-01.ts"
import { LogoCloud01 } from "./variants/logo-cloud-01/logo-cloud.tsx"
import View from "./variants/logo-cloud-01/view.tsx"

globalThis.React = React

const mediaResolver = (media) => ({ src: media.url, alt: media.alt })

test("public render outputs title and resolved logo images", () => {
  const html = renderToStaticMarkup(React.createElement(LogoCloud01, {
    ...logoCloud01CmsLike,
    blockIndex: 0,
    mediaResolver,
  }))
  assert.match(html, />Trusted worldwide</)
  assert.match(html, /src="https:\/\/cdn\.example\.test\/acme\.svg"/)
  assert.match(html, /src="https:\/\/cdn\.example\.test\/globex\.svg"/)
})

test("sparse content renders only provided logos", () => {
  const html = renderToStaticMarkup(React.createElement(LogoCloud01, {
    ...logoCloud01Sparse,
    blockIndex: 0,
    mediaResolver,
  }))
  assert.match(html, />One partner</)
  assert.match(html, /solo\.svg/)
  assert.doesNotMatch(html, /globex\.svg/)
})

test("minimum content tolerates empty logos", () => {
  const html = renderToStaticMarkup(React.createElement(LogoCloud01, {
    logos: [],
    blockIndex: 0,
  }))
  assert.doesNotMatch(html, /<img /)
})

test("maximum content caps logos at four", () => {
  const html = renderToStaticMarkup(React.createElement(LogoCloud01, {
    ...logoCloud01MaxItems,
    blockIndex: 0,
    mediaResolver,
  }))
  assert.match(html, /one\.svg/)
  assert.match(html, /four\.svg/)
  assert.doesNotMatch(html, /five\.svg/)
})

test("missing image omits logo without crashing", () => {
  assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(LogoCloud01, {
    ...logoCloud01MissingImage,
    blockIndex: 0,
  })))
  const html = renderToStaticMarkup(React.createElement(LogoCloud01, {
    ...logoCloud01MissingImage,
    blockIndex: 0,
  }))
  assert.match(html, />No artwork yet</)
  assert.doesNotMatch(html, /<img /)
})

test("long title does not throw", () => {
  assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(LogoCloud01, {
    ...logoCloud01Long,
    blockIndex: 0,
    mediaResolver,
  })))
})

test("editSlots use itemIndex for nested logo images", () => {
  const called = []
  const html = renderToStaticMarkup(React.createElement(LogoCloud01, {
    title: logoCloud01CmsLike.title,
    logos: [
      logoCloud01CmsLike.logos[0],
      { name: "Missing", image: undefined },
    ],
    blockIndex: 3,
    editSlots: {
      renderRichText: ({ elementPath }) => {
        called.push(`rich:${elementPath.field}`)
        return React.createElement("span", { "data-edit-rich": elementPath.field })
      },
      renderImage: ({ elementPath }) => {
        called.push(`image:${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`)
        return React.createElement("span", {
          "data-edit-image": `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`,
        })
      },
    },
  }))
  assert.deepEqual(
    new Set(called),
    new Set(["rich:title", "image:logos:0:image", "image:logos:1:image"]),
  )
  assert.match(html, /data-edit-rich="title"/)
  assert.match(html, /data-edit-image="logos:0:image"/)
  assert.match(html, /data-edit-image="logos:1:image"/)
})

test("view maps block to typed component with provider attributes", () => {
  const html = renderToStaticMarkup(React.createElement(View, {
    block: {
      blockType: "logoCloud",
      title: logoCloud01CmsLike.title,
      logos: [logoCloud01CmsLike.logos[0]],
    },
    options: {
      index: 2,
      mediaResolver,
    },
  }))
  assert.match(html, /data-provider-variant="shadcnui-blocks\.logo-cloud-01"/)
  assert.match(html, /data-block-index="2"/)
  assert.match(html, />Trusted worldwide</)
  assert.match(html, /acme\.svg/)
})
