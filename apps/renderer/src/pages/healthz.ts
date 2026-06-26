import type { APIRoute } from "astro"

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ status: "ok" }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  })
