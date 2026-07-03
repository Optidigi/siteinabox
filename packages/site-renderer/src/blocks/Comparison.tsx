import * as React from "react"
import type { ComparisonBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import { resolveBlockAnchor } from "./anchors"
import { cx, nativeBlockClassName } from "./native-classes"
import type { BlockRenderOptions } from "./types"
import { mergeRendererSectionProps } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function ComparisonBlockRenderer({ block, options }: { block: ComparisonBlock; options: BlockRenderOptions }) {
  const renderSlot = options.slots?.render
  if (((!block.columns || block.columns.length === 0) || (!block.rows || block.rows.length === 0)) && !renderSlot) return null
  const columns: ComparisonBlock["columns"] = block.columns && block.columns.length > 0
    ? block.columns
    : [{ title: undefined as any, description: undefined, cta: null }]
  const rows: ComparisonBlock["rows"] = block.rows && block.rows.length > 0
    ? block.rows
    : [{ label: "Feature", values: [] }]
  const sourceVariant = rendererVariantClassName(block, options.variantContext)
  const sectionProps = mergeRendererSectionProps(
    {
      id: renderSlot
        ? resolveBlockAnchor(block, { legacyTenant: options.variantContext?.legacyTenant, surface: options.surface })
        : block.anchor || undefined,
      className: cx("cms-block cms-block--comparisonMatrix", sourceVariant, nativeBlockClassName(block, "section", options.variantContext)),
      "data-source-variant": runtimeVariantDataAttribute(block, options.variantContext),
      "data-block-index": options.index,
      ...sectionAnalyticsAttrs(block.analytics, "comparison", options.index),
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
      placeholder: "Comparison title",
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
      {(renderSlot || block.title || block.intro) && (
        <div className={cx("cms-block__matrixHeader", nativeBlockClassName(block, "header", options.variantContext))}>
          {title}
          {intro}
        </div>
      )}
      <div className={cx("cms-block__matrixScroll", nativeBlockClassName(block, "scroll", options.variantContext))}>
        <table className={cx("cms-block__matrix", nativeBlockClassName(block, "table", options.variantContext))}>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              {columns.map((column, i) => (
                <th key={i} scope="col">
                  <span>
                    {renderSlot
                      ? renderSlot({
                        kind: "richtext",
                        value: column.title,
                        path: { blockIndex: options.index, field: "columns", itemIndex: i, subField: "title" },
                        variant: "inline",
                        as: "strong",
                        placeholder: "Column title",
                        blockMode: "inline",
                      })
                      : <RichTextRenderer value={column.title} blockMode="inline" />}
                  </span>
                  {(column.description || renderSlot) && (
                    <small>
                      {renderSlot
                        ? renderSlot({
                          kind: "richtext",
                          value: column.description,
                          path: { blockIndex: options.index, field: "columns", itemIndex: i, subField: "description" },
                          variant: "inline",
                          as: "span",
                          placeholder: "Column description",
                          blockMode: "inline",
                        })
                        : <RichTextRenderer value={column.description} blockMode="inline" />}
                    </small>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row">
                  {renderSlot
                    ? renderSlot({
                      kind: "text",
                      value: row.label,
                      path: { blockIndex: options.index, field: "rows", itemIndex: rowIndex, subField: "label" },
                      placeholder: "Row label",
                    })
                    : row.label}
                </th>
                {columns.map((_, columnIndex) => (
                  <td key={columnIndex}>
                    {renderSlot
                      ? renderSlot({
                        kind: "text",
                        value: String(row.values[columnIndex] ?? ""),
                        path: { blockIndex: options.index, field: "rows", itemIndex: rowIndex, subField: "values", subItemIndex: columnIndex },
                        placeholder: "Value",
                      })
                      : formatComparisonValue(row.values[columnIndex])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(renderSlot || columns.some((column) => column.cta?.href && column.cta.label)) && (
        <div className="cms-block__matrixActions">
          {columns.map((column, i) =>
            renderSlot ? (
              <React.Fragment key={i}>
                {renderSlot({
                  kind: "cta",
                  value: column.cta,
                  path: { blockIndex: options.index, field: "columns", itemIndex: i, subField: "cta" },
                  className: "cms-block__secondary",
                  emptyLabel: "Add CTA",
                  actionName: "primary",
                })}
              </React.Fragment>
            ) : column.cta?.href && column.cta.label ? (
              <a key={i} className="cms-block__secondary" href={column.cta.href} {...actionAnalyticsAttrs("primary", column.cta.label)}>
                {column.cta.label}
              </a>
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}

function formatComparisonValue(value: string | boolean | null | undefined) {
  if (value === true) return <span className="cms-block__matrixCheck">Yes</span>
  if (value === false) return <span className="cms-block__matrixDash">-</span>
  return value ?? "-"
}
