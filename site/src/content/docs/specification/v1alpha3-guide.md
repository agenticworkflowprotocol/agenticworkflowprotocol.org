---
title: "v1alpha3: how it fits together"
description: "Informative guide to the v1alpha3 draft: which manifests you write, how they relate, what happens from applying a manifest to a finished run, and checklists for authors and runtime implementers."
banner:
  content: "Draft - v1alpha3, errata only. The current draft is v1alpha4; its model is the one described here."
---
This page explains [v1alpha3](/specification/v1alpha3/), the current draft from decision D22 to D24, for
readers who did not follow its discussion. The current draft `v1alpha4` keeps this model and adds
conditional steps and workflow steps ([v1alpha4: what's new](/specification/v1alpha4-whats-new/)). It is informative: it adds no requirement, and where it differs from the specification,
the specification decides. Coming from `v1alpha1`? See [Migrating to v1alpha3](/specification/migrating-to-v1alpha3/).

- **Authors** start with [the example](#a-scheduled-agent-workflow) and [the author checklist](#checklist-for-authors).
- **Runtime implementers** read [the lifecycle](#from-manifest-to-finished-run) and [the implementer checklist](#checklist-for-runtime-implementers).
- **Reviewers** read [the resources](#the-resources) and [what is proposed on top](#proposed-on-top-of-v1alpha3).

## The resources

| Kind | Written by | References | Read by |
| --- | --- | --- | --- |
| `Workflow` | The workflow author; the team in `spec.owner` is accountable. | `Agent` (`agents[].ref` with exact `version`, optional `digest`), `Policy` (`policies.include`), secrets by name, MCP servers, remote agents, container images. | The runtime, which validates, pins and executes it. For reviewers the manifest is the reviewed unit (digest, signature). |
| `Agent` | An agent author or a platform team, published separately. | Model, tools, MCP servers, secrets (which the workflow must declare as well), `promptRef`. | The runtime, when a workflow references it. An `Agent` runs only as part of a workflow ([spec 6](/specification/v1alpha3/#6-kind-agent)). |
| `Policy` | A governance or platform team. | Nothing. Rules on actions, data class, destination, model and actor, with the effects `deny` and `requireApproval`: policies restrict, permissions grant. | The decision algorithm of the runtime ([spec 8.4](/specification/v1alpha3/#84-decision-combination)), under the `governance` profile. |
| `WorkflowRun` | A client for a manual start, or the runtime itself for schedule and event triggers. | One `Workflow` by `name` in the same namespace; `version` and `digest` are assertions, not selectors. | The runtime, which starts at most one execution from it and writes `status`. |

Not kinds:

- Triggers, permissions and secrets are fields of a `Workflow`. Secret values live in a store the
  runtime resolves, never in a manifest.
- Profiles are what a runtime claims in its [conformance statement](/specification/v1alpha3/#113-conformance-statement),
  together with `limitations`, `limits` and `executionObjects`.
- Bindings, placement, images, volumes, model endpoints and secret mapping belong to the runtime and
  its own configuration ([Execution placement](/implementations/execution-placement/)).
- `Prompt`, `Playbook` and `ModelCatalog` are proposed kinds (AEP-0005, AEP-0006, AEP-0008), not
  part of `v1alpha3`.

## From manifest to finished run

### 1. Write the manifests

A manifest has `apiVersion`, `kind`, `metadata` and `spec`. Authors set only `name` (or, on a
`WorkflowRun`, `generateName`), `namespace`, `labels` and `annotations` in `metadata`; the governance fields (`version`, `owner`,
`classification`, `risk`, ...) live in `spec`. Extension fields are keys of `extensions` objects,
and `status` is reserved for the runtime ([spec 3.2](/specification/v1alpha3/#32-top-level-structure),
[spec 4.2](/specification/v1alpha3/#42-common-spec-fields)).

### 2. Validate before you apply

The reference checker validates the YAML restrictions, the JSON Schema and the semantic rules of the
profiles you name. Unknown fields and fields of a profile the runtime does not support are errors,
not warnings: AWP fails closed ([spec 3.3](/specification/v1alpha3/#33-unknown-fields-and-extensions)).

### 3. Store and admit

Any object store works: files, Git, a database or a Kubernetes API server with the generated
CustomResourceDefinitions. A runtime MUST validate every manifest it reads before acting on it and
MUST NOT change its `spec`. It reports the condition `Valid` and, once references are resolved,
policies loaded and triggers registered, `Ready`
([spec 3.10](/specification/v1alpha3/#310-object-stores-and-kubernetes),
[spec 3.11](/specification/v1alpha3/#311-status)). Validation on write, for example in an admission
webhook, is recommended but up to the platform.

### 4. A trigger fires

- `manual`: a client creates a `WorkflowRun`. The actor is the authenticated creator, never a field
  of the object ([spec 10.8](/specification/v1alpha3/#108-kind-workflowrun)).
- `schedule`: a tick supplies no inputs, so every input uses its `default`; a workflow with a
  required input cannot be started by a schedule ([spec 5.3](/specification/v1alpha3/#53-inputs)). `concurrencyPolicy`
  (default `forbid`) and `startingDeadline` decide about overlapping and missed ticks, and every
  tick that starts nothing emits `trigger.skipped` ([spec 5.2](/specification/v1alpha3/#52-triggers)).
- `event`: `source`, `eventType` and an optional `filter`. The runtime MUST verify the authenticity
  of the event source. The event data cannot reach the steps yet.

### 5. Admit the execution

Before anything runs, inputs are validated, every model is checked against `modelPolicy`, the
environment must be allowed, and a `critical` risk level needs an approval of the execution itself.
A request that cannot start gets `status.phase: rejected` and emits no `workflow.started`
([spec 5.3](/specification/v1alpha3/#53-inputs), [spec 7.4](/specification/v1alpha3/#74-model-governance),
[spec 7.10](/specification/v1alpha3/#710-environments)).

### 6. Pin what runs

At start the runtime resolves the workflow, every referenced `Agent` and every applicable `Policy`,
computes the digest and uses exactly these versions until the execution ends, also across retries
and waits. Image tags are resolved to digests (of the image index for multi-platform images); an
image that cannot be resolved fails the execution before any step. `workflow.started` carries the
digest, so a GitOps sync during a run changes nothing ([spec 10.1](/specification/v1alpha3/#101-execution-identity)).

### 7. Run the steps

Steps form a graph through `dependsOn`. Ready steps run up to `budget.resources.maxConcurrency`
(default 1), and `forEach` fans out over a bounded list ([spec 5.6](/specification/v1alpha3/#56-workflow-steps)).
Command steps run in an isolated environment with `permissions.network` and
`permissions.filesystem` applied; `command` is never expression-enabled, values come through `env`
([spec 5.6.2](/specification/v1alpha3/#562-command-steps)). Every action goes through one decision:
permissions, then deny rules, then approval ([spec 8.4](/specification/v1alpha3/#84-decision-combination)).
Budgets are checked before every model call and every action ([spec 5.7](/specification/v1alpha3/#57-budgets-and-resources)).

### 8. Produce outputs

A command step writes one file per declared output into `$AWP_OUTPUTS`; an agent step ends with a
completion tool, `complete_step`. Every runtime accepts at least 256 KiB per output and 1 MiB per
step and never truncates. Outputs of failed, timed-out or cancelled attempts are discarded
([spec 5.6.4](/specification/v1alpha3/#564-step-outputs)).

### 9. Ask people

Input steps and agents with `humanInput` ask named people and wait (profile `interaction`,
[spec 5.8](/specification/v1alpha3/#58-human-input)). Approvals gate actions or steps (profile
`governance`). An answer to an input request is never an approval, and `initiatorCannotApprove`
keeps the person who started the run from approving in it
([spec 7.6](/specification/v1alpha3/#76-human-approval), [spec 7.8](/specification/v1alpha3/#78-separation-of-duties)).

### 10. Finish, report, audit

The run ends `succeeded`, `failed` or `cancelled`. `WorkflowRun.status` shows phase, steps, usage
and the conditions `Accepted` and `Succeeded`, never output values or secrets. The audit events are
the record: under the `audit` profile they can form a hash chain, and a reproducibility record lists
everything the run depended on ([spec 10.4](/specification/v1alpha3/#104-event-types),
[spec 10.7](/specification/v1alpha3/#107-reproducibility-record)).

## A scheduled agent workflow

Every morning a command step fetches venue programs, an agent keeps the concerts that match a taste,
and a second command step sends the digest. This is plain `v1alpha3` under the `core` profile.

<!-- awp-check profiles=core -->
```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: Workflow
metadata:
  name: concert-scout
spec:
  version: 0.1.0
  description: Checks venue programs every morning and reports new concerts.
  owner:
    team: music-fans
  classification: internal
  triggers:
    - type: manual
    - type: schedule
      cron: "0 7 * * *"
      timezone: Europe/Berlin
      concurrencyPolicy: forbid
      startingDeadline: 30m
  inputs:
    - name: venues
      type: array
      default:
        - https://venue.example.org/program
  budget:
    maxCostUsd: 0.5
    maxDuration: 30m
  agents:
    - id: curator
      model:
        provider: example-provider
        name: example-model
      instructions: Rate concerts against the taste in the task. End with complete_step.
  secrets:
    - name: WEBHOOK_URL
      source: secret-manager
      scope:
        - command
  permissions:
    default: deny
    tools:
      shell.execute:
        allow: true
  workflow:
    - id: fetch
      type: command
      image: registry.example.com/concert-scout/tools:1.4
      command: fetch-programs > "$AWP_OUTPUTS/events"
      env:
        VENUES: "${{ inputs.venues }}"
      timeout: 5m
      retries: 1
      outputs:
        - name: events
          description: JSON array of concerts with artist, date and venue.
    - id: rate
      agent: curator
      task: "Keep the Metalcore and Hardcore concerts: ${{ steps.fetch.outputs.events }}"
      dependsOn:
        - fetch
      outputs:
        - name: digest
          description: Plain-text summary, one concert per line.
    - id: notify
      type: command
      image: registry.example.com/concert-scout/tools:1.4
      command: send-digest
      env:
        DIGEST: "${{ steps.rate.outputs.digest }}"
      dependsOn:
        - rate
```

- The schedule uses the input default, and `forbid` skips a tick while the previous run is still
  running.
- The command writes its output as a file, the agent ends with `complete_step`, and values reach the
  second command through `env`, never through the command text.
- `default: deny` with one explicit allow, and the budget is checked before every model call.
- The image tags are resolved and pinned at start. Under the `security` profile the checker rejects
  them (`security.image-not-pinned`): there the images need a digest, for example
  `tools:1.4@sha256:...`, and the network should be limited with `egress: deny` and `allowHosts`.

A manual start of the same workflow. `version` is an assertion: if the workflow has moved on, the
runtime rejects the request with `versionMismatch` instead of running another version.

<!-- awp-check -->
```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: WorkflowRun
metadata:
  generateName: concert-scout-
spec:
  workflowRef:
    name: concert-scout
    version: 0.1.0
  inputs:
    venues:
      - https://club.example.org/events
```

## Profiles

| Profile | Needed when the manifest uses |
| --- | --- |
| `core` | Always: validation, the step graph, budgets, permissions, secrets, digest, pinning, `WorkflowRun` if executions are objects. |
| `governance` | `approval`, approval steps, `policies`, `dataPolicy`, `modelPolicy`, `environments`, risk treatment. |
| `audit` | `spec.audit`: event envelope, all event types, hash chain, decision and reproducibility records. |
| `security` | `signature`, images pinned by digest, isolation, network and filesystem limits, redaction. |
| `mcp`, `a2a` | MCP servers and tool sources; remote agents. |
| `interaction` | Input steps and agents with `humanInput`. |

The normative list is [spec 11.2](/specification/v1alpha3/#112-profiles). A runtime without a
profile the manifest needs rejects the manifest (`profile.unsupported`) instead of running it
without, for example, its approvals.

## Checklist for authors

- Start from [the example](#a-scheduled-agent-workflow): a DNS-1123 `metadata.name`, `spec.version`
  (SemVer), `spec.owner.team`, and `spec.classification` if you target the `governance` profile.
- Declare `triggers`; without them only manual starts are possible. Give inputs a default if a
  schedule starts the workflow.
- Pass values to commands through `env`, never in `command`. Write outputs to `$AWP_OUTPUTS/<name>`
  or let the agent end with `complete_step`.
- Use `permissions` with `default: deny` and explicit allows, limit `network` with `egress: deny`
  and `allowHosts`, and declare secrets by name with the smallest `scope`.
- Pin images by digest if the workflow must run under the `security` profile.
- Validate with the profiles of your runtime: `node conformance/awp-check.mjs check --profiles core,governance my.workflow.yaml`
  in a checkout of this repository (after `npm ci`), or the [online validator](https://validator.agenticworkflowprotocol.org/).
- On Kubernetes, install the CRDs from [`schema/crd/`](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/tree/main/schema/crd)
  and apply with `kubectl apply --validate=strict`.
- Do not rely on proposals: fields of Draft AEPs that are not applied are unknown to the schema, and
  the checker rejects them.

## Checklist for runtime implementers

- Claim only profiles whose every MUST you meet, and publish a conformance statement with
  `limitations`, `limits` and `executionObjects` ([spec 11.3](/specification/v1alpha3/#113-conformance-statement)).
- Reject, never run partially: an unsupported `apiVersion` or `kind`, unknown fields, fields of
  profiles you do not support, literal credentials, invalid inputs, models outside `modelPolicy`,
  digest mismatches, images that cannot be resolved.
- Enforce at run time: the decision algorithm for every action, budgets before every model call and
  action, isolated command steps with `network` and `filesystem` applied, the output rules, pinning,
  approvals only by authenticated humans, the actor of a run from an authenticated source, and no
  secret values in model context, logs, status or audit.
- Test your validator with the conformance suite: `npm test` runs every case, and
  `conformance/v1alpha3/index.json` lists the expected result, code and path of each case for your
  own validator.
- Report gaps as `docs/runtime-feedback.md` does: one entry per gap with severity, proposal and the
  evidence from your runtime, as an issue or an AEP (decision D18).

## Proposed on top of v1alpha3

These Draft AEPs target `v1alpha4` since D24 (`v1alpha3` before) but are not applied to its text, schema or conformance suite.
Their fields are rejected by the checker until they are.

| AEP | Proposal |
| --- | --- |
| [AEP-0021](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0021-extension-model.md) | Extension model aligned with the Kubernetes Gateway API (concept); until it is decided, extension fields stay in `extensions` objects (D22). |
| [AEP-0023](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0023-step-isolation.md) | Step isolation: structured network destinations, enforce or reject, platform ceilings that reject, credentials and approvals outside the execution environment, a minimum isolation class. |
| [AEP-0024](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0024-event-triggers.md) | Event triggers with CloudEvents. |
| [AEP-0025](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0025-state.md) | State across executions. |
| [AEP-0026](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0026-interactive-execution.md) | Interactive execution (concept). |
| [AEP-0027](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0027-agent-engine.md) | Agent engine (concept). |

The full list with status and target versions is in the [specification overview](/specification/).
