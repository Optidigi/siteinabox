import assert from "node:assert/strict"
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  runTypeSafetyCheck,
  scanConfiguration,
  listTrackedSourceFiles,
  sourceCoverageInventory,
  scanSource,
  sortViolations,
  violationKey,
} from "./check-type-safety.mjs"

test("bottom-type assertions cannot bypass collection and provider contracts", () => {
  assert.equal(scanSource("save(invalid as never)", "fixture.ts")[0]?.kind, "as-never")
  assert.equal(scanSource("type Impossible = never; const literal = 'safe' as const", "fixture.ts").length, 0)
})

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

test("syntax traversal catches unions, nested and multiple arguments, multiline types, assertions and defaults", () => {
  const fixtures = [
    "type Escape = string | any",
    "type Escape = { nested: string & any }",
    "type Escape = Promise<Map<string, Array<any>>>",
    "type Escape = Map<any, unknown>",
    "const value:\n any = input",
    "const value = <any>input",
    "type Escape<T = any> = T",
    "type Escape<T extends any> = T",
    "declare function load<T>(): T; load<any>()",
    "type Escape = (...args: any[]) => unknown",
    "type Escape = [unknown, any]",
    "type Escape = keyof any",
    "type Escape = { [K in any]: unknown }",
  ]
  for (const fixture of fixtures) {
    const violations = scanSource(fixture, "fixture.ts")
    assert.equal(violations.length, 1, fixture)
    assert.notEqual(violations[0].kind, "parse-error", fixture)
  }
  assert.deepEqual(scanSource("const value:\n any = input", "fixture.ts").map(({ line, column }) => [line, column]), [[2, 2]])
})

test("strings, regexes, template literals, ordinary comments and named object properties are harmless", () => {
  const source = [
    'const text = "as any @ts-ignore z.any()"',
    "const template = `type Escape = any @ts-nocheck`",
    "const pattern = /as any|z.any\\(\\)/",
    "/* type Escape = any; z.any(); @ts-ignore */",
    "// examples: @ts-nocheck and value as any",
    "const object = { any: 'any' }",
    "const nested = `literal ${1}`",
  ].join("\n")
  assert.deepEqual(scanSource(source, "safe.ts"), [])
  assert.equal(scanSource("const template = `${value as any}`", "unsafe.ts").length, 1)
})

test("only parsed directive comments suppressing TypeScript are flagged", () => {
  for (const source of ["// @ts-ignore reason\nconst x = 1", "/* @ts-nocheck */\nconst x = 1", "/*\n * @ts-ignore reason\n */\nconst x = 1"]) {
    assert.equal(scanSource(source, "directives.ts").length, 1, source)
  }
  assert.deepEqual(scanSource("// @ts-expect-error External-library defect; alternative unavailable.\nconst x = 1", "directives.ts"), [])
})

test("Zod namespace, factory and destructuring aliases preserve forbidden any detection", () => {
  const fixtures = [
    "import { z as schema } from 'zod'; schema.any()",
    "import * as schema from 'zod'; schema.z.any()",
    "import { any as escape } from 'zod'; escape()",
    "import { z } from 'zod'; const schema = z; schema['any']()",
    "import { z } from 'zod/v4'; const { any: escape } = z; escape()",
    "import { z } from 'zod'; const escape = z.any; const other = escape; other()",
  ]
  for (const fixture of fixtures) assert.equal(scanSource(fixture, "zod.ts").filter((v) => v.kind === "z-any").length, 1, fixture)
  assert.deepEqual(scanSource("import { z } from 'zod'; function run(z: { any(): void }) { z.any() }", "safe.ts"), [])
  assert.deepEqual(scanSource("const schema = { any() {} }; schema.any()", "safe.ts"), [])
})

test("double assertions fail while unknown boundaries, const assertions and single narrowing remain valid", () => {
  for (const source of ["const x = value as unknown as Target", "const x = <Target><unknown>value", "const x = (value as unknown) as Target"]) {
    assert.equal(scanSource(source, "double.ts").filter((v) => v.kind === "double-assertion").length, 1, source)
  }
  assert.deepEqual(scanSource("const x: unknown = input; const y = x as Target; const z = {value: 1} as const", "safe.ts"), [])
})

test("Astro frontmatter, template expressions and executable scripts are checked with original positions", () => {
  const source = ["---", "const front: any = value", "---", "<p>{front as any}</p>", '<script lang="ts">', "const client: any = value", "// @ts-ignore reason", "client()", "</script>"].join("\n")
  assert.deepEqual(scanSource(source, "page.astro").map((v) => [v.kind, v.line]), [
    ["annotated-any", 2], ["as-any", 4], ["annotated-any", 6], ["ts-ignore", 7],
  ])
  assert.deepEqual(scanSource('<p>as any @ts-ignore z.any()</p><script type="application/ld+json">{"text":"as any"}</script><!-- @ts-nocheck -->', "safe.astro"), [])
  assert.equal(scanSource("---\nconst broken: = 1\n---", "broken.astro")[0].kind, "parse-error")
})

