import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { asMockDoc } from "../_helpers/cast"
const root = join(process.cwd(), "src", "locales")

function readMessages(locale: "en" | "nl") {
  return JSON.parse(readFileSync(join(root, `${locale}.json`), "utf8"))
}

function keysOf(value: unknown, prefix = ""): string[] {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return [prefix]
  return Object.entries(asMockDoc(value)).flatMap(([key, nested]) =>
    keysOf(nested, prefix ? `${prefix}.${key}` : key),
  )
}

function valuesOf(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (value == null || typeof value !== "object" || Array.isArray(value)) return []
  return Object.values(asMockDoc(value)).flatMap(valuesOf)
}

function entriesOf(value: unknown, prefix = ""): Array<[string, unknown]> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return [[prefix, value]]
  return Object.entries(asMockDoc(value)).flatMap(([key, nested]) =>
    entriesOf(nested, prefix ? `${prefix}.${key}` : key),
  )
}

function argumentsOf(message: string): string[] {
  const argumentsFound = new Set<string>()
  let depth = 0

  for (let index = 0; index < message.length; index += 1) {
    if (message[index] === "{") {
      if (depth === 0) {
        const match = message.slice(index + 1).match(/^([A-Za-z][\w-]*)\s*(?:[,}])/)
        if (match?.[1]) argumentsFound.add(match[1])
      }
      depth += 1
    } else if (message[index] === "}" && depth > 0) {
      depth -= 1
    }
  }

  return [...argumentsFound].sort()
}

describe("locale message coverage", () => {
  it("keeps English and Dutch message keys in sync", () => {
    const enKeys = keysOf(readMessages("en")).sort()
    const nlKeys = keysOf(readMessages("nl")).sort()

    expect(nlKeys).toEqual(enKeys)
  })

  it("keeps every locale leaf translated and interpolation-compatible", () => {
    const en = readMessages("en")
    const nl = readMessages("nl")
    const enValues = Object.fromEntries(entriesOf(en))
    const nlValues = Object.fromEntries(entriesOf(nl))

    for (const key of Object.keys(enValues)) {
      expect(typeof enValues[key], `${key} must be a string in English`).toBe("string")
      expect(typeof nlValues[key], `${key} must be a string in Dutch`).toBe("string")
      expect((enValues[key] as string).trim(), `${key} must not be empty in English`).not.toBe("")
      expect((nlValues[key] as string).trim(), `${key} must not be empty in Dutch`).not.toBe("")
      expect(argumentsOf(nlValues[key] as string), `${key} must use the same arguments`).toEqual(
        argumentsOf(enValues[key] as string),
      )
    }
  })

  it("does not expose tenant wording in translated UI copy", () => {
    const visibleCopy = [...valuesOf(readMessages("en")), ...valuesOf(readMessages("nl"))]

    expect(visibleCopy.filter((value) => /\btenants?\b/i.test(value))).toEqual([])
  })
})
