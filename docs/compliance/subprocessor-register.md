# Supplier And Subprocessor Register

This register must describe production use, not merely vendors that the product
could support. Legal releases must update it when a material supplier is added,
removed, or changes role or processing location.

| Supplier | Intended role | Production verification |
| --- | --- | --- |
| Hetzner | Hosting, compute, storage, and backups | Confirm locations and agreement |
| Cloudflare | DNS, proxy, security, routing, and Email Sending | Confirm enabled products and data flow |
| Openprovider | Domain registration and management | Confirm registrant and contact data flow |
| Mollie | Payment processing | Confirm controller/processor allocation and retention |
| Moneybird | Accounting and invoicing | Confirm actual integration and data fields |
| PostHog Cloud EU | Product and tenant-site analytics | IP anonymization enabled; enforce 13-month event retention |
| KVK | Public business-data lookup | Confirm terms and request logging |
| Microsoft / Pax8 | Professional email add-on where selected | Confirm actual sold product and reseller chain |
| Google Workspace / TD SYNNEX | Professional email add-on where selected | Confirm actual sold product and reseller chain |
| OpenAI | AI assistance where enabled | Confirm data controls, region, and fields sent |
| Anthropic | AI assistance where enabled | Confirm data controls, region, and fields sent |

The public privacy document must list only suppliers relevant to the actual
service, while allowing a reasonable update mechanism. A supplier integration
must not send raw tenant form content to analytics, benchmarking, or model
training. Secrets and authenticated vendor configuration remain outside this
repository.

