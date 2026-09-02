"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import { requireAuth } from "@/lib/authGate"
import { AppointmentConflictError, AppointmentInputError, AppointmentManagementNotFoundError, AppointmentUnavailableError, updateAppointmentStatus } from "@/lib/appointments/service"

const allowedStatuses = ["cancelled", "completed", "no_show"] as const
type AllowedStatus = (typeof allowedStatuses)[number]

const returnPathFor = (value: string, tenantMode: boolean): string => {
  if (tenantMode) return "/appointments"
  return /^\/sites\/[a-z0-9-]+\/appointments$/.test(value) ? value : "/sites"
}

const positiveId = (value: string): number | null => {
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function updateAppointmentStatusAction(formData: FormData): Promise<never> {
  const { user, ctx } = await requireAuth()
  const tenantMode = ctx.mode === "tenant"
  if (user.role !== "owner" && user.role !== "super-admin") redirect("/appointments?error=forbidden")
  const returnPath = returnPathFor(String(formData.get("returnPath") ?? ""), tenantMode)
  const appointmentId = positiveId(String(formData.get("appointmentId") ?? ""))
  const statusValue = String(formData.get("status") ?? "")
  const status: AllowedStatus | undefined = allowedStatuses.find((value): value is AllowedStatus => value === statusValue)
  if (!appointmentId || !status) redirect(`${returnPath}?error=invalid_status`)

  const tenantId = tenantMode
    ? ctx.tenant.id
    : positiveId(String(formData.get("tenantId") ?? ""))
  if (!tenantId) redirect(`${returnPath}?error=invalid_tenant`)
  const payload = await getPayload({ config })
  try {
    await updateAppointmentStatus({ payload, appointmentId, tenantId, status })
  } catch (error) {
    if (error instanceof AppointmentManagementNotFoundError) redirect(`${returnPath}?error=not_found`)
    if (error instanceof AppointmentConflictError) redirect(`${returnPath}?error=conflict`)
    if (error instanceof AppointmentInputError) redirect(`${returnPath}?error=invalid_status`)
    if (error instanceof AppointmentUnavailableError) redirect(`${returnPath}?error=unavailable`)
    redirect(`${returnPath}?error=unavailable`)
  }
  revalidatePath(returnPath)
  redirect(`${returnPath}?saved=status`)
}
