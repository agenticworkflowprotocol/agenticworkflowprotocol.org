# AEP-0030: Kind `Model`: one object per model, parameters and runtime model calls

| | |
| --- | --- |
| **AEP** | 0030 |
| **Title** | Kind `Model`: one object per model, model parameters and model calls made by the runtime |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer, language or schema reviewer |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha4` |
| **Profiles affected** | `core`, `governance`, `audit` |
| **Created** | 2026-11-27 |
| **Discussion** | issue to be opened |
| **Supersedes** | AEP-0008 (proposed; needs a decision of the project lead, see [Decision](#decision)) |
| **Superseded-by** | - |

## Summary

Define a kind `Model` that describes exactly one model: its provider and name, allowed versions,
region, enforced limits, price, governance status, default parameters and named parameter
profiles. An agent refers to a `Model` by name (`model.ref`, rules of AEP-0029) or keeps the
inline model object of spec 5.4.3. The agent's model object gains a provider-neutral parameter
set (`parameters`) and a profile selector (`profile`). Every model invocation that the runtime
makes for an execution, including invocations the author did not write (fallbacks, summaries,
embeddings, routing, evaluation, MCP sampling), is subject to model policy, data policy and
budget. The proposal replaces the list kind `ModelCatalog` of AEP-0008 with one object per model.

## Motivation

- **One list for all models is hard to operate.** AEP-0008 puts every provider and model of an
  organisation into one `ModelCatalog` that workflows reference with a REQUIRED digest. A new
  price, a new model or a renewed approval changes the catalog, its version and its digest, so
  every workflow that references it has to be changed, reviewed and redeployed, also the ones
  that never use the changed model. In an object store (spec 3.10) one large object also means
  one owner, one access rule and merge conflicts in one file. Object stores and Kubernetes
  describe such classes as one object per thing (`StorageClass`, `RuntimeClass`,
  `IngressClass`): adding a model adds an object, and the status of each object shows its own
  state.
- **Model parameters are missing.** The model object (spec 5.4.3) has no output token limit,
  temperature or other request parameters. Runtimes hard-code them, so the same manifest behaves
  differently on two runtimes (runtime feedback G24, G34). A real run failed because the runtime
  sent a larger output limit than a self-hosted model server accepted (G59).
- **Repeated values.** Context size, output limit, price and approval are facts about a model.
  Today an author repeats the approval in every model object, and the limits are runtime
  knowledge. With many workflows the same values appear many times and drift.
- **Model calls the author does not see.** Runtimes call models on their own: fallbacks
  (spec 7.4), summarising long histories, computing embeddings for memory, routing between
  models, evaluating outputs, MCP sampling (AEP-0007 open question 5). Only fallbacks are
  covered by spec 7.4. A summary model receives the full conversation, so it needs the same
  residency, provider and budget rules as the agent's own model (runtime feedback G88).

Prior art: kagent, a CNCF project, has a `ModelConfig` resource referenced by agents. It shows the
value of a named, shared model object, but it bundles four kinds of information in one object:
model and parameters, connection (base URL, API format, TLS settings, headers), credential, and
the namespaces allowed to use it. Its runtime configuration also selects models for summaries and
embeddings that the agent definition does not show. This AEP takes the shared object and leaves
connection and credential where AWP already puts them, in runtime configuration (AEP-0021 B6,
AEP-0023).

## Goals and non-goals

- Goals:
  - one reviewable object per model with facts, limits, governance status, defaults and profiles;
  - reference by name, so that a change to one model does not force a change to every workflow;
  - a provider-neutral parameter set with fail-closed handling of unsupported parameters;
  - enforced model limits;
  - one rule for every model invocation the runtime makes for an execution.
- Non-goals:
  - endpoints, wire protocols, credentials, TLS settings, streaming (runtime configuration);
  - live price feeds or automatic discovery of models from a provider;
  - benchmarks or quality ratings;
  - a registry of well-known provider identifiers.

## Specification

### New section 6c: Kind `Model`

A `Model` manifest describes one model of one provider. It is written by the people who govern
model use in an organisation and is reviewed like a policy. It contains no connection details and
no credentials.

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: Model
metadata:
  name: example-large
spec:
  version: 1.4.0
  owner:
    team: platform-governance
  provider: example-cloud-eu
  name: example-large
  versions: ["2026-08"]
  region: EU
  limits:
    contextTokens: 200000
    maxOutputTokens: 64000
  price:
    inputPerMTok: 3.0
    outputPerMTok: 15.0
  approval:
    status: approved
    expires: "2027-06-30"
    approvedBy: model-risk-board
  riskClassification: medium
  defaults:
    maxOutputTokens: 4096
  profiles:
    careful:
      temperature: 0.1
      reasoningEffort: high
    fast:
      maxOutputTokens: 1024
      reasoningEffort: low
```

