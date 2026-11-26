# AEP-0019: Kind `WorkflowRun` and status conditions

| | |
| --- | --- |
| **AEP** | 0019 |
| **Title** | Kind `WorkflowRun` and status conditions |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | Project lead (D22) |
| **Type** | Specification |
| **Status** | Accepted (lead decision [D22](../docs/decisions.md#d22-v1alpha3-becomes-the-current-draft), without the external review of D16) |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer (still welcome; see Decision) |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha3` |
| **Profiles affected** | `core` |
| **Created** | 2026-11-19 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Add the kind `WorkflowRun`, one execution of a workflow as an object: clients create it to start a
workflow (`workflowRef`, `inputs`, `environment`, `cancel`), and the runtime reports the execution
in its `status` (phase, pinned workflow, per-step status, usage, conditions). Define the shape of
`status.conditions` as Kubernetes `metav1.Condition` and the standard conditions `Valid` and
`Ready` for `Workflow`, `Agent` and `Policy`. The generated CustomResourceDefinitions type `status`
and show the conditions in `kubectl get`. The text is applied in
[spec/v1alpha3 sections 3.11 and 10.8](../spec/v1alpha3/README.md#108-kind-workflowrun).

## Motivation

`v1alpha3` reserves `status` but does not describe it, and AWP has no object for an execution.
A Kubernetes runtime proof of concept had to define its own run kind and its own conditions, and
because the printer columns of the CRDs come from this repository, `kubectl get workflows` could
not show whether a manifest was valid. Every runtime would otherwise invent a different run object
and different condition names, and tools such as dashboards, GitOps controllers or `kubectl wait`
could not work across runtimes. Runtimes without Kubernetes need the same shape for their APIs.

## Goals and non-goals

- Goals: a portable way to start an execution and read its state through an object store; one
  status shape for manifests; conditions that existing Kubernetes tools understand.
- Non-goals: replacing audit events (they remain the record), storing output values or logs in
  objects, scheduling objects (a `Schedule` kind may follow, see AEP-0016), a
  mandatory object store for runtimes without Kubernetes.

## Specification

Applied in [spec/v1alpha3 section 3.11](../spec/v1alpha3/README.md#311-status) and
[section 10.8](../spec/v1alpha3/README.md#108-kind-workflowrun), summarised:

1. **Conditions.** `status.conditions[]` with `type`, `status` (`True`, `False`, `Unknown`),
   `reason`, `message`, `lastTransitionTime`, `observedGeneration`, as `metav1.Condition`.
   `Valid`, `Ready`, `Accepted` and `Succeeded` are reserved; runtime-specific types carry a domain
   prefix.
2. **Manifest status.** `observedGeneration`, `digest`, condition `Valid` (with reasons such as
   `SchemaInvalid`, `ProfileUnsupported`, `DigestMismatch`) and condition `Ready`.
3. **`WorkflowRun`.** `metadata` with `name` or `generateName`; `spec.workflowRef` (`name`
   REQUIRED, `version` and `digest` as assertions), `spec.inputs`, `spec.environment`,
   `spec.cancel`, `spec.extensions`. No common spec fields, no digest, no signature.
4. **Starting.** A client-created run is a `manual` start with all its rules. The actor comes from
   an authenticated source (for example an admission webhook), never from the object; otherwise the
   request is rejected. One run starts at most one execution; later `spec` changes other than
   `cancel` have no effect.
5. **Runtime-created runs** for `schedule` and `event` triggers record the trigger in `status`.
6. **Rejection** sets `phase: rejected` and emits no `workflow.started`. **Cancellation** through
   `spec.cancel` or deletion (finalizer); audit events are never deleted with the object.
7. **Run status.** `executionId`, `phase`, `reason`, `message`, `actor`, `trigger`, `environment`,
   `workflow` (pinned name, version, digest), `startedAt`, `finishedAt`, `steps[]`, `usage`,
   `conditions` (`Accepted`, `Succeeded`). No secret values and no content of outputs.
8. **Step status** `waitingForInput` for input steps (section 5.8).
9. **Conformance statement.** Optional `executionObjects: true`.

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: WorkflowRun
metadata:
  generateName: vulnerability-fixer-
  namespace: security
spec:
  workflowRef:
    name: vulnerability-fixer
    version: 0.1.0
  inputs:
    cve: CVE-2026-12345
    repository: example-org/web-shop
```

```text
$ kubectl get workflows
NAME                  VERSION   OWNER           VALID   READY   AGE
vulnerability-fixer   0.1.0     security-team   True    True    3d
$ kubectl get workflowruns
NAME                        WORKFLOW              PHASE     STARTED   AGE
vulnerability-fixer-7k2xq   vulnerability-fixer   running   5m        5m
```

A complete run with status: [spec/v1alpha3/examples/vulnerability-fixer.run.yaml](../spec/v1alpha3/examples/vulnerability-fixer.run.yaml).

## Schema changes

New definitions `Timestamp`, `StatusCondition`, `ManifestStatus`, `WorkflowRunStatus`,
`RunMetadata`, `WorkflowRunSpec`, `WorkflowRun`; `kind` accepts `WorkflowRun`. `status` on all
kinds stays an open object for validators. New CRD `schema/crd/workflowruns.yaml`; all CRDs type
`status` with these definitions (unknown fields kept) and get printer columns.

## Conformance impact

- `core`: section 10.8 for runtimes that expose executions as objects; the status shapes are
  SHOULD.
- New `v1alpha3` cases: `valid/10.8-workflow-run`, `valid/10.8-workflow-run-with-status`,
  `invalid/10.8-workflow-run-without-workflow-ref`, `invalid/10.8-workflow-run-without-name`,
  `invalid/10.8-workflow-run-governance-field`, `invalid/10.8-workflow-ref-version-not-semver`;
  example `vulnerability-fixer.run.yaml`.
- Runtime tests, once a runtime suite exists: a run without a `manual` trigger is rejected; the
  actor is the authenticated creator; a version mismatch is rejected; `cancel` cancels; conditions
  follow the execution.

## Compatibility and migration

Additive. Runtimes with their own run kinds can keep them during alpha and map them to
`WorkflowRun`; tools should read `WorkflowRun`.

## Security considerations

- **Who may start.** Creating a `WorkflowRun` starts an execution. Object store access control
  (for example Kubernetes RBAC on `workflowruns`) decides who may create runs; AWP rules (manual
  trigger, policies, approvals) still apply on top.
- **Actor identity.** A field in the object could claim any identity, so the actor is never read
  from the object. On Kubernetes, a controller does not see who created an object; a validating
  admission webhook or the API server audit log has to provide it.
- **Approvals stay separate.** RBAC that allows creating runs or editing `status` does not allow
  approving; approvers are identities as in section 7.6.
- **No secrets in status.** Status is readable by everyone who can read the object.

## Privacy considerations

`spec.inputs` and `status.actor` may contain personal data and are readable with the object.
Classified inputs should be references. Runtimes may delete finished runs after a documented time;
audit retention is separate.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Status only on the `Workflow`** (last execution): loses history and concurrent executions.
- **Executions only in the audit log**: no portable way to start or watch an execution through an
  object store; every runtime builds its own API.
- **Own condition shape**: existing tools (`kubectl wait --for=condition=Ready`, GitOps health
  checks) understand `metav1.Condition` already.
- **Name `Execution`**: `WorkflowRun` follows the naming of existing run objects in workflow
  engines on Kubernetes and makes the relation to `Workflow` obvious.

## Implementation status

Schema, CRDs and conformance cases are in this repository. A Kubernetes runtime proof of concept
used its own run kind with a comparable shape and `Valid` and `Bound` conditions.

## Open questions

1. Should a client be able to set the trigger of a run (for example to replay an event), or are
   client-created runs always `manual`?
2. Should status carry output values for small outputs, or always only references?
3. Is a `Ready` condition useful for `Policy`, or only `Valid`?
4. Should the run hold a reference to the pinned manifest snapshot (for example a ConfigMap)?

## Decision

2026-11-25: accepted for `v1alpha3` in the form written into the draft, by the project lead
(decision [D22](../docs/decisions.md#d22-v1alpha3-becomes-the-current-draft)). The external review
that D16 requires was not held; reviews in the roles above are still invited, and their findings are
handled as errata of the `v1alpha3` draft or as new AEPs.

## References

- Kubernetes API conventions: conditions (`metav1.Condition`), `status` subresource.
- Runtime feedback: [docs/runtime-feedback.md](../docs/runtime-feedback.md), entry G07.
