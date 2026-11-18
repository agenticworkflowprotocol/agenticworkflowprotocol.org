# AEP-0000: Kubernetes resource model alignment

| | |
| --- | --- |
| **AEP** | 0000 (assigned by a maintainer) |
| **Title** | Kubernetes resource model alignment |
| **Authors** | @slauger |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer |
| **Reviewers** | - |
| **Target API version** | `v1alpha2` |
| **Profiles affected** | `core`, `governance`, `security` |
| **Created** | 2026-11-18 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Make every AWP manifest a valid Kubernetes resource without giving up portability to runtimes that
do not use Kubernetes. `metadata` keeps only Kubernetes `ObjectMeta` fields; the governance fields
of `v1alpha1` (`version`, `owner`, `classification`, `risk`, `integrity`, ...) move to `spec`.
Extension fields move into `extensions` objects, two fields with a type union get one type, and
`status` is reserved for runtimes. The JSON Schema becomes expressible as a Kubernetes structural
schema, and the repository publishes CustomResourceDefinitions generated from it. The full text is
applied in [spec/v1alpha2](../spec/v1alpha2/README.md).

## Motivation

AWP manifests look like Kubernetes objects (`apiVersion`, `kind`, `metadata`, `spec`), but they
cannot be stored as Kubernetes custom resources:

1. **`metadata` is `ObjectMeta`.** The API server accepts only its own fields in `metadata`.
   `metadata.version`, `owner`, `classification`, `risk`, `integrity` and `signature` are dropped
   (or rejected with strict field validation). The stored object loses its governance fields, and
   its digest no longer verifies.
2. **Structural schemas.** A CustomResourceDefinition needs a structural schema: every field has
   one type, and there are no properties with variable names next to defined ones. `v1alpha1`
   allows `x-` fields in every object, `owner` as string or object, and policy conditions as value
   or object.
3. **Pruning.** For fields that the schema does not describe, the API server removes them before
   any admission webhook or controller sees them. A runtime that reads such an object cannot fail
   closed on a misplaced governance field, because the field is gone.

Implementers who want to run AWP on Kubernetes (operators, GitOps with Argo CD or Flux) work
around this today by embedding the AWP document as a string in a resource of their own or in a
ConfigMap and keeping the status there. Every implementation invents its own wrapper, the AWP
document is invisible to Kubernetes tooling, and RBAC, `kubectl get`, status conditions and owner
references cannot refer to it.

At the same time AWP must stay usable without Kubernetes: SaaS platforms, CLIs and CI systems
store manifests in databases or Git. The Kubernetes resource model works for them as well. It is a
document shape, not a dependency.

## Goals and non-goals

- Goals:
  - One manifest format for Kubernetes and non-Kubernetes runtimes, stored unchanged in both.
  - CustomResourceDefinitions that the API server accepts as structural, generated from the
    normative JSON Schema.
  - Fail closed stays intact on Kubernetes: unknown or misplaced fields are never silently lost.
  - The digest survives a round trip through an object store and through GitOps tools.
  - A mechanical migration from `v1alpha1`.
- Non-goals:
  - Execution, approval or other runtime objects, and the schema of `status`. They are left to
    later AEPs; this AEP only reserves `status`.
  - Controllers, admission webhooks or other components. AWP specifies documents and runtime
    behaviour, not an operator.
  - Cluster-scoped kinds (for example a cluster-wide policy).

## Specification

Changes relative to `v1alpha1`, written out in [spec/v1alpha2](../spec/v1alpha2/README.md):

1. **Top-level structure (3.2).** A manifest has `apiVersion`, `kind`, `metadata`, `spec` and,
   optionally, `status`, and nothing else. `status` is reserved: validators ignore it, it is not
   covered by the digest, and runtimes do not derive governance decisions from a `status` they did
   not write.
2. **Metadata (4.1).** `metadata` has `name` (REQUIRED), `namespace`, `labels` and `annotations`.
   Fields populated by an object store (`uid`, `resourceVersion`, `generation`,
   `creationTimestamp`, `deletionTimestamp`, `deletionGracePeriodSeconds`, `finalizers`,
   `ownerReferences`, `managedFields`) are accepted and ignored. Any other field is unknown.
   Labels use the Kubernetes label syntax. Governance decisions are not derived from labels or
   annotations.
