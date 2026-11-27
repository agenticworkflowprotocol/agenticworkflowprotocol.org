---
title: "Versioning"
description: "How AWP API versions and the specification evolve."
banner:
  content: "Draft - v1alpha4 is the current draft. Fields and semantics may change before v1beta1."
---

AWP API versions are written in the `apiVersion` of every manifest:

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
```

- `v1alpha4` is the current working draft (decision D24): `v1alpha3` plus conditional steps (`when`) and workflow steps (`type: workflow`), accepted by lead decision D23 ([changes](/specification/v1alpha4/#143-changes-from-v1alpha3)). The README, the Quickstart and the default of the tools use it. `awp-check.mjs migrate` converts `v1alpha1`, `v1alpha2` and `v1alpha3` manifests to `v1alpha4`; from `v1alpha3` only `apiVersion` changes. See [v1alpha4: what's new](/specification/v1alpha4-whats-new/) and [Migrating to v1alpha4](/specification/migrating-to-v1alpha4/).
- `v1alpha3` (`v1alpha2` aligned with the Kubernetes resource model: governance fields in `spec`, extension fields in `extensions`, `status`, kind `WorkflowRun`, step outputs, schedule semantics, human input, execution pinning; accepted by lead decision D22) was the current draft until D24 and only gets errata.
- `v1alpha2` (`v1alpha1` plus step iteration, `forEach`) and `v1alpha1` stay available as drafts and only get errata. Manifests of these versions keep validating against their own schema.
- Any field, rule or conformance requirement of an alpha version may change incompatibly in a later alpha.
- Beta and stable versions (`v1beta1`, `v1`) follow once the specification has been implemented and tested by more than one party.
- Runtimes reject manifests with an `apiVersion` they do not support (fail closed). Validators pick the schema by the `apiVersion` of each document.
- This website models versions as directories: `/specification/v1alpha4/`, `/specification/v1alpha3/`, `/specification/v1alpha2/` and `/specification/v1alpha1/`.

See [Versioning in the specification](/specification/v1alpha4/#14-versioning) for the normative rules.
