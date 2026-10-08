# Passwordless builder contract

Customer identity follows [the authentication contract](authentication.md).
Verified preview email permits a new builder thread; a specific preview also
requires its current unrevoked grant and matching tenant/generation run.
Existing CMS membership, an accepted order, or completed payment denies further
customer AI work. Payment never grants an AI editing entitlement. Ordinary CMS
editing remains available through its normal roles; the CMS agent endpoint is
restricted to super-admin operation.

## Allowance and execution

`builderQuotaPolicy` is the owning configuration. Its customer activation flag
defaults to false pending policy and actual model evaluation approval. The engineering default is twelve lifetime successful visible turns
per normalized email, including clarifications and refusals. Device, session,
thread and draft changes do not reset the allowance. Email aliases remain an
abuse risk; normalized email is not a claim of perfect person identity.

Each request uses a client-generated UUID bound to normalized message and
language. Retrying the unchanged request returns its pending or terminal state;
reusing the UUID with different content fails. Browser pending state persists
across reload. Exhaustion preserves preview and checkout access.

Account, global and operation rows reserve visible allowance and maximum model
liability before dispatch. Successful terminal settlement consumes one visible
turn. Failure releases that turn while retaining attempts and incurred or
uncertain cost. Separate daily ingress limits count malformed, duplicate, busy
and failed requests without resetting lifetime accounting. Model envelopes bound
time, calls, steps, output and concurrency; SDK retries are disabled. Unknown
usage never becomes zero cost, and abort does not prove remote completion.

The reviewed Luna envelope reserves the full 1,050,000-token context per wire
step, including provider formatting, at the highest documented standard global
long-context cache-write/output rates. A four-step parent and one-step generation
reserve $2.66 per operation, with a $31.92 account ceiling and $100 global
ceiling; these disabled engineering limits require activation approval. The
64 KiB UTF-8 input bound is separate from billable-token accounting. Transport
requires standard reasoning, default service tier, disabled truncation, no hosted
tools or opaque conversation references, and the global Responses endpoint.
Raw per-step terminal usage includes cache-write tokens; incomplete accounting
retains the full liability. These are engineering reserves derived from the
[official model contract](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
and [usage pricing](https://developers.openai.com/api/docs/guides/prompt-caching),
not a claim of invoice reconciliation.

The global accounting fence precedes operation/account changes and each local
mutation. Owning Payload transactions pass their live request through reads,
validation hooks and writes. Missing SDK transaction state fails closed. A
committed receipt is required before dispatch and after guarded writes; an SDK
callback returning does not by itself prove a commit. No database transaction
remains open across model or mail transport.

Interrupted-operation reconciliation is bounded and never repeats model,
intake or mail work blindly. Unknown remote completion retains its liability and
active slot until independent evidence permits reconciliation. Terminal or
expired executors cannot save model output or thread state. Costly domain search
has its own durable daily account/global attempt and concurrency budgets; it
does not spend visible builder turns. Uncertain search completion retains its
claim.

## Catalog and language

The central Sitegen catalog defines approved variants. Model selection, tool
apply, page/chrome saves, approval, new publication and new snapshot activation
enforce that catalog. Existing unavailable draft sections remain editable when
unchanged so they can be repaired; their unavailable design cannot be introduced
or newly published. Existing active snapshots retain their serving contract.
Missing public designs are explicit dependencies, never temporary variants.

Dutch is primary and English is supported for builder prompts, replies, retry,
pending, error, allowance and preview controls. Model tools accept validated
content data and a trusted execution context, never executable customer output,
arbitrary tenant authority or provider purchase access.

## Unpaid preview lifecycle

`inactivePreviewPolicy` defaults to disabled. Thirty days of authenticated
customer inactivity and seven days of delivered notice are engineering defaults
pending retention/disclosure review. A late notice postpones expiry until a full
notice period has elapsed. Paid, accepted, published, account, domain and billing
obligations are conservatively exempt.

The bounded job commits a notice claim before transport. Failed or uncertain
delivery is retained and is neither blindly retried nor treated as delivered.
Expiry revokes unpaid preview access while preserving tenant content, identity,
accounting, domain and commercial evidence. It performs no physical deletion.
Production enablement requires the remaining lifecycle/reconciliation and
commercial integration proofs.

## Evaluation and rollback

The candidate manifest specifies bounded Dutch/English low/medium evaluations
using the existing model family. The preparation script defaults to a dry-run;
it records planned namespaces and liability rather than paid results. Actual
schema/catalog/apply/preview, factual restraint, injection, cost and latency
evidence remains required. The isolated runner checks the exact manifest and
reviewed source, a pre-migrated disposable database and fresh data directory; it
permits only the reviewed model transport and preserves failure evidence. A
sixteen-case low/medium evaluation reserves at most $42.56 under the documented
model envelope. Operator evaluation requires reviewed isolation and explicit
principal spending authorization; offline rehearsal is not paid evaluation.

The additive migration preserves existing columns. Its down guard rejects
stored identity, accounting, mail, job and notice evidence. After customer use,
prefer a forward fix; preserve schema and evidence while containing workers.
Do not restore insecure dependency versions or delete durable claims to make an
older application start.
