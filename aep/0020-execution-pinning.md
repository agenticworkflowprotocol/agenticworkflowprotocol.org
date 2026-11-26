# AEP-0020: Pinning an execution to its manifests

| | |
| --- | --- |
| **AEP** | 0020 |
| **Title** | Pinning an execution to its manifests |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | Project lead (D22) |
| **Type** | Specification |
| **Status** | Accepted (lead decision [D22](../docs/decisions.md#d22-v1alpha3-becomes-the-current-draft), without the external review of D16) |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator with GitOps), security reviewer (still welcome; see Decision) |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha3` |
| **Profiles affected** | `core`, `audit` |
| **Created** | 2026-11-19 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

An execution uses the workflow, agent and policy manifests it resolved at its start until it ends.
Changes or deletions in the object store do not change a running execution; a runtime may cancel
it instead (`reason: manifestChanged`). Container images referenced by tag are resolved to digests
at start and pinned the same way, so authors may use tags and every execution is still traceable. `workflow.started` must carry the workflow digest, and a
`WorkflowRun` may assert the version or digest it expects. The text is applied in
[spec/v1alpha3 section 10.1](../spec/v1alpha3/README.md#101-execution-identity).

## Motivation

With manifests in an object store, a deployment tool can change a workflow at any time, for
example a GitOps controller syncing a new commit. Executions of agent workflows can take hours and
wait for approvals. Without a rule, one runtime finishes with the old version, another reads the
new step graph halfway through, a third applies a new policy to some steps and not to others. The
audit trail then names one version while the execution ran a mix. A Kubernetes runtime proof of
concept took a snapshot at start; the specification should require it.

## Goals and non-goals

- Goals: an execution has exactly one version of each manifest; the audit trail names it by
  digest; a client can make sure that the version it reviewed is the one that runs.
- Non-goals: version selection or rollouts (a run always uses the current manifest), storage
  format of snapshots, pinning of external resources (MCP server versions, models), which the
  reproducibility record already lists.

## Specification

Applied in [spec/v1alpha3 section 10.1](../spec/v1alpha3/README.md#101-execution-identity),
summarised:

1. At start the runtime resolves and validates the workflow, referenced `Agent` manifests and
   applicable `Policy` manifests, computes the workflow digest, and uses exactly these versions
   until the execution ends, including retries and waiting steps.
2. Changes or deletions MUST NOT change a running execution; the pinned manifests are kept or
   retrievable by digest until the end.
3. A runtime MAY cancel running executions when a pinned manifest changes (actor `system`,
   `workflow.cancelled` with `reason: manifestChanged`).
4. `workflow.started` MUST carry `workflow.digest`; the reproducibility record lists all pinned
   digests.
5. New executions, including the next schedule tick, use the current manifests.
6. A `WorkflowRun` with `workflowRef.version` or `workflowRef.digest` that does not match the
   current workflow is rejected (`versionMismatch`, `digestMismatch`).
7. **Images.** At start the runtime resolves every image reference (command steps, `stdio` MCP
   servers) to a digest, for multi-platform images the digest of the image index. All steps and
   attempts use it; a moved tag does not affect a running execution. The reproducibility record
   lists reference and resolved digest. Outside the security profile tags are allowed; under it,
   digests stay mandatory (spec 9.4), optionally after a tag (`tools:1.4@sha256:...`).
8. **No substitute environment.** A command step with `image` runs in that image. A runtime that
   cannot run container images rejects such a workflow instead of running the command elsewhere
   (spec 5.6.2).

## Examples

A workflow `nightly-triage@1.2.0` is running and waits for an approval. A GitOps sync applies
`1.3.0`, which removes a step and tightens the policy. The running execution continues with
`1.2.0` (or, if the runtime cancels on change, ends with `reason: manifestChanged`); the next tick
starts `1.3.0`. The audit events of the first execution name the digest of `1.2.0`.

## Schema changes

None for manifests. `WorkflowRun.spec.workflowRef.version` and `digest` and
`WorkflowRunStatus.workflow` come from AEP-0019.

## Conformance impact

- `core`: pinning. `audit`: `workflow.digest` in `workflow.started`, `reason: manifestChanged`.
- Runtime tests, once a runtime suite exists: change a manifest while an execution waits and
  check that the step graph, permissions and policies of the execution are unchanged; delete the
  manifest and check the same; a version assertion that does not match is rejected; move an
  image tag while an execution runs and check that retries use the digest resolved at start; a
  runtime without container support rejects a command step with `image`.

## Compatibility and migration

Runtimes that already snapshot at start comply. Runtimes that read manifests lazily have to
resolve them at start. Audit events of `workflow.started` without a digest are no longer
conformant in `v1alpha3`.

## Security considerations

- Pinning prevents a change in the object store from altering an execution that has already been
  approved or is waiting for approval: an approver approves the step of the version that runs.
- A tightened policy does not apply to running executions automatically. Operators who need that
  configure the runtime to cancel on change; mixing versions is never allowed, because it makes
  the audit trail wrong.
- Version assertions let a client or a pipeline make sure that the reviewed version runs.
- Resolving tags at start does not make tags as safe as digests: the reviewed manifest names a
  tag, and what it pointed to at review time is not recorded. It does make every execution
  traceable and consistent. Organisations that need the reviewed image to be the executed image
  use the security profile, which requires digests.
- Running a command outside its image would execute untrusted tooling in an unreviewed
  environment and break the network and filesystem assumptions of the step, so a runtime without
  containers must refuse instead.

## Privacy considerations

Pinned manifests are kept at least until the execution ends; they contain no execution data.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Pick up changes between steps**: makes the step graph and the policies of one execution
  inconsistent and the audit trail ambiguous.
- **Always cancel on change**: safe, but cancels long executions on every unrelated edit; allowed
  as runtime configuration.
- **Select versions in `WorkflowRun`**: requires keeping old versions in the object store; the
  assertion covers the review case without that.
- **Require digests for all images**: fully reproducible, but forces authors and packaging tools
  (Helm charts, Kustomize) to maintain digests, and is often done wrong for multi-platform images.
  Resolving at start gives traceability without that burden; the security profile keeps the
  strict rule.

## Implementation status

Specification text only. A Kubernetes runtime proof of concept takes a snapshot of the manifest at
start.

## Open questions

1. Should policies be pinned, or should a runtime always evaluate the current policies (with the
   risk of an inconsistent execution)?
2. Should the runtime record the pinned agent and policy digests in `workflow.started` as well, not
   only in the reproducibility record?

## Decision

2026-11-25: accepted for `v1alpha3` in the form written into the draft, by the project lead
(decision [D22](../docs/decisions.md#d22-v1alpha3-becomes-the-current-draft)). The external review
that D16 requires was not held; reviews in the roles above are still invited, and their findings are
handled as errata of the `v1alpha3` draft or as new AEPs.

## References

- Runtime feedback: [docs/runtime-feedback.md](../docs/runtime-feedback.md), entries G08 and G40.
