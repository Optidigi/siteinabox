#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, extname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import * as tsParser from "@typescript-eslint/parser"
import * as astroParser from "astro-eslint-parser"
import ts from "typescript"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".astro", ".js", ".mjs", ".cjs"])

// Inventory, not exclusions: generated first-party files remain subject to the gate.
export const GENERATED_SOURCE_FILES = [
  "apps/cms/src/payload-types.ts",
  "apps/cms/src/app/(payload)/admin/importMap.js",
  "apps/cms/next-env.d.ts",
]
export const VIOLATION_KINDS = [
  "as-any", "annotated-any", "any-array", "array-any", "record-any",
  "generic-any", "generic-default-any", "explicit-any", "jsdoc-any", "z-any",
  "ts-nocheck", "ts-ignore", "double-assertion", "as-never", "no-check", "build-error-bypass", "parse-error",
]

function walk(node, keys, visit, ancestors = []) {
  visit(node, ancestors)
  for (const key of keys[node.type] ?? []) {
    const children = Array.isArray(node[key]) ? node[key] : [node[key]]
    for (const child of children) if (child?.type) walk(child, keys, visit, [...ancestors, node])
  }
}

function propertyName(node) {
  if (!node) return undefined
  return node.type === "Identifier" ? node.name : node.type === "Literal" ? node.value : undefined
}

function isAssertion(node) {
  return node?.type === "TSAsExpression" || node?.type === "TSTypeAssertion"
}

function anyKind(ancestors) {
  const parent = ancestors.at(-1)
  if (isAssertion(parent)) return "as-any"
  if (parent?.type === "TSArrayType") return "any-array"
  if (parent?.type === "TSTypeAliasDeclaration" || parent?.type === "TSTypeParameter") return "generic-default-any"
  if (parent?.type === "TSTypeParameterInstantiation") {
    const name = propertyName(ancestors.at(-2)?.typeName)
    if (name === "Array") return "array-any"
    if (name === "Record") return "record-any"
    return "generic-any"
  }
  return parent?.type === "TSTypeAnnotation" ? "annotated-any" : "explicit-any"
}

