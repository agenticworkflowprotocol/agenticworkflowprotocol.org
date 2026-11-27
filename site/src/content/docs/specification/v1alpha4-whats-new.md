---
title: "v1alpha4: what's new"
description: "Informative overview of the v1alpha4 draft: conditional steps (when) and workflow steps (type: workflow) on top of v1alpha3, with a worked example and checklists."
banner:
  content: "Draft - v1alpha4, the current draft. Fields and semantics may change before v1beta1."
---
This page explains what [v1alpha4](/specification/v1alpha4/), the current draft (decision D24), adds
to `v1alpha3`. It is informative: it adds no requirement, and where it differs from the specification,
the specification decides. Everything else is the model of `v1alpha3`, explained in
[v1alpha3: how it fits together](/specification/v1alpha3-guide/). Coming from an older version? See
[Migrating to v1alpha4](/specification/migrating-to-v1alpha4/).

`v1alpha4` is `v1alpha3` plus exactly two additions, both accepted by lead decision D23:

| Addition | Field | Specification | AEP |
| --- | --- | --- | --- |
| Conditional steps | `when` on every step type | [spec 3.12](/specification/v1alpha4/#312-conditions), [5.6.3](/specification/v1alpha4/#563-execution-model) | [AEP-0001](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0001-conditional-steps.md) |
| Workflow steps | `type: workflow` | [spec 5.6.6](/specification/v1alpha4/#566-workflow-steps) | [AEP-0028](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0028-workflow-steps.md) |

Together they cover the *analyse, then act* pattern: a first step rates something, and a later step
runs, or starts another workflow, only when the result calls for it. The normative change list is
[spec 14.3](/specification/v1alpha4/#143-changes-from-v1alpha3).

## Conditional steps

`when` holds a condition, written without `${{ }}`. The runtime evaluates it when the step is ready;
`true` runs the step, `false` skips it with reason `condition`.

- **What a condition can read**: `inputs.<name>`, `steps.<id>.outputs.<name>` of a step it depends
  on (directly or transitively) and `execution.environment`. Secrets, `execution.id`, `forEach.*`
  and events are not readable.
- **Typing is strict.** Step outputs are text; in a condition the text is read as JSON if it parses,
  otherwise as a string. So the output `true` is the boolean `true` and `high` is the string
  `"high"`. There is no truthiness: `steps.risk.outputs.affected` alone is not a condition, write
  `steps.risk.outputs.affected == true`.
- **Operators**: `==`, `!=`, `<`, `<=`, `>`, `>=`, `in` (with a list), `&&`, `||`, `!`,
  `exists(path)` and parentheses.
- **Errors fail, they are never `false`.** A path that does not resolve, a type mismatch or a result
  that is not a boolean fails the step with reason `conditionError`.
- **Checked before the run.** Validators reject a condition that does not parse, exceeds the limits
  (for example 512 characters) or reads a step that is not a dependency or an output that is not
  declared.

The execution model changes with it ([spec 5.6.3](/specification/v1alpha4/#563-execution-model)):

- A step whose dependency was skipped by condition is still ready; it runs (or evaluates its own
  `when`) as if the dependency had succeeded.
- A step that reads an output of a step skipped by condition fails with reason `missingOutput`;
  guard it with `exists(...)` or its own `when`.
- Dependents of a failed step are skipped with reason `dependencyFailed`.
- An execution whose steps all succeeded or were skipped by condition succeeds.
- Every skipped step emits the audit event `step.skipped` with its reason.

## Workflow steps

A step with `type: workflow` starts another `Workflow` of the same scope as a **child execution**.

- **`workflow.ref`** names the child by `metadata.name`, **`workflow.version`** optionally narrows it
  to a SemVer range, **`workflow.inputs`** passes input values (expressions are allowed) and
  **`workflow.wait`** (default `true`) decides whether the step waits for the child to end.
- **Starting is an action.** The start is the well-known action `workflow.start`, so the parent needs
  a permission for it, and policies and approvals apply as to any other action.
- **The child is its own execution**, pinned to its own manifests and governed by its own
  permissions, policies and budget. Permissions do not pass between parent and child.
- **Budgets add up.** The cost and duration of the child also count against the budget of the parent
  and of the step.
- **Outputs** are `executionId` and `status` (`succeeded`, `failed`, `cancelled`, or `started` with
  `wait: false`). Outputs of the child workflow are not passed back in `v1alpha4`.
- **Limits.** A workflow that would start itself, directly or through a chain, fails with
  `workflowCycle`; chains deeper than 5 executions fail with `workflowDepthExceeded`. `forEach` is
  not allowed on a workflow step.
- The child's `workflow.started` event carries `parentExecutionId` and `parentStepId`, so an audit
  trail can follow the chain.

## Analyse, then act

The specification example [`cve-risk-then-fix`](/examples/analyse-then-act/) rates the risk of a CVE, always writes a
report, and starts the fix workflow only when the repository is affected. A shorter version:

<!-- awp-check -->
```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: Workflow
metadata:
  name: risk-then-fix
spec:
  version: 0.1.0
  owner:
    team: security-team
  classification: internal
  risk:
    level: medium
  triggers:
    - type: manual
  inputs:
    - name: repository
      type: string
      required: true
  budget:
    maxCostUsd: 5
    maxSteps: 40
    maxDuration: 1h
  agents:
    - id: analyst
      model:
        provider: ollama
        name: qwen3
      instructions: |
        Complete the step with affected set to true or false and level set to
        low, medium, high or critical.
  workflow:
    - id: risk
      agent: analyst
      task: Decide whether ${{ inputs.repository }} is affected.
      outputs:
        - name: affected
        - name: level
    # Skipped with reason `condition` unless the repository is affected with a high risk;
    # the execution still succeeds.
    - id: fix
      type: workflow
      dependsOn:
        - risk
      when: 'steps.risk.outputs.affected == true && steps.risk.outputs.level in ["high", "critical"]'
      workflow:
        ref: cve-fixer
        version: ^0.5.0
        inputs:
          repository: ${{ inputs.repository }}
      outputs:
        - name: executionId
        - name: status
  permissions:
    default: deny
    tools:
      workflow.start:
        allow: true
```

## Checklist for authors

- Change `apiVersion` to `awp.agenticworkflowprotocol.org/v1alpha4`; nothing else is required.
- Compare outputs explicitly (`== true`, `in [...]`); a bare path is not a condition.
- Let a condition read only steps listed in `dependsOn` (directly or transitively).
- A step after a conditional step must not read its outputs unguarded; use `exists(...)` or `when`.
- Grant `workflow.start` in `permissions` for every workflow step, and check that the child
  workflow's own permissions and budget fit the task.
- Recompute `spec.integrity.digest`: it covers `apiVersion`.

## Checklist for runtime implementers

- Parse and check `when` before an execution starts (grammar, limits, dependencies, declared
  outputs); reject the manifest on a violation.
- Evaluate conditions in the runtime, never with a model, and without side effects; treat evaluation
  errors as `conditionError`, never as `false`.
- Implement the new skip reasons (`condition`, `dependencyFailed`), `missingOutput` and the event
  `step.skipped`.
- For workflow steps: authorise `workflow.start`, resolve `ref` and `version` in the same scope
  (`workflowNotFound`), validate inputs before the start (`inputInvalid`), count the child's usage
  against the parent budget, enforce `workflowCycle` and `workflowDepthExceeded`, and cancel waiting
  children with the parent.
- A runtime that does not support workflow steps rejects manifests with `type: workflow` (fail
  closed) and says so in its conformance statement.
- Run the conformance suite: `conformance/v1alpha4/index.json` lists every case with its expected
  result.

## Proposed on top of v1alpha4

The open AEPs that targeted `v1alpha3` now target `v1alpha4` (decision D24); none of them is applied
to its text, schema or conformance suite, and their fields are rejected by the checker until they
are. The full list with status and target versions is in the [specification overview](/specification/).
