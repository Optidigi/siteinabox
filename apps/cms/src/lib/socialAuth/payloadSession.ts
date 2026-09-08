import { createLocalReq, getFieldsToSign, getPayload, jwtSign } from "payload"
import { addSessionToUser, generatePayloadCookie } from "payload/shared"
import config from "@/payload.config"
import type { User } from "@/payload-types"
import { evaluateGate } from "@/lib/gateDecision"
import { resolveSiabContextForUser } from "@/lib/context"

export async function issuePayloadSessionCookie(payloadUserId: string | number, request: Request): Promise<string> {
  const payload = await getPayload({ config })
  const user = await payload.findByID({
    collection: "users",
    id: payloadUserId,
    depth: 0,
    overrideAccess: true,
  }) as User

  if (!user?.email) {
    throw new Error("Linked Payload user is missing an email address")
  }

  const ctx = await resolveSiabContextForUser(user)
  const gate = evaluateGate(user, ctx)
  if (!gate.allow) {
    throw new Error(`Linked Payload user is not allowed on this host: ${gate.reason}`)
  }

  const collection = payload.collections.users
  if (!collection) {
    throw new Error("Payload users collection is not initialized")
  }

  const req = await createLocalReq(
    {
      req: {
        headers: new Headers(request.headers),
      },
      user: user,
    },
    payload,
  )

  const { sid } = await addSessionToUser({
    collectionConfig: collection.config,
    payload,
    req,
    user: user,
  })

  const fieldsToSign = getFieldsToSign({
    collectionConfig: collection.config,
    email: user.email,
    ...(sid ? { sid } : {}),
    user: user,
  })

  const { token } = await jwtSign({
    fieldsToSign,
    secret: (payload).secret,
    tokenExpiration: collection.config.auth.tokenExpiration,
  })

  return generatePayloadCookie({
    collectionAuthConfig: collection.config.auth,
    cookiePrefix: payload.config.cookiePrefix ?? "payload",
    token,
  }) as string
}
