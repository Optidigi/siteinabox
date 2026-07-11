# Retention Register

This register connects published statements to enforced product behavior. Any
change requires privacy/product review and corresponding code or configuration
changes.

| Data | Target | Enforcement |
| --- | --- | --- |
| Incomplete intake | 30 days | Scheduled CMS purge |
| Unpaid preview and uploads | 30 days | Scheduled CMS archive/purge |
| Minimal rejected lead record | Up to 12 months | Scheduled CMS purge; earlier objection supported |
| Active tenant site data | Active agreement | Tenant lifecycle |
| Ended tenant site/form data | Normally 30 days | Termination workflow, subject to backup cycle |
| CMS form submissions | 90-day recommended default, disclosed per tenant | Configured scheduled purge and customer deletion |
| Backups | Rolling, normally at most 90 days | Infrastructure backup policy |
| Security/access logs | Normally 6-12 months | Logging platform retention |
| Identifiable/pseudonymous analytics | At most 13 months | PostHog project retention verification |
| Fiscal administration | 7 years or applicable statutory period | Finance system retention |
| Marketing permission evidence | Through use plus required evidence period | Preference event retention |
| Suppression/opt-out record | As long as needed to honor opt-out | Minimal suppression record |
| Agreement acceptance and frozen order evidence | Approved contract/evidence period | Append-only archive policy |

The supplied privacy statement currently describes CMS form submissions as
available during the active agreement, while the implementation purges them
after 90 days. Before the first legal publication, the public statement and
product setting must be made identical. The recommended product default is 90
days with a clear tenant-facing disclosure and deletion/export controls.

