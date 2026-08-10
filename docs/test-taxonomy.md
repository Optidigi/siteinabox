# Test taxonomy

This taxonomy classifies tests by the invariant they protect and the boundary
they exercise. A filename, audit ticket, tenant name, or historical incident is
not evidence that a test is dead. Classification comes before a test is moved,
renamed, replaced, or deleted.

## Categories

| Category | Enduring invariant | Typical boundary | Required evidence |
| --- | --- | --- | --- |
| Unit | A pure calculation, parser, reducer, hook, or isolated component behaves correctly. | No external database, provider, browser, or network. | Focused inputs, outputs, and failure cases. |
| Contract | A schema, export, hash, renderer route, provider capability, or generated shape remains compatible. | Package/API, catalog, snapshot, or generator boundary. | Stable fixtures or semantic snapshots; published compatibility where applicable. |
| Integration | Application services and persistence edges compose correctly. | Payload, PostgreSQL, provider adapter, filesystem, or mail boundary. | Disposable services or deterministic fakes; transaction and failure assertions. |
| Browser | A user-visible journey, routing rule, keyboard/focus behavior, auth flow, checkout, or intake flow works. | Built application in a real browser. | User-observable assertions, diagnostics, and cleanup. |
| Visual | Rendered pixels or approved image semantics stay within an explicit threshold. | Browser screenshot or image artifact. | Artifact comparison, threshold, viewport, font, and baseline provenance. |
| Security/access | Authentication, authorization, tenancy, CSRF, rate limits, secrets, and isolation remain enforced. | Request boundary, session, role, tenant, or untrusted input. | Adversarial input and explicit allow/deny assertions. |
| Migration | Forward, rollback, recovery, historical data shape, and compatibility guarantees hold. | Disposable PostgreSQL and migration history. | Rehearsed data fixtures, old/new application compatibility, and rollback evidence. |
| Production smoke | A deployed image is reachable and its critical health, host routing, consent, and canary behavior work. | Deployed image against approved local or production smoke target. | Exact image digest, safe target, redacted diagnostics, and operator approval for production. |

## Placement

The target layout for new tests is:

```text
apps/<app>/tests/unit/
apps/<app>/tests/contract/
apps/<app>/tests/integration/
apps/<app>/tests/browser/
apps/<app>/tests/visual/
apps/<app>/tests/security/
apps/<app>/tests/migration/
apps/<app>/tests/smoke/
```

Existing tests do not move solely to make directories look uniform. A focused
follow-up may reclassify a test when its invariant and required boundary are
recorded. Package tests use the same categories under their package-owned test
directories.

## Source-text assertions

Reading implementation source or checking exact strings is not automatically a
defect. Retain source-level checks when the invariant is structural and cannot
be proved more safely at runtime, including:

- forbidden constructs and security boundaries;
- generated-artifact ownership and generator inputs;
- migration shape and rollback guards;
- legal hashes, release data, or other governed integrity records; and
- explicit source/API boundary contracts.

Replace ordinary source assertions only when an equivalent behavior, contract,
integration, browser, or security test exists. Keep the old assertion until the
replacement passes the relevant compatibility window; do not use a refactor as
the reason to remove migration, legal, tenancy, commerce, provider, or rollback
coverage.

## Visual claims

The name `visual regression` does not prove pixel comparison. A test belongs in
the visual category only when it captures or compares a pixel/image artifact
with declared viewport, browser/font inputs, baseline provenance, and threshold
rules. A DOM or semantic UI test belongs in browser or unit/contract instead.
The current checkout has browser checkout screenshots in
`apps/cms/tests/browser/checkout-browser.mjs`; similarly named unit tests need
individual invariant mapping before any rename or deletion.

## Protected test groups

These groups are retained by default:

- authentication, authorization, tenancy, CSRF, rate-limit, and secret tests;
- legal release, consent, hash, audience, and acceptance tests;
- commerce, payment, quote, domain, provider, and email-boundary tests;
- renderer variant, host-routing, deployment-contract, and snapshot tests;
- migration, historical tenant, rollback, and recovery tests; and
- production smoke tests that identify an exact deployed image.

Historical names such as audit IDs, incident IDs, tenant names, and migration
phases are useful traceability. Rename them only when a related contract change
preserves the identifier in the test description or documentation.

## Review worksheet

Before changing a test, record one row with:

| Field | Required value |
| --- | --- |
| Path and current name | Exact tracked path. |
| Primary category | One category above; add secondary boundary only when necessary. |
| Enduring invariant | Observable behavior or protected structure, not implementation prose. |
| External state | None, disposable database, provider fake, browser, fixture, or deployed image. |
| Current consumers | CI job, deployment gate, migration window, legal record, or owner. |
| Replacement evidence | Exact tests, fixtures, artifacts, and manual checks required first. |
| Retention window | Compatibility, rollback, legal, or production evidence window. |

No deletion is removal-ready while a worksheet field is unknown for security,
legal, commerce, tenancy, renderer, migration, rollback, or external API
behavior.

## Change sequence

1. Classify and document the existing test without changing behavior.
2. Add behavior or contract coverage for the enduring invariant where missing.
3. Compare old and new diagnostics, artifacts, and relevant coverage.
4. Remove or rename only ordinary redundant assertions after owner review.
5. Keep security, legal, migration, rollback, and production evidence in their
   own PR boundaries.

The taxonomy is documentation-only. It does not move tests, weaken assertions,
change migration history, or claim that every existing test has already been
classified.
