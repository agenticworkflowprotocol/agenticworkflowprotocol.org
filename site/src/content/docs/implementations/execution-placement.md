---
title: "Execution placement (executors)"
description: "Informative guidance on where a runtime executes the steps of a workflow: local, container, Kubernetes, CI runners, serverless."
banner:
  content: "Draft - v1alpha4, the current draft. Fields and semantics may change before v1beta1."
---
A manifest says **what** a workflow may do. It does not say **where** the steps run. That choice belongs to the runtime and its operator: a local process, a container on a host, a Kubernetes pod, a CI job, a serverless task or a managed agent runtime. This page calls such a target an **executor**. It is informative: it adds no requirement to the [specification](/specification/v1alpha4/), and executors are not a manifest field in `v1alpha4`.

## Keep placement out of the manifest

- The manifest digest (spec 9.1) covers what was reviewed. If the executor were a manifest field, moving a workflow from a test cluster to a CI runner would need a new version and a new review, although nothing about its permissions changed.
- Bind the executor to the deployed workflow (or to a single execution) in the runtime's own configuration instead. A practical order is: the choice for this execution, then the binding of the deployed workflow, then a default derived from the network zones the workflow needs.
- An explicit choice must never fall back silently. If the chosen executor is not available, the execution does not start and the error names the executor.

## Governance stays in the control plane

The executor runs steps; it does not decide what they may do.

- Model invocations and actions go through the runtime's model and tool proxies, which check permissions, approvals, budgets and data policy before each call (spec 5.7, 7.5, 7.6). Each call names its step, so the proxy can allow only the tools of that step's agent.
- Budgets are counted from the proxies' own records, not from what the executor reports ([AEP-0013](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0013-runtime-clarifications.md), item 1).
- With this split, choosing a different executor kind cannot weaken governance. It changes isolation, network position and cost.

## Placement is still governance-relevant

- **Data residency** (spec 7.3): an executor has a region and a network position. Reject a placement whose region or network zones do not satisfy the workflow's data and model policies.
- **Network** (spec 7.5, `permissions.network`): the executor needs to reach the runtime's proxies, nothing else. Direct access to models or tool servers bypasses the control plane.
- **Isolation** (spec 5.6.2): command steps need an isolated environment on every executor kind, not only on the default one.

## Credentials for remote executors

Remote executors (CI runners, serverless tasks, managed agent runtimes) are started through an API whose parameters are often readable by others: CI variables, task overrides, invocation payloads, job logs.

- Do not pass the execution's credential in those parameters. Pass a short-lived, single-use bootstrap ticket instead (for example a signed token with its own audience and an expiry of minutes), and let the executor exchange it once for the execution credential over TLS.
- Reject a second exchange of the same ticket, and bind the ticket to one execution.
- Allow callback addresses on loopback or private networks only in development and tests.

## Images and reproducibility

- Pin the executor image by digest (`name@sha256:...`), as the security profile requires for command step images. Some platforms cannot override the image per call; create one task definition per image digest rather than reusing a mutable tag.
- Managed runtimes may require a specific CPU architecture; build multi-architecture images or record the architecture.
- Record the executor kind, its name and the image digest with the execution. The reproducibility record (spec 10.7) lists command step images with their resolved digests but has no field for the executor; keep it in `runtime` until an AEP adds one.

## Typical executor kinds

| Kind | Started through | Notes |
| ---- | --------------- | ----- |
| Local process | Runtime host | Development only; no isolation between executions. |
| Container | Container engine API | One container per execution; good for demos and single hosts. |
| Kubernetes | Pod or job API | Namespaces and network policies give isolation and zones. |
| CI runner | Pipeline trigger API | Prefer typed pipeline inputs over variables; projects can restrict who may set variables. |
| Serverless task | Task API with a pre-registered task definition | Image fixed per task definition; pass only the bootstrap ticket. |
| Managed agent runtime | Invocation API of the platform | Often requires a health and an invocation endpoint in the image and a fixed CPU architecture. |

:::note[Compliance]
AWP provides machine-readable governance primitives that can help organizations implement and enforce their own compliance requirements. Compliance depends on the implementation, organizational controls and applicable regulatory requirements.
:::