`spec` contains the common fields of spec 4.2 and:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `provider` | string | yes | Provider identifier as in spec 5.4.3. |
| `name` | string | yes | Model name or family as known to the provider. |
| `versions` | list of string | no | Exact model versions or snapshot identifiers that may be used. Absent: the runtime chooses and records the version (spec 5.4.3). |
| `region` | string | no | Region where the model processes data (spec 7.3). |
| `limits` | object | no | `contextTokens`, `maxOutputTokens` (positive integers). Enforced, see below. |
| `price` | object | no | `currency` (ISO 4217, default `USD`), `inputPerMTok`, `outputPerMTok`, `cacheReadPerMTok`, `cacheWritePerMTok` (non-negative numbers, per million tokens), `effective` (date). |
| `approval`, `riskClassification`, `evaluation`, `allowedUseCases` | | no | As in the model object (spec 5.4.3). |
| `defaults` | object | no | Parameters (below) used when the agent does not set them. |
| `profiles` | map | no | Named parameter sets. Keys follow the rules for names (spec 3.4); at most 16 profiles. |

Rules:

1. `defaults`, every profile and every agent's `parameters` MUST respect `limits`: a
   `maxOutputTokens` above `limits.maxOutputTokens` is invalid. Validators MUST reject such a
   `Model` manifest, and runtimes MUST reject an execution whose resolved parameters exceed the
   limits. Runtimes MUST NOT send a request whose input exceeds `limits.contextTokens` and MUST
   NOT silently lower a value instead of rejecting (runtime feedback G59; the ceiling rule of
   AEP-0023: reject, never adjust).
2. The governance fields of a `Model` are authoritative over the declarations in an inline model
   object (spec 5.4.3 already allows a model inventory to replace them).
3. A runtime MUST NOT fetch a `Model` from a provider or from a URL found in a manifest. Model
   objects change through reviewed changes only.
4. A `Model` is not a binding: how the runtime reaches the provider is runtime configuration
   (AEP-0021 B6). That configuration MUST NOT contradict the `Model` (for example a connection in
   another region than `region`).

### Changes to section 5.4.3 (Model object)

The model object of an agent is either **inline** (the fields of spec 5.4.3, unchanged) or a
**reference**:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `ref` | object | no | `name` (REQUIRED), `version` (OPTIONAL), `digest` (OPTIONAL) of a `Model` manifest. Resolution, assertions and pinning follow AEP-0029. |
| `profile` | string | no | Name of a profile of the referenced `Model`. Only with `ref`. |
| `parameters` | object | no | Request parameters (below). Allowed inline and with `ref`. |

- A model object with `ref` MUST NOT contain `provider`, `name`, `version`, `region` or the
  governance fields; they come from the `Model`.
- A `profile` that the referenced `Model` does not define MUST be rejected before the execution
  starts.
- An inline model object, as in spec 5.4.3, stays valid. Its governance fields are declarations
  by the author.

**Parameters.** A provider-neutral set:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `maxOutputTokens` | integer | Maximum output tokens per model invocation. |
| `temperature` | number | Sampling temperature, `0` to `2`. |
| `topP` | number | Nucleus sampling, greater than `0` and at most `1`. |
| `stopSequences` | list of string | At most 8 sequences. |
| `reasoningEffort` | string | `low`, `medium` or `high`. |
| `seed` | integer | Seed for providers that support reproducible sampling. |

- Other keys MUST be domain-prefixed extension keys (spec 3.3, for example
  `example.com/top-k`). AWP defines no field that passes raw request content to a provider.
- A runtime that cannot apply a parameter to the resolved provider and model MUST reject the
  execution before it starts (fail closed) and MUST NOT ignore the parameter. The diagnostic names
  the parameter and the agent.
- **Resolution order.** For each parameter the runtime uses the first value it finds in: the
  agent's `parameters`, the selected `profile`, the `Model`'s `defaults`, the runtime's
  documented default. The resolved values MUST respect `limits` (rule 1 of section 6c) and MUST
  be recorded in the reproducibility record (spec 10.7).

### Changes to section 7.4 (Model governance)

- `modelPolicy` rules apply to the resolved model: for a reference, the provider, name, version,
  region and governance fields of the `Model`. The `catalog` field of AEP-0008 is not adopted.
- New requirement field:

  | Field | Type | Description |
  | ----- | ---- | ----------- |
  | `requirements.modelRef` | boolean | If `true`, every agent's model MUST be a reference to a `Model`; inline model objects are rejected. |

