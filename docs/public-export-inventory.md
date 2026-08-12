# Public package export reachability

This is the current reachability and compatibility inventory for `packages/*`
package exports. It is an evidence record, not permission to remove an export.
An export is public when it appears in a package `exports` map, even if the
workspace has no static import for it.

## Audit commands

The manifest list was generated on 2026-08-12 with:

```text
node --input-type=module -e 'import { readFile } from "node:fs/promises"; for (const p of ["packages/contracts/package.json", "packages/legal-content/package.json", "packages/site-renderer/package.json", "packages/ui/package.json"]) { const m = JSON.parse(await readFile(p, "utf8")); console.log(p, Object.keys(m.exports ?? {})); }'
git grep -nE '@siteinabox/(contracts|legal-content|site-renderer|ui)/' -- apps packages docs scripts
git grep -nE 'source-templates|iframe-editor|fixtures/tenants' -- .
```

Dynamic imports, generated scripts, package consumers outside this checkout,
published snapshots, migrations, and rollback tooling require additional
evidence. An empty static-import result is recorded as unknown, never as dead.

## Contracts package

Package: `packages/contracts/package.json`

| Export | Workspace consumer or evidence | Disposition | External/public status | Compatibility risk |
| --- | --- | --- | --- | --- |
| `.` | Shared contract package used by applications and packages. | retain public | Manifest-public; active workspace consumer. | High: shared types and schemas. |
| `rich-text` | Renderer rich-text implementation and contract tests. | retain public | Manifest-public; published content shape may depend on it. | High: persisted structured content. |
| `generation` | CMS seed/generation scripts, snapshots, and renderer. | retain public | Manifest-public; active workspace consumer. | High: persisted/published snapshots. |
| `iframe-editor` | CMS editor-frame pages and runtime. | retain public | Manifest-public; active workspace consumer. | High: editor DOM/geometry contract. |
| `legal` | CMS legal records and legal package consumers. | retain public | Manifest-public; governed legal consumer. | High: legal history and consent. |
| `block-catalog` | CMS block registry/site settings and renderer catalog. | retain public | Manifest-public; active product catalog. | High: published snapshots and planned F17 replacement. |
| `commerce` | CMS checkout, commerce records, and contract tests. | retain public | Manifest-public; active commerce consumer. | High: payment and rollback behavior. |
| `deploy-targets` | Workspace consumer confirmed; external consumer unknown. | unknown/defer | Public by manifest; external use unknown. | High until deployment and rollback consumers are checked. |
| `renderer-routing` | CMS renderer-domain alias script and renderer routing. | retain public | Manifest-public; active workspace consumer. | High: tenant/domain routing. |
| `tld-capabilities` | CMS checkout/domain actions and contract tests. | retain public | Manifest-public; active domain capability contract. | High: provider and IDN behavior. |
| `domain-migration` | CMS checkout, collections, migration domain logic, and tests. | retain public | Manifest-public; active migration consumer. | High: provider, tenancy, commerce, rollback. |
| `fixtures/tenants` | CMS renderer-staging seed script and contract fixtures. | make workspace-internal | Public by manifest; no external consumer evidence. | High until published snapshot and support history are checked. |
| `site` | CMS site settings and published snapshot contracts. | retain public | Manifest-public; active workspace consumer. | High: persisted site contract. |

`fixtures/tenants` is not removable: the seed script is a non-test build/ops
consumer. Making it workspace-internal is a future compatibility decision that
requires changing the seed boundary and checking external fixture consumers.

## Legal content package

Package: `packages/legal-content/package.json`

| Export | Workspace consumer or evidence | Disposition | External/public status | Compatibility risk |
| --- | --- | --- | --- | --- |
| `.` | Legal content runtime, legal tests, and release integrity checks. | retain public | Manifest-public; governed legal source. | High: hashes, releases, consent, audiences. |
| `consent-approval` | Consent approval consumer and tests. | retain public | Manifest-public; legal consumer. | High: consent action semantics. |

No legal export is a cleanup candidate. Runtime/type parity and legal release
history take precedence over reducing package surface.

## Site renderer package

Package: `packages/site-renderer/package.json`

| Export | Workspace consumer or evidence | Disposition | External/public status | Compatibility risk |
| --- | --- | --- | --- | --- |
| `.` | Renderer runtime and renderer application. | retain public | Manifest-public; active runtime consumer. | High: published snapshots and deployment. |
| `seo` | Renderer SEO contract and consumers. | retain public | Manifest-public; active rendering surface. | Medium/high: published output. |
| `theme` | Renderer theme types and resolution. | retain public | Manifest-public; active rendering surface. | High: persisted theme contract. |
| `theme/resolve` | Theme resolver consumers and tests. | retain public | Manifest-public; active rendering surface. | High: preview/live parity. |
| `blocks/variants` | Current block variant catalog/runtime consumers. | retain public | Manifest-public; active catalog. | High: F17 planned replacement and snapshots. |
| `source-templates` | Source-template registry/build-time boundary. | unknown/defer | Manifest-public; external and generated use unknown. | High: generated inputs and compatibility. |
| `styles.css` | Static site and renderer style consumers. | retain public | Manifest-public; active asset. | High: deployment and visual parity. |

