import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  blog01CmsLike,
  blog04CmsLike,
  blogFamilyCmsLike,
  blogFamilyEmptyItems,
  blogFamilySparse,
} from "./typed/fixtures/blog-family.ts"
import { Blog01 } from "./variants/blog-01/blog.tsx"
import Blog01View from "./variants/blog-01/view.tsx"
import { Blog03 } from "./variants/blog-03/blog.tsx"
import Blog03View from "./variants/blog-03/view.tsx"
import { Blog04 } from "./variants/blog-04/blog.tsx"
import Blog04View from "./variants/blog-04/view.tsx"

globalThis.React = React

const mediaResolver = (media) => ({ src: media.url, alt: media.alt })

const blogFamily = [
  {
    id: "shadcnui-blocks.blog-01",
    Component: Blog01,
    View: Blog01View,
    cmsLike: blog01CmsLike,
    sparse: blogFamilySparse,
    emptyItems: blogFamilyEmptyItems,
    distinctive: /bg-muted\/30/,
    itemMatch: /future of web development|React Server Components/,
  },
  {
    id: "shadcnui-blocks.blog-03",
    Component: Blog03,
    View: Blog03View,
    cmsLike: { title: blogFamilyCmsLike.title, posts: blogFamilyCmsLike.posts },
    sparse: blogFamilySparse,
    emptyItems: blogFamilyEmptyItems,
    distinctive: /lg:flex-row/,
    itemMatch: /future of web development/,
  },
  {
    id: "shadcnui-blocks.blog-04",
    Component: Blog04,
    View: Blog04View,
    cmsLike: blog04CmsLike,
    sparse: blogFamilySparse,
    emptyItems: blogFamilyEmptyItems,
    distinctive: /gap-y-14/,
    itemMatch: /Welcome to our blog|React Server Components/,
  },
]

for (const variant of blogFamily) {
  test(`${variant.id} public render outputs layout markup`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
      mediaResolver,
    }))
    assert.match(html, variant.distinctive)
    assert.match(html, variant.itemMatch)
  })

  test(`${variant.id} view maps block fields and provider attributes`, () => {
    const block = { blockType: "blogCards", ...variant.cmsLike }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 1, mediaResolver },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
  })
}
