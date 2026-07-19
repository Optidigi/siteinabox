import assert from "node:assert/strict"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
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

test("scanSource does not flag narrowly scoped @ts-expect-error (review-governed)", () => {
  const source = [
    "// Payload importMap is generated at build time; types are not shipped.",
    "// @ts-expect-error importMap.js exists only after `pnpm generate:importmap`",
    "import { importMap } from './admin/importMap.js'",
  ].join("\n")

  const violations = scanSource(source, "layout.tsx")
  assert.equal(violations.some((violation) => violation.kind === "ts-expect-error"), false)
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

test("violationKey is stable for deduplication", () => {
  const violation = { file: "a.ts", line: 1, column: 1, kind: "as-any", text: "as any" }
  assert.equal(violationKey(violation), "a.ts:1:1:as-any")
})

test("runTypeSafetyCheck passes for an isolated clean fixture", async () => {
  const root = await mkdtemp(join(tmpdir(), "type-safety-"))
  await writeFile(join(root, "clean.ts"), "export const ok = 1\n", "utf8")

  const result = await runTypeSafetyCheck({
    root,
    current: [],
  })

  assert.equal(result.ok, true)
  assert.deepEqual(sortViolations(result.current), [])
})

test("runTypeSafetyCheck fails when violations exist", async () => {
  const result = await runTypeSafetyCheck({
    current: [{ file: "dirty.ts", line: 2, column: 3, kind: "as-any", text: "as any" }],
  })

  assert.equal(result.ok, false)
  assert.equal(result.current.length, 1)
})
