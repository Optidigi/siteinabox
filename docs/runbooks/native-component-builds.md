# Native component security builds

The CMS and renderer retain the exact esbuild 0.25.12 and 0.28.2 CLI/JavaScript
APIs. Their runtime binaries are first-party security build variants, not the
unchanged binaries authenticated by npm's upstream package integrity.

`ops/native-components/build.sh` fetches the closed set of upstream tags and
requires the reviewed commit. Application `.go` source stays pristine. Reviewed
external module/sum files select x/sys 0.44.0 and Go 1.27 language/toolchain
defaults; builds require Go 1.27.3, CGO disabled and Linux/amd64. Symbols and Go
build/VCS metadata remain available for independent binary and advisory analysis.
Upstream compatibility with Go 1.13 is deliberately not preserved by this owned
build variant. Version-specific upstream Go tests and JavaScript transform,
plugin/service and context/rebuild tests must pass.

Replacement happens in the build output before copying it into runtime layers.
The expected existing compiler must be present and retain its exact CLI version.
Runtime images include upstream, Go and dependency notices, the derived module
files, source commit, build info and replacement-binary SHA256. Builder package
integrity and first-party replacement provenance remain distinct.

The recipe also prepares gosu 1.20 using its exact upstream source and the same
reviewed toolchain. The owned PostgreSQL verifier requires an image that preserves entrypoint privilege dropping, UID/GID, data directories,
volumes, populated upgrade and recovery behavior. No vendor identity may be used
for an image with replaced bytes.

These builds add owned supply-chain maintenance. New source/dependency/compiler
versions require fresh publisher review, functional compatibility and complete
native scans. They do not waive findings, missing analyzer coverage, support
constraints, age floors or release expiry. Current worker and cloudflared release
blockers remain separate.

## Candidate PostgreSQL packaging

`ops/postgres/Dockerfile` derives an explicitly owned candidate from the pinned
PostgreSQL 18.6 image, updates the two affected Alpine libraries and replaces
gosu with the reviewed rebuild. It inherits the vendor entrypoint, command,
PGDATA, user identities and volume declaration. The canonical CMS verifier builds and consumes it, retaining a separate
trusted-main PostgreSQL archive for controlled publication. Source production
Compose requires its approved registry digest through `SIAB_POSTGRES_IMAGE_DIGEST`;
no unqualified digest or default vendor substitution is supplied.

`Test-PostgresImage.sh OWNED_CANDIDATE REVIEWED_BASELINE` creates only labelled,
uniquely named disposable containers and a data volume. It checks root privilege
drop, populated-volume replacement, UID/GID preservation, nonroot restart and
graceful stop. Current probes pass; production database volumes are never used.
The [October 28 candidate rehearsal](../research/postgres-owned-image-qualification.md)
also passes actual main-CMS migrations and restored-schema startup. The canonical consuming-image path now includes migration/restart and logical
restore checks. Repeat it at the final source before adoption. Scan counts and upstream metadata are not
a deployment authorization.
