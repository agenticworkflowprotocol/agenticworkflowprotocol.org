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
10. [From interactive sessions and a coding agent engine](#10-from-interactive-sessions-and-a-coding-agent-engine)
11. [Questions for the project lead](#11-questions-for-the-project-lead)

## 1. Status overview

| Status | Entries |
| --- | --- |
| Accepted and applied to `v1alpha2` and `v1alpha3` | G23 ([AEP-0022](../aep/0022-step-iteration.md), decision D19) |
| AEP drafted and applied to the `v1alpha3` draft (Draft, not accepted) | G01, G07, G08, G40; partly G14, G15 |
| AEP drafted, not applied | G10, G47, G49, G50, G51, G61, G64, G67 to G69 (AEP-0023); G42 to G46, G54, G56, G86 (AEP-0024); G03, G53, G58, G87 (AEP-0025) |
| New AEP proposed (number to be confirmed) | G62, G63, G73, G82, G85 (AEP-0026, interactive execution); G65, G66, G81, G83 (AEP-0027, agent engine) |
| Amendment drafted in an existing AEP that is not applied yet (from section 10) | G70 to G72 (AEP-0007); G74 (AEP-0002); G75 (AEP-0005); G76, G85 in part, G77 in part (AEP-0009); G78 (AEP-0013); G84 (AEP-0017) |
| Covered by an existing AEP that is not applied yet | G02, G04, G06, G22; G41 (AEP-0004); G48, G57 (AEP-0019 open question 1); G52 (AEP-0021); G55 (AEP-0012); G59, G60 (AEP-0008) |
| Open, needs a decision whether and how | G05, G09, G11, G12, G13, G16 to G21, G24 to G39, G77, G79, G80, K |

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
| G23 | should | No fan-out: an agent step cannot run once per source. | `matrix` or `forEach` over an array. | resolved: `forEach`, [AEP-0022](../aep/0022-step-iteration.md) (accepted, D19), spec `v1alpha3` 5.6.5 |
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
| G49 | should | `permissions.network.allowHosts` has no syntax: subdomain wildcards, ports, IP literals and CIDRs are undefined. | Define host matching (exact, `*.domain`), optional ports, and whether addresses or CIDRs are allowed. | [AEP-0023](../aep/0023-step-isolation.md) | AEP drafted; revised after review on 2026-11-23: `allowHosts` becomes `allowTo` with objects (`host` or `cidr`, `except`, `ports`) as in network policies, because a port appended to an IPv6 address is ambiguous |
| G50 | must | An allowed host can resolve to loopback, private, link-local (cloud metadata) or CGNAT addresses (SSRF, DNS rebinding); the proof of concept had this hole. | Under the security profile, deny such destinations after resolution unless listed explicitly as addresses. | [AEP-0023](../aep/0023-step-isolation.md) | AEP drafted; the proof of concept now checks the resolved address at connection time (covers rebinding and redirects by construction), without an explicit rebinding test. Second enforcement point: the egress proxy of every tenant and of a tool server deny private, loopback, link-local and CGNAT destinations after resolution, and the network policy of the proxy excludes them as well |
| G51 | should | No guidance on how `permissions.network` is enforced for command steps. | Informative: a per-workload egress proxy with an allowlist derived from `allowHosts`, plus a network policy that allows only that proxy, is conforming. A runtime that cannot enforce a network rule rejects the workflow. | [AEP-0023](../aep/0023-step-isolation.md), with G10 | AEP drafted |
| G52 | should | AEP-0021 B6 covers bindings but not runtime trigger objects (routing, expression filters, rate limits). | Trigger objects attach with `targetRefs` and `sectionName` (trigger index), may only narrow the manifest trigger, are generated from or validated against `spec.triggers`, and report `Accepted`. | AEP-0021 (extend B6) | open |
| G53 | should | Two workflows of one owner share state (a daily run writes, a chat run reads and writes). | State as a named resource referenced by several workflows with an access mode, rules for concurrent writers, and the strictest classification for every reader. | [AEP-0025](../aep/0025-state.md), with G03 | AEP drafted; scenario derived, no conflict observed |
| G54 | minor | Meaning of `triggers[].source`: the CloudEvents producer (URI) or an adapter name (AEP-0021 B4). | State which one. | [AEP-0024](../aep/0024-event-triggers.md); AEP-0021 B4 corrected | AEP drafted |
| G55 | should | A step that posts as its own bot account acts under an external identity; the manifest shows only a secret, and governance sees `shell.execute` (G06). | Declare the external identity a step acts as, so audit and policies can refer to it. | AEP-0012 (its open point on which identity calls a tool) | open |
| G56 | minor | Event routers can silently weaken delivery guarantees (one subscribes to MQTT with QoS 0). | Runtimes state the delivery guarantee per event source in the conformance statement. | [AEP-0024](../aep/0024-event-triggers.md) (conformance statement) | AEP drafted |
| G57 | should | Event-only workflows cannot be tested conformingly: AEP-0004 fails `event.*` outside event runs, and 10.8 makes client runs manual. | A client run with a supplied event, marked as test or replay (actor is the creator), validated against `dataSchema`. | AEP-0019 open question 1, AEP-0004 | open |
| G58 | should | State written by one execution is read as data by the next, so a message or web page can become a persistent instruction (memory poisoning, seen in the chat workflow). | Origin marking (G11) also for state; state is untrusted input by default. | [AEP-0025](../aep/0025-state.md); spec 12 now lists state as untrusted input | AEP drafted |
| G59 | should | AEP-0008 treats `contextTokens` and `maxOutputTokens` as informative; a model server rejected every request because the runtime asked for more output tokens than the model allows. | Catalog limits are binding: the runtime caps requested output tokens at `maxOutputTokens` and rejects a workflow whose settings cannot fit. A price of 0 (local models) counts as a known price (G35). | AEP-0008 (its target `v1alpha3` predates D20 and now means after the current draft), with G34 | open |
| G60 | minor | Agent steps need a model that supports tool calls; a small local model called tools without arguments, and the failure showed only at run time. | Optional capability flags in the catalog model entry (`toolUse`, `structuredOutput`); a runtime rejects an agent with tools on a model without tool support. | AEP-0008 | open; a coding agent engine (section 10) also needs context size, output limit and input types (image, document) from the catalog, otherwise it does not compact the context or rejects input |
| G61 | should | The spec does not say where model credentials live; a runtime may hand the provider key to the step, where any command or injected instruction can read it. | Under the security profile, model credentials MUST NOT be visible in the step environment; the runtime calls the provider itself or through a proxy that authenticates the step with a short-lived, execution-bound credential. | [AEP-0023](../aep/0023-step-isolation.md); not AEP-0008, whose non-goals exclude credentials | AEP drafted; feasibility shown (key only at the runtime, short-lived credential per attempt), latency and cost of the proxy not measured |

**Conflict in the draft (G44).** Spec 5.2 gives every `event` start the actor type `system`,
while G44 asks to record a person attested by the event source. Both cannot hold; 10.8 avoids
the question only because runtime-created runs record the trigger in status.

## 10. From interactive sessions and a coding agent engine

Reported after the same runtime was extended to a platform. People start interactive sessions
with a coding agent in a browser console (sign-in through OpenID Connect, tenants with ceilings).
The coding agent runs in an isolated pod without model or tool credentials. A model gateway and an
MCP gateway outside the pod hold the credentials, meter the budget and write the audit trail.
Egress goes through a proxy per tenant. The same coding agent also runs agent steps of workflows
as an engine. A security review that scans a deliberately vulnerable repository with a static
analysis server over MCP and fixes the findings ran end to end, interactively and as an
event-triggered workflow. "Shown" in the status column means that it ran on the test installation,
not only in unit or integration tests.

The common thread of this section is one question that AWP does not ask yet: **does something
live inside or outside the execution environment?** Credentials (G61, G69), approvals (G64) and
audit events (G76) are trustworthy only when they are outside it. Two sessions showed this in
practice. A command read the coding agent's local server password from `/proc` because both run
under the same user ID. A process in the sandbox then answered its own permission request. It
failed only after the decision moved to a separate container.

| ID | Sev. | Gap | Proposal from the runtime | Home | Status |
| --- | --- | --- | --- | --- | --- |
| G62 | must | Interactive execution. Spec 6 runs a standalone agent as a workflow with one step. A session has no task and no outputs: a person sends prompts for hours, the session pauses when idle, resumes, and ends when the person stops it. Its lifecycle, budget scope and audit events (created, idle, resumed, waiting for a person, finished) are undefined. | An execution form `Session` next to `WorkflowRun`, with lifecycle, budget scope and events. | new AEP: [AEP-0026](../aep/0026-interactive-execution.md) | shown; the runtime treats a whole session as one execution for permissions, budget and audit |
| G63 | must | Permissions are only `allow` or `deny`. In a session a person confirms single tool calls and switches between read-only, confirm-each-call and autonomous during the session. AWP says neither who may switch nor whether an author can forbid autonomy, and confirmations are neither approvals nor audited. | An effect `ask` for interactive execution. An autonomy ceiling in the manifest that the platform can only lower. Audit events for confirmed and refused calls and for mode changes. | AEP-0026 | shown |
| G64 | must | Approval authority inside the execution environment. The engine and its commands share a user ID: a command read the engine's server password and could answer its own permission requests. A process in the sandbox sent a prompt with the autonomous mode and answered every question itself. | Under the `security` profile, confirmations and approvals are decided outside the execution environment, by an authenticated person, over a channel the environment cannot reach. Nothing that carries an approval (passwords, tokens, signed grants) is readable inside. | [AEP-0023](../aep/0023-step-isolation.md) | shown: the attack succeeded while the engine decided, and failed after the decision moved to a separate container with signed grants; the counter-test through the console asked once and ran after "allow once" |
| G65 | must | Engine of an agent. A coding agent brings its own tool loop, file editing and shell use. No field says which engine runs an agent, what it receives and produces, how permissions map to it, or whether its subagents inherit permissions and budget. The runtime uses an extension field. | `agents[].engine` (`type`, `runtimeProfile`, `repositories`, `push`). Allow or deny only when unattended. A refused call fails the step. Subagents inherit permissions and budget. Unknown engines are rejected. | new AEP: [AEP-0027](../aep/0027-agent-engine.md); until then `extensionRef` ([AEP-0021](../aep/0021-extension-model.md) B3) | shown: a workflow ran its review step with the engine, started by hand and by an event |
| G66 | should | Engine steps produce only a summary and a diff. A step that declares outputs such as `critical` and `high` is rejected, and its repositories are fixed, so an event cannot pass one. | The engine fills declared outputs through the completion tool of AEP-0018 with the schema of AEP-0003. `repositories` is expression-enabled with `inputs.*` and `event.*`. | AEP-0027 | shown (the rejection) |
| G67 | should | Agents that run untrusted code need stronger isolation than a container. The manifest cannot require it: the runtime class sits in the binding, invisible to reviewers. | A minimum `agents[].isolation` (`container`, `sandbox`, `vm`) that a runtime meets or rejects. The mechanism is platform configuration. | AEP-0023 | mapping implemented; no class above `container` deployed |
| G68 | should | Ceilings. AEP-0023 defines a network ceiling, but not whether ceilings reject or cap. The runtime rejects models, hosts and MCP servers outside its tenant ceiling and caps cost. Tenants also limit tool sources, autonomy and concurrent sessions. | A ceiling never adjusts a manifest: anything above it (model, tool source, destination, autonomy, isolation the platform cannot provide, budget) is rejected, and under a budget ceiling the manifest must declare the limit. Revised after review on 2026-11-23 (the first draft capped budgets). | AEP-0023 | shown |
| G69 | should | MCP credentials. Spec 5.5.1 `auth.secretRef` hands the credential to the MCP client. When the client is a coding agent in a sandbox, the agent and every command can read it. | Under the `security` profile, tool server credentials stay outside the execution environment, like model credentials (G61). A gateway authenticates the execution with a short-lived ticket, and `auth` may be satisfied by the runtime. | AEP-0023 | shown: the static analysis server is reachable only through the gateway, with a session ticket and a step ticket |
| G70 | should | Resolution of MCP servers from runtime configuration (5.5.1). The order, partial declarations and substitution are undefined. | Resolve declaration first, then binding, then catalog. A declaration and the resolved server must not contradict each other. | [AEP-0007](../aep/0007-mcp-connection-catalog.md) | implemented, integration tests |
| G71 | should | `server.*` also allows tools that a server adds after the review, and unattended steps run them unseen. | An explicit tools list for unattended executions. Tool annotations are untrusted unless the platform pins the server. | AEP-0007 | shown: the catalog hides two tools of the server, and calls to them are refused |
| G72 | should | MCP prompts, resources and server requests (sampling, roots, elicitation) are not covered. An engine shows server prompts as commands without any rule of the manifest. | Allow lists for `prompts` and `resources`, default none. No relay of sampling or roots unless allowed; elicitation is declined. This answers AEP-0007 open question 3. | AEP-0007 | shown (one prompt and rule resources of the analysis server) |
| G73 | should | Tool sources are fixed per manifest, so a person cannot enable only some of them for one execution. The alternative is one reviewed manifest per combination. | A runtime MAY narrow the tool sources of an execution, never widen them. The narrowing is recorded in the audit. | spec 5.5, AEP-0026 | shown |
| G74 | should | `shell.execute` has no resource format (7.5.2), but a command line chains, substitutes and nests commands. | The resource is each simple command. Lines that cannot be split are denied. An allow list does not restrict what an allowed program runs (`make`, `npm test`). | [AEP-0002](../aep/0002-tool-argument-constraints.md) | shown: `echo` and `git --version` ran; `curl`, `echo a; id` and `echo $(id)` were refused |
| G75 | minor | There is no reusable prompt outside a workflow step. The runtime offers shared prompts to sessions as commands. | `Prompt` ([AEP-0005](../aep/0005-prompt-kind.md)) also serves as a task of an interactive execution. It is plain user input, grants nothing and may suggest a mode. | AEP-0005 | implemented |
| G76 | should | Audit events can come from the engine (inside), the user interface or the model gateway (outside). AWP does not say which source is trustworthy. | Events about model calls SHOULD come from the component that holds the credentials. Every event carries its origin. | [AEP-0009](../aep/0009-audit-payload-levels.md) | shown (gateway audit with a hash chain per conversation) |
| G77 | should | Data flow to tool sources. A scan tool receives source code as an argument. Nothing says which data may go to which source (in the cluster or external), and the tool server's own egress is outside `permissions.network`. | Allowed data classes per tool source, and logging of the passed content with its own retention. The source's own network limit is runtime guidance. | open (5.5, 7.2, AEP-0009) | shown: arguments in the audit, the server's egress only through its own proxy |
| G78 | should | Budgets during streaming. Providers report usage at the end of a stream. The runtime estimates and aborts, so a session can end slightly above `maxCostUsd`. | Budgets are hard limits that the last call may exceed. Estimates during a call are allowed. With G35. | [AEP-0013](../aep/0013-runtime-clarifications.md) | implemented, overshoot not measured |
| G79 | should | A person brings a secret when starting an execution (a personal token). The manifest can neither express nor restrict this. | `secretsPolicy` on agents and workflows. Secrets supplied at start fall under the same MUSTs as declared ones. With G05 and G36. | spec 7.9 | shown: a secret value reached the model only as a placeholder |
| G80 | minor | A standalone `Agent` has no agent id for the secret `scope`. | A scope value `self`, or `metadata.name` as the id. | spec 7.9 | implemented |
| G81 | must | Repository content as instructions. Repositories bring agent instruction files, skills, commands and tool manager configuration with environment variables, and an engine loads them by default. | Configuration from workspace content is off unless the manifest allows it explicitly, and it is untrusted input. | AEP-0027, spec 12 | implemented (disabled in the engine) |
| G82 | should | An agent has exactly one model, but sessions pick from alternatives that the binding and the tenant allow. | Model alternatives or a model policy on `Agent`, intersected with ceilings. | AEP-0026, spec 7.4 | implemented |
| G83 | should | A workspace has several repositories with clone credentials, and the credential must not reach the engine. Extends G12. | `workspace.repositories`. Git credentials stay outside the execution environment, like G61. | AEP-0027, with G12 | implemented; private repositories not shown |
| G84 | should | The agent asks a person questions during interactive work. Behaviour without a person is undefined. | AEP-0017 covers sessions. Without a person, questions are declined. Answers are no approvals. | [AEP-0017](../aep/0017-human-input.md) | implemented (audited answers) |
| G85 | should | The history of an interactive execution after it ends: its content, read access, retention and tamper evidence. | History is audit content with its own retention. | AEP-0009, AEP-0026 | in progress |
| G86 | should | The actor of a session started by an event. Extends G44 and G48. | The same attested actor as in G44. Define the creator and who may control the session. | [AEP-0024](../aep/0024-event-triggers.md) | concept |
| G87 | should | Several steps or agents share one workspace (plan, implement, review). | Workspaces with an access mode per step, under AEP-0025, and the trust boundary in spec 12. | [AEP-0025](../aep/0025-state.md) | concept |

Not numbered: messages between running agents of one runtime (concept only). Engines also need
context size, output limit and input types from the model catalog; this is evidence for G60.

**Which objects should become AWP kinds (extends K).** The platform needed nine custom resources.
For each one the question was whether it should be an AWP kind or stay with the runtime. Rule: an
object becomes an AWP kind if an author or reviewer governs it and it must mean the same on every
runtime. It stays implementation-specific if it says how a platform realises something, and then
attaches with `targetRefs` or `parametersRef` (AEP-0021 B5, B6).

| Object in the proof of concept | Proposal | Reason |
| --- | --- | --- |
| Session object | AWP kind `Session` (AEP-0026), sibling of `WorkflowRun` | An execution that people start, pause and stop. Its spec fields (agent, repositories, mode, tool source selection, model choice) are governed and portable. |
| Run object | AWP `WorkflowRun` (AEP-0019) | Built only because the draft was not applied yet. |
| Prompt library | AWP `Prompt` (AEP-0005), extended for sessions | Reviewed content, the same on every runtime. |
| MCP server catalog entry | split: catalog facts (tools, prompts, resources, allow lists) in `McpCatalog` (AEP-0007); endpoint and credentials in runtime configuration | The same split as `ModelCatalog` and provider configuration (AEP-0008, G59). |
| Model provider | split as in AEP-0008 | Prices and limits are facts. The endpoint and credentials are deployment data. |
| Agent and workflow bindings | implementation-specific, `targetRefs` (AEP-0021 B6) | Placement, images, secret mapping. AEP-0021 B6 should also allow `Agent` targets. |
| Tenant | implementation-specific | Tenancy, sign-in groups and quotas are platform matters. AWP defines what a ceiling may restrict and how a rejection is reported (G68), not the object that holds it. |
| Sandbox profile | implementation-specific, behind `agents[].isolation` (G67) | Like `StorageClass` or `RuntimeClass`: the manifest asks for a class, the platform maps it to a mechanism. |
| Gateways, proxies | not an object of AWP | Mechanisms. AWP states only the property they provide (outside the execution environment). |

## 11. Questions for the project lead

1. Do the three drafted AEPs (G01, G07, G08) join the `v1alpha3` scope table in the decision log,
   once they reach `Review`?
2. G03 state and G05 secret scopes are the remaining **must** entries without an AEP. Draft them
   next?
3. G02, G04, G06, G22: apply AEP-0001, AEP-0003, AEP-0012 and AEP-0014 to the `v1alpha3` draft as
   well, so that a runtime can test them?
4. K, G26 and G39: a normative Kubernetes mapping in spec 3.10, or an informative page on the website?
5. G09: should this repository publish the validator as a container image for admission webhooks?
6. G13 (`finally`) and G24 with G34 (token and turn limits, model parameters):
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
10. G62 to G87 (section 10): confirm the two new AEP numbers, AEP-0026 (interactive execution)
    and AEP-0027 (agent engine), and that G64, G67, G68 and G69 extend AEP-0023 rather than
    getting an AEP of their own.
11. Which objects become AWP kinds (section 10): `Session` as a new kind, `Prompt` and
    `McpCatalog` as already proposed, and tenants, sandbox profiles and bindings left to the
    runtime?
