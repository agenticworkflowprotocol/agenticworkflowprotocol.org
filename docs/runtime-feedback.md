# Runtime feedback on `v1alpha2`

| | |
| --- | --- |
| **Status** | Working list for discussion. Nothing here is decided; an entry changes the specification only through an AEP ([decision D18](decisions.md#d18-implementation-experience-goes-into-aeps-and-implementer-guidance)). |
| **Source** | A Kubernetes runtime proof of concept (operator, step runner, one real workflow) built against `v1alpha2` at commit `d1bc49b`. As decided in D17, the runtime is not named. |
| **Collected** | 2026-11-19 |
| **Related** | [decision log](decisions.md), [AEP process](aep-process.md), [spec v1alpha2](../spec/v1alpha2/README.md) |

The proof of concept ran a workflow that fetches event pages of venues, extracts events with a
small model, compares them with stored state, rates new events with a larger model against a
personal profile and sends a notification. It ran end to end with mock and real models. The
manifest needed no runtime-specific field: everything about placement (images, volumes, model
access, secret mapping) lived in the runtime's own binding object. Almost all gaps are at one
place: how a step exchanges data with its environment.

Identifiers (G01 to G26) are those of the source list and never change. Severity: **must** blocks
portable runtimes, **should** needs a rule, **minor** is editorial or informative.

## Contents

1. [Status overview](#1-status-overview)
2. [Step interface](#2-step-interface)
3. [Workflow model](#3-workflow-model)
4. [Kubernetes and runtime binding](#4-kubernetes-and-runtime-binding)
5. [Trust and data flow](#5-trust-and-data-flow)
6. [Minor](#6-minor)
7. [From the operator](#7-from-the-operator)
8. [Questions for the project lead](#8-questions-for-the-project-lead)

## 1. Status overview

| Status | Entries |
| --- | --- |
| AEP drafted and applied to the `v1alpha2` draft (Draft, not accepted) | G01, G07, G08; partly G14, G15 |
| Covered by an existing AEP that is not applied yet | G02, G04, G06, G22 |
| Open, needs a decision whether and how | G03, G05, G09, G10, G11, G12, G13, G16 to G21, G23 to G38, K |

## 2. Step interface

| ID | Sev. | Gap | Proposal from the runtime | Status |
| --- | --- | --- | --- | --- |
| G01 | must | How a step produces its declared outputs is undefined; command images and agent prompts only work on the runtime they were written for. | Command steps write files to `$AWP_OUTPUTS`; agent steps get a completion mechanism. | AEP drafted: [step outputs](../aep/0018-step-outputs.md), spec 5.6.4; open question 4 there: non-string values in `complete_step` as JSON until AEP-0003 |
| G02 | must | Outputs are untyped: a runtime cannot ask the model for structured output or check it before the next step. | `outputs[].type` and `schema`. | [AEP-0003](../aep/0003-typed-handoffs.md) and [AEP-0014](../aep/0014-input-examples-and-schemas.md), not applied |
| G03 | must | No state across executions ("already reported"). Solved with a volume from the runtime binding, invisible to AWP: no data class, no retention. | `spec.state` (name, classification, retention), provided as a directory or key-value store. | open |
| G05 | must | Secrets of command steps are too coarse: `scope: [command]` gives a secret to every command step; the variable name is undefined. | Step ids as `scope` entries; a secret is exposed as an environment variable with its name. | open |
| G12 | should | Where the code of a command step comes from is undefined (scripts in the image; an example runs `npm test` without a checkout). | `workspace` (for example a Git repository and revision) or explicitly implementation-defined. | open |
| G14 | should | No size limit for outputs. | A minimum every runtime accepts and a rule for larger outputs. | in AEP-0018 (256 KiB per output, 1 MiB per step) |
| G15 | should | Undefined whether outputs of a failed command step are valid. | They are discarded. | in AEP-0018 |
| G16 | should | No standard failure reasons for steps (model refusal, token limit, not completed, timeout, missing outputs). | A reason vocabulary for step failure events. | open; AEP-0018 introduces `notCompleted`, `outputTooLarge`, `outputInvalid` |
| G17 | should | No grace period when a step is cancelled or times out. | Termination signal and grace period with a runtime default. | open |
| G18 | minor | Tool results are text only. | Structured tool results. | open |
| G19 | minor | Standard input of commands is undefined. | Standard input is empty. | open |

## 3. Workflow model

| ID | Sev. | Gap | Proposal from the runtime | Status |
| --- | --- | --- | --- | --- |
| G04 | must | No conditional steps: the expensive rating step runs daily even when nothing is new (about 1.50 USD a month for nothing). `v1alpha2` expressions have no operators. | AEP-0001 in `v1alpha2` with a minimal comparison. | [AEP-0001](../aep/0001-conditional-steps.md), not applied |
| G06 | must | Side effects of commands are invisible to governance: sending a message is only `shell.execute`, so rules on `external.communication` do not apply. | Tool steps. | [AEP-0012](../aep/0012-tool-steps.md), not applied |
| G08 | must | No rule that an execution keeps the manifest version it started with; a GitOps sync can change a manifest mid-run. | MUST, with the digest in `workflow.started`. | AEP drafted: [execution pinning](../aep/0020-execution-pinning.md), spec 10.1 |
| G13 | should | No step that runs after a failure ("notify me when the run fails"). | `finally` or `onFailure` steps. | open |
| G20 | should | Expressions have no date or time; a step has to write the fetch date into an output. | `execution.startedAt` as a reference. | open |
| G21 | should | Input values cannot be set per environment or deployment; scheduled executions use defaults. | Inputs per environment (7.10) or inputs supplied by the runtime binding for schedule triggers. | open |
| G22 | should | Array inputs have no item schema. | `items` and `schema` for array and object inputs. | [AEP-0014](../aep/0014-input-examples-and-schemas.md), not applied |
| G23 | should | No fan-out: an agent step cannot run once per source. | `matrix` or `forEach` over an array. | open |
| G24 | should | No limit on output tokens or turns per agent step; large extractions hit hard-coded limits. | `budget.resources.maxOutputTokens` and `maxTurns`. | open |
| G25 | minor | The model cannot see which step it serves; a gateway can only guess. | The runtime passes the step id as request metadata (informative). | open |

## 4. Kubernetes and runtime binding

| ID | Sev. | Gap | Proposal from the runtime | Status |
| --- | --- | --- | --- | --- |
| G07 | must | No execution object and no status shape; `kubectl get workflows` cannot show validity. | A run kind; standard conditions in `metav1.Condition` shape with printer columns. | AEP drafted: [WorkflowRun and status](../aep/0019-workflow-run-and-status.md), spec 3.11 and 10.8 |
| G09 | should | Unknown `spec` fields pass `kubectl apply --validate=strict` (the CRDs keep unknown fields); only `status` shows the error, and GitOps tools report "synced". | Ship the validator as an admission webhook image or a ValidatingAdmissionPolicy for common rules. | open; the `Valid` condition of G07 makes the error visible in `kubectl get` |
| G10 | should | Host-based network permissions cannot be enforced with NetworkPolicy. | Informative note: egress proxy or FQDN policies of the network plugin, otherwise a declared limitation. | open |
| G26 | should | `metadata.namespace` and `secrets[].source: kubernetes` tie a manifest to one runtime. | Namespace is deployment data; `source` names an abstract store that the runtime resolves. | open |
| K | should | No mapping of AWP concepts to Kubernetes primitives; every Kubernetes runtime invents its own. | A mapping table in spec 3.10, see below. | open |

G09 is discussed further in the conversation with the project lead: instead of keeping unknown
fields in every object, the CustomResourceDefinitions could prune them as Kubernetes does, express
the conditional rules of the JSON Schema as CEL rules (`x-kubernetes-validations`), and keep
unknown fields only in extension values. Not decided.

**Proposed mapping (K).** Principle: AWP describes intent; Kubernetes is one way to enforce it.
Manifests contain no Kubernetes objects (no `secretKeyRef`, resource requests, NetworkPolicy,
node selectors); where AWP and Kubernetes share a concept, names and semantics are aligned (as
`concurrencyPolicy` already is).

| AWP | Kubernetes binding |
| --- | --- |
| `secrets[].source: kubernetes` | Secret in the manifest's namespace, never across namespaces |
| `environment` | namespace, or a label the runtime documents |
| `permissions.network` | NetworkPolicy where expressible; host names need an egress proxy or FQDN policies, otherwise a declared limitation |
| `permissions.filesystem` | volumes and `readOnlyRootFilesystem`; listed paths are the only writable mounts |
| `schedule` trigger | CronJob semantics; implemented with CronJob or the runtime's own scheduler |
| `status` | `metav1.Condition` (now spec 3.11) |
| audit events | the runtime's audit log; MAY also be Kubernetes Events, which expire and are no audit log |
| approvers | identities of people, not RBAC subjects; RBAC controls who writes manifests, not who approves |
| `agents[].ref`, `promptRef` | objects of the AWP group in the same namespace; version and digest are assertions |

## 5. Trust and data flow

| ID | Sev. | Gap | Proposal from the runtime | Status |
| --- | --- | --- | --- | --- |
| G11 | should | Untrusted web content becomes a step output and flows into the next agent's task (prompt injection channel); `classification` describes confidentiality, not origin. | Mark the origin, for example `outputs[].trust: external`. | open |

## 6. Minor

- Action identifiers with dots (`web.fetch`) are not valid tool names for model APIs; runtimes have
  to map them. A sentence in section 5.5.3 would do.
- `maxCostUsd` is a floating-point number; runtimes store costs as decimal strings.
- Durations with `d`, `w`, `y`: the runtime assumed 24 h, 7 d and 365 d; section 3.6 should say so.

## 7. From the operator

Reported later by the operator of the same runtime. Data point for G04 and G24: a run against six
real venue sites found 358 events; the rating step rated 37 as relevant and cost 0.27 USD (about
91,000 input tokens). Extracting about 250 events with a model hit the output token limit twice;
the collector only works because a command step now parses structured sources deterministically.

| ID | Sev. | Gap | Proposal from the runtime | Status |
| --- | --- | --- | --- | --- |
| G27 | should | `permissions.default` has no default; the runtime denies unlisted actions. | State the default (`deny`), or require `default` when tools or network are present. | open |
| G28 | should | Input type `artifact` is undefined (reference, digest, where the step finds it); the runtime rejects it. | Artifact reference (URI and digest) and placement, together with G01 and G12. | open |
| G29 | should | `execution.id` has no format or scope; the runtime used different values in expressions, `AWP_EXECUTION_ID` and audit events. | Opaque, globally unique, the same value everywhere. | open; spec 10.1 recommends `awp-exec-<ULID>`, the `WorkflowRun` draft adds `status.executionId` |
| G30 | should | Retry semantics: what an attempt is, how timeouts apply, how `retries` relates to `maxRetries`. | Define attempts; `maxRetries` caps retries at each level. | open; outputs of failed attempts are covered by AEP-0018 |
| G31 | should | What `maxSteps` counts is unclear; the runtime counts model calls and command attempts. | Rename (`maxModelCalls`, `maxAttempts`) or define the unit. | open |
| G32 | should | No defaults for step timeout (and runtimes differ on concurrency); the runtime uses 30 minutes. | Define defaults or require runtimes to state them. | open; `maxConcurrency` defaults to `1` in spec 5.6.3 |
| G33 | minor | Manual start with only schedule or event triggers is not stated. | Say so in 5.2. | open; spec 5.2 covers absent `triggers`, and the `WorkflowRun` draft requires a manual start to be allowed |
| G34 | should | No model request parameters; a real run hit the output token limit of 8192. Overlaps G24. | `agents[].model.parameters` with at least `maxOutputTokens`. | open |
| G35 | should | Unknown prices and cached tokens in cost computation. | Fail closed for unknown prices when `maxCostUsd` applies; define whether cached tokens count. | open; AEP-0013 covers budget metering in part |
| G36 | should | `permissions.secrets` semantics undefined; the runtime rejects it. | Allow list intersected over all permission objects, for every step type. | open |
| G37 | minor | Whether command steps need `shell.execute` and whether that is checked statically. | Command steps require `shell.execute`, checked at validation. | open |
| G38 | minor | `maxDuration` on an agent is ambiguous when the agent serves several steps; the runtime rejects it. | Only workflow and step level, or cumulative step time. | open |

## 8. Questions for the project lead

1. Do the three drafted AEPs (G01, G07, G08) join the `v1alpha2` scope table in the decision log,
   once they reach `Review`?
2. G03 state and G05 secret scopes are the remaining **must** entries without an AEP. Draft them
   next?
3. G02, G04, G06, G22: apply AEP-0001, AEP-0003, AEP-0012 and AEP-0014 to the `v1alpha2` draft as
   well, so that a runtime can test them?
4. K and G26: a normative Kubernetes mapping in spec 3.10, or an informative page on the website?
5. G09: should this repository publish the validator as a container image for admission webhooks?
6. G13 (`finally`), G23 (fan-out) and G24 with G34 (token and turn limits, model parameters):
   `v1alpha2` or later? The real run above makes G24/G34 the most pressing of them.
7. G27 to G38 are mostly clarifications. Collect them in one AEP (like AEP-0013) or extend
   AEP-0013?
