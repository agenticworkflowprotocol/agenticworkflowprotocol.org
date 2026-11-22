# AEP-0021: Extension model aligned with the Kubernetes Gateway API

| | |
| --- | --- |
| **AEP** | 0021 |
| **Title** | Extension model aligned with the Kubernetes Gateway API |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft (concept for discussion) |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), someone familiar with the Gateway API, security reviewer |
| **Reviewers** | - |
| **Target API version** | `v1alpha3` |
| **Profiles affected** | all (section 3.3, 8, 11 of the specification) |
| **Created** | 2026-11-19 |
| **Discussion** | issue to be opened |
| **Supersedes** | [AEP-0011](0011-required-extensions.md) (if accepted) |
| **Superseded-by** | - |

## Summary

Replace the generic `extensions` objects (`x-` keys on every object) with the extension model of
the Kubernetes Gateway API: support levels per field (Core, Extended, Implementation-specific) and
named features; an optional `WorkflowClass` that says which runtime handles a workflow and which
features it supports; closed enums with an `extensionRef` escape hatch at a few defined extension
points; domain-prefixed values for open value spaces; `Policy` objects that attach to workflows
through `targetRefs`; runtime bindings as implementation-specific objects with the same
`targetRefs`, at most one accepted binding per workflow and runtime, and operator-side constraints
on binding fields that touch governance; annotations only for hints. The CustomResourceDefinitions
prune unknown fields and express conditional rules with CEL, as the Gateway API does since it
removed its validating webhook. References and status are defined as plain data, so that runtimes
without an API server implement the same model.

This document is a concept. Nothing is applied to the specification yet.

## Motivation

`v1alpha3` lets every object in `spec` carry an `extensions` object with `x-` keys and arbitrary
values. This came from the `x-` convention of OpenAPI and CloudEvents and keeps the fail-closed
rule for unknown fields. On Kubernetes it has three problems:

1. **No Kubernetes API does this.** Projects in the ecosystem (Gateway API, Tekton, Knative,
   KubeVirt, Crossplane, KEDA, Dynamic Resource Allocation) extend at named places with typed
   references or domain-prefixed values, not with a bag on every object.
2. **The CRDs must keep unknown fields everywhere.** Arbitrary values under any object force
   `x-kubernetes-preserve-unknown-fields`, so `kubectl apply --validate=strict` cannot reject a
   misplaced field, and errors only show up after the apply (runtime feedback G09).
3. **Required extensions need extra machinery.** An extension that adds a restriction is silently
   dropped by runtimes that ignore it; AEP-0011 adds `requiredExtensions` to repair that, and the
   prefix list (decision D12) exists only because `x-` names can collide.

Runtime experience points the same way: a Kubernetes runtime proof of concept needed no extension
field at all. Everything runtime-specific (images, volumes, model access, secret mapping, run
history) went into its own binding object that points at the workflow, which is the Gateway API
pattern of `parametersRef` and policy attachment.

## Prior art: the Gateway API

The Gateway API is a specification with many independent implementations, support levels and
vendor extensions, which is the situation of AWP. Facts used by this proposal (sources in the
references):

- **Support levels.** Every field is Core (all implementations), Extended (portable, optional) or
  Implementation-specific (not portable). Extended features have PascalCase names that start with
  the resource (`HTTPRouteQueryParamMatching`). Implementations publish the features they support
  in `GatewayClass.status.supportedFeatures`; the conformance suite derives its tests from it, and
  conformance reports are submitted per profile and version (GEP-2162, GEP-1709).
- **Classes.** A `GatewayClass` names the controller (`controllerName`, domain-prefixed) and points
  to implementation-specific configuration with `parametersRef {group, kind, name, namespace}`.
  An invalid reference sets `Accepted=False` with reason `InvalidParameters`.
- **Escape hatch on closed enums.** Filter types are a closed enum; vendor filters use
  `type: ExtensionRef` with `extensionRef {group, kind, name}` in the same namespace, guarded by CEL.
  An unresolvable extension MUST NOT be skipped; affected requests get an error. Bad references
  set `ResolvedRefs=False` with reasons such as `InvalidKind` or `BackendNotFound`.