- Whether a reference must be pinned with `version` or `digest` follows AEP-0029 (pinning by
  policy and under the `security` profile), not this AEP.
- **Model invocations made by the runtime.** Every model invocation that a runtime makes as part
  of an execution, whether or not an agent of the manifest declares it, MUST satisfy
  `modelPolicy` and `dataPolicy` (spec 7.3), MUST count against the budget (spec 5.7) and MUST
  appear in the usage data and in the reproducibility record (spec 10.7) with its purpose. This
  includes fallbacks, summarising or compacting histories, computing embeddings, routing between
  models, evaluating outputs and sampling requested by an MCP server. The runtime MUST reject the
  execution before it starts if a model it is configured to use for such a purpose does not
  satisfy the policies.

New `purpose` values in usage data and audit events (spec 10.4): `agent` (default), `fallback`,
`summary`, `embedding`, `routing`, `evaluation`, `sampling`.

### Changes to section 7.3 (Data residency)

The region of a model is the `region` of the referenced `Model`, else `model.region`, else the
region configured for the provider in the runtime. The fail-closed rule is unchanged.

### Changes to section 5.7 (Budgets)

When a `Model` defines `price`, the runtime MUST use it to compute cost and MUST name the
`Model` (name, version, digest) in the usage data. Without `price` the existing rule (documented
computation, `costKnown`) holds.

### Changes to section 3.2 and the Kubernetes binding (3.10)

`Model` is a kind written by people, versioned and covered by digests and signatures like
`Agent` and `Policy`. In the Kubernetes binding the plural name is `models`. Whether the resource
is namespaced or cluster-scoped is open question 1.

## Examples

A shared model and an agent that refers to it with a profile and one parameter of its own:

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: Model
metadata:
  name: example-small
spec:
  version: 2.0.0
  owner:
    team: platform-governance
  provider: example-cloud-eu
  name: example-small
  region: EU
  limits:
    contextTokens: 128000
    maxOutputTokens: 16000
  price:
    inputPerMTok: 0.25
    outputPerMTok: 1.25
  approval:
    status: approved
    expires: "2027-06-30"
  defaults:
    maxOutputTokens: 2048
  profiles:
    extract:
      temperature: 0
---
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: Workflow
metadata:
  name: event-digest
spec:
  version: 0.3.0
  owner:
    team: example-team
  classification: internal
  modelPolicy:
    requirements:
      approvalStatus: approved
      region: EU
      modelRef: true
  agents:
    - id: collector
      model:
        ref:
          name: example-small
        profile: extract
        parameters:
          maxOutputTokens: 8192
  workflow:
    - id: collect
      agent: collector
      task: List the upcoming events on https://events.example.com.
```

The resolved parameters of `collector` are `temperature: 0` (profile) and
`maxOutputTokens: 8192` (agent), both within the limits of `example-small`. The runtime records
the `Model` version and digest it resolved (AEP-0029).

An inline model object with parameters, unchanged except for `parameters`:

```yaml
agents:
  - id: assistant
    model:
      provider: example-provider
      name: example-model
      parameters:
        maxOutputTokens: 4096
        temperature: 0.2
