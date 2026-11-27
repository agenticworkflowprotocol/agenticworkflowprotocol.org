---
title: "Specification"
description: "The AWP specification: versions, status and licenses."
banner:
  content: "Draft - v1alpha4 is the current draft. Fields and semantics may change before v1beta1."
---

The normative text lives in the [`spec/`]( https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/tree/main/spec ) directory of the repository and is rendered on this site without copies.

| API version | Status | Text |
| ----------- | ------ | ---- |
| `v1alpha4` | **Current draft / alpha**: `v1alpha3` plus conditional steps (`when`) and workflow steps (decisions D23, D24); may change incompatibly | [Specification v1alpha4](/specification/v1alpha4/), [what's new](/specification/v1alpha4-whats-new/), [migrating](/specification/migrating-to-v1alpha4/) |
| `v1alpha3` | **Draft / alpha**, the Kubernetes resource model; errata only | [Specification v1alpha3](/specification/v1alpha3/), [how it fits together](/specification/v1alpha3-guide/), [migrating](/specification/migrating-to-v1alpha3/) |
| `v1alpha2` | **Draft / alpha**, `v1alpha1` plus step iteration; errata only | [Specification v1alpha2](/specification/v1alpha2/) |
| `v1alpha1` | **Draft / alpha**; errata only | [Specification v1alpha1](/specification/v1alpha1/) |

- Glossary: [v1alpha4](/specification/v1alpha4/glossary/), [v1alpha3](/specification/v1alpha3/glossary/), [v1alpha2](/specification/v1alpha2/glossary/), [v1alpha1](/specification/v1alpha1/glossary/)
- [Versioning](/specification/versioning/) and [changelog](/specification/changelog/)
- JSON Schema (structural rules): [v1alpha4](/schema/awp.v1alpha4.json), [v1alpha3](/schema/awp.v1alpha3.json), [v1alpha2](/schema/awp.v1alpha2.json), [v1alpha1](/schema/awp.v1alpha1.json); [conformance suite](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/tree/main/conformance) and [CLI output formats](/tooling/cli/)

The specification text is licensed under CC BY 4.0. Examples, schemas and code are licensed under Apache-2.0.

:::note[Compliance]
AWP provides machine-readable governance primitives that can help organizations implement and enforce their own compliance requirements. Compliance depends on the implementation, organizational controls and applicable regulatory requirements.
:::
