import { readFileSync } from "node:fs"

export function readRuntimeSecret(
  inlineValue: string | undefined,
  secretFile: string | undefined,
): string {
  const inlineSecret = inlineValue?.trim()
  if (inlineSecret) return inlineSecret

  const filePath = secretFile?.trim()
  if (!filePath) return ""
  try {
    return readFileSync(filePath, "utf8").trim()
  } catch {
    return ""
  }
}
