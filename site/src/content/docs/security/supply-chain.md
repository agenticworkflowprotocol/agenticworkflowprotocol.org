---
title: "Supply chain"
description: "Know what runs before you let it run: digests, signatures, provenance, dependencies."
banner:
  content: "Draft - v1alpha3, the current draft. Fields and semantics may change before v1beta1."
---

```yaml
metadata:
  name: invoice-processing
spec:
  version: 1.2.0
  owner:
    team: finance-ai
  integrity:
    digest: sha256:9b2f6c1e4d8a0b7c3e5f1a2d4c6b8e0f1a3c5e7b9d0f2a4c6e8b0d1f3a5c7e9b
```

- The manifest digest is computed over the RFC 8785 canonical form of `apiVersion`, `kind`, `metadata.name` and `spec` without integrity, signature and provenance, and is verified before execution. Namespace, labels and annotations are not covered, so a manifest read back from an object store still verifies.
- Signatures are detached and bound to the digest; AWP does not define a signature format.
- Under the security profile, container images are pinned by digest and runtimes can restrict sources to trusted registries. Outside it, tags are allowed: the runtime resolves them to digests when an execution starts and pins them for the whole execution.
- Runtimes should be able to output the resolved dependency set (SBOM-like metadata).

Normative text: [Supply chain integrity](/specification/v1alpha3/#9-supply-chain-integrity).

:::note[Compliance]
AWP provides machine-readable governance primitives that can help organizations implement and enforce their own compliance requirements. Compliance depends on the implementation, organizational controls and applicable regulatory requirements.
:::
