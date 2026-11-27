# AEP-0032: Policy syntax: enums instead of booleans, match expressions

| | |
| --- | --- |
| **AEP** | 0032 |
| **Title** | Policy syntax: enums instead of booleans in shorthands, match expressions in rule conditions |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer, language or schema reviewer |
| **Reviewers** | none yet |
| **Target API version** | the next API version after `v1alpha4` (incompatible change) |
| **Profiles affected** | `core`, `governance` |
| **Created** | 2026-11-27 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Two changes to the policy syntax of spec section 8, both mechanical to migrate:

1. The workflow policy shorthands (spec 8.1) become enums. `git.allowPush: false` becomes
   `git.push: deny`; `requireApproval` is a second value; an absent field adds no rule. The boolean
   value `true`, which today adds no rule although it reads as "allowed", disappears.
2. The `when` of a policy rule (spec 8.3) becomes a list of match expressions
   `{key, operator, values}`, in the form of the `matchExpressions` of Kubernetes label selectors,
   instead of a map whose keys are attribute paths.

## Motivation

**Booleans that do not mean what they say.** Spec 8.1 maps `git.allowPush: false` to a `deny` rule
and says that the value `true` "adds no rule (it does not grant permissions)". That is correct by
the decision combination of spec 8.4: permissions grant, policies restrict. But a reader of
`allowPush: true` concludes that the workflow may push, and a reviewer who sees it next to a
`permissions` block that does not grant `git.push` has two statements that seem to contradict
each other. The value `true` exists only because the field is a boolean.

A boolean also has no room for a third state. The obvious third state is "push needs approval",
which today needs a full `Policy` rule or `approval.requiredFor`. The Kubernetes API conventions
advise against booleans for this reason and prefer an enum that can grow.

**Conditions keyed by path.** A rule condition today is a map such as:

```yaml
when:
  data.classification: { in: [personal, sensitive] }
  destination.region: { notIn: [EU] }
```

The schema is structural, because the attributes are a fixed list. Still the form has costs:

- Every attribute needs its own schema definition with the same operator set, and an extension
  attribute cannot be added without changing the schema: the map has `additionalProperties: false`.
- Keys that contain dots are awkward in field paths. A JSON path or `kubectl` query for the
  attribute has to escape the dot (`when.data\.classification`), and a patch cannot tell a key with
  a dot from a nested key without that escaping.
- Kubernetes users know conditions on attributes as `matchExpressions` lists (label selectors,
  node affinity). A different form for the same idea has to be learned and mapped.

## Goals and non-goals

- Goals: policy shorthands whose values say what they do; a third value for approval; one
  condition form with a fixed operator vocabulary; mechanical migration.
- Non-goals: new attributes or operators, new effects, any change to the decision combination
  (spec 8.4), the `when` of steps (spec 3.12, a different grammar).

## Specification

### Changes to section 8.1 (workflow policy shorthands)

`spec.policies` keeps `include`. The shorthands are replaced by action-shaped enums, grouped like
the action identifiers they stand for:

| Shorthand | Values | Equivalent rule |
| --------- | ------ | --------------- |
| `git.push` | `deny`, `requireApproval` | effect on actions matching `git.push` |
| `git.forcePush` | `deny`, `requireApproval` | effect on actions matching `git.forcePush` |
| `git.merge` | `deny`, `requireApproval` | effect on actions matching `git.merge` |
| `pullRequest.create` | `deny`, `requireApproval` | effect on actions matching `pullRequest.create` |
| `production.deploy` | `deny`, `requireApproval` | effect on actions matching `production.deploy` |

- An absent shorthand adds no rule. There is no value that grants or allows: permissions grant
  (spec 7.5), policies restrict (spec 8.4).
- `requireApproval` uses the approvers, `minApprovals`, `timeout` and `onTimeout` of the workflow's
  `approval` object (spec 7.6). A manifest with a `requireApproval` shorthand and without
  `approval.approvers` MUST be rejected.
- The former `merge.allow` moves under `git` as `git.merge`, because the action identifier is
  `git.merge`.

### Changes to section 8.3 (conditions)

`when` of a policy rule is a non-empty list of **match expressions**. All expressions MUST hold for
the rule to apply (logical AND, as today).

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `key` | string | yes | An attribute of the table in section 8.3 (`action`, `environment.name`, `risk.level`, `data.classification`, `destination.provider`, `destination.region`, `model.provider`, `model.name`, `actor.type`, `workflow.name`, `step.id`, `agent.id`), or a domain-prefixed extension attribute (spec 3.3). |
| `operator` | string | yes | `in`, `notIn`, and for ordered attributes (`data.classification`, `risk.level`) `gt`, `gte`, `lt`, `lte`. |
| `values` | list of string | yes | At least one value. `gt`, `gte`, `lt` and `lte` take exactly one. Values of `action` are action keys and are matched like permission keys (groups, wildcards). |

- `equals` and `notEquals` are removed: they are `in` and `notIn` with one value.
- A key MAY appear in several expressions, for example `gte` and `lte` for a range.
- An unknown key without a domain prefix MUST be rejected. A domain-prefixed key that the runtime
  does not support MUST be treated like an attribute that cannot be determined: the fail-closed
  rule of section 8.3 applies (`deny` and `requireApproval` rules apply).
