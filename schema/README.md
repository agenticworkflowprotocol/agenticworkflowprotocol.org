# AWP JSON Schema (v1alpha1, v1alpha2)

[`awp.v1alpha1.json`](awp.v1alpha1.json) is a JSON Schema (draft 2020-12) for AWP manifests of the
API version `awp.agenticworkflowprotocol.org/v1alpha1`. It expresses the **structural** rules of the
[specification](../spec/v1alpha1/README.md). Rules that JSON Schema cannot express are listed below
as **semantic validation rules**; a validator that claims to accept exactly the manifests the
specification allows (spec section 11.1) must implement both layers.

**The schema is normative for document structure**: field names, types, required fields, closed
objects, enumerations and patterns (decided 2026-10-10, [decision log D2](../docs/decisions.md#d2-json-schema-is-normative-for-structure)).
Whether a manifest is written as YAML or JSON does not matter; YAML is parsed into the JSON data
model first. The specification text is normative for semantics and runtime behaviour, and the
semantic rules below are normative where they cite a section of it. A discrepancy between schema
and text is a defect that is fixed by an erratum in whichever artefact is wrong; until it is fixed,
validators follow the schema for structure. Implementations derive their types and validators
from the schema, not the other way round.

## Use

| Entry point | Validates |
| ----------- | --------- |
| `schema/awp.v1alpha1.json` | Any manifest; selects the kind-specific rules from `kind`. |
| `schema/awp.v1alpha1.json#/$defs/Workflow` | A manifest of kind `Workflow`. |
| `schema/awp.v1alpha1.json#/$defs/Agent` | A manifest of kind `Agent`. |
| `schema/awp.v1alpha1.json#/$defs/Policy` | A manifest of kind `Policy`. |
| `schema/awp.v1alpha2.json` (and the same `$defs`) | Manifests of `awp.agenticworkflowprotocol.org/v1alpha2` ([specification](../spec/v1alpha2/README.md), working draft). |
| `schema/awp.v1alpha2.json#/$defs/WorkflowRun` | An execution object of kind `WorkflowRun` (spec v1alpha2 section 10.8). `ManifestStatus` and `WorkflowRunStatus` describe the `status` a runtime writes; validators ignore `status`. |
| `schema/crd/*.yaml` | Kubernetes CustomResourceDefinitions for `v1alpha2` (`workflows`, `agents`, `policies`, `workflowruns`), generated from `awp.v1alpha2.json` (see below). |

YAML manifests are parsed first (YAML 1.2 core schema; custom tags and non-string keys rejected,
spec 3.1) and the resulting JSON value is validated. Every document of a multi-document file is
validated on its own. The reference checker in [`conformance/`](../conformance/README.md) shows the
complete pipeline: YAML restrictions, then this schema, then the semantic rules.

## Design decisions

- **Closed objects.** Every object with defined fields has `additionalProperties: false`, with one
  exception: properties matching `^x-` are allowed and unconstrained (spec 3.3). Maps whose keys
  are data (`labels`, `annotations`, `actionGroups`, `permissions.tools`, `environments`, `env`,
  trigger `filter`) are not field sets: all of their keys are data, and `x-` has no special
  meaning there.
- **Fail closed on profiles is not structural.** Whether a field belongs to a profile the validator
  supports (spec 3.3, item 3) depends on the validator; the schema accepts all fields of all
  profiles. See semantic rule `profile.unsupported`.
- **Agent entries** are discriminated by their fields: `ref` selects the agent reference form,
  `protocol` the remote agent form, otherwise the inline form. Mixed forms (for example `ref` plus
  `model`) are rejected by the closed objects of the selected form.
- **Step types** are checked with `if`/`then`: a step has exactly the fields of its type (spec
  5.6.1). `type` defaults to `agent`.
- **Expressions.** Expression-enabled fields (`task`, `env` values, `permissions.tools.*.resources`
  entries, `approval.message`) use the `Expression` pattern: any `${{ ... }}` must contain exactly
  one of `inputs.<name>`, `steps.<id>.outputs.<name>`, `execution.id`, `execution.environment`
  (spec 3.9). Output names are otherwise unconstrained by the specification; inside expressions
  they must not contain whitespace, `.`, `{`, `}` or `$`. Fields that are not expression-enabled
  (notably `command`) are not scanned.
- **Digests** (spec 3.8): `sha256`, `sha384` and `sha512` have their fixed hex length; other
  algorithms are accepted syntactically (`<algorithm>:<lowercase hex>`) and reported as the warning
  `digest.algorithm-unknown`.
- **`maxRetries`** is validated as a positive integer because spec 5.7 requires all limits to be
  positive; `retries` on a step may be `0`.
- **Dates** use the `full-date` shape; calendar validity (for example `2027-02-30`) is a semantic
  rule. No JSON Schema `format` keyword is used, so validators need no format plugins.
- Event envelopes, reproducibility records and conformance statements (spec 10 and 11.3) are not
  manifests and are not covered by this schema.

## v1alpha2 and Kubernetes

`awp.v1alpha2.json` has the same rules as `awp.v1alpha1.json` except for the document model
([spec v1alpha2 section 14.1](../spec/v1alpha2/README.md#141-changes-from-v1alpha1)): `metadata`
holds only Kubernetes `ObjectMeta` fields, the common governance fields are in `spec`, extension
fields are keys of `extensions` objects instead of `x-` properties, `owner` and policy conditions
have a single type, and `status` is reserved. These changes make the schema expressible as a
Kubernetes structural schema.

`conformance/crd.mjs` generates the CustomResourceDefinitions in [`crd/`](crd/) from it:
`$ref` is inlined, `const` becomes `enum`, `if`/`then`/`else`, combinators, `propertyNames` and
patterns that Go's RE2 cannot evaluate (lookahead) are dropped, and every object keeps unknown
fields (`x-kubernetes-preserve-unknown-fields`) instead of pruning them. The API server therefore
checks types and the remaining constraints, and unknown or misplaced fields stay visible to the
AWP validator in the runtime or an admission webhook (spec v1alpha2 section 3.10). `npm test`
fails when the generated files are stale; regenerate them with `node conformance/crd.mjs write`.

`status` is typed with `ManifestStatus` or `WorkflowRunStatus`, so that the API server checks what
a runtime writes, and the columns of `kubectl get` show the conditions `Valid` and `Ready` (for
runs: workflow and phase).

The semantic rules below apply to both versions. In `v1alpha2` their paths use `spec` where
`v1alpha1` uses `metadata` (for example `/spec/risk/level`), and `extensions` objects are skipped
where `v1alpha1` skips `x-` fields.

## Semantic validation rules

These rules apply to documents that are structurally valid. They are implemented by the reference
checker (`conformance/semantic.mjs`) and exercised by the conformance suite. Codes are stable
identifiers for diagnostics ([docs/cli.md](../docs/cli.md#3-diagnostics)).

### Errors

| Code | Spec | Rule |
| ---- | ---- | ---- |
| `yaml.parse-error`, `yaml.custom-tag`, `yaml.non-string-key` | 3.1 | The document is well-formed YAML 1.2 without features that have no JSON equivalent (custom tags, non-string keys). |
| `id.duplicate` | 3.4, 5.6.3, 8.2 | Agent ids, step ids and rule ids are unique within their list. |
| `name.duplicate` | 5.5.1 | MCP server names are unique (they are the reference key of tool sources). |
| `dependsOn.unknown-step` | 5.6.3 | Every `dependsOn` entry names an existing step. |
| `step.unknown-agent` | 5.6.3 | The `agent` of an agent step names an existing entry of `spec.agents`. |
| `dependsOn.cycle` | 5.6.3 | The steps form a directed acyclic graph (a self-dependency is a cycle). |
| `expr.unknown-step` | 3.9 | `steps.<id>` names an existing step. |
| `expr.not-a-dependency` | 3.9, 5.6.3 | `steps.<id>` is used only in a step that depends on `<id>` directly or transitively. |
| `expr.undeclared-output` | 5.6.3 | Only outputs declared in the `outputs` of that step are referenced. |
| `expr.step-reference-outside-step` | 3.9 | `steps.<id>` appears only inside a step (not in workflow-level `permissions` or `approval`). Conservative reading: outside a step there is no dependency that could justify the reference. |
| `retries.exceeds-budget` | 5.6.1 | A step's `retries` does not exceed `budget.resources.maxRetries` (workflow or step level, minimum). |
| `actionGroup.nested` | 5.5.4 | A group does not contain another group. |
| `secretRef.undeclared` | 7.9 | A `secretRef` names a secret declared in `spec.secrets` of the same manifest. |
| `secretRef.scope` | 7.9 | The `scope` of that secret contains the consumer (MCP server name or agent id). The default scope is empty. |
| `secret.literal-field` | 7.9 | No field named `token`, `password`, `apiKey`, `secret` or `privateKey` with a literal value outside `x-` extensions, including inside free-form values. |
| `input.pattern-invalid` | 5.3 | An input `pattern` is a valid ECMA-262 regular expression. |
| `date.invalid` | 3.7 | Dates exist in the calendar. |
| `digest.mismatch`, `digest.unsupported-algorithm` | 9.1 | With digest verification enabled, `metadata.integrity.digest` equals the digest over the RFC 8785 serialization of the manifest without `metadata.integrity`, `metadata.signature` and `metadata.provenance`. |
| `profile.unsupported` | 3.3 | A field of a profile the validator does not support is rejected, naming field and profile (table in spec 3.3, plus `kind: Policy` for the governance profile). In `v1alpha2` this includes the `interaction` profile (input steps, `humanInput`). |
| `governance.classification-required` | 7.1 | Under the governance profile `Workflow` and `Agent` have `metadata.classification` (`owner.team` is structurally required). |
| `input.required-unknown-field` | 5.8 (v1alpha2) | `answerSchema.required` names fields of `answerSchema.properties`. |
| `input.enum-not-string` | 5.8 (v1alpha2) | `enum` is only used on answer fields of type `string`. |
| `input.default-mismatch` | 5.8 (v1alpha2) | The `default` of an input step is a valid answer: a string without `answerSchema`, otherwise an object that matches it. |
| `step.reserved-env` | 5.6.4 (v1alpha2) | `env` of a step defines no variable with the prefix `AWP_`; the runtime sets `AWP_OUTPUTS`, `AWP_EXECUTION_ID`, `AWP_STEP_ID` and `AWP_ATTEMPT`. |
| `security.image-not-pinned` | 9.4 | Under the security profile `mcpServers[].image` and command step `image` are pinned by digest. |

### Warnings

| Code | Spec | Finding |
| ---- | ---- | ------- |
| `mcp.server-unresolved` | 5.5.1 | A tool source names an MCP server that is not declared; it must be resolvable by runtime binding. |
| `expr.undeclared-input` | 3.9 | An expression references an input that is not declared. |
| `permissions.secret-undeclared` | 7.5.1 | `permissions.secrets` names a secret that is not declared. |
| `digest.algorithm-unknown` | 3.8 | A digest uses an algorithm other than sha256, sha384, sha512. |
| `lint.command-expression` | 5.6.2 | `command` contains `${{ }}`; commands are not expression-enabled and the text is passed literally. |
| `lint.schedule-required-input` | 5.2 | A `schedule` trigger is declared, but an input is `required`; schedule triggers supply no inputs, so scheduled executions would not start. |
| `lint.environment-not-listed` | 7.10 | `spec.environment.name` is not a key of `spec.environments`. |
| `lint.permissions-absent` | 7.5.3 | Security profile only: no `permissions` object, so every action of exposed tools is allowed by permissions. |

### Rules that need a runtime or other documents

The following requirements cannot be decided from one manifest and are therefore not checked
statically. Conformance for them is demonstrated by runtime tests, not by this suite.

- Input values are validated before execution; data classes of inputs against `dataPolicy`
  (spec 5.3, 7.2).
- Resolution of `ref` (agents), `include` (policies) and `promptRef` and verification of their
  digests; secrets declared by a referenced `Agent` must also be declared by the workflow (spec
  5.4.2, 6, 8.1, 9.1).
- Existence of non-declared MCP servers via runtime binding (spec 5.5.1).
- Model policy against models, residency and provider checks, environment of an execution, budget
  enforcement, permissions, approvals, separation of duties and the decision algorithm (spec 5.7,
  7.x, 8.4).
- `audit.enabled: false` handling under the audit profile, `integrity.mode` and
  `retention.duration` capabilities (spec 10.2).
- Immutability of published versions (spec 3.5).