- **Domain-prefixed values.** Where a value space is open (protocols, address types, TLS options),
  bare names belong to the specification and implementation values use a domain prefix
  (`example.com/custom-protocol`); such values are Implementation-specific by definition.
- **Policy attachment** (GEP-713, Memorandum). Additional behaviour lives in policy objects with
  `targetRefs {group, kind, name, sectionName}` in the same namespace, a status per target
  (`ancestors[]` with `Accepted` and reasons `Conflicted`, `Invalid`, `TargetNotFound`), a
  discovery label and an "affected" condition on the target. GEP-713 explicitly aims to avoid
  annotation-based alternatives.
- **Validation.** The CRDs prune unknown fields and use CEL (`x-kubernetes-validations`); the
  validating webhook was removed in v1.1. GEP-922 says implementations must not rely on CRD
  validation as a security mechanism.

The same shapes appear elsewhere: Tekton `CustomRun` (`customRef`, `customSpec`), KubeVirt network
binding plugins (a name in the object, registration in the cluster configuration), Dynamic Resource
Allocation (`opaque: {driver, parameters}`), KEDA triggers (`type` plus parameters) and Cluster API
provider references.

## Proposal

The building blocks are independent; each can be accepted or rejected on its own.

### B1. Support levels and named features

- Every field of the specification is marked **Core**, **Extended** or
  **Implementation-specific**, as in the Gateway API.
- Extended functionality gets **feature names** in PascalCase that start with the kind:
  `WorkflowApprovalStep`, `WorkflowInputStep`, `WorkflowScheduleConcurrency`, `AgentHumanInput`,
  `WorkflowRemoteAgent`, `WorkflowMcpServers`, `PolicyKind`, `AuditHashChain`, ...
- **Profiles stay** as bundles of features for conformance claims (`governance`, `audit`, ...), as
  Gateway API profiles bundle features. The rule of spec 3.3 becomes: a field of a feature the
  runtime does not support is rejected with an error that names the feature.
- The conformance statement lists `supportedFeatures`; on Kubernetes they are also published in the
  status of the class (B2).

### B2. `WorkflowClass` (Kubernetes binding, optional)

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: WorkflowClass
metadata:
  name: standard
spec:
  controllerName: runtime.example.com/controller
  parametersRef:
    group: runtime.example.com
    kind: RuntimeConfig
    namespace: runtime-system
    name: default
status:
  conditions:
    - type: Accepted
      status: "True"
      reason: Accepted
  supportedFeatures:
    - name: Workflow
    - name: WorkflowApprovalStep
    - name: WorkflowScheduleConcurrency
```

- Cluster-scoped. Names the runtime (`controllerName`, domain-prefixed) and its own configuration
  (`parametersRef`). Several runtimes can run in one cluster without acting on the same workflows.
- A workflow selects its class through deployment data, not through the governed content (see
  open question 1), so the digest and portability do not change.
- Runtimes without Kubernetes have one implicit class and publish `supportedFeatures` in their
  conformance statement.
- `WorkflowClass` is not needed to select a runtime when runtime bindings are used (B6): the kind
  of a binding belongs to one controller, so the binding already names the runtime. The class can
  therefore wait until AWP publishes conformance reports, which need `supportedFeatures` in the
  cluster.

### B3. Closed enums with `extensionRef` at defined extension points

Only a few places are open for implementations, each with the same shape:

```yaml
workflow:
  - id: deploy
    type: extension
    extensionRef:
      group: runtime.example.com
      kind: CanaryDeployment
      name: web-shop-canary
    dependsOn: [test]
