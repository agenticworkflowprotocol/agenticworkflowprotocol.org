---
title: "Migrating to v1alpha3"
description: "What changes for manifest authors from v1alpha1 and v1alpha2 to the v1alpha3 draft, with before and after examples and the reason for each change."
banner:
  content: "Draft - v1alpha3, errata only. The current draft is v1alpha4: see Migrating to v1alpha4."
---
`v1alpha3` aligns the document model with Kubernetes, so that a manifest can be stored unchanged as a
custom resource and still be used without Kubernetes ([AEP-0015](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0015-kubernetes-resource-model.md)).
It also adds step outputs, schedule semantics, human input, `WorkflowRun` and execution pinning.
This page is informative; the normative change lists are [spec 14.1](/specification/v1alpha3/#141-changes-from-v1alpha1)
and [spec 14.2](/specification/v1alpha3/#142-changes-from-v1alpha2). For the new parts see
[v1alpha3: how it fits together](/specification/v1alpha3-guide/). The current draft is `v1alpha4`;
`migrate` converts to it directly, and the changes on this page apply in the same way, see
[Migrating to v1alpha4](/specification/migrating-to-v1alpha4/).

## Convert

Most document model changes are mechanical. The reference checker converts `v1alpha1` and
`v1alpha2` manifests and prints the result; always run `check` on it, because some changes need
the author ([see below](#what-the-converter-cannot-do-for-you)):

```sh
npm ci
node conformance/awp-check.mjs migrate my.workflow.yaml > my.workflow.v1alpha3.yaml
node conformance/awp-check.mjs check --profiles core,governance my.workflow.v1alpha3.yaml
```

Then review the [changes the converter cannot do](#what-the-converter-cannot-do-for-you) below.

## Governance fields move into spec

<!-- awp-check profiles=core,governance -->
```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha1
kind: Workflow
metadata:
  name: invoice-processing
  version: 1.2.0
  description: Extract, check and book invoices.
  owner:
    team: finance-automation
  classification: confidential
  purpose: Accounts payable processing
  risk:
    level: high
spec:
  agents:
    - id: extractor
      model:
        provider: ollama
        name: qwen3
  workflow:
    - id: extract
      agent: extractor
      task: Extract the invoice fields.
```

<!-- awp-check profiles=core,governance -->
```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: Workflow
metadata:
  name: invoice-processing
spec:
  version: 1.2.0
  description: Extract, check and book invoices.
  owner:
    team: finance-automation
  classification: confidential
  purpose: Accounts payable processing
  risk:
    level: high
  agents:
    - id: extractor
      model:
        provider: ollama
        name: qwen3
  workflow:
    - id: extract
      agent: extractor
      task: Extract the invoice fields.
```

`version`, `owner`, `description`, `classification`, `purpose`, `risk`, `integrity`, `signature`
and `provenance` move from `metadata` to `spec` with unchanged meaning, in every kind. In
Kubernetes, `metadata` is `ObjectMeta`: the API server drops fields it does not know, so a stored
`v1alpha1` workflow would lose its version and owner, and its digest would no longer verify.

## One type per field

A CustomResourceDefinition needs a structural schema, and "a string or an object" is not one.

- `owner` is always an object: `owner: platform-team` becomes `owner: {team: platform-team}`.
- Policy conditions always use an operator: `action: production.deploy` becomes
  `action: {equals: production.deploy}`.
- `x-` fields are only allowed as keys of an `extensions` object, because free keys next to defined
  fields are not structural. This is an interim step; [AEP-0021](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0021-extension-model.md)
  proposes an extension model that replaces them.

<!-- awp-check profiles=core,governance -->
```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: Policy
metadata:
  name: production-guard
spec:
  version: 1.0.0
  owner:
    team: governance-team
  rules:
    - id: no-prod-deploys-by-agents
      effect: deny
      when:
        action:
          equals: production.deploy
        actor.type:
          equals: agent
        risk.level:
          gte: high
```

## Objects read back from a store

- Fields an object store fills in (`uid`, `resourceVersion`, `generation`, `managedFields`, ...)
  are accepted and ignored. `v1alpha1` rejects them, so it could not check what is stored in a
  cluster.
- `status` is reserved for the runtime. Validators ignore it and runtimes never derive a governance
  decision from a status they did not write ([spec 3.11](/specification/v1alpha3/#311-status)).
- The digest covers `apiVersion`, `kind`, `metadata.name` and `spec` without `integrity`,
  `signature` and `provenance`. Namespace, labels and annotations are not covered, because
  deployment tools change them; a signed manifest keeps its digest through a deployment
  ([spec 9.1](/specification/v1alpha3/#91-manifest-digest)). Recompute `spec.integrity.digest`
  after converting: the input of the digest changed.

## What the converter cannot do for you

Three document model changes need a decision by the author. `check` rejects the converted manifest
until they are made:

- **Names.** `metadata.name` must be a DNS-1123 label (lower case, digits and `-`, at most 63
  characters). `migrate` reports a name that is not one; renaming changes the digest and every
  reference to the manifest ([spec 3.4](/specification/v1alpha3/#34-names-and-identifiers)).
- **Labels.** Label keys and values follow the Kubernetes label syntax: a value such as
  `Finance and Ops` is rejected (`schema.pattern`). `migrate` does not report it; move such text
  into an annotation ([spec 4.1](/specification/v1alpha3/#41-metadata)).
- **Output names.** `outputs[].name` must match `^[A-Za-z_][A-Za-z0-9_]{0,62}$`, because it is a
  file name in `$AWP_OUTPUTS`: `pull-request` becomes for example `pull_request`. `migrate` does
  not report it, and every `steps.<id>.outputs.<name>` reference has to be renamed with it.

The other changes affect how a workflow behaves, not only how it is written.

- **Step outputs.** A command step writes each declared output as a file into `$AWP_OUTPUTS`; an
  agent step ends with `complete_step`. Images and prompts that relied on a runtime-specific
  convention must be changed ([spec 5.6.4](/specification/v1alpha3/#564-step-outputs)).
- **Reserved variables.** `env` must not set variables that start with `AWP_`; the checker reports
  `step.reserved-env`.
- **Schedules.** A tick while the previous execution still runs is now skipped (`concurrencyPolicy:
  forbid` is the default), and missed ticks are not caught up unless `startingDeadline` is set. Set
  `concurrencyPolicy: allow` if overlapping executions are intended ([spec 5.2](/specification/v1alpha3/#52-triggers)).
- **Executions as objects.** A runtime that exposes executions as objects uses the kind
  `WorkflowRun`. A manual start is a `WorkflowRun` created by the person who starts it
  ([spec 10.8](/specification/v1alpha3/#108-kind-workflowrun)).
- **Pinning.** An execution keeps the manifests and image digests it started with. Outside the
  `security` profile image tags are allowed, because the runtime resolves and records them at start
  ([spec 10.1](/specification/v1alpha3/#101-execution-identity)).
- **Human input.** Workflows that used approvals to collect information can use input steps
  instead (profile `interaction`, [spec 5.8](/specification/v1alpha3/#58-human-input)). An answer
  never counts as an approval.

From `v1alpha2`, `forEach` (step iteration) is unchanged, but each item run now produces its
outputs through `$AWP_OUTPUTS` or `complete_step` ([spec 5.6.5](/specification/v1alpha3/#565-iteration)).
