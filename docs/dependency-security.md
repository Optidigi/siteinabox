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
