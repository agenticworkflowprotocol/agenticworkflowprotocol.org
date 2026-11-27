---
title: "Manifest"
description: "Structure of an AWP manifest: apiVersion, kind, metadata and spec."
banner:
  content: "Draft - v1alpha4, the current draft. Fields and semantics may change before v1beta1."
---

Every AWP document has four top-level fields, laid out like a Kubernetes resource.

<!-- awp-check profiles=core -->
```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: Workflow          # Workflow, Agent, Policy or WorkflowRun
metadata:
  name: invoice-processing
  labels:
    app.kubernetes.io/part-of: finance
spec:
  version: 1.2.0
  owner:
    team: finance-ai
  agents:
    - id: extractor
      model:
        provider: example-provider
        name: example-model
  workflow:
    - id: extract
      agent: extractor
```

- `kind` is one of `Workflow`, `Agent` (a reusable agent definition), `Policy` (a reusable rule set) or `WorkflowRun` (a request to run a workflow, with its status).
- `metadata` holds only `name`, `namespace`, `labels` and `annotations`. The name is a DNS-1123 label. Version, owner, classification, risk, integrity, signature and provenance are fields of `spec` ([Common spec fields](/specification/v1alpha4/#42-common-spec-fields)).
- Unknown fields are rejected. Extensions go into `extensions` objects. See [Unknown fields and extensions](/specification/v1alpha4/#33-unknown-fields-and-extensions) and [Extending AWP](/concepts/extending-awp/).
- Names, versions, durations, timestamps and digests have fixed formats ([Document model](/specification/v1alpha4/#3-document-model)).
- A [JSON Schema](/schema/awp.v1alpha4.json) expresses the structural rules; the specification lists the semantic rules the schema cannot express.
- Manifests of `v1alpha1`, `v1alpha2` and `v1alpha3` stay valid under their own `apiVersion` and convert with `awp-check.mjs migrate` ([Migrating to v1alpha4](/specification/migrating-to-v1alpha4/)).

Normative text: [Document model](/specification/v1alpha4/#3-document-model), [Metadata and common spec fields](/specification/v1alpha4/#4-metadata-and-common-spec-fields).
