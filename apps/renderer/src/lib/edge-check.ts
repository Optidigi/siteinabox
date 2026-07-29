import { readRuntimeSecret } from "./runtime-secret"

export async function rendererEdgeCheck(host: string): Promise<Response> {
  try {
    const cmsUrl = process.env.SIAB_CMS_URL
    if (!cmsUrl) return new Response(null, { status: 404 })
    const endpoint = new URL("/api/renderer/edge-check", cmsUrl)
    endpoint.searchParams.set("host", host)
    const token = readRuntimeSecret(
      process.env.SIAB_RENDERER_API_TOKEN,
      process.env.SIAB_RENDERER_API_TOKEN_FILE,
    )
    const response = await fetch(endpoint, {
      method: "HEAD",
      cache: "no-store",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
    if (response.status !== 200) return new Response(null, { status: 404 })

    const domain = response.headers.get("x-siab-domain")
    if (!domain) return new Response(null, { status: 404 })
    return new Response(null, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "x-siab-service": "renderer",
        "x-siab-domain": domain,
      },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
