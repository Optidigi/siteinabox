# Dependency security review

The 2026-10-07 review starts from the committed dependency graph, not the
2026-08-12 clean-audit statement. The baseline full audit reported 6 critical,
27 high, 28 moderate and 6 low findings. The selected graph reports no critical
findings, 1 high and 1 moderate finding. Production audit reports 1 high and
no moderate findings; production audit includes framework peer/tooling paths
and is not itself proof that a vulnerable API executes in production.

## Selected graph and compatibility

Next is pinned to `16.3.8`, the September 30 publisher security patch floor within the existing `16.3`
line. The earlier September 22 patch does not cover that later release. Astro is pinned to `7.2.8`
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
copy/paste/browser checks before release. The security upgrade requires the
upstream cooldown schema addition described below. The separate provider-boundary
change adds durable write uncertainty as described in
[the provider runbook](runbooks/provider-boundaries.md); access-control rules are preserved.
Review the
[Payload release notes](https://github.com/payloadcms/payload/releases/tag/v3.90.0)
and [3.90.1 follow-up](https://github.com/payloadcms/payload/releases/tag/v3.90.1),
especially changed field restrictions, API-key visibility and polymorphic joins.

The fresh October 7 publisher review includes the October 6 High notices for
[Jobs access control](https://github.com/payloadcms/payload/security/advisories/GHSA-2qw6-cm49-277x),
[MCP hidden fields](https://github.com/payloadcms/payload/security/advisories/GHSA-jjm7-864w-gg8q)
and [MCP recovery takeover](https://github.com/payloadcms/payload/security/advisories/GHSA-h5rh-4jwf-738p).
Their respective fixed floors are `3.89.0`, `3.88.0` and `3.90.0`; the selected
family `3.90.1` covers them. The newer `3.90.2` release does not identify another
security floor, and Next's newer `16.4` minor is outside this patch scope.

React and React DOM remain exact `19.2.8`; GraphQL remains `16.14.0`,
TypeScript remains `6.0.3`, and the existing Vite `8.2.1` resolution is retained.
Vitest and its owned family receive the `4.1.11` security patch. Nodemailer
receives exact `10.0.16`, retaining the reviewed advisory fixes and the newer
address-parser hardening in patches 10.0.14–10.0.16,
including four September 30 notices omitted by the current audit database.
The actual graph has one direct CMS consumer and no installed email-adapter peer
constraint. The publisher supports the existing main and `lib/mailer` imports;
its own types replace `@types/nodemailer`. The Payload adapter flattens nested
recipient lists and rejects missing addresses before transport to accommodate
the new address types. The provider boundary separately validates receipts and bounds SMTP/REST delivery
time, cancellation and response sizes.
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
| Nodemailer `10.0.16` | The five intermediate-audit findings and four later publisher notices are fixed; the latter cover DKIM unfolding, SMTP reply/EHLO parsing and angle-address comments. The SMTP fallback remains a shipped runtime consumer. | All reviewed current publisher Nodemailer advisories are fixed. Its exact major compatibility change must retain mail tests and the framework typecheck. |
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

The default inventory check binds publisher-reviewed Next/mail versions and
patch floors to their owning manifests and every locked identity. Publisher
notices can precede the audit database: a green audit is not upstream review.
Renew the cited publisher records with the weekly inventory; a changed version,
missing record or unmet publisher floor fails closed. The check also runs a
fresh full audit, rejects unavailable or
malformed output, expired review, changed severity/version/path, new findings,
untriaged rows and stale dispositions. The release check additionally rejects
every runtime or unknown high/critical finding, even if its row's release flag
is cleared. The selected graph has no unresolved runtime high/critical finding; both
inventory and dependency release checks pass with the two reviewed build
findings. A passing dependency gate is not deployment authorization.

Retain full baseline/final audits, publisher and registry snapshots, `pnpm why`
and install logs with the review evidence. The operational historical-to-current disposition preserves the 69 audit
entries and the additional publisher-only notices with resolved paths.
Do not put local evidence paths, raw transcripts or credentials into the repo.
Rolling back to a known vulnerable graph does not satisfy the release gate.

## Node publication boundary

Node 26.11.0 is the current official non-security release on October 7. Its
exact official Alpine image was unavailable in the reviewed registry probe,
while 26.10.0 was available. Keep the fully published 26.10.0 toolchain coherent
across repository, CI and image stages until the official 26.11.0 image exists;
then synchronize all exact pins and re-run canonical app/image checks before
acceptance of that update. This is an explicit publication constraint, not a
claim that 26.10.0 is the newest Node release. Review the [official distribution
index](https://nodejs.org/dist/index.json). No npm release-age exception or
unofficial Node image is introduced.

The exact `nodemailer@10.0.16` resolution has a narrowly scoped release-age
exception because the shipped code directly consumes its hardened address parser.
The general 24-hour age floor remains in place. Review the
[publisher hardening notes](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.14)
and [current parser correction](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.16)
when changing that exception. No additional major-version migration is involved.
