# AEP-0024: Event triggers with CloudEvents

| | |
| --- | --- |
| **AEP** | 0024 |
| **Title** | Event triggers with CloudEvents: filters, duplicates, actors and conversation context |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer, privacy reviewer |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha4` (`v1alpha3` until [D24](../docs/decisions.md#d24-v1alpha4-becomes-the-current-draft)) |
| **Profiles affected** | `core`, `governance`, `audit` |
| **Created** | 2026-11-22 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Spec 5.2 lets an `event` trigger start an execution, but leaves the event format, filter
semantics, duplicates, concurrency, the actor and conversation context open. This AEP uses
CloudEvents 1.0 as the event model, defines `filter` as equality on CloudEvents attributes and
data paths, requires deduplication by `source` and `id`, adds `concurrencyPolicy` and a rate limit
to event triggers, records the authenticated source and an attested person as the actor so that
approval rules bind that person, and defines where conversation context and reply data live. It
builds on AEP-0004 (`${{ event.* }}`, `dataSchema`, decision D7) and AEP-0019 (`WorkflowRun`), and
answers runtime feedback G42 to G46, G54 and G56. Runtime trigger objects (G52) belong to AEP-0021.

## Motivation

A proof-of-concept runtime starts workflows from chat mentions: a bridge publishes each message as
a CloudEvent to a message broker, an event router with one filter object per workflow creates
runs, and a step answers in the originating thread. Routing involves no model, so a message cannot
redirect it by prompt. It found:

- **Filters** are a map of strings, but which fields they match, how they compare and how entries
  combine is undefined (G42). Each router has its own filter language.
- **Duplicates** are real: message brokers and webhooks redeliver, and the runtime saw a second
  run for the same event, which it rejected as duplicate. `concurrencyPolicy` exists only for
  `schedule` (G43).
- **Actor.** Spec 5.2 gives every event start the actor type `system`. The authenticated party is
  the bridge, not the person who wrote the message. Approval rules that refer to the initiator
  (`initiatorCannotApprove`, `actorCannotApproveOwnAction`, spec 7.6) then do not bind that
  person, who can trigger a run by message and approve its request (G44).
- **Reply path.** A run started by a message cannot refer to where the message came from (G45).
- **Conversation context.** A reply in a thread only sees the triggering message (G46). The proof
  of concept lets the bridge attach earlier messages and participants.
- **`source`** means the event producer in spec 5.2 and AEP-0004 (`git.example.com`) and an
  adapter name in AEP-0021 B4 (G54).
- **Delivery.** A router silently weakened delivery from "at least once" to "at most once" (an
  MQTT subscription with QoS 0) (G56).

## Goals and non-goals

- Goals: portable event triggers on top of CloudEvents; no execution from a forged or duplicate
  event; approvals that bind the person behind an event; conversation context as data, not as
  instructions.
- Non-goals: transports (MQTT, webhooks, queues); router configuration (implementation-specific
  trigger objects, AEP-0021); delivery of replies (steps do that); standard interaction event
  types (a later AEP).

## Specification

### Changes to section 5.2: event model

- An event is a CloudEvent 1.0. Runtimes that receive events in another format MUST map them to
  the CloudEvents attributes before matching.
- `source` of an `event` trigger is matched against the CloudEvents `source` attribute
  (URI-reference). It names the producer, not the adapter or transport; choosing an adapter
  belongs to runtime configuration. `eventType` is matched against `type`.
- `event.id`, `event.source`, `event.type`, `event.subject`, `event.time` and `event.data` in
  expressions (AEP-0004) are the CloudEvents attributes of that name.

### Filter semantics

- Keys of `filter` are CloudEvents attribute names (`subject`, extension attributes) or
  `data.<path>` with dot-separated object keys. Values are strings and match by equality with the
  string form of the attribute or value. All entries MUST match. A missing attribute or path does
  not match.
- Runtime-specific conditions (expression languages, rate rules) MAY be configured in an
  implementation-specific trigger object (AEP-0021). They MAY only narrow the manifest trigger: an
  event that does not match the manifest trigger MUST NOT start an execution, whatever the
  runtime configuration says.

### Duplicates, concurrency and rate

- Deduplication is per workflow: the runtime MUST NOT start a second execution **of the same
  workflow** for an event with the same `source` and `id` within a deduplication window. An event
  that matches several workflows starts each of them once. If several trigger entries of one
  workflow match the same event, the workflow starts once, with the first matching entry recorded
  in `status.trigger.index`. It MUST state the window in its conformance statement; the
  window MUST be at least 24 hours. A rejected duplicate MUST be recorded as `trigger.skipped` with
  reason `duplicate`.
- An `event` trigger MAY have `concurrencyPolicy` with the values and semantics of a `schedule`
  trigger (default `allow` for events), considering executions started by the same trigger entry.
- An `event` trigger MAY have `rateLimit` with `maxExecutions` (integer) per `period` (duration).
  Events over the limit MUST NOT start executions and MUST be recorded as `trigger.skipped` with
  reason `rateLimited`.

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `concurrencyPolicy` | string | no | `allow` (default), `forbid` or `replace`, as for `schedule`. |
| `rateLimit` | object | no | `maxExecutions` (integer, REQUIRED) and `period` (duration, REQUIRED). |

### Actor (changes to sections 5.2, 7.6 and 10.3)

Replaces the sentence "An execution started by `schedule` or `event` has the actor type `system`"
for `event`:

- An execution started by an `event` trigger has the actor type `system` with `id` set to the
  authenticated identity of the event source (the transport identity the runtime verified).
- If the event carries a person attested by that source, the runtime MAY record it as
  `attestedActor` (`type: human`, `id`) in `workflow.started`, but only if the runtime's
  configuration marks the source as trusted to attest people. Otherwise it MUST NOT record one.
- Approval rules that refer to the initiator (`initiatorCannotApprove`,
  `actorCannotApproveOwnAction`) MUST treat the attested actor as the initiator.
- A policy MAY require an attested actor for an event trigger (condition `trigger.attested`);
  without one, the execution MUST NOT start.

Informative: a bridge that is the only identity allowed to publish on a broker topic, and that
reads the author from the chat system with its own credentials, attests through transport
authorisation, not end to end. A signature over the event would be stronger.

### Conversation context and reply data

- Conversation context (earlier messages of a thread, participants) is part of `event.data`. It
  is untrusted input (AEP-0004), has the classification of `event.data`, and participants and
  message texts are personal data in the sense of spec 7.2.
- Correlation data for a reply (thread, message, channel) SHOULD be carried in `event.subject` or
  in `event.data`; delivery of a reply is the job of a step.
- Informative: a standard shape for thread context and reply targets is left to a later AEP with
  frontend-neutral interaction event types.

### Conformance statement (spec 11)

A runtime MUST state, per supported event source, the delivery guarantee from the source to the
start of an execution (at most once, at least once) and its deduplication window.

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: Workflow
metadata:
  name: chat-assistant
spec:
  version: 0.1.0
  owner:
    team: support
  classification: internal
  triggers:
    - type: event
      source: chat.example.com
      eventType: com.example.chat.message.posted
      filter:
        data.mentioned: "true"        # a scalar; equality on lists is undefined
      concurrencyPolicy: allow
      rateLimit:
        maxExecutions: 20
        period: 1h
      dataSchema:
        type: object
        required: [message, thread]
        properties:
          message: { type: string, maxLength: 4000 }
          thread: { type: string, maxLength: 64 }
  agents:
    - id: assistant
      model:
        provider: example-provider
        name: example-model
  workflow:
    - id: answer
      agent: assistant
      task: "Answer this message: ${{ event.data.message }}"
```

