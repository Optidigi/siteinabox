# Outbound mail contract

Cloudflare Email Sending remains the provider boundary: complete mail-scoped
REST configuration takes precedence; SMTP is the fallback when no REST mail
token is configured. The DNS automation token is never used for sending.
`sendEmail.ts` owns intent/category policy, receipt interpretation and logging;
`configuration.ts` owns pure configuration inspection and address parsing.
Payload auth mail uses the lazy adapter. Security, transactional and legal mail
retain their essential classification and do not consult free AI budgets.
Optional mail still requires its existing preferences and unsubscribe headers;
templates retain their escaping rules.

## Readiness

The `mail` object in `/api/health` reports configuration presence, syntax and
provider selection. `configured` does not prove credentials, sender/domain
verification, connectivity or recipient delivery: `deliveryVerified` is always
false. Diagnostics contain issue names rather than credential, account or
address values. Correct the named environment fields through normal configuration
management. Explicitly malformed REST mail configuration does not silently fall
back to SMTP.

The mail subcheck constructs no transport and performs no DNS, authentication,
verification or send call. It does not change database/storage liveness status.
The health endpoint itself still initializes Payload, queries PostgreSQL and
creates/removes a filesystem probe; it is not a strict read-only preflight.
Boot and migrations do not send readiness messages. Actual delivery requires
the separately scoped G05 sender, recipient and provider approval.

## Acceptance and retries

| Mail log status | Meaning | Retry handling |
| --- | --- | --- |
| `sent` | Provider acceptance for the requested recipients; not inbox delivery proof. | No resend from the acceptance record. |
| `failed` | Configuration failed before sending, or definite provider rejection. | Only classified transient rejection/pre-send connection failure is automatically retryable; other failures require correction. |
| `indeterminate` | Acceptance may have occurred, or the receipt cannot establish the complete requested outcome. | `manual_review`; reconcile provider evidence before resending. |

SMTP receipts must account for requested mailboxes without requested rejections;
an ID alone is insufficient. Display names stay in message headers; receipt
comparisons and metadata use normalized mailbox addresses. Partial acceptance
and malformed receipts are indeterminate. REST retains documented asynchronous
message-ID acceptance only when recipient dispositions are empty, and otherwise
requires fully accounted recipient receipts. Bounce/suppression
is not delivery. Partial acceptance, lost responses, HTTP 408/5xx and malformed
successful bodies remain indeterminate. Timeout/abort cannot prove unsent mail.
The adapter never performs an automatic second provider send.

Legal and appointment workers preserve `manual_review` and hold their next
attempt. Ordinary legal retry actions refuse it and the detail UI omits the
retry form. Commerce failures without an explicit retryable outcome have no
next attempt; duplicate queued jobs cannot reclaim a failed record without a
scheduled retry. Generic live-handoff failures are no longer blindly retried
after their wrapper loses structured outcome information. Inspect mail/provider
evidence instead. Durable account-link dispatch and reconciliation/replay remain
M15; this introduces neither a new queue nor permission to resend uncertain mail.

Logs retain routing metadata, provider IDs/codes and redacted errors, not rendered
subject/body or raw provider causes. Invalid addresses become a marker in logs.
Alerts use hashed address references and request provider reconciliation without
sending recursive alert mail.

## Migration and recovery

`20261020_214100_mail_transport_readiness` adds mail/legal enum values and creates
the appointment retry enum by casting its historical `varchar` column. The older
snapshot modeled an enum absent from the committed appointment migration. The
owning generator used that qualified physical baseline; history is unchanged.

Before authorized rollout, inventory the column type and values outside `none`,
`retryable` and `permanent`. Stop for unsupported values; never silently coerce
history. A read-only 2026-10-20 production aggregate saw `varchar` and zero
unsupported values; repeat at cutover. Disposable actual old/new boot rehearsals
preserve sent-mail history, all three prior retry values and migration records,
and cover empty and idempotent startup. They do not prove actual Amicare
preservation or final-schema restore.

The generated down migration rebuilds enums and cannot remove values used by
new records. Its transactional rejection was rehearsed without data loss.
Prefer a forward fix; retain additive schema compatibility when reverting code,
and prepare any data mapping/restore separately. Old retry code does not
understand `manual_review`: retain these guards or pause affected workers and
resend actions before a rollback over such records. Do not rewrite history to
make downgrade succeed. Source completion does not clear live delivery, recovery
or production rollout gates.
