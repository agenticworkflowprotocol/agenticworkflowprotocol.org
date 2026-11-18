---
title: "Build your own AWP runtime"
description: "A starting path for implementers."
banner:
  content: "Draft - v1alpha1. Fields and semantics may change before v1beta1."
---

1. Read the [specification](/specification/v1alpha1/#1-introduction) and the [glossary](/specification/v1alpha1/glossary/).
2. Validate manifests with the [JSON Schema](/schema/awp.v1alpha1.json) and implement the semantic rules listed in the [schema README](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/schema/README.md).
3. Run the [conformance suite](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/tree/main/conformance): valid manifests must be accepted, invalid ones rejected with the expected diagnostic.
4. Start with the `core` profile, then add `governance`, `audit`, `security`, `mcp` and `a2a` as needed.
5. Publish a conformance statement with the profiles you meet and the optional features you do not support.
6. Open a pull request to be listed on the [implementations](/implementations/) page.

Optionally provide the [CLI commands](/tooling/cli/) with the specified output formats.

## Implementation notes

Lessons from runtimes built against `v1alpha1`. They are informative; where the specification leaves a choice open, the related proposal is linked.

- **Pin the schema, do not copy it by hand.** Vendor the JSON Schema and the semantic rules of the conformance suite at a commit, record the commit and file hashes, and check them in CI. The schema is normative for structure ([decision D2](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/docs/decisions.md#d2-json-schema-is-normative-for-structure)).
- **Fail closed and say why.** A field of a profile you do not support, or a core feature you do not support yet (command steps, agent references, built-in tools, resource scopes), rejects the manifest with a diagnostic that names the field (spec 3.3). Never run the rest.
- **Enforce in the control plane.** Route every model invocation and action through your own proxies and let each call name its step. The proxy then allows only the tools and the model of that step's agent, and checks budgets before each call. Where steps run is a separate choice: see [execution placement](/implementations/execution-placement/).
- **Stricter rules are fine, silent ones are not.** Requiring explicit `tools` lists per MCP source, or that every MCP server is a configured connection, is a deployment rule. Reject with the rule's name; never execute with fewer restrictions ([AEP-0013](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0013-runtime-clarifications.md), item 5).
- **Bind servers by name, but never redirect.** Undeclared servers may be resolved from your configuration (spec 5.5.1). A declared `url` that differs from the bound connection is an error, not a hint (AEP-0013, item 6).
- **Approvals can come from the runtime.** If your tool catalog classifies tools as read or write, requiring approval for every write action is stricter than the manifest and allowed. A rejection should end the dependent work, and open approvals of a finished execution must be closed (AEP-0013, item 3; [AEP-0007](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0007-mcp-connection-catalog.md) for access classes).
- **Budgets measured after the call.** `maxTokens` and `maxCostUsd` are known only after an invocation; deny the next call once usage reached the limit, and never count unknown cost as zero (AEP-0013, item 1).
- **Validate inputs before the start.** Check type, pattern, enum and required inputs, apply `default` values, and reject with all problems at once (spec 5.3). Example values for test runs belong in a separate field, not in `default` ([AEP-0014](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0014-input-examples-and-schemas.md)).
- **Steps without a model.** If you need a step that calls one tool with fixed arguments, use an extension field on the step until [AEP-0012](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0012-tool-steps.md) (tool steps) is available, and treat it as critical: a runtime that ignores it would run an agent step without a task.
- **Name extensions well.** One prefix, lowerCamelCase field names, each field on the object it modifies, documented as safe to ignore or critical ([extension prefix list](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/docs/registry/extension-prefixes.md)).
- **Count tool errors as errors.** An MCP result with `isError: true` is a failed action, also when the model summarises it as text. Authentication errors should end the step without retries.
- **Use the agreed wording.** Until the conformance suite passes against your validator and real exports in public CI, describe the runtime as "built to the AWP schema, conformance in progress (alpha)".

## Example: plan output

A command such as `awp plan` can show what a workflow may do before it runs (illustrative; see [CLI output formats](/tooling/cli/) for the specified formats):

```text title="terminal"
$ awp plan workflow.yaml

AWP Execution Plan

Workflow: vulnerability-fixer
Version: 0.1.0

Agents:
  researcher → claude
  fixer      → qwen3

Tools:
  github.read
  github.write
  shell.execute

Policies:
  ✓ cost limit
  ✓ tool permissions
  ✓ network policy
  ✓ production restriction

Human approval:
  required before merge

Estimated maximum:
  30 steps
  $2.00
  15 minutes
```