## Schema changes

- Event trigger: `concurrencyPolicy`, `rateLimit {maxExecutions, period}`.
- `filter` keys: pattern for attribute names and `data.<path>`.
- Policy condition `trigger.attested` (boolean).
- `workflow.started`: optional `attestedActor`.

## Conformance impact

- `core`: filter semantics, deduplication, conformance statement.
- `governance`: attested actor in approval rules, `trigger.attested`.
- `audit`: `trigger.skipped` reasons `duplicate`, `rateLimited`; `attestedActor`.
- Valid: `5.2-event-filter-data-path.yaml`, `5.2-event-rate-limit.yaml`. Invalid:
  `5.2-event-filter-invalid-key.yaml`, `5.2-event-rate-limit-missing-period.yaml`.
- Runtime tests: the same event twice; an event that matches the runtime filter but not the
  manifest filter; an approval requested in a run started by the approver's own message.

## Compatibility and migration

Additive except for `filter`: runtimes that interpreted filter keys differently must follow the
new semantics. AEP-0021 B4 loses `triggers[].source` as a domain-prefixed value space.

## Security considerations

- Deduplication and rate limits stop replay and flooding.
- Narrow-only runtime filters keep the reviewed trigger as the upper bound.
- Approval rules bind the person behind an event; without this, a message could start a run whose
  request the same person approves.
