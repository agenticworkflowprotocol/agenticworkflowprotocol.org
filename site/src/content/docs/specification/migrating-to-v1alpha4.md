---
title: "Migrating to v1alpha4"
description: "How to move manifests of v1alpha3, v1alpha2 and v1alpha1 to the v1alpha4 draft: from v1alpha3 only apiVersion changes; older versions convert as for v1alpha3."
banner:
  content: "Draft - v1alpha4, the current draft. Fields and semantics may change before v1beta1."
---
`v1alpha4` is `v1alpha3` plus conditional steps (`when`) and workflow steps (`type: workflow`), see
[v1alpha4: what's new](/specification/v1alpha4-whats-new/). This page is informative; the normative
change lists are [spec 14.1](/specification/v1alpha4/#141-changes-from-v1alpha1),
[spec 14.2](/specification/v1alpha4/#142-changes-from-v1alpha2) and
[spec 14.3](/specification/v1alpha4/#143-changes-from-v1alpha3).

## Convert

The reference checker converts `v1alpha1`, `v1alpha2` and `v1alpha3` manifests to `v1alpha4` and
prints the result; always run `check` on it:

```sh
npm ci
node conformance/awp-check.mjs migrate my.workflow.yaml > my.workflow.v1alpha4.yaml
node conformance/awp-check.mjs check --profiles core,governance my.workflow.v1alpha4.yaml
```

Manifests of older versions keep validating against the schema of their own `apiVersion`; you do
not have to convert them at once.

## From v1alpha3

Every `v1alpha3` manifest is a valid `v1alpha4` manifest once its `apiVersion` is changed. Nothing
else is renamed, moved or removed.

<!-- awp-check profiles=core,governance -->
```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: Workflow
metadata:
  name: nightly-report
spec:
  version: 1.0.0
  owner:
    team: platform-team
  classification: internal
  triggers:
    - type: manual
  agents:
    - id: writer
      model:
        provider: ollama
        name: qwen3
  workflow:
    - id: report
      agent: writer
      task: Summarise the open incidents.
  permissions:
    default: deny
```

<!-- awp-check profiles=core,governance -->
```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: Workflow
metadata:
  name: nightly-report
spec:
  version: 1.0.0
  owner:
    team: platform-team
  classification: internal
  triggers:
    - type: manual
  agents:
    - id: writer
      model:
        provider: ollama
        name: qwen3
  workflow:
    - id: report
      agent: writer
      task: Summarise the open incidents.
  permissions:
    default: deny
```

Three things to check after converting:

- **Digest.** `spec.integrity.digest` covers `apiVersion`; recompute it, and sign again if the
  manifest is signed ([spec 9.1](/specification/v1alpha4/#91-manifest-digest)).
- **Runtime support.** A runtime has to support `v1alpha4` to run the converted manifest. A runtime
  that does not support workflow steps rejects manifests with `type: workflow` (fail closed); a
  converted manifest has none until you add one.
- **Kubernetes.** The CRDs serve `v1alpha3` (storage version) and `v1alpha4`; objects of both
  versions can live in the same cluster ([spec 3.10](/specification/v1alpha4/#310-object-stores-and-kubernetes)).

The behaviour of a converted workflow does not change: without `when` and `type: workflow` the
execution model of `v1alpha4` is the one of `v1alpha3`.

## From v1alpha1 and v1alpha2

`migrate` makes the document model changes of `v1alpha3` and sets `apiVersion` to `v1alpha4` in one
run: governance fields move from `metadata` into `spec`, `owner` becomes an object, policy
conditions get an operator and `x-` fields move into `extensions` objects. The changes that need a
decision by the author (DNS-1123 names, label syntax, output names) and the changes in behaviour
(step outputs, reserved variables, schedules, pinning, human input) are the same as for `v1alpha3`;
they are described with before and after examples in
[Migrating to v1alpha3](/specification/migrating-to-v1alpha3/#what-the-converter-cannot-do-for-you).
`check` rejects the converted manifest until the author changes are made.

## Using the new fields

After converting, a workflow can use the new fields:

- Replace a step that only decides whether to go on, or an approval used as a gate, by a `when` on
  the following step ([spec 3.12](/specification/v1alpha4/#312-conditions)).
- Replace an agent or command step that started another workflow through a runtime-specific tool by
  a `type: workflow` step with the permission `workflow.start`
  ([spec 5.6.6](/specification/v1alpha4/#566-workflow-steps)).