- Operator names follow the AWP enum style (lower camel case), not the capitalised `In` and
  `NotIn` of Kubernetes; the structure is the same.

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha5
kind: Workflow
metadata:
  name: dependency-updates
spec:
  version: 0.2.0
  owner:
    team: platform-team
  classification: internal
  approval:
    approvers:
      - role: maintainer
  policies:
    git:
      push: requireApproval
      forcePush: deny
      merge: deny
    production:
      deploy: deny
  agents:
    - id: updater
      model:
        provider: example-provider
        name: example-model
  workflow:
    - id: update
      agent: updater
      task: Update the dependencies and open a pull request.
```

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha5
kind: Policy
metadata:
  name: eu-data-residency
spec:
  version: 2.0.0
  owner:
    team: data-protection
  rules:
    - id: personal-data-stays-in-eu
      when:
        - key: data.classification
          operator: in
          values: [personal, sensitive]
        - key: destination.region
          operator: notIn
          values: [EU]
      effect: deny
```

`apiVersion` `v1alpha5` stands for the next API version and is a placeholder.

## Schema changes

- `$defs/Policies`: `git` with `push`, `forcePush`, `merge`; `pullRequest.create`;
  `production.deploy`; each an enum `deny`, `requireApproval`. `merge` and the boolean fields are
  removed.
- `$defs/Condition`: an array (`minItems: 1`) of `MatchExpression` objects (`key`, `operator`,
  `values`), with `x-kubernetes-list-type: atomic` in the generated CRD. Key and operator
  compatibility (ordering operators only on ordered attributes, one value for ordering operators)
  as semantic rules `policy.operator-not-ordered`, `policy.operator-values`.
- Semantic rule `policy.require-approval-without-approvers`.

## Conformance impact

- `core`: the shorthand enums and their equivalent rules; match expressions with all operators;
  rejection of unknown keys, of ordering operators on unordered attributes and of
  `requireApproval` without approvers.
- `governance`: fail-closed behaviour for unsupported extension keys.
- Valid: `8.1-policy-shorthands.yaml` (rewritten), `8.3-match-expressions.yaml`. Invalid:
  `8.1-shorthand-boolean.yaml`, `8.1-require-approval-without-approvers.yaml`,
  `8.3-ordering-on-unordered.yaml`, `8.3-unknown-key.yaml`.
- Migration cases: every valid `v1alpha4` case with shorthands or rule conditions converts with
  `awp-check.mjs migrate` and validates against the new schema.

## Compatibility and migration

Incompatible, so it targets the next API version. `awp-check.mjs migrate` converts:

| `v1alpha4` | Next version |
| ---------- | ------------ |
| `git.allowPush: false` | `git.push: deny` |
| `git.allowForcePush: false` | `git.forcePush: deny` |
| `merge.allow: false` | `git.merge: deny` |
| `pullRequest.allowCreate: false` | `pullRequest.create: deny` |
| `production.allow: false` | `production.deploy: deny` |
| any shorthand `: true` | removed (it added no rule); `migrate` reports it as a note |
| `<attribute>: { <op>: <value or list>, ... }` | one expression per operator: `{ key: <attribute>, operator: <op>, values: [...] }` |
| `equals: v` / `notEquals: v` | `operator: in` / `notIn`, `values: [v]` |

The meaning of every migrated manifest is unchanged: no rule is added or removed.

## Security considerations

The change removes a reading of `allowPush: true` as a grant, which could lead a reviewer to accept
a manifest whose permissions they misread. It does not change what any manifest is allowed to do.
Extension keys keep the fail-closed rule.

## Privacy considerations

None.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Keep the booleans and clarify the text.** Possible as an editorial change in `v1alpha4`, and
  done there as a sentence in spec 8.1. It leaves a field whose `true` value means nothing and
  gives no third state.
- **Add `allow` as an enum value.** Rejected: policies cannot grant, and the value would invite the
  same misreading.
- **Keep the condition map.** It is structural and works. The list costs a few more lines per
  rule; it is proposed for the extension keys, the field-path problem and the familiarity of
  `matchExpressions`.
- **Kubernetes operator spelling** (`In`, `NotIn`, `Gt`, `Lt`). Closer to Kubernetes, but AWP enums
  are lower camel case everywhere else; see open question 2.

## Implementation status

None. The reference checker and the editor would need the new schema and the `migrate` mapping.

## Open questions

1. Should an explicit value for "no rule" exist (for example `none`), so that a workflow can state
   that it has considered a shorthand?
2. Operator spelling: AWP style (`in`, `notIn`) or the Kubernetes spelling (`In`, `NotIn`)?
3. Should more actions get shorthands (for example `external.communication`), or should
   shorthands stay limited to the current five?

## Decision

Not decided.

## References

- Spec `v1alpha4` sections 7.5, 7.6, 8.1, 8.3, 8.4.
- Kubernetes API conventions (primitive types: avoid booleans that may need a third state);
  `LabelSelectorRequirement` (`matchExpressions`).
