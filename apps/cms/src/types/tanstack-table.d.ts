import "@tanstack/react-table"
import type { CellData, RowData, TableFeatures } from "@tanstack/react-table"

declare module "@tanstack/react-table" {
  interface ColumnMeta<TFeatures extends TableFeatures, TData extends RowData, TValue extends CellData> {
    /**
     * Mobile rendering priority for this column when DataTable
     * switches to stacked-card layout below md breakpoint.
     *
     * - "primary":   Title-row of the card (top, bold).
     * - "secondary": Stacked under primary as small key/value text.
     * - "hidden":    Not rendered on phone (e.g. internal slugs, IDs).
     * - "action":    Right-edge action menu (kebab) at top of card.
     *
     * Defaults to "secondary" if omitted. Untouched columns work
     * exactly as before on desktop.
     */
    mobilePriority?: "primary" | "secondary" | "hidden" | "action"
    /**
     * Optional label override for the secondary key/value rendering
     * on phone. Falls back to `column.id` or `column.header` when
     * not provided.
     */
    mobileLabel?: string
  }
}

// Marker so TS treats this as a module file
export {}
