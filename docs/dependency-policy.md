# Dependency and package-manager policy

The manifests, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` are the executable
authority. This document records why current divergence and root policy entries
are retained, and what evidence is required before changing them. It is not a
request to align every workspace to one version.

## Rules

- Keep React and React DOM singleton identity exact across runtime packages.
- Keep framework-owned versions aligned only where the framework or peer graph
  requires it.
- Treat security overrides, native build permissions, and release-age policy as
  separate concerns from ordinary version drift.
- Do not combine dependency upgrades with behavior refactors, schema changes,
  legal changes, or deployment changes.
- Use the installed pnpm version for `pnpm why --recursive PACKAGE`, frozen
  installs, and audit evidence.

## Shared dependency matrix

| Dependency | Current workspace ranges | Policy decision |
| --- | --- | --- |
| React / React DOM | exact `19.2.6` in apps and shared runtime packages | Retain exact singleton versions. |
| Astro | `^6.2.1` in intake, landing, and renderer | Framework-constrained; align only through an Astro compatibility change. |
| Next / Payload | CMS-only `16.2.6` / `3.86.0` | CMS framework and schema boundary; do not align with Astro apps. |
| Tailwind | `^4.2.4` in static apps, `^4.3` in CMS/UI, `^4.3.1` in renderer | Compare generated CSS and framework support before alignment. |
| Vite | `^7.3.5` in Astro apps, `^8.0.14` in CMS | Framework/tooling constrained. |
| Vitest | exact `4.1.9` in CMS, caret ranges elsewhere, same lockfile resolution | Candidate for catalog review, not an upgrade target by itself. |
| React Hook Form | `^7.77.0` in CMS/UI, `^7.79.0` in intake | Peer/runtime compatibility; no blanket alignment. |
| PostHog | `^1.382.0` in CMS, `^1.386.8` in landing/renderer | Privacy-sensitive runtime drift; require lifecycle checks. |
| Motion | `^12.23.24` in UI, `^12.42.2` in renderer | Shared runtime divergence; compare generated client bundles first. |
| TypeScript | exact `6.0.3` in CMS/shared packages, caret in static apps | Root toolchain authority; package ranges are not proof of safe upgrade. |
| `@types/node` | CMS-only exact `25.9.1` | Workspace-specific type surface. |
| Playwright | exact `1.61.0` in direct consumers | Retain exact browser/tool alignment. |
| Zod | `^4.4.3` across apps and packages | Shared contract runtime; preserve lockfile identity. |

## Root overrides

| Entry | Current reason | Removal gate |
| --- | --- | --- |
| `@esbuild-kit/core-utils>esbuild: 0.25.12` | Older Drizzle/TSX/Payload graph | `pnpm why --recursive esbuild` shows no unsafe upstream request; CMS build, typecheck, tests, and audit pass. |
| Better Auth XML entries for `fast-xml-parser`, `fast-xml-builder`, `path-expression-matcher`, `xml-naming`, `strnum`, and `anynum` | SSO XML graph repair | Better Auth upstream resolves a safe graph; CMS auth/SSO tests and `pnpm why` confirm the override is unused. |
| `jsdom>undici: 7.28.0` | jsdom/Vitest/Payload compatibility | Frozen install and CMS tests pass without the override. |
| `monaco-editor>dompurify: 3.4.7` | Monaco compatibility | Dedicated security decision and an upstream-compatible non-vulnerable graph. |
| `next>postcss: 8.5.15` | Next/Tailwind compatibility | Official Next support and CMS build pass without it. |

## Release-age policy

`minimumReleaseAge: 1440` remains the default supply-chain delay. The current
exclusions are deliberate exceptions for the exact Vitest 4.1.9 package set,
`js-yaml@4.2.0`, `undici@7.27.0`, and `vitest@4.1.9`. The exception list is not
evidence that those versions are safe to upgrade or remove.

Each exception can be retired only after:

1. `pnpm why --recursive PACKAGE` identifies no process-specific need.
2. A frozen install resolves the intended graph without the exception.
3. The owning unit, integration, browser, renderer, legal, or MCP checks pass.
4. Release notes and security advisories are reviewed for the affected graph.

## Review commands

```bash
pnpm why --recursive PACKAGE
pnpm install --frozen-lockfile
pnpm outdated --recursive
pnpm audit
pnpm check:toolchain
```

`outdated` is an inventory signal, not an upgrade approval. Overrides and
release-age exclusions should be removed one coherent group at a time, with a
separate rollbackable PR and an explicit lockfile diff.
