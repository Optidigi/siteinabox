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
| React / React DOM | exact `19.2.8` in apps and shared runtime packages | Retain exact singleton versions. |
| Astro | exact `7.2.8` in landing and renderer | Framework-constrained; align only through an Astro compatibility change. |
| Next / Payload | CMS-only `16.3.6` / `3.90.1` | CMS framework and schema boundary; do not align with Astro apps. |
| Tailwind | `^4.3.3` across apps and shared packages | Compare generated CSS and framework support before alignment. |
| Vite | `^8.2.1` in Astro apps and CMS | Framework/tooling constrained. |
| Vitest | exact `4.1.11` in all direct consumers | Keep the test runner reproducible; upgrade only as one reviewed toolchain change. |
| React Hook Form | `^7.85.0` in CMS, with the UI peer range aligned | Peer/runtime compatibility; keep the supported form contract aligned. |
| PostHog | `^1.415.2` in CMS, landing, and renderer | Privacy-sensitive runtime; retain lifecycle and consent checks. |
| Motion | `^13.1.0` in UI and renderer | Shared runtime aligned after renderer visual and type checks. |
| TypeScript | exact `6.0.3` in all direct consumers | Keep the compiler reproducible; upgrade only as one reviewed toolchain change. |
| `@types/node` | CMS-only exact `26.2.0` | Workspace-specific type surface aligned to the Node 26 toolchain. |
| Playwright | exact `1.62.1` in direct consumers | Retain exact browser/tool alignment. |
| Zod | `^4.4.3` across apps and packages | Shared contract runtime; preserve lockfile identity. |

## Root overrides

| Entry | Current reason | Removal gate |
| --- | --- | --- |
| `@esbuild-kit/core-utils>esbuild: 0.25.12` | Older Drizzle/TSX/Payload graph | Retire only when the owning graph accepts a patched esbuild without breaking CMS generation and tests. |
| Better Auth XML entries for `fast-xml-parser`, `fast-xml-builder`, `path-expression-matcher`, `xml-naming`, `strnum`, and `anynum` | SSO XML graph repair | Better Auth upstream resolves a safe graph; CMS auth/SSO tests and `pnpm why` confirm the override is unused. |
| `dompurify: 3.4.16` | Monaco/PostHog compatibility with current DOMPurify security fixes | Retire only after both sanitizer consumers resolve a patched version without the override. |
| `immutable: 4.3.9` | Sass compatibility with current Immutable.js security fixes | Sass remains on its existing major and the package graph resolves the patched version. |
| `js-yaml: 4.3.2` | Astro/Payload schema tooling compatibility with current YAML security fixes | Retire only after both graphs resolve the patched version without the override. |
| `postcss: 8.5.26` | Vite/Next/Tailwind compatibility with current PostCSS security fixes | Retire only after Vite and Next resolve a patched compatible version without the override. |
| `sharp: 0.35.5` | Shared Astro/Next native image dependency pinned to the patched libvips line | Retire only after every framework graph resolves `>=0.35.0` without the override and native image builds remain green. |
| `undici: 7.29.1` | jsdom/Payload compatibility with current undici security fixes | Retire only after jsdom and Payload resolve a patched compatible version without the override. |

## Scoped security overrides added on 2026-10-07