export function scanSource(source, file) {
  const violations = []
  function report(kind, start, end, text = source.slice(start, end)) {
    const prefix = source.slice(0, start)
    const lines = prefix.split("\n")
    violations.push({ file, line: lines.length, column: lines.at(-1).length + 1, kind, text })
  }
  function scanFragment(fragment, fragmentFile, offset = 0, astro = false) {
    let parsed
    try {
      parsed = (astro ? astroParser : tsParser).parseForESLint(fragment, {
        parser: tsParser, filePath: fragmentFile, sourceType: "module", ecmaVersion: "latest",
        loc: true, range: true, tokens: true, comment: true,
        ecmaFeatures: { jsx: fragmentFile.endsWith(".tsx") || astro },
      })
    } catch (error) {
      const line = error.lineNumber ?? error.loc?.line ?? 1
      const column = error.column ?? error.loc?.column ?? 0
      const start = fragment.split("\n").slice(0, line - 1).reduce((sum, value) => sum + value.length + 1, 0) + column
      report("parse-error", offset + start, offset + start, error.message)
      return
    }

    // Resolve identifiers to lexical bindings so aliases are recognized without
    // treating a shadowed local `z` or a method named `any` as Zod.
    const bindings = new Map()
    for (const scope of parsed.scopeManager?.scopes ?? []) {
      for (const variable of scope.variables) for (const id of variable.identifiers) bindings.set(id, variable)
      for (const reference of scope.references) if (reference.resolved) bindings.set(reference.identifier, reference.resolved)
    }
    const zodObjects = new Set()
    const zodNamespaces = new Set()
    const zodAnyFunctions = new Set()
    const nodes = []
    walk(parsed.ast, parsed.visitorKeys, (node, ancestors) => nodes.push({ node, ancestors }))
    for (const { node } of nodes) {
      if (node.type !== "ImportDeclaration" || !/^zod(?:\/|$)/.test(node.source.value)) continue
      for (const specifier of node.specifiers) {
        const binding = bindings.get(specifier.local)
        if (specifier.type === "ImportNamespaceSpecifier") zodNamespaces.add(binding)
        else if (specifier.type === "ImportDefaultSpecifier" || ["z", "default"].includes(propertyName(specifier.imported))) zodObjects.add(binding)
        else if (propertyName(specifier.imported) === "any") zodAnyFunctions.add(binding)
      }
    }
    function isZodObject(node) {
      if (node?.type === "Identifier") return zodObjects.has(bindings.get(node)) || (!bindings.has(node) && node.name === "z") || zodNamespaces.has(bindings.get(node))
      return node?.type === "MemberExpression" && ["z", "default"].includes(propertyName(node.property)) && isZodObject(node.object)
    }
    function isZodAny(node) {
      return node?.type === "Identifier" ? zodAnyFunctions.has(bindings.get(node)) : node?.type === "MemberExpression" && propertyName(node.property) === "any" && isZodObject(node.object)
    }
    // Fixed point handles chained namespace/function aliases in declaration order.
    let changed = true
    while (changed) {
      changed = false
      function add(set, id) {
        const binding = bindings.get(id)
        if (binding && !set.has(binding)) { set.add(binding); changed = true }
      }
      for (const { node } of nodes) {
        if (node.type !== "VariableDeclarator") continue
        if (node.id.type === "Identifier") {
          if (isZodObject(node.init)) add(zodObjects, node.id)
          if (isZodAny(node.init)) add(zodAnyFunctions, node.id)
        } else if (node.id.type === "ObjectPattern" && isZodObject(node.init)) {
          for (const property of node.id.properties) if (property.type === "Property" && propertyName(property.key) === "any") add(zodAnyFunctions, property.value)
        }
      }
    }
    for (const { node, ancestors } of nodes) {
      const [start, end] = node.range
      if (node.type === "TSAnyKeyword") report(anyKind(ancestors), offset + start, offset + end)
      if (node.type === "CallExpression" && isZodAny(node.callee)) report("z-any", offset + start, offset + end)
      if (isAssertion(node) && isAssertion(node.expression)) report("double-assertion", offset + start, offset + end)
      if (isAssertion(node) && node.typeAnnotation.type === "TSNeverKeyword") report("as-never", offset + start, offset + end)
      if (node.type === "Property" && !(node.value.type === "Literal" && node.value.value === false)) {
        const key = propertyName(node.key)
        if (key === "noCheck") report("no-check", offset + start, offset + end)
        if (key === "ignoreBuildErrors") report("build-error-bypass", offset + start, offset + end)
      }
      if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" && !(node.right.type === "Literal" && node.right.value === false)) {
        const key = propertyName(node.left.property)
        if (key === "noCheck") report("no-check", offset + start, offset + end)
        if (key === "ignoreBuildErrors") report("build-error-bypass", offset + start, offset + end)
      }
      if (astro && node.type === "JSXElement" && node.openingElement.name.name === "script") {
        const type = node.openingElement.attributes.find((attr) => attr.name?.name === "type")?.value?.value
        if (type && !["module", "text/javascript", "application/javascript"].includes(type)) continue
        for (const child of node.children) if (child.type === "AstroRawText") scanFragment(child.value, `${file}.ts`, offset + child.range[0])
      }
    }
    for (const comment of parsed.ast.comments ?? []) {
      for (const match of comment.value.matchAll(/(?:^|\n)\s*\*?\s*(@ts-(?:ignore|nocheck))\b/g)) {
        const start = comment.range[0] + 2 + match.index + match[0].indexOf(match[1])
        report(match[1].slice(1), offset + start, offset + start + match[1].length)
      }
    }
    if (!astro) {
      // JS typing lives in JSDoc. The compiler parses its type grammar, including
      // `*`, without mistaking documentation examples or strings for source.
      const sf = ts.createSourceFile(fragmentFile, fragment, ts.ScriptTarget.Latest, true)
      function docVisit(node) {
        if (node.kind === ts.SyntaxKind.AnyKeyword || node.kind === ts.SyntaxKind.JSDocAllType) report("jsdoc-any", offset + node.getStart(sf), offset + node.end)
        ts.forEachChild(node, docVisit)
      }
      function visit(node) {
        for (const doc of node.jsDoc ?? []) docVisit(doc)
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
  }
  scanFragment(source, file, 0, file.endsWith(".astro"))
  return sortViolations(violations)
}

function listTrackedFiles(root) {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" })
    .split("\0").filter(Boolean).sort()
}
export function listTrackedSourceFiles(root = ROOT) {
  return [...new Set([...listTrackedFiles(root).filter((file) => SOURCE_EXTENSIONS.has(extname(file))),
    ...GENERATED_SOURCE_FILES.filter((file) => existsSync(resolve(root, file))),
  ])].sort()
}
export function sourceCoverageInventory(root = ROOT) {
  return listTrackedSourceFiles(root).map((file) => ({
    file, format: extname(file).slice(1), generated: GENERATED_SOURCE_FILES.includes(file),
    role: GENERATED_SOURCE_FILES.includes(file) ? "generated" : /(?:^|\/)(?:tests?|__mocks__|fixtures)(?:\/|\.)|\.(?:test|spec)\./.test(file) ? "test-or-fixture" : "source",
    checked: true,
  }))
}

export function scanConfiguration(source, file) {
  // TypeScript's JSON parser accepts tsconfig comments and trailing commas.
  const sf = ts.parseJsonText(file, source)
  const violations = sf.parseDiagnostics.map((diagnostic) => ({
    file, line: sf.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
    column: sf.getLineAndCharacterOfPosition(diagnostic.start ?? 0).character + 1,
    kind: "parse-error", text: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
  }))
  function report(node, kind) {
    const position = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    violations.push({ file, line: position.line + 1, column: position.character + 1, kind, text: node.getText(sf) })
  }
  function visit(node, ancestors = []) {
    if (ts.isPropertyAssignment(node) && node.initializer.kind !== ts.SyntaxKind.FalseKeyword) {
      if (node.name.text === "noCheck") report(node, "no-check")
      if (node.name.text === "ignoreBuildErrors") report(node, "build-error-bypass")
    }
    const scripts = ancestors.at(-3)
    if (file.endsWith("package.json") && ts.isStringLiteral(node) && scripts && ts.isPropertyAssignment(scripts) && scripts.name.text === "scripts") {
      for (const option of node.text.matchAll(/(?:^|\s)["']?--noCheck["']?(?:=(\S+)|\s+(\S+))?/gi)) {
        if ((option[1] ?? option[2])?.replace(/^["']|["']$/g, "") !== "false") { report(node, "no-check"); break }
      }
    }
    ts.forEachChild(node, (child) => visit(child, [...ancestors, node]))
  }
  visit(sf)
  return violations
}

export async function collectViolations(root = ROOT) {
  const files = [...new Set([...listTrackedSourceFiles(root), ...listTrackedFiles(root).filter((file) => /(?:^|\/)(?:tsconfig[^/]*|package)\.json$/.test(file))])].sort()
  const violations = []
  for (const file of files) {
    let source
    try { source = await readFile(resolve(root, file), "utf8") }
    catch (error) { if (error.code === "ENOENT") continue; throw error }
    violations.push(...(extname(file) === ".json" ? scanConfiguration(source, file) : scanSource(source, file)))
  }
  return sortViolations(violations)
}
export function sortViolations(violations) {
  return [...violations].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || a.kind.localeCompare(b.kind) || a.text.localeCompare(b.text))
}
export function violationKey(violation) {
  return `${violation.file}:${violation.line}:${violation.column}:${violation.kind}`
}
export function summarizeByKind(violations) {
  const counts = Object.fromEntries(VIOLATION_KINDS.map((kind) => [kind, 0]))
  for (const violation of violations) counts[violation.kind] = (counts[violation.kind] ?? 0) + 1
  return counts
}
export async function runTypeSafetyCheck(options = {}) {
  const current = options.current ?? await collectViolations(options.root ?? ROOT)
  return { current, ok: current.length === 0 }
}
async function main() {
  const result = await runTypeSafetyCheck()
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2))
  else {
    console.log(`Source/config violations: ${result.current.length}`)
    for (const violation of result.current) console.error(`${violation.file}:${violation.line}:${violation.column} [${violation.kind}] ${violation.text}`)
    console.log(result.ok ? "✓ type-safety:check passed" : "✗ type-safety:check failed")
  }
  if (!result.ok) process.exitCode = 1
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1 })
}
