import { z } from "zod"

export const pendingBuilderOperationSchema = z.object({
  operationId: z.uuid(), message: z.string().trim().min(2).max(4000), locale: z.enum(["nl", "en"]),
}).strict()
export type PendingBuilderOperation = z.infer<typeof pendingBuilderOperationSchema>

export function restorePendingBuilderOperation(value: string | null): PendingBuilderOperation | null {
  if (!value) return null
  try {
    const result = pendingBuilderOperationSchema.safeParse(JSON.parse(value))
    return result.success ? result.data : null
  } catch { return null }
}
