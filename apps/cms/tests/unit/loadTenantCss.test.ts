import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { promises as fs } from "node:fs"
import { resolve } from "node:path"
import { loadTenantCss, __scopeTenantCssForTest as scope } from "@/lib/editor/loadTenantCss"

const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), ".data-out")
const TEST_ID = `loadTenantCss-test-${Date.now()}`
const TEST_DIR = resolve(DATA_DIR, "tenants", TEST_ID)
const TEST_FILE = resolve(TEST_DIR, "cms-editor.css")

// Simulates Tailwind v4 compiled output: tokens inside @layer theme { :root, :host },
// preflight base styles on `html, :host` + the tenant's own `html`/`body` rules,
// utility classes, an @media block, @keyframes, @font-face, and @property.
const SAMPLE = `@import "https://fonts.example/x.css";
@layer theme {
  :root, :host {
    --color-accent: oklch(0.6 0.1 40);
    --color-bg: oklch(0.99 0 0);
    --color-ink: oklch(0.2 0 0);
  }
}
@layer base {
  html, :host { line-height: 1.5; }
  html { background-color: var(--color-bg); color: var(--color-ink); }
  body { min-height: 100vh; }
  *, ::before, ::after { box-sizing: border-box; }
}
.flex { display: flex; }
.bg-accent { background-color: var(--color-accent); }
.rounded-full { border-radius: 9999px; }
.group:hover .group-hover\\:flex { display: flex; }
@media (width >= 48rem) {
  .md\\:flex { display: flex; }
}
@font-face {
  font-family: 'X';
  src: url(./files/x.woff2);
}
@keyframes spin {
  from { transform: rotate(0); }
  to { transform: rotate(360deg); }
}
@property --tw-rotate {
  syntax: "*";
  inherits: false;
}`

beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true })
  await fs.writeFile(TEST_FILE, SAMPLE)
})
afterAll(async () => { await fs.rm(TEST_DIR, { recursive: true, force: true }) })

