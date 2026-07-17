# siteinabox

Site in a Box is one pnpm monorepo for the public landing and intake surfaces,
the Payload CMS, the generic generated-site renderer, and their shared packages.

## Workspace

| Path | Ownership |
| --- | --- |
| `apps/landing` | Public marketing site |
| `apps/intake` | Public intake flow |
| `apps/cms` | Tenant, content, administration, and publishing authority |
| `apps/renderer` | Host-resolved public runtime for generated sites |
| `packages/contracts` | Shared data contracts and block catalog |
| `packages/ui` | Shared primitives, tokens, and UI source |
| `packages/site-renderer` | Shared CMS preview and public rendering |
| `packages/legal-content` | Versioned governed legal source |

Workspace manifests and `pnpm-workspace.yaml` are canonical for the actual
inventory and dependency graph.

## Start here

- [Repository instructions](AGENTS.md)
- [Documentation index](docs/README.md)
- [Current architecture](docs/architecture.md)
- [Engineering workflow](docs/engineering.md)
- [Repository tooling and MCPs](docs/tooling.md)
- [Active findings](docs/findings.md)

## Development

Use Node and pnpm versions declared at the repository root.

```bash
pnpm install --frozen-lockfile
pnpm --filter siab-payload dev
pnpm --filter siteinabox-landing dev
pnpm --filter siteinabox-intake dev
pnpm --filter @siteinabox/renderer dev
```

Root and package `package.json` scripts are canonical for verification commands.
CI and image workflows under `.github/workflows/` are canonical for automated
gates and release triggers.

Generated tenant sites are validated data and immutable published snapshots.
They are not tenant-specific source repositories, workflows, or images.