```

| Extension point | Shape | Instead of |
| --- | --- | --- |
| Step | `type: extension` + `extensionRef` | `x-` fields on steps; complements AEP-0012 tool steps |
| Tool source | `type: extension` + `extensionRef` | vendor tool source fields |

- `extensionRef` is `{group, kind, name}` of an object in the same namespace (like the Gateway API
  `LocalObjectReference`); the referenced object is validated by its own CRD and controller.
- **Fail closed.** If the runtime does not support the kind or cannot resolve the object, the
  workflow is not ready (`Ready=False`, condition `ResolvedRefs=False` with reason `InvalidKind`
  or `RefNotFound`), and no execution starts. An extension step is never skipped.
- **Governance applies.** An extension step is an action. Its action identifier is declared by the
  extension (domain-prefixed, see open question 2) and is subject to permissions, policies,
  approvals and audit like every other action.
- `extensionRef` is part of `spec` and covered by the digest. Because an unknown reference always
  fails closed, a separate list of required extensions (AEP-0011) is no longer needed.

### B4. Domain-prefixed values in open value spaces

Bare names belong to AWP; implementations use a DNS subdomain prefix, and such values are
Implementation-specific:

| Field | AWP values | Implementation value |
| --- | --- | --- |
| `model.provider` | names listed by AWP | `models.example.com/gateway` |
| `secrets[].source` | names listed by AWP (resolved by the runtime) | `secrets.example.com/vault-ha` |
| audit event types | `workflow.*`, `agent.*`, ... | `example.com/cache.hit` (today reverse-domain) |
| condition types | `Valid`, `Ready`, `Accepted`, `Succeeded`, `ResolvedRefs`, `PoliciesAttached`, `Bound` | `runtime.example.com/Scheduled` (rule already in spec 3.11) |

The same rule applies wherever AWP later opens a value space. A runtime that does not know a value
rejects the manifest.

`triggers[].source` of an event trigger is not such a value space: it is matched against the
CloudEvents `source` attribute and names the event producer (spec 5.2, AEP-0004, AEP-0024). Which
adapter or transport delivers the event is runtime configuration, for example in a trigger
object (runtime feedback G52, G54).

### B5. Policy attachment

`Policy` gets `targetRefs`, so that a platform team can attach a policy to workflows without
editing them:

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: Policy
metadata:
  name: no-production-autonomy
  namespace: payments
spec:
  version: 1.0.0
  owner:
    team: platform-governance
  targetRefs:
    - group: awp.agenticworkflowprotocol.org
      kind: Workflow
      name: invoice-processing
    - group: awp.agenticworkflowprotocol.org
      kind: Workflow
      name: payment-run
      sectionName: approve-payment   # a step id
  rules:
    - id: deploy-needs-release-manager
      when:
        action:
          equals: production.deploy
      effect: requireApproval
      approval:
        approvers:
          - role: release-manager
status:
  ancestors:
    - ancestorRef: {group: awp.agenticworkflowprotocol.org, kind: Workflow, name: invoice-processing}
      controllerName: runtime.example.com/controller
      conditions:
        - type: Accepted
          status: "True"
          reason: Accepted
```

- `targetRefs` (at most 16 entries) names workflows or agents in the same namespace; `sectionName`
  narrows to a step or agent id. `include` in the workflow (spec 8.1) stays for author-chosen
  policies.
- **No conflict resolution is needed.** AWP policies only restrict (spec 8.4); all attached and
  included policies apply together. This is simpler than the Gateway API, whose policies can also
  set defaults.
- Status per target as in the Gateway API (`ancestors[]`, `Accepted` with `Invalid` or
  `TargetNotFound`); the target gets a condition `PoliciesAttached`. Attached policies are pinned
  with the execution (spec 10.1).

### B6. Runtime bindings

A binding says how a runtime executes a workflow: placement, images, volumes, model endpoints,
secret mapping, run history. It configures, while a policy restricts, so a binding is not a policy
and gets its own rules. It uses the same reference shape.

```yaml
apiVersion: runtime.example.com/v1
kind: WorkflowBinding
metadata:
  name: invoice-processing
  namespace: payments
  labels:
    awp.agenticworkflowprotocol.org/binding: "true"
spec:
  targetRefs:
    - group: awp.agenticworkflowprotocol.org
      kind: Workflow
      name: invoice-processing
  runnerImage: registry.example.com/runner@sha256:...
  secrets:
    - name: TOOLS_TOKEN
      secretRef: {name: tools, key: token}
```

- **Implementation-specific.** Binding kinds belong to the runtime (vendor group, own CRD). AWP
  defines only `targetRefs`, the status and the rules below. Bindings carry the discovery label
  `awp.agenticworkflowprotocol.org/binding: "true"`; the target gets a condition `Bound`.
