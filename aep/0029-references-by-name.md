# AEP-0029: References by name, optional pins and recorded resolution

| | |
| --- | --- |
| **AEP** | 0029 |
| **Title** | References by name, optional pins and recorded resolution |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha4` |
| **Profiles affected** | `core` (reference form and resolution), `security` (pins), `audit` (recorded resolution) |
| **Created** | 2026-11-27 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |
| **Amends** | [AEP-0028](0028-workflow-steps.md) (`workflow.version`, new `workflow.digest`) |

## Summary

Give every reference in a manifest one form, `{name, version?, digest?}`. The name resolves the
target in the scope of the manifest; `version` and `digest` are optional **assertions** that the
runtime verifies, never selectors. The runtime records what it resolved (name, version, digest) in
`workflow.started`, the reproducibility record and the `WorkflowRun` status. Pinning becomes a
matter of profile and policy instead of format: under the `security` profile, references to
behaviour that authors write (`Agent`, `Prompt`, child `Workflow`, `Playbook`) MUST carry a
version or a digest. Workflow steps get a `digest` and an exact `version` assertion, so that a
reviewer of a parent workflow can see which child it approves (runtime feedback G91). Objects that
the platform owns (models, MCP servers, organisation policies) are one object per thing, referenced
by name or attached by the platform with `targetRefs`, never collected in one list kind.

## Motivation

The draft references other manifests in five places, with three different rules:

| Reference | `v1alpha4` today |
| --- | --- |
| `agents[].ref` (5.4.2) | `name`, `version` REQUIRED and exact, `digest` OPTIONAL |
| `promptRef` (5.4.1) | `name`, `version` REQUIRED, `digest` OPTIONAL |
| `policies.include[]` (8.1) | `name`, exact `version` REQUIRED, `digest` OPTIONAL |
| `workflow` of a workflow step (5.6.6) | `ref` (name), `version` a SemVer **range**, default "the version the runtime treats as current", no `digest` |
| `WorkflowRun.spec.workflowRef` (10.8) | `name` REQUIRED; `version` and `digest` OPTIONAL **assertions, not selectors** |

Three problems follow.

1. **An object store holds one object per name.** In Kubernetes, and in any store with the same
   semantics (spec 3.10), `metadata.name` identifies exactly one object in a scope. There is no
   `summarizer` 1.2.0 next to `summarizer` 1.3.0. A required exact `version` reads like a selector
   but can only ever match the one object that exists. `WorkflowRun` already uses the correct
   reading (assertions); the other references do not say so, and runtimes guess.
2. **Every change fans out.** Because `version` is required, every change to a shared `Agent`,
   `Prompt` or `Policy` forces a change in every workflow that references it, even when the
   referencing team does not want to pin. For objects that the platform owns, such as an
   organisation policy, a model entry or an MCP server definition, this turns one change into a pull
   request per repository. Teams then avoid shared objects or copy them, which is worse for review.
3. **Workflow steps are the opposite extreme.** `workflow.version` is a range with a default of
   "current" and no digest. A new minor release of a child workflow changes what an approved parent
   does without any change to the parent's digest, and the parent's record shows only the child's
   execution identifier. This reopens, one level down, the gap that execution pinning
   ([AEP-0020](0020-execution-pinning.md), G08) closed for the workflow itself.

Where the pin belongs is a question of who governs the target: a reviewer approving a workflow
wants exactly the agent behaviour they read; a platform team publishing a model price or a
tightened policy wants it to apply without asking every author. One reference form with optional
pins, a profile rule for behaviour, and recorded resolution serve both.

## Goals and non-goals

- Goals: one reference form for all references; resolution by name with defined semantics in an
  object store; optional version and digest assertions; recorded resolution for every execution;
  mandatory pins for author-written behaviour under the `security` profile; a digest assertion and
  an auditable child digest for workflow steps; a rule for objects the platform owns.
- Non-goals: references across scopes (namespaces, runtime feedback G26, K); version ranges as
  general selectors; registries and their APIs; signatures of referenced manifests (spec 9.2);
  changing `spec.version` of manifests, which stays a required SemVer version (spec 3.5).

## Prior art

- **Kubernetes object references.** References such as `configMapRef`, `secretKeyRef` or the
  Gateway API `parentRefs` and `targetRefs` name an object in a scope; the API server returns the
  one object with that name. Versions are not part of the reference.
- **Image references.** Container images are referenced by tag, by digest or by both
  (`name:tag@sha256:...`); the digest decides. AWP already applies this to images (spec 9.4,
  10.1): tags are allowed outside the security profile and resolved and recorded at start.
- **kagent**, a CNCF project, pins exactly wherever it fixes content: images by `@sha256`, Git
  sources by a full commit identifier, object storage by version identifier. An agent is compiled
  into an immutable revision, and every session is pinned to the revision it started with. The
  configuration objects that the revision is built from are referenced by name.

## Specification

### Changes to section 3.10 (object stores)

Add:

- **References.** A reference ([section 3.13](#new-section-313-references)) resolves by name
  within the scope of the referencing manifest. `version` and `digest` in a reference are
  assertions that the runtime verifies after resolution; they never select one of several objects.
  Several versions of a manifest that must be available side by side need distinct names, for
  example `summarizer-v1` and `summarizer-v2`.

### New section 3.13 References

A **reference** names another manifest. Every reference in this document has this form:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `name` | string | yes | `metadata.name` of the target in the same scope; a DNS-1123 label (section 3.4). |
| `version` | string | no | Exact SemVer version (section 3.5) that the target's `spec.version` MUST equal. |
| `digest` | string | no | Digest (sections 3.8, 9.1) that the target MUST have. |

Rules:

1. **Resolution.** The runtime resolves `name` in the scope of the referencing manifest. In an
   object store (section 3.10) this is the one object with that name. In a store that keeps several
   versions under one name (for example a registry), the runtime MAY use `version` to choose one;
   without `version` it uses the version the store returns for the name alone, and it MUST document
   how that version is determined.
2. **Assertions.** If `version` is present and the resolved target's `spec.version` differs, the
   runtime MUST reject with reason `versionMismatch`. If `digest` is present and the resolved
   target's digest differs, it MUST reject with reason `digestMismatch`. When a manifest cannot be
   resolved, the runtime MUST reject with reason `referenceNotFound` (for workflow steps
   `workflowNotFound`, section 5.6.6). "Reject" means: an execution does not start (section 10.1);
   a workflow step fails before the child starts (section 5.6.6).
3. **Recording.** When an execution starts, the runtime resolves every reference of the workflow
   and of the manifests it references, and pins the result (section 10.1). `workflow.started`
   carries `data.references`: one entry per resolved reference with `kind`, `name`, `version` and
   `digest` of the resolved target and `path`, the location of the reference in the manifest (for
   example `spec.agents[1].ref`). Under `payload: metadata` these entries are allowed: they contain
   no content. The reproducibility record (section 10.7) and the `WorkflowRun` status (section
   10.8, `status.references`) list the same entries.
4. **Pins under the security profile.** A runtime implementing the `security` profile MUST reject a
   manifest in which a reference to an `Agent`, a `Prompt`, a `Playbook` or a child `Workflow`
   carries neither `version` nor `digest` (reason `referenceNotPinned`). It SHOULD require
   `digest` (section 9.4 already recommends digests). A runtime or platform configuration MAY
   require `version` or `digest` on further references; it states this in its conformance
   statement.
5. **Objects owned by the platform.** Models ([AEP-0030](0030-model-kind.md)), MCP server
   definitions ([AEP-0031](0031-mcp-server-kind.md)) and organisation policies are defined as one
   object per model, server or policy, never as entries of one list object. A workflow references
   them by name; a platform attaches policies to workflows with `targetRefs`
   ([AEP-0021 B5](0021-extension-model.md#b5-policy-attachment)). Such references need no pin
   under the `security` profile: the platform, not the author, governs their content, and rule 3
   records what applied.

### Changes to sections 5.4.1, 5.4.2 and 8.1

- `promptRef` (5.4.1) and `agents[].ref` (5.4.2) are references (section 3.13). `version` changes
  from REQUIRED to OPTIONAL. The sentence "How a runtime resolves a reference ... is
  implementation-defined" in 5.4.2 is replaced by a link to section 3.13.
- `policies.include[]` (8.1): each entry is a reference; `version` changes from REQUIRED to
  OPTIONAL.

### Changes to section 5.6.6 (workflow steps, amends AEP-0028)

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `ref` | string | yes | Unchanged: `metadata.name` of a `Workflow` in the same scope. |
| `version` | string | no | Assertion on the child's `spec.version`: an exact SemVer version, or a SemVer range that the resolved version MUST satisfy. Without `version`, no assertion. |
| `digest` | string | no | **New.** Digest the resolved child workflow MUST have. |

- Rule 2 (resolution) becomes: the runtime resolves `ref` as a reference (section 3.13) and
  verifies `version` and `digest`; a mismatch fails the step with reason `versionMismatch` or
  `digestMismatch` before the child starts. "More than one candidate version cannot be ordered" no
  longer applies.
- Under the `security` profile, `version` MUST be an exact version or `digest` MUST be present
  (section 3.13 rule 4); a range alone is not a pin (reason `referenceNotPinned`).
- New rule 12: the runtime records the resolved child (`name`, `version`, `digest`) together with
  the child's `executionId` at the parent step: in `data.child` of the `tool.executed` event of the
  action `workflow.start` (section 10.4), in the parent's reproducibility record (`children`) and in
  `WorkflowRun.status.steps[].child`. The outputs of the step stay `executionId` and `status`.

### Changes to section 9.4

Replace "and references SHOULD carry digests" by a link to section 3.13 rule 4.

### Proposed decision

The project lead is asked to record this rule in the decision log when the AEP is accepted:

> References resolve by name within the scope. `version` and `digest` are optional assertions that
> the runtime verifies; the runtime records what it resolved for every execution. Whether a
> reference must be pinned is a matter of profile and policy, not of the format: under the
> `security` profile, references to behaviour that authors write (`Agent`, `Prompt`, `Playbook`,
> child `Workflow`) carry a version or a digest. Objects owned by the platform (models, MCP servers,
> organisation policies) are one object per thing, referenced by name or attached with
> `targetRefs`, and are not collected in list kinds.

This rule touches D10 (model catalog prices in an own kind referenced by digest): with
AEP-0030, prices live in one `Model` object per model, referenced by name and recorded, instead of
a catalog referenced by a required digest.

## Examples

A workflow that references a shared agent by name, pins its prompt by digest and starts a child
workflow with an exact version and a digest:

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: Workflow
metadata:
  name: cve-risk
spec:
  version: 0.2.0
  owner:
    team: security-team
  classification: internal
  inputs:
    - name: repository
      type: string
      required: true
  agents:
    - id: analyst
      ref:
        name: cve-analyst
    - id: writer
      model:
        provider: example-provider
        name: example-model
      promptRef:
        name: advisory-summary
        digest: sha256:4f1c9a0b2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a
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
        version: 0.5.2
        digest: sha256:9b2f6c1e4d8a0b7c3e5f1a2d4c6b8e0f1a3c5e7b9d0f2a4c6e8b0d1f3a5c7e9b
        inputs:
          repository: "${{ inputs.repository }}"
  permissions:
    default: deny
    tools:
      workflow.start:
        allow: true
```

