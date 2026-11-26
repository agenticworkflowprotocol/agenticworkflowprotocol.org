---
title: "Conformance"
description: "Profiles and conformance statements."
banner:
  content: "Draft - v1alpha3, the current draft. Fields and semantics may change before v1beta1."
---

| Profile | Depends on | Covers |
| ------- | ---------- | ------ |
| `core` | - | Parsing and validating manifests, step graph, step outputs, budgets, permissions, secrets, manifest digest, pinning of executions, `WorkflowRun` (if executions are objects), `workflow.*` events |
| `governance` | `core` | Ownership, data policy, model policy, approvals, risk levels, separation of duties, environments, policies |
| `audit` | `core` | Event envelope and types, integrity modes, decision and reproducibility records |
| `security` | `core` | Digests, signatures, image pinning, isolation, secret redaction |
| `mcp` | `core` | MCP servers as tool sources, action identifiers per tool call |
| `a2a` | `core` | Remote agents, agent card verification |
| `interaction` | `core` | Input steps, agent requests to a person, answer validation, `input.*` events |

A runtime that claims conformance publishes a statement:

```yaml
implementation:
  name: example-runtime
  version: 0.4.0
  url: https://runtime.example.org
conformance:
  awp: v1alpha3
  profiles:
    - core
    - governance
    - audit
  limitations:
    - "audit: integrity mode signed is not supported; hash-chain only"
  limits:
    outputSize: 1MiB
  executionObjects: true
```

`limits` states output limits above the minimums of the specification, and `executionObjects` states that executions are exposed as `WorkflowRun` objects.

The conformance suite in the repository tests validators and manifest rules. Until a public runtime test suite exists, conformance statements are self-declarations. No implementation is conformant to `v1alpha3` today.

Normative text: [Conformance](/specification/v1alpha3/#11-conformance).

:::note[Compliance]
AWP provides machine-readable governance primitives that can help organizations implement and enforce their own compliance requirements. Compliance depends on the implementation, organizational controls and applicable regulatory requirements.
:::
