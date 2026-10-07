/** Raw translation APIs expose unknown content; labels require plain text. */
export function translationText(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected a plain-text translation.")
  return value
}