| Entry | Owning graph and reason | Removal gate |
| --- | --- | --- |
| `@babel/helper-compilation-targets>browserslist: 4.28.7` | Babel target-query cache/statistics fixes; same major | Babel resolves a fixed compatible version without this override; build checks pass. |
| `ajv>fast-uri: 3.1.8` | Payload/Mastra/resolver and language-tool URI normalization fixes; retain URI 3.x | All Ajv paths resolve a patched 3.x graph without this override; validation tests pass. |
| `posthog-js>fflate: 0.4.9` | Malformed ZIP64 loop; retain PostHog's 0.4.x API line | PostHog resolves a safe compatible compressor; analytics/browser checks pass. |
| `astro>svgo: 4.1.0` | SVG script-removal bypasses; retain SVGO 4.x | Astro resolves a patched optimizer; assets/build checks pass. |
| `astro>devalue` and `@astrojs/react>devalue: 5.9.3` | Serialization fixes; retain 5.x | Both framework owners resolve safe serializers; SSR/hydration checks pass. |
| `astro>http-cache-semantics: 4.3.0` | Cache-policy disclosure; first published eligible compatible version above the vulnerable range | Astro resolves a safe graph; remote-image/build checks pass. |
| `astro>smol-toml` and `@astrojs/internal-helpers>smol-toml: 1.9.0` | Publisher's linear-time parsing fix; audit's 1.8.1 floor is unpublished | Both owners resolve the patched parser; config/build checks pass. |
| `source-map-js@<1.2.2: 1.2.2` | Multiple independent CSS/build parents; restrict replacement to vulnerable versions on the same major | Every parent resolves safe maps without replacement; affected CSS and image builds pass. |
| `pino-pretty>fast-copy: 3.1.0` | Deep-copy stack exhaustion fix within the logger's 3.x line | Payload logger resolves a safe compatible copy implementation; CMS checks pass. |

Existing overrides were individually inventoried with `pnpm why --recursive`.
The esbuild override remains specific to the old Drizzle/TSX graph; Immutable
and PostCSS remain compatible shared resolutions. Better Auth XML entries have
no current resolved consumer and are retained as separately reviewable historical
policy pending their documented removal checks, rather than combined with this
security patch. DOMPurify, js-yaml, Sharp and Undici receive compatible security
patches. No peer-major override is used to hide findings. Nodemailer is directly updated
to exact `10.0.9` after verifying no email-adapter peer constraint, supported
imports, own types and existing mail tests. Selector-parser remains a reviewed
build-time finding pending its consumer-contract migration.

## Release-age policy

`minimumReleaseAge: 1440` remains the default supply-chain delay. No
release-age exclusions are currently configured; patched versions are resolved
through the normal policy and explicit compatibility overrides where needed.

Historical evidence: the 2026-08-12 production audit was clean: `pnpm audit --prod` reports zero
informational, low, moderate, high, or critical findings. The `sharp` override
is retained as a narrow compatibility and security policy because Astro accepts
the patched `0.35.x` line while its optional dependency range can otherwise
leave a vulnerable `0.34.x` resolution in the lockfile.

Each exception can be retired only after:

1. `pnpm why --recursive PACKAGE` identifies no process-specific need.
2. A frozen install resolves the intended graph without the exception.
3. The owning unit, integration, browser, renderer, legal, or MCP checks pass.
4. Release notes and security advisories are reviewed for the affected graph.

The current review, compatible security patches, audit corrections and remaining
release gates are recorded in [Dependency security](dependency-security.md) and
its [checked inventory](dependency-security.json). The historical clean audit
above is not the current security state.

## Reviewed updates still deferred

On 2026-08-12, the compatible update pass removed the reviewed direct drift
reported by the previous inventory. The remaining direct entries from
`pnpm outdated --recursive --format json` are `graphql` and `typescript`.
Table v9 is now migrated in CMS and must be verified as a supported API change
rather than treated as a version alignment. GraphQL 17 remains blocked by
Payload's GraphQL 16 peer contract.
TypeScript 7 remains blocked for this workspace because Astro's embedded
tooling is not yet compatible with the new compiler API; keep TypeScript 6
until that ecosystem boundary changes.

Historical 2026-08-12 inventory: a read-only registry inventory with the 1,440-minute age gate temporarily
disabled also found newer patch releases that are not yet eligible for the
lockfile: Astro `7.2.1` and `@astrojs/node` `11.1.1` (published 2026-08-11),
Payload `3.88.0` and Better Auth `1.6.27` (published 2026-08-11), and PostHog
`1.415.7` and Axe Playwright `4.13.0` (published 2026-08-12). Do not bypass
the age gate for routine updates; re-run the normal inventory after each
release has aged for 24 hours and review the owning framework release notes.

`web-vitals` was removed from the renderer's direct dependencies because no
source consumer exists; PostHog retains its own transitive web-vitals copies.
The Material Color 0.4 package remains current with a narrow Vitest inline
compatibility setting for its upstream extensionless test-module import. These
are ownership decisions, not reasons to weaken frozen-install or audit policy.

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
