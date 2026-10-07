import { z } from "zod"

/**
 * Best-effort extraction of the most actionable error from a Payload v3 REST
 * response. Used by client-side forms to surface field-specific validation
 * errors via react-hook-form's setError, with a status fallback for non-field
 * errors.
 *
 * Payload v3's REST error envelope is:
 *   { errors: [ { message, name, data: { errors: [ { path, message } ] } } ] }
 *
 * Returns `{field, message}` so the caller decides whether to highlight a
 * specific form field. `field` is undefined when the error isn't tied to a
 * particular path (auth failure, rate limit, etc.).
 */
export async function parsePayloadError(
  res: Response
): Promise<{ field?: string; message: string }> {
  const txt = await res.text().catch(() => "")
  if (!txt) return { message: `HTTP ${res.status}` }
  try {
    const raw: unknown = JSON.parse(txt)
    const parsed = z.object({ errors: z.array(z.object({
      message: z.string().optional(),
      data: z.object({ errors: z.array(z.object({ path: z.string(), message: z.string() })).optional() }).optional(),
    })).optional() }).safeParse(raw)
    const top = parsed.success ? parsed.data.errors?.[0] : undefined
    const inner = top?.data?.errors?.[0]
    if (inner?.path && inner?.message) {
      return { field: String(inner.path), message: String(inner.message) }
    }
    if (top?.message) return { message: String(top.message) }
  } catch {
    // Not JSON — fall through to raw-text snippet.
  }
  return { message: txt.slice(0, 200) }
}
