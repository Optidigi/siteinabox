import { JWTAuthentication, type AuthStrategyFunction, type Payload } from "payload"

// Replace the terminal SDK callback rather than attempting a veto in an earlier
// strategy: executeAuthStrategies continues on both null and exceptions.
export function installCustomerJwtStrategy(payload: Payload): void {
  const matches = payload.authStrategies.filter((strategy) => strategy.name === "local-jwt")
  const native = matches[0]
  if (matches.length !== 1 || !native || native.authenticate !== JWTAuthentication || payload.authStrategies.at(-1) !== native) {
    throw new Error("Unsupported Payload JWT strategy topology")
  }
  const authenticate: AuthStrategyFunction = async (args) => {
    const result = await JWTAuthentication(args)
    if (!result.user || result.user.collection !== "users") return result
    try {
      const { validateCustomerPayloadSession } = await import("./customerSessionBridge")
      if (await validateCustomerPayloadSession(args.payload, result.user)) return result
    } catch {
      // Store outage is a denial, never a native JWT fallback.
    }
    return { user: null }
  }
  native.authenticate = authenticate
}
