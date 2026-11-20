---
title: "Versioning"
description: "How AWP API versions and the specification evolve."
banner:
  content: "Draft - v1alpha2. Fields and semantics may change before v1beta1."
---

AWP API versions are written in the `apiVersion` of every manifest:

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha2
```

- `v1alpha2` is the current working draft: `v1alpha1` plus step iteration (`forEach`). A `v1alpha1` manifest becomes a `v1alpha2` manifest by changing `apiVersion` ([changes](/specification/v1alpha2/#141-changes-from-v1alpha1)).
- `v1alpha3` is a proposed draft: `v1alpha2` aligned with the Kubernetes resource model (governance fields in `spec`, extension fields in `extensions`, `status`, kind `WorkflowRun`, step outputs, human input). It is built from Draft AEPs that are not accepted ([changes](/specification/v1alpha3/#142-changes-from-v1alpha2)); `awp-check.mjs migrate` converts `v1alpha1` and `v1alpha2` manifests.
- `v1alpha1` stays available as a draft. Any field, rule or conformance requirement of an alpha version may change incompatibly in a later alpha.
- Beta and stable versions (`v1beta1`, `v1`) follow once the specification has been implemented and tested by more than one party.
- Runtimes reject manifests with an `apiVersion` they do not support (fail closed). Validators pick the schema by the `apiVersion` of each document.
- This website models versions as directories: `/specification/v1alpha2/`, `/specification/v1alpha3/` and `/specification/v1alpha1/`.

See [Versioning in the specification](/specification/v1alpha2/#14-versioning) for the normative rules.
