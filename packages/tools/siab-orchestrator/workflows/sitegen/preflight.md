# Preflight — read before starting a site engagement

This document gives you the context you need to run the sitegen workflow safely
and well. After reading, summarize back to the user what you understood.
**Do not open `workflows/sitegen/prompt.md` until the user confirms.**

## Environment readiness (run this first)

The command wrapper should already have verified `gh` authentication. If this
file is opened directly, verify it before reading further. The publish phase
needs it for `gh run watch` and `gh api`. If this fails, stop and tell the
operator to run `gh auth login` before retrying.

```bash
gh auth status >/dev/null 2>&1 || { echo "FATAL: gh is not authenticated. Run 'gh auth login' (or check 'gh auth status' for details) before retrying."; exit 1; }
```

## Purpose & business model

We sell cheap, quick, quality landing pages to small businesses. Target: sites
that meet UX + SEO standards, mobile-first, responsive. Either one-pagers or up
to ~5-page sites. Speed matters — quote → live should be hours not weeks.

Each engagement produces one generated site under `sites/<slug>` in the
monorepo, plus a monorepo-owned tenant Docker image named
`ghcr.io/optidigi/siteinabox-site-<slug>:latest`. The user runs the
operational side (VPS compose, Traefik route labels, DNS, TLS); your scope ends
at "image published to ghcr.io and user confirmed deploy".

## The deploy chain end-to-end

```
packages/site-template (boilerplate) ─┐
                                      ├─→ sites/<slug>/
packages/site-themes (theme used)   ─┘          │
                                                 │ push monorepo main
                                                 ↓
                              GitHub Actions tenant image workflow
                                                 │
                                                 ↓
                              ghcr.io/optidigi/siteinabox-site-<slug>:latest
                                                 │
                                                 ↓  (out of your scope)
                              VPS docker compose pull & up
                              with Traefik labels → live site
```

## Standards (always on)

- **SEO baseline:** per-page title/description/OG/Twitter, `sitemap.xml`,
  `robots.txt` (points to sitemap), `llms.txt`, `humans.txt`,
  `/.well-known/security.txt`, JSON-LD `Organization` (always) and
  `LocalBusiness` (if NAP supplied), correct `lang` on `<html>`, favicon set,
  `apple-touch-icon`, `manifest.json`.
- **Accessibility floor:** WCAG 2.2 AA. No critical/serious axe violations.
- **Performance budget:** Lighthouse mobile ≥75 perf, ≥85 a11y, ≥85 BP, ≥95 SEO.
- **Security headers** (set in nginx.conf): CSP, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, Permissions-Policy.
- **Mobile-first**, fully responsive across viewports.

## Tool inventory

- `gh` — authenticated on this device. Use for GHA watch + package checks.
- `pnpm` — package manager. `pnpm install`, `pnpm build`, `pnpm dev`.
- `docker` or `podman` — local container build / smoke test before push. (This host has podman; the GHA runner has docker. The Dockerfile and in-container nginx.conf work identically on both.)
- `node` ≥ 20.
- `sharp` — image optimization (Astro built-in pipeline + standalone in Phase 4).
- `lhci` (Lighthouse CLI) and `@axe-core/cli` — used by `auditor` subagent.
- MCPs: `context7` (auto-loaded by plugin) for library docs lookups.

## Subagents (dispatch via the Agent tool)

- **`copywriter`** — Phase 4. Input: raw client text + page slug + role +
  keywords + tone + language. Output: writes
  `src/content/pages/<slug>.md` with SEO frontmatter and structured body.
  Hard rule: respects "do not rewrite" flag; never invents business facts.

- **`auditor`** — Phase 6, after `pnpm dev` is running. Input: preview URL +
  page paths. Runs Lighthouse mobile + axe + curl header check + curl baseline
  files check. Output: prioritized markdown report (must-fix / should-fix /
  nice-to-have). Doesn't modify the site.

- **`reviewer`** — Phase 7, after auditor passes. Wraps `code-reviewer` agent type
  with extra context. Input: site dir + intake brief + auditor report. Reviews
  brief alignment, cleanliness (no `TODO`/`lorem ipsum`/template strings),
  links, JSON-LD validity. Doesn't modify the site.

See full contracts in `workflows/sitegen/agents/*.md`.

## Repo locations & permissions

- Org: `optidigi`. Source lives in the private/public state of the monorepo.
- Image registry: `ghcr.io/optidigi/siteinabox-site-<slug>` with tags
  `:latest` and `:sha-<short>`. Auth on push is via `GITHUB_TOKEN` from GHA —
  no secrets to manage.
- VPS-side `docker compose pull && up -d` is server-side. Don't SSH; you can
  help the user diagnose by running the published image locally.

## Anti-patterns (don't do these)

- Don't invent themes — pick from `packages/site-themes/` or ask the user for a
  path / source.
- Don't push monorepo `main` until the user approves preview.
- Don't strip the SEO baseline. If a theme breaks it, fix the theme integration
  — not the baseline.
- Don't write non-trivial copy inline. Dispatch `copywriter` so the main
  context stays clean.
- Don't modify `packages/site-template/` or `packages/site-themes/` during a
  run. Land template/theme improvements in their own PRs between runs.
- Don't `rm -rf` generated site work. Source belongs under `sites/<slug>`.
  Never delete template, themes, or orchestrator files during a run.

## When you're done reading

Tell the user, in your own words: (a) what the workflow does end-to-end,
(b) what subagents are available and when each fires, (c) the quality floor
the site has to clear, (d) what's out of scope for you. Then ask permission
to read `workflows/sitegen/prompt.md` and start.
