# Dependency and release security

The owner approved `production-risk-v1` on 2026-10-28. The implementation and
qualification are in progress on the modernization branch. The historical
zero-enumeration policy is retained in [historical receipts](dependency-security-history.md).

## One decision

`scripts/release-risk.mjs` owns the risk decision. Source and image validators
check evidence and bind findings to accountable dispositions, then invoke it.
Publication performs complete validation before registry login; it does not
maintain a second array-length or manual-status interpretation.

- Applicable or unresolved high/critical findings block, with or without a fix.
- Known-exploited findings at any severity block unless current scoped evidence
  proves this exact product is not affected.
- Unknown severity, missing required analysis/version coverage, unsupported OS,
  failed required tests and invalid provenance block.
- Moderate/low risks remain visible with an owner, linked issue and review
  deadline bounded to 30/90 days. An overdue record blocks again.
- `not_affected` or `fixed` needs justification, enrolled primary evidence and
  exact scope/platform/component/advisory bindings. Changed bytes or affected
  ranges invalidate it. There is no wildcard suppression or automatic exception.

No high/critical risk exception has been granted. Such exceptions require a
separate explicit owner decision; the evaluator does not manufacture one.

## Evidence and scope

Full and production audits remain complete. All six owned images retain
exact source/run/attempt, archive/config/manifest/rootfs,
scanner/database and native/managed inventory evidence. Required Go targets
must have populated scanner coverage. Worker duplicate and alternate-platform
files remain visible; missing mapping is not presumed harmless.

Native readiness uses finite validated coverage/support and functional receipts,
not a permanent generic `blocked` marker. Actual startup/migration/restore,
authentication, tenancy, privacy, browser and publication approval checks remain
at their owning interfaces. Their absence cannot be overridden by a disposition.

CISA's authoritative known-exploited catalog is read on each source collection.
Missing or malformed catalog data fails verification. Component/advisory aliases
are matched against it, rather than trusting a reviewer-supplied exploitation flag.

Raw reports and their hashes remain intact. Security fingerprints bind component,
version, path/platform, affected/fixed range, severity and source provenance.
Informational reference links and metadata dates remain auditable without
reopening unchanged applicability decisions. New finding identities or changed
security semantics require triage.

## Workflow

Use the canonical commands and prerequisites in
[the verification matrix](verification-matrix.json),
[local development](runbooks/local-development.md) and
[protected delivery](runbooks/protected-delivery.md).

```bash
pnpm dependency:policy:test
pnpm dependency:inventory
pnpm dependency:check
pnpm dependency:release --images artifacts/candidate-images --archive-dir artifacts/candidate-images
```

Inventory qualification and release readiness are separate outputs. Release
requires fresh collection and complete exact-source image evidence; cached
supplied audits cannot grant clearance. Promotion still requires successful
trusted-main CI and configured owner approval for the selected immutable bytes.
See [image publication](runbooks/image-publication.md).

## GraphQL scalar advisory range correction (2026-10-30)

The publisher corrected GHSA-x8rm-f576-gq67's machine-readable affected range
from `<= 2.0.0` to `>= 1.24.1, <= 2.0.0`. This now agrees with the advisory's
existing description of the vulnerable PhoneNumber regular expression. The
installed `graphql-scalars` 1.22.2 is outside that range, and fresh full and
production audits no longer enumerate it. The two source `not_affected`
dispositions are therefore stale and removed; the enrolled primary advisory
fingerprint records the corrected range. Severity remains high for affected
versions and the patched version remains 2.0.1. No risk threshold, remaining
finding, deadline or publication control changes. Exact-source image rescanning
and the normal release decision are still required before publication.

Primary source: [GHSA-x8rm-f576-gq67](https://github.com/advisories/GHSA-x8rm-f576-gq67).

## Publisher readback on 2026-11-04

Fresh primary advisories changed security fingerprints: GO-2026-5932 now names
the separate OpenPGP module and a fixed x/crypto pseudo-version; the affected
package family remains OpenPGP. GHSA-gcqx-w48m-w2h4 now supplies CVE-2026-93753;
its low severity and deepmerge affected range remain unchanged. Publisher facts
are reconciled to those exact responses. The existing scoped dispositions,
issues, deadlines and image-evidence bindings are retained; this metadata update
does not refresh or waive a failed image finding. Fresh exact-source scans must
still satisfy every binding before release.

## Exact-image refresh on 2026-11-04

Canonical run 41868794418 rebuilt every owned image and passed runtime tests.
Its security gate correctly stopped on changed cloudflared/Exchange metadata
and newly reported landing libexpat findings. The landing recipe now requests
[Alpine's fixed libexpat 2.10.0-r0](https://pkgs.alpinelinux.org/package/v3.24/main/x86_64/libexpat); new image verification must prove the old
2.9.0-r0 findings disappear. No high/unknown finding is waived.

Fresh govulncheck 1.9.0 analysis of the exact cloudflared executable retained
GO-2026-5932 only at module level; its 34,611 extracted symbols contain no OpenPGP.
The native fingerprint and existing deadline are unchanged. Fresh Exchange runtime
proof again resolves the private old Pkcs request only to host 10.0.14 in Default,
above [Microsoft's 10.0.13 fix](https://github.com/dotnet/runtime/security/advisories/GHSA-846f-f764-76mx); that exact assessment has a new seven-day review.
The libc-bin/libc6 moderate findings remain under investigation with their
existing deadline. Raw reports and executable/runtime identities remain retained.

Eleven obsolete Exchange dispositions (seven older PCRE findings, three older
BIND findings and one gnutls finding) are absent from the fresh complete report
and are removed from the current verdict. Prior raw reports remain historical
evidence; absence from the new scanner inventory is not a blanket suppression.
The Windows-only Pkcs assessment is also re-bound to the reviewed Linux image;
its existing deadline is unchanged.

The mail implementation's protocol2 worker has its own exact native fingerprint.
Canonical run 41868904486 passed its actual image/HTTP/runtime verifier; managed
files and assembly-resolution evidence match the protocol1 proof, while the
reviewed entrypoint hash differs. Both Pkcs dispositions are bound to that
protocol2 image without extending their review deadlines.

## APT package refresh review on 2026-11-04

The complete `875cf9b0` image inventory updates apt/libapt-pkg from 2.8.3 to
2.8.4ubuntu0.1. All managed files, worker entrypoint and assembly-resolution
readbacks match the prior qualified runtime. The two scoped Pkcs assessments
are re-bound to the exact new native/OS inventory; findings, justifications and
existing deadlines remain applicable. No high-severity waiver or policy rule
change is introduced. Inventory CI success and release-risk readiness are
separate checks; publication remains blocked until the current assessment is
on main and fresh admission validates the selected archive.
