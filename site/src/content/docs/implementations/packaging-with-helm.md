---
title: "Packaging manifests with Helm"
description: "Informative notes on shipping v1alpha3 manifests in a Helm chart: AWP expressions in templates, what the digest covers, and image tags."
banner:
  content: "Draft - v1alpha3, the current draft. Fields and semantics may change before v1beta1."
---
Since `v1alpha3`, AWP manifests are Kubernetes custom resources
([spec 3.10](/specification/v1alpha3/#310-object-stores-and-kubernetes)), so they can be shipped
like any other Kubernetes object, for example in a Helm chart published to an OCI registry. This
page is informative. A chart contains no runtime: without an AWP runtime in the cluster the objects
are stored and nothing runs.

## Escape AWP expressions

AWP expressions (`${{ inputs.venues }}`) contain Helm's own template delimiters. Written as they are,
`helm template` fails with `function "inputs" not defined`. Emit them through a helper:

```text
{{- define "awp.expr" -}}
${{ "{{" }} {{ . }} }}
{{- end -}}
```

```yaml
env:
  VENUES: "{{ include "awp.expr" "inputs.venues" }}"   # renders "${{ inputs.venues }}"
```

## Keep the identity stable

The digest covers `apiVersion`, `kind`, `metadata.name` and `spec`, not the namespace, labels or
annotations ([spec 9.1](/specification/v1alpha3/#91-manifest-digest)).

- Labels that Helm adds and the release namespace do not change the digest, so a signed manifest
  still verifies after `helm install`.
- `metadata.name` and every value rendered into `spec` do change it. If manifests are reviewed or
  signed, do not derive the name from the release name, and treat chart values that end up in
  `spec` as part of the reviewed content: a different value is a different workflow.
- Bump `spec.version` when rendered content changes, not only the chart version.

## Image tags

Outside the `security` profile command step images may be tags: the runtime resolves them to
digests when an execution starts and records them ([spec 10.1](/specification/v1alpha3/#101-execution-identity)),
so a chart does not need digest maintenance. Under the `security` profile images MUST be pinned by
digest ([spec 9.4](/specification/v1alpha3/#94-dependencies)); a chart that targets it needs a
digest in its default values, or the rendered manifest is rejected with `security.image-not-pinned`.

## Check the rendered output

Validate what Helm renders, not the templates. The checker rejects every document that is not an
AWP manifest, so a chart that also ships other Kubernetes objects needs them filtered out first
(for example with `helm template --show-only templates/workflow.yaml`):

```sh
helm template my-release ./chart > rendered.yaml
node conformance/awp-check.mjs check --profiles core,governance rendered.yaml
```

The CustomResourceDefinitions from [`schema/crd/`](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/tree/main/schema/crd)
can be shipped in the chart's `crds/` directory. Helm installs that directory once and never
upgrades it, so update the CRDs separately when the schema changes.