- **One accepted binding per workflow and runtime.** Several bindings of one runtime on the same
  workflow would start it twice. The runtime accepts the oldest binding (creation time, then name)
  and sets `Accepted=False` with reason `Conflicted` on the others, as the Gateway API does for
  conflicting objects. Rejecting all of them would let anyone who can create a binding in the
  namespace stop a workflow by adding a second one. When the accepted binding is deleted, the next
  one takes over, possibly with different settings; the runtime records the takeover as an audit
  event and never switches silently. Bindings of different runtimes on the same workflow are a deployment error
  unless the runtimes document how they split the work (for example by environment); otherwise the
  workflow gets `Ready=False` with reason `MultipleRuntimes`.
- **Fields that touch governance.** A binding may only set what the specification leaves
  implementation-defined, but some of these settings can still weaken governance. The rule goes by
  effect: a binding field is governance-relevant if it decides where credentials or workflow data
  go, or which network a step can reach. Examples, not exhaustive: model endpoints (they receive
  the provider credentials and all prompts), secret mapping, egress, tool and MCP server endpoints,
  the location of state storage. A list alone would miss new or vendor fields; the examples make
  the rule testable. For these fields the runtime MUST enforce constraints
  set by its operator, not by the author of the binding (for example an allow list of model
  endpoints, of secret stores and of egress destinations), and MUST reject a binding outside them
  (`Accepted=False`, reason `NotAllowed`). The audit events name the binding and its version.
- Bindings are pinned with the execution like attached policies (spec 10.1).

### B7. Annotations only for hints

Domain-prefixed annotations MAY carry hints for tools and user interfaces. They MUST NOT change
behaviour or governance, are not covered by the digest, and runtimes MAY ignore them. This follows
GEP-713 and the lessons of projects that used annotations as their main extension mechanism.

### B8. CustomResourceDefinitions as in the Gateway API

- Unknown fields are pruned; `kubectl apply --validate=strict` rejects them. Unknown fields are
  kept only in free values (`inputs`, defaults, `usage`).
- The generator translates `if`/`then` rules and patterns that RE2 cannot evaluate into CEL
  (`x-kubernetes-validations`) and lists what it cannot translate.
- No webhook is required. Runtimes still validate every manifest fully before acting (spec 3.10),
  because CRD validation is not a security mechanism (GEP-922).

### B9. The same model without Kubernetes

The model must not depend on an API server (runtime feedback G39). The specification defines it as
plain data and keeps Kubernetes as one mapping:

- **References** (`extensionRef`, `targetRefs`, `parametersRef`) are `{group, kind, name}` values
  resolved against the runtime's object store. A runtime without Kubernetes resolves them from its
  own store, for example a directory of manifests or its configuration; how it does so is
  implementation-defined, but resolution failures fail closed as in B3.
- **Status and conditions** (`status.ancestors`, `Accepted`, `ResolvedRefs`, `Bound`) are plain
  JSON (`type`, `status`, `reason`, `message`, `lastTransitionTime`). Runtimes without an object
  store report them through their API or command-line interface, or only in audit events.
- Kubernetes-only text (CRDs, CEL, labels for discovery, `kubectl`) is marked informative.
- Operator-side constraints for bindings (B6) are runtime configuration in every deployment.

### What is removed

- `extensions` objects and `x-` keys (spec 3.3 item 1).
- AEP-0011 (`requiredExtensions`): superseded by B3.
- The informative prefix list (decision D12): domain names are unique without a registry.

## Examples

See the blocks above. A workflow from `v1alpha1` with `x-` fields migrates as follows: fields that
change behaviour become an extension point (B3), an attached policy (B5) or a runtime binding
(B6); pure hints become annotations (B7). The migration tool reports each `x-` field; it cannot
choose automatically.

## Schema changes

To be worked out after the discussion: removal of `Extensions`; new definitions `LocalObjectReference`,
`PolicyTargetReference`, `WorkflowClass`; `extension` in the step and tool source type enums;
patterns for domain-prefixed values; `targetRefs` and `status.ancestors` for `Policy`; CRD
generator with CEL output and pruning.

## Conformance impact

