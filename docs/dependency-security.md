# Dependency security review

The 2026-10-07 review starts from the committed dependency graph, not the
2026-08-12 clean-audit statement. The baseline full audit reported 6 critical,
27 high, 28 moderate and 6 low findings. The selected graph reports no critical
findings, 1 high and 1 moderate finding. Production audit reports 1 high and
no moderate findings; production audit includes framework peer/tooling paths
and is not itself proof that a vulnerable API executes in production.

## Selected graph and compatibility

Next is pinned to `16.3.6`, the security-fixed patch floor for all current
Next advisories within the existing `16.3` line. Astro is pinned to `7.2.8`
and its Node adapter to `11.1.3`. Sharp `0.35.5` repairs the libheif and
librsvg native image graph across supported platform packages. See the
[Next publisher advisories](https://github.com/vercel/next.js/security/advisories),
[Astro AVIF advisory](https://github.com/withastro/astro/security/advisories/GHSA-26w7-cxv4-gfx2),
[adapter advisory](https://github.com/withastro/astro/security/advisories/GHSA-qh8j-hqjv-7m4x)
and [Sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).

Payload and its complete installed family are aligned to `3.90.1`. This includes
the critical `3.90.0` fixes and the immediate relationship-filter follow-up.
Its owned Lexical graph requires exact `0.50.0`; direct Lexical dependencies
are aligned to that identity. Custom editor features must pass compilation and
copy/paste/browser checks before release. No schema migration or access-control
relaxation is included. Review the
[Payload release notes](https://github.com/payloadcms/payload/releases/tag/v3.90.0)
and [3.90.1 follow-up](https://github.com/payloadcms/payload/releases/tag/v3.90.1),
especially changed field restrictions, API-key visibility and polymorphic joins.

React and React DOM remain exact `19.2.8`; GraphQL remains `16.14.0`,
TypeScript remains `6.0.3`, and the existing Vite `8.2.1` resolution is retained.
Vitest and its owned family receive the `4.1.11` security patch. Nodemailer
receives exact `10.0.9`, the smallest current fix for all five mail advisories.
The actual graph has one direct CMS consumer and no installed email-adapter peer
constraint. The publisher supports the existing main and `lib/mailer` imports;
its own types replace `@types/nodemailer`. The Payload adapter flattens nested
recipient lists and rejects missing addresses before transport to accommodate
the new address types. SMTP options and the REST provider boundary are unchanged.
Focused regression tests, existing mail tests and the CMS typecheck verify this
security-driven major update. Node stays on the selected Node 26 toolchain.
The 1,440-minute release-age policy and native build allowlist remain separate
controls; no release-age exclusions are introduced.

## Required Payload compatibility migration

Payload 3.90 adds a hidden `resetPasswordRequestedAt` date for its default
15-second reset-email cooldown. The security-safe family requires the generated
nullable `users.reset_password_requested_at` column before runtime queries can
work against the committed SQL schema. Preserve that upstream guard; setting
its interval to zero removes the security behavior. The
[publisher's migration instructions](https://github.com/payloadcms/payload/releases/tag/v3.90.0)
and [introducing change](https://github.com/payloadcms/payload/commit/1c46204a73a0a9f988a80c52690eee5a4ada3cf1)
explain the dependency-owned schema addition.

`20261007_160729_payload_security_password_reset_cooldown` adds only that nullable
timestamp, without changing existing rows, defaults, indexes, collection policy
or customer authentication flows. Payload/Drizzle generated the one-column DDL;
the Payload generator rebuilt the static index from dated migration modules.
The older snapshots predate later committed migrations, so this predefined
migration excludes unrelated snapshot drift and non-migration helper modules.
Rehearse both the full empty-database chain and the prior-schema upgrade with
synthetic preserved user data. No production database write is authorized by
these checks.

## Current findings and release gates

[The checked inventory](dependency-security.json) contains every current
advisory ID, package, resolved version and exact audit path, with source links,
reachability, disposition and fix/review triggers. There is no advisory ignore
list. Inventory changes at any severity require review, including advisories
introduced by a patch. The review expires on 2026-10-14 and must also be renewed
when source usage, platform, transport or build-input boundaries change.

| Package | Current disposition | Release consequence |
| --- | --- | --- |
| Nodemailer `10.0.9` | All five findings from the intermediate 9.1.1 graph are fixed, including the newly surfaced quoted-local-part and quadratic comment-joined address advisories. The SMTP fallback remains a shipped runtime consumer. | No current Nodemailer advisory remains. Its exact major compatibility change must retain mail tests and the framework typecheck. |
| Braces `3.0.3` | Sass `1.77.4` → Chokidar `3.6.0` → Braces expands repository watch patterns during compilation. No request-controlled watch patterns or runtime Sass compilation are used. Artifact absence is not claimed. The reported `3.0.4` floor is unpublished; the reviewed advisory identifies no fixed version. | Build-only triage is retained while inputs are reviewed repository content. A dynamic build/compiler path or published fix requires renewed review. |
| PostCSS selector parser `6.0.10` | The landing Tailwind typography plugin parses repository selectors at build time. The `7.1.6` fix crosses the current `6.x` consumer contract. | Defer that contract migration; untrusted stylesheet builds require renewed review. |

These are exposure assessments, not claims that an exploit occurred. The
[Nodemailer publisher advisories](https://github.com/nodemailer/nodemailer/security/advisories)
describe the API-specific triggers. The
[Braces source issue](https://github.com/micromatch/braces/issues/70) and
[selector-parser advisory](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf)
explain the retained tooling findings.

The baseline audit contains incorrect unpublished fix floors for
`http-cache-semantics` (`4.2.1`) and `smol-toml` (`1.8.1`). Registry and publisher
evidence select the compatible published `4.3.0` and `1.9.0` respectively.
The adapter publisher classifies malformed Host ports as low and distinguishes
standalone HTTP 500 from opt-in `staticHeaders` process termination; the audit
reports high. The patch is applied regardless. These corrections are recorded
in the checked inventory, rather than suppressing audit output.

## Executable checks

```bash
node --test scripts/check-dependency-security.test.mjs
node scripts/check-dependency-security.mjs
node scripts/check-dependency-security.mjs --release
pnpm audit --json
pnpm audit --prod --json
pnpm why --recursive PACKAGE
pnpm install --frozen-lockfile
```

The default inventory check runs a fresh full audit, rejects unavailable or
malformed output, expired review, changed severity/version/path, new findings,
untriaged rows and stale dispositions. The release check additionally rejects
every runtime or unknown high/critical finding, even if its row's release flag
is cleared. The selected graph has no unresolved runtime high/critical finding; both
inventory and dependency release checks pass with the two reviewed build
findings. A passing dependency gate is not deployment authorization.

Retain full baseline/final audits, publisher and registry snapshots, `pnpm why`
and install logs with the review evidence. The complete historical-to-current
disposition records all 69 baseline/current entries and their resolved paths.
Do not put local evidence paths, raw transcripts or credentials into the repo.
Rolling back to a known vulnerable graph does not satisfy the release gate.
