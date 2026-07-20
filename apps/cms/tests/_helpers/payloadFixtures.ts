import type { User } from "@/payload-types"

export type UserCreateInput = {
  email: string
  password: string
  name?: string | null
  role?: User["role"]
  tenants?: Array<{ tenant: number | string }>
  enableAPIKey?: boolean | null
  apiKey?: string | null
}

export function userCreateData(data: UserCreateInput): UserCreateInput {
  return data
}
