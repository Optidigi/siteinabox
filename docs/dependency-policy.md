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

## Runtime and package-manager contract

As verified on 2026-10-20, the newest released Node LTS is
[24.22.0 Krypton](https://nodejs.org/en/blog/release/v24.22.0).
[26.12.0 remains Current](https://nodejs.org/en/blog/release/v26.12.0), so it is
not an eligible production replacement even though LTS is scheduled later.
Recheck the official release index and actual `process.release.lts` at deployment;
a planned date alone is insufficient. `.nvmrc` owns the exact runtime pin and
root `engines.node` limits the supported major/minimum patch. Every CI setup and
consuming image uses that pin; project tooling rejects another patch and Current.
Use an isolated project toolchain rather than changing a shared machine default.

[pnpm 12.14.0](https://github.com/pnpm/pnpm/releases/tag/v12.14.0) is the newest
stable package manager observed at execution, published 2026-10-15 and eligible
under the 1,440-minute rule. It supports the actual Linux glibc and musl targets
used locally and by image builders. A bounded same-Node probe confirmed that
pnpm 12's native wrapper exits on SIGTERM without stopping its supervised child
or closing the inherited pipes; pnpm 11 forwarded termination. Astro verification
harnesses therefore supervise the package's declared CLI directly with the pinned
Node. The actual routing test now exits normally; assertions and landing behavior
are unchanged. Native pnpm does not remove the application's Node requirement. Builders assert actual Node LTS and the root package-manager
version before installing; CMS/renderer smokes also check the packaged Node
version and LTS marker. Landing retains its unchanged Nginx runtime, while its
builder checks Node. No registry publication or deployment is part of this change.

pnpm owns lockfile generation. Its current lockfile has an environment document
pinning package-manager platform binaries and a project document for dependencies;
both use schema 9.0. Keep both documents. Do not hand-edit them or use the older
CLI to rewrite this lockfile. Frozen installs with strict peer checking pass.
The only new project package identity is the Node 24 typings; application runtime
package versions remain unchanged. Native build permissions, security overrides
and the release-age delay are preserved exactly. Agent-skill suggestions from
dependencies do not authorize automatic skill installation or instruction changes.

## Shared dependency matrix

| Dependency | Current workspace ranges | Policy decision |
| --- | --- | --- |
| React / React DOM | exact `19.2.8` in apps and shared runtime packages | Retain exact singleton versions. |
| Astro | `^7.2.0` in landing and renderer | Framework-constrained; align only through an Astro compatibility change. |
| Next / Payload | CMS-only `16.3.0` / `3.87.1` | CMS framework and schema boundary; do not align with Astro apps. |
| Tailwind | `^4.3.3` across apps and shared packages | Compare generated CSS and framework support before alignment. |
| Vite | `^8.2.1` in Astro apps and CMS | Framework/tooling constrained. |
| Vitest | exact `4.1.10` in all direct consumers | Keep the test runner reproducible; upgrade only as one reviewed toolchain change. |
| React Hook Form | `^7.85.0` in CMS, with the UI peer range aligned | Peer/runtime compatibility; keep the supported form contract aligned. |
| PostHog | `^1.415.2` in CMS, landing, and renderer | Privacy-sensitive runtime; retain lifecycle and consent checks. |
| Motion | `^13.1.0` in UI and renderer | Shared runtime aligned after renderer visual and type checks. |
| TypeScript | exact `6.0.3` in all direct consumers | Keep the compiler reproducible; upgrade only as one reviewed toolchain change. |
| `@types/node` | CMS-only exact `24.19.2` | Workspace-specific type surface aligned to the Node 24 LTS toolchain. |
| Playwright | exact `1.62.1` in direct consumers | Retain exact browser/tool alignment. |
| Zod | `^4.4.3` across apps and packages | Shared contract runtime; preserve lockfile identity. |

## Root overrides

| Entry | Current reason | Removal gate |
| --- | --- | --- |
| `@esbuild-kit/core-utils>esbuild: 0.25.12` | Older Drizzle/TSX/Payload graph | Retire only when the owning graph accepts a patched esbuild without breaking CMS generation and tests. |
| Better Auth XML entries for `fast-xml-parser`, `fast-xml-builder`, `path-expression-matcher`, `xml-naming`, `strnum`, and `anynum` | SSO XML graph repair | Better Auth upstream resolves a safe graph; CMS auth/SSO tests and `pnpm why` confirm the override is unused. |
| `dompurify: 3.4.13` | Monaco/PostHog compatibility with current DOMPurify security fixes | Retire only after both sanitizer consumers resolve a patched version without the override. |
| `immutable: 4.3.9` | Sass compatibility with current Immutable.js security fixes | Sass remains on its existing major and the package graph resolves the patched version. |
| `js-yaml: 4.3.1` | Astro/Payload schema tooling compatibility with current YAML security fixes | Retire only after both graphs resolve the patched version without the override. |
| `postcss: 8.5.26` | Vite/Next/Tailwind compatibility with current PostCSS security fixes | Retire only after Vite and Next resolve a patched compatible version without the override. |
| `sharp: 0.35.3` | Shared Astro/Next native image dependency pinned to the patched libvips line | Retire only after every framework graph resolves `>=0.35.0` without the override and native image builds remain green. |
| `undici: 7.29.0` | jsdom/Payload compatibility with current undici security fixes | Retire only after jsdom and Payload resolve a patched compatible version without the override. |

## Release-age policy

`minimumReleaseAge: 1440` remains the default supply-chain delay. No
release-age exclusions are currently configured; patched versions are resolved
through the normal policy and explicit compatibility overrides where needed.

The historical 2026-08-12 production audit was clean: `pnpm audit --prod` reports zero
informational, low, moderate, high, or critical findings. The `sharp` override
is retained as a narrow compatibility and security policy because Astro accepts
the patched `0.35.x` line while its optional dependency range can otherwise
leave a vulnerable `0.34.x` resolution in the lockfile.

Each exception can be retired only after:

1. `pnpm why --recursive PACKAGE` identifies no process-specific need.
2. A frozen install resolves the intended graph without the exception.
3. The owning unit, integration, browser, renderer, legal, or MCP checks pass.
4. Release notes and security advisories are reviewed for the affected graph.

## Current security disposition

The 2026-10-20 production-dependency audit reports **8 critical, 35 high,
31 moderate and 7 low** entries. A comparison against the unchanged pre-M05
project graph finds no new advisory identities introduced by the runtime/type
contract change. The older CLI additionally reports two dev-only Vitest entries
in its production audit; do not present their omission as a security fix.
Critical entries affect Next, Payload and Astro. This supersedes the historical
clean-audit claim for release decisions. Remediation belongs to their coherent
framework/security upgrades, with compatibility, migration and consuming-image
proof; publication/deployment remains blocked pending their disposition. Do not
remove overrides, force peers or downgrade security controls to obtain a clean
report. Re-run the audit on the actual selected graph before release.

## Reviewed updates still deferred

The following 2026-08-12 version observations are historical, not current pins.
Framework candidates are rechecked in their owning upgrade milestone. The newer
Node 26 line has a specific current blocker: it is not yet LTS; recheck official
status and consuming compatibility when LTS is actually released. Node 26 typings
are likewise deferred while the selected application runtime is Node 24, so
type checking does not advertise APIs absent from that runtime. No newer stable pnpm was observed than the
selected 12.14.0. Preserve the age/security rule when rechecking either tool.

On 2026-08-12, the compatible update pass removed the reviewed direct drift
reported by the previous inventory. The remaining direct entries from
`pnpm outdated --recursive --format json` are `graphql` and `typescript`.
Table v9 is now migrated in CMS and must be verified as a supported API change
rather than treated as a version alignment. GraphQL 17 remains blocked by
Payload's GraphQL 16 peer contract.
TypeScript 7 remains blocked for this workspace because Astro's embedded
tooling is not yet compatible with the new compiler API; keep TypeScript 6
until that ecosystem boundary changes.

A read-only registry inventory with the 1,440-minute age gate temporarily
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