- Conversation context is untrusted input and can carry prompt injection from other participants.

## Privacy considerations

Thread context contains messages and identities of people who did not start the run. Runtimes
SHOULD cap its size, MUST apply the data policy of `event.data` to it, and SHOULD NOT include it
in audit events beyond the metadata level.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Map events to inputs.** Rejected by D7; AEP-0004 keeps event data recognisable as untrusted.
- **A filter expression language in the manifest.** Rejected: not portable across routers;
  equality is the portable floor, richer rules live in runtime objects.
- **Always actor `system`.** Rejected: leaves the approval hole of G44.
- **Always trust a person named in the event.** Rejected: any publisher could name anyone.

Prior art (named under decision D21): the `listen` task of the
[Open Workflow Specification](https://github.com/open-workflow-specification/specification) consumes
CloudEvents and filters them with `with` on attributes and `data`, where values may be regular
expressions or runtime expressions, and correlates events with `correlate`. This AEP keeps the
CloudEvents model and attribute names of that design, but restricts the manifest filter to
equality so that every router can evaluate it; richer conditions stay in runtime objects that may
only narrow.

## Implementation status

A proof-of-concept Kubernetes runtime receives chat messages as CloudEvents through a broker and an
event router, deduplicates by `source` and `id`, and answers in the thread from a step. It plans
to create event runs itself from a trigger object generated from `spec.triggers`. The router it
uses subscribes to MQTT with QoS 0. The thread limits of its bridge (30 entries, 12,000
characters) are set, not measured.

The same runtime, extended to a platform with interactive sessions, adds three data points:

- **Deduplication confirmed.** A security scan workflow started by a CloudEvent over MQTT ran once;
  a repeated delivery was rejected as a duplicate by `source` and `id`.
- **Events emitted by the runtime.** The runtime publishes CloudEvents about sessions (created,
  ready, idle, resumed, finished, failed) and "waiting for a person" when a confirmation is
  pending, so that chat bridges can notify people. AWP has no vocabulary for events that a runtime
  emits about executions, only for events that start them (runtime feedback G62).
- **Event-started sessions (concept, not built).** An event could also start an interactive
  session with an initial prompt. The actor question of G44 then decides who created the session
  and who may control it: the attested person, not the bridge (runtime feedback G86).

## Open questions

1. Is 24 hours the right minimum deduplication window?
2. Should `attestedActor` also be allowed for `manual` starts through a trusted front end?
3. How does a client run carry an event for testing or replay (AEP-0019 open question 1, runtime
   feedback G48 and G57)? Proposed as an amendment of AEP-0019.
4. Which CloudEvents attribute carries the attested actor, and is `trigger.attested` a start-time
   check (like `environments`) rather than a policy condition evaluated per action?

## Decision

Not decided. Number and scope assigned by the maintainer on 2026-11-22.

## References

- Runtime feedback G42 to G46, G54, G56 ([runtime-feedback.md](../docs/runtime-feedback.md)).
- AEP-0004, AEP-0019, AEP-0021; decision D7.
- CloudEvents 1.0 specification.
- Open Workflow Specification, `listen` and `emit` tasks.
