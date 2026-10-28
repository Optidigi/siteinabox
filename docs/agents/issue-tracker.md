# Issue tracker

Use GitHub Issues in Optidigi/siteinabox for specs and implementation tickets.
Read issue bodies and comments with `gh issue view`; use `--body-file` for writes.
Specs and fully specified tickets use `ready-for-agent`; dependencies still gate
when implementation can start. Link tickets as native sub-issues and use native
blocking relationships. PRs are not an incoming triage surface.

The parent spec owns requirements and test boundaries. Each child owns its
acceptance criteria and completion receipts. Keep procedure in existing runbooks
and executable facts in their existing manifests/policies; link rather than copy.
