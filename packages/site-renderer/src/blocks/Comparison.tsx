import * as React from "react"
import type { ComparisonBlock } from "@siteinabox/contracts"
import { actionAnalyticsAttrs, sectionAnalyticsAttrs } from "../analytics"
import { RichTextRenderer } from "../rich-text"
import type { BlockRenderOptions } from "./types"
import { rendererVariantClassName, runtimeVariantDataAttribute } from "./variants"

export function ComparisonBlockRenderer({ block, options }: { block: ComparisonBlock; options: BlockRenderOptions }) {
  if (!block.columns.length || !block.rows.length) return null
  const sourceVariant = rendererVariantClassName(block)

  return (
    <section
      id={block.anchor || undefined}
      className={`cms-block cms-block--comparisonMatrix ${sourceVariant}`.trim()}
      data-source-variant={runtimeVariantDataAttribute(block)}
      data-block-index={options.index}
      {...sectionAnalyticsAttrs(block.analytics, "comparison", options.index)}
    >
      {(block.title || block.intro) && (
        <div className="cms-block__matrixHeader">
          {block.title && (
            <h2 className="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
              <RichTextRenderer value={block.title} blockMode="inline" />
            </h2>
          )}
          {block.intro && (
            <div className="cms-block__intro" style={{ fontFamily: "var(--font-text)" }}>
              <RichTextRenderer value={block.intro} />
            </div>
          )}
        </div>
      )}
      <div className="cms-block__matrixScroll">
        <table className="cms-block__matrix">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              {block.columns.map((column, i) => (
                <th key={i} scope="col">
                  <span>
                    <RichTextRenderer value={column.title} blockMode="inline" />
                  </span>
                  {column.description && (
                    <small>
                      <RichTextRenderer value={column.description} blockMode="inline" />
                    </small>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row">{row.label}</th>
                {block.columns.map((_, columnIndex) => (
                  <td key={columnIndex}>{formatComparisonValue(row.values[columnIndex])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {block.columns.some((column) => column.cta?.href && column.cta.label) && (
        <div className="cms-block__matrixActions">
          {block.columns.map((column, i) =>
            column.cta?.href && column.cta.label ? (
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
