import { summarizeJson } from "@/lib/queries/generationOperations"

export function JsonSummaryBlock({ value }: { value: unknown }) {
  const summary = summarizeJson(value)

  if (summary.kind === "empty") {
    return <p className="text-sm text-muted-foreground">No data recorded.</p>
  }

  const printable = summary.kind === "text" ? summary.value : JSON.stringify(summary.value, null, 2)
  return (
    <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
      {printable}
    </pre>
  )
}
