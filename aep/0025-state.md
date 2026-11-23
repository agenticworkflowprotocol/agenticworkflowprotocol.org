# AEP-0025: State across executions

| | |
| --- | --- |
| **AEP** | 0025 |
| **Title** | State across executions: declared, classified, shared and untrusted |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer, privacy reviewer |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha3` |
| **Profiles affected** | `core`, `governance`, `audit` |
| **Created** | 2026-11-22 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Workflows keep data between executions ("already reported", user preferences), but AWP has no
state: a runtime provides it invisibly (a volume of its binding), without data class, retention
or access rules. This AEP declares state in the manifest as named stores with classification,
retention and an access mode per workflow, lets several workflows of one owner share a store with
rules for concurrent writers, and makes state untrusted input for models. It answers runtime
feedback G03, G53 and G58.

## Motivation

- **Invisible state (G03).** A proof-of-concept workflow remembers which events it already
  reported in a file on a volume of its runtime binding. Reviewers cannot see that the workflow
  stores data, which class it has or how long it is kept.
- **Shared state (G53).** A daily workflow writes what it found; a chat workflow of the same owner
  reads it and writes preferences that the daily workflow reads. Two workflows need the same store
  with different rights. Derived from the proof of concept, not observed as a conflict: a
  preference written during a daily run takes effect a day later, and two chat runs can write the
  same file at once.
- **Memory poisoning (G58).** State written by one execution is read as data by the next. A chat
  message or a web page that ends up in state becomes a persistent instruction, seen in the chat
  workflow of the proof of concept. Spec 12 lists tool results and remote agent messages as
  untrusted input, not state.

## Goals and non-goals

- Goals: state visible in review; classification and retention; shared stores with access modes;
  defined behaviour with concurrent writers; state as untrusted input.
- Non-goals: a storage technology; queries or schemas inside the store; state inside one
  execution (step outputs, AEP-0018).

## Specification

### New section 5.9: state

`spec.state` declares stores that survive executions.

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `name` | string | yes | Store name, unique per owner (`spec.owner`) and namespace. |
| `access` | string | no | `read` or `readWrite` (default). |
| `classification` | string | no | Data class of the content. Default: `spec.classification`. |
| `retention` | duration | no | How long content is kept after its last write. Default: runtime-defined, stated in the conformance statement. |
| `maxSize` | string | no | Upper bound (for example `64Mi`); the runtime MUST reject writes beyond it. |

- A store is provided to command steps as a directory (`$AWP_STATE_DIR/<name>`) and to agent steps
  only through tools the manifest grants. The runtime MUST NOT expose stores that are not
  declared.
- **Sharing.** Workflows with the same `spec.owner` in the same namespace that declare a store of
  the same `name` share it. If their `classification` values differ, the strictest applies to
  every reader. A runtime MUST reject a declaration that would give a workflow of another owner
  access.
- **Concurrent writers.** The runtime MUST make each write of a file or key atomic. It MUST state
  in its conformance statement whether concurrent executions writing the same store are
  serialised or last-writer-wins. With `readWrite`, a step MUST NOT see a partially written value.
- **Absent store.** A store that does not exist yet is empty; the first `readWrite` execution
  creates it.
- **Audit.** `workflow.started` lists the stores and their access modes. Writes SHOULD be
  recorded at metadata level (store, key or path, size).

### Change to section 12 (security considerations)

Extend "Prompt injection": tool results, remote agent messages **and content read from state** are
untrusted input. Content written to state by an earlier execution MUST be treated like a tool
result of unknown origin; runtimes SHOULD mark its origin when passing it to a model (see runtime
feedback G11).

### Change to section 7.2 (data classification)

Reading a store counts as an operation on data of the store's `classification`.

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: Workflow
metadata:
  name: daily-digest
spec:
  version: 0.1.0
  owner:
    team: example-team
  classification: internal
  state:
    - name: seen-items
      retention: 180d
      maxSize: 64Mi
    - name: preferences
      access: read
  workflow:
    - id: diff
      type: command
      image: registry.example.com/tools:1.0.0
      command: python3 /opt/diff.py
```

A second workflow `chat-assistant` of the same owner declares `preferences` with `readWrite` and
`seen-items` with `read`.

## Schema changes

- `spec.state` array with the fields above.
- Semantic rule `state.duplicate-name` within one manifest.

## Conformance impact

- `core`: declaration, exposure only of declared stores, atomic writes, conformance statement.
- `governance`: classification of shared stores.
- `audit`: stores in `workflow.started`, write records.
- Valid: `5.9-state-shared.yaml`. Invalid: `5.9-state-duplicate-name.yaml`,
  `5.9-state-invalid-access.yaml`.

## Compatibility and migration

Additive. Runtimes that provide state through their own binding declare it in the manifest instead;
until then, such state is outside the reviewed manifest.

## Security considerations

Declared state makes persistence reviewable and limits sharing to one owner. Treating state as
untrusted closes the path from one injected message to a permanent instruction. Atomic writes
prevent torn values that a later step could misread.

## Privacy considerations

State may hold personal data (preferences, conversation summaries). `retention` and
`classification` let operators apply deletion and access rules; runtimes SHOULD support deleting a
store on request.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Keep state in the runtime binding.** Rejected: invisible to review (G03).
- **Share across owners by reference.** Rejected for now: needs an access model between owners.
- **A key-value API instead of directories.** Left open: directories match the step interface of
  AEP-0018; a key-value form can be added.

## Implementation status

A proof-of-concept Kubernetes runtime provides one volume per workflow through its binding and
mounts it at `/awp/state`. Sharing between workflows and the conflict scenario are derived, not
implemented.

Interactive sessions of the same runtime raise two more kinds of state:

- **Workspace across pause and resume.** When a session pauses, the engine process ends; the
  repositories, the engine's history and configuration stay on a volume and are used again on
  resume. A running turn is cancelled. This is state of one execution rather than across
  executions, but it has the same questions: classification (it contains the repository and every
  prompt), retention after the session ends, and who may read it (runtime feedback G62, G85).
- **Shared workspace of several steps (concept).** Steps that plan, implement and review the same
  change need one workspace, as Tekton workspaces provide. Today each engine step gets its own
  empty directory. A declared store with an access mode per step would cover it, with the trust
  boundary that a later step reads what an earlier agent wrote (runtime feedback G87, with G58).

## Open questions

1. Should stores be their own kind (`State`) instead of a manifest field, so that ownership and
   retention live in one place?
2. Is one owner per namespace the right sharing boundary?
3. Should agent steps get a built-in state tool, or only command steps a directory?

## Decision

Not decided. Number and scope assigned by the maintainer on 2026-11-22.

## References

- Runtime feedback G03, G11, G53, G58 ([runtime-feedback.md](../docs/runtime-feedback.md)).
- AEP-0018 (step outputs); spec `v1alpha3` sections 7.2, 12.
