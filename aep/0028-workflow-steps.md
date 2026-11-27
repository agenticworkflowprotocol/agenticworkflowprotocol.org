# AEP-0028: Workflow steps (`type: workflow`): start another workflow as a child execution

| | |
| --- | --- |
| **AEP** | 0028 |
| **Title** | Workflow steps (`type: workflow`): start another workflow as a child execution |
| **Authors** | AI agent on behalf of @agenticworkflowprotocol |
| **Shepherd** | Project lead (D23) |
| **Type** | Specification |
| **Status** | Accepted for `v1alpha4` (lead decision [D23](../docs/decisions.md#d23-conditional-steps-and-workflow-steps-start-v1alpha4), without the external review of D16) |
| **Reviewer roles needed** | runtime implementer, security reviewer (still welcome; see Decision) |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha4`; written into the draft as section 5.6.6 |
| **Profiles affected** | `core` (step type, action `workflow.start`), `audit` (fields of `workflow.started`) |
| **Created** | 2026-11-27 |
| **Discussion** | to be opened as a GitHub issue |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Add the step type `workflow`. A workflow step starts another `Workflow` of the same scope as a
child execution, with inputs computed from the parent, and by default waits for it. The child is an
execution of its own: pinned to its own manifests, with its own permissions, policies, approvals
and budget. Starting it is the well-known action `workflow.start`. The step provides two outputs,
`executionId` and `status`. Together with conditional steps (AEP-0001) a workflow can decide at run
time whether a second workflow runs.

## Motivation

A common pattern is *analyse, then act*: a risk analysis decides whether a CVE affects a
repository, and only then a fix workflow runs. The fix workflow already exists on its own, is
started manually as well, and has its own owner, permissions and approvals. `v1alpha3` offers two
ways to combine them, and both lose something:

- Copy the fix steps into the analysis workflow. The fix logic is duplicated, and the analysis
  workflow needs every permission of the fix (push, pull request), even when nothing is affected.
- Let the analysis end and start the fix through an external trigger (an event or a webhook). The
  link between the two executions is lost: the audit trail does not show which analysis started
  which fix, the parent cannot wait for the result, and budgets are not shared.

A workflow step keeps each workflow a separate, governed unit and still records the link.

## Goals and non-goals

- Goals: start a workflow of the same scope from a step; inputs from expressions; wait or fire
  and forget; the child keeps its own governance; the parent can permit or deny the start; the
  link is in the audit trail; bounded nesting.
- Non-goals: passing outputs of the child back to the parent (beyond `executionId` and `status`);
  `forEach` over workflow steps; calling workflows of another scope or another runtime; inline
  sub-workflows.

## Specification

The normative text is [spec/v1alpha4 section 5.6.6](../spec/v1alpha4/README.md#566-workflow-steps)
with the changes to sections 3.9, 5.5.3, 5.6.1, 5.6.4 and 10.4. In short:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `workflow.ref` | string | yes | `metadata.name` of a `Workflow` in the same scope; a DNS-1123 label. |
| `workflow.version` | string | no | SemVer range. Default: the version the runtime treats as current. |
| `workflow.inputs` | map of string | no | Input values of the child; expression-enabled (spec 3.9). |
| `workflow.wait` | boolean | no | Default `true`: wait for the child to end. |

1. Starting the child is the action `workflow.start`, subject to the parent's permissions,
   policies and approvals.
2. Inputs are validated against the child's declared inputs; a mismatch fails the step with reason
   `inputInvalid` before the child starts.
3. The child is a separate execution with its own execution identifier, pinned to its own
   manifests (spec 10.1), with its own permissions, policies, approvals and budget. The parent's
   permissions do not extend to it.
4. The child's usage (cost and duration) also counts against the parent's remaining budget; the
   runtime MUST stop the child when that budget is exhausted.
5. A cycle (a workflow that starts itself directly or transitively) fails the step with reason
   `workflowCycle`; a nesting depth above 5 fails it with reason `workflowDepthExceeded`.
6. Outputs: `executionId` and `status` (`succeeded`, `failed`, `cancelled`; `started` with
   `wait: false`). No other outputs may be declared. With `wait: true` the step fails with reason
   `childFailed` unless the child succeeded.
7. `forEach` is not allowed on a workflow step.
8. The child's `workflow.started` event carries `parentExecutionId` and `parentStepId`.

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: Workflow
metadata:
  name: cve-risk
spec:
  version: 0.1.0
  owner:
    team: security-team
  classification: internal
  inputs:
    - name: repository
      type: string
      required: true
  agents:
    - id: analyst
      model:
        provider: example-provider
        name: example-model
  workflow:
    - id: risk
      agent: analyst
      task: "Is ${{ inputs.repository }} affected?"
      outputs:
        - name: affected
    - id: fix
      type: workflow
      dependsOn: [risk]
      when: steps.risk.outputs.affected == true
      workflow:
        ref: cve-fixer
        inputs:
          repository: "${{ inputs.repository }}"
  permissions:
    default: deny
    tools:
      workflow.start:
        allow: true
```

A complete example: [spec/v1alpha4/examples/cve-risk-then-fix.yaml](../spec/v1alpha4/examples/cve-risk-then-fix.yaml).

## Schema changes

- `Step.type` gains `workflow`; new property `Step.workflow` (`WorkflowCall`: `ref`, `version`,
  `inputs`, `wait`, `extensions`). `type: workflow` requires `workflow` and forbids `agent`, `task`,
  `command`, `image`, `env`, `workingDir`, `approval`, `input` and `forEach`; the other types forbid
  `workflow`.
- Semantic rule `step.workflow-output`: a workflow step declares only `executionId` and `status`.
  `workflow.inputs` values follow the expression rules of spec 3.9.

## Conformance impact

- `core`: the step type, resolution, input validation, pinning, budget sharing, cycle and depth
  limits, the outputs and the reasons `workflowNotFound`, `inputInvalid`, `workflowCycle`,
  `workflowDepthExceeded`, `childFailed`.
- `audit`: `parentExecutionId` and `parentStepId` in `workflow.started`.
- Cases in `conformance/v1alpha4/`: `valid/5.6.6-workflow-step-wait.yaml`,
  `valid/5.6.6-workflow-step-no-wait.yaml`; `invalid/5.6.6-workflow-step-without-ref.yaml`
  (`schema.required`), `invalid/5.6.6-workflow-step-for-each.yaml` (`schema.not`),
  `invalid/5.6.6-workflow-step-output.yaml` (`step.workflow-output`),
  `invalid/5.6.6-workflow-ref-not-dns-label.yaml` (`schema.pattern`),
  `invalid/5.6.6-workflow-step-agent.yaml` (`schema.not`),
  `invalid/5.6.6-workflow-inputs-expression.yaml` (`schema.pattern`). Runtime tests once a runtime
  suite exists: cycle, depth, budget sharing, `childFailed`.

## Compatibility and migration

Additive: older manifests have no workflow steps. A runtime of an older version rejects
`type: workflow` (fail closed).

## Security considerations

- The child runs with its own permissions, not the parent's: a workflow step cannot widen what the
  parent may do, and a parent that may start a child does not gain the child's permissions.
- Starting a child is an action (`workflow.start`), so `default: deny` permissions and policies
  control which workflows may start others.
- Cycle detection, the depth limit and the shared budget bound how much work a chain of workflow
  steps can start.
- A condition over model output decides whether the child starts; the child's own approvals still
  apply to its actions.

## Privacy considerations

Input values passed to the child appear in its `workflow.started` event as values or digests per
the child's `payload` setting. A child with a lower classification than the parent's data should
not receive classified values; authors pass references instead.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Event or webhook triggers** (AEP-0024): the parent emits an event and the fix workflow starts on
  it. Loose coupling, but no linkage: the parent cannot wait for the result, the audit trail does
  not connect the executions, and budgets are not shared. Runtimes may still offer it; it is
  complementary.
- **Playbooks** ([AEP-0006](0006-playbook-kind.md)): reusable procedures that run inside the
  parent's governance. Suited for small shared procedures; a fix workflow that is also started on
  its own, with its own owner and approvals, is a workflow, not a playbook. AEP-0006 lists "workflow
  references a workflow" as an alternative and rejects it because the governance sections would
  conflict; this AEP avoids that conflict by running the child as a separate execution with its own
  governance instead of merging it into the parent.
- **Inline sub-workflows**: a nested step list in the parent. Duplicates logic and mixes
  governance; rejected.
- **Do nothing**: copy steps or chain workflows outside AWP.

## Implementation status

No implementation of this AEP exists at the time of writing.

## Open questions

1. Should the child's outputs be passed to the parent (typed handoffs, AEP-0003)?
2. Should `forEach` over workflow steps be allowed in a later version?
3. Should a workflow be able to restrict which workflows may start it?

## Decision

2026-11-27: accepted for `v1alpha4` by the project lead
([D23](../docs/decisions.md#d23-conditional-steps-and-workflow-steps-start-v1alpha4)), in the form
written into the `v1alpha4` draft. The external review that D16 requires was not held; reviews in
the roles above are still invited, and their findings are handled as errata of the `v1alpha4` draft.

## References

- [spec/v1alpha4 section 5.6.6](../spec/v1alpha4/README.md#566-workflow-steps)
- [AEP-0001](0001-conditional-steps.md) (conditional steps), [AEP-0006](0006-playbook-kind.md)
  (playbooks), [AEP-0024](0024-event-triggers.md) (event triggers)
