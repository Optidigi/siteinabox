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
| Appointment booking records | 90 days after appointment end by default; tenant-configurable from 30 to 730 days | Daily CMS purge using the tenant schedule; notification/calendar outboxes and appointment-linked mail metadata cascade with the appointment |
| Appointment calendar OAuth state | 10 minutes | Daily CMS purge of expired correlation records; state is single-use and marked consumed |
| Backups | Rolling, normally at most 90 days | Infrastructure backup policy |
| Security/access logs | Normally 6-12 months | Logging platform retention |
| PostHog identifiable/pseudonymous analytics | At most 13 months | PostHog project retention verification |
| Google Analytics 4 landing analytics | At most 13 months; prefer the available 2-month setting | GA4 property retention verification |
| Fiscal administration | 7 years or applicable statutory period | Finance system retention |
| Marketing permission evidence | Through use plus required evidence period | Preference event retention |
| Suppression/opt-out record | As long as needed to honor opt-out | Minimal suppression record |
| Agreement acceptance and frozen order evidence | Approved contract/evidence period | Append-only archive policy |

The supplied privacy statement currently describes CMS form submissions as
available during the active agreement, while the implementation purges them
after 90 days. Before the first legal publication, the public statement and
product setting must be made identical. The recommended product default is 90
days with a clear tenant-facing disclosure and deletion/export controls.

Appointment retention is a separate tenant setting because appointment data
contains visitor contact details and scheduling context. The product default is
90 days after the appointment ends; the CMS bounds the setting to 30–730 days,
and the scheduled purge runs daily. Appointment notification metadata logs are
linked to the booking and cascade with it. Enabling the future public appointment
section requires the tenant disclosure to identify the controller, purpose,
retention, transactional notifications, and any owner-authorised calendar
processor. The currently published legal release is immutable and does not yet
contain this appointment-specific disclosure, so public activation must wait
for the next approved privacy release.
