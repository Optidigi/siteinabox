import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { extname, join, relative } from "node:path"

const WIDTH_BREAKPOINTS = new Map([
  ["sm", "40rem"],
  ["md", "48rem"],
  ["lg", "64rem"],
  ["xl", "80rem"],
  ["2xl", "96rem"],
])

const IGNORE_NEXT = "siab-responsive-ignore-next-line"
const IGNORE_FILE = "siab-responsive-ignore-file"

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=")
    return [key, rest.length ? rest.join("=") : "true"]
  }),
)

const root = args.get("root") ?? process.cwd()
const mode = args.get("mode") ?? inferMode(root)
const failures = []

function inferMode(dir) {
  const pkgPath = join(dir, "package.json")
  if (!existsSync(pkgPath)) return "site"
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    if (pkg.name === "siab-payload") return "payload"
  } catch {}
  return "site"
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (
      entry === ".git" ||
      entry === "node_modules" ||
      entry === "dist" ||
      entry === ".next" ||
      entry === ".astro" ||
      entry === "coverage" ||
      entry === "public" ||
      entry === "tmp"
    ) {
      continue
    }
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

function lineIgnored(lines, index) {
  const prev = lines[index - 1] ?? ""
  const same = lines[index] ?? ""
  return prev.includes(IGNORE_NEXT) || same.includes(IGNORE_NEXT)
}

function fail(file, line, message, detail) {
  failures.push({ file: relative(root, file), line, message, detail })
}

function scanSiteFile(file, source) {
  if (file.endsWith("scripts/check-responsive.mjs")) return
  if (source.includes(IGNORE_FILE)) return
  const ext = extname(file)
  if (![".astro", ".css", ".js", ".jsx", ".mjs", ".ts", ".tsx"].includes(ext)) return

  const lines = source.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (lineIgnored(lines, index)) return

    const viewportVariant = line.match(/(^|[\s"'`{])((?:max-)?(?:sm|md|lg|xl|2xl):)/)
    if (viewportVariant) {
      const name = viewportVariant[2].replace(/^max-/, "").replace(":", "")
      const threshold = WIDTH_BREAKPOINTS.get(name) ?? "the matching threshold"
      fail(
        file,
        index + 1,
        `Viewport Tailwind variant "${viewportVariant[2]}" found in tenant-facing code.`,
        `Use a named site-frame container variant such as @min-[${threshold}]/site-frame:... when this is layout-width responsive.`,
      )
    }

    if (/@media\b[^{]*(?:\bmin-width\b|\bmax-width\b|\bwidth\s*[<>=])/.test(line)) {
      fail(
        file,
        index + 1,
        "Viewport width media query found.",
        "Use @container site-frame (...) for layout-width behavior; keep @media only for device/user/output features.",
      )
    }

    if (/@container\b(?![^{;\n]*\bsite-frame\b)/.test(line)) {
      fail(
        file,
        index + 1,
        "Unnamed or non-site-frame container query found.",
        "Use the named site-frame container so CMS canvas and live site resolve against the same frame.",
      )
    }

    if (/\b\d*\.?\d+(?:vw|vmin|vmax)\b/.test(line)) {
      fail(
        file,
        index + 1,
        "Viewport inline-axis unit found.",
        "Use cqi/cqw for site-frame-width-coupled layout or add an explicit ignore comment for true viewport effects.",
      )
    }

    if (/\b(?:window\.)?(?:innerWidth|outerWidth)\b|\bvisualViewport\.(?:width|scale)\b/.test(line)) {
      fail(
        file,
        index + 1,
        "Browser viewport sizing API found.",
        "Use ResizeObserver/getBoundingClientRect for layout decisions; keep viewport APIs only behind an explicit ignore.",
      )
    }

    if (/\bmatchMedia\s*\([^)]*(?:min-width|max-width|width\s*[<>=])/.test(line)) {
      fail(
        file,
        index + 1,
        "Width-based matchMedia found.",
        "Use a ResizeObserver against the site-frame container for layout-width behavior.",
      )
    }

    if (/<(?:source|picture)\b[^>]*\bmedia=/.test(line)) {
      fail(
        file,
        index + 1,
        "Viewport-bound picture/source media attribute found.",
        "Prefer srcset/sizes plus container-driven CSS unless this is intentional art direction with an ignore comment.",
      )
    }
  })
}

function scanPayload(rootDir) {
  const rendererHosts = [
    join(rootDir, "src/components/editor/iframe/PageEditorFrameHost.tsx"),
    join(rootDir, "src/components/preview/PreviewCustomizer.tsx"),
  ]
  for (const file of rendererHosts) {
    if (!existsSync(file)) continue
    const lines = readFileSync(file, "utf8").split(/\r?\n/)
    lines.forEach((line, index) => {
      if (lineIgnored(lines, index)) return
      if (/\bCANVAS_DESIGN_WIDTH\b|style=\{\{\s*width:\s*CANVAS_DESIGN_WIDTH\b|\bzoom\b/.test(line)) {
        fail(file, index + 1, "Fixed-width zoom renderer found.", "Renderer frames must use their real viewport width.")
      }
    })
  }
}

if (mode === "payload") {
  scanPayload(root)
} else if (mode === "site") {
  for (const file of walk(root)) {
    scanSiteFile(file, readFileSync(file, "utf8"))
  }
} else {
  console.error(`Unknown responsive canvas lint mode: ${mode}`)
  process.exit(2)
}

if (failures.length) {
  console.error(`Responsive canvas contract failed (${mode})`)
  for (const failure of failures) {
    console.error(`\n${failure.file}:${failure.line}`)
    console.error(`  ${failure.message}`)
    console.error(`  ${failure.detail}`)
  }
  console.error(`\nUse // ${IGNORE_NEXT} only for reviewed browser/device-bound exceptions.`)
  process.exit(1)
}

console.log(`Responsive canvas contract passed (${mode})`)