Outside the `security` profile this manifest is valid; under it, `agents[0].ref` needs a `version`
or a `digest`.

The resolution recorded in `workflow.started` (excerpt):

```yaml
type: workflow.started
workflow:
  name: cve-risk
  version: 0.2.0
  digest: sha256:1111111111111111111111111111111111111111111111111111111111111111
data:
  references:
    - path: spec.agents[0].ref
      kind: Agent
      name: cve-analyst
      version: 1.4.0
      digest: sha256:2222222222222222222222222222222222222222222222222222222222222222
    - path: spec.agents[1].promptRef
      kind: Prompt
      name: advisory-summary
      version: 2.0.1
      digest: sha256:4f1c9a0b2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a
```

The child workflow is resolved when the step runs, so it appears in the event of its start, not in
`workflow.started`:

```yaml
type: tool.executed
stepId: fix
data:
  action: workflow.start
  outcome: success
  durationMs: 412
  child:
    executionId: awp-exec-01JD4M7P2Q8R9S0T1V2W3X4Y5Z
    name: cve-fixer
    version: 0.5.2
    digest: sha256:9b2f6c1e4d8a0b7c3e5f1a2d4c6b8e0f1a3c5e7b9d0f2a4c6e8b0d1f3a5c7e9b
```

## Schema changes