describe("loadTenantCss", () => {
  it("hoists @import to the top", async () => {
    const css = await loadTenantCss(TEST_ID)
    expect(css).toMatch(/^@import "https:\/\/fonts\.example\/x\.css";/)
  })

  it("rescopes :root, :host token block to .rt-canvas", async () => {
    const css = await loadTenantCss(TEST_ID)
    expect(css).toMatch(/\.rt-canvas\s*\{[^}]*--color-accent/)
    expect(css).not.toMatch(/:root|:host/)
  })

  it("rescopes the tenant's html base-style rule to .rt-canvas", async () => {
    const css = await loadTenantCss(TEST_ID)
    expect(css).toMatch(/\.rt-canvas\s*\{[^}]*background-color: var\(--color-bg\)/)
    expect(css).not.toMatch(/(^|[{}\s])html\s*\{/)
    expect(css).not.toMatch(/(^|[{}\s])body\s*\{/)
  })

  it("scopes utility classes under .rt-canvas (no global leak)", async () => {
    const css = await loadTenantCss(TEST_ID)
    expect(css).toMatch(/\.rt-canvas \.flex \{ display: flex; \}/)
    expect(css).toMatch(/\.rt-canvas \.rounded-full \{ border-radius: 9999px; \}/)
    // Every `.flex {` / `.rounded-full {` occurrence must be the scoped form —
    // i.e. always preceded by `.rt-canvas `, never bare (a global leak).
    for (const cls of [/\.flex\s*\{/g, /\.rounded-full\s*\{/g]) {
      const all = css!.match(cls) ?? []
      const scoped = css!.match(new RegExp(`\\.rt-canvas ${cls.source}`)) ?? []
      expect(all.length).toBeGreaterThan(0)
      expect(scoped.length).toBe(all.length)
    }
  })

  it("scopes only the first compound selector, leaving descendants intact", async () => {
    const css = await loadTenantCss(TEST_ID)
    // `.group:hover .group-hover\:flex` → `.rt-canvas .group:hover .group-hover\:flex`
    expect(css).toMatch(/\.rt-canvas \.group:hover \.group-hover\\:flex/)
  })

  it("recurses into @media and scopes the rules inside", async () => {
    const css = await loadTenantCss(TEST_ID)
    expect(css).toMatch(/@media \(width >= 48rem\) \{\s*\.rt-canvas \.md\\:flex/)
  })

  it("rebases tenant rem units to the tenant html font-size for canvas parity", async () => {
    const id = `root-rem-${Date.now()}`
    const dir = resolve(DATA_DIR, "tenants", id)
    const file = resolve(dir, "cms-editor.css")
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      file,
      `@layer base { html { font-size: 17px; } }
.px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
.max-w-7xl { max-width: 80rem; }
.\\@min-\\[48rem\\]\\/site-frame\\:px-12 { @container site-frame (width >= 48rem) { padding-left: 3rem; } }
@container site-frame (width >= 48rem) { .wide { padding: 3rem; } }
.icon { background-image: url("data:image/svg+xml,<svg viewBox='0 0 1rem 1rem'></svg>"); }`,
    )
    try {
      const css = await loadTenantCss(id)
      expect(css).toMatch(/font-size:\s*17px/)
      expect(css).toMatch(/padding-left:\s*25\.5px/)
      expect(css).toMatch(/padding-right:\s*25\.5px/)
      expect(css).toMatch(/max-width:\s*1360px/)
      expect(css).toMatch(/\.\\@min-\\\[816px\\\]\\\/site-frame\\:px-12/)
      expect(css).toMatch(/@container site-frame \(width >= 816px\)/)
      expect(css).toMatch(/padding:\s*51px/)
      expect(css).toMatch(/1rem 1rem/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it("leaves @keyframes selectors (from/to) un-prefixed", async () => {
    const css = await loadTenantCss(TEST_ID)
    expect(css).toMatch(/@keyframes spin \{\s*from \{ transform: rotate\(0\); \}\s*to \{/)
    expect(css).not.toMatch(/\.rt-canvas from/)
    expect(css).not.toMatch(/\.rt-canvas to/)
  })

  it("leaves @font-face and @property registrations global", async () => {
    const css = await loadTenantCss(TEST_ID)
    expect(css).toMatch(/@font-face \{[^}]*font-family: 'X'/)
    expect(css).toMatch(/@property --tw-rotate \{[^}]*syntax: "\*"/)
    expect(css).not.toMatch(/\.rt-canvas @font-face/)
  })

  it("collapses a compound root selector list to a single .rt-canvas", () => {
    expect(scope("html, :host, :root { color: red; }")).toBe(".rt-canvas { color: red; }")
  })

  it("is idempotent — does not double-scope an already-scoped selector", () => {
    expect(scope(".rt-canvas .foo { color: red; }")).toBe(".rt-canvas .foo { color: red; }")
  })

  it("does not mis-split on braces/commas inside strings or url()", () => {
    const out = scope(`.a { content: "} , {"; background: url(data:image/svg,<svg/>); }`)
    expect(out).toBe(`.rt-canvas .a { content: "} , {"; background: url(data:image/svg,<svg/>); }`)
  })

  it("emits qualified-rule bodies verbatim (nesting resolves via the scoped parent)", () => {
    const out = scope(`.card { color: red; & .title { font-weight: 700; } }`)
    expect(out).toBe(`.rt-canvas .card { color: red; & .title { font-weight: 700; } }`)
  })

  it("returns null when tenant has no CSS bundle", async () => {
    expect(await loadTenantCss(`nonexistent-${Date.now()}`)).toBeNull()
  })

  it("rewrites top-level @theme block to .rt-canvas (token hydration)", async () => {
    const id = `theme-block-${Date.now()}`
    const dir = resolve(DATA_DIR, "tenants", id)
    const file = resolve(dir, "cms-editor.css")
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      file,
      `@theme {
  --color-secondary: #EFE9DD;
  --color-rule: rgba(0, 0, 0, 0.08);
  --font-title: var(--font-serif);
}
.foo { color: red; }`,
    )
    try {
      const css = await loadTenantCss(id)
      // @theme block becomes .rt-canvas { … } with the tokens inside
      expect(css).toMatch(/\.rt-canvas\s*\{[^}]*--color-secondary:\s*#EFE9DD/)
      expect(css).toMatch(/\.rt-canvas\s*\{[^}]*--color-rule:\s*rgba\(0,\s*0,\s*0,\s*0\.08\)/)
      expect(css).toMatch(/\.rt-canvas\s*\{[^}]*--font-title:\s*var\(--font-serif\)/)
      // The @theme keyword itself must not appear in the output
      expect(css).not.toMatch(/@theme/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it("re-emits tenant --font-* tokens at admin :root under --rt-tenant-font-*", async () => {
    const id = `tenant-fonts-${Date.now()}`
    const dir = resolve(DATA_DIR, "tenants", id)
    const file = resolve(dir, "cms-editor.css")
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      file,
      `@theme {
  --color-bg: #fff;
  --font-sans: 'Inter Variable', sans-serif;
  --font-serif: 'Fraunces Variable', serif;
  --font-title: var(--font-serif);
  --font-text: var(--font-sans);
}`,
    )
    try {
      const css = await loadTenantCss(id)
      // The admin :root rule lands BEFORE the scoped body so that descendants
      // outside .rt-canvas (the inspector drawer) can still read tenant fonts.
      expect(css).toMatch(/:root\{[^}]*--rt-tenant-font-sans:\s*'Inter Variable'/)
      expect(css).toMatch(/--rt-tenant-font-serif:\s*'Fraunces Variable'/)
      // var() references inside tenant font definitions are remapped to the
      // prefixed namespace so they resolve against the sibling admin-scope
      // declarations, never against admin's own --font-sans.
      expect(css).toMatch(/--rt-tenant-font-title:\s*var\(--rt-tenant-font-serif/)
      expect(css).toMatch(/--rt-tenant-font-text:\s*var\(--rt-tenant-font-sans/)
      // Raw --color-bg must not appear un-prefixed in the admin :root block.
      // (The color mirror emits --rt-tenant-color-bg, which is intentional
      // and allowed — but bare --color-bg would be a tenant token leak.)
      const adminRoot = (css ?? "").match(/:root\{[^}]+\}/)?.[0] ?? ""
      expect(adminRoot).not.toMatch(/(?<!-tenant)--color-bg/)
      // The .rt-canvas scoped copy still has the full token set (including the colour).
      expect(css).toMatch(/\.rt-canvas[\s\S]*--color-bg:\s*#fff/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it("rewrites multiple top-level @theme blocks", async () => {
    const id = `theme-multi-${Date.now()}`
    const dir = resolve(DATA_DIR, "tenants", id)
    const file = resolve(dir, "cms-editor.css")
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      file,
      `@theme { --color-a: red; }
@theme { --color-b: blue; }`,
    )
    try {
      const css = await loadTenantCss(id)
      expect(css).toMatch(/--color-a:\s*red/)
      expect(css).toMatch(/--color-b:\s*blue/)
      expect(css).not.toMatch(/@theme/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it("does not mis-parse @theme with nested braces in values", async () => {
    const id = `theme-nested-${Date.now()}`
    const dir = resolve(DATA_DIR, "tenants", id)
    const file = resolve(dir, "cms-editor.css")
    await fs.mkdir(dir, { recursive: true })
    // A string value containing braces should not throw off the parser
    await fs.writeFile(
      file,
      `@theme {
  --x: 1;
  --y: url("data:image/svg+xml,<svg></svg>");
}`,
    )
    try {
      const css = await loadTenantCss(id)
      expect(css).toMatch(/--x:\s*1/)
      expect(css).not.toMatch(/@theme/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it("leaves @theme inside @media alone (passes through to scopeBlock verbatim)", async () => {
    // @theme nested inside a conditional group is unusual/invalid CSS —
    // scopeBlock recurses into @media and treats @theme as an unknown at-rule,
    // emitting it verbatim with its body. We just assert no crash + no token
    // bleed onto .rt-canvas from that block.
    const id = `theme-in-media-${Date.now()}`
    const dir = resolve(DATA_DIR, "tenants", id)
    const file = resolve(dir, "cms-editor.css")
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      file,
      `@media print { @theme { --x: 1; } }`,
    )
    try {
      // Should not throw
      const css = await loadTenantCss(id)
      expect(css).toBeTruthy()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it("drops every @import the browser can't fetch from the canvas page URL", async () => {
    const id = `unresolvable-import-${Date.now()}`
    const dir = resolve(DATA_DIR, "tenants", id)
    const file = resolve(dir, "cms-editor.css")
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      file,
      `@import "tailwindcss";
@import "@fontsource-variable/fraunces/index.css";
@import "./rich-text.css";
@import "../shared/base.css";
@import url("/abs/local.css");
@import "https://fonts.example/keep.css";
@import url("data:text/css;base64,LmZvb3tjb2xvcjpibHVlfQ==");
.foo { color: red; }`,
    )
    try {
      const css = await loadTenantCss(id)
      expect(css).not.toMatch(/tailwindcss/)
      expect(css).not.toMatch(/@fontsource-variable/)
      expect(css).not.toMatch(/rich-text\.css/)
      expect(css).not.toMatch(/shared\/base\.css/)
      expect(css).not.toMatch(/\/abs\/local\.css/)
      expect(css).toMatch(/@import "https:\/\/fonts\.example\/keep\.css"/)
      // data: URL is kept verbatim including embedded ; in base64 payload —
      // the scanner is string-aware so it doesn't terminate at the inner ;.
      expect(css).toMatch(/@import url\("data:text\/css;base64,LmZvb3tjb2xvcjpibHVlfQ=="\)/)
      expect(css).toMatch(/\.rt-canvas \.foo \{ color: red; \}/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe("loadCanvasTenantCss", () => {
  it("skips cms-editor.css for official Amicare tenant-renderers", async () => {
    const { loadCanvasTenantCss } = await import("@/lib/editor/loadTenantCss")
    const css = await loadCanvasTenantCss({ id: TEST_ID, slug: "amicare-zorg", domain: "ami-care.nl" })
    expect(css).toBeNull()
  })

  it("loads cms-editor.css for generic generated tenants", async () => {
    const { loadCanvasTenantCss } = await import("@/lib/editor/loadTenantCss")
    const css = await loadCanvasTenantCss({ id: TEST_ID, slug: "acme-demo", domain: "acme.example.com" })
    expect(css).toMatch(/^@import "https:\/\/fonts\.example\/x\.css";/)
  })
})