test("JS, MJS and CJS use parsed JSDoc types rather than escaping the gate", () => {
  for (const extension of ["js", "mjs", "cjs"]) {
    assert.equal(scanSource("/** @type {any} */\nconst value = input", `fixture.${extension}`)[0].kind, "jsdoc-any")
    assert.equal(scanSource("/** @param {*} value */\nfunction run(value) {}", `fixture.${extension}`)[0].kind, "jsdoc-any")
    assert.deepEqual(scanSource("/** Example: value as any. */\nconst value = 'any'", `fixture.${extension}`), [])
  }
})

test("invalid syntax fails closed", () => {
  assert.equal(scanSource("const broken: = 1", "broken.ts")[0].kind, "parse-error")
})

test("compiler/build bypasses fail for JSONC, package commands and executable config", () => {
  assert.equal(scanConfiguration('{ // comment\n "compilerOptions": { "noCheck": true, }, }', "tsconfig.json")[0].kind, "no-check")
  assert.equal(scanConfiguration('{"scripts":{"build":"tsc --noCheck && next build"}}', "package.json")[0].kind, "no-check")
  assert.deepEqual(scanConfiguration('{"scripts":{"check":"tsc --noCheck false"},"compilerOptions":{"noCheck":false}}', "package.json"), [])
  assert.equal(scanConfiguration('{"scripts":{"build":"tsc --noCheck false && tsc --nocheck"}}', "package.json")[0].kind, "no-check")
  assert.deepEqual(scanConfiguration('{"description":"do not use --noCheck"}', "package.json"), [])
  assert.equal(scanSource("export default {typescript: {ignoreBuildErrors: true}}", "next.config.mjs")[0].kind, "build-error-bypass")
  assert.equal(scanSource("export default {typescript: {ignoreBuildErrors: process.env.SKIP_TYPES}}", "next.config.mjs")[0].kind, "build-error-bypass")
  assert.equal(scanSource("options.noCheck = true", "compiler.mjs")[0].kind, "no-check")
  assert.deepEqual(scanSource("export default {typescript: {ignoreBuildErrors: false}}; options.noCheck = false", "next.config.mjs"), [])
  assert.deepEqual(scanSource('const text = "noCheck: true ignoreBuildErrors: true --noCheck"', "safe.mjs"), [])
})

test("actual repository checker covers every source format, tests and exact ignored generated files", async () => {
  const root = await mkdtemp(join(tmpdir(), "type-safety-integration-"))
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: root })
    await mkdir(join(root, "apps/cms/src"), { recursive: true })
    await mkdir(join(root, "tests"), { recursive: true })
    await writeFile(join(root, ".gitignore"), "apps/cms/src/payload-types.ts\n")
    const formats = ["ts", "tsx", "mts", "cts", "astro", "js", "mjs", "cjs"]
    for (const format of formats) await writeFile(join(root, `fixture.${format}`), "")
    await writeFile(join(root, "tests/negative.test.ts"), "")
    await writeFile(join(root, "apps/cms/src/payload-types.ts"), "export interface Generated { value: unknown }")
    execFileSync("git", ["add", "."], { cwd: root })
    assert.equal((await runTypeSafetyCheck({ root })).ok, true)
    const coverage = listTrackedSourceFiles(root)
    assert.equal(coverage.length, 10)
    assert.equal(coverage.includes("fixture.cts"), true)
    assert.equal(sourceCoverageInventory(root).find((entry) => entry.generated)?.checked, true)
    for (const format of formats) {
      const source = format === "astro" ? "---\nconst value: any = input\n---\n<p/>" : ["js", "mjs", "cjs"].includes(format) ? "/** @type {any} */\nconst value = input" : "const value: any = input"
      await writeFile(join(root, `fixture.${format}`), source)
    }
    await writeFile(join(root, "tests/negative.test.ts"), "const value = input as unknown as Target")
    await writeFile(join(root, "apps/cms/src/payload-types.ts"), "export interface Generated { value: any }")
    await writeFile(join(root, "tsconfig.json"), '{"compilerOptions":{"noCheck":true}}')
    const result = await runTypeSafetyCheck({ root })
    assert.equal(result.ok, false)
    assert.equal(result.current.length, 11)
    assert.deepEqual(new Set(result.current.map((v) => v.file)), new Set([...coverage, "tsconfig.json"]))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
