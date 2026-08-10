# Image workflow path matrix

`docs/workflow-path-matrix.json` records the minimum source paths that must
trigger each deployable image workflow. `pnpm workflow:check` compares the
matrix with the tracked workflow YAML and fails when a required trigger is
removed or a new `build-*-image.yml` workflow is not recorded.

| Image workflow | Application | Shared paths covered |
| --- | --- | --- |
| `build-cms-image.yml` | CMS | contracts, legal content, site renderer, UI, root install inputs |
| `build-intake-image.yml` | Intake | contracts and root install inputs |
| `build-renderer-image.yml` | Renderer | contracts, legal content, site renderer, UI, root install inputs |
| `build-site-image.yml` | Landing site | contracts, legal content, root install inputs |

This is a minimum trigger guard, not a complete dependency graph. Dynamic
imports, generated inputs, external operator scripts, and published snapshot
compatibility still require the owning workflow and application checks.

## Intentional differences retained

The matrix does not normalize workflow implementation details. Current evidence
shows that CMS and renderer use newer Buildx, login, metadata, and build-push
action majors than the static image workflows. CMS uses a registry cache while
the other image workflows use GitHub Actions cache, and only CMS/renderer have
explicit concurrency groups. Renderer also has a distinct packaged-image smoke
path. These differences remain visible until hosted-log and owner evidence
supports a separate consistency change.

The check is deliberately about release-trigger safety: a shared package change
must not silently stop rebuilding an application image. It does not claim that a
cache is effective merely because a cache stanza exists, and it does not change
branch protection or required-check policy.
