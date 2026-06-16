import { manifestSchema, type RtManifest } from "@/lib/richText/manifest"

export const SITE_MANIFEST_PATHS = [
  "siteManifest.json",
  "siteManifest.example.json",
] as const

type ParsedRepo = {
  owner: string
  repo: string
  ref?: string
  pathPrefix?: string
}

export type SiteRepoManifestResult =
  | { ok: true; repo: string; path: string; manifest: RtManifest }
  | { ok: false; error: string }

const REPO_PART_RE = /^[A-Za-z0-9_.-]+$/

export const parseGitHubRepo = (raw: string): ParsedRepo | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const ssh = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/)
  if (ssh) {
    const [, owner, repo] = ssh
    return toParsedRepo(owner, repo)
  }

  try {
    const url = new URL(trimmed)
    if (url.hostname !== "github.com") return null
    const [owner, repoPart, marker, ref, ...rest] = url.pathname.replace(/^\/|\/$/g, "").split("/")
    const repo = repoPart?.replace(/\.git$/, "")
    if (marker === "tree" || marker === "blob") {
      return toParsedRepo(owner, repo, {
        ref,
        pathPrefix: normalizeManifestPath(rest.join("/"), marker === "blob"),
      })
    }
    const pathPrefix = normalizeManifestPath([marker, ref, ...rest].filter(Boolean).join("/"))
    return toParsedRepo(owner, repo, { pathPrefix })
  } catch {
    const [repoRef, pathPrefixRaw] = trimmed.replace(/\.git$/, "").split(":", 2)
    if (!repoRef) return null
    const [owner, repo] = repoRef.split("/")
    return toParsedRepo(owner, repo, { pathPrefix: normalizeManifestPath(pathPrefixRaw) })
  }
}

const normalizeManifestPath = (path?: string, pointsAtFile = false) => {
  const normalized = path?.replace(/^\/|\/$/g, "")
  if (!normalized) return undefined
  if (pointsAtFile || SITE_MANIFEST_PATHS.some((candidate) => normalized.endsWith(`/${candidate}`) || normalized === candidate)) {
    return normalized.split("/").slice(0, -1).join("/") || undefined
  }
  return normalized
}

const joinManifestPath = (repo: ParsedRepo, path: string) =>
  [repo.pathPrefix, path].filter(Boolean).join("/")

const withRef = (url: string, ref?: string) => {
  if (!ref) return url
  const parsed = new URL(url)
  parsed.searchParams.set("ref", ref)
  return parsed.toString()
}

const isValidRepo = (owner?: string, repo?: string) =>
  Boolean(owner && repo && REPO_PART_RE.test(owner) && REPO_PART_RE.test(repo))

const toParsedRepo = (
  owner?: string,
  repo?: string,
  opts: { ref?: string; pathPrefix?: string } = {},
): ParsedRepo | null =>
  isValidRepo(owner, repo) && owner && repo
    ? { owner, repo, ...opts }
    : null

const encodePath = (path: string) =>
  path.split("/").map((part) => encodeURIComponent(part)).join("/")

const decodeGitHubContent = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  return Buffer.from(value.replace(/\s/g, ""), "base64").toString("utf8")
}

const fetchRepoFile = async (
  repo: ParsedRepo,
  path: string,
  token?: string,
): Promise<{ found: true; text: string } | { found: false } | { found: false; error: string }> => {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  }
  if (token) headers.authorization = `Bearer ${token}`

  const res = await fetch(
    withRef(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${encodePath(path)}`,
      repo.ref,
    ),
    { headers, cache: "no-store" },
  )
  if (res.status === 404) return { found: false }
  if (!res.ok) return { found: false, error: `GitHub returned ${res.status}` }

  const body = await res.json() as { type?: string; content?: unknown }
  if (body.type !== "file") return { found: false, error: `${path} is not a file` }
  const text = decodeGitHubContent(body.content)
  if (text == null) return { found: false, error: `${path} content was not readable` }
  return { found: true, text }
}

export const fetchSiteManifestFromRepo = async (
  siteRepo: string,
  opts: { token?: string } = {},
): Promise<SiteRepoManifestResult> => {
  const repo = parseGitHubRepo(siteRepo)
  if (!repo) {
    return { ok: false, error: "Site source must be a GitHub repo like owner/repo, owner/repo:path, or https://github.com/owner/repo/tree/main/path" }
  }

  for (const path of SITE_MANIFEST_PATHS) {
    const manifestPath = joinManifestPath(repo, path)
    const file = await fetchRepoFile(repo, manifestPath, opts.token)
    if (!file.found) {
      if ("error" in file) return { ok: false, error: file.error }
      continue
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(file.text)
    } catch {
      return { ok: false, error: `${path} is not valid JSON` }
    }

    const manifest = manifestSchema.safeParse(parsed)
    if (!manifest.success) {
      return {
        ok: false,
        error: `${manifestPath} does not match the manifest schema: ${manifest.error.issues[0]?.message ?? "invalid manifest"}`,
      }
    }

    return {
      ok: true,
      repo: `${repo.owner}/${repo.repo}`,
      path: manifestPath,
      manifest: manifest.data,
    }
  }

  return {
    ok: false,
    error: `No manifest found at ${SITE_MANIFEST_PATHS.join(" or ")}`,
  }
}
