# AWP specification

This directory contains the normative text of the Agentic Workflow Protocol (AWP).

| API version | Status | Text |
| ----------- | ------ | ---- |
| `v1alpha4` | **Next draft / alpha** - `v1alpha3` plus conditional steps (`when`, [AEP-0001](../aep/0001-conditional-steps.md)) and workflow steps (`type: workflow`, [AEP-0028](../aep/0028-workflow-steps.md)), accepted by lead decision [D23](../docs/decisions.md#d23-conditional-steps-and-workflow-steps-start-v1alpha4); not yet the default | [v1alpha4/README.md](v1alpha4/README.md) |
| `v1alpha3` | **Current draft / alpha** - `v1alpha2` (so with step iteration) aligned with the Kubernetes resource model, with schedule semantics, human input, step outputs, `WorkflowRun` and execution pinning (AEPs 0015 to 0020, accepted by lead decision [D22](../docs/decisions.md#d22-v1alpha3-becomes-the-current-draft)); the AEPs below join it when accepted | [v1alpha3/README.md](v1alpha3/README.md) |
| `v1alpha2` | **Draft / alpha** - `v1alpha1` plus step iteration ([AEP-0022](../aep/0022-step-iteration.md)); errata only since D22 | [v1alpha2/README.md](v1alpha2/README.md) |
| `v1alpha1` | **Draft / alpha** - may change incompatibly; errata only | [v1alpha1/README.md](v1alpha1/README.md) |

- Glossary: [v1alpha1](v1alpha1/glossary.md), [v1alpha2](v1alpha2/glossary.md), [v1alpha3](v1alpha3/glossary.md), [v1alpha4](v1alpha4/glossary.md)
- Examples (valid YAML, non-normative): [v1alpha1](v1alpha1/examples/), [v1alpha2](v1alpha2/examples/), [v1alpha3](v1alpha3/examples/), [v1alpha4](v1alpha4/examples/)
- Kubernetes CustomResourceDefinitions for `v1alpha3` (storage version) and `v1alpha4`, generated from the schemas: [../schema/crd/](../schema/crd/)

## Roadmap: proposed changes

The following AWP Enhancement Proposals are in the status `Draft` or `Review` under the AEP process
([docs/aep-process.md](../docs/aep-process.md), adopted 2026-10-10), or accepted by a lead
decision. AEP-0022 (D19, in the `v1alpha2` and `v1alpha3` drafts) and AEPs 0015 to 0020 (D22, in
the `v1alpha3` draft) and AEPs 0001 and 0028 (D23, in the `v1alpha4` draft) are accepted without
the external review; none of the others is accepted,
and none changes `v1alpha1`. Target versions follow the owner's decisions
([decision log](../docs/decisions.md); since D22 every open AEP targets `v1alpha3`); apart from
these recorded lead decisions, an AEP is accepted only after an external review and a Final
Comment Period, and may still be moved to a later version or rejected.

| AEP | Title | Status | Target |
| --- | ----- | ------ | ------ |
| [0001](../aep/0001-conditional-steps.md) | Conditional steps (`when`) | Accepted (lead decision D23) | in the `v1alpha4` draft |
| [0002](../aep/0002-tool-argument-constraints.md) | Argument constraints and call limits in permissions | Review | `v1alpha3` |
| [0003](../aep/0003-typed-handoffs.md) | Typed handoffs between steps | Review | `v1alpha3` |
| [0004](../aep/0004-event-references.md) | Event references | Review | `v1alpha3` |
| [0005](../aep/0005-prompt-kind.md) | Kind `Prompt` | Review | `v1alpha3` |
| [0006](../aep/0006-playbook-kind.md) | Kind `Playbook` | Review | `v1alpha3` |
| [0007](../aep/0007-mcp-connection-catalog.md) | MCP connection catalog (`mcp` profile, aligned with MCP) | Review | `v1alpha3` |
| [0008](../aep/0008-model-provider-catalog.md) | Kind `ModelCatalog`, referenced by digest | Review | `v1alpha3` |
| [0009](../aep/0009-audit-payload-levels.md) | Audit payload levels, mandatory content retention | Review | `v1alpha3` |
| [0010](../aep/0010-digest-canonicalization.md) | Digest canonicalisation (JCS) | Review | `v1alpha3` |
| [0011](../aep/0011-required-extensions.md) | Required extensions | Review | `v1alpha3` |
| [0012](../aep/0012-tool-steps.md) | Tool steps (`type: tool`) | Draft | proposed for `v1alpha3` |
| [0013](../aep/0013-runtime-clarifications.md) | Runtime clarifications (budgets, value rendering, rejected approvals, `core` events, deployment policy, server binding) | Draft | proposed for `v1alpha3` |
| [0014](../aep/0014-input-examples-and-schemas.md) | Input examples and object schemas | Draft | proposed for `v1alpha3` |
| [0015](../aep/0015-kubernetes-resource-model.md) | Kubernetes resource model alignment | Accepted (lead decision D22) | in the `v1alpha3` draft |
| [0016](../aep/0016-schedule-semantics.md) | Schedule semantics: overlap and missed ticks | Accepted (lead decision D22) | in the `v1alpha3` draft |
| [0017](../aep/0017-human-input.md) | Human input during an execution | Accepted (lead decision D22) | in the `v1alpha3` draft |
| [0018](../aep/0018-step-outputs.md) | Step output interface | Accepted (lead decision D22) | in the `v1alpha3` draft |
| [0019](../aep/0019-workflow-run-and-status.md) | Kind `WorkflowRun` and status conditions | Accepted (lead decision D22) | in the `v1alpha3` draft |
| [0020](../aep/0020-execution-pinning.md) | Pinning an execution to its manifests | Accepted (lead decision D22) | in the `v1alpha3` draft |
| [0021](../aep/0021-extension-model.md) | Extension model aligned with the Kubernetes Gateway API (concept) | Draft | proposed for `v1alpha3` |
| [0022](../aep/0022-step-iteration.md) | Step iteration (`forEach`) | Accepted (lead decision D19) | in the `v1alpha2` draft |
| [0023](../aep/0023-step-isolation.md) | Step isolation: network permissions, platform ceilings, credentials and approvals outside the execution environment | Draft | proposed for `v1alpha3` |
| [0024](../aep/0024-event-triggers.md) | Event triggers with CloudEvents | Draft | proposed for `v1alpha3` |
| [0025](../aep/0025-state.md) | State across executions | Draft | proposed for `v1alpha3` |
| [0026](../aep/0026-interactive-execution.md) | Interactive execution: `AgentSession` and autonomy levels | Draft | proposed for `v1alpha3` |
| [0027](../aep/0027-agent-engine.md) | Agent engine: running an agent with an existing coding agent | Draft | proposed for `v1alpha3` |
| [0028](../aep/0028-workflow-steps.md) | Workflow steps (`type: workflow`) | Accepted (lead decision D23) | in the `v1alpha4` draft |

The specification text is licensed under [CC BY 4.0](../LICENSE-SPEC); examples, schemas and
code are licensed under [Apache-2.0](../LICENSE).

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. Compliance depends on the implementation,
organizational controls and applicable regulatory requirements.