3. **Common spec fields (4.2).** `version` (REQUIRED), `description`, `owner` (REQUIRED, always an
   object), `classification`, `purpose`, `risk`, `integrity`, `signature` and `provenance` are
   fields of `spec` for every kind, with unchanged meaning. All references in the text change from
   `metadata.<field>` to `spec.<field>`, including the profile table of 3.3.
4. **Names (3.4).** `metadata.name` and `metadata.namespace` are DNS-1123 labels. Other names keep
   their `v1alpha1` rules.
5. **Extensions (3.3).** Extension fields are keys (starting with `x-`) of an `extensions` object.
   Every object in `spec` with defined fields MAY have one, including `spec` itself; `metadata`
   has none. An `x-` field outside `extensions` is unknown.
6. **Policy conditions (8.3).** Each attribute maps to an operator object; the plain-value
   shorthand for `equals` is removed.
7. **Digest (9.1).** The digest is computed over a JSON object with `apiVersion`, `kind`,
   `metadata` containing only `name`, and `spec` without `integrity`, `signature` and
   `provenance`. Namespace, labels, annotations, store-populated fields and `status` are not
   covered.
8. **Object stores and Kubernetes (3.10, new).** Defines an object store, the Kubernetes binding
   (namespaced custom resources of the group `awp.agenticworkflowprotocol.org` with a `status`
   subresource), and these requirements: a runtime validates every manifest it reads from an
   object store against the full rules before acting on it and does not act on an invalid one; a
   runtime does not modify `spec`. Validation on write (admission webhook) and strict field
   validation of clients are RECOMMENDED.

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha2
kind: Workflow
metadata:
  name: example
  labels:
    app.kubernetes.io/part-of: examples
spec:
  version: 0.1.0
  owner:
    team: example-team
  classification: internal
  extensions:
    x-example-mode: standard
  agents:
    - id: assistant
      model:
        provider: example-provider
        name: example-model
  workflow:
    - id: run
      agent: assistant
