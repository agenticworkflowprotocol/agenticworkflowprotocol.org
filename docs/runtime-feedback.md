# Runtime feedback on `v1alpha3`

| | |
| --- | --- |
| **Status** | Working list for discussion. Nothing here is decided; an entry changes the specification only through an AEP ([decision D18](decisions.md#d18-implementation-experience-goes-into-aeps-and-implementer-guidance)). |
| **Source** | A Kubernetes runtime proof of concept (operator, step runner, one real workflow) built against the draft at commit `d1bc49b` (then named `v1alpha2`, now `v1alpha3`, decision D20). As decided in D17, the runtime is not named. |
| **Collected** | 2026-11-19 |
| **Related** | [decision log](decisions.md), [AEP process](aep-process.md), [spec v1alpha3](../spec/v1alpha3/README.md) |

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
8. [Event triggers](#8-event-triggers)
9. [From the concept review](#9-from-the-concept-review)
10. [Questions for the project lead](#10-questions-for-the-project-lead)

## 1. Status overview

| Status | Entries |
| --- | --- |
| AEP drafted and applied to the `v1alpha3` draft (Draft, not accepted) | G01, G07, G08, G40; partly G14, G15 |
| AEP drafted, not applied | G10, G47, G49, G50, G51, G61 (AEP-0023); G42 to G46, G54, G56 (AEP-0024); G03, G53, G58 (AEP-0025) |
| Covered by an existing AEP that is not applied yet | G02, G04, G06, G22; G41 (AEP-0004); G48, G57 (AEP-0019 open question 1); G52 (AEP-0021); G55 (AEP-0012); G59, G60 (AEP-0008) |
| Open, needs a decision whether and how | G05, G09, G11, G12, G13, G16 to G21, G23 to G39, K |

## 2. Step interface

| ID | Sev. | Gap | Proposal from the runtime | Status |
| --- | --- | --- | --- | --- |
| G01 | must | How a step produces its declared outputs is undefined; command images and agent prompts only work on the runtime they were written for. | Command steps write files to `$AWP_OUTPUTS`; agent steps get a completion mechanism. | AEP drafted: [step outputs](../aep/0018-step-outputs.md), spec 5.6.4; open question 4 there: non-string values in `complete_step` as JSON until AEP-0003 |
| G02 | must | Outputs are untyped: a runtime cannot ask the model for structured output or check it before the next step. | `outputs[].type` and `schema`. | [AEP-0003](../aep/0003-typed-handoffs.md) and [AEP-0014](../aep/0014-input-examples-and-schemas.md), not applied |
| G03 | must | No state across executions ("already reported"). Solved with a volume from the runtime binding, invisible to AWP: no data class, no retention. | `spec.state` (name, classification, retention), provided as a directory or key-value store. | AEP drafted: [AEP-0025](../aep/0025-state.md) |
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
| G04 | must | No conditional steps: the expensive rating step runs daily even when nothing is new (about 1.50 USD a month for nothing). `v1alpha3` expressions have no operators. | AEP-0001 in `v1alpha3` with a minimal comparison. | [AEP-0001](../aep/0001-conditional-steps.md), not applied |
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
| G10 | should | Host-based network permissions cannot be enforced with NetworkPolicy. | Informative note: egress proxy or FQDN policies of the network plugin, otherwise a declared limitation. | AEP drafted: [AEP-0023](../aep/0023-step-isolation.md) |
| G26 | should | `metadata.namespace` and `secrets[].source: kubernetes` tie a manifest to one runtime. | Namespace is deployment data; `source` names an abstract store that the runtime resolves. | open |
| K | should | No mapping of AWP concepts to Kubernetes primitives; every Kubernetes runtime invents its own. | A mapping table in spec 3.10, see below. | open |

G09 is discussed further in the conversation with the project lead: instead of keeping unknown
fields in every object, the CustomResourceDefinitions could prune them as Kubernetes does, express
the conditional rules of the JSON Schema as CEL rules (`x-kubernetes-validations`), and keep
unknown fields only in extension values. [AEP-0021](../aep/0021-extension-model.md) proposes this
together with an extension model aligned with the Kubernetes Gateway API. Not decided.

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
| G39 | should | Runtime neutrality has only been tested on Kubernetes. The `WorkflowRun` draft defines conditions as `metav1.Condition` and names an admission webhook as the source of the actor. Related to G26. | Define conditions as plain JSON (`type`, `status`, `reason`, `message`, `lastTransitionTime`) with `metav1.Condition` as the Kubernetes mapping; keep "actor from an authenticated source" normative and the webhook as a non-normative example; mark Kubernetes-only text as informative. A run of the same workflow without a cluster is planned. | open |
| G40 | should | Command step `image`: what a runtime without containers does with it (ignoring it runs the command in an unreviewed environment), and whether digests are needed. Digests made Helm charts hard to maintain, and digests of single platforms break multi-architecture use. | A runtime that cannot run the image rejects the workflow; tags are allowed outside the security profile and resolved to the image index digest at start, pinned for the execution and recorded. | applied in the AEP-0020 draft (spec 5.6.2, 9.4, 10.1, 10.7) |
| G47 | should | `permissions.network` and deployment limits: a namespace network policy also restricts egress, and the spec says neither who enforces `allowHosts` nor what happens when the deployment allows less. The default `egress: allow` also conflicts with deny-by-default deployments. | The manifest states what the workflow needs, the deployment sets a ceiling, the intersection applies (like a pod security context under a cluster security policy). The runtime MUST enforce, MAY restrict further and MUST reject before execution if the ceiling is narrower or it cannot enforce for a step type. `egress: deny` as the default under the security profile. | AEP drafted: [AEP-0023](../aep/0023-step-isolation.md) |

## 8. Event triggers

Reported while the same runtime added event-driven workflows: a chat bridge publishes messages as
CloudEvents to an MQTT broker, an existing event router (one listener per transport, one filter
object per workflow) creates a run for every matching workflow, and a step answers in the
originating thread. Routing involves no model, so a message cannot redirect it by prompt. Two
findings from the router used: it subscribes to MQTT with QoS 0 and keeps event ids for
deduplication only in memory for a few minutes, so the runtime must deduplicate itself.

| ID | Sev. | Gap | Proposal from the runtime | Status |
| --- | --- | --- | --- | --- |
| G41 | must | An event trigger cannot pass event data to the execution; spec 5.2 has no event context, so the proof of concept maps event fields to inputs. | Apply AEP-0004 (`${{ event.* }}`, `dataSchema`, `classification`, event data as untrusted input) to `v1alpha3`, keeping D7. The run object carries the event as set by the router (G48); a test or replay run carries a supplied event (G57). | partly solved: D7 and AEP-0004 replace the input mapping; AEP-0004 not applied to the draft yet |
| G42 | should | `filter` semantics are undefined: which fields it matches, whether by equality, how entries combine. | Keys are CloudEvents attribute names or `data.<path>`, values match by equality, all entries must match. Richer conditions (CEL, expression filters) live in an implementation-specific trigger object attached with `targetRefs` (AEP-0021 B6) and may only narrow the manifest filter. | AEP drafted: [AEP-0024](../aep/0024-event-triggers.md) |
| G43 | should | No duplicate handling and no concurrency for event triggers; MQTT and webhook retries deliver events more than once. | Deduplicate by CloudEvents `source` and `id` within a window the runtime states; allow `concurrencyPolicy` and a rate limit on event triggers. | AEP drafted: [AEP-0024](../aep/0024-event-triggers.md); duplicates observed in the proof of concept (a run rejected as duplicate event), the runtime deduplicates by `source` and `id` |
| G44 | must | The actor of an event-triggered execution is unclear: the authenticated party is the bridge, not the person who wrote the message. | Record both: the authenticated source and an optional actor attested by it; policies may require an attested actor and name the sources allowed to attest. Answers never count as approvals (AEP-0017). | AEP drafted: [AEP-0024](../aep/0024-event-triggers.md); severity raised: approval rules on the initiator (spec 7.6 `initiatorCannotApprove`, `actorCannotApproveOwnAction`) do not bind a person who starts a run by message while the actor is `system`. Evidence: the bridge attests the author only through transport authorisation (broker access control), not end to end |
| G45 | minor | No reply path: an execution started by a message cannot refer to where the message came from. | Standardise correlation data in the event context (thread, reply target as a CloudEvents extension); delivery stays with steps. | AEP drafted: [AEP-0024](../aep/0024-event-triggers.md) |
| G46 | should | Conversation context: a reply in a thread (chat, ticket, mail) only sees the triggering message. The proof of concept lets the source adapter attach earlier thread messages (author, bot flag, time, text; capped, with a truncation flag) and the participants to the event data. | A standard shape for thread context inside `event.data` (AEP-0004), untrusted and classified like the rest, so workflows stay independent of the source. Participants are personal data and fall under the data policy. | AEP drafted: [AEP-0024](../aep/0024-event-triggers.md); limits in the proof of concept are set, not measured |

## 9. From the concept review

Found while writing a reference concept for operating agents and in three reviews of it against
the proof of concept and the draft at `b8a0ee8` (now `v1alpha3`, decision D20). The column "Home" names the AEP or entry where a
change would fit.

| ID | Sev. | Gap | Proposal from the runtime | Home | Status |
| --- | --- | --- | --- | --- | --- |
| G48 | must | Event runs created by an external router (an event router creating run objects) fit neither role of spec 10.8: client-created runs are manual, runtime-created runs record the trigger only in status, and the run spec has no trigger. | A trusted-ingress role: an authenticated identity the runtime accepts may create runs with trigger type `event` and an event payload; the runtime checks the trigger against the manifest, records the ingress identity and rejects event fields from other creators. | AEP-0019 open question 1 | open; the runtime now plans to create event runs itself from a generated trigger object, which needs no new role; the role stays relevant for external routers |
| G49 | should | `permissions.network.allowHosts` has no syntax: subdomain wildcards, ports, IP literals and CIDRs are undefined. | Define host matching (exact, `*.domain`), optional ports, and whether addresses or CIDRs are allowed. | [AEP-0023](../aep/0023-step-isolation.md) | AEP drafted |
| G50 | must | An allowed host can resolve to loopback, private, link-local (cloud metadata) or CGNAT addresses (SSRF, DNS rebinding); the proof of concept had this hole. | Under the security profile, deny such destinations after resolution unless listed explicitly as addresses. | [AEP-0023](../aep/0023-step-isolation.md) | AEP drafted; the proof of concept now checks the resolved address at connection time (covers rebinding and redirects by construction), without an explicit rebinding test |
| G51 | should | No guidance on how `permissions.network` is enforced for command steps. | Informative: a per-workload egress proxy with an allowlist derived from `allowHosts`, plus a network policy that allows only that proxy, is conforming. A runtime that cannot enforce a network rule rejects the workflow. | [AEP-0023](../aep/0023-step-isolation.md), with G10 | AEP drafted |
| G52 | should | AEP-0021 B6 covers bindings but not runtime trigger objects (routing, expression filters, rate limits). | Trigger objects attach with `targetRefs` and `sectionName` (trigger index), may only narrow the manifest trigger, are generated from or validated against `spec.triggers`, and report `Accepted`. | AEP-0021 (extend B6) | open |
| G53 | should | Two workflows of one owner share state (a daily run writes, a chat run reads and writes). | State as a named resource referenced by several workflows with an access mode, rules for concurrent writers, and the strictest classification for every reader. | [AEP-0025](../aep/0025-state.md), with G03 | AEP drafted; scenario derived, no conflict observed |
| G54 | minor | Meaning of `triggers[].source`: the CloudEvents producer (URI) or an adapter name (AEP-0021 B4). | State which one. | [AEP-0024](../aep/0024-event-triggers.md); AEP-0021 B4 corrected | AEP drafted |
| G55 | should | A step that posts as its own bot account acts under an external identity; the manifest shows only a secret, and governance sees `shell.execute` (G06). | Declare the external identity a step acts as, so audit and policies can refer to it. | AEP-0012 (its open point on which identity calls a tool) | open |
| G56 | minor | Event routers can silently weaken delivery guarantees (one subscribes to MQTT with QoS 0). | Runtimes state the delivery guarantee per event source in the conformance statement. | [AEP-0024](../aep/0024-event-triggers.md) (conformance statement) | AEP drafted |
| G57 | should | Event-only workflows cannot be tested conformingly: AEP-0004 fails `event.*` outside event runs, and 10.8 makes client runs manual. | A client run with a supplied event, marked as test or replay (actor is the creator), validated against `dataSchema`. | AEP-0019 open question 1, AEP-0004 | open |
| G58 | should | State written by one execution is read as data by the next, so a message or web page can become a persistent instruction (memory poisoning, seen in the chat workflow). | Origin marking (G11) also for state; state is untrusted input by default. | [AEP-0025](../aep/0025-state.md); spec 12 now lists state as untrusted input | AEP drafted |
| G59 | should | AEP-0008 treats `contextTokens` and `maxOutputTokens` as informative; a model server rejected every request because the runtime asked for more output tokens than the model allows. | Catalog limits are binding: the runtime caps requested output tokens at `maxOutputTokens` and rejects a workflow whose settings cannot fit. A price of 0 (local models) counts as a known price (G35). | AEP-0008 (its target `v1alpha3` predates D20 and now means after the current draft), with G34 | open |
| G60 | minor | Agent steps need a model that supports tool calls; a small local model called tools without arguments, and the failure showed only at run time. | Optional capability flags in the catalog model entry (`toolUse`, `structuredOutput`); a runtime rejects an agent with tools on a model without tool support. | AEP-0008 | open |
| G61 | should | The spec does not say where model credentials live; a runtime may hand the provider key to the step, where any command or injected instruction can read it. | Under the security profile, model credentials MUST NOT be visible in the step environment; the runtime calls the provider itself or through a proxy that authenticates the step with a short-lived, execution-bound credential. | [AEP-0023](../aep/0023-step-isolation.md); not AEP-0008, whose non-goals exclude credentials | AEP drafted; feasibility shown (key only at the runtime, short-lived credential per attempt), latency and cost of the proxy not measured |

**Conflict in the draft (G44).** Spec 5.2 gives every `event` start the actor type `system`,
while G44 asks to record a person attested by the event source. Both cannot hold; 10.8 avoids
the question only because runtime-created runs record the trigger in status.

## 10. Questions for the project lead

1. Do the three drafted AEPs (G01, G07, G08) join the `v1alpha3` scope table in the decision log,
   once they reach `Review`?
2. G03 state and G05 secret scopes are the remaining **must** entries without an AEP. Draft them
   next?
3. G02, G04, G06, G22: apply AEP-0001, AEP-0003, AEP-0012 and AEP-0014 to the `v1alpha3` draft as
   well, so that a runtime can test them?
4. K, G26 and G39: a normative Kubernetes mapping in spec 3.10, or an informative page on the website?
5. G09: should this repository publish the validator as a container image for admission webhooks?
6. G13 (`finally`), G23 (fan-out) and G24 with G34 (token and turn limits, model parameters):
   `v1alpha3` or later? The real run above makes G24/G34 the most pressing of them.
7. G27 to G38 are mostly clarifications. Collect them in one AEP (like AEP-0013) or extend
   AEP-0013?
8. Decided 2026-11-22: event triggers get one AEP, [AEP-0024](../aep/0024-event-triggers.md)
   (G42 to G46, G54, G56). G41 is AEP-0004, G48 and G57 go into AEP-0019 (open question 1), G52
   into AEP-0021.
9. Decided 2026-11-22: network permissions and credentials get one AEP,
   [AEP-0023](../aep/0023-step-isolation.md) (G10, G47, G49 to G51, G61). Internal destinations
   are denied by default under the security profile, not banned: the manifest and the platform
   ceiling can allow them. State gets [AEP-0025](../aep/0025-state.md) (G03, G53, G58).
