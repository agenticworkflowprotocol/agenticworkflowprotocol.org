# AEP-0016: Schedule semantics: overlap and missed ticks

| | |
| --- | --- |
| **AEP** | 0016 |
| **Title** | Schedule semantics: overlap and missed ticks |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes) |
| **Reviewers** | - |
| **Target API version** | `v1alpha2` |
| **Profiles affected** | `core`, `audit` |
| **Created** | 2026-11-19 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

A `schedule` trigger has only `cron` and `timezone`. This AEP defines what happens when a tick
arrives while the previous scheduled execution is still running (`concurrencyPolicy`: `forbid` by
default, `allow`, `replace`), what happens to ticks missed while the runtime was down (skipped by
default, optional `startingDeadline`), and a `trigger.skipped` event for every tick that does not
start an execution. The text is applied in [spec/v1alpha2 section 5.2](../spec/v1alpha2/README.md#52-triggers).

## Motivation

Agent executions often run longer than a cron interval (a nightly triage that takes hours, an
hourly check that waits for a model or a person). Without a rule, runtimes behave differently:
some start overlapping executions that work on the same repository, some queue ticks, some drop
them silently. After an outage some runtimes start one execution per missed tick, which multiplies
cost and side effects. Authors cannot express the behaviour they need, and an auditor cannot tell
whether a tick was skipped or lost.

Kubernetes `CronJob` solved the same problem with `concurrencyPolicy` and
`startingDeadlineSeconds`; operators that implement AWP on Kubernetes need an equivalent, and
runtimes without Kubernetes need the same semantics to be portable.

## Goals and non-goals

- Goals: deterministic overlap behaviour per trigger; no catch-up storms after an outage; every
  skipped tick is visible in the audit trail.
- Non-goals: queues of pending ticks, concurrency limits across triggers or workflows (tenant
  quotas stay runtime configuration), schedules as separate objects, calendars beyond cron.

## Specification

Applied in [spec/v1alpha2 section 5.2](../spec/v1alpha2/README.md#52-triggers), summarised:

1. New fields of `schedule` triggers: `concurrencyPolicy` (`forbid` default, `allow`, `replace`)
   and `startingDeadline` (duration). Both are invalid on other trigger types.
2. A tick starts at most one execution; `workflow.started` records `scheduledAt` (the tick time).
3. `concurrencyPolicy` considers only executions started by the same trigger entry of the same
   workflow, independent of its version. `replace` cancels the running execution as actor
   `system` (`workflow.cancelled` with `reason: replaced`) and starts the new one after the
   cancellation has completed.
4. Missed ticks are skipped unless `startingDeadline` is set; then at most one execution for the
   latest missed tick may start if it is not older than `startingDeadline`.
5. Every tick that does not start an execution produces `trigger.skipped` with `reason`
   `concurrencyForbidden`, `missed` or `startingDeadlineExceeded`. It belongs to no execution, so
   the envelope's `executionId` becomes conditional and such events form one hash chain per
   workflow (sections 10.3 to 10.5).

## Examples

```yaml
triggers:
  - type: schedule
    cron: "0 */2 * * *"
    timezone: Europe/Berlin
    concurrencyPolicy: forbid
    startingDeadline: 15m
```

## Schema changes

`Trigger` gets `concurrencyPolicy` (enum) and `startingDeadline` (`Duration`); the conditional
branches of `manual` and `event` triggers reject both. The generated CustomResourceDefinitions are
regenerated.

## Conformance impact

- `core`: overlap and missed-tick behaviour for runtimes that support schedule triggers.
- `audit`: `trigger.skipped`.
- New `v1alpha2` cases: `valid/5.2-schedule-concurrency-and-deadline`,
  `invalid/5.2-invalid-concurrency-policy` (`schema.enum`),
  `invalid/5.2-concurrency-policy-on-event-trigger` (`schema.not`),
  `invalid/5.2-starting-deadline-not-duration` (`schema.pattern`).
- Runtime tests, once a runtime suite exists: a long execution with `forbid` skips the next tick and
  emits `trigger.skipped`; `replace` cancels before starting; after a simulated outage at most one
  execution starts.

## Compatibility and migration

Additive. A `v1alpha1` schedule trigger keeps its meaning only where runtimes already behaved like
`forbid` and skipped missed ticks; runtimes that started overlapping executions or caught up must
change, or authors set `concurrencyPolicy: allow`.

## Security considerations

`forbid` as default avoids two executions acting on the same resources at once. `replace` cancels
work in progress; cancellation follows the normal rules, so effects already performed stay
performed. No catch-up by default limits cost and side effects after outages.

## Privacy considerations

None.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Queue ticks** while an execution runs: unbounded queues and stale work; rejected.
- **`allow` as default** (matches naive cron): overlapping agent runs on the same repository are a
  common failure; rejected.
- **Seconds instead of a duration** (`startingDeadlineSeconds` as in Kubernetes): AWP uses
  durations everywhere.
- **A separate `Schedule` kind** (one object per schedule with its own status): useful for
  Kubernetes runtimes and possible later; the semantics defined here would carry over unchanged.

## Implementation status

Schema, CustomResourceDefinitions and conformance cases are in this repository. No runtime
behaviour is implemented here.

## Open questions

1. Should `concurrencyPolicy` also consider executions of the same workflow started manually?
2. Should `replace` wait for `finally` steps once they exist (proposed elsewhere for `v1alpha2`)?

## Decision

-

## References

- Kubernetes CronJob: `concurrencyPolicy`, `startingDeadlineSeconds`.
