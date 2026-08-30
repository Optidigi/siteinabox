# Environment contracts

`docs/environment-inventory.json` records the 98 environment names read by
tracked source and tests across CMS, intake, landing, and renderer. The
inventory is source-owned; deployment-only image digests and Compose plumbing
are not falsely presented as application reads.

## Evidence

The classification was researched on 2026-08-12 from:

- source access patterns under `apps/`, `packages/`, and `scripts/`;
- the active VPS `.env` key names for all four application stacks;
- the running container environment key names;
- Dockerfiles, Compose files, image workflows, deployment runbooks, and
  `.env.example` files.

Only names were collected from the VPS. Values, credentials, tokens, and
connection strings were not printed or committed. The sanitized inventory is
recorded in `docs/environment-inventory.json` and checked by
`pnpm environment:check`.

This document covers variables read by application source. Package-owned
runtime and test variables, including `SIAB_LEGAL_CONTENT_ROOT`, remain
documented by the package that owns their behavior.

## Contract model

The executable classifier in `scripts/environment-contract.mjs` assigns every
source-read name:

- `exposure`: `public`, `secret`, or `internal`;
- `phase`: `build`, `runtime`, or `test`;
- `requiredness`: `startup-required`, `operation-scoped`, `optional`, or
  `test-only`.

Public browser variables are the `PUBLIC_*` and `NEXT_PUBLIC_*` families plus
the documented public analytics/site values. Names containing API keys,
passwords, secrets, or tokens are secret unless an explicit public exception
exists. Everything else is internal configuration until source evidence
justifies a stronger classification.

The contract distinguishes requiredness from presence. A value being present
in the VPS `.env` does not prove that every code path requires it. The current
source evidence proves CMS startup requirements for `PAYLOAD_SECRET` and
`DATABASE_URI`. Provider credentials, Turnstile, email signing, renderer
authentication, and administrative analytics credentials are
operation-scoped. Optional OAuth, analytics, AI, feature, URL, rate-limit,
and deployment settings remain optional until their individual operation is
invoked.

Static applications keep their build/runtime boundary explicit:

- intake `PUBLIC_*` values and `SITE_URL` are build inputs;
- landing PostHog, Turnstile, and `SITE_URL` values are build inputs;
- CMS `NEXT_PUBLIC_*` values are build inputs while CMS server settings remain
  runtime values;
- renderer `SITE_URL`, token-file, fixture, and origin settings are runtime
  container configuration.

## Validation

`pnpm environment:check` runs the classifier tests and then checks that:

- every tracked source read is present in the inventory;
- no inventory name is stale or duplicated;
- the inventory is marked `researched`;
- every inventory entry has a valid exposure, phase, and requiredness result.

This is deliberately a non-mutating contract check. It does not print values,
require production credentials, or change application startup behavior.
