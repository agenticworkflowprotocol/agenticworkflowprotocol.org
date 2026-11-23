# AWP specification

This directory contains the normative text of the Agentic Workflow Protocol (AWP).

| API version | Status | Text |
| ----------- | ------ | ---- |
| `v1alpha1` | **Draft / alpha** - may change incompatibly | [v1alpha1/README.md](v1alpha1/README.md) |
| `v1alpha2` | **Draft / alpha** - `v1alpha1` plus step iteration ([AEP-0022](../aep/0022-step-iteration.md)); the AEPs below join it when accepted | [v1alpha2/README.md](v1alpha2/README.md) |
| `v1alpha3` | **Proposed draft / alpha** - `v1alpha2` (so with step iteration) aligned with the Kubernetes resource model, with schedule semantics, human input, step outputs, `WorkflowRun` and execution pinning; built from Draft AEPs 0015 to 0021, which are not accepted ([D20](../docs/decisions.md#d20-the-kubernetes-resource-model-draft-becomes-v1alpha3)) | [v1alpha3/README.md](v1alpha3/README.md) |

- Glossary: [v1alpha1](v1alpha1/glossary.md), [v1alpha2](v1alpha2/glossary.md), [v1alpha3](v1alpha3/glossary.md)
- Examples (valid YAML, non-normative): [v1alpha1](v1alpha1/examples/), [v1alpha2](v1alpha2/examples/), [v1alpha3](v1alpha3/examples/)
- Kubernetes CustomResourceDefinitions for `v1alpha3`, generated from the schema: [../schema/crd/](../schema/crd/)

## Roadmap: proposed changes

The following AWP Enhancement Proposals are in the status `Draft` or `Review` under the AEP process
([docs/aep-process.md](../docs/aep-process.md), adopted 2026-10-10). Except AEP-0022 (accepted by
lead decision D19, in the `v1alpha2` and `v1alpha3` drafts), none is accepted and none changes `v1alpha1`. Target versions follow the owner's decisions of 2026-10-10
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
| [0015](../aep/0015-kubernetes-resource-model.md) | Kubernetes resource model alignment | Draft | proposed for `v1alpha3` |
| [0016](../aep/0016-schedule-semantics.md) | Schedule semantics: overlap and missed ticks | Draft | proposed for `v1alpha3` |
| [0017](../aep/0017-human-input.md) | Human input during an execution | Draft | proposed for `v1alpha3` |
| [0018](../aep/0018-step-outputs.md) | Step output interface | Draft | proposed for `v1alpha3` |
| [0019](../aep/0019-workflow-run-and-status.md) | Kind `WorkflowRun` and status conditions | Draft | proposed for `v1alpha3` |
| [0020](../aep/0020-execution-pinning.md) | Pinning an execution to its manifests | Draft | proposed for `v1alpha3` |
| [0021](../aep/0021-extension-model.md) | Extension model aligned with the Kubernetes Gateway API (concept) | Draft | proposed for `v1alpha3` |
| [0022](../aep/0022-step-iteration.md) | Step iteration (`forEach`) | Accepted (lead decision D19) | in the `v1alpha2` draft |
| [0024](../aep/0024-event-triggers.md) | Event triggers with CloudEvents | Draft | proposed for `v1alpha3` |
| [0025](../aep/0025-state.md) | State across executions | Draft | proposed for `v1alpha3` |

The specification text is licensed under [CC BY 4.0](../LICENSE-SPEC); examples, schemas and
code are licensed under [Apache-2.0](../LICENSE).

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. Compliance depends on the implementation,
organizational controls and applicable regulatory requirements.
