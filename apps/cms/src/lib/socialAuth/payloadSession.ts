import { createLocalReq, getFieldsToSign, getPayload, jwtSign } from "payload"
import { addSessionToUser, generatePayloadCookie } from "payload/shared"
import config from "@/payload.config"
import type { User } from "@/payload-types"
import { evaluateGate } from "@/lib/gateDecision"
import type { SiabContext } from "@/lib/context"

async function resolveContextForRequest(request: Request): Promise<SiabContext> {
  const payload = await getPayload({ config })
  const mode = request.headers.get("x-siab-mode")
  const host = request.headers.get("x-siab-host") || ""

  if (mode === "super-admin") return { mode: "super-admin", tenant: null }
  if (mode !== "tenant" || !host) {
    throw new Error("Social auth callback is missing SIAB host context")
  }

  const tenants = await payload.find({
    collection: "tenants",
    where: { domain: { equals: host } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tenant = tenants.docs[0]
  if (!tenant) throw new Error("Social auth callback tenant could not be resolved")
  return { mode: "tenant", tenant }
}

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

  const ctx = await resolveContextForRequest(request)
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
