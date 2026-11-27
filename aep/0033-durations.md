# AEP-0033: Durations in the Go and Kubernetes format

| | |
| --- | --- |
| **AEP** | 0033 |
| **Title** | Durations in the format of Go, Kubernetes and CEL; retention periods in days |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), language or schema reviewer |
| **Reviewers** | none yet |
| **Target API version** | the next API version after `v1alpha4` (incompatible change) |
| **Profiles affected** | `core`, `audit` |
| **Created** | 2026-11-27 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Spec 3.6 defines its own duration syntax with the units `ms`, `s`, `m`, `h`, `d`, `w` and `y`.
Go (`time.ParseDuration`), the Kubernetes type `metav1.Duration` and the CEL function
`duration()` accept the units `ns`, `us`, `ms`, `s`, `m` and `h`, but not `d`, `w` or `y`. This AEP
restricts AWP durations to `ms`, `s`, `m` and `h`, so that every AWP duration parses unchanged in
those three. Retention periods, the only fields that need months or years, become whole numbers of
days.

## Motivation

- A controller written in Go cannot use `time.ParseDuration` or `metav1.Duration` for AWP fields;
  it needs its own parser for `d`, `w` and `y`, and two runtimes can disagree on edge cases.
- CEL validation rules in the generated CRDs (AEP-0021 B8) cannot call `duration()` on a value such
  as `7d`, so time limits cannot be checked on the server.
- `y` as 365 days and `d` as 24 hours are definitions that only AWP has. Retention requirements
  are usually written in days, months or years and rounded to days by the systems that enforce
  them.

Prior art: cert-manager (a CNCF project) writes certificate lifetimes as Go durations
(`duration: 2160h` for 90 days) and accepts the readability cost for the portability.

## Goals and non-goals

- Goals: one duration format that Go, Kubernetes and CEL parse unchanged; a readable form for
  long retention periods; mechanical migration.
- Non-goals: calendar arithmetic (months, leap years), time zones (schedules keep their own
  `timezone`, spec 5.2), fractional values.

## Specification

### Changes to section 3.6 (durations)

Durations are strings matching `^([0-9]+(ms|s|m|h))+$`, for example `30s`, `15m`, `1h30m`, `24h`,
`168h`. Units: `ms` milliseconds, `s` seconds, `m` minutes, `h` hours. A duration MUST be greater
than zero.

Every duration of this form is accepted unchanged by Go `time.ParseDuration`, by Kubernetes
`metav1.Duration` and by the CEL function `duration()`, and means the same in all three. Validators
MUST reject the units `d`, `w` and `y`, decimals and signs.

### Retention periods

Fields that set how long data is kept use a whole number of days instead of a duration. A day is
24 hours.

| Field (today) | Today | Replacement |
| ------------- | ----- | ----------- |
| `audit.retention.duration` (spec 10.2) | duration, minimum retention, example `7y` | `audit.retention.days`: integer, at least 1. Minimum retention of the events. |
| `audit.contentRetention` (AEP-0009, not applied) | duration, maximum time content is kept, documented default `7d` | `audit.contentRetentionDays`: integer, at least 1; documented default `7`. |
| `state[].retention` (AEP-0025, not applied) | duration after the last write, example `180d` | `state[].retentionDays`: integer, at least 1. |

All other duration fields are time limits of an execution and keep the duration type with the
format above: `triggers[].startingDeadline` (5.2), step `timeout` (5.6.1), `budget.maxDuration`
(5.7), `timeout` of input steps and of `humanInput` (5.8), `approval.timeout` (7.6) and the
`timeout` of an approval step and of a policy rule's approval (8.2). A week-long approval timeout is
written `168h`.

## Examples

```yaml
spec:
  budget:
    maxDuration: 1h30m
  approval:
    approvers:
      - role: security-reviewer
    timeout: 168h          # was 7d
  audit:
    enabled: true
    integrity:
      mode: hash-chain
    retention:
      days: 2555           # was duration: 7y
  workflow:
    - id: analyze
      agent: worker
      task: Analyze the repository.
      timeout: 24h
```

## Schema changes

- `$defs/Duration`: pattern `^(?!(?:0+(?:ms|s|m|h))+$)(?:[0-9]+(?:ms|s|m|h))+$`.
- `$defs/Audit`: `retention.days` (integer, `minimum: 1`) replaces `retention.duration`.
- AEP-0009 and AEP-0025 adopt `contentRetentionDays` and `retentionDays` when they are applied.
- The generated CRDs MAY add a CEL rule `duration(self) > duration('0s')` on duration fields.

## Conformance impact

- `core`: the new pattern; valid `3.6-durations.yaml` rewritten (the `7y` step timeout becomes
  `61320h`); invalid `3.6-duration-day-unit.yaml`, `3.6-duration-decimal.yaml`.
- `audit`: valid `10.2-audit-configuration.yaml` with `retention.days`; invalid
  `10.2-retention-duration.yaml` (the old field).
- Migration cases: every valid `v1alpha4` case with durations converts with `awp-check.mjs migrate`
  and validates against the new schema.

## Compatibility and migration

Incompatible, so it targets the next API version. `awp-check.mjs migrate` converts:

- Duration fields: `d` to `24h`, `w` to `168h`, `y` to `8760h`, summed with the other parts into
  hours, for example `1w2d` to `216h` and `7y` to `61320h`. The value is unchanged.
- `audit.retention.duration` to `audit.retention.days`: the duration in days, rounded up (it is a
  minimum), for example `7y` to `2555` and `36h` to `2`.
- `contentRetention` and `state[].retention` once AEP-0009 and AEP-0025 are applied: rounded down
  for the maximum of `contentRetention`; a value below one day cannot be converted and `migrate`
  reports it.

The website page "Migrating to ..." lists the rounding of retention periods as a change that
`migrate` makes and the author should check.

## Security considerations

A runtime that parses durations with the standard library of its language instead of an own
parser has one source of bugs less. The time limits themselves do not change.

## Privacy considerations

Retention periods keep their meaning. Rounding a minimum retention up keeps data at most one day
longer than written; rounding a maximum content retention down keeps it at most one day shorter.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Keep `d`, `w`, `y`.** Readable, but every Go or CEL consumer needs an own parser.
- **Go durations everywhere, also for retention** (`61320h` for seven years). Portable, but a
  reviewer cannot read a retention period at a glance.
- **ISO 8601 durations** (`P7Y`, `PT15M`). A standard with calendar units, but neither Go,
  `metav1.Duration` nor CEL parse it, and `P1M` (a month) has no fixed length.
- **Integer seconds** (`timeoutSeconds`, as in many Kubernetes fields). Portable, but unreadable for
  hours and days and a change of every field name.

## Implementation status

None. Runtimes in progress parse the `v1alpha4` syntax with their own parsers.

## Open questions

1. Should `retention.days` allow a value that means "keep as long as the runtime keeps events"
   (no minimum), or is omitting the field enough?
2. Should the CRDs check durations with CEL now (AEP-0021 B8), or only after this AEP?

## Decision

Not decided.

## References

- Spec `v1alpha4` sections 3.6, 5.2, 5.6.1, 5.7, 5.8, 7.6, 8.2, 10.2.
- AEP-0009 (audit payload levels), AEP-0025 (state), AEP-0021 B8 (CRD validation).
- Go `time.ParseDuration`; Kubernetes `metav1.Duration`; CEL `duration()`.
