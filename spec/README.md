# AWP specification

This directory contains the normative text of the Agentic Workflow Protocol (AWP).

| API version | Status | Text |
| ----------- | ------ | ---- |
| `v1alpha1` | **Draft / alpha** - may change incompatibly | [v1alpha1/README.md](v1alpha1/README.md) |
| `v1alpha2` | **Working draft / alpha** - starts from `v1alpha1` with the Kubernetes resource model alignment, schedule semantics and human input (Draft AEPs, not accepted); the other AEPs for `v1alpha2` are not applied yet | [v1alpha2/README.md](v1alpha2/README.md) |

- Glossary: [v1alpha1/glossary.md](v1alpha1/glossary.md), [v1alpha2/glossary.md](v1alpha2/glossary.md)
- Examples (valid YAML, non-normative): [v1alpha1/examples/](v1alpha1/examples/), [v1alpha2/examples/](v1alpha2/examples/)
- Kubernetes CustomResourceDefinitions for `v1alpha2`, generated from the schema: [../schema/crd/](../schema/crd/)

## Roadmap: proposed changes

The following AWP Enhancement Proposals are in the status `Draft` or `Review` under the AEP process
([docs/aep-process.md](../docs/aep-process.md), adopted 2026-10-10). None is accepted and none
changes `v1alpha1`. Target versions follow the owner's decisions of 2026-10-10
([decision log](../docs/decisions.md)); an AEP is accepted only after an external review
and a Final Comment Period, and may still be moved to a later version or rejected.

| AEP | Title | Status | Target |
| --- | ----- | ------ | ------ |
| [0001](../aep/0001-conditional-steps.md) | Conditional steps (`when`) | Review | `v1alpha2` |
| [0002](../aep/0002-tool-argument-constraints.md) | Argument constraints and call limits in permissions | Review | `v1alpha2` |
| [0003](../aep/0003-typed-handoffs.md) | Typed handoffs between steps | Review | `v1alpha2` |
| [0004](../aep/0004-event-references.md) | Event references | Review | `v1alpha2` |
| [0005](../aep/0005-prompt-kind.md) | Kind `Prompt` | Review | `v1alpha2` |
| [0006](../aep/0006-playbook-kind.md) | Kind `Playbook` | Review | `v1alpha2` |
| [0007](../aep/0007-mcp-connection-catalog.md) | MCP connection catalog (`mcp` profile, aligned with MCP) | Review | `v1alpha2` |
| [0008](../aep/0008-model-provider-catalog.md) | Kind `ModelCatalog`, referenced by digest | Review | `v1alpha3` |
| [0009](../aep/0009-audit-payload-levels.md) | Audit payload levels, mandatory content retention | Review | `v1alpha3` |
| [0010](../aep/0010-digest-canonicalization.md) | Digest canonicalisation (JCS) | Review | `v1alpha2` |
| [0011](../aep/0011-required-extensions.md) | Required extensions | Review | `v1alpha2` |
| [0012](../aep/0012-tool-steps.md) | Tool steps (`type: tool`) | Draft | proposed for `v1alpha2` |
| [0013](../aep/0013-runtime-clarifications.md) | Runtime clarifications (budgets, value rendering, rejected approvals, `core` events, deployment policy, server binding) | Draft | proposed for `v1alpha2` |
| [0014](../aep/0014-input-examples-and-schemas.md) | Input examples and object schemas | Draft | proposed for `v1alpha2` |
| [0000](../aep/0000-kubernetes-resource-model.md) | Kubernetes resource model alignment (number to be assigned) | Draft | proposed for `v1alpha2` |
| [0000](../aep/0000-schedule-semantics.md) | Schedule semantics: overlap and missed ticks (number to be assigned) | Draft | proposed for `v1alpha2` |
| [0000](../aep/0000-human-input.md) | Human input during an execution (number to be assigned) | Draft | proposed for `v1alpha2` |
| [0000](../aep/0000-step-outputs.md) | Step output interface (number to be assigned) | Draft | proposed for `v1alpha2` |
| [0000](../aep/0000-workflow-run-and-status.md) | Kind `WorkflowRun` and status conditions (number to be assigned) | Draft | proposed for `v1alpha2` |
| [0000](../aep/0000-execution-pinning.md) | Pinning an execution to its manifests (number to be assigned) | Draft | proposed for `v1alpha2` |

The specification text is licensed under [CC BY 4.0](../LICENSE-SPEC); examples, schemas and
code are licensed under [Apache-2.0](../LICENSE).

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. Compliance depends on the implementation,
organizational controls and applicable regulatory requirements.
