# Agentic Workflow Protocol (AWP) Specification - v1alpha2

| | |
| --- | --- |
| **API version** | `awp.agenticworkflowprotocol.org/v1alpha2` |
| **Status** | **Draft / alpha.** Not stable. |
| **Date** | 2026-11-18 |
| **License** | Text: [CC BY 4.0](../../LICENSE-SPEC). Examples, schemas and code: [Apache-2.0](../../LICENSE) |
| **Glossary** | [glossary.md](glossary.md) |
| **Examples** | [examples/](examples/) |

> **Status of this document.** This is a working draft of the second alpha version of AWP. It
> starts from `v1alpha1` and aligns the document model with the Kubernetes resource model, as
> proposed by [AEP-0000](../../aep/0000-kubernetes-resource-model.md) (not accepted): governance
> fields move from `metadata` to `spec`, extension fields move into `extensions` objects, and
> `status` is reserved for runtimes. It also contains the schedule semantics and the human input
> proposed in [aep/0000-schedule-semantics.md](../../aep/0000-schedule-semantics.md) and
> [aep/0000-human-input.md](../../aep/0000-human-input.md), the step output interface of
> [aep/0000-step-outputs.md](../../aep/0000-step-outputs.md), the kind `WorkflowRun` and status
> conditions of [aep/0000-workflow-run-and-status.md](../../aep/0000-workflow-run-and-status.md) and
> the pinning of executions of [aep/0000-execution-pinning.md](../../aep/0000-execution-pinning.md)
> (all Draft, not accepted). Every field, every semantic rule and every conformance
> requirement in this document may change incompatibly in a later alpha version. Implementations
> SHOULD NOT rely on `v1alpha2` for production interoperability. No implementation is conformant
> to this version at the time of writing. Changes from `v1alpha1` are listed in
> [section 14.1](#141-changes-from-v1alpha1).

> **Compliance.** AWP provides machine-readable governance primitives that can help
> organizations implement and enforce their own compliance requirements. Using AWP does not make
> a system compliant with any law, regulation or standard. Compliance depends on the
> implementation, organizational controls and applicable regulatory requirements.

## Contents

1. [Introduction](#1-introduction)
2. [Notational conventions](#2-notational-conventions)
3. [Document model](#3-document-model)
4. [Metadata and common spec fields](#4-metadata-and-common-spec-fields)
5. [Kind `Workflow`](#5-kind-workflow)
6. [Kind `Agent`](#6-kind-agent)
7. [Governance](#7-governance)
8. [Kind `Policy` and policy evaluation](#8-kind-policy-and-policy-evaluation)
9. [Supply chain integrity](#9-supply-chain-integrity)
10. [Execution, audit and traceability](#10-execution-audit-and-traceability)
11. [Conformance](#11-conformance)
12. [Security considerations](#12-security-considerations)
13. [Privacy considerations](#13-privacy-considerations)
14. [Versioning](#14-versioning)
15. [References](#15-references)

---

## 1. Introduction

### 1.1 Purpose

The Agentic Workflow Protocol (AWP) is an open, declarative specification for defining,
governing, executing and auditing agentic workflows. An AWP document (a *manifest*) describes:

- **what** a workflow does: its agents, tools, steps, triggers and inputs;
- **within which limits** it may run: budgets, resources, permissions and environments;
- **under which governance** it runs: ownership, data classification, data residency, model
  governance, human approval, risk levels, separation of duties and supply-chain integrity;
- **what it leaves behind**: audit events, decision traces and reproducibility records.

A *runtime* reads a manifest, validates it, enforces its limits and governance rules while
executing it, and emits audit events with standardized semantics.

AWP is a specification, not a platform. It does not depend on a specific runtime, model
provider, tool vendor or hosting service.

### 1.2 Relationship to other protocols

| Protocol | Scope |
| -------- | ----- |
| Model Context Protocol (MCP) | How an agent connects to tools and resources. |
| Agent2Agent (A2A) | How agents communicate with each other. |
| AWP | How agentic workflows are defined, governed, executed and audited. |

AWP does not replace MCP or A2A. A manifest references MCP servers as tool sources
([section 5.5](#55-tools-and-action-identifiers)) and A2A endpoints as remote agents
([section 5.4.4](#544-remote-agents-a2a)). The wire protocols themselves are out of scope.

### 1.3 Non-goals

AWP does not define:

- a model API, a prompt format or an agent reasoning strategy;
- the internal reasoning of models. AWP never requires an implementation to record, expose or
  store private chain-of-thought data (see [section 10.6](#106-decision-trace));
- a cryptographic storage format for audit logs (see [section 10.5](#105-tamper-evidence));
- a registry or distribution protocol for manifests;
- legal or regulatory classifications. Risk levels and data classes in AWP are an
  organizational vocabulary, not a regulatory taxonomy.

---

## 2. Notational conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT",
"RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as
described in BCP 14 ([RFC 2119], [RFC 8174]) when, and only when, they appear in all capitals, as
shown here.

Sections, notes and examples marked as *non-normative* do not contain requirements. All YAML
examples in this document and in [examples/](examples/) are non-normative, but they are intended
to be valid against the rules of this document; a discrepancy is a defect of the example.

The JSON Schema of this API version ([schema/awp.v1alpha2.json](../../schema/awp.v1alpha2.json)) is
normative for document structure (field names, types, required fields, closed objects,
enumerations and patterns). This document is normative for semantics and runtime behaviour. A
discrepancy between the two is a defect that is corrected by an erratum; until then, validators
follow the schema for structure.

Terms such as *manifest*, *runtime*, *execution*, *step*, *action* and *actor* are defined in the
[glossary](glossary.md).

Field tables use the following columns: **Field**, **Type**, **Req.** (`yes` = REQUIRED,
`no` = OPTIONAL, `cond.` = conditionally required as described) and **Description**.

---

## 3. Document model

### 3.1 Serialization

An AWP manifest is a single document consisting of a mapping (object). Manifests MUST be
representable as JSON [RFC 8259]. Implementations MUST accept YAML 1.2 and JSON. When YAML is
used, implementations MUST reject documents that use YAML features without a JSON equivalent
(custom tags, non-string mapping keys, anchors that create cycles). A file MAY contain several
YAML documents separated by `---`; each document is an independent manifest.

### 3.2 Top-level structure

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `apiVersion` | string | yes | MUST be `awp.agenticworkflowprotocol.org/v1alpha2` for this version. |
| `kind` | string | yes | One of `Workflow`, `Agent`, `Policy`, `WorkflowRun`. |
| `metadata` | object | yes | Object identity: name, namespace, labels and annotations ([section 4.1](#41-metadata)). |
| `spec` | object | yes | Desired state written by the author: the common fields of [section 4.2](#42-common-spec-fields) and the kind-specific content. |
| `status` | object | no | Observed state, written by a runtime or an object store. Reserved. |

A manifest has no other top-level fields. This is the structure of a Kubernetes resource, so that
a manifest can be stored unchanged as a Kubernetes custom resource or in any other object store
([section 3.10](#310-object-stores-and-kubernetes)).

`Workflow`, `Agent` and `Policy` are written by authors, versioned and covered by digests and
signatures. `WorkflowRun` is an execution object ([section 10.8](#108-kind-workflowrun)): it
requests and reports one execution, has none of the common spec fields of
[section 4.2](#42-common-spec-fields), and is not covered by digests or signatures.

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha2
kind: Workflow
metadata:
  name: hello
spec:
  version: 0.1.0
  owner:
    team: platform-team
  agents:
    - id: assistant
      model:
        provider: ollama
        name: qwen3
  workflow:
    - id: greet
      agent: assistant
      task: Say hello.
```

Implementations MUST reject a manifest whose `apiVersion` they do not support. Implementations
MUST reject a manifest whose `kind` they do not support.

`status` is reserved for the runtime or object store that holds the manifest. Authors do not write
it. Validators MUST ignore `status` and MUST NOT reject a manifest because of its content, so that
a manifest read back from an object store stays valid. `status` is not covered by the digest
([section 9.1](#91-manifest-digest)). Its shape is described in [section 3.11](#311-status). Runtimes MUST NOT derive a governance decision from the
`status` of a manifest that they did not write themselves.

### 3.3 Unknown fields and extensions

1. **Extension fields** are the members of an `extensions` object. Every object in `spec` that has
   defined fields MAY have an `extensions` field, including `spec` itself; `metadata` has none
   (non-identifying data belongs in annotations). The keys of `extensions` MUST start with `x-`
   and SHOULD follow the conventions of the informative
   [list of extension prefixes](../../docs/registry/extension-prefixes.md); the values are
   arbitrary. Implementations MAY interpret extension fields and MUST otherwise ignore them.
   Extension fields MUST NOT weaken any requirement of this specification.

   ```yaml
   workflow:
     - id: analyze
       agent: worker
       extensions:
         x-example-cache: warm
   ```

   A field whose name starts with `x-` outside an `extensions` object is an unknown field.
   Rationale: a Kubernetes structural schema cannot describe fields with variable names next to
   defined fields; an `extensions` object can, and it keeps the extension on the object it
   modifies.
2. Any other field that is not defined by this specification is an **unknown field**.
   Implementations MUST reject a manifest that contains an unknown field. Rationale: a governance
   control that a runtime silently ignores is worse than an error (fail closed).
3. A field that is defined by this specification but belongs to a conformance profile the
   implementation does not support MUST cause the manifest to be rejected with an error that
   names the field and the missing profile. Implementations MUST NOT execute such a manifest
   while ignoring the field. The profile-bound fields are:

   | Profile | Fields |
   | ------- | ------ |
   | `governance` | `spec.dataPolicy`, `spec.modelPolicy`, `spec.approval`, `spec.policies`, `spec.environments`, steps with `type: approval`, `spec.risk` with `level` `high` or `critical` |
   | `audit` | `spec.audit` |
   | `security` | `spec.signature` |
   | `mcp` | `spec.mcpServers`, tool sources with `type: mcp` |
   | `a2a` | agents with `protocol: a2a` |
   | `interaction` | steps with `type: input`, agents with `humanInput`, `spec.humanInput` of an `Agent` |

   All other fields, including `spec.owner`, `spec.classification`, `spec.risk` with
   `level` `low` or `medium`, `spec.permissions`, `spec.secrets` and `spec.integrity`, belong
   to the `core` profile. Governance metadata in core is descriptive; it is enforced by the
   `governance` profile.

### 3.4 Names and identifiers

- **Object names** (`metadata.name`, `metadata.namespace`): MUST be DNS-1123 labels: at most 63
  characters, lowercase letters, digits and `-`, starting and ending with a letter or a digit
  (`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`). Kubernetes and most other object stores accept these
  names unchanged.
- **Names** (input names, secret names in `spec.secrets`, MCP server names):
  MUST match `^[a-zA-Z][a-zA-Z0-9_-]{0,62}$`. Secret names MAY use `UPPER_SNAKE_CASE`.
- **Identifiers** (agent `id`, step `id`, rule `id`): MUST match `^[a-z][a-z0-9-]{0,62}$` and
  MUST be unique within their list.
- **Action identifiers**: see [section 5.5.3](#553-action-identifiers).

### 3.5 Versions

`spec.version` MUST be a Semantic Version 2.0.0 string ([SemVer]). A published manifest
version SHOULD be immutable: two manifests with the same `kind`, `metadata.name` and
`spec.version` but different content SHOULD be treated as an integrity error by registries and
runtimes that can detect it (see [section 9](#9-supply-chain-integrity)).

### 3.6 Durations

Durations are strings matching `^([0-9]+(ms|s|m|h|d|w|y))+$`, for example `30s`, `15m`, `1h30m`,
`24h`, `7y`. Units: `ms` milliseconds, `s` seconds, `m` minutes, `h` hours, `d` days (24 h), `w`
weeks (7 d), `y` years (365 d). A duration MUST be greater than zero.

### 3.7 Timestamps and dates

Timestamps are strings in RFC 3339 format with time zone, for example `2026-10-05T13:42:11Z`.
Dates are RFC 3339 `full-date` strings, for example `"2027-01-01"`. In YAML, dates and
timestamps SHOULD be quoted so that parsers keep them as strings.

### 3.8 Digests

Digests are strings of the form `<algorithm>:<lowercase hex>`. Implementations MUST support
`sha256` (64 hex characters) and MAY support `sha384` and `sha512`. Implementations MUST reject a
digest with an unsupported algorithm when verification is required.

### 3.9 Expressions

String fields marked as *expression-enabled* MAY contain expressions of the form
`${{ <reference> }}`. In `v1alpha2` a reference is exactly one of:

- `inputs.<name>`: the value of a workflow input;
- `steps.<step-id>.outputs.<name>`: an output of a previous step;
- `execution.id`, `execution.environment`: the execution identifier and environment name.

There are no operators, functions or nested expressions in `v1alpha2`. Implementations MUST
reject a manifest with any other expression syntax inside `${{ }}`. A reference to
`steps.<step-id>` MUST only be used in a step that depends on `<step-id>` directly or
transitively ([section 5.6.3](#563-execution-model)); otherwise the manifest MUST be rejected.

Expression-enabled fields are: `task`, `env` values, `permissions.tools.*.resources` entries and
`approval.message`. In particular, `command` is **not** expression-enabled
([section 5.6.2](#562-command-steps)).

### 3.10 Object stores and Kubernetes

A manifest is a plain YAML or JSON document. AWP does not require Kubernetes: every rule of this
document applies to a manifest read from a file, a Git repository, a registry or a database. The
document model is chosen so that the same manifest can also be stored unchanged in an object store
with Kubernetes semantics.

- An **object store** holds manifests as objects identified by API group, `kind`,
  `metadata.namespace` and `metadata.name`. The Kubernetes API server is one object store; a
  runtime without Kubernetes MAY implement its own, for example a database table or a directory of
  files. `metadata.namespace` is an isolation scope. A runtime without scopes treats every
  manifest as part of one implicit scope and MAY ignore `metadata.namespace`.
- An object store MAY add the fields it populates to `metadata` (`uid`, `resourceVersion`,
  `generation`, `creationTimestamp`, `deletionTimestamp`, `deletionGracePeriodSeconds`,
  `finalizers`, `ownerReferences`, `managedFields`) and MAY write `status`. Validators MUST accept
  and ignore these fields. They are not covered by the digest.
- **Kubernetes binding.** Each kind is a namespaced custom resource of the API group
  `awp.agenticworkflowprotocol.org`, version `v1alpha2`, with the plural names `workflows`,
  `agents`, `policies` and `workflowruns` and a `status` subresource. The repository publishes
  CustomResourceDefinitions generated from the JSON Schema ([schema/crd/](../../schema/crd/)).
  The JSON Schema stays normative.
- A Kubernetes structural schema cannot express every rule of the JSON Schema (conditional fields,
  patterns that need lookahead, key patterns of maps) and none of the semantic rules. The
  generated CustomResourceDefinitions therefore keep unknown fields instead of pruning them, so
  that they remain visible to validation. A runtime MUST validate every manifest it reads from an
  object store against the full rules of this document before acting on it, and MUST NOT act on a
  manifest that fails validation (fail closed, [section 3.3](#33-unknown-fields-and-extensions)).
  Implementations SHOULD also validate on write, for example with a validating admission webhook.
- Clients that write manifests to a Kubernetes API server SHOULD use strict field validation
  (for example `kubectl apply --validate=strict`), so that misplaced fields are reported to the
  author instead of being stored or dropped.
- A runtime MUST NOT modify the `spec` of a manifest. Observed state belongs in `status` or in
  other objects.

### 3.11 Status

`status` is optional. A runtime that writes it SHOULD use the shapes of this section and of
[section 10.8](#108-kind-workflowrun), so that tools can read the state of any runtime in the same
way. The JSON Schema defines them as `StatusCondition`, `ManifestStatus` and `WorkflowRunStatus`.
Validators still ignore `status` ([section 3.2](#32-top-level-structure)).

**Conditions.** `status.conditions` is a list of objects in the shape of Kubernetes
`metav1.Condition`. The `type` of each entry is unique within the list.

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `type` | string | yes | Condition type in CamelCase, optionally with a DNS subdomain prefix (`runtime.example.com/Bound`). |
| `status` | string | yes | `True`, `False` or `Unknown`. |
| `reason` | string | yes | Machine-readable reason in CamelCase, for example `SchemaInvalid`. |
| `message` | string | yes | Human-readable detail; MAY be empty. MUST NOT contain secret values. |
| `lastTransitionTime` | timestamp | yes | When `status` last changed. |
| `observedGeneration` | integer | no | The `metadata.generation` the condition was computed for. |

**Manifest status.** On `Workflow`, `Agent` and `Policy`, a runtime SHOULD write:

- `observedGeneration`: the `metadata.generation` it last processed, where the object store has
  generations.
- `digest`: the digest it computed for the manifest ([section 9.1](#91-manifest-digest)).
- Condition `Valid`: `True` with reason `Validated` if the manifest passed every rule of this
  document that applies to the runtime's supported profiles; otherwise `False` with one of the
  reasons `ApiVersionUnsupported`, `SchemaInvalid`, `SemanticInvalid`, `ProfileUnsupported`,
  `DigestMismatch` or `SignatureInvalid`. The message SHOULD name the first diagnostic (code and
  path).
- Condition `Ready`: `True` if the object can be used now: for a `Workflow`, executions can start
  (valid, references resolved, policies loaded, triggers registered); for an `Agent` or `Policy`,
  workflows can use it. Otherwise `False` with a reason, for example `Invalid`,
  `ReferenceUnresolved`, `PolicyUnavailable` or `EnvironmentNotAllowed`.

Rules:

- The condition types `Valid`, `Ready`, `Accepted` and `Succeeded` without prefix are reserved for
  AWP. Other condition types of a runtime MUST carry a DNS subdomain prefix that the runtime
  controls.
- `status` is a view for people and tools. It is not an audit record (the events of
  [section 10](#10-execution-audit-and-traceability) are), and runtimes MUST NOT derive a
  governance decision from a `status` they did not write ([section 3.2](#32-top-level-structure)).
- The generated CustomResourceDefinitions type `status` with these shapes and show `Valid` and
  `Ready` as columns of `kubectl get`.

---

## 4. Metadata and common spec fields

### 4.1 Metadata

`metadata` identifies an object. It contains only fields that have the same meaning in a
Kubernetes `ObjectMeta`, so that object stores and deployment tools keep them intact.

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `name` | string | yes | Name of the workflow, agent or policy ([section 3.4](#34-names-and-identifiers)). |
| `namespace` | string | no | Isolation scope in an object store ([section 3.10](#310-object-stores-and-kubernetes)). Usually set by the object store or the deployment tool, not by the author. |
| `labels` | map of string | no | Labels for selection and grouping, in Kubernetes label syntax: a key is an optional DNS subdomain prefix and `/`, then a name of at most 63 characters (alphanumeric at both ends, `-`, `_` and `.` inside); a value has at most 63 characters of the same set and MAY be empty. |
| `annotations` | map of string | no | Non-identifying metadata. Keys use the label key syntax; values are arbitrary strings. |

Fields populated by an object store are listed in [section 3.10](#310-object-stores-and-kubernetes).
Any other field in `metadata` is an unknown field.

- Deployment tools (for example GitOps controllers) add and change labels and annotations.
  Implementations MUST NOT derive governance decisions from labels or annotations, and neither is
  covered by the digest.

### 4.2 Common spec fields

The following fields are common to the `spec` of every kind. In `v1alpha1` they were part of
`metadata`.

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `version` | string | yes | SemVer version of this manifest ([section 3.5](#35-versions)). |
| `description` | string | no | Human-readable description. |
| `owner` | object | yes | Ownership ([section 7.1](#71-identity-and-ownership)). |
| `classification` | string | cond. | Highest data class the workflow is designed to handle ([section 7.2](#72-data-classification)). REQUIRED for `Workflow` and `Agent` when the governance profile is used. |
| `purpose` | string | no | Intended purpose, in plain language. |
| `risk` | object | no | Risk level and categories ([section 7.7](#77-risk-levels)). |
| `integrity` | object | no | Digest of this manifest ([section 9.1](#91-manifest-digest)). |
| `signature` | object | no | Detached signature reference ([section 9.2](#92-signatures)). |
| `provenance` | object | no | Provenance reference ([section 9.3](#93-provenance)). |

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha2
kind: Workflow
metadata:
  name: invoice-processing
  labels:
    app.kubernetes.io/part-of: finance
spec:
  version: 1.2.0
  owner:
    team: finance-ai
  classification: personal
  risk:
    level: high
  agents:
    - id: extractor
      model:
        provider: example-provider
        name: example-model
  workflow:
    - id: extract
      agent: extractor
```

Workflows, agents and policies are identified by (`kind`, `metadata.name`, `spec.version`) and,
when present, `spec.integrity.digest`. `metadata.namespace` is not part of the identity: the same
manifest deployed into two namespaces is the same version.

---

## 5. Kind `Workflow`

A `Workflow` describes a unit of agentic work: the agents and tools it may use, the steps it
executes, the limits it runs within and the governance that applies to it.

### 5.1 `spec` fields

| Field | Type | Req. | Section |
| ----- | ---- | ---- | ------- |
| `triggers` | list | no | [5.2](#52-triggers) |
| `inputs` | list | no | [5.3](#53-inputs) |
| `budget` | object | no | [5.7](#57-budgets-and-resources) |
| `agents` | list | yes | [5.4](#54-agents) |
| `mcpServers` | list | no | [5.5.1](#551-mcp-servers) |
| `actionGroups` | map | no | [5.5.4](#554-action-groups) |
| `workflow` | list | yes | [5.6](#56-workflow-steps) |
| `secrets` | list | no | [7.9](#79-secrets) |
| `environment` | object | no | [7.10](#710-environments) |
| `environments` | map | no | [7.10](#710-environments) |
| `permissions` | object | no | [7.5](#75-tool-governance-permissions) |
| `dataPolicy` | object | no | [7.2](#72-data-classification), [7.3](#73-data-residency-and-processing) |
| `modelPolicy` | object | no | [7.4](#74-model-governance) |
| `approval` | object | no | [7.6](#76-human-approval) |
| `policies` | object | no | [8.1](#81-workflow-policies) |
| `audit` | object | no | [10.2](#102-audit-configuration) |

A complete example is [examples/vulnerability-fixer.workflow.yaml](examples/vulnerability-fixer.workflow.yaml).
A governance-heavy example is [examples/invoice-processing.workflow.yaml](examples/invoice-processing.workflow.yaml).

### 5.2 Triggers

`spec.triggers` lists the ways an execution can be started. If `triggers` is absent, the workflow
can only be started manually. Each entry has a `type`:

| `type` | Fields | Description |
| ------ | ------ | ----------- |
| `manual` | - | Started by a human or an API call on behalf of a human. |
| `schedule` | `cron` (REQUIRED, 5-field cron expression), `timezone` (IANA name, default `UTC`) | Started on a schedule. |
| `event` | `source` (REQUIRED), `eventType` (REQUIRED), `filter` (map of string, OPTIONAL) | Started by an external event, for example a webhook. |

```yaml
triggers:
  - type: manual
  - type: schedule
    cron: "0 6 * * 1-5"
    timezone: Europe/Berlin
  - type: event
    source: git.example.com
    eventType: pull_request.opened
    filter:
      repository: example-org/web-shop
```

- Implementations MUST record the trigger that started an execution in the `workflow.started`
  event.
- The mapping of `source` and `eventType` to concrete event sources is implementation-defined.
  Implementations MUST verify the authenticity of event sources they support (for example
  webhook signatures) and MUST NOT start an execution for an event that fails verification.
- A `schedule` trigger supplies no input values: an execution it starts uses the `default` of
  each input ([section 5.3](#53-inputs)). A workflow with a required input therefore cannot be
  started by its `schedule` triggers.
**Schedule semantics.** A `schedule` trigger has these additional fields:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `concurrencyPolicy` | string | no | What happens at a tick while an execution started by this trigger is still running: `forbid` (default) skips the tick, `allow` starts another execution, `replace` cancels the running execution and starts a new one. |
| `startingDeadline` | duration | no | How late an execution for a missed tick may still start. Absent: missed ticks are skipped. |

```yaml
triggers:
  - type: schedule
    cron: "0 */2 * * *"
    timezone: Europe/Berlin
    concurrencyPolicy: forbid
    startingDeadline: 15m
```

- A **tick** is a point in time matched by `cron` in `timezone`. Each tick starts at most one
  execution. The runtime MUST use the tick time, not the start time, as `scheduledAt` in the
  `trigger` data of `workflow.started`.
- `concurrencyPolicy` only considers executions started by the same trigger entry of the same
  workflow (`kind`, `metadata.namespace`, `metadata.name`), regardless of their version. Manual and
  event-triggered executions are not considered. With `replace`, the runtime MUST cancel the
  running execution as if an actor of type `system` had cancelled it, emit `workflow.cancelled`
  with `reason: replaced`, and start the new execution only after the cancellation has completed.
  The default is `forbid` because agent executions often run longer than a cron interval.
- A tick is **missed** when the runtime could not start an execution at the tick time, for
  example because it was not running. Without `startingDeadline` the runtime MUST NOT start
  executions for missed ticks. With `startingDeadline` the runtime MAY start one execution for the
  latest missed tick if the current time is at most `startingDeadline` after that tick; it MUST
  NOT start executions for older missed ticks and MUST NOT start more than one execution to catch
  up.
- For every tick that does not start an execution (skipped by `forbid`, missed, or past
  `startingDeadline`) the runtime MUST emit `trigger.skipped` with the tick time and the reason
  ([section 10.4](#104-event-types)). A runtime that cannot determine individual missed ticks (for
  example after a long outage) MAY emit one `trigger.skipped` event with the first and the last
  missed tick.
- An execution started by `schedule` or `event` has the actor type `system`; an execution started
  by `manual` has the actor type `human` (see [section 10.3](#103-event-envelope)).

### 5.3 Inputs

`spec.inputs` declares the parameters of an execution.

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `name` | string | yes | Input name. |
| `type` | string | yes | `string`, `integer`, `number`, `boolean`, `object`, `array` or `artifact` (a reference to a file or document). |
| `required` | boolean | no | Default `false`. |
| `default` | any | no | Default value. MUST match `type`. MUST NOT be set when `required` is `true`. |
| `description` | string | no | Description. |
| `pattern` | string | no | ECMA-262 regular expression for `string` inputs. |
| `enum` | list | no | Allowed values. |
| `classification` | string | no | Data class of the input ([section 7.2](#72-data-classification)). Default: `spec.classification`. |

- Implementations MUST validate all inputs against their declaration **before** the execution
  starts and MUST NOT start an execution with invalid or missing required inputs.
- Inputs MUST NOT be used to pass secrets. Secrets are declared in `spec.secrets` and referenced
  with `secretRef` ([section 7.9](#79-secrets)).

### 5.4 Agents

`spec.agents` declares the agents a workflow may use. An entry is one of three forms: an
**inline agent**, an **agent reference** or a **remote agent**.

#### 5.4.1 Inline agents

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `id` | string | yes | Identifier, unique within the workflow. |
| `model` | object | yes | Model selection and model governance metadata ([section 5.4.3](#543-model-object)). |
| `instructions` | string | no | System-level instructions for the agent. |
| `promptRef` | object | no | Reference to a versioned prompt template: `name`, `version` (REQUIRED), `digest` (OPTIONAL). MUST NOT be combined with `instructions`. |
| `tools` | list | no | Tool sources ([section 5.5](#55-tools-and-action-identifiers)). Default: no tools. |
| `permissions` | object | no | Agent-level permissions ([section 7.5](#75-tool-governance-permissions)). |
| `budget` | object | no | Agent-level budget ([section 5.7](#57-budgets-and-resources)). |
| `humanInput` | object | no | Lets the agent ask a person during its step ([section 5.8.2](#582-agent-requests)). |

```yaml
agents:
  - id: researcher
    model:
      provider: anthropic
      name: claude
    instructions: Summarize affected files and the recommended fix.
    tools:
      - type: mcp
        server: github
        tools:
          - search_code
          - get_file_contents
```

#### 5.4.2 Agent references

An agent reference uses a separately published manifest of kind `Agent` ([section 6](#6-kind-agent)).

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `id` | string | yes | Identifier within this workflow. |
| `ref` | object | yes | `name` (REQUIRED), `version` (REQUIRED, exact SemVer version, no ranges), `digest` (OPTIONAL). |
| `permissions` | object | no | Additional restrictions. |
| `budget` | object | no | Additional limits. |

- An agent reference MUST NOT contain `model`, `instructions`, `promptRef` or `tools`.
- How a runtime resolves a reference (registry, file system, repository) is implementation-defined.
- If `ref.digest` is present, the runtime MUST verify that the resolved `Agent` manifest has this
  digest ([section 9.1](#91-manifest-digest)) and MUST reject the workflow on mismatch.
- `permissions` and `budget` of the reference can only **restrict** the referenced agent further
  (see [section 7.5.4](#754-combining-permissions) and [section 5.7](#57-budgets-and-resources)).

#### 5.4.3 Model object

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `provider` | string | yes | Provider identifier, for example `anthropic`, `openai`, `azure-openai`, `bedrock`, `ollama`, `vllm`. Provider identifiers are opaque strings; their mapping to endpoints is implementation-defined. |
| `name` | string | yes | Model name or family as known to the provider. |
| `version` | string | no | Exact model version or snapshot identifier. |
| `region` | string | no | Region where the model processes data, for example `EU`. Used by data residency checks. |
| `approval` | object | no | `status` (`approved`, `pending`, `rejected`, `revoked`), `expires` (date), `approvedBy` (string). |
| `riskClassification` | string | no | `low`, `medium`, `high` or `critical` (organizational model risk). |
| `evaluation` | object | no | `status` (`passed`, `failed`, `pending`, `notEvaluated`), `ref` (URI of an evaluation report). |
| `allowedUseCases` | list of string | no | Use cases the model is approved for. |

```yaml
model:
  provider: openai
  name: gpt-5
  version: "2026-08"
  approval:
    status: approved
    expires: "2027-01-01"
```

- If `version` is absent, the runtime chooses the version and MUST record the version actually
  used in the reproducibility record ([section 10.7](#107-reproducibility-record)) when the
  provider reports it.
- The governance fields (`approval`, `riskClassification`, `evaluation`, `allowedUseCases`) are
  declarations by the manifest author. Runtimes implementing the governance profile MAY replace
  them with values from an authoritative model inventory and SHOULD do so when one is configured.

#### 5.4.4 Remote agents (A2A)

A remote agent is executed by another system and reached through the A2A protocol.

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `id` | string | yes | Identifier within this workflow. |
| `protocol` | string | yes | MUST be `a2a`. |
| `endpoint` | string | yes | HTTPS URL of the A2A endpoint. |
| `agentCard` | object | no | `url` (REQUIRED), `digest` (OPTIONAL) of the remote agent card. |
| `auth` | object | no | `secretRef` to the credential ([section 7.9](#79-secrets)). |

```yaml
agents:
  - id: security-agent
    protocol: a2a
    endpoint: https://agents.example.com/a2a/security-review
    auth:
      secretRef: REVIEW_AGENT_TOKEN
```

- A remote agent MUST NOT contain `model`, `instructions`, `promptRef` or `tools`: the local
  runtime cannot enforce them.
- Every message sent to a remote agent is the action `a2a.<id>.send` and is subject to
  permissions, policies, approvals and data policies like any tool action
  ([section 7](#7-governance)). For data residency and processing checks, the provider identifier
  of a remote agent is the host name of `endpoint`.
- If `agentCard.digest` is present, the runtime MUST verify the agent card before the first
  message and MUST NOT contact the agent on mismatch.
- The runtime MUST NOT send `http://` (unencrypted) traffic to remote agents.

Example: [examples/security-review.a2a.workflow.yaml](examples/security-review.a2a.workflow.yaml).

### 5.5 Tools and action identifiers

#### 5.5.1 MCP servers

`spec.mcpServers` declares MCP servers that agents may use.

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `name` | string | yes | Server name, referenced by tool sources. |
| `transport` | string | yes | `stdio` or `streamable-http`. |
| `url` | string | cond. | REQUIRED for `streamable-http`. MUST use `https`. |
| `image` | string | cond. | For `stdio`: container image that runs the server. SHOULD be pinned by digest (`name@sha256:...`); MUST be pinned by digest under the security profile. |
| `version` | string | no | Expected server version. |
| `auth` | object | no | `secretRef` to the credential. |

If a tool source references a server that is not declared in `spec.mcpServers`, the runtime MAY
resolve it from its own configuration ("binding"). Portable manifests SHOULD declare all servers.
The runtime MUST reject a manifest that references a server it can resolve neither way.

#### 5.5.2 Tool sources

Agents list tool sources in `tools`:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `type` | string | yes | `mcp` or `builtin`. |
| `server` | string | cond. | REQUIRED for `mcp`: name of an MCP server. |
| `name` | string | cond. | REQUIRED for `builtin`: name of a runtime-provided tool, for example `shell`. |
| `tools` | list of string | no | For `mcp`: the tool names of the server the agent may see. Default: all tools of the server. |

- The runtime MUST only expose to an agent the tools of the listed sources, filtered by `tools`
  when present. Exposure does not imply permission: every call is still evaluated
  ([section 7.5](#75-tool-governance-permissions)).
- Built-in tools are implementation-defined. The built-in tool `shell` corresponds to the action
  `shell.execute`.

#### 5.5.3 Action identifiers

An **action** is any operation of a workflow that has an effect outside the model: a tool call, a
command step, a message to a remote agent. Every action has an **action identifier**:

- an MCP tool call has the identifier `<server>.<tool>`, for example `github.search_code`;
- a command step and a call of the built-in `shell` tool have the identifier `shell.execute`;
- a message to a remote agent has the identifier `a2a.<agent-id>.send`;
- other built-in tools have implementation-defined identifiers.

Action identifiers MUST match `^[a-zA-Z][a-zA-Z0-9_-]*(\.[a-zA-Z0-9_-]+)+$`. In permission keys,
policy conditions and approval lists, a final segment `*` matches any action with that prefix
(for example `github.*`).

**Well-known actions.** The following identifiers have reserved meaning. Manifests map concrete
tool actions to them with action groups ([section 5.5.4](#554-action-groups)), so that
governance rules can be written independently of tool vendors:

| Identifier | Meaning |
| ---------- | ------- |
| `shell.execute` | Execute a command in a shell or sandbox. |
| `git.push` | Push commits to a remote repository. |
| `git.forcePush` | Rewrite history on a remote repository. |
| `git.merge` | Merge a change into a protected or default branch. |
| `pullRequest.create` | Open a pull/merge request. |
| `production.deploy` | Deploy to a production environment. |
| `external.communication` | Send information to a party outside the organization (mail, chat, public comment). |

Model invocations are not actions. They are governed by the model policy and the data policy
([sections 7.3](#73-data-residency-and-processing) and [7.4](#74-model-governance)).

#### 5.5.4 Action groups

`spec.actionGroups` maps a group identifier to a list of action identifiers:

```yaml
actionGroups:
  github.read:
    - github.search_code
    - github.get_file_contents
  git.merge:
    - github.merge_pull_request
```

- A group identifier MUST be a valid action identifier and MAY be a well-known action.
- An action **matches** a key (in permissions, approvals and policies) if the key equals the
  action identifier, if the key is a group that contains the action, or if the key is a wildcard
  pattern that matches the action identifier.
- Groups MUST NOT contain other groups.
- If no group maps a concrete action to a well-known action, rules on that well-known action do
  not apply to it. Manifest authors are responsible for complete mappings; runtimes SHOULD warn
  (`awp lint`) when a tool is likely to have such an effect but is not mapped. Runtimes MAY
  provide built-in mappings for tools they know and MUST document them.

### 5.6 Workflow steps

`spec.workflow` is a list of steps. Steps form a directed acyclic graph through `dependsOn`.

#### 5.6.1 Common step fields

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `id` | string | yes | Step identifier, unique within the workflow. |
| `type` | string | no | `agent`, `command`, `approval` or `input`. Default: `agent`. |
| `dependsOn` | list of string | no | Step identifiers that MUST complete successfully before this step starts. |
| `timeout` | duration | no | Maximum wall-clock time of the step. |
| `retries` | integer | no | Number of retries after a failure. Default `0`. MUST NOT exceed `budget.resources.maxRetries` if set. |
| `outputs` | list | no | Declared outputs: `name` (REQUIRED, `^[A-Za-z_][A-Za-z0-9_]{0,62}$`, also the file name of [section 5.6.4](#564-step-outputs)), `classification` (OPTIONAL), `description` (OPTIONAL). |
| `budget` | object | no | Step-level limits; can only restrict the workflow budget. |

Fields per type:

| `type` | Fields |
| ------ | ------ |
| `agent` | `agent` (REQUIRED, id of an entry in `spec.agents`), `task` (OPTIONAL, expression-enabled string: the task for this step) |
| `command` | `command` (REQUIRED, string), `image` (OPTIONAL, container image), `env` (OPTIONAL, map of expression-enabled strings), `workingDir` (OPTIONAL) |
| `approval` | `approval` (REQUIRED, object with `approvers`, `minApprovals`, `timeout`, `onTimeout`, `message`; see [section 7.6](#76-human-approval)) |
| `input` | `input` (REQUIRED, object with `message`, `answerSchema`, `answerers`, `timeout`, `onTimeout`, `default`, `classification`; see [section 5.8](#58-human-input)) |

```yaml
workflow:
  - id: investigate
    agent: researcher
    task: "Investigate ${{ inputs.cve }} in ${{ inputs.repository }}."
  - id: fix
    agent: fixer
    dependsOn:
      - investigate
  - id: test
    type: command
    command: npm test
    dependsOn:
      - fix
```

#### 5.6.2 Command steps

- A command step is the action `shell.execute` and is subject to permissions, policies and
  approvals like any other action.
- `command` is **not** expression-enabled. Implementations MUST NOT substitute expressions into
  the command text. Values from inputs and step outputs are passed as environment variables
  through `env`:

  ```yaml
  - id: scan
    type: command
    command: ./scripts/scan.sh "$REPOSITORY"
    env:
      REPOSITORY: "${{ inputs.repository }}"
    dependsOn:
      - fix
  ```

  Rationale: interpolating untrusted values (inputs, model output) into a shell command is a
  command injection vulnerability.
- Implementations MUST execute command steps in an isolated environment (for example a
  container or sandbox) and MUST apply `permissions.network` and `permissions.filesystem` to it.
- The step succeeds if the command exits with status `0`.

#### 5.6.3 Execution model

1. The runtime MUST reject a workflow whose steps contain a cycle, a duplicate `id`, a
   `dependsOn` entry that names a non-existent step, or an `agent` that names a non-existent
   agent.
2. A step becomes **ready** when all steps in its `dependsOn` have the status `succeeded`.
   Steps without `dependsOn` are ready when the execution starts.
3. Ready steps MAY run concurrently, limited by `budget.resources.maxConcurrency` (default `1`).
   When several steps are ready and concurrency is limited, the runtime SHOULD start them in the
   order in which they appear in `spec.workflow`.
4. Step statuses are `pending`, `running`, `waitingForApproval`, `waitingForInput`, `succeeded`,
   `failed`, `skipped` and `cancelled`. If a step fails (after its retries), all steps that depend on it
   directly or transitively MUST get the status `skipped`.
5. An **agent step** runs the agent with its task until the agent signals completion
   ([section 5.6.4](#564-step-outputs)), a limit is
   reached or the step times out. During the step, the agent MAY call the tools exposed to it;
   each call is an action.
6. An execution **succeeds** if every step has the status `succeeded`. Otherwise it fails. An
   execution is **cancelled** if it was stopped by an actor before completion.
7. Outputs of a step are available to dependent steps through expressions. Outputs that are not
   declared in `outputs` MUST NOT be referenced. How steps produce outputs is defined in
   [section 5.6.4](#564-step-outputs).

#### 5.6.4 Step outputs

A step produces the values of its declared `outputs` in a way that does not depend on the
runtime, so that a command image or an agent prompt works on every runtime.

**Command steps.**

- Before the command starts, the runtime creates an empty directory that only this attempt of the
  step can write, and passes its absolute path in the environment variable `AWP_OUTPUTS`. The
  directory is writable even if `permissions.filesystem` does not list it.
- To produce an output, the command writes a regular file named exactly like the output into that
  directory, for example `"$AWP_OUTPUTS/report"`. The value is the content of the file as UTF-8
  text; one trailing line feed is removed. A file that is not valid UTF-8 fails the step with the
  reason `outputInvalid`.
- After the command has exited with status `0`, the runtime reads the files of the declared
  outputs. It MUST NOT follow symbolic links. Files and directories with other names are ignored;
  the runtime SHOULD warn about them.
- The runtime also sets `AWP_EXECUTION_ID` ([section 10.1](#101-execution-identity)), `AWP_STEP_ID`
  and `AWP_ATTEMPT` (starting at `1`). Names with the prefix `AWP_` are reserved for the runtime;
  `env` MUST NOT define them.
- Standard output and standard error are logs, not outputs.

```yaml
- id: count
  type: command
  image: registry.example.com/tools/diff@sha256:...
  command: ./diff.sh > "$AWP_OUTPUTS/new" && wc -l < "$AWP_OUTPUTS/new" > "$AWP_OUTPUTS/count"
  dependsOn:
    - collect
  outputs:
    - name: new
    - name: count
```

**Agent steps.**

- The runtime MUST offer the agent a way to end its step together with the values of the declared
  outputs. It SHOULD be a built-in tool named `complete_step` with one string parameter per
  declared output, described by the output's `description`. Like the tool for human input
  ([section 5.8.2](#582-agent-requests)), it is not an action: permissions and policies do not
  apply to it and it is not listed in `tools`.
- If an agent step declares outputs and the agent ends without completing the step, the step fails
  with the reason `notCompleted`. A step without outputs is also completed when the agent ends its
  turn without a tool call.
- A runtime MAY accept other completion formats (for example a structured final message) and
  documents them; prompts that rely on them are not portable.

**Input steps** provide the output `answer` ([section 5.8](#58-human-input)). Approval steps
produce no outputs.

**All steps.**

- A runtime MUST accept outputs of at least 256 KiB each and 1 MiB per step in total. It MAY
  accept more and states its limits in the conformance statement
  ([section 11.3](#113-conformance-statement)). A larger output fails the step with the reason
  `outputTooLarge`; the runtime MUST NOT truncate it.
- A declared output that the step did not produce has no value. Referencing it is an evaluation
  error; the step that did not produce it still succeeds.
- Outputs of an attempt that fails, times out or is cancelled are discarded. Only the outputs of
  the successful attempt are available to dependent steps.
- Each produced output is recorded as `artifact.created` with its digest, and with its content only
  under `payload: full` ([section 10.4](#104-event-types)).

### 5.7 Budgets and resources

`budget` limits an execution. It MAY appear on the workflow (`spec.budget`), on an agent and on a
step.

| Field | Type | Description |
| ----- | ---- | ----------- |
| `maxCostUsd` | number | Maximum cost in US dollars. |
| `maxSteps` | integer | Maximum number of steps of progress: each model invocation and each command execution counts as one. |
| `maxDuration` | duration | Maximum wall-clock duration. |
| `resources.maxTokens` | integer | Maximum number of model tokens (input plus output). |
| `resources.maxToolCalls` | integer | Maximum number of actions. |
| `resources.maxRetries` | integer | Maximum number of retries per step. |
| `resources.maxConcurrency` | integer | Maximum number of concurrently running steps. |

```yaml
budget:
  maxCostUsd: 5.00
  maxSteps: 50
  maxDuration: 30m
  resources:
    maxTokens: 100000
    maxToolCalls: 100
```

- All limits MUST be positive. Absent limits are unlimited, except `maxConcurrency` (default `1`)
  and `maxRetries` (default `0`).
- Limits are **nested**: usage of a step counts against the step, its agent and the workflow.
  When several levels define the same limit, the effective limit is the minimum.
- The runtime MUST check limits before each model invocation and each action. When a limit
  would be exceeded, the runtime MUST NOT start the invocation or action, MUST stop the
  execution with the status `failed`, SHOULD cancel running steps, and MUST emit
  `workflow.failed` with `reason: budgetExceeded` and the exceeded limit.
- Implementations MUST document how they compute cost. If the cost of an invocation cannot be
  determined, the runtime MUST report `costKnown: false` in the usage data of the execution and
  SHOULD use a configured price instead of zero.
- Runtimes MAY enforce stricter limits than the manifest declares (for example tenant quotas).

### 5.8 Human input

An execution can ask a person for information and wait for the answer: an input step asks a
question defined in the manifest, and an agent with `humanInput` may ask questions of its own
during its step. Human input is close to elicitation in the Model Context Protocol: a message, a
flat schema for a structured answer, and the outcomes *answered*, *declined* and *expired*.
Human input belongs to the `interaction` profile.

An answer is information, not a decision. It never grants an approval
([section 7.6](#76-human-approval)), never changes permissions, policies or budgets, and never
changes the manifest of a running execution.

#### 5.8.1 Input steps

A step with `type: input` asks the question in its `input` object:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `message` | string | yes | Expression-enabled question shown to the answerers. |
| `answerSchema` | object | no | Schema of a structured answer ([section 5.8.3](#583-answer-schema)). Absent: the answer is free text (a string). |
| `answerers` | list | yes | Who may answer: entries with exactly one of `role` or `user`, matched like approvers ([section 7.6](#76-human-approval)). |
| `timeout` | duration | no | Time after which the open request expires. Default: no timeout (the step timeout and `maxDuration` still apply). |
| `onTimeout` | string | no | `fail` (default) fails the step; `useDefault` completes the step with `default` as the answer. |
| `default` | any | cond. | REQUIRED with `onTimeout: useDefault`. MUST be a valid answer. |
| `classification` | string | no | Data class of the answer ([section 7.2](#72-data-classification)). Default: `spec.classification`. |

```yaml
workflow:
  - id: ask-targets
    type: input
    dependsOn:
      - analyze
    input:
      message: "Which environment should ${{ steps.analyze.outputs.report }} be applied to?"
      answerSchema:
        type: object
        properties:
          environment:
            type: string
            enum: [staging, production]
        required: [environment]
      answerers:
        - role: release-manager
      timeout: 4h
      onTimeout: useDefault
      default:
        environment: staging
  - id: apply
    agent: worker
    task: "Apply the fix to ${{ steps.ask-targets.outputs.answer }}."
    dependsOn:
      - ask-targets
```

- An input step has the implicit output `answer`: the validated answer (a string, or an object
  that matches `answerSchema`). It is referenced as `steps.<id>.outputs.answer`.
- The step succeeds when an answerer provides a valid answer, or on expiry with `onTimeout:
  useDefault`. It fails when an answerer declines or when it expires with `onTimeout: fail`.
- The first valid answer completes the request; later answers MUST be rejected.

#### 5.8.2 Agent requests

An agent with a `humanInput` object (inline agents and `Agent` manifests) may ask questions during
its step. The runtime offers the agent a built-in tool for this; the agent supplies a message and
optionally an answer schema, and receives the answer, or the information that the request was
declined or expired, as the tool result.

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `answerers` | list | yes | Who may answer, as for input steps. |
| `timeout` | duration | no | Expiry of each request. Default: no timeout. |
| `onTimeout` | string | no | `return` (default) returns the expiry to the agent, which continues; `fail` fails the step. |
| `maxRequests` | integer | no | Maximum number of requests per step. Default: unlimited. |
| `classification` | string | no | Data class of the answers. Default: `spec.classification`. |

```yaml
agents:
  - id: fixer
    model:
      provider: example-provider
      name: example-model
    humanInput:
      answerers:
        - role: maintainer
      timeout: 30m
      maxRequests: 3
```

- The runtime MUST validate the schema supplied by the agent against
  [section 5.8.3](#583-answer-schema) and MUST reject the request (as a tool error) if it is
  invalid or if `maxRequests` is reached.
- A request of an agent is not an action and is not subject to permissions. The message is
  composed by the model; the runtime MUST apply the data policy to it as to any output shown to a
  person, and MUST show answerers that the question comes from an agent.
- An agent without `humanInput` has no such tool. If an MCP server of the agent requests
  elicitation, the runtime MUST decline it unless the agent has `humanInput`; with `humanInput` the
  runtime MAY present it as a request of this section and MUST decline elicitation requests whose
  schema does not conform to [section 5.8.3](#583-answer-schema).

#### 5.8.3 Answer schema

`answerSchema` is the requested-schema subset of MCP elicitation: an object with `type: object`,
`properties` and optional `required`. Every property is a primitive field:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `type` | string | `string`, `number`, `integer` or `boolean` (REQUIRED). |
| `title`, `description` | string | Label and help text. |
| `enum` | list of string | Allowed values (only for `string`). |
| `format` | string | `email`, `uri`, `date` or `date-time` (only for `string`). |
| `minLength`, `maxLength` | integer | Length bounds for `string`. |
| `minimum`, `maximum` | number | Bounds for `number` and `integer`. |

- `required` MUST name fields of `properties`.
- The runtime MUST validate every answer against the schema and MUST NOT accept an invalid answer.
- Answer schemas MUST NOT ask for secrets or credentials. Secrets are declared in `spec.secrets`
  ([section 7.9](#79-secrets)).

#### 5.8.4 Answerers and lifecycle

- An answer MUST come from an authenticated human actor that matches `answerers`. Agents MUST NOT
  be able to answer, also not through tools or remote agents. Answers delivered through a chat or
  messaging integration count only if the runtime can attribute them to such an actor.
- When a request is created, the runtime MUST emit `input.requested`; when it is answered,
  declined or expires, `input.provided`, `input.declined` or `input.expired`
  ([section 10.4](#104-event-types)).
- The answer is data of the class `classification`. Data and model policies apply to it like to
  any other input of a model. In audit events the answer content follows the `payload` rules
  ([section 10.2](#102-audit-configuration)): with `payload: metadata` events carry a digest of the
  answer, not its content.
- Waiting for an answer counts against the step `timeout` and `budget.maxDuration`.

---

## 6. Kind `Agent`

An `Agent` manifest defines a reusable agent that workflows reference with `ref`
([section 5.4.2](#542-agent-references)).

| `spec` field | Type | Req. | Description |
| ------------ | ---- | ---- | ----------- |
| `model` | object | yes | [Section 5.4.3](#543-model-object). |
| `instructions` | string | no | System-level instructions. |
| `promptRef` | object | no | Versioned prompt template. MUST NOT be combined with `instructions`. |
| `tools` | list | no | Tool sources ([section 5.5.2](#552-tool-sources)). |
| `mcpServers` | list | no | MCP servers used by the tool sources ([section 5.5.1](#551-mcp-servers)). |
| `actionGroups` | map | no | Action groups ([section 5.5.4](#554-action-groups)). |
| `permissions` | object | no | Permissions ([section 7.5](#75-tool-governance-permissions)). |
| `budget` | object | no | Default limits for every use of the agent. |
| `secrets` | list | no | Secrets the agent needs ([section 7.9](#79-secrets)). |
| `humanInput` | object | no | Lets the agent ask a person during its step ([section 5.8.2](#582-agent-requests)). |

Example: [examples/invoice-extractor.agent.yaml](examples/invoice-extractor.agent.yaml).

- An `Agent` manifest cannot be executed on its own. Runtimes MAY offer a way to run a single
  agent; they MUST then treat it as a workflow with one agent step and the agent's `budget` and
  `permissions`.
- When a workflow references an agent, the governance sections of the workflow (`dataPolicy`,
  `modelPolicy`, `approval`, `policies`, `environments`) apply to the agent. The agent's
  `permissions` and the workflow's `permissions` are combined ([section 7.5.4](#754-combining-permissions)).
- Secrets declared by the agent MUST also be declared by the workflow; the workflow controls
  their source.

---

## 7. Governance

This section defines governance primitives. Runtimes that implement the **governance** profile
MUST enforce them as specified. They are designed to support organizational controls; whether
they are sufficient for a given legal or regulatory requirement depends on the organization, its
processes and its implementation.

### 7.1 Identity and ownership

`spec.owner` identifies who is accountable for a workflow, agent or policy.

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `team` | string | yes | Responsible team. |
| `contact` | string | no | Contact address (role or team address, not a personal one where avoidable). |
| `businessOwner` | string | no | Accountable business owner. |
| `technicalOwner` | string | no | Accountable technical owner. |
| `dataOwner` | string | no | Owner of the data processed. |

```yaml
spec:
  version: 1.2.0
  owner:
    team: finance-ai
    contact: finance-ai@example.com
```

- Under the governance profile, runtimes MUST reject `Workflow` and `Agent` manifests without
  `spec.owner.team` and `spec.classification`.
- Runtimes MUST include `metadata.name`, `spec.version` and `spec.owner.team` in the
  `workflow.started` event.

### 7.2 Data classification

Data classes, from least to most restrictive:

| Class | Rank | Meaning |
| ----- | ---- | ------- |
| `public` | 0 | Intended for publication. |
| `internal` | 1 | For use inside the organization. |
| `confidential` | 2 | Limited to a defined group. |
| `personal` | 2 | Personal data. At least as restrictive as `confidential`. |
| `restricted` | 3 | Strictly limited; disclosure causes serious harm. |
| `sensitive` | 3 | Special categories of personal data. At least as restrictive as `restricted`. |
| `secret` | 4 | Highest protection. |

Comparisons with `gt`, `gte`, `lt`, `lte` use the rank. `personal` and `sensitive` are
additionally *personal-data classes*, which conditions can select with `in`. These classes are an
organizational vocabulary; their mapping to legal definitions is up to the organization.

`spec.dataPolicy`:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `classification` | string | Highest class this workflow may process. Default: `spec.classification`. |
| `inputs` | list | `name`, `classification` per input (overrides the input declaration). |
| `outputs` | list | `name`, `classification` per step output. |
| `restrictions.externalTransfer` | string | `allow` or `deny` (default `allow`): whether data may be sent to actions matching `external.communication` and to remote agents. |
| `residency` | object | [Section 7.3](#73-data-residency-and-processing). |
| `processing` | object | [Section 7.3](#73-data-residency-and-processing). |

```yaml
dataPolicy:
  classification: confidential
  inputs:
    - name: customer_data
      classification: personal
  outputs:
    - name: report
      classification: internal
  restrictions:
    externalTransfer: deny
```

- The runtime MUST reject an execution whose input classification ranks higher than
  `dataPolicy.classification`.
- The runtime MUST track, for every model invocation and action, the highest class of the data
  it was given (*data classification of the operation*). At minimum, the class of an operation in
  a step is the highest class of the inputs and step outputs the step references. Runtimes MAY
  track classes more precisely.
- An output without a declared class inherits the highest class of the data its step processed.
  A declared output class lower than that is a **declassification**; the runtime MUST record it in
  the `artifact.created` event.
- With `externalTransfer: deny`, actions matching `external.communication` and messages to remote
  agents MUST be denied when the operation's class ranks `internal` or higher.

### 7.3 Data residency and processing

```yaml
dataPolicy:
  residency:
    allowed:
      - EU
  processing:
    allowedProviders:
      - azure-openai
      - ollama
    forbiddenProviders:
      - public-cloud-us
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `residency.allowed` | list of string | Regions where data may be processed. Region identifiers are organizational strings (for example `EU`, `DE`, `on-premise`). |
| `processing.allowedProviders` | list of string | Provider identifiers (models: `model.provider`; remote agents: endpoint host) that may receive data. |
| `processing.forbiddenProviders` | list of string | Provider identifiers that MUST NOT receive data. Takes precedence over `allowedProviders`. |

- Before each model invocation and each message to a remote agent, the runtime MUST determine the
  destination provider and region. The region of a model is `model.region` or, if absent, the
  region configured for the provider in the runtime. The region of a remote agent is configured
  in the runtime.
- If `residency.allowed` is set and the destination region is not in the list **or cannot be
  determined**, the operation MUST be denied (fail closed).
- If `processing.allowedProviders` is set, operations to other providers MUST be denied.
- Denials MUST emit `policy.denied`.

### 7.4 Model governance

`spec.modelPolicy` restricts which models may be used.

```yaml
modelPolicy:
  allowedProviders:
    - openai
    - azure-openai
    - ollama
  allowedModels:
    - gpt-5
    - qwen3
    - claude
  forbiddenModels:
    - unapproved-model
  requirements:
    approvalStatus: approved
    encryption: true
    region: EU
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `allowedProviders` | list | Allowed `model.provider` values. |
| `allowedModels` | list | Allowed `model.name` values. |
| `forbiddenModels` | list | Forbidden `model.name` values; take precedence. |
| `requirements.approvalStatus` | string | Required `model.approval.status` (typically `approved`). Expired approvals (`expires` in the past) do not satisfy it. |
| `requirements.encryption` | boolean | If `true`, the runtime MUST only use provider connections that it has configured as encrypted in transit (TLS). |
| `requirements.region` | string | Required `model.region`. |
| `requirements.evaluationStatus` | string | Required `model.evaluation.status`. |

- The runtime MUST validate every agent's model against `modelPolicy` before the execution
  starts and MUST reject the execution if a model does not satisfy it.
- If a runtime substitutes models at run time (fallbacks), the substitute MUST satisfy
  `modelPolicy` as well, and the substitution MUST be recorded in the audit trail.

### 7.5 Tool governance: permissions

`permissions` controls which actions an agent or workflow may perform. It MAY appear on the
workflow (`spec.permissions`), on an inline agent, on an agent reference and in an `Agent`
manifest.

```yaml
permissions:
  default: deny
  tools:
    github.read:
      allow: true
    github.write:
      allow: true
    shell.execute:
      allow: true
    production.deploy:
      allow: false
  network:
    egress: deny
    allowHosts:
      - mcp.example.com
  filesystem:
    read:
      - /workspace
    write:
      - /workspace/out
  secrets:
    - GITHUB_TOKEN
```

#### 7.5.1 Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `default` | string | `allow` or `deny`: decision for actions not matched by any key in `tools`. Default `deny` when `permissions` is present. |
| `tools` | map | Keys are action identifiers, group identifiers or wildcard patterns. Values: `allow` (boolean, REQUIRED), `resources` (list of expression-enabled strings, OPTIONAL). |
| `network.egress` | string | `allow` or `deny` (default `allow`): outbound network access of command steps and built-in tools. |
| `network.allowHosts` | list | Host names reachable when `egress` is `deny`. |
| `filesystem.read`, `filesystem.write` | list | Paths readable/writable by command steps and built-in tools. If set, all other paths MUST be inaccessible. |
| `secrets` | list | Names of secrets the agent or workflow may use. Default: all secrets declared in `spec.secrets` that are scoped to the agent's tool sources. |
| `environments` | list | Environment names in which this agent or workflow may run. Default: all. |

#### 7.5.2 Resource scopes

`resources` restricts an allowed action to specific targets (for example a repository). The
runtime MUST document, per tool, how it derives the target resource of a call. If `resources` is
set and the runtime cannot determine the resource of a call, the call MUST be denied.

#### 7.5.3 Absent permissions

If no `permissions` object applies to an agent, every action of the tools exposed to it is
allowed by permissions (other governance rules still apply). Runtimes implementing the security
profile MUST warn about this (`awp lint`) and MAY require `permissions` by configuration.

#### 7.5.4 Combining permissions

When several `permissions` objects apply (workflow, agent manifest, agent reference), an action
is allowed by permissions only if **every** applicable object allows it. `network` and
`filesystem` restrictions combine to the intersection. Within one object, a key with
`allow: false` that matches an action takes precedence over keys with `allow: true`.

### 7.6 Human approval

Approvals are human decisions that gate actions or steps.

```yaml
approval:
  requiredFor:
    - production.deploy
    - git.merge
    - external.communication
  approvers:
    - role: security-reviewer
  timeout: 24h
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `requiredFor` | list | Action keys (identifiers, groups, wildcards) that require approval before each execution of the action. |
| `approvers` | list | Each entry has exactly one of `role` (a role name resolved by the runtime's identity system) or `user` (a user identifier). An approver matches if they match any entry. |
| `minApprovals` | integer | Number of distinct approvers required. Default `1`. |
| `timeout` | duration | Time after which an open request expires. |
| `onTimeout` | string | `reject` (default) or `fail`. `reject` treats expiry as a rejection of the action; `fail` fails the step. |
| `message` | string | Expression-enabled message shown to approvers. |
| `separationOfDuties` | object | [Section 7.8](#78-separation-of-duties). |

- When an action matches `requiredFor` (or a policy rule requires approval, see
  [section 8](#8-kind-policy-and-policy-evaluation)), the runtime MUST pause before executing the
  action, emit `approval.requested`, and MUST NOT execute the action until `minApprovals`
  approvals are granted. A rejection MUST prevent the action and MUST emit `approval.rejected`.
  Expiry MUST emit `approval.expired`.
- An approval applies to exactly one action request, identified by the event id of its
  `tool.requested` event. It MUST NOT be reused for other requests.
- The approval request MUST show approvers at least: workflow name and version, step, action
  identifier, arguments (with secrets redacted), the data classification of the operation and the
  decision record if one exists ([section 10.6](#106-decision-trace)).
- An **approval step** (`type: approval`) gates the steps that depend on it. It succeeds when
  approved and fails when rejected or expired.
- An answer to a human input request ([section 5.8](#58-human-input)) MUST NOT be treated as an
  approval, even if it comes from an approver.
- Agents MUST NOT be able to grant approvals. An approval MUST be granted by an authenticated
  human actor.

Diagram (non-normative):

```
Agent -> Analyze -> Implement -> Test -> [Human Approval: security review, policy check] -> Deploy
```

### 7.7 Risk levels

`spec.risk` declares the organizational risk of a workflow or agent:

```yaml
risk:
  level: high
  category:
    - security
    - financial
```

`level` is one of `low`, `medium`, `high`, `critical`. `category` is a list of free-form strings.

Risk levels are an organizational governance model, not a regulatory classification. AWP
RECOMMENDS the following default treatment, which runtimes implementing the governance profile
SHOULD apply unless configured otherwise:

| Level | Default treatment |
| ----- | ----------------- |
| `low` | Autonomous execution within permissions and policies. |
| `medium` | As `low`, and every action produces a `policy.evaluated` event. |
| `high` | As `medium`, and every action other than read-only actions configured in the runtime requires human approval. |
| `critical` | Execution is prohibited unless explicitly approved: the execution MUST NOT start before an approval of the execution itself has been granted. |

Policy rules can select on `risk.level` ([section 8](#8-kind-policy-and-policy-evaluation)).

### 7.8 Separation of duties

```yaml
approval:
  separationOfDuties:
    enabled: true
    rules:
      - actorCannotApproveOwnAction: true
      - initiatorCannotApprove: true
```

| Rule | Meaning |
| ---- | ------- |
| `actorCannotApproveOwnAction` | The human on whose behalf an action is requested (including the human who started the execution, for actions of agents in it) MUST NOT approve it. |
| `initiatorCannotApprove` | The actor who started the execution MUST NOT approve any request in it. |
| `distinctApprovers` | With `minApprovals` > 1, each approval MUST come from a different human. Always in effect; listed for completeness. |

When `enabled` is `true`, the runtime MUST reject approvals that violate a rule and MUST record
the rejection reason.

Example flow (non-normative): *agent creates pull request -> developer reviews -> security
approves -> release manager deploys*, with each human a different actor.

### 7.9 Secrets

Secrets MUST NOT appear in manifests. A manifest declares which secrets exist and references them
by name.

```yaml
secrets:
  - name: GITHUB_TOKEN
    source: secret-manager
    scope:
      - github
```

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `name` | string | yes | Secret name. |
| `source` | string | yes | Opaque identifier of the secret store, resolved by the runtime (for example `secret-manager`, `vault`, `kubernetes`). |
| `key` | string | no | Key of the secret within the store. Default: `name`. |
| `scope` | list | no | MCP server names, agent ids or `command` that may receive the secret. Default: none. |

- Fields that need a credential use `secretRef: <name>` (for example `mcpServers[].auth.secretRef`).
  A `secretRef` MUST name a secret declared in `spec.secrets` whose `scope` includes the consumer;
  otherwise the manifest MUST be rejected.
- Runtimes MUST reject manifests that contain fields named `token`, `password`, `apiKey`,
  `secret` or `privateKey` with a literal value anywhere outside `extensions` objects, and SHOULD
  reject values that look like credentials.
- Runtimes MUST NOT pass secret values to models, MUST NOT include them in audit events, logs or
  approval requests, and MUST redact them if they appear in tool output.

### 7.10 Environments

`spec.environment.name` declares the default target environment of executions; the actual
environment of an execution MAY be set when the execution is started. `spec.environments`
declares how autonomy differs per environment:

```yaml
environment:
  name: production
environments:
  development:
    autonomy: unrestricted
  staging:
    autonomy: controlled
  production:
    autonomy: approval-required
    autoApprove:
      - erp.read
```

| `autonomy` | Meaning |
| ---------- | ------- |
| `unrestricted` | Permissions, policies and `approval.requiredFor` apply as declared. |
| `controlled` | As `unrestricted`, and every action produces a `policy.evaluated` event. |
| `approval-required` | Every action requires human approval, except actions matching `autoApprove`. |
| `prohibited` | Executions in this environment MUST NOT start. |

- The environment of an execution MUST be recorded in `workflow.started`.
- If `spec.environments` is present and the execution's environment is not listed, the execution
  MUST NOT start.
- Environment names are organizational strings. The runtime is responsible for ensuring that an
  execution labelled with an environment actually runs with that environment's credentials and
  targets; AWP cannot verify this.

---

## 8. Kind `Policy` and policy evaluation

### 8.1 Workflow policies

`spec.policies` of a workflow contains **policy shorthands** for common rules and references to
reusable `Policy` manifests.

```yaml
policies:
  git:
    allowPush: true
    allowForcePush: false
  pullRequest:
    allowCreate: true
  merge:
    allow: false
  production:
    allow: false
  include:
    - name: no-production-autonomy
      version: 1.0.0
```

| Shorthand | Equivalent rule |
| --------- | --------------- |
| `git.allowPush: false` | deny actions matching `git.push` |
| `git.allowForcePush: false` | deny actions matching `git.forcePush` |
| `pullRequest.allowCreate: false` | deny actions matching `pullRequest.create` |
| `merge.allow: false` | deny actions matching `git.merge` |
| `production.allow: false` | deny actions matching `production.deploy` |

A shorthand with the value `true` adds no rule (it does not grant permissions; see
[section 8.4](#84-decision-combination)). `include` lists `Policy` manifests by `name` and exact
`version`, optionally with `digest`; resolution follows the rules for agent references
([section 5.4.2](#542-agent-references)).

### 8.2 Kind `Policy`

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha2
kind: Policy
metadata:
  name: no-production-autonomy
spec:
  version: 1.0.0
  owner:
    team: platform-governance
  rules:
    - id: deploy-needs-release-manager
      when:
        action:
          equals: production.deploy
      effect: requireApproval
      approval:
        approvers:
          - role: release-manager
```

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha2
kind: Policy
metadata:
  name: eu-data-residency
spec:
  version: 1.0.0
  owner:
    team: data-protection
  rules:
    - id: personal-data-stays-in-eu
      when:
        data.classification:
          in:
            - personal
            - sensitive
        destination.region:
          notIn:
            - EU
      effect: deny
```

Rule fields:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `id` | string | yes | Rule identifier, unique within the policy. |
| `when` | map | yes | Conditions; all MUST hold for the rule to apply ([section 8.3](#83-conditions)). |
| `effect` | string | yes | `deny` or `requireApproval`. |
| `approval` | object | cond. | REQUIRED for `requireApproval`: `approvers`, `minApprovals`, `timeout`, `onTimeout` as in [section 7.6](#76-human-approval). |
| `message` | string | no | Message for denials and approval requests. |

Policy rules can only restrict: there is no `allow` effect. Permissions grant, policies restrict.

### 8.3 Conditions

`when` maps **attributes** to an operator object. All entries are combined with logical AND.
(`v1alpha1` also accepted a plain value as shorthand for `equals`; a Kubernetes structural schema
cannot describe a field that is either a string or an object.)

| Attribute | Value |
| --------- | ----- |
| `action` | Action identifier; matched like permission keys (groups, wildcards). |
| `environment.name` | Environment of the execution. |
| `risk.level` | `spec.risk.level` of the workflow; ordered `low` < `medium` < `high` < `critical`. |
| `data.classification` | Classification of the operation ([section 7.2](#72-data-classification)). |
| `destination.provider` | Provider identifier of a model invocation or remote agent. |
| `destination.region` | Region of a model invocation or remote agent. |
| `model.provider`, `model.name` | Model of the current agent. |
| `actor.type` | `agent`, `human`, `runtime` or `system`. |
| `workflow.name`, `step.id`, `agent.id` | Names and identifiers. |

Operators: `in`, `notIn` (lists), `equals`, `notEquals`, and for ordered attributes
(`data.classification`, `risk.level`) `gt`, `gte`, `lt`, `lte`.

- Rules are evaluated before every action and, for rules that use `destination.*`,
  `data.classification` or `model.*` without `action`, also before every model invocation.
- If an attribute used by a condition cannot be determined, a rule with effect `deny` MUST be
  treated as applying (fail closed), and a rule with effect `requireApproval` MUST be treated as
  applying.

### 8.4 Decision combination

For every action, the runtime MUST compute one decision as follows:

1. If permissions ([section 7.5](#75-tool-governance-permissions)) do not allow the action:
   **deny**.
2. Else, if any applicable `deny` rule (shorthand, policy, data policy, model policy, environment
   `prohibited`) applies: **deny**.
3. Else, if the action matches `approval.requiredFor`, an applicable `requireApproval` rule, the
   environment autonomy or the risk-level treatment requires approval: **require approval**. All
   applicable approval requirements MUST be satisfied (union of approver constraints, maximum of
   `minApprovals`, minimum of `timeout`).
4. Else: **allow**.

The runtime MUST emit `policy.evaluated` for every decision under the audit profile, and
`policy.denied` plus `tool.denied` for every denied action. Runtimes MAY delegate evaluation to an
external policy engine if the resulting decisions are identical to this algorithm.

---

## 9. Supply chain integrity

The goal: *know what runs before you let it run.*

### 9.1 Manifest digest

The digest of a manifest is computed over the JSON Canonicalization Scheme ([RFC 8785])
serialization of a JSON object with exactly these members:

- `apiVersion` and `kind` of the manifest;
- `metadata`, containing only `name`;
- `spec`, **with `spec.integrity`, `spec.signature` and `spec.provenance` removed**.

`metadata.namespace`, labels, annotations, fields populated by an object store and `status` are
not covered: deployment tools and object stores change them without changing what the manifest
does, and a manifest read back from an object store MUST still verify. Extension fields in `spec`
are covered.

```yaml
metadata:
  name: invoice-processing
spec:
  version: 1.2.0
  owner:
    team: finance-ai
  integrity:
    digest: sha256:9b2f6c1e4d8a0b7c3e5f1a2d4c6b8e0f1a3c5e7b9d0f2a4c6e8b0d1f3a5c7e9b
```

- If `spec.integrity.digest` is present, runtimes MUST verify it before execution and MUST
  reject the manifest on mismatch.
- References (`ref.digest`, `include[].digest`, `agentCard.digest`) MUST be verified the same
  way.

### 9.2 Signatures

`spec.signature` references a detached signature over the manifest digest:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `format` | string | Signature format, for example `sigstore-bundle`, `jws`, `x509-cms`. |
| `ref` | string | URI of the detached signature. |
| `identity` | string | Expected signer identity (for example a certificate subject or workload identity). |

- AWP does not define a signature format. Runtimes implementing the security profile MUST
  support at least one format, MUST document which, and MUST be configurable to reject unsigned
  manifests and manifests whose signature cannot be verified.
- A signature MUST be bound to the manifest digest of [section 9.1](#91-manifest-digest).

### 9.3 Provenance

`spec.provenance` references build or authoring provenance (`format`, for example
`slsa-provenance-v1`, and `ref`). Runtimes MAY verify provenance and MAY enforce policies on it.

### 9.4 Dependencies

The dependencies of a workflow are: referenced `Agent` and `Policy` manifests, prompt templates
(`promptRef`), MCP servers (`image`, `url`, `version`), command step images and remote agents.

- Under the security profile, container images (`mcpServers[].image`, command step `image`) MUST
  be pinned by digest, and references SHOULD carry digests.
- Runtimes SHOULD support trusted registries: a configurable allowlist of sources from which
  manifests, images and MCP servers may be loaded.
- Runtimes SHOULD be able to output the resolved dependency set of a workflow (SBOM-like
  metadata), for example as part of `awp plan`.

---

## 10. Execution, audit and traceability

### 10.1 Execution identity

Every execution MUST have an execution identifier that is unique within the runtime. It SHOULD
have the form `awp-exec-<ULID>`.

**Pinning.** An execution is pinned to the manifests it started with:

- When an execution starts, the runtime resolves the workflow manifest, every referenced `Agent`
  manifest ([section 5.4.2](#542-agent-references)) and every `Policy` that applies
  ([section 8.2](#82-kind-policy)), validates them and computes the workflow digest
  ([section 9.1](#91-manifest-digest)). The execution uses exactly these versions until it ends,
  including retries and steps that wait for an approval or an answer.
- A change or deletion of one of these manifests MUST NOT change a running execution: it neither
  picks up new content nor mixes old and new versions. The runtime MUST keep the pinned manifests,
  or be able to retrieve them by digest, until the execution ends.
- A runtime MAY cancel running executions when a pinned manifest changes or is deleted, for example
  to apply a tightened policy at once. It cancels as actor `system` with `workflow.cancelled` and
  `reason: manifestChanged`.
- `workflow.started` MUST carry `workflow.digest` ([section 10.3](#103-event-envelope)). The
  reproducibility record ([section 10.7](#107-reproducibility-record)) lists the digests of all
  pinned manifests.
- A new execution, including one started by the next schedule tick, uses the manifests that are
  current when it starts.
- A request MAY assert the version it expects: if a `WorkflowRun`
  ([section 10.8](#108-kind-workflowrun)) names `workflowRef.version` or `workflowRef.digest` and
  the current workflow does not match, the runtime MUST reject the request with the reason
  `versionMismatch` or `digestMismatch` instead of running another version.

### 10.2 Audit configuration

```yaml
audit:
  enabled: true
  payload: metadata
  integrity:
    mode: hash-chain
  retention:
    duration: 7y
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `enabled` | boolean | Default `true`. Under the audit profile, `false` MUST be rejected unless the runtime is configured to allow it. |
| `payload` | string | `metadata` (default): events carry identifiers, digests and decisions, but not the content of inputs, outputs, prompts or tool results. `full`: events MAY carry content. |
| `integrity.mode` | string | `none`, `hash-chain` or `signed` ([section 10.5](#105-tamper-evidence)). |
| `retention.duration` | duration | Minimum retention requested by the manifest. |

- If the runtime cannot honour `integrity.mode` or `retention.duration`, it MUST reject the
  manifest. A runtime MAY retain events longer than requested if required by its configuration.

### 10.3 Event envelope

Every audit event is an object with these fields:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `id` | string | yes | Unique event identifier (ULID RECOMMENDED). |
| `type` | string | yes | Event type ([section 10.4](#104-event-types)). |
| `time` | string | yes | RFC 3339 timestamp. |
| `executionId` | string | cond. | Execution identifier. REQUIRED in every event except `trigger.skipped`, which belongs to no execution. |
| `workflow` | object | cond. | `name`, `version`, `digest`. REQUIRED in `workflow.started` (with `digest`, [section 10.1](#101-execution-identity)) and in `trigger.skipped` (`digest` if known). |
| `stepId` | string | cond. | REQUIRED for events that belong to a step. |
| `actor` | object | yes | `type` (`agent`, `human`, `runtime`, `system`) and `id`. |
| `environment` | string | cond. | REQUIRED in `workflow.started`. |
| `data` | object | no | Type-specific data. |
| `integrity` | object | cond. | `prev` (hash of the previous event) and `hash`; REQUIRED for `hash-chain` and `signed` modes. |

Events MAY be transported in other envelopes (for example CloudEvents, OpenTelemetry log
records) if all fields above are preserved. Events MUST NOT contain secret values, and under
`payload: metadata` they MUST NOT contain the content of inputs, outputs, prompts or tool
results (digests and references are allowed).

Example stream: [examples/audit-events.yaml](examples/audit-events.yaml).

### 10.4 Event types

| Type | When | Required `data` |
| ---- | ---- | --------------- |
| `workflow.started` | Execution started. | `trigger` (for schedule triggers with `scheduledAt`), `inputs` (values or digests per `payload`) |
| `workflow.completed` | All steps succeeded. | `status: succeeded`, `usage` |
| `workflow.failed` | Execution failed. | `status: failed`, `reason`, `usage`; for budgets: `reason: budgetExceeded`, `limit` |
| `workflow.cancelled` | Execution cancelled by an actor. | `usage`; `reason: replaced` when a schedule trigger with `concurrencyPolicy: replace` cancelled it; `reason: manifestChanged` when a pinned manifest changed ([section 10.1](#101-execution-identity)) |
| `agent.started` | Agent step started. | `agentId`, `model` (`provider`, `name`, `version` if known) |
| `agent.completed` | Agent step finished. | `agentId`, `status`, `usage` |
| `agent.failed` | Agent step failed. | `agentId`, `reason` |
| `tool.requested` | An action was requested (before evaluation). | `action`, `server` (MCP), `arguments` (redacted per `payload`), optional `decision` |
| `tool.executed` | An action was executed. | `action`, `outcome` (`success`, `error`), `durationMs` |
| `tool.denied` | An action was denied. | `action`, `reason` (`permissions`, `policy`, `dataPolicy`, `approval`, `budget`), `policy` (rule reference, if any) |
| `policy.evaluated` | A decision was computed. | `action` or `operation`, `decision` (`allow`, `deny`, `requireApproval`), `evaluated` (list of sources and results) |
| `policy.denied` | A rule or data/model policy denied an operation. | `rule`, `operation` |
| `approval.requested` | Approval requested. | `requestId`, `action` or `stepId`, `approvers`, `minApprovals`, `expiresAt` |
| `approval.granted` | An approver approved. | `requestId`, `approver` |
| `approval.rejected` | An approver rejected, or a separation-of-duties rule rejected an approval. | `requestId`, `approver`, `reason` |
| `approval.expired` | Request expired. | `requestId` |
| `artifact.created` | A step produced an output or artifact. | `name`, `stepId`, `classification`, `digest` or `uri`, `declassified` (boolean) |
| `artifact.modified` | An action changed an existing artifact (for example a file in a repository). | `name` or `uri`, `digest` (if known) |
| `trigger.skipped` | A schedule tick did not start an execution ([section 5.2](#52-triggers)). | `trigger` (index and type), `scheduledAt` (or `firstScheduledAt` and `lastScheduledAt`), `reason` (`concurrencyForbidden`, `missed`, `startingDeadlineExceeded`) |
| `input.requested` | A human input request was created ([section 5.8](#58-human-input)). | `requestId`, `stepId`, `agentId` (agent requests), `answerers`, `expiresAt`, `message` and `answerSchema` (content or digest per `payload`) |
| `input.provided` | An answerer provided a valid answer. | `requestId`, `answerer`, `answer` (content or digest per `payload`) |
| `input.declined` | An answerer declined to answer. | `requestId`, `answerer` |
| `input.expired` | The request expired. | `requestId`, `outcome` (`failed`, `defaultUsed`, `returned`) |

- Under the audit profile, runtimes MUST emit all event types of this table when the
  corresponding situation occurs, in causal order within an execution.
- Implementations MAY define additional event types outside these families with a reverse-domain
  prefix (for example `com.example.cache.hit`).

### 10.5 Tamper evidence

AWP defines the semantics of audit events; implementations may provide tamper-evident storage.

- `hash-chain`: every event's `integrity.hash` is the digest over the JCS serialization of the
  event without `integrity.hash`, including `integrity.prev`, which is the `hash` of the previous
  event of the same execution (empty string for the first event). Events without `executionId`
  (`trigger.skipped`) form one chain per workflow. Runtimes MUST provide a way to
  verify a chain.
- `signed`: as `hash-chain`, and the runtime signs the chain (for example per event or per
  checkpoint) in an implementation-documented format.
- Storage, replication, key management and retention enforcement are implementation concerns.

### 10.6 Decision trace

A **decision record** explains why an agent or runtime took a consequential action in terms of
observable facts. It does not contain, and MUST NOT be required to contain, the model's private
chain-of-thought.

```yaml
decision:
  action: create_pull_request
  reason:
    type: policy-compatible-action
    summary: Fix applied and tests requested; pull request creation is allowed.
  evidence:
    - type: artifact
      ref: report
    - type: step
      ref: investigate
  policyChecks:
    - permissions
    - policies.pullRequest
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `action` | string | The action decided on. |
| `reason.type` | string | Category, for example `policy-compatible-action`, `task-requirement`, `human-instruction`. |
| `reason.summary` | string | Short human-readable justification. |
| `evidence` | list | References (`type`: `artifact`, `step`, `input`, `event`; `ref`) to the facts the decision relies on. |
| `policyChecks` | list | Policy sources evaluated for the action. |

- Runtimes implementing the audit profile MUST attach a decision record to `tool.requested`
  events of actions that require approval, and SHOULD attach one to all write actions.
- Runtimes SHOULD NOT store raw model reasoning in audit events. A decision record MAY be
  produced by the agent (structured output) or derived by the runtime.

### 10.7 Reproducibility record

At the end of every execution, a runtime implementing the audit profile MUST produce a
reproducibility record that identifies everything the execution depended on:

| Field | Content |
| ----- | ------- |
| `executionId`, `startedAt`, `finishedAt`, `status`, `environment` | Execution facts. |
| `runtime` | `name`, `version`, `conformance` statement. |
| `workflow` | `name`, `version`, `digest`. |
| `agents` | Per agent: `id`, reference (`name`, `version`, `digest`) if any, `model` (`provider`, `name`, `version` as actually used), prompt/instructions version or digest. |
| `tools` | Per MCP server: `server`, `version`, `url` or `image` digest. |
| `images` | Command step images with digests. |
| `policies` | Policies applied, with versions and digests. |
| `inputs` | Input references or digests. |
| `artifacts` | Outputs and artifacts with digests or URIs. |

Example: [examples/execution-record.yaml](examples/execution-record.yaml).

Reproducibility here means *traceability of what ran*. Model outputs are in general not
deterministic; AWP does not require identical results on re-execution.

### 10.8 Kind `WorkflowRun`

A `WorkflowRun` is one execution of a workflow as an object. Clients request an execution and read
its state in the same object store as the manifests, for example with `kubectl create` and
`kubectl get workflowruns`. A runtime that exposes executions as objects MUST use this kind; a
runtime without an object store MAY offer the same shape through its API. The audit events of this
section remain the record of what happened; a `WorkflowRun` is a view of it.

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha2
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
  environment: development
```

A complete example with the status written by a runtime:
[examples/vulnerability-fixer.run.yaml](examples/vulnerability-fixer.run.yaml).

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `metadata` | object | yes | As in [section 4.1](#41-metadata); a client MAY set `generateName` (prefix of a name the object store generates) instead of `name`. |
| `spec.workflowRef` | object | yes | `name` (REQUIRED) of a `Workflow` in the same namespace; `version` and `digest` (OPTIONAL) are assertions ([section 10.1](#101-execution-identity)), not selectors. |
| `spec.inputs` | object | no | Input values ([section 5.3](#53-inputs)). |
| `spec.environment` | string | no | Target environment ([section 7.10](#710-environments)). |
| `spec.cancel` | boolean | no | `true` requests cancellation of the execution. |
| `spec.extensions` | object | no | Extension fields ([section 3.3](#33-unknown-fields-and-extensions)). |
| `status` | object | no | Written by the runtime, see below. |

A `WorkflowRun` has none of the common spec fields of [section 4.2](#42-common-spec-fields) and no
digest or signature: governance belongs to the workflow it runs.

Rules:

- **Starting.** A `WorkflowRun` created by a client is a `manual` start
  ([section 5.2](#52-triggers)). Every rule for manual starts applies: the workflow MUST allow
  manual starts, inputs are validated, environment rules and policies apply. The actor is the
  identity that created the object. The runtime MUST take this identity from an authenticated
  source (for example the request information of a validating admission webhook or the audit log
  of the object store), never from a field the client wrote; if it cannot determine it, it MUST
  reject the request.
- A `WorkflowRun` starts at most one execution. Changes to `spec` after the start have no effect,
  except `cancel`; runtimes SHOULD reject them on write.
- **Runtime-created runs.** For `schedule` and `event` triggers, a runtime that exposes executions
  as objects creates the `WorkflowRun` itself and records the trigger in `status.trigger`.
- **Rejection.** If a request cannot start (for example invalid inputs, a version mismatch, no
  `manual` trigger, a policy denial), the runtime sets `status.phase: rejected` with a reason and
  starts nothing. A rejected request emits no `workflow.started`.
- **Cancellation.** `spec.cancel: true` cancels the execution on behalf of the identity that set
  it, determined as for starting. Deleting a running `WorkflowRun` SHOULD cancel the execution (for
  example through a finalizer); it MUST NOT delete audit events.
- **Retention.** A runtime MAY delete finished `WorkflowRun` objects after a documented time. Audit
  retention ([section 10.2](#102-audit-configuration)) does not depend on it.

**Status.** A runtime writes `status` in this shape (`WorkflowRunStatus` in the JSON Schema):

| Field | Description |
| ----- | ----------- |
| `executionId` | Execution identifier ([section 10.1](#101-execution-identity)). |
| `phase` | `pending`, `running`, `succeeded`, `failed`, `cancelled` or `rejected`. |
| `reason`, `message` | Why the execution ended or was rejected, for example `budgetExceeded` or `versionMismatch`. |
| `actor` | Who started it: `type` and `id` as in [section 10.3](#103-event-envelope). |
| `trigger` | `type`, `index` of the trigger entry, `scheduledAt` for schedule triggers. |
| `environment` | Effective environment. |
| `workflow` | `name`, `version` and `digest` of the pinned manifest ([section 10.1](#101-execution-identity)). |
| `startedAt`, `finishedAt` | Timestamps. |
| `steps` | Per step: `id`, `status` ([section 5.6.3](#563-execution-model)), `attempts`, `startedAt`, `finishedAt`, `reason`, `message`, `outputs` (`name`, `digest`, `size`, `classification`; never the value). |
| `usage` | As in `workflow.completed` ([section 10.4](#104-event-types)). |
| `conditions` | Conditions ([section 3.11](#311-status)): `Accepted` (request validated and admitted) and `Succeeded` (`Unknown` while running). |
| `observedGeneration` | As in [section 3.11](#311-status). |

- Everyone who can read the object can read `status` and `spec.inputs`. `status` MUST NOT contain
  secret values or the content of outputs, prompts or tool results. Classified input values SHOULD
  be passed as references.

---

## 11. Conformance

### 11.1 Roles

- A **manifest** conforms to this specification if it satisfies all requirements on documents.
- A **runtime** conforms to a **profile** if it satisfies all requirements on runtimes of that
  profile and of the profiles it depends on.
- A **validator** (for example `awp validate`) conforms if it accepts exactly the manifests that
  satisfy the document requirements of the profiles it claims.

### 11.2 Profiles

| Profile | Depends on | Requirements |
| ------- | ---------- | ------------ |
| `core` | - | Sections 3, 4, 5 (except 5.4.4 and the MCP-specific parts of 5.5), 6, 7.5 (permissions, incl. resource scopes), 7.9 (secrets), 9.1 (manifest digest), 10.1 (including pinning), 10.8 (if executions are exposed as objects). Parse and validate manifests, fail closed on unknown fields and unsupported profiles, validate inputs, execute the step graph, enforce budgets and permissions, support the `manual` trigger, emit `workflow.*` events to a log. |
| `governance` | `core` | Sections 7.1-7.4, 7.6-7.8, 7.10 and 8: ownership and classification rules, data classification and residency, model policy, human approval, risk levels, separation of duties, environments, policy shorthands, `Policy` manifests and the decision algorithm. |
| `audit` | `core` | Section 10: event envelope, all event types, `payload` modes, integrity modes `none` and `hash-chain`, decision records, reproducibility records. |
| `security` | `core` | Section 9 and the security-related requirements of sections 5.6.2, 7.5 and 7.9: digest verification, at least one signature format, image pinning, isolation of command steps, network and filesystem restrictions, secret redaction. |
| `mcp` | `core` | Sections 5.5.1-5.5.4 for `type: mcp`: MCP server declaration and resolution, tool filtering, action identifiers per tool call, `tool.*` events per MCP call. |
| `a2a` | `core` | Section 5.4.4: remote agents, agent card verification, the action `a2a.<id>.send`, data policy checks for remote agents. |
| `interaction` | `core` | Section 5.8: input steps, agent requests with `humanInput`, answer validation, answerer identity, `input.*` events, declining MCP elicitation that is not allowed. |

### 11.3 Conformance statement

A runtime that claims conformance MUST publish a conformance statement:

```yaml
implementation:
  name: example-runtime
  version: 0.4.0
  url: https://runtime.example.org
conformance:
  awp: v1alpha2
  profiles:
    - core
    - governance
    - audit
  limitations:
    - "audit: integrity mode signed is not supported; hash-chain only"
  limits:
    outputSize: 1MiB
    stepOutputSize: 4MiB
  executionObjects: true
```

- `limits` (OPTIONAL) states limits above the minimums of this document: `outputSize` and
  `stepOutputSize` ([section 5.6.4](#564-step-outputs)).
- `executionObjects` (OPTIONAL, default `false`) states that the runtime exposes executions as
  `WorkflowRun` objects ([section 10.8](#108-kind-workflowrun)).
- `limitations` MUST list every OPTIONAL feature of a claimed profile that is not supported.
- `testedWith` (OPTIONAL) names the conformance test suite, its version and the date of the run.
- A runtime MUST NOT claim a profile of which it does not meet every MUST requirement.
- A public conformance test suite is planned. Until it exists, conformance statements are
  self-declarations.

### 11.4 Command-line interface (informative)

AWP anticipates a common command-line vocabulary (`awp validate`, `awp lint`, `awp simulate`,
`awp plan`, `awp run`, `awp audit`). Output formats are described in
[docs/cli.md](../../docs/cli.md); any implementation may provide these commands.

---

## 12. Security considerations

- **Fail closed.** Unknown fields, unsupported profiles, undeterminable regions or resources and
  unverifiable digests lead to rejection or denial, never to silent acceptance.
- **Prompt injection.** Tool results and remote agent messages are untrusted input. Governance in
  AWP is enforced by the runtime **outside** the model: an agent cannot change permissions,
  policies, budgets or approvals by producing text. Runtimes MUST NOT allow model output to
  modify the effective manifest of a running execution.
- **Shell access.** `shell.execute` can perform effects that action-level rules cannot see (for
  example `git push` inside a command). Network and filesystem restrictions and isolation are the
  primary controls for command steps; granting `shell.execute` should be considered equivalent to
  granting everything the sandbox can reach.
- **Incomplete action mappings.** Rules on well-known actions only apply to tools mapped to them
  ([section 5.5.4](#554-action-groups)). Prefer `default: deny` with explicit allows.
- **Remote agents.** The local runtime cannot enforce governance inside a remote agent. Treat
  remote agents as external parties for data policies.
- **Secrets.** Secrets are referenced, scoped and redacted ([section 7.9](#79-secrets)); scope
  them to the smallest set of consumers.
- **Human input.** A question composed by a model can carry data to the answerer, and an answer
  is untrusted input to the next model invocation, like a tool result. Answers never grant
  approvals ([section 5.8](#58-human-input)); limit agent requests with `maxRequests`.
- **Starting executions through objects.** Whoever can create `WorkflowRun` objects can start
  executions within the limits of the workflow's `manual` trigger; restrict it with the access
  control of the object store. The actor is the authenticated creator, never a field of the object
  ([section 10.8](#108-kind-workflowrun)).
- **Changes during an execution.** Executions are pinned to the manifests they started with
  ([section 10.1](#101-execution-identity)), so a deployment tool that syncs a manifest cannot
  change a running execution. A tightened policy applies to running executions only if the runtime
  cancels them.
- **Output files.** Runtimes read output files as text with a size limit and do not follow
  symbolic links ([section 5.6.4](#564-step-outputs)).
- **Approval fatigue.** Approval requests must carry enough context (section 7.6) for a
  meaningful decision; too many approvals reduce their value.
- **Audit trail integrity.** Hash chains detect modification but not deletion of a whole chain;
  external anchoring or replication is an implementation choice.

## 13. Privacy considerations

- Audit events default to `payload: metadata` so that personal data in inputs and outputs is not
  copied into long-lived audit storage. `payload: full` should be used only with an appropriate
  retention and access model.
- `owner.contact` and approver identities are personal data in some jurisdictions; prefer role
  and team addresses.
- Input values in `WorkflowRun.spec.inputs` and the status of a `WorkflowRun` are readable by
  everyone who can read the object; pass classified values as references.
- Answers to human input requests may contain personal data; set `classification` accordingly.
  Under `payload: metadata` audit events carry only a digest of the answer.
- Long retention periods (`retention.duration`) and data minimization requirements may conflict;
  organizations must decide based on their own requirements.

## 14. Versioning

- The API version is part of `apiVersion`. Alpha versions (`v1alphaN`) may change
  incompatibly; beta versions (`v1betaN`) change only with a migration path; `v1` changes only
  backwards-compatibly.
- Runtimes MAY support several API versions and MUST process each manifest according to its own
  `apiVersion`.
- Changes to this document are proposed and decided as described in the repository's
  [GOVERNANCE.md](../../GOVERNANCE.md).

### 14.1 Changes from `v1alpha1`

| `v1alpha1` | `v1alpha2` |
| --- | --- |
| `metadata.version`, `description`, `owner`, `classification`, `purpose`, `risk`, `integrity`, `signature`, `provenance` | Same fields in `spec` ([section 4.2](#42-common-spec-fields)). |
| `metadata.name`: `^[a-zA-Z][a-zA-Z0-9_-]{0,62}$` | DNS-1123 label ([section 3.4](#34-names-and-identifiers)). |
| Labels: one key pattern, any value | Kubernetes label syntax for keys and values ([section 4.1](#41-metadata)). |
| - | `metadata.namespace`, fields populated by an object store, and `status` ([sections 3.2](#32-top-level-structure), [3.10](#310-object-stores-and-kubernetes)). |
| `x-` fields in any object | Keys of an `extensions` object on the same object ([section 3.3](#33-unknown-fields-and-extensions)). |
| `owner` as a string (shorthand for `owner.team`) | `owner` is always an object. |
| Policy conditions: a plain value means `equals` | Always an operator object, for example `action: {equals: git.push}` ([section 8.3](#83-conditions)). |
| `schedule` trigger: `cron` and `timezone` only | Adds `concurrencyPolicy` (default `forbid`), `startingDeadline`, rules for missed ticks and the event `trigger.skipped` ([section 5.2](#52-triggers)). |
| Approvals are the only human interaction | Human input: input steps, agent requests, profile `interaction`, events `input.*` ([section 5.8](#58-human-input)). |
| `outputs[].name`: any string; how a step produces outputs is undefined | Names match `^[A-Za-z_][A-Za-z0-9_]{0,62}$`; command steps write files to `$AWP_OUTPUTS`, agent steps complete with `complete_step`, minimum sizes, outputs of failed attempts are discarded ([section 5.6.4](#564-step-outputs)). |
| Executions are not objects; the shape of `status` is undefined | Kind `WorkflowRun` ([section 10.8](#108-kind-workflowrun)), status conditions `Valid` and `Ready` ([section 3.11](#311-status)), step status `waitingForInput`. |
| No rule for manifest changes during an execution | Executions are pinned to their manifests; `workflow.digest` is REQUIRED in `workflow.started` ([section 10.1](#101-execution-identity)). |
| Digest over the whole manifest without integrity, signature and provenance | Digest over `apiVersion`, `kind`, `metadata.name` and `spec` without integrity, signature and provenance ([section 9.1](#91-manifest-digest)). |

The reference checker converts a `v1alpha1` manifest mechanically:
`node conformance/awp-check.mjs migrate <file>`. A name that is not a DNS-1123 label is reported
and has to be renamed by the author, and a digest has to be recomputed.

## 15. References

- [RFC 2119]: Key words for use in RFCs to Indicate Requirement Levels.
- [RFC 8174]: Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words.
- [RFC 8259]: The JavaScript Object Notation (JSON) Data Interchange Format.
- [RFC 8785]: JSON Canonicalization Scheme (JCS).
- RFC 3339: Date and Time on the Internet: Timestamps.
- [SemVer]: Semantic Versioning 2.0.0.
- YAML 1.2: https://yaml.org/spec/1.2.2/
- Model Context Protocol: https://modelcontextprotocol.io
- Agent2Agent (A2A) Protocol: https://a2a-protocol.org

[RFC 2119]: https://www.rfc-editor.org/rfc/rfc2119
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174
[RFC 8259]: https://www.rfc-editor.org/rfc/rfc8259
[RFC 8785]: https://www.rfc-editor.org/rfc/rfc8785
[SemVer]: https://semver.org/spec/v2.0.0.html
