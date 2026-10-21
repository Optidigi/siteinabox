import { getPayload } from "payload"
import { APIError } from "better-auth/api"
import config from "@/payload.config"
import type { User } from "@/payload-types"
import { assertPayloadCustomerActive } from "@/lib/auth/payloadCustomerAccess"

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

const hasValidRoleTenantShape = (user: User): boolean => {
  const tenants = Array.isArray(user.tenants) ? user.tenants : []
  if (user.role === "super-admin") return tenants.length === 0
  return tenants.length === 1
}

export async function resolvePayloadUserForSocialSignup(user: {
  email?: string | null
  emailVerified?: boolean | null
}): Promise<User> {
  if (!user.email || user.emailVerified !== true) {
    throw new APIError("UNAUTHORIZED", {
      message: "This provider did not return a verified email address.",
    })
  }

  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: "users",
    where: { email: { equals: normalizeEmail(user.email) } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })

  if (result.totalDocs !== 1) {
    throw new APIError("UNAUTHORIZED", {
      message: "No invited CMS user matches this provider account.",
    })
  }

  const payloadUser = result.docs[0] as User
  try { await assertPayloadCustomerActive(payload, payloadUser.id) }
  catch { throw new APIError("UNAUTHORIZED", { message: "The linked CMS user is not eligible for login." }) }
  if (!hasValidRoleTenantShape(payloadUser)) {
    throw new APIError("UNAUTHORIZED", {
      message: "The linked CMS user is not eligible for login.",
    })
  }

  return payloadUser
}

export async function resolvePayloadUserForMagicLink(email: string): Promise<User> {
  return resolvePayloadUserForSocialSignup({
    email,
    emailVerified: true,
  })
}
