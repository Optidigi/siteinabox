import type { ThemedMatcher } from "./types"
import type { RtManifest } from "../manifest"

// Re-export the type primitives so consumers using the bare directory path
// (`import ... from "@/lib/richText/themedMatchers"`) keep working. Pre-OBS-59
// these lived in a sibling file that shadowed the directory; the rename
// preserved the import surface for non-`/index` callers.
export type { ThemedMatcher, P5Element } from "./types"

// To add a new category of themed-node matchers:
//   1. Create src/lib/richText/themedMatchers/<category>/index.ts that
//      exports `MATCHERS: ThemedMatcher[]`.
//   2. Import + spread it into ALL_MATCHERS below.
// No other files need to change.
const ALL_MATCHERS: ThemedMatcher[] = []

// Build the lookup-by-id registry. Throws at module init if two matchers
// share an id — better to fail loud than to silently shadow.
const matcherRegistry: Record<string, ThemedMatcher> = (() => {
  const out: Record<string, ThemedMatcher> = {}
  for (const m of ALL_MATCHERS) {
    if (out[m.id]) {
      throw new Error(`themedMatchers: duplicate matcher id "${m.id}" — two MATCHERS arrays registered the same id`)
    }
    out[m.id] = m
  }
  return out
})()

// Pick matchers that correspond to declared themedNode ids on the
// tenant's manifest. Manifest is the source of truth; tenant slug is
// no longer used for matcher selection.
export const matchersForManifest = (manifest: RtManifest): ThemedMatcher[] => {
  const declared = manifest.themedNodes ?? []
  return declared
    .map((n) => matcherRegistry[n.id])
    .filter((m): m is ThemedMatcher => Boolean(m))
}
