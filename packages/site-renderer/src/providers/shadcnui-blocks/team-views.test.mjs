import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  team01CmsLike,
  team01EmptyMembers,
  team01Long,
  team01Sparse,
} from "./typed/fixtures/team-01.ts"
import {
  team02CmsLike,
  team03CmsLike,
  team04CmsLike,
  team05CmsLike,
  team06CmsLike,
  teamFamilyCmsLike,
  teamFamilyEmptyMembers,
  teamFamilyLong,
  teamFamilySparse,
} from "./typed/fixtures/team-family.ts"
import { Team01 } from "./variants/team-01/team.tsx"
import Team01View from "./variants/team-01/view.tsx"
import { Team02 } from "./variants/team-02/team.tsx"
import Team02View from "./variants/team-02/view.tsx"
import { Team03 } from "./variants/team-03/team.tsx"
import Team03View from "./variants/team-03/view.tsx"
import { Team04 } from "./variants/team-04/team.tsx"
import Team04View from "./variants/team-04/view.tsx"
import { Team05 } from "./variants/team-05/team.tsx"
import Team05View from "./variants/team-05/view.tsx"
import { Team06 } from "./variants/team-06/team.tsx"
import Team06View from "./variants/team-06/view.tsx"
import { Team07 } from "./variants/team-07/team.tsx"
import Team07View from "./variants/team-07/view.tsx"
import { Team08 } from "./variants/team-08/team.tsx"
import Team08View from "./variants/team-08/view.tsx"
import { Team09 } from "./variants/team-09/team.tsx"
import Team09View from "./variants/team-09/view.tsx"
import { Team10 } from "./variants/team-10/team.tsx"
import Team10View from "./variants/team-10/view.tsx"
import { Team11 } from "./variants/team-11/team.tsx"
import Team11View from "./variants/team-11/view.tsx"
import { Team12 } from "./variants/team-12/team.tsx"
import Team12View from "./variants/team-12/view.tsx"
import { Team13 } from "./variants/team-13/team.tsx"
import Team13View from "./variants/team-13/view.tsx"

globalThis.React = React

const mediaResolver = (media) => ({ src: media.url, alt: media.alt })

const teamFamily = [
  {
    id: "shadcnui-blocks.team-01",
    Component: Team01,
    View: Team01View,
    cmsLike: team01CmsLike,
    sparse: team01Sparse,
    long: team01Long,
    emptyItems: team01EmptyMembers,
    maxItems: 8,
    distinctive: /max-w-\(--breakpoint-lg\)/,
    memberMatch: /Liam Martinez|Ava Thompson/,
  },
  {
    id: "shadcnui-blocks.team-02",
    Component: Team02,
    View: Team02View,
    cmsLike: team02CmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 8,
    distinctive: /md:grid-cols-4/,
    memberMatch: /John Doe|Jane Doe/,
  },
  {
    id: "shadcnui-blocks.team-03",
    Component: Team03,
    View: Team03View,
    cmsLike: team03CmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 6,
    distinctive: /lg:flex-row/,
    memberMatch: /John Doe|Jane Doe/,
  },
  {
    id: "shadcnui-blocks.team-04",
    Component: Team04,
    View: Team04View,
    cmsLike: team04CmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 8,
    distinctive: /rounded-lg bg-accent/,
    memberMatch: /John Doe|Jane Doe/,
  },
  {
    id: "shadcnui-blocks.team-05",
    Component: Team05,
    View: Team05View,
    cmsLike: team05CmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 8,
    distinctive: /aspect-square w-full/,
    memberMatch: /John Doe|Jane Doe/,
  },
  {
    id: "shadcnui-blocks.team-06",
    Component: Team06,
    View: Team06View,
    cmsLike: team06CmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 8,
    distinctive: /lg:grid-cols-4/,
    memberMatch: /Liam Martinez|Ava Thompson/,
  },
  {
    id: "shadcnui-blocks.team-07",
    Component: Team07,
    View: Team07View,
    cmsLike: teamFamilyCmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 8,
    distinctive: /-mt-px -ml-px border/,
    memberMatch: /Liam Martinez|Ava Thompson/,
  },
  {
    id: "shadcnui-blocks.team-08",
    Component: Team08,
    View: Team08View,
    cmsLike: team06CmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 8,
    distinctive: /rounded-xl border border-border\/75 bg-muted/,
    memberMatch: /Liam Martinez|Ava Thompson/,
  },
  {
    id: "shadcnui-blocks.team-09",
    Component: Team09,
    View: Team09View,
    cmsLike: teamFamilyCmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 8,
    distinctive: /border bg-muted py-8/,
    memberMatch: /Liam Martinez|Ava Thompson/,
  },
  {
    id: "shadcnui-blocks.team-10",
    Component: Team10,
    View: Team10View,
    cmsLike: team06CmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 8,
    distinctive: /CarouselContent|border bg-muted py-12/,
    memberMatch: /Liam Martinez|Ava Thompson/,
  },
  {
    id: "shadcnui-blocks.team-11",
    Component: Team11,
    View: Team11View,
    cmsLike: teamFamilyCmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 8,
    distinctive: /lg:grid-cols-3/,
    memberMatch: /Liam Martinez|Ava Thompson/,
  },
  {
    id: "shadcnui-blocks.team-12",
    Component: Team12,
    View: Team12View,
    cmsLike: team06CmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 9,
    distinctive: /border-e border-b/,
    memberMatch: /Liam Martinez|Ava Thompson/,
  },
  {
    id: "shadcnui-blocks.team-13",
    Component: Team13,
    View: Team13View,
    cmsLike: teamFamilyCmsLike,
    sparse: teamFamilySparse,
    long: teamFamilyLong,
    emptyItems: teamFamilyEmptyMembers,
    maxItems: 8,
    distinctive: /bg-linear-to-t from-foreground\/90/,
    memberMatch: /Liam Martinez|Ava Thompson/,
  },
]

