# Review guide for the `v1alpha3` draft

| | |
| --- | --- |
| **Status** | Informative. Explains pull request #16 and the decisions behind it; it decides nothing. Merged as the `v1alpha3` draft on top of `v1alpha2` by decision [D20](decisions.md#d20-the-kubernetes-resource-model-draft-becomes-v1alpha3); the pull request called it `v1alpha2`. Since [D22](decisions.md#d22-v1alpha3-becomes-the-current-draft) `v1alpha3` is the current draft and AEPs 0015 to 0020 are accepted; D22 answers the questions of section 5 except the last one. |
| **Audience** | Maintainers and reviewers of the `v1alpha3` draft |
| **Related** | [decision log](decisions.md), [runtime feedback](runtime-feedback.md), [spec v1alpha3](../spec/v1alpha3/README.md), AEPs 0015 to 0021 |

The pull request is large (about 26,000 lines), but most of it is generated or copied. This guide
says what to read, in which order, why each change was made, which alternatives were rejected, and
which questions only the project lead can answer.

## Contents

1. [The requirement behind it](#1-the-requirement-behind-it)
2. [What to read and what to skip](#2-what-to-read-and-what-to-skip)
3. [Changes and their reasons](#3-changes-and-their-reasons)
4. [Where this touches existing decisions](#4-where-this-touches-existing-decisions)
5. [Decisions needed from the project lead](#5-decisions-needed-from-the-project-lead)
6. [How it was tested](#6-how-it-was-tested)

## 1. The requirement behind it

AWP manifests should be usable **as the data model of Kubernetes custom resources** and, unchanged,
**by runtimes without Kubernetes** (SaaS, CLI, CI). `v1alpha1` looks like a Kubernetes object but
cannot be stored as one: the API server drops unknown `metadata` fields (`version`, `owner`,
`classification`, ...), so the stored object loses its governance fields and its digest. Every
Kubernetes implementation would have to wrap the AWP document in its own resource.

A Kubernetes runtime proof of concept then built an operator, a step runner and one real workflow
against the draft. Its findings (G01 to G61 in [runtime-feedback.md](runtime-feedback.md)) went
into AEPs, as decision D18 asks. The runtime is not named (D17).

## 2. What to read and what to skip

| Area | Size | How to review |
| --- | --- | --- |
| AEPs 0015 to 0021 (`aep/`) | ~1,300 lines | **Read first.** Each states motivation, alternatives and open questions. |
| `spec/v1alpha3/README.md` | 2,117 lines, but a copy of `v1alpha1` | Read only the diff: `git diff --no-index spec/v1alpha1/README.md spec/v1alpha3/README.md` (~650 added lines). New sections: 3.10, 3.11, 5.6.4, 5.8, 10.8. |
| `docs/runtime-feedback.md` | ~150 lines | The gap list and the open questions (section 8). |
| `conformance/*.mjs` | ~400 lines | Reference checker: version selection, `migrate`, CRD generator, new semantic rules. |
| `schema/awp.v1alpha3.json` | 3,632 lines | Skim. Mostly `v1alpha1` with the moves of AEP-0015; generated in part. |
| `schema/crd/*.yaml` | 3,142 lines | **Generated** by `conformance/crd.mjs`; do not review by hand. |
| `conformance/v1alpha3/` | 207 files, 14,000 lines | Test cases. Most are `v1alpha1` cases migrated mechanically; new ones carry the section number in their name (`5.6.4-...`, `10.8-...`). |
| `v1alpha1` changes | ~30 lines | One schema fix (approval steps, spec 5.6.1) and an editorial note on schedule inputs (5.2). |

Commits are ordered by topic and can be reviewed one by one (`git log origin/main..`).

## 3. Changes and their reasons

### 3.1 Kubernetes resource model (AEP-0015)

| Change | Reason | Rejected alternative |
| --- | --- | --- |
| Governance fields move from `metadata` to `spec` | `metadata` is Kubernetes `ObjectMeta`; other fields are dropped or rejected by the API server | Keep them in `metadata.annotations`: strings only, no schema, and labels or annotations must never drive governance |
| `metadata` holds only `name`, `namespace`, `labels`, `annotations`; store fields are accepted and ignored | Objects read back from an API server carry `uid`, `managedFields`, ...; they must still validate | Reject them: every object read from a cluster would fail |
| Digest over `apiVersion`, `kind`, `metadata.name`, `spec` | Namespace, labels and annotations change during deployment (GitOps, Kustomize); the digest must survive that | Digest over the whole document: breaks on every deployment |
| `status` reserved, ignored by validators, not in the digest | Runtimes report state there; it is not governed content | Status in a separate object only: unusual on Kubernetes and loses `kubectl wait` |
| `owner` and policy conditions get one type each | CRDs need a structural schema (one type per field) | Unions: not expressible as a CRD |
| `x-` fields move into `extensions` objects | Structural schemas forbid free keys next to defined fields. **Interim step**, see AEP-0021 | Free `x-` keys everywhere: not expressible as a CRD |
| CRDs keep unknown fields (`x-kubernetes-preserve-unknown-fields`) | Otherwise the API server prunes a misplaced governance field before the runtime can reject it (fail closed) | Pruning: loses fail closed. AEP-0021 proposes pruning plus CEL plus full runtime validation instead |
| `awp-check.mjs migrate` | `v1alpha1` files convert mechanically | Manual migration |

### 3.2 Schedule semantics (AEP-0016)

`concurrencyPolicy` (`allow`, `forbid`, `replace`) and `startingDeadline`, modelled on Kubernetes
CronJobs. Default `forbid`, because overlapping agent executions cost money and can act twice.
Missed ticks are skipped and logged (`trigger.skipped`) rather than replayed in a burst after an
outage.

### 3.3 Human input (AEP-0017)

Input steps and `humanInput` let a workflow or an agent ask a named person for an answer. Answers
**never count as approvals**: approvals stay a separate, auditable governance primitive (spec 7.6),
so a free-text answer cannot be used to bypass one. New `interaction` profile, because not every
runtime has a human channel.

### 3.4 Step outputs (AEP-0018)

The largest portability gap from the runtime (G01): `outputs` declared names, but nothing said how
a value gets there. Command steps write one file per output into `$AWP_OUTPUTS`; agent steps end
with a built-in `complete_step` tool. Minimum sizes (256 KiB per output, 1 MiB per step) fit inside
Kubernetes object limits. Outputs of failed attempts are discarded. The prefix `AWP_` is reserved.
Rejected: JSON on standard output (mixes logs and data), the agent's last message as output (one
value only, format not reliable).

### 3.5 `WorkflowRun` and status conditions (AEP-0019)

A `WorkflowRun` object starts one execution and reports it in `status`, so that tools (dashboards,
GitOps health checks, `kubectl wait`) work across runtimes. Conditions use the Kubernetes condition
shape (`Valid`, `Ready` on manifests, `Accepted`, `Succeeded` on runs), and the CRDs get printer
columns. The **actor is never read from the object**: it comes from an authenticated source, because
a field could claim any identity. G39 asks to define conditions as plain JSON with Kubernetes as one
mapping; not applied yet.

### 3.6 Execution pinning (AEP-0020)

An execution keeps the workflow, agent and policy versions it started with. Otherwise a GitOps sync
during a long execution (waiting for approval, for example) would change the step graph or the
policies halfway, and the audit trail would name a version that never ran. A runtime may cancel
instead (`manifestChanged`), never mix. `workflow.digest` becomes REQUIRED in `workflow.started`.
Container images referenced by tag are resolved to digests (of the image index, so it works on
every architecture) at start and pinned the same way. Authors and Helm charts can keep tags; only
the security profile requires digests. A runtime without containers must reject a command step
with `image` instead of running it elsewhere.

### 3.7 Extension model (AEP-0021, concept)

Replaces the `extensions` objects with the model of the Kubernetes Gateway API, a specification
with many implementations and vendor extensions:

- support levels (Core, Extended, Implementation-specific) and named features;
- closed enums with an `extensionRef {group, kind, name}` at a few extension points (steps, tool
  sources), which **fail closed** when unknown, so AEP-0011 is no longer needed;
- domain-prefixed values for open value spaces (model providers, secret stores, event types), so
  the prefix list is no longer needed;
- policies that attach to workflows with `targetRefs`, and runtime bindings as separate
  implementation-specific objects with operator-side constraints on credentials, endpoints and
  egress;
- CRDs that prune unknown fields and use CEL, so `kubectl apply --validate=strict` catches errors
  (G09);
- the same model as plain data for runtimes without Kubernetes.

Prior art compared: Gateway API, Tekton (`CustomRun`), KubeVirt, Knative, Crossplane, KEDA, Dynamic
Resource Allocation. None of them uses a generic `x-` bag on every object; the `x-` convention comes
from OpenAPI and CloudEvents, not from Kubernetes. A runtime review of the concept is reflected in
it. It is a concept: nothing in the schema changes until the project lead decides.

## 4. Where this touches existing decisions

| Existing | Touched by | How |
| --- | --- | --- |
| D3 (required extensions, AEP-0011) | AEP-0021 | Unknown extension references fail closed by construction, so `requiredExtensions` is not needed. Reverses D3 if accepted. |
| D12 (extension prefix list) | AEP-0021 | Domain prefixes are unique without a registry. Reverses D12 if accepted. |
| Website page "Extending AWP" (`v1alpha1`) | AEP-0015, AEP-0021 | Correct for `v1alpha1`. In `v1alpha3`, `x-` fields move into `extensions`; AEP-0021 removes them. The page now says so in a note. |
| Scope table (decision log section 2) | AEPs 0015 to 0021 | Listed since D20 as proposed for `v1alpha3`; since D22 AEPs 0015 to 0020 are accepted, AEP-0021 stays a concept. |
| D19 (`v1alpha2` with step iteration, AEP-0022) | D20 | This draft starts from `v1alpha2`, so it has step iteration as section 5.6.5, combined with the step output interface (AEP-0018). |
| D16 (external reviewer) | all new AEPs | Each still needs a reviewer who is not an author. |

## 5. Decisions needed from the project lead

1. **Scope.** Do AEPs 0015 to 0021 join the `v1alpha3` scope table, once they reach `Review`?
2. **Extension model.** Follow AEP-0021 (reverses D3 and D12) or keep `extensions` objects?
3. **Kubernetes text.** Normative Kubernetes mapping in spec 3.10, or Kubernetes-only text marked
   informative (K, G26, G39)?
4. The remaining questions in [runtime-feedback.md section 10](runtime-feedback.md#10-questions-for-the-project-lead)
   (next AEPs for state and secret scopes, model parameters, collecting clarifications).

## 6. How it was tested

- `npm test`: all schema, semantic and CRD cases pass.
- All valid cases and examples were applied with a server-side dry run and strict field validation
  to a local k3s cluster. Status patches, printer columns, `kubectl wait --for=condition=Valid` and
  `generateName` were checked, and invalid status values were rejected by the API server.
- The proof-of-concept runtime ran a real workflow end to end against the draft.