```

## Schema changes

- Root kind `Model`; `$defs/ModelSpec`, `$defs/ModelLimits`, `$defs/ModelPrice`,
  `$defs/ModelParameters`.
- `$defs/Model` becomes `oneOf` inline model object or reference (`ref`, `profile`,
  `parameters`); `parameters` added to the inline form.
- `ModelPolicy.requirements.modelRef`.
- Semantic rules: `model.limits-exceeded` (defaults, profile or parameters above `limits`),
  `model.ref-with-inline-fields`, `model.profile-without-ref`, `model.unknown-parameter`
  (non-prefixed key), `price.negative`.
- CRD `schema/crd/models.yaml`.

## Conformance impact

- `core`: validation of `Model` manifests; the reference form of the model object; parameter
  validation and the fail-closed rule for unsupported parameters.
- `governance`: policy checks against the resolved `Model`; `requirements.modelRef`; runtime
  model invocations under model and data policy.
- `audit`: resolved parameters, `Model` identity and the `purpose` of each invocation in usage
  data and the reproducibility record.
- New valid cases: `valid/6c-model.yaml`, `valid/5.4.3-model-ref-profile.yaml`,
  `valid/5.4.3-model-parameters-inline.yaml`.
- New invalid cases: `6c-model-defaults-above-limit.yaml` (`model.limits-exceeded`),
  `5.4.3-model-ref-with-provider.yaml` (`model.ref-with-inline-fields`),
  `5.4.3-profile-without-ref.yaml` (`model.profile-without-ref`),
  `5.4.3-unprefixed-parameter.yaml` (`model.unknown-parameter`),
  `6c-model-negative-price.yaml` (`price.negative`).
- Runtime tests, once a runtime suite exists: unsupported parameter rejected; summary model
  outside `residency.allowed` rejects the execution; usage records `purpose: summary`.

## Compatibility and migration

Additive for manifests: inline model objects without `parameters` stay valid and mean the same.
Runtimes that implement AEP-0008 can convert each catalog model entry into one `Model` object;
provider-level `region` moves to each model, `aliases` have no equivalent yet (open question 2).
The rule for model invocations made by the runtime is new for runtimes: a runtime that today
uses an unrestricted summary or embedding model must bring it under the policies or reject.

## Security considerations

- A `Model` decides what is allowed and what it costs; it is a governed dependency with owner,
  version and digest, changed only by reviewed changes, never fetched.
- Keeping endpoints and credentials out of the `Model` keeps them out of reviewed, shareable
  objects; a runtime connection that contradicts the `Model` region must be rejected.
- Fail-closed parameter handling prevents a manifest from appearing to set a limit (for example a
  low output limit) that a runtime silently ignores.
- Model invocations made by the runtime are a data path the author does not see; without the
  rule of section 7.4 a summary or embedding model could send confidential content to a provider
  that the workflow's data policy forbids.

## Privacy considerations

Summaries and embeddings contain the content of conversations. Bringing them under `dataPolicy`
applies residency and provider rules to them. The usage data names purposes, not content.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **`ModelCatalog` as in AEP-0008** (one list, REQUIRED digest): every change to any model
  changes the digest that every workflow pins. Rejected for the operating cost described under
  Motivation.
- **A model object with connection and credential, as kagent's `ModelConfig`**: convenient on one
  platform, but puts deployment data (base URL, TLS settings, credential reference) into a
  reviewed, portable object. Rejected; runtime configuration keeps them (AEP-0021 B6, AEP-0023).
- **Parameters only inline, reuse through `Agent` references**: no new kind, but limits, prices
  and approvals stay unshared, and agents that differ in prompt or tools repeat the same model
  values.
- **A `ModelProfile` kind written by authors, separate from the `Model`**: allows authors to
  define profiles, but adds a third level of resolution (workflow, agent, profile, model) and
  splits limits from the values they constrain. Kept as open question 3.
- **Do nothing**: parameters stay runtime-specific, and runtime model invocations stay outside
  governance.

## Implementation status

No implementation of this AEP exists.

## Open questions

1. **Scope in the Kubernetes binding.** Classes such as `StorageClass` are cluster-scoped. A
   cluster-scoped `Model` would be shared by all namespaces and could only be changed by cluster
   operators; a namespaced `Model` fits the same-scope reference rule (spec 5.4.2, AEP-0029) and
   tenants. Should `Model` be namespaced, cluster-scoped, or should the binding leave it to the
   runtime with a rule for resolution?
2. **Provider-level data.** AEP-0008 had provider entries with `region` and `aliases` (several
   tenant connections to one provider). Are fields on each `Model` enough, or is a later kind
   `ModelProvider` needed?
3. **Profiles written by authors.** Profiles belong to the owner of the `Model`. Should authors be
   able to define their own named profiles (for example in an `Agent` or a separate kind), within
   the limits of the `Model`?
4. Should `reasoningEffort` also accept a token budget (`reasoningTokens`) for providers that
   express reasoning as a budget?

## Decision

Not decided. This AEP proposes to supersede AEP-0008 and to replace the direction recorded in
owner decision [D10](../docs/decisions.md#d10-model-catalog-prices-in-an-own-kind-referenced-by-digest)
(prices in an own kind referenced by a REQUIRED digest): prices stay in an own kind, but one
object per model, referenced by name, with an optional digest. Changing D10 needs a decision of
the project lead. The AEP needs the reviews listed in the header before it can be accepted
([aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)).

## References

- Spec sections 3.2, 3.3, 3.10, 4.2, 5.4.3, 5.7, 7.3, 7.4, 10.4, 10.7.
- AEP-0007 (MCP sampling, open question 5), AEP-0008 (model and provider catalog), AEP-0021 B6
  (bindings), AEP-0023 (ceilings, credentials outside the execution environment), AEP-0029
  (references by name).
- Runtime feedback G24, G34, G59, G60, G88 ([docs/runtime-feedback.md](../docs/runtime-feedback.md)).
- kagent `ModelConfig` (CNCF project), prior art.
- ISO 4217.
