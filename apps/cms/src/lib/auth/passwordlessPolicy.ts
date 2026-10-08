import type { User } from "@/payload-types"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { Forbidden, type CollectionBeforeLoginHook, type CollectionBeforeOperationHook } from "payload"

export const isForbiddenCustomerAuthPath = (path: string): boolean =>
  /^\/(sign-in\/(social|email|username|phone-number)|sign-up|callback|oauth2|link-social|unlink-account|change-password|set-password|request-password-reset|reset-password|forget-password)(\/|$)/.test(path)

export const passwordlessBefore = createAuthMiddleware(async (ctx) => {
  if (isForbiddenCustomerAuthPath(ctx.path)) {
    throw new APIError("FORBIDDEN", { message: "Use an email magic link to sign in." })
  }
})

export const requireRestrictedPasswordPrincipal: CollectionBeforeLoginHook<User> = ({ user }) => {
  if (user.role !== "super-admin") throw new Forbidden()
}

// The operation hook precedes mail/password mutation, including GraphQL and
// Local API overrideAccess calls. Resolve the target, never trust caller role.
export const restrictPasswordRecovery: CollectionBeforeOperationHook<"users"> = async ({ args, operation, req }) => {
  if (operation === "refresh" && req.user?.role !== "super-admin") throw new Forbidden()
  if (operation !== "forgotPassword" && operation !== "resetPassword" && operation !== "login") return args
  const data: unknown = args.data
  if (!data || typeof data !== "object") throw new Forbidden()
  const email = "email" in data && typeof data.email === "string" ? data.email.trim().toLowerCase() : null
  const token = "token" in data && typeof data.token === "string" ? data.token : null
  if (((operation === "forgotPassword" || operation === "login") && !email) || (operation === "resetPassword" && !token)) throw new Forbidden()
  const targets = await req.payload.find({
    collection: "users", overrideAccess: true, depth: 0, limit: 2,
    where: operation !== "resetPassword"
      ? { email: { equals: email } }
      : { and: [{ resetPasswordToken: { equals: token } }, { resetPasswordExpiration: { greater_than: new Date().toISOString() } }] },
    req,
  })
  if (targets.totalDocs !== 1 || targets.docs[0]?.role !== "super-admin") throw new Forbidden()
  return args
}