for (const variant of teamFamily) {
  test(`${variant.id} public render outputs layout markup with member names`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.cmsLike,
      blockIndex: 0,
      mediaResolver,
    }))
    assert.match(html, variant.distinctive)
    assert.match(html, variant.memberMatch)
  })

  test(`${variant.id} sparse content omits optional title`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.sparse,
      blockIndex: 0,
      mediaResolver,
    }))
    assert.doesNotMatch(html, /<h2/)
    assert.match(html, /Solo Member/)
  })

  test(`${variant.id} empty members renders without member rows`, () => {
    const html = renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.emptyItems,
      blockIndex: 0,
      mediaResolver,
    }))
    assert.doesNotMatch(html, variant.memberMatch)
  })

  test(`${variant.id} long title and values do not throw`, () => {
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(variant.Component, {
      ...variant.long,
      blockIndex: 0,
      mediaResolver,
    })))
  })

  test(`${variant.id} view maps block fields and provider attributes`, () => {
    const block = {
      blockType: "team",
      title: variant.cmsLike.title,
      intro: variant.cmsLike.intro,
      members: variant.cmsLike.members,
    }
    const html = renderToStaticMarkup(React.createElement(variant.View, {
      block,
      options: { index: 2, mediaResolver },
    }))
    assert.match(html, new RegExp(`data-provider-variant="${variant.id.replace(".", "\\.")}"`))
    assert.match(html, /data-block-index="2"/)
    assert.match(html, variant.memberMatch)
  })

  if (variant.maxItems) {
    test(`${variant.id} respects static member capacity`, () => {
      const paddedMembers = [...variant.cmsLike.members]
      while (paddedMembers.length < variant.maxItems) {
        paddedMembers.push({
          name: `Capacity filler ${paddedMembers.length}`,
          role: `Role ${paddedMembers.length}`,
          image: { url: "https://cdn.example.test/filler.jpg", alt: "Filler" },
        })
      }
      const overflow = {
        ...variant.cmsLike,
        members: [
          ...paddedMembers,
          { name: "Overflow member", role: "Overflow role", image: { url: "https://cdn.example.test/overflow.jpg", alt: "Overflow" } },
        ],
      }
      const html = renderToStaticMarkup(React.createElement(variant.Component, {
        ...overflow,
        blockIndex: 0,
        mediaResolver,
      }))
      assert.doesNotMatch(html, /Overflow member/)
    })
  }
}

test("team-01 editSlots use itemIndex for nested member fields", () => {
  const called = []
  const html = renderToStaticMarkup(React.createElement(Team01, {
    title: team01CmsLike.title,
    intro: team01CmsLike.intro,
    members: team01CmsLike.members,
    blockIndex: 3,
    editSlots: {
      renderRichText: ({ elementPath }) => {
        called.push(`rich:${elementPath.field}`)
        return React.createElement("span", { "data-edit-rich": elementPath.field })
      },
      renderText: ({ elementPath }) => {
        called.push(`text:${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`)
        return React.createElement("span", {
          "data-edit-text": `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`,
        })
      },
      renderImage: ({ elementPath }) => {
        called.push(`image:${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`)
        return React.createElement("img", {
          "data-edit-image": `${elementPath.field}:${elementPath.itemIndex}:${elementPath.subField}`,
          alt: "",
        })
      },
    },
    mediaResolver,
  }))
  assert.deepEqual(
    new Set(called),
    new Set([
      "rich:title",
      "rich:intro",
      "image:members:0:image",
      "text:members:0:name",
      "text:members:0:role",
      "image:members:1:image",
      "text:members:1:name",
      "text:members:1:role",
    ]),
  )
  assert.match(html, /data-edit-text="members:0:name"/)
  assert.match(html, /data-edit-image="members:1:image"/)
})
