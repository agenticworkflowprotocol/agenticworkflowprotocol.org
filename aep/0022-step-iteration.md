# AEP-0022: Step iteration (`forEach`)

| | |
| --- | --- |
| **AEP** | 0022 |
| **Title** | Step iteration (`forEach`): bounded fan-out over a list |
| **Authors** | AI agent on behalf of @agenticworkflowprotocol |
| **Shepherd** | Project lead |
| **Type** | Specification |
| **Status** | Accepted (lead decision [D19](../docs/decisions.md#d19-step-iteration-goes-into-v1alpha2-directly), without the external review of D16) |
| **Reviewer roles needed** | Runtime implementer, language or schema reviewer (still welcome; see Decision) |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha2` (section 5.6.4); carried into the `v1alpha3` draft as section 5.6.5 ([D20](../docs/decisions.md#d20-the-kubernetes-resource-model-draft-becomes-v1alpha3)) |
| **Profiles affected** | `core`; `audit` (one field in events of item runs) |
| **Created** | 2026-11-19 |
| **Discussion** | to be opened as a GitHub issue |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

A step can run once per item of a list with `forEach: { items, maxItems, concurrency }`. The list
is one input or one output of an earlier step, fixed when the step becomes ready. `maxItems` is
required, so the number of item runs is bounded before the execution starts. New expression
references `forEach.item`, `forEach.item.<key>` and `forEach.index` give each item run its item.
The outputs of an iterating step are lists, one entry per item.

## Motivation

Workflows often apply the same step to every element of a list: scan every container image of a
repository, review every changed file, check every dependency. In `v1alpha1` there are three ways
to do this, all of them poor:

- one agent step that handles the whole list: one timeout and one retry budget for all items, a
  failure of one item is hidden inside the result, and the step cannot be parallelised;
- a tool that takes a list: the same, plus a size limit per call that the manifest cannot see;
- an extension field: every runtime invents its own, and a runtime that ignores the extension runs
  the step once instead of once per item, with fewer restrictions (a critical extension, see the
  [extension prefix list](../docs/registry/extension-prefixes.md)).

Prior art: CI systems (job matrices), workflow engines (map states, dynamic task mapping) and at
least one agent runtime built against `v1alpha1` (as an extension field). All of them bound the
fan-out and give each element its own retries; none of them lets a model decide how many
iterations run.

## Goals and non-goals

- Goals: a fixed list, a mandatory upper bound, per-item timeout and retries, bounded concurrency
  that respects `budget.resources.maxConcurrency`, outputs as lists, static validation.
- Non-goals: loops with a condition (`while`, `until`), iteration over a list produced by the same
  step, nested iteration, conditional items (see AEP-0001 for `when`), iterating approval steps.

## Specification

Changes to `v1alpha1`, as written into [spec/v1alpha2](../spec/v1alpha2/README.md):

- **3.9 Expressions.** New references `forEach.item`, `forEach.item.<key>` (one or more keys
  `[a-zA-Z0-9_-]{1,63}`, a field of an object item or a zero-based position of a list item) and
  `forEach.index`. They MUST only be used in `task` and `env` values of a step that declares
  `forEach`. `forEach.items` is expression-enabled.
- **5.6.1 Common step fields.** New field `forEach` (object) for `agent` and `command` steps; not
  allowed on `approval` steps.
- **5.6.4 Iteration** (new):

  | Field | Type | Req. | Description |
  | ----- | ---- | ---- | ----------- |
  | `items` | string | yes | Exactly one reference, and nothing else: `${{ inputs.<name> }}` of an input with `type: array`, or `${{ steps.<step-id>.outputs.<name> }}` of a step this step depends on. |
  | `maxItems` | integer | yes | Maximum number of items, at least `1`. |
  | `concurrency` | integer | no | Maximum number of item runs at the same time. Default `1`. MUST NOT exceed the effective `budget.resources.maxConcurrency`. |

  1. The runtime evaluates `items` when the step becomes ready. Not a list, or more than
     `maxItems` entries: the step fails without running any item; the list is never truncated. An
     empty list makes the step succeed.
  2. Each item is one item run with its own `timeout` and `retries`.
  3. At most `concurrency` item runs at the same time; each counts as a running step for
     `maxConcurrency`. Item runs SHOULD start in list order.
  4. After a failed item run (after its retries) no further item run starts; running ones SHOULD
     finish; the step fails.
  5. On success each declared output is a list with one entry per item, in list order (`null` for
     an item run without a value).
  6. Usage of all item runs counts against the step, agent and workflow budgets; the step budget
     limits the step as a whole.
  7. Status: `waitingForApproval` while an item run waits for an approval, otherwise `running`.
- **5.7 Budgets.** `maxConcurrency` counts running item runs.
- **10.4 Event types.** Under the audit profile, events of an item run carry `data.forEachIndex`.

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha2
kind: Workflow
metadata:
  name: example
  version: 0.1.0
  owner:
    team: example-team
  classification: internal
spec:
  inputs:
    - name: files
      type: array
      required: true
  budget:
    resources:
      maxConcurrency: 2
  agents:
    - id: reviewer
      model:
        provider: example-provider
        name: example-model
  workflow:
    - id: review
      agent: reviewer
      task: "Review ${{ forEach.item }} (file ${{ forEach.index }})."
      forEach:
        items: "${{ inputs.files }}"
        maxItems: 50
        concurrency: 2
      retries: 1
      outputs:
        - name: finding
```

A complete example: [spec/v1alpha2/examples/image-review.workflow.yaml](../spec/v1alpha2/examples/image-review.workflow.yaml).

## Schema changes

[`schema/awp.v1alpha2.json`](../schema/awp.v1alpha2.json) is `awp.v1alpha1.json` with:

- `$id`, title and the `apiVersion` constants of `Workflow`, `Agent` and `Policy` for `v1alpha2`;
- `$defs/ForEach` (closed, `^x-` allowed): `items` with a pattern for exactly one input or step
  output reference, `maxItems` (integer, minimum 1, required), `concurrency` (integer, minimum 1);
- `$defs/Step.properties.forEach`, forbidden in the `approval` branch of the step type rules;
- `$defs/Expression` additionally allows `forEach.index` and `forEach.item(.<key>)*`.

New semantic rules ([schema/README.md](../schema/README.md#semantic-validation-rules)):
`expr.iteration-outside-forEach`, `forEach.input-not-array`, `forEach.concurrency-exceeds-budget`.
The existing `expr.*` rules apply to `forEach.items`.

## Conformance impact

Profile: `core` (spec 3.3). New cases in [conformance/](../conformance/README.md), suite version
0.2.0:

| Case | Expected |
| ---- | -------- |
| `valid/5.6.4-for-each.yaml` | valid: agent step over a step output, command step over an array input with `forEach.item.<key>` in `env` |
| `invalid/5.6.4-for-each-missing-max-items.yaml` | `schema.required` at `/spec/workflow/1/forEach` |
| `invalid/5.6.4-for-each-items-not-a-reference.yaml` | `schema.pattern` at `/spec/workflow/1/forEach/items` |
| `invalid/5.6.4-for-each-on-approval-step.yaml` | `schema.not` at `/spec/workflow/1` |
| `invalid/5.6.4-for-each-items-not-a-dependency.yaml` | `expr.not-a-dependency` at `/spec/workflow/1/forEach/items` |
| `invalid/5.6.4-for-each-input-not-array.yaml` | `forEach.input-not-array` at `/spec/workflow/1/forEach/items` |
| `invalid/5.6.4-for-each-concurrency-exceeds-budget.yaml` | `forEach.concurrency-exceeds-budget` at `/spec/workflow/1/forEach/concurrency` |
| `invalid/3.9-iteration-reference-outside-for-each.yaml` | `expr.iteration-outside-forEach` at `/spec/workflow/1/task` |
| `invalid/3.3-for-each-in-v1alpha1.yaml` | `schema.additionalProperties` at `/spec/workflow/1/forEach` (a `v1alpha1` manifest) |

Runtime behaviour (item runs, list outputs, stop after the first failure) needs runtime tests once
a runtime suite exists.

## Compatibility and migration

- Additive within the new API version: every `v1alpha1` manifest is a valid `v1alpha2` manifest
  after changing `apiVersion`. `v1alpha1` itself is unchanged; a `forEach` in a `v1alpha1`
  manifest stays an unknown field and is rejected (fail closed).
- Runtimes that used an extension field for iteration map it to `forEach` and SHOULD keep reading
  the extension for one release with a warning. A free choice of the item name (`as`) is not
  carried over: the expression grammar has fixed roots, so the item is always `forEach.item`.

## Security considerations

- The bound is static: `maxItems` is required and a longer list fails the step instead of being
  truncated, so neither an input nor model output can make the fan-out unbounded. Budgets still
  apply to the step as a whole.
- `items` cannot come from the iterating step itself and cannot contain operators, so the item
  list cannot be steered by the item runs.
- Items are untrusted data like any step output. `command` is still not expression-enabled; items
  reach a command only through `env`.
- Concurrency is capped by `maxConcurrency` (default `1`), so iteration does not raise the
  parallelism an operator allowed.

## Privacy considerations

Items may carry personal data like any input or output; the classification of the referenced
input or output applies to each item. No new audit payload beyond `data.forEachIndex`.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Free item name (`as`).** Rejected: it opens the closed root list of section 3.9 and makes
  static checking of expressions depend on the step.
- **Condition-driven loops.** Rejected: the number of iterations would depend on model output;
  cost and duration could not be bounded before the execution.
- **Truncate to `maxItems`.** Rejected: silently dropping items hides missing work (fail closed).
- **Do nothing.** Runtimes keep inventing critical extensions for a common pattern.

## Implementation status

The reference checker, the schema and the conformance suite of this repository implement the
proposal. Validator and editor support follow in their own repositories.

In the `v1alpha3` draft ([D20](../docs/decisions.md#d20-the-kubernetes-resource-model-draft-becomes-v1alpha3))
iteration is section 5.6.5 and works with the step output interface of
[AEP-0018](0018-step-outputs.md): each item run has its own `$AWP_OUTPUTS` or `complete_step`,
command steps get `AWP_FOREACH_INDEX`, an output referenced by `items` is parsed as a JSON array,
and `forEach` is not allowed on input steps.

## Open questions

- Interplay with `when` (AEP-0001): should a condition apply per item or to the whole step?
- Typed list outputs (AEP-0003): the element type of the list outputs of an iterating step.
- Rendering of a list output inside `task` (AEP-0013, value rendering).

## Decision

2026-11-19: accepted for `v1alpha2` by the project lead (decision D19). The external review that
D16 requires was not held; reviews in the roles above are still invited, and their findings are
handled as errata of the `v1alpha2` draft.

## References

- [spec/v1alpha2 section 5.6.4](../spec/v1alpha2/README.md#564-iteration)
- [docs/decisions.md D19](../docs/decisions.md#d19-step-iteration-goes-into-v1alpha2-directly)
- [Extension prefix list](../docs/registry/extension-prefixes.md)
