# siab-site-themes

Curated building blocks for the sitegen workflow. Used by
`packages/tools/siab-orchestrator` to source theme components when generating
sites under `sites/<slug>`.

## Layout

```
astro/<theme-slug>/   # Astro themes — preferred. Use components/islands.
plain/<theme-slug>/   # Plain HTML/CSS/JS templates — adapt into Astro components per-engagement.
```

## Adding a theme

1. Drop the theme into the appropriate subdir (e.g. `astro/cleanco/`).
2. Add a `theme.json` at the theme's root (e.g. `astro/cleanco/theme.json`) with at minimum:
   - `name`, `summary`, `tags[]` (e.g. `["dental", "minimal", "single-page"]`)
   - `license`, `source` (URL)
   - `palette`: array of `{name, hex}` — hex with leading `#`, e.g. `[{"name":"primary","hex":"#0066cc"},{"name":"accent","hex":"#ff6600"}]`
3. Commit and push.

The orchestrator agent reads `theme.json` files to suggest themes when the client says "pick for me".
