# AI runtime compatibility

The generation provider, first-site conversation and existing-site editor use the
same governed Mastra runtime. Existing provider selection and environment names
remain authoritative. The default single model is `openai/gpt-5.6-luna`, with
high reasoning for generation and medium for first-site chat and maintenance.
The existing model/reasoning overrides retain their meaning. This contract does
not introduce fallback models, a structuring model, another provider or a new
agent framework.

## Requests and completion

`mastraCompatibilityOptions` preserves zero model and processor retries across
all three Agent constructors. Mastra 1.73 introduced default recovery processors;
setting an empty processor array does not disable them. The explicit
`errorProcessorDefaults: false` opt-out prevents history/prefill repair and stream
retries from silently adding requests. See the
[upstream change](https://github.com/mastra-ai/mastra/pull/24473) and
[exact runtime defaults](https://github.com/mastra-ai/mastra/blob/@mastra/core@1.78.0/packages/core/src/processors/stability-defaults.ts).
Logical step limits remain unchanged: four for first-site conversation, the
runtime default for generation/editor. A step limit is not a billed-request or
absolute-cost bound.

JSON generation still parses/coerces existing model shapes and validates the
structured content schema. It never executes model-generated source or publishes
a site. Tool inputs remain the first `execute` argument; tenant context, roles,
content schemas and the existing explicit Save/Publish boundary remain enforced
by application tools and routes.

Only completed `stop` or `tool-calls` output without a terminal error proceeds to
application postprocessing. Length exhaustion, interruption and failed terminal
states are not successful generation, even if their text resembles valid JSON.
Editor deltas are provisional; successful `done` follows final-output validation.
A failed/interrupted started model run raises `MastraRunIncompleteError` and must
not trigger deterministic fallback writes or a second model request. Completed
tool changes are not rolled back automatically: inspect the current preview
before retrying. Existing deterministic operation when Mastra is not selected,
and fallback for failures before entering the model run, remain available.
The SDK can exclude failed-attempt text from final output while earlier deltas
remain visible; see its [stream correction](https://github.com/mastra-ai/mastra/pull/26654).

## Verification and later accounting

`mastra-runtime-compatibility.test.ts` exercises the installed SDK through the
three application callers using controlled models, tool calls and HTTP doubles.
It checks configured routing/reasoning, structured validation, ordinary streaming,
terminal failure, interruption, role denial and absence of added recovery.
Focused builder, generation, editor and route regressions remain necessary.
Synthetic provider responses are not live model-quality or billing evidence.

These callers previously did not forward browser-disconnect signals; this upgrade
does not claim end-to-end disconnect cancellation. Runtime abort/error handling
is exercised independently. The SDK's usage output can omit an interrupted
step, so missing/zero usage is not proof of zero incurred cost. Later M20–M26
must reserve and reconcile billed failures and unresolved liability within the
USD1 monthly free-account allocation or USD1 monthly shared paid-tenant
allocation. Those durable absolute-cost controls are not implemented here.
Real-model evaluation needs separate G05 approval within that final policy.

No schema migration or production content transformation accompanies this
upgrade. Source rollback restores the coherent manifest/lockfile and compatibility
code together; it does not reverse completed preview edits. Retain interruption
handling when selecting another compatible runtime and requalify packaged images.
