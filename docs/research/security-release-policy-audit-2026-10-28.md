# Security release policy audit — 2026-10-28

## Scope and conclusion

Research baseline: `codex/dependency-modernization`, HEAD `a1e7c33ee9e7bd8619062efe046005b69274aede`; initially clean. Read root AGENTS, engineering, dependency policy, publication runbook, executable gates/tests and retained receipts. No implementation or release authorization is implied.

**Observed:** failure is largely intentional policy enforcement, not a malfunctioning scanner. Inventory qualification accepts reviewed blockers; release requires zero findings, zero blocking deferrals and qualified native assessments. **Recommendation:** retain artifact integrity and security verification, but consolidate decisions and replace indefinite qualification prose with finite evidence requirements. Whether to permit any remaining risk is an owner decision.

## What actually blocks

Evidence: [source policy](../../scripts/dependency-security-policy.mjs), [image review](../../scripts/dependency-image-review.mjs), [publication preflight](../../scripts/check-publication.mjs), [review record](../dependency-security.json).

- `reviewedBlockers` requires every advisory disposition to have `releaseBlocked: true`; `validateDependencyReview` and `validateImageReview` reject release when inventory length is nonzero. Severity, fix availability and demonstrated platform applicability do not change that result. There is no supported `not_affected` release disposition. Publication independently rejects nonempty advisory arrays, even with false flags; its test explicitly requires that behavior. This is a zero-enumeration policy, stricter than evidence-based exploitability triage.
- Retained `artifacts/delivery-fc398/flat-images/image-*.dependencies.json` records CMS, renderer, site and owned PostgreSQL with zero findings, zero unversioned packages and null scanner analysis gaps. Cloudflared has 29 findings; worker has 34, plus its separately synthesized mapping-gap row: 64 image review rows total. All six native assessments remain blocked. The four clean images' generic qualification/final-hosted-evidence reasons are separate from scanner results; zero findings do not establish complete native safety. These are historical manual receipts for `fc398e37`, not final-source CI for this branch.
- Seven `unresolved_blocker` deferrals cover Better Auth, Go, Node, scanner, musl, BIND and Brotli; Vitest is separately `supported_release`. Several reasons acknowledge patched versions/startup evidence yet retain broad incomplete-qualification language. This creates overlapping obligations, not seven independently demonstrated vulnerabilities. Authentication and native coverage still require their actual owning evidence.
- `imageReviewFindings` includes references and modification timestamps in `factsHash`. `assertReviewedFindings` rejects any mismatch. Thus reference-only changes deterministically require re-review. Historical reconciliation sections in [dependency evidence](../dependency-security.md) repeatedly describe reference/feed changes; the current section records eight reference-only identities. This audit did not replay every historical scan. Whole publisher-fact hashes also invalidate reviews on changed fetched content. Preserving raw hashes is useful; treating every content change as a new security decision is brittle.
- Source validation, image validation, native status, publication preflight and emitted readiness booleans independently express blocking decisions. Early source exceptions also prevent later checks from reporting all image reasons. Multiple enforcement boundaries are valuable; multiple interpretations of risk are not.

## Applicability and real risk