- New definition `Reference` (`name` REQUIRED, `version` with the exact SemVer pattern, `digest`
  with the digest pattern, `extensions`); `AgentRef.ref`, `PromptRef` and the entries of
  `policies.include` use it, so `version` is no longer required there.
- `WorkflowCall` gains `digest`; `version` keeps its current pattern (exact version or range).
- `WorkflowRunStatus` gains `references` (list of `kind`, `name`, `version`, `digest`, `path`) and
  `steps[].child` (`executionId`, `name`, `version`, `digest`).
- New semantic rule `security.reference-pin`, checked when the validator runs with the `security`
  profile.

## Conformance impact

- `core`: resolution by name; the reasons `versionMismatch`, `digestMismatch` and
  `referenceNotFound`; `workflow.digest` on workflow steps.
- `security`: `referenceNotPinned` for unpinned references to `Agent`, `Prompt`, `Playbook` and
  child `Workflow`; a range alone is not a pin.
- `audit`: `data.references` in `workflow.started`, `data.child` of workflow steps, the record
  fields `references` and `children`.
- New cases in `conformance/v1alpha4/`: `valid/3.13-agent-ref-by-name.yaml`,
  `valid/3.13-prompt-ref-digest-only.yaml`, `valid/5.6.6-workflow-step-digest.yaml`;
  `invalid/3.13-reference-digest-pattern.yaml` (`schema.pattern`),
  `invalid/3.13-security-agent-ref-unpinned.yaml` (`security.reference-pin`, run with
  `--profiles security`), `invalid/5.6.6-security-workflow-range-only.yaml`
  (`security.reference-pin`). Runtime tests once a runtime suite exists: mismatch reasons,
  recorded references, child digest at the parent step.

