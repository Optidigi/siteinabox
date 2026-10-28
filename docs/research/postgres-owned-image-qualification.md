# Owned PostgreSQL candidate qualification

Tracking: [PostgreSQL ticket #134](https://github.com/Optidigi/siteinabox/issues/134)
under [release spec #132](https://github.com/Optidigi/siteinabox/issues/132).
This is isolated candidate evidence, not admission, publication or deployment.

## Candidate

Source `202bae81f50258dd6f370651b99f3e88c83be4e9` builds an explicitly owned
PostgreSQL 18.6 variant from the reviewed official base. Its recipe patches
brotli/libcurl and rebuilds gosu from the reviewed source with Go 1.27.3,
x/sys 0.44.0 and moby/sys/user 0.4.1. The actual binary's Go build information
confirms those versions; upstream application source remains unchanged.

The exact archive diagnostic scan reports zero enumerated findings for Alpine
3.24.3 and gosu. Independent flattened-rootfs inspection finds 260 native files
and one Go target, `usr/local/bin/gosu`; the scanner has a populated Go package
result at that exact path. This is reported-target reconciliation, not complete
security clearance for all native code or an expiry extension.

## Behavior proved on disposable resources

The owning lifecycle script passes:

- Vendor baseline to owned image on the same populated volume.
- PID 1 running as UID 70, with persisted UID/GID preserved.
- Nonroot restart and graceful database shutdown.
- Public pg_dump/pg_restore into a fresh database with fixture preservation.
- Same-major rollback to the vendor baseline with preserved fixture data.

The trusted main CMS archive was independently hash-checked against its receipt
at source `0a5f590b28708a8db605671cee33d9003c779cf8`, run 40555910639. A bounded
rehearsal using the canonical CMS schema/migration snapshot proves actual committed
migrations, populated tenant/schema/migration-history preservation after database
replacement, and logical restored-schema startup with healthy CMS and no pending
migrations. It uses synthetic data, disabled jobs, mock generation and a private
internal network. No host ports or provider credentials are used.

These checks establish compatibility with that exact CMS archive, not an
unbuilt future candidate. The scratch rehearsal must be integrated into the
canonical consuming-image path before adoption, rather than maintained as a
second migration harness. Final-source qualification remains necessary.

## Receipts and remaining work

Retained ignored evidence is under `artifacts/postgres-candidate-202bae81/`:

- Candidate archive SHA256: `4aa79bf8145b3555e54de2847376a4488cf002489a4c6b1d484d968553bb53df`.
- Flattened rootfs SHA256: `8ccaf2e213762fcf1a4377a8524be14e460f5a16a32c4b4bf0cbc6b0b6a47a79`.
- Native inventory SHA256: `c8bb0cc0bbaefd1e697f8af55378d5d1c14d0cd070f4a48f1a2305504c2989d4`.
- Scanner report SHA256: `9e98651280a014515fccdba86c853da4e09ddeab9c57e4f4706f8bf3caefeebe`.

The same existing publisher-verified Trivy 0.76.0 preparation and database within
24 hours were used for this diagnostic. Raw scanner logs and lifecycle/CMS
rehearsal receipts are retained. Disposable containers, volumes, network and
builder were removed; live database volumes were never used.

Owned-image catalog/registry identity, canonical build/promotion wiring,
complete native qualification and final-source release evidence remain open.
Production Compose still references its existing image. No vendor identity is
assigned to these replaced bytes. The global security review remains expired.
