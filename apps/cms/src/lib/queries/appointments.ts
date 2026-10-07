import "server-only"

import { getPayload } from "payload"
import type { Where } from "payload"
import config from "@/payload.config"
import type { Appointment } from "@/payload-types"
import {
  normalisePagination,
  normaliseFindResult,
  type PayloadFindResult,
  type PayloadFindClient,
} from "./paginate"

export interface ListAppointmentsOpts {
  page?: number
  pageSize?: number
  q?: string
  status?: Appointment["status"]
}

export async function listAppointmentsPaginated(
  tenantId: number | string,
  opts?: ListAppointmentsOpts,
  payload?: PayloadFindClient<"appointments">,
): Promise<PayloadFindResult<Appointment>> {
  const client = payload ?? (await getPayload({ config }))
  const { page, limit } = normalisePagination(opts)
  const where: Where = { tenant: { equals: tenantId } }
  if (opts?.status) where.status = { equals: opts.status }
  const query = opts?.q?.trim()
  if (query) {
    where.or = [
      { visitorName: { like: query } },
      { visitorEmail: { like: query } },
      { visitorPhone: { like: query } },
    ]
  }
  return client.find({
    collection: "appointments",
    overrideAccess: true,
    where,
    sort: "startAt",
    page,
    limit,
  }).then(normaliseFindResult)
}