```

The same manifest read back from a Kubernetes API server carries `metadata.uid`,
`metadata.resourceVersion`, `metadata.creationTimestamp` and possibly `status`; it is still valid,
and its digest is unchanged.

## Schema changes

- New schema [`schema/awp.v1alpha2.json`](../schema/awp.v1alpha2.json), derived from
  `awp.v1alpha1.json`: `Metadata` replaced by the `ObjectMeta` subset, new `ObjectName`, governance
  fields added to `WorkflowSpec`, `AgentSpec` and `PolicySpec`, `patternProperties: {"^x-": {}}`
  replaced by an `extensions` property on 74 objects (new `Extensions` definition), `Owner` and
  `Condition` attribute values with a single type, `status` on the kinds.
- Generated CustomResourceDefinitions in [`schema/crd/`](../schema/crd/) and their generator
  `conformance/crd.mjs`. The generator inlines `$ref`, turns `const` into `enum`, drops
  conditionals, combinators, `propertyNames` and RE2-incompatible patterns, and marks every object
  with `x-kubernetes-preserve-unknown-fields` so that unknown fields reach validation.
- Semantic rules: unchanged, applied to `spec` instead of `metadata`; `extensions` objects are
  opaque like `x-` fields in `v1alpha1`.

## Conformance impact

- `core`: object names, metadata subset, common spec fields, extensions, reserved `status`, digest
  scope; the runtime requirements of 3.10.
- New suite `conformance/v1alpha2/`: all 180 `v1alpha1` cases migrated (paths and codes adjusted
  where the document model changes them), plus:
  - valid: `3.2-status-and-store-metadata`, `9.1-digest-ignores-deployment-fields`
    (`verifyDigest`), `4-labels-and-annotations` (replaces `4-owner-string-shorthand`);
  - invalid: `3.3-extension-field-outside-extensions`, `3.3-extension-key-without-prefix`,
    `3.4-uppercase-metadata-name`, `4-governance-field-in-metadata`, `4-owner-string`,
    `4-label-value-too-long`, `8.3-plain-condition-value`.
- `npm test` fails when the generated CustomResourceDefinitions are stale.

## Compatibility and migration

Incompatible: every `v1alpha1` manifest changes. The migration is mechanical and implemented as
`node conformance/awp-check.mjs migrate <file>`: move the governance fields to `spec`, wrap `owner`
strings, move `x-` fields into `extensions`, write policy condition values as `equals`. Two steps
need the author: names that are not DNS-1123 labels (for example uppercase or `_`) must be renamed,
and digests must be recomputed because the digest input changes.

Effect on other AEPs that target `v1alpha2` (to be adjusted in their own pull requests):

- AEP-0010: the removed fields are `spec.integrity`, `spec.signature`, `spec.provenance`, and the
  digest input is the one of item 7; its test vectors must be recomputed.
- AEP-0011: `metadata.requiredExtensions` becomes `spec.requiredExtensions`, and its entries name
  `extensions` keys.
- AEP-0005, AEP-0006, AEP-0008: new kinds follow the same document model (`spec.version`,
  `spec.owner`, `extensions`).

## Security considerations

- **Fail closed on Kubernetes.** Pruning would drop an unknown governance field before a runtime
  sees it. The CustomResourceDefinitions therefore preserve unknown fields, and 3.10 requires the
  runtime to validate the full manifest before acting on it.
- **Status.** `status` can be written by anyone with access to the status subresource. Runtimes
  must not take governance decisions from a `status` they did not write.
- **Labels and annotations** are outside the digest and are changed by deployment tools. Governance
  decisions must not depend on them; this was already the rule for annotations and now applies to
  labels as well.
- **Digest scope.** Removing namespace, labels and annotations from the digest does not weaken
  integrity: none of them influences what a manifest does.

## Privacy considerations

None beyond `v1alpha1`. `owner` contact fields move from `metadata` to `spec` with unchanged rules.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Embed the AWP document in a wrapper resource or a ConfigMap.** Works today, but every
  implementation defines its own wrapper, Kubernetes tooling cannot see the AWP fields, and the
  document has two names (wrapper and manifest) to keep in sync. Recommended only as a transition
  for `v1alpha1`.
- **Keep governance fields in `metadata` as annotations.** Annotations are strings and are changed
  by tools; structured fields such as `owner` and `risk` would lose their schema.
- **Prune unknown fields (default CustomResourceDefinition behaviour).** Rejected: it silently
  drops misplaced governance fields and breaks fail closed.
- **Express all rules as CEL validation rules in the CustomResourceDefinition.** Possible for some
  rules, but the semantic rules (graph, expressions, references) do not fit, and two rule sets
  would have to be kept in sync. Left to implementations.
- **Do nothing.** Every Kubernetes implementation keeps a private wrapper, and portability between
  Kubernetes and non-Kubernetes runtimes depends on each of them.

## Implementation status

- The reference checker validates `v1alpha1` and `v1alpha2`, selected by `apiVersion`, and migrates
  `v1alpha1` manifests. All conformance cases pass.
- The generated CustomResourceDefinitions were applied to a Kubernetes 1.35 API server (k3s): they
  are accepted as structural, every valid `v1alpha2` case and example is accepted by a server-side
  dry run with strict field validation, a governance field in `metadata` is rejected by strict
  field validation, an unknown field in `spec` is preserved when the client skips validation (and
  the reference checker then rejects the stored object), and a stored object read back with
  `uid`, `resourceVersion` and `status` still validates and its digest verifies.

## Open questions

1. Should `extensions` keys keep the `x-` prefix, or use a Kubernetes-style `prefix/name` key?
   Keeping `x-` makes the migration and AEP-0011 unchanged.
2. Should `metadata.namespace` be part of the identity or the digest? This AEP says no, so that
   one manifest can be deployed to several namespaces.
3. Should a later AEP define a common `status` shape (`observedGeneration`, `conditions`) for all
   kinds, as Kubernetes API conventions recommend?
4. Is a cluster-scoped `Policy` needed for organisation-wide rules on Kubernetes?

## Decision

-

## References

- Kubernetes API conventions: object metadata, spec and status.
- Kubernetes CustomResourceDefinitions: structural schemas, pruning, `x-kubernetes-preserve-unknown-fields`, field validation.
- [RFC 8785] JSON Canonicalization Scheme.