[Trivy's vendor guidance](https://www.trivy.dev/docs/dev/guide/scanner/vulnerability/) explains vendor severity selection and backported fixes. An upstream version comparison alone can misclassify distro packages. Preserve package origin, selected severity/source, vendor ratings, status and fixed version; neither a lower vendor score nor absence of a fix proves safety. [Trivy VEX](https://trivy.dev/docs/latest/supply-chain/vex/) supports applicability information; it does not authorize trusting arbitrary waivers.

Microsoft's [CVE-2026-70162 advisory](https://github.com/dotnet/runtime/security/advisories/GHSA-2fmv-rv2c-59x7) explicitly limits affected platforms to Windows. Its Linux worker row is not a confirmed Linux vulnerability; the record itself says so, but still blocks it. Conversely [CVE-2026-84008](https://github.com/dotnet/runtime/security/advisories/GHSA-846f-f764-76mx) covers Linux and affects Pkcs 10.0.0 through 10.0.12. EXO's retained 10.0.0 copy is not repaired by PowerShell's separate 10.0.14. Loading/reachability and supported remediation remain unqualified. Fourteen worker mapping-gap paths remain genuine unknown coverage, not false positives.

[Go's govulncheck documentation](https://go.googlesource.com/vuln.git/+/0be6bb82540eb545755654e341bb22c18729e5ef/cmd/govulncheck/doc.go) distinguishes source call analysis from binary symbol analysis. Binary presence can overreport unreachable code; unavailable symbols can reduce analysis to modules. Source analysis must match build configuration and has reflection/unsafe limitations. Package or module presence does not prove reachable exploitation; an unreported target does not prove absence. Cloudflared's retained OpenPGP, x/net and go-jose findings need applicability/remediation evidence; upgrading Go alone does not patch its modules.

## One canonical decision model (proposal)

Use one pure evaluator over validated evidence and reviewed dispositions; collection/admission remain separate. Return `blocked | ready`, structured reasons and evidence identities. Every consumer, including preflight and readiness output, uses that evaluator. A partial preflight may reject early, but cannot grant clearance.

Inputs bind source/graph/configuration, archive digest, platform, component/version/path or binary hash, scan/database provenance and coverage, plus required functional-test receipts. Findings use `affected`, `not_affected`, `fixed`, or `under_investigation`; missing coverage stays an explicit unresolved requirement. [OpenVEX](https://github.com/openvex/spec/blob/main/OPENVEX-SPEC.md) requires justification or impact evidence for `not_affected`; that status is distinct from accepting an affected risk.

Keep exact archive/report hashes. Separate a normalized security-decision fingerprint (affected range, platform, fix, severity/provenance, component identity) from raw reference metadata. Reordering/adding informational links should produce an auditable delta, not invalidate unchanged applicability. Changed security semantics or bytes invalidate the affected disposition.

**Owner decisions required:** adopting nonaffected dispositions; severity/exposure thresholds; whether any no-fix or lower-severity affected risk can receive an exception; review lifetimes; and whether independent image promotion can exclude unrelated images. Current all-image requirements remain binding until approved changes.

Bound each proposed exception to advisory, component/path/hash, image/platform, evidence, accountable owner, approval, expiry and recheck trigger. No wildcard suppression, automatic renewal or blanket platform waiver. Expiry, changed bytes/platform/range, missing evidence or revoked approval blocks again. Unknown coverage must be resolved or explicitly treated as an owner-approved risk, never relabeled nonaffected.

## Keep, consolidate, and verify

Keep exact-byte/source binding, trusted builder/run provenance, authentication/tenant/session tests, critical applicable-risk remediation, target coverage, and owner-controlled promotion. [SLSA verification guidance](https://github.com/slsa-framework/slsa/blob/main/spec/verifying-artifacts.md) supports checking artifacts against trusted provenance and expected source/build parameters; it does not make provenance proof of vulnerability absence.

Consolidation candidates: repeated array-length/boolean rules; manually maintained duplicate status summaries; native blanket reasons duplicating hosted admission; seven legacy deferrals where their named tests, component dispositions or coverage requirements can own closure. Retire an entry only after its explicit acceptance evidence exists. Do not delete duplicate/alternate-platform runtime files without supported loading/consumer evidence. Avoid custom dependency rebuilds when a supported vendor upgrade resolves the same issue; preserve provenance for necessary rebuilds.

Future tests should cover decision parity across consumers; wrong source/archive/platform; stale/expired exceptions; Windows-only versus Linux-relevant Pkcs; missing targets; changed affected ranges versus reference-only drift; vendor backports; and genuine clean readiness. Keep authentication/tenancy regressions and publication approval tests at their owning boundaries. No full application build is needed for this report.

Validation performed: `node --test scripts/check-dependency-security.test.mjs scripts/dependency-image-review.test.mjs scripts/dependency-publication.test.mjs` — 18 passed. This confirms current policy behavior, not candidate release readiness. No Docker, production/provider operations or CI polling performed.

## Concrete owner decision proposed for Siteinabox

Adopt one risk-based release rule:

1. Block applicable production **high/critical** vulnerabilities and known-exploited findings at any severity. High/critical findings under investigation also block until applicability is resolved; absence of demonstrated exploitation is not evidence of non-applicability. No-fix high/critical issues remain blocked unless a separately recorded, narrowly scoped owner decision explicitly accepts them.
2. Permit `not_affected` only with reviewed vendor/platform or exact-binary evidence. Bind it to component/path, image/platform and artifact hash; changed affected ranges, bytes or scope invalidate it. Missing required coverage, unverifiable provenance and failed auth/tenant/runtime tests still block.
3. Keep lower-severity affected findings visible with an accountable owner, linked remediation issue and deadline. Default review deadlines: 30 days for moderate and 90 days for low; a deadline is not a declaration that the component is safe.
4. Compute readiness once from validated evidence and these dispositions. Reuse that decision in publication and reports. Retain raw reports and reference changes for audit; informational URL changes alone do not reopen unchanged applicability decisions. Replace generic manual native blockers with finite coverage/support/test requirements that can actually complete.

The owner explicitly approved this proposal on 2026-10-28. Implementation and qualification are in progress; no high-risk exception or production deployment is authorized by that approval. Upgrading versions and preserving all verification controls does not depend on accepting this proposal.
