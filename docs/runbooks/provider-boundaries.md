# Provider boundaries and uncertain writes

Provider adapters validate the fields consumed by business decisions before
returning them: identities, EUR amounts, known states, credentials, nested
adjustments and pagination links. Unrelated additional fields are tolerated.
Malformed or unknown financial authority fails closed. Diagnostics must not
include response bodies, recipient addresses, credentials or transfer codes.

HTTP reads have bounded attempts, deadlines, response sizes and pagination.
Writes receive one transport attempt. A timeout, malformed success or ambiguous
provider failure retains the existing operation identity and reconciliation
state; it never authorizes creating a replacement operation. A request abort
cancels body consumption as well as the initial fetch.

Calendar event creation records `providerCreateUncertain` before sending. A
verified response clears that marker and records the provider identity. Recovery
must reconcile using the existing stable event key before another create.
Expired claims use atomic database conditions and increasing attempt counts;
stale workers cannot publish results from an earlier claim.

Mail delivery records `retryState: permanent` before sending, then records the
verified receipt or a definitive provider rejection. A crashed worker or an
indeterminate transport outcome leaves that durable marker in place. Neither
an expired lease nor an old in-memory snapshot may resend it. SMTP and the mail
REST service do not provide a general delivery lookup or idempotent resend
contract; unknown delivery remains blocked until receipt evidence is verified.
Do not clear the marker merely because time has elapsed.

## Migration and recovery

The owning generator for the provider uncertainty migration is
`apps/cms/scripts/provider-write-uncertainty-migration.ts`. Its output adds the
calendar marker, marks existing events without provider identities uncertain,
and blocks existing processing mail deliveries. It preserves other row data.
Generate Payload types and the migration index with the owning commands, inspect
the resulting diff, and rehearse the complete migration chain against disposable
PostgreSQL before release.

Retain this schema and its evidence when reverting application code. Older code
does not honor the uncertainty controls, so stop the affected workers before
reverting; do not resume older workers while unresolved writes exist. The down
migration refuses to remove the calendar marker while any calendar uncertainty
or processing mail with a permanent retry marker remains. Resolve each operation
from verified provider evidence, rehearse rollback on a disposable database,
and preserve an evidence export before any separately authorized production
rollback. Never replace the installed secure dependencies with vulnerable
versions to achieve rollback.

The integration claim tests require real PostgreSQL. Domain validation requires
real BIND `named-checkzone`; see [local verification](local-development.md).
Adapter tests cover malformed bodies, consumed-field mismatches, timeouts,
cancellation, retries, pagination and uncertain writes without provider writes.
