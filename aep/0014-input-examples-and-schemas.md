# AEP-0014: Input examples and object schemas

| | |
| --- | --- |
| **AEP** | 0014 |
| **Title** | Input examples and object schemas |
| **Authors** | AI agent on behalf of @agenticworkflowprotocol |
| **Shepherd** | Project lead (proposed; not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer, language or schema reviewer. None identified yet; an external review is required before `Accepted` ([aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)). |
| **Owner decisions** | [D18](../docs/decisions.md#d18-implementation-experience-goes-into-aeps-and-implementer-guidance) (2026-11-18) |
| **Target API version** | `v1alpha3` (proposed, not yet in scope; `v1alpha2` until [D22](../docs/decisions.md#d22-v1alpha3-becomes-the-current-draft)) |
| **Profiles affected** | `core` |
| **Created** | 2026-11-18 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Let workflow inputs (spec 5.3) carry `examples`, values for test runs, simulation and forms that
are never used as defaults, and let inputs of type `object` and `array` carry a `schema` (the
JSON Schema subset of [AEP-0003](0003-typed-handoffs.md)) that the runtime validates before the
execution starts.

## Motivation

- Spec 5.3 forbids `default` on required inputs, which is right: a required value must come from
  the caller. Authoring tools and test runs still need a realistic value for it (a repository
  name, a ticket key). Runtimes put it into extension fields today, or authors drop `required` to
  be able to set a `default`, which weakens the manifest.
- An input of type `object` is validated only as "an object". Workflows that are started by
  another system (a ticket payload, a scan report) need the shape checked before any model sees
  it. AEP-0003 adds schemas to step handoffs and AEP-0004 to event data, but not to workflow
  inputs.

## Goals and non-goals

- Goals: example values next to the declaration; validated shapes for structured inputs; the same
  schema subset as AEP-0003.
- Non-goals: generated forms, sample data sets, secrets in examples.

## Specification

### Changes to section 5.3

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `examples` | list | no | Example values. Each MUST match `type`, `pattern`, `enum` and `schema`. Allowed with `required: true`. |
| `schema` | object | no | Only for `type` `object` and `array`: schema (AEP-0003 subset, inline or `{ "$ref": "#/spec/schemas/<name>" }`) that the value MUST satisfy. |

Add:

- `examples` are documentation and test data. A runtime MUST NOT use an example as the value of an
  input in an execution unless the caller chose it explicitly (for example "start a test run with
  the examples"); such an execution records `inputsFrom: examples` in `workflow.started`.
- `examples` MUST NOT contain secrets or real personal data (use `example.com`, `example.org`).
- `schema` is validated together with the other input rules, before the execution starts
  (section 5.3); an invalid value MUST prevent the start. Size and depth limits of AEP-0003 apply.

## Examples

```yaml
spec:
  inputs:
    - name: repository
      type: string
      required: true
      pattern: "^[a-z0-9-]+/[a-z0-9-]+$"
      examples: [example-org/example-service]
    - name: finding
      type: object
      required: true
      schema:
        type: object
        required: [id, severity]
        additionalProperties: false
        properties:
          id: { type: string, maxLength: 64 }
          severity: { type: string, enum: [low, medium, high, critical] }
          package: { type: string, maxLength: 200 }
      examples:
        - { id: CVE-2026-0001, severity: high, package: example-lib }
```

## Schema changes

- Input object: `examples` (array), `schema` (AEP-0003 subset).
- Semantic rules: `input.example-mismatch` (an example does not match the declaration),
  `input.schema-wrong-type` (`schema` on a scalar type).

## Conformance impact

- `core`: validation of `schema` before start; `examples` never used implicitly.
- New valid case: `valid/5.3-input-examples-and-schema.yaml`; invalid cases:
  `invalid/5.3-input-example-mismatch.yaml`, `invalid/5.3-input-schema-on-string.yaml`.

## Compatibility and migration

Additive. Runtimes that keep example values or input schemas in extension fields map them to
`examples` and `schema`.

## Security considerations

Input schemas reject malformed structured inputs before a model or tool sees them. Examples are
not executable defaults, so a forgotten required input cannot be filled silently.

## Privacy considerations

Examples are part of the manifest and its digest; they must not contain personal data.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Allow `default` on required inputs**: blurs who chose the value; rejected.
- **Examples outside the manifest** (test fixtures): fine for test suites, but authoring tools and
  forms need them next to the declaration.
- **Schema only through AEP-0003 step inputs**: validates later, after the execution started.

## Implementation status

At least one runtime in progress keeps an example value per input and a JSON Schema for object
inputs in extension fields, and validates the schema at start. No implementation of this AEP
exists.

## Open questions

1. Should `examples` be limited in number and size?
2. Should `schema` also be allowed on `string` inputs (formats), or stay with `pattern`?

## Decision

Draft. Not in the `v1alpha2` scope until an amendment of the [scope table](../docs/decisions.md#2-resulting-scope-of-v1alpha2).

## References

- Spec sections 5.3, 10.4.
- AEP-0003, AEP-0004.
