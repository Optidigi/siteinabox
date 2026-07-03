import * as React from "react"
import type { TeamBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function TeamBlockRenderer({ block, options }: { block: TeamBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  if ((!block.members || block.members.length === 0) && !renderSlot) return null
  const members: TeamBlock["members"] = block.members && block.members.length > 0
    ? block.members
    : [{ name: "", role: "", bio: undefined, image: undefined as any, links: [] }]
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const sectionProps = mergeRendererSectionProps(
    {
      id: renderSlot
        ? resolveBlockAnchor(block, { legacyTenant: options.variantContext?.legacyTenant, surface: options.surface })
        : block.anchor || undefined,
      className: cx("cms-block cms-block--team", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "team", options.index),
    },
    options.sectionProps,
  )
  const title = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.title,
      path: { blockIndex: options.index, field: "title" },
      variant: "inline",
      as: "h2",
      className: cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext)),
      placeholder: "Team title",
      blockMode: "inline",
      style: { fontFamily: "var(--font-heading)" },
    })
    : block.title ? (
      <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title", options.variantContext))} style={{ fontFamily: "var(--font-heading)" }}>
        <RichTextRenderer value={block.title} blockMode="inline" />
      </h2>
    ) : null
  const intro = renderSlot
    ? renderSlot({
      kind: "richtext",
      value: block.intro,
      path: { blockIndex: options.index, field: "intro" },
      variant: "block",
      as: "div",
      className: cx("cms-block__intro", nativeBlockClassName(block, "intro", options.variantContext)),
      placeholder: "Intro",
      style: { fontFamily: "var(--font-text)" },
    })
    : block.intro ? (
      <div className={cx("cms-block__intro", nativeBlockClassName(block, "intro", options.variantContext))} style={{ fontFamily: "var(--font-text)" }}>
        <RichTextRenderer value={block.intro} />
      </div>
    ) : null

  return (
    <section {...sectionProps}>
      <div className={cx("cms-block__teamIntro", nativeBlockClassName(block, "header", options.variantContext))}>
        {title}
        {intro}
      </div>
      <ul className={cx("cms-block__teamList", nativeBlockClassName(block, "list", options.variantContext))}>
        {members.map((member, i) => {
          const image = resolveMedia(member.image ?? null, options.mediaResolver)
          return (
            <li key={i} className={cx("cms-block__teamMember", nativeBlockClassName(block, "item", options.variantContext))}>
              {renderSlot
                ? renderSlot({
                  kind: "image",
                  value: member.image,
                  path: { blockIndex: options.index, field: "members", itemIndex: i, subField: "image" },
                  className: nativeBlockClassName(block, "image", options.variantContext),
                  alt: image?.alt ?? "",
                })
                : image && <img className={nativeBlockClassName(block, "image", options.variantContext)} src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" />}
              <div>
                <h3>
                  {renderSlot
                    ? renderSlot({
                      kind: "text",
                      value: member.name,
                      path: { blockIndex: options.index, field: "members", itemIndex: i, subField: "name" },
                      placeholder: "Name",
                    })
                    : member.name}
                </h3>
                {(member.role || renderSlot) && (
                  <p className="cms-block__teamRole">
                    {renderSlot
                      ? renderSlot({
                        kind: "text",
                        value: member.role,
                        path: { blockIndex: options.index, field: "members", itemIndex: i, subField: "role" },
                        placeholder: "Role",
                      })
                      : member.role}
                  </p>
                )}
                {renderSlot ? (
                  <div className="cms-block__teamBio">
                    {renderSlot({
                      kind: "richtext",
                      value: member.bio,
                      path: { blockIndex: options.index, field: "members", itemIndex: i, subField: "bio" },
                      variant: "block",
                      as: "div",
                      placeholder: "Bio",
                    })}
                  </div>
                ) : member.bio && (
                  <div className="cms-block__teamBio">
                    <RichTextRenderer value={member.bio} />
                  </div>
                )}
                {member.links && member.links.length > 0 && (
                  <p className="cms-block__teamLinks">
                    {member.links.map((link, linkIndex) =>
                      link.href && link.label ? (
                        <a key={linkIndex} href={link.href} {...actionAnalyticsAttrs("inline", link.label)}>
                          {link.label}
                        </a>
                      ) : null,
                    )}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
