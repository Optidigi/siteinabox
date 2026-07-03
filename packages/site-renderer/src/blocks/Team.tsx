import * as React from "react"
import type { TeamBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { resolveMedia } from "../media"
import { RichTextRenderer } from "../rich-text"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function TeamBlockRenderer({ block, options }: { block: TeamBlock; options: BlockRenderOptions }) {
  if (!block.members.length) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={cx("cms-block cms-block--team", sourceVariant, nativeBlockClassName(block, "section"))}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "team", options.index)}
    >
      <div className={cx("cms-block__teamIntro", nativeBlockClassName(block, "header"))}>
        {block.title && (
          <h2 className={cx("cms-block__title", nativeBlockClassName(block, "title"))} style={{ fontFamily: "var(--font-heading)" }}>
            <RichTextRenderer value={block.title} blockMode="inline" />
          </h2>
        )}
        {block.intro && (
          <div className={cx("cms-block__intro", nativeBlockClassName(block, "intro"))} style={{ fontFamily: "var(--font-text)" }}>
            <RichTextRenderer value={block.intro} />
          </div>
        )}
      </div>
      <ul className={cx("cms-block__teamList", nativeBlockClassName(block, "list"))}>
        {block.members.map((member, i) => {
          const image = resolveMedia(member.image ?? null, options.mediaResolver)
          return (
            <li key={i} className={cx("cms-block__teamMember", nativeBlockClassName(block, "item"))}>
              {image && <img className={nativeBlockClassName(block, "image")} src={image.src} alt={image.alt ?? ""} loading="lazy" decoding="async" />}
              <div>
                <h3>{member.name}</h3>
                {member.role && <p className="cms-block__teamRole">{member.role}</p>}
                {member.bio && (
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