## Compatibility and migration

- Making `version` optional in `agents[].ref`, `promptRef` and `policies.include[]` is additive:
  every manifest that is valid today stays valid and means the same, since an exact version that
  is present is still verified.
- Adding `workflow.digest` is additive. Ranges in `workflow.version` stay valid; their meaning
  changes from selector to assertion. In an object store the result is the same, because there is
  only one candidate per name; in a store with several versions per name, a runtime that chose the
  highest version satisfying the range now uses the version the store returns for the name and
  rejects it if it does not satisfy the range. This is a change to the accepted AEP-0028 and needs
  the same review as any change to the draft (aep-process section 4).
- Under the `security` profile, manifests with unpinned references to agents, prompts or child
  workflows, which the draft accepts with a SHOULD, are rejected. Authors add `version` or
  `digest`; the runtime's recorded `references` show the values to pin.
- `awp-check.mjs migrate` needs no change: all older manifests carry `version` in references.

## Security considerations

- Pins remain available for everything and are mandatory under `security` for behaviour that
  authors write. Recorded resolution makes every unpinned reference traceable after the fact, as
  image tags already are (spec 10.1).
- An unpinned reference to a platform-owned object lets the platform change what applies without a
  change to the workflow, for example a tightened policy or a revoked model approval. This is
  intended: the platform governs these objects. A platform that loosens such an object widens what
  workflows may do without their review; platform ceilings (AEP-0023) and the review of the
  platform object itself are the controls, and the recorded `references` show the change.
- A digest assertion on a workflow step closes the gap of G91: a parent pinned by digest now
  approves exactly one child.

## Privacy considerations

The recorded references contain names, versions and digests only, no content.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Keep `version` required everywhere.** Keeps review strict but keeps the fan-out of problem 2
  and still leaves the selector reading of problem 1.
- **Drop ranges from workflow steps** and allow only an exact version. Consistent with the other
  references, but invalidates manifests written against the accepted AEP-0028, and an exact
  version is already required under `security` by this AEP.
- **Version in the name only** (no `version` field). Simple in an object store, but loses the
  readable assertion and the selection in registries.
- **A list kind per object type** (catalogs). One object for many models or servers makes every
  addition a change of the shared object, gives every change a new digest for everyone, and allows
  neither ownership nor access control per entry. Rejected for platform-owned objects.

## Implementation status

No implementation of this AEP exists at the time of writing. `WorkflowRun.spec.workflowRef`
(spec 10.8) already uses assertions instead of selectors.

## Open questions

1. Should `referenceNotFound` be a reason of its own, or should each reference keep a specific one
   (`workflowNotFound`, `agentNotFound`)?
2. Should a range in `workflow.version` remain allowed at all once AEP-0029 is accepted, or be
   deprecated in the next API version?
3. Should the platform be able to require pins on platform-owned references for selected
   workflows (for example production), and where would that rule live: ceiling or policy?

## Decision

None yet.

## References

- Spec `v1alpha4` sections 3.10, 5.4.1, 5.4.2, 5.6.6, 8.1, 9.4, 10.1, 10.7, 10.8
- [AEP-0020](0020-execution-pinning.md) (execution pinning), [AEP-0021](0021-extension-model.md)
  (B5 policy attachment), [AEP-0028](0028-workflow-steps.md) (workflow steps),
  [AEP-0030](0030-model-kind.md) (kind `Model`), [AEP-0031](0031-mcp-server-kind.md) (kind
  `McpServer`)
- [Runtime feedback](../docs/runtime-feedback.md) G08, G91
