# Image workflow path matrix

`docs/workflow-path-matrix.json` records the minimum source paths that must
trigger each deployable image workflow. Because these workflows build with the
repository root as Docker context, the root `.dockerignore` is also a required
trigger for every image. That file must exclude local projection trees
(`.data-out`, `.data-test-*`, stray `.data`) so tenant JSON/media never enter
an image. `pnpm workflow:check` compares the matrix with the
tracked workflow YAML and fails when a required trigger is removed or a new
`build-*-image.yml` workflow is not recorded.

| Image workflow | Application | Shared paths covered |
| --- | --- | --- |
| `build-cms-image.yml` | CMS | contracts, legal content, site renderer, UI, root install inputs, `.dockerignore` |
| `build-renderer-image.yml` | Renderer | contracts, legal content, site renderer, UI, root install inputs, `.dockerignore` |
| `build-site-image.yml` | Landing site | contracts, legal content, root install inputs, `.dockerignore` |

This is a minimum trigger guard, not a complete dependency graph. Dynamic
imports, generated inputs, external operator scripts, and published snapshot
compatibility still require the owning workflow and application checks.

## Verification and publication

All three image workflows run on matching pull requests, main pushes and manual
verification dispatches. They build local images, smoke-test them and retain
an image archive plus source/image/hash evidence for seven days. They have
read-only repository permissions, no registry login and no registry cache exports.
`pnpm image:verify cms`, `renderer` or `site` runs the same unpublished seam
locally with Docker and the repository toolchain. It requires committed clean
source; all smoke resources are uniquely named and disposable. CMS uses an
internal Docker network and temporary PostgreSQL, with jobs disabled and mock AI.
Renderer retains its packaged host-routing smoke. Landing is built and served
through its existing Nginx runtime without changing design or content.

Only the separate manual `publish-image` workflow can promote a verified
archive to GHCR. See [publication](runbooks/image-publication.md) for exact-source
approval, retry, artifact retention and bootstrap boundaries. Publication changes
no deployed container. Installed protections remain a separate control gate.
