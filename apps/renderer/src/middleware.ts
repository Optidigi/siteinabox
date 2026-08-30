import { defineMiddleware } from "astro:middleware"
import { rendererEdgeCheck } from "./lib/edge-check"
import { neutralOriginNotFound, publicHostFromProtectedRequest } from "./lib/origin-protection"

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname === "/healthz") return next()
  const publicHost = publicHostFromProtectedRequest(context.request)
  if (!publicHost) return neutralOriginNotFound()
  if (context.url.pathname === "/__siab/edge-check") {
    return context.request.method === "HEAD"
      ? rendererEdgeCheck(publicHost)
      : neutralOriginNotFound()
  }
  return next()
})
