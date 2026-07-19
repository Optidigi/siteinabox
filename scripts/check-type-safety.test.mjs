import assert from "node:assert/strict"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  assertDiffBaseResolvable,
  compareToBaseline,
  findTouchedFileViolations,
  runTypeSafetyCheck,
  scanSource,
  sortViolations,
  violationKey,
} from "./check-type-safety.mjs"

test("scanSource detects explicit any, zod any, and ts directives", () => {
  const source = [
    "// @ts-nocheck",
    "const value = input as any",
    "function run(arg: any) {",
    "  const list: any[] = []",
    "  const map: Record<string, any> = {}",
    "  const schema = z.any().nullable()",
    "  // @ts-ignore legacy",
    "}",
  ].join("\n")

  const violations = scanSource(source, "sample.ts")
  const kinds = new Set(violations.map((violation) => violation.kind))

  assert.equal(kinds.has("ts-nocheck"), true)
  assert.equal(kinds.has("as-any"), true)
  assert.equal(kinds.has("annotated-any"), true)
  assert.equal(kinds.has("any-array"), true)
  assert.equal(kinds.has("record-any"), true)
  assert.equal(kinds.has("z-any"), true)
  assert.equal(kinds.has("ts-ignore"), true)
})

test("scanSource detects generic any forms", () => {
  const source = [
    "type Box<T = any> = T",
    "type Alias = any",
    "const list: Array<any> = []",
    "async function load(): Promise<any> {",
    "  return vi.importActual<any>(\"module\")",
    "}",
    "const Icon: React.ComponentType<any> | null = null",
    "const registry: Partial<Record<string, Foo<any>>> = {}",
  ].join("\n")

  const violations = scanSource(source, "generic.ts")
  const kinds = new Set(violations.map((violation) => violation.kind))

  assert.equal(kinds.has("array-any"), true)
  assert.equal(kinds.has("generic-any"), true)
  assert.equal(kinds.has("generic-default-any"), true)
  assert.equal(
    violations.some((violation) => violation.kind === "generic-any" && violation.line === 4),
    true,
  )
  assert.equal(
    violations.some((violation) => violation.kind === "generic-any" && violation.line === 7),
    true,
  )
  assert.equal(
    violations.some((violation) => violation.kind === "generic-any" && violation.line === 5),
    true,
  )
})

test("baseline ratchet rejects added and removed violations", () => {
  const baseline = [{ file: "a.ts", line: 1, column: 1, kind: "as-any", text: "as any" }]
  const unchanged = [...baseline]
  const added = [
    ...baseline,
    { file: "b.ts", line: 2, column: 3, kind: "z-any", text: "z.any(" },
  ]
  const removed = []

  assert.deepEqual(compareToBaseline(unchanged, baseline).added, [])
  assert.equal(compareToBaseline(added, baseline).added.length, 1)
  assert.equal(compareToBaseline(removed, baseline).removed.length, 1)
})

test("touched files must be clean even when baseline allows violations elsewhere", () => {
  const current = [
    { file: "allowed.ts", line: 1, column: 1, kind: "as-any", text: "as any" },
    { file: "touched.ts", line: 4, column: 8, kind: "annotated-any", text: ": any" },
  ]
  const baseline = [current[0]]
  const touched = findTouchedFileViolations(current, ["touched.ts"])

  assert.equal(touched.length, 1)
  assert.equal(violationKey(touched[0]), "touched.ts:4:8:annotated-any")
  assert.equal(compareToBaseline(current, baseline).added.length, 1)
})

test("assertDiffBaseResolvable fails closed for missing diff base", () => {
  assert.throws(
    () => assertDiffBaseResolvable(process.cwd(), "0000000000000000000000000000000000000000"),
    /TYPE_SAFETY_DIFF_BASE is set/,
  )
})

test("runTypeSafetyCheck passes for an isolated clean fixture", async () => {
  const root = await mkdtemp(join(tmpdir(), "type-safety-"))
  const baselinePath = join(root, "scripts")
  await import("node:fs/promises").then((fs) => fs.mkdir(baselinePath, { recursive: true }))

  await writeFile(
    join(baselinePath, "type-safety-baseline.json"),
    `${JSON.stringify({ version: 1, violations: [] }, null, 2)}\n`,
    "utf8",
  )
  await writeFile(join(root, "clean.ts"), "export const ok = 1\n", "utf8")

  const result = await runTypeSafetyCheck({
    root,
    touchedFiles: [],
    current: [],
    baseline: [],
  })

  assert.equal(result.ok, true)
  assert.deepEqual(sortViolations(result.current), [])
})
