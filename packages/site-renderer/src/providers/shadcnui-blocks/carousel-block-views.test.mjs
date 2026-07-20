import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  carouselBlock01CmsLike,
  carouselBlock02CmsLike,
  galleryFamilyEmptyItems,
  galleryFamilySparse,
} from "./typed/fixtures/gallery-family.ts"
import { CarouselBlock01 } from "./variants/carousel-block-01/carousel.tsx"
import CarouselBlock01View from "./variants/carousel-block-01/view.tsx"
import { CarouselBlock02 } from "./variants/carousel-block-02/carousel.tsx"
import CarouselBlock02View from "./variants/carousel-block-02/view.tsx"

globalThis.React = React

const mediaResolver = (media) => ({ src: media.url, alt: media.alt })

const carouselFamily = [
  {
    id: "shadcnui-blocks.carousel-block-01",
    Component: CarouselBlock01,
    View: CarouselBlock01View,
    cmsLike: carouselBlock01CmsLike,
    sparse: galleryFamilySparse,
    emptyItems: galleryFamilyEmptyItems,
    distinctive: /max-w-5xl px-14/,
    itemMatch: /dddepth|Abstract 3D Shapes/,
  },
  {
    id: "shadcnui-blocks.carousel-block-02",
    Component: CarouselBlock02,
    View: CarouselBlock02View,
    cmsLike: carouselBlock02CmsLike,
    sparse: galleryFamilySparse,
    emptyItems: galleryFamilyEmptyItems,
    distinctive: /shadow-xl\/3 ring ring-border\/80/,
    itemMatch: /dddepth|Abstract 3D Shapes/,
  },
]

for (const variant of carouselFamily) {
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
    const block = { blockType: "gallery", ...variant.cmsLike }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 1, mediaResolver },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
  })
}