`source-templates` must not be removed based on the absence of an application
import. The registry is a build-time consumer, and external package users may
import the subpath directly. A future internalization PR must first inventory
generated inputs, published source snapshots, documentation, and supported
external consumers.

## UI package

Package: `packages/ui/package.json`

| Export family | Workspace consumer or evidence | Disposition | External/public status | Compatibility risk |
| --- | --- | --- | --- | --- |
| `.` | Shared UI package boundary. | retain public | Manifest-public; active CMS/renderer consumer. | High: React/component identity. |
| `components/*` | CMS imports many primitives through this family. | retain public | Manifest-public; active workspace consumer. | High: UI and singleton identity. |
| `composites/*` | Shared composite UI consumers. | retain public | Manifest-public; workspace consumer status varies by member. | Medium/high: component API. |
| `hooks/*` | Shared hook consumers. | retain public | Manifest-public; workspace consumer status varies by member. | High: runtime behavior and React identity. |
| `lib/csp-nonce` | CMS layouts and compatibility re-exports. | retain public | Security-relevant public subpath. | High: CSP behavior. |
| `lib/csp-style` | CMS style nonce/runtime consumers. | retain public | Security-relevant public subpath. | High: CSP behavior. |
| `lib/utils` | CMS and renderer source imports. | retain public | Manifest-public; active workspace consumer. | Medium/high: shared utility boundary. |
| `providers/shadcnui-blocks/radix-nova` | Renderer variants and upstream-adapted sources. | retain public | Manifest-public; active renderer consumer. | High: generated/authored variant bindings. |
| `providers/shadcnui-blocks/radix-nova/tailwind.css` | Provider styling/build inputs. | retain public | Manifest-public; build-time asset consumer. | High: visual parity and F17 replacement. |
| `styles/shadcn.css` | CMS compatibility import and shared styling. | retain public | Manifest-public; active compatibility consumer. | Medium/high: styling and build behavior. |

The wildcard families are intentionally treated as public sets. A member-level
removal needs the same consumer, generated-input, published-output, and public
support checks as a named subpath.

## Reachability classification rules

1. `retain public` means current evidence or governed compatibility requires the
   export to remain public.
2. `make workspace-internal` is a design candidate only; it is not implemented
   by this inventory.
3. `make test-only` is not appropriate for `fixtures/tenants` because the seed
   script is an operational/build consumer.
4. `unknown/defer` means proof is missing. It is not a deletion recommendation.
5. `deprecate with a window` requires an owner, release note, migration path,
   and explicit external support window; none is proposed here.
6. `remove` requires all seven removal-proof categories, including persisted
   data, snapshots, migrations, rollback, and public support history.

## Next proof actions

1. Resolve `deploy-targets`, `fixtures/tenants`, and `source-templates` owner
   and external-consumer questions.
2. Compare package exports with generated build inputs and published snapshot
   manifests.
3. Keep F17 deferred until the catalog and blocks are replaced; do not spend a
   cleanup PR on current variant internals.
4. If an export is later internalized, make that a focused package-boundary PR
   with a compatibility window and no dependency or schema upgrade mixed in.

## External reachability research collected on 2026-08-11

The public npm registry returned `E404 Not Found` for the four workspace package
names checked: `@siteinabox/contracts`, `@siteinabox/site-renderer`,
`@siteinabox/legal-content`, and `@siteinabox/ui`. The packages are therefore
not published through the public npm registry under these names.

Public GitHub code search for the three higher-risk subpaths found only current
workspace references:

- `@siteinabox/contracts/fixtures/tenants` is used by renderer smoke routing,
  CMS staging seed code, and CMS compatibility tests.
- `@siteinabox/contracts/deploy-targets` is used by the renderer snapshot
  loader.
- `@siteinabox/site-renderer/source-templates` is used by the CMS provider
  compatibility test and remains a build-time/generated boundary.

Commands used:

```text
gh search code '"@siteinabox/contracts/fixtures/tenants"' --limit 100 --json repository,path
gh search code '"@siteinabox/contracts/deploy-targets"' --limit 100 --json repository,path
gh search code '"@siteinabox/site-renderer/source-templates"' --limit 100 --json repository,path
npm view @siteinabox/contracts name version dist-tags.private --json
npm view @siteinabox/site-renderer name version dist-tags.private --json
npm view @siteinabox/legal-content name version dist-tags.private --json
npm view @siteinabox/ui name version dist-tags.private --json
```

This is stronger evidence for workspace-internal ownership, but it is not proof
that no consumer uses a git URL, private registry, vendored tarball, or a
published snapshot. No export is removal-ready. Keep the current public export
surface until a compatibility window and package-consumer inventory exist.
F17 catalog and block replacement remains a separate deferred change and does
not justify changing these exports now.
