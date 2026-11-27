# AEP-0001: Conditional steps (`when`) with a restricted expression language

| | |
| --- | --- |
| **AEP** | 0001 |
| **Title** | Conditional steps (`when`) with a restricted expression language |
| **Authors** | AI agent on behalf of @agenticworkflowprotocol |
| **Shepherd** | Project lead (D23) |
| **Type** | Specification |
| **Status** | Accepted for `v1alpha4` (lead decision [D23](../docs/decisions.md#d23-conditional-steps-and-workflow-steps-start-v1alpha4), without the external review of D16) |
| **Reviewer roles needed** | runtime implementer, language or schema reviewer, security reviewer (still welcome; see Decision) |
| **Reviewers** | none yet |
| **Owner decisions** | [D5](../docs/decisions.md#d5-when-uses-a-restricted-expression-grammar-not-cel), [D6](../docs/decisions.md#d6-executions-may-succeed-with-condition-skips) (2026-10-10), [D23](../docs/decisions.md#d23-conditional-steps-and-workflow-steps-start-v1alpha4) (2026-11-27) |
| **Target API version** | `v1alpha4` (`v1alpha2` until [D22](../docs/decisions.md#d22-v1alpha3-becomes-the-current-draft), `v1alpha3` until D23); written into the `v1alpha4` draft as section 3.12 |
| **Profiles affected** | `core` (step semantics), `audit` (new event type) |
| **Created** | 2026-10-09 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Add an optional `when` field to workflow steps. `when` is a boolean condition in a small, typed,
side-effect-free expression language over workflow inputs, declared step outputs and the execution
environment. A step whose condition is false is **skipped by
condition**; this does not fail the execution. Evaluation errors fail the step, they are never
treated as `false`.

## Motivation

Many agentic workflows take a write action only in some cases: comment on a ticket only when a
finding is severe, deploy only from a release branch, publish a review only when it was requested.
`v1alpha1` has no conditions: `skipped` only follows a failed dependency, and an execution succeeds
only if every step succeeded (spec 5.6.3). Authors today either put the decision into the agent's
instructions (so the model, not the runtime, decides whether a write step runs) or split workflows.

At least one implementation effort has conditional steps with a restricted grammar; its manifests cannot be
expressed in AWP without losing the condition, and a runtime that drops the condition runs a step
the author wanted skipped.

## Goals and non-goals

- Goals: deterministic, runtime-evaluated step conditions; a grammar small enough to implement
  identically in any language; fail-closed evaluation; execution success with condition skips.
- Non-goals: loops, branching to arbitrary steps, user-defined functions, string manipulation,
  arithmetic, access to secrets, conditions inside permissions or policies (policies have their own
  condition model, spec 8.3).

## Specification

> As accepted into `v1alpha4` (D23). Differences from the text proposed for `v1alpha2`: the
> section is 3.12, because 3.10 and 3.11 are taken in `v1alpha3`; there is no `event` root,
> because AEP-0004 is not accepted; and step outputs, which are text since `v1alpha3` (spec 5.6.4),
> are read as JSON in conditions. The normative text is
> [spec/v1alpha4 section 3.12](../spec/v1alpha4/README.md#312-conditions).

### Changes to section 5.6.1 (common step fields)

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `when` | string | no | Condition expression (section 3.12). The step runs only if it evaluates to `true`. |

### New section 3.12: Conditions

A condition is a string in the following grammar. It is written without `${{ }}`; the whole field
is the expression.

```text
expr    := or
or      := and ( "||" and )*
and     := unary ( "&&" unary )*
unary   := "!" unary | compare
compare := operand ( ( "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" ) operand )?
operand := literal | path | list | "exists" "(" path ")" | "(" expr ")"
path    := root ( "." name | "[" index "]" )*
root    := "inputs" "." name
         | "steps" "." step-id "." "outputs" "." name
         | "execution" "." "environment"
list    := "[" ( literal ( "," literal )* )? "]"
literal := string | number | "true" | "false" | "null"
```

- Strings use double quotes with JSON escapes. Numbers use the JSON number syntax.
- A step output is text (spec 5.6.4). In a condition it is read as JSON if it parses as a JSON
  value, otherwise as a string: the output text `true` is the boolean `true`, `high` is the string
  `"high"`. Path segments after the output name select into the parsed value.
- Typing is strict: no truthiness and no coercion. `==` and `!=` compare two scalars of any type
  (different types are unequal); `<`, `<=`, `>`, `>=` need two numbers or two strings (code point
  order); `&&`, `||`, `!` need booleans; `in` tests whether a scalar is an element of a list
  (literal list or a path that resolves to an array of scalars). The result MUST be a boolean.
- `exists(path)` is `true` if the path resolves, including to `null`.
- Reading a path that does not resolve (outside `exists`), comparing an object or array, a type
  mismatch, or a non-boolean result is an **evaluation error**.
- Path segments `__proto__`, `prototype` and `constructor` MUST be rejected. Only own properties
  are read.
- Limits: at most 512 characters, 128 tokens, nesting depth 16, 16 path segments, 32 list items,
  string literals of at most 256 characters, indexes at most 10000. Manifests that exceed a limit
  MUST be rejected.
- Expressions are evaluated by the runtime, never by a model, and have no side effects.

Validation rules (static):

1. `when` MUST parse; otherwise the manifest is rejected.
2. `steps.<id>` in `when` follows the dependency rule of section 3.9: `<id>` MUST be a direct or
   transitive dependency, and `<name>` MUST be a declared output of `<id>`.
3. `inputs.<name>` SHOULD name a declared input (warning otherwise, as for expressions).

### Changes to section 5.6.3 (execution model)

Replace items 2, 4 and 6 with:

2. A step becomes **ready** when every step in its `dependsOn` has the status `succeeded` or
   `skipped` with reason `condition`. When a step is ready and has `when`, the runtime evaluates
   the condition before anything else: `true` runs the step; `false` sets the status `skipped` with
   reason `condition`; an evaluation error sets `failed` with reason `conditionError`.
4. If a step fails (after its retries), all steps that depend on it directly or transitively get
   the status `skipped` with reason `dependencyFailed`.
6. An execution **succeeds** if every step has the status `succeeded` or `skipped` with reason
   `condition`. Otherwise it fails.

New item 8: A reference to an output of a step that was skipped by condition is an evaluation
error, except inside `exists()`, which returns `false`. Expression-enabled fields (section 3.9)
that reference such an output fail the referencing step with reason `missingOutput`.

### Changes to section 10.4 (event types)

| Type | When | Required `data` |
| ---- | ---- | --------------- |
| `step.skipped` | A step was skipped. | `stepId`, `reason` (`condition`, `dependencyFailed`), `condition` (the expression text, for `condition`) |

Under `payload: metadata` (section 10.2) the event MUST NOT contain the values the condition read.

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: Workflow
metadata:
  name: ticket-triage
spec:
  version: 0.1.0
  owner:
    team: example-team
  classification: internal
  inputs:
    - name: ticket
      type: string
      required: true
  agents:
    - id: analyst
      model: { provider: example-provider, name: example-model }
    - id: writer
      model: { provider: example-provider, name: example-model }
  workflow:
    - id: analysis
      agent: analyst
      task: "Rate ticket ${{ inputs.ticket }}."
      outputs:
        - name: severity
    - id: comment
      agent: writer
      dependsOn: [analysis]
      when: 'steps.analysis.outputs.severity in ["high", "critical"]'
      task: "Comment on ${{ inputs.ticket }}."
```

## Schema changes

- `Step.properties.when`: `{ "type": "string", "minLength": 1, "maxLength": 512 }`.
- Semantic rules: `when.syntax`, `when.limit-exceeded`, `when.forbidden-segment`,
  `when.unknown-root`, `when.unknown-step`, `when.not-a-dependency`, `when.undeclared-output`,
  warning `when.undeclared-input` (as implemented in `conformance/conditions.mjs`).

## Conformance impact

- `core`: static rules above; runtime: readiness, skip reasons, success rule, evaluation errors.
- `audit`: `step.skipped`.
- Cases in `conformance/v1alpha4/`: `valid/5.6.1-when-on-every-step-type.yaml`,
  `valid/5.6.1-when-exists-and-in.yaml`, `valid/5.6.1-when-json-path-into-output.yaml`;
  `invalid/3.12-when-syntax.yaml` (`when.syntax`), `invalid/3.12-when-too-long.yaml`
  (`schema.maxLength`), `invalid/3.12-when-forbidden-segment.yaml` (`when.forbidden-segment`),
  `invalid/3.12-when-unknown-root.yaml` (`when.unknown-root`),
  `invalid/3.12-when-not-dependency.yaml` (`when.not-a-dependency`),
  `invalid/3.12-when-undeclared-output.yaml` (`when.undeclared-output`). Runtime tests once a
  runtime suite exists: false condition skips and execution succeeds; evaluation error fails; output
  of skipped step inside `exists()`.

## Compatibility and migration

Additive for manifests: manifests of older versions have no `when`, and `migrate` converts them
to `v1alpha4` unchanged apart from `apiVersion`. The success rule changes only for manifests that
use `when`. A runtime of an older version rejects `when` as an unknown field (fail closed), which
is the intended behaviour.

## Security considerations

- Conditions over model output let the model influence control flow. Conditions are not an
  authorization mechanism: permissions, policies and approvals still apply to every action of a
  step that runs. Authors SHOULD combine conditions over model output with typed outputs
  (AEP-0003) so that the condition reads validated values.
- Fail closed: evaluation errors fail the step instead of skipping or running it.
- No functions, no regular expressions, no arithmetic: no denial-of-service through expensive
  evaluation; the limits bound parse and evaluation cost.
- Prototype-reaching segments are rejected for implementations in dynamic languages.

## Privacy considerations

Condition values can be personal data. `step.skipped` records the expression text, never the values
(under `payload: metadata`).

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **CEL (Common Expression Language) subset** (rejected by owner decision D5): well specified, but a large surface with functions,
  macros and implementation-specific extensions; a subset would need its own definition anyway.
- **JSONPath / JMESPath filters**: query languages with functions; harder to bound.
- **`${{ }}` wrapping**: would mix interpolation and conditions in one syntax; rejected so that
  `when` cannot be mistaken for a string template.
- **Do nothing**: conditions stay in prompts, where the model decides whether a write step runs.

## Implementation status

At least one runtime in progress has a condition field with the same grammar in its own format.
No implementation of this AEP exists.

## Open questions

1. Should `when` also be allowed on approval steps (gate only in some cases)?
2. Is `execution.environment` enough, or are trigger attributes (`trigger.type`) needed?
3. Should a step be able to opt into running after a failed dependency (`runAfterFailure`)? Not
   proposed here.

## Decision

2026-11-27 ([D23](../docs/decisions.md#d23-conditional-steps-and-workflow-steps-start-v1alpha4)):
accepted for `v1alpha4` by the project lead, in the form written into the
`v1alpha4` draft (section 3.12 and the changes to 5.6.1, 5.6.3 and 10.4). The external review that
D16 requires was not held; reviews in the roles above are still invited, and their findings are
handled as errata of the `v1alpha4` draft. Open questions: 1. `when` is allowed on every step type,
including approval steps. 2. `execution.environment` is the only execution fact. 3. Not part of
`v1alpha4`.

2026-11-25 ([D22](../docs/decisions.md#d22-v1alpha3-becomes-the-current-draft)): the target is now `v1alpha3`, the current draft. The owner direction below is kept as recorded.

Owner direction of 2026-10-10: the grammar is a restricted expression grammar defined in this AEP, not CEL (D5); an execution may succeed when steps are skipped by a condition (D6). Target `v1alpha2`. Not accepted; needs the reviews listed in the header ([aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)).

## References

- [spec/v1alpha4 section 3.12](../spec/v1alpha4/README.md#312-conditions), sections 3.9, 5.6.3,
  10.4.