- Profiles become bundles of named features; the conformance statement lists `supportedFeatures`.
- New cases for extension points (unsupported kind rejected), domain-prefixed values, `targetRefs`.
- The conformance suite can, like the Gateway API, derive tests from `supportedFeatures`.

## Compatibility and migration

Breaking for `v1alpha3` drafts that use `extensions`; no published runtime depends on them. A
`v1alpha1` manifest with `x-` fields needs a manual decision per field (see Examples).

## Security considerations

- Extension points fail closed and are actions under governance; no extension can bypass
  permissions or policies.
- Policy attachment lets a platform team enforce policies that authors cannot leave out.
  Cross-namespace targets are not allowed, so a policy in one namespace cannot affect another.
- Runtime bindings configure, and some of their fields can weaken governance: a model endpoint
  receives credentials and prompts, a secret mapping chooses credentials, network settings decide
  egress. Operator-side constraints for these fields (B6) keep a binding author from leaking
  credentials or data; a Kubernetes runtime proof of concept found exactly this leak through a
  model endpoint and closed it with an operator allow list.
- At most one accepted binding per workflow and runtime prevents duplicate executions.
- CRD validation improves feedback but is not a security boundary.

## Privacy considerations

None beyond the current specification.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Keep `extensions` maps** (current draft): simple and familiar from OpenAPI, but not idiomatic
  on Kubernetes and the reason for G09.
- **`extensions` as a list of `{name, value}`** (like Dynamic Resource Allocation opaque config):
  better for server-side apply, but still a generic bag on every object.
- **Annotations as the extension mechanism**: strings only, not in the digest, hard to document;
  rejected by GEP-713 and earlier experience.
- **Validating webhook shipped by this repository**: full validation at apply time, but software
  to maintain; the Gateway API removed its webhook in favour of CEL.

## Implementation status

Concept only. A Kubernetes runtime proof of concept already uses a binding object that points at
the workflow (B6) and no extension fields; its review of this draft is reflected in B6 and B9.

## Open questions

1. How does a workflow select its runtime: through its binding (B6, the binding kind names the
   controller, nothing in the digest), a field `spec.workflowClassName` (as `gatewayClassName`,
   but covered by the digest), a label, or a default class per cluster? Bindings are the current
   proposal; a class field is only needed for runtimes that run workflows without a binding.
2. Action identifiers of extension steps: domain-prefixed (`example.com/canary.deploy`) needs a
   change of the action identifier pattern (spec 5.5.3).
3. Which extension points are needed beyond steps and tool sources (policy conditions evaluated by
   an external engine, model providers as objects)?
4. Should policies also target a namespace (inherited by all workflows in it), as Gateway API
   inherited policies do?
5. Should AWP adopt release channels (experimental fields and kinds in separate CRDs) once it
   leaves alpha?
6. Feature granularity: one feature per section of the specification, or per field?
7. Governance-relevant binding fields: is the effect rule with informative examples (B6) testable
   enough, or should conformance require a fixed list?
8. Conflicting bindings: B6 proposes "oldest wins" with an audited takeover. Is that acceptable, or
   should a conflict block the workflow?

## Decision

-

## References

- Gateway API conformance and support levels: https://gateway-api.sigs.k8s.io/docs/conformance/
- GEP-2162 (supported features): https://gateway-api.sigs.k8s.io/geps/gep-2162/
- GEP-1709 (conformance profiles and reports): https://gateway-api.sigs.k8s.io/geps/gep-1709/
- GEP-713 (policy attachment): https://gateway-api.sigs.k8s.io/geps/gep-713/
- GEP-922 (validation is not a security mechanism): https://gateway-api.sigs.k8s.io/geps/gep-922/
- API types (ExtensionRef, LocalObjectReference, ParametersReference, PolicyAncestorStatus):
  https://github.com/kubernetes-sigs/gateway-api/tree/main/apis/v1
- Webhook removal: https://github.com/kubernetes-sigs/gateway-api/releases/tag/v1.1.0
- Tekton CustomRun: https://tekton.dev/docs/pipelines/customruns/
- KubeVirt network binding plugins: https://kubevirt.io/user-guide/network/network_binding_plugins/
- Runtime feedback: [docs/runtime-feedback.md](../docs/runtime-feedback.md), entries G09, G26, G39,
  K.
