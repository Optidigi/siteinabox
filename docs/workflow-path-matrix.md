# Workflow ownership

`workflow-path-matrix.json` declares one canonical PR/main-push qualification
and promotion-archive producer: `ci.yml`. Scheduled/manual security inventory
uses the same verifier for fresh scans and is not a promotion source.
Every pull request, main push and manual verification runs the CMS, renderer and
landing image matrix. There are no image path filters and no duplicate automatic
archive workflows. Shared contracts, UI, legal content, install inputs and
unknown paths therefore retain all consuming-image checks.

`pnpm workflow:check` rejects missing image variants, conditional source triggers
and reintroduced `build-*-image.yml` producers. Actual packaged smoke, scanner,
source/run/attempt checks remain in the verifier and required-CI policy tests.
Only trusted main executions retain the verified TAR archives for subsequent
separately approved publication. PRs retain JSON/raw-scan proof without
publication inputs or registry writes.
