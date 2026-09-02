"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireAuth } from "@/lib/authGate"
import { getOrCreateSiteSettings } from "@/lib/queries/settings"
import { AppointmentScheduleSettingsSchema } from "@siteinabox/contracts"

const allowedReturnPath = (value: string, tenantMode: boolean): string => {
  if (tenantMode) return "/appointments"
  if (value === "/appointments" || /^\/sites\/[a-z0-9-]+\/appointments$/.test(value)) return value
  return "/sites"
}

export async function saveAppointmentScheduleAction(formData: FormData): Promise<never> {
  const { user, ctx } = await requireAuth()
  const tenantMode = ctx.mode === "tenant"
  if (tenantMode && user.role !== "owner") redirect("/appointments?error=forbidden")

  const returnPath = allowedReturnPath(String(formData.get("returnPath") ?? ""), tenantMode)
  const rawSchedule = formData.get("schedule")
  if (typeof rawSchedule !== "string") redirect(`${returnPath}?error=invalid_schedule`)

  let value: unknown
  try {
    value = JSON.parse(rawSchedule) as unknown
  } catch {
    redirect(`${returnPath}?error=invalid_schedule`)
  }
  const parsed = AppointmentScheduleSettingsSchema.safeParse(value)
  if (!parsed.success) redirect(`${returnPath}?error=invalid_schedule`)

  const tenantId = tenantMode
    ? ctx.tenant.id
    : Number(String(formData.get("tenantId") ?? ""))
  if (!Number.isSafeInteger(tenantId) || tenantId <= 0) redirect(`${returnPath}?error=invalid_tenant`)

  const payload = await getPayload({ config })
  const settings = await getOrCreateSiteSettings(tenantId, { payload })
  await payload.update({
    collection: "site-settings",
    id: settings.id,
    data: { appointments: parsed.data },
    user,
  })
  revalidatePath(returnPath)
  redirect(`${returnPath}?saved=1`)
}
