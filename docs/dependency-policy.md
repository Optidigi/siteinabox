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
both use schema 9.0. Keep both documents. pnpm 12 fetch reads the lockfile
without a `--frozen-lockfile` option; CMS prefetch uses that supported contract,
then retains `install --frozen-lockfile --offline` for materialization. Do not hand-edit them or use the older
CLI to rewrite this lockfile. Frozen installs with strict peer checking pass.
In the M05 runtime-only change, the only new project package identity was the
Node 24 typings; M06 separately updates the framework group below. The root also declares those same typings so
workspace peer resolution shares the Node 24 context. A CMS-only declaration left
shared UI's optional Next peer on Node 26 typings and created two next-intl wrapper
identities. CMS mocks then missed the shared wrapper. Supplying the root peer
unifies the graph without aliases, hoisting or peer-rule exceptions. The real
provider/shared-dialog control passes on both graphs; this is a module/mock
resolution regression, not evidence of a production translation outage. Native build permissions, security overrides
and the release-age delay are preserved exactly. Agent-skill suggestions from
dependencies do not authorize automatic skill installation or instruction changes.

## CMS framework security group

As checked on 2026-10-20, stable [Next 16.4.2](https://github.com/vercel/next.js/releases/tag/v16.4.2),
[Payload 3.91.0](https://github.com/payloadcms/payload/releases/tag/v3.91.0) and
[React 19.3.1](https://github.com/react/react/releases/tag/v19.3.1) satisfy the
published peer ranges and the 1,440-minute age gate. All React/React DOM runtime
consumers and React typings stay exact singletons, including unchanged Astro
applications. Payload 4 remains prerelease. Payload owns Lexical 0.50.0; standalone
0.52.0 is deferred until Payload supports it and custom editor tests pass.
Custom nodes/plugins use Payload's public Lexical re-exports. The real editor
round-trip and clipboard test also requires themed nodes to declare their block
identity explicitly: they are `RtBlock` values, while Lexical's default decorator
is inline. The new graph discarded them during loading; the old graph also
discarded them during paste. Both paths now preserve their structured content. The single exception
is `@lexical/clipboard`: Payload 3.91.0 has no clipboard export, so the existing
paste API retains that direct package at exactly Payload's 0.50.0. The dependency
contract checks it against Payload's declared version; no second Lexical runtime
or peer exception is permitted.

[Payload's security upgrade notes](https://github.com/payloadcms/payload/releases/tag/v3.90.0)
require a nullable `users.reset_password_requested_at` timestamp. Types and import
maps are generated by Payload. The new generated migration is an adapter diff
against a snapshot generated by the old adapter/config, because the historical
snapshot predates later committed migrations. Its SQL adds only this column;
existing migration files remain unchanged. The migration index is generated over
dated migration files, excluding the existing non-migration helper. Reconciliation
of pre-existing snapshot drift remains separate from this upgrade. Fresh and
populated fixtures must exercise the committed migration index, retained data,
access and rich-text editor import/export/copy/paste. Do not infer data safety
from compilation alone.

The timestamp migration is additive. Prefer a forward application fix while
retaining the column. A down migration deletes password-reset throttle state;
never run it on production as an automatic rollback. An approved production
upgrade still requires a verified backup/restore and separate rollout approval.
Queued built-in scheduled-publish jobs, if present at rollout, must be inventoried
and recreated with the scheduling auth collection per upstream guidance; ordinary
verification never connects production or rewrites that queue. Client-upload
adapters are not configured. Preserve the new default SVG/XML restrictions and
verify tenant media ownership; do not enable `allowRestrictedFileTypes` merely to
restore old permissive behavior.

[Next's October security guidance](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
requires patched Next even without a known matching cache function. This project
uses App Router/Server Actions; their DoS condition is relevant. The image RCE
condition specifically names glibc, whereas production images are Alpine/musl;
that difference is not a claim of complete immunity. The CMS packaged smoke
loads sharp through Next's own dependency context and processes synthetic pixels
in the actual runner, asserting the governed version and native library loading. The old sharp override
prevented upstream from selecting a fix, so it is raised to 0.35.5 for both Next
and Astro consumers. Undici's override likewise moves to the patched compatible
7.x line rather than forcing a major upgrade. DOMPurify and YAML overrides
are raised to compatible patched releases; targeted transitive updates cover
Next/Payload Browserslist, fast-uri and fast-copy. Payload now exposes Nodemailer 10
types; the custom email adapter uses the bundled types and handles address groups,
nested lists and missing addresses without a provider call during tests.

## Astro and renderer compatibility

On 2026-10-20, [Astro 7.4.1](https://github.com/withastro/astro/releases/tag/astro@7.4.1),
[Node integration 11.1.9](https://github.com/withastro/astro/releases/tag/@astrojs%2Fnode@11.1.9),
[React integration 7.1.0](https://github.com/withastro/astro/releases/tag/@astrojs%2Freact@7.1.0),
Sitemap 3.7.4, Check 0.9.11 and Vite 8.3.4 are stable and eligible under the
1,440-minute release-age rule. The raised minimum Node 22.22.0 is satisfied by
the exact Node 24.22.0 LTS runtime. React/DOM remain the exact shared 19.3.1
identity selected by the CMS upgrade.

The React integration's major update uses version 6 of Vite's React plugin and Oxc for
JSX/Fast Refresh, removing its Babel option. Neither app configures custom Babel
transforms, so no application adapter or markup changes are needed. The optional
React Compiler remains disabled; no experimental Astro rendering/cache features
are enabled. Renderer standalone SSR, dynamic tenant host resolution, neutral
unknown-host handling, origin trust and form/appointment ingress remain unchanged.
Landing stays static on Nginx; copy, SEO, legal content, layouts and interactions
are unchanged. Shared source and lockfile still trigger all three consuming images.

The root supplies exact Sass 1.105.2 as a workspace build peer for Astro/Vite/Next,
replacing their old automatically selected Sass/chokidar chain. Payload 3.91.0
separately pins Sass 1.77.4 as its own dependency. Preserve that upstream pin;
its transitive braces advisory remains an explicit release blocker. Keep the
existing global patched Immutable 4.x override for that old Sass, and a narrow
5.1.9 selector for Sass 1.105.2's required 5.x range. Do not force incompatible
Immutable majors across the two contexts. Both Sass APIs compile a synthetic
nested stylesheet in verification. The compatible fflate 0.4.9 patch removes
PostHog's old compression advisory without changing PostHog or consent behavior.

Renderer unit/host-routing checks, both analytics browser lifecycles and the
landing responsive/accessibility/phone/keyboard/interaction suite are required.
A baseline comparison of all nine emitted HTML documents preserves semantic
DOM/text/attributes, excluding compiler-owned script/style payloads, hash URLs,
markers and the expected Astro generator-version metadata. This is not byte-for-byte
bundle or screenshot identity; browser/layout checks and actual unpublished
packaged-image smokes provide their separate evidence. Do not weaken assertions
or accept unexplained visual changes after a framework update.

## Shared dependency matrix

| Dependency | Current workspace ranges | Policy decision |
| --- | --- | --- |
| React / React DOM | exact `19.3.1` in apps and shared runtime packages | Retain exact singleton versions. |
| Astro / Node / React integration | exact `7.4.1` / renderer `11.1.9` / `7.1.0` | Coherent Astro group; retain renderer origin/routing and landing browser contracts. |
| Next / Payload | CMS-only `16.4.2` / `3.91.0` | CMS framework and schema boundary; do not align with Astro apps. |
| Tailwind | `^4.3.3` across apps and shared packages | Compare generated CSS and framework support before alignment. |
| Vite | exact `8.3.4` in Astro apps; CMS retains `^8.2.1` | Framework/tooling constrained; test-runner and CMS upgrades remain separate. |
| Vitest | exact `4.1.10` in all direct consumers | Keep the test runner reproducible; upgrade only as one reviewed toolchain change. |
| React Hook Form | `^7.85.0` in CMS, with the UI peer range aligned | Peer/runtime compatibility; keep the supported form contract aligned. |
| PostHog | `^1.415.2` in CMS, landing, and renderer | Privacy-sensitive runtime; retain lifecycle and consent checks. |
| Motion | `^13.1.0` in UI and renderer | Shared runtime aligned after renderer visual and type checks. |
| TypeScript | exact `6.0.3` in all direct consumers | Keep the compiler reproducible; upgrade only as one reviewed toolchain change. |
| `@types/node` | root and CMS exact `24.19.2` | Root supplies a consistent Node 24 peer context across workspaces; CMS retains its explicit build dependency. |
| Playwright | exact `1.62.1` in direct consumers | Retain exact browser/tool alignment. |
| Zod | `^4.4.3` across apps and packages | Shared contract runtime; preserve lockfile identity. |

## Authentication integration group

Better Auth and its bundled core/adapters/telemetry are aligned at **1.7.11**;
`@better-auth/infra` is **0.4.20**. These exact direct pins were selected from
publisher metadata after the normal 1440-minute delay. Better Auth 1.7.12 was
published 2026-10-20T11:59:45Z and is deferred until after
2026-10-21T11:59:45Z, with fresh release/security/compatibility review. No age
exception, peer override, native-build permission or unrelated graph refresh is
part of this group. The framework's private Zod now satisfies its required
`^4.5.4`; CMS/shared Zod remains 4.4.3. Next/React/Payload/PostgreSQL peers remain
within the selected packages' declared ranges.

The [publisher upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide)
explains that 1.7.3 and later retain the 1.6 provider/account key layout. SIAB uses
the built-in PostgreSQL adapter, magic-link and Next cookie plugins plus the
optional dashboard plugin. It does not enable the changed OAuth-provider, SSO,
SCIM or MCP identity-provider schemas. The SDK migration planner against real
committed migrations requires no tables, columns or indexes for either existing
CMS or preview configuration. Populated fixtures retain account rows, Payload
links and session behavior; no schema migration is added. Historical migrations
and the separate CMS/preview namespaces remain intact.

The internal user-creation adapter now requires source metadata. The existing
loopback-only development builder seed identifies its trusted administrative
source explicitly; this adds no endpoint or role permission. Its real signed
cookie is verified through the upgraded preview SDK. Production origin/CSRF
checks are explicitly enabled in memory-adapter SDK tests because the SDK's test
mode otherwise skips them. These tests exercise the configured instances with
mail/Payload boundaries doubled, not a new authentication policy.

First-social UI requests were reproduced failing with both installed SDK1.6.26
and1.7.11 because `payloadUserId` was parsed before its server hook. A parser-only
null default defers resolution to the existing verified/eligible Payload lookup,
while required/unique/input-false metadata and the physical NOT NULL/unique
constraints remain unchanged. Real database tests require no SQL default and
reject null writes; no placeholder identity or migration is introduced.

Microsoft subject migration, duplicate-key inventory, in-flight magic-link
cutover and live provider verification remain separate release prerequisites;
see the [authentication contract](contracts/authentication.md#upgrade-and-cutover).
Reverting package pins is insufficient after a real provider-ID migration.
The remaining Payload-private Sass/braces advisory continues to block release.

## Mail transport qualification

Nodemailer **10.1.7** was already selected in the CMS framework group and remains
current in publisher metadata checked 2026-10-20. It includes its own compatible
types; no stale DefinitelyTyped replacement, package bump or lockfile refresh is
needed. The adapter uses its published address-parser export and typed transport
contract. Release-age/native/override policy remains unchanged.

[GHSA-6vj9-mwq6-2f5v](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-6vj9-mwq6-2f5v)
is patched from 10.0.2. Its cache exploit requires different TLS server names on
transports sharing a DNS host. SIAB uses one fixed Cloudflare SMTP host with
implicit TLS and no per-tenant TLS server-name override; that exploit condition
was not established by historical version matching. Current 10.1.7 is outside
the affected range. This is source/package qualification, not a live TLS probe
or a blanket image/security clearance.

The [mail contract](contracts/email.md) owns readiness, receipts and retry states.
Its adapters validate SMTP recipient acceptance and the
[Cloudflare response shape](https://developers.cloudflare.com/api/resources/email_sending/methods/send/),
including queued/bounced/suppressed recipients, without logging response bodies.
Uncertain writes require manual reconciliation. The inherited Payload-private
Sass/braces advisory still blocks release independently of this transport work.

At the historical M10 audit snapshot, the byte-identical production lockfile reported
**0 critical, 3 high and 1 moderate** findings: the inherited braces issue plus
three newly observed findings on `@mastra/core > @modelcontextprotocol/server`
2.0.0. These are
[shared transport isolation](https://github.com/advisories/GHSA-jm63-cq47-j5jp),
[request validation memory exhaustion](https://github.com/advisories/GHSA-46jr-4wx8-v453),
and [bearer-token audience validation](https://github.com/advisories/GHSA-rvq5-wwqv-78pq).
Published fixes start at 2.3.0. They are not introduced or waived by the mail
change. The M11 graph qualification below removes that dependency path;
G03/release remain blocked by the remaining advisory. No MCP endpoint reachability or safety conclusion is
inferred merely from this package-path inventory.

## AI runtime compatibility

[Mastra core 1.78.0](https://github.com/mastra-ai/mastra/releases/tag/@mastra/core@1.78.0)
was published on 2026-10-15 and satisfies the 1,440-minute rule and Node 24
requirement. Its public Agent/tool/stream APIs remain usable, but default error
processors and failed-stream completion semantics changed despite a minor
version increment. The [AI runtime contract](contracts/ai-runtime.md) owns the
explicit retry opt-out, terminal-state handling and later accounting obligations.
Controlled old/new HTTP probes retain the same configured model, Responses route
and reasoning; no live requests are required for compatibility proof.

The owning pnpm upgrade removes `@modelcontextprotocol/server` and its core
2.0.0 package from this production graph, following the upstream
[embedded context declaration change](https://github.com/mastra-ai/mastra/pull/23998).
This is removal of the affected installed dependency, not a universal statement
about endpoint reachability or all MCP consumers. A fresh production audit on
this graph reports **0 critical, 1 high and 0 moderate**; Payload's private
Sass/braces advisory still blocks release. Existing retained package records,
security overrides, native-build permissions and release-age policy are unchanged.
React/React DOM singleton identity must remain exact across consumers.

## Infrastructure identities

[The reviewed image and Action inventory](infrastructure-images.json) records
execution-time versions, immutable publisher digests, Linux platform descriptors
and official Action release commits. Dockerfiles/Compose/workflows keep literal
pins; `pnpm infrastructure:check` checks their agreement. It does not authorize a
deployment or attest unexecuted image tests. All six workflows retain their event,
permission, required-context and publication boundaries.

Node remains 24.22.0 LTS on the digest-pinned Alpine base. The Dockerfile frontend
is the published 1.28.0 image pinned by digest. Landing retains Nginx's existing
mainline channel, now exact 1.31.7 with its publisher digest; this is a released
mainline build, distinct from the older 1.30 stable branch. Application source,
Nginx configuration, content and visuals are unchanged. Both Node runners retain
UID 1000; the actual image verifier records architecture and Alpine release, and
processes native sharp pixels through Next.

PostgreSQL 18.6 is the [current supported stable minor](https://www.postgresql.org/support/versioning/).
19 RC1 is not eligible. Production/dev/CI use the same reviewed 18.6 image without
changing the existing major, PGDATA mount, volume names, ports, credentials or
network boundaries. The verification-only 18.4 image is a populated same-major
baseline, not a deployment candidate. The CMS image smoke runs real committed
migrations, preserves a sanitized tenant/theme fixture and schema/history through
an 18.4-to-18.6 binary/container replacement on one uniquely labelled owned volume,
then reruns the actual boot entrypoint and checks that no migration is pending.
It checks the database's actual version, OS and unchanged PostgreSQL UID. The
volume is eligible for cleanup only while its ownership label still matches;
this is not a production backup/restore or Amicare rollout claim.

Cloudflared 2026.10.1 is the selected eligible release. 2026.10.2 was published on
2026-10-20 at 09:17:30 UTC and was under the approved 1,440-minute age window at
selection; recheck it after 2026-10-21 at 09:17:30 UTC with fresh compatibility and
security evidence. The native Linux AMD64 validation binary is checked against
its publisher SHA-256. The image verifier uses the immutable connector image with
network disabled and Compose UID 1000, compiling the existing ingress builder for
both services. Actual `ingress validate` / `ingress rule` commands verify service
targets, unknown-host 404 handling and rejection of a missing final catchall.
These offline checks neither connect a tunnel nor attest installed provider state.

Checkout 7.0.1 and Download Artifact 8.0.2 already matched the current publisher
releases. Setup Node 7.1.0, Upload Artifact 7.0.2 and pnpm Setup 6.1.0 are refreshed
by exact release commit; pnpm Setup explicitly supports pnpm 12. Registry cache
exports, image publication and live replacement remain separate approved gates.
Recheck release support, advisories and immutable identities at actual rollout;
never replace persisted volumes as an update or rollback shortcut.

## Root overrides

| Entry | Current reason | Removal gate |
| --- | --- | --- |
| `@esbuild-kit/core-utils>esbuild: 0.25.12` | Older Drizzle/TSX/Payload graph | Retire only when the owning graph accepts a patched esbuild without breaking CMS generation and tests. |
| Better Auth XML entries for `fast-xml-parser`, `fast-xml-builder`, `path-expression-matcher`, `xml-naming`, `strnum`, and `anynum` | SSO XML graph repair | Better Auth upstream resolves a safe graph; CMS auth/SSO tests and `pnpm why` confirm the override is unused. |
| `dompurify: 3.4.17` | Monaco/PostHog compatibility with current DOMPurify security fixes | Retire only after both sanitizer consumers resolve a patched version without the override. |
| `immutable: 4.3.9` plus `sass@1.105.2>immutable: 5.1.9` | Keep Payload-owned Sass 1.77.4 on patched compatible 4.x; the root build peer Sass 1.105.2 requires compatible 5.x | Recheck each owning Sass dependency range and compile through both contexts before changing these selectors. |
| `js-yaml: 4.3.2` | Astro/Payload schema tooling compatibility with current YAML security fixes | Retire only after both graphs resolve the patched version without the override. |
| `postcss: 8.5.26` | Vite/Next/Tailwind compatibility with current PostCSS security fixes | Retire only after Vite and Next resolve a patched compatible version without the override. |
| `sharp: 0.35.5` | Shared Astro/Next native image dependency pinned to the patched libvips line | Retire only after every framework graph resolves `>=0.35.5` without the override and native image builds remain green. |
| `undici: 7.30.1` | jsdom/Payload compatibility with current undici security fixes | Retire only after jsdom and Payload resolve a patched compatible version without the override. |

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

The M07 2026-10-20 production-dependency audit reports **0 critical, 1 high,
0 moderate and 0 low** entries. M06's 1 critical/9 high/7 moderate/1 low and
M05's earlier larger counts are historical. The Astro/image and devalue/adapter
findings are resolved by the coherent framework update; compatible fflate
removes the remaining compression finding. This records the resolved graph,
not a claim that every old condition was exploitable on production.

The remaining high advisory is `GHSA-vfj7-8cjw-p6xm`: Payload 3.91.0 explicitly
pins Sass 1.77.4, which retains chokidar 3 and braces 3.0.3. The braces advisory
has no patched release. Updating the workspace Sass peer removes this chain from
Astro/Vite/Next peers but cannot change Payload's private exact dependency. Do
not force an unreviewed replacement, hide it with an audit exclusion, or claim a
clean production graph. Recheck when Payload updates its owned Sass or when a
separately reviewed compatibility fix is available, including CMS CSS/build and
behavioral regressions. Publication/deployment remains blocked pending this
security disposition and all separately approved operational gates. Re-run audit
and native/platform evidence at actual release time.

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
