# AEP-0026: Interactive execution

| | |
| --- | --- |
| **AEP** | 0026 |
| **Title** | Interactive execution: the `AgentSession` kind, autonomy levels and per-call confirmation |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer, user interface implementer |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha3` |
| **Profiles affected** | `core`, `security`, `audit`, new profile `session` |
| **Created** | 2026-11-23 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

AWP describes one execution form: a workflow run with a task, steps and outputs. People also use
agents interactively. A person opens a session with a coding agent, sends prompts for hours,
confirms single tool calls, switches between read-only and autonomous work, pauses and resumes. A
runtime can run this today only by pretending a session is a workflow with one step (spec 6). This
AEP adds an execution form for that: the kind `AgentSession`, a sibling of `WorkflowRun`. It also
adds autonomy levels with a ceiling that the agent's author sets, a per-action `confirm` setting,
the lifecycle, budget scope and audit events of a session, and the narrowing of tool sources and
the choice of a model for one session. It answers runtime feedback G62, G63, G73, G82 and part of
G85.

## Motivation

- **No execution form (G62).** A session has no task and no outputs. It is driven by prompts, it
  pauses when idle and resumes later, and it ends when a person stops it. Budget, permissions and
  audit must still apply. A proof-of-concept runtime built its own session object and treated the
  whole session as one execution. Another runtime would build a different one, and a reviewer of
  an `Agent` manifest cannot tell what an interactive use of it may do.
- **Only allow or deny (G63).** In a session the person confirms individual actions (a shell
  command, an edit, a web request) as the agent proposes them, and switches the level during the
  session: read-only for planning, confirm each call, or autonomous. AWP approvals (spec 7.6) are
  workflow steps with approvers, and human input (spec 5.8) is information, not a decision.
  Neither fits one click on one tool call. Nothing lets an author say that an agent must never run
  autonomously, or that `git.push` always needs a confirmation. Without that, a platform can grant
  autonomy to an agent whose author did not intend it.
- **Tool sources per execution (G73).** A person wants a session that reaches the code host but
  not the ticket system, although the reviewed agent may use both. Today that takes a second
  reviewed manifest.
- **Model choice (G82).** Sessions pick a model per task (a small one for questions, a large one
  for refactoring) from alternatives that the agent and the platform allow. An `Agent` has exactly
  one model.
- **Self-approval.** The confirmations of a session are only worth something if the session cannot
  give them itself. AEP-0023 section 7.6.1 states that rule. This AEP relies on it.

## Goals and non-goals

- Goals: an execution object for interactive use of an `Agent`; autonomy levels and a ceiling
  in the manifest; confirmations that are audited and cannot come from the execution environment;
  lifecycle, budget and events; narrowing, never widening, of tool sources and model.
- Non-goals: the user interface; the transport between person and runtime; how an engine runs the
  agent (AEP-0027); workspaces and repositories (AEP-0027, AEP-0025); a chat history format;
  messages between running agents.

## Specification

### Changes to section 6 (kind `Agent`)

Replace "Runtimes MAY offer a way to run a single agent; they MUST then treat it as a workflow with
one agent step" with: "Runtimes MAY run a single agent as a workflow with one agent step, or
interactively as an `AgentSession` (section 10.9) if the agent allows it."

New `spec` field of `Agent`:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `sessions` | object | no | Whether and how the agent may run interactively. Absent: the agent MUST NOT run as an `AgentSession`. |
| `sessions.maxAutonomy` | string | no | Highest autonomy level (section 7.5.8): `readOnly`, `ask` (default) or `auto`. |
| `sessions.models` | list | no | Alternatives to `model` that a session may choose, model objects as in [section 5.4.3](../spec/v1alpha3/README.md#543-model-object). `model` stays the default. |
| `sessions.idleTimeout` | duration | no | Time without a prompt after which the runtime pauses the session. Default: implementation-defined, stated in the conformance statement. |
| `sessions.maxDuration` | duration | no | Time after which the runtime ends the session, paused time not counted. |

A session is not possible without the explicit opt-in of the author, because interactive use
changes what the agent does more than any input value.

### New section 7.5.8 (autonomy and confirmation)

**Autonomy level.** Each prompt of a session runs at one level:

| Level | Meaning |
| ----- | ------- |
| `readOnly` | Actions that change the workspace or external state are denied. Other allowed actions require a confirmation. |
| `ask` | Every allowed action requires a confirmation, except actions with `confirm: never`. |
| `auto` | Allowed actions run without confirmation, except actions with `confirm: always`. |

Which actions change state is defined per action group; a runtime that cannot tell treats an
action as changing state. Permissions (7.5.4) decide first: a denied action is denied at every
level, and no level allows an action that permissions deny.

**`confirm` on a permission entry.** New optional value in `tools` entries (7.5.1):

| Value | Meaning |
| ----- | ------- |
| absent | Follows the autonomy level. |
| `always` | Requires a confirmation at every level. In executions without a person (workflow runs) the action is denied. |
| `never` | Runs without confirmation at `ask` and `auto`; still denied at `readOnly` if it changes state. |

When several permission objects apply, the strictest `confirm` wins (`always` over absent over
`never`).

**Effective level.** The level that applies to a prompt is the lowest of: the level that the person
selected, `sessions.maxAutonomy`, and the platform ceiling (AEP-0023 section 7.5.7). Only an
identity that may control the session (section 10.9) may change the level. Every change is an
audit event.

**Confirmation.** A confirmation names the action, its arguments as the runtime shows them, and
the outcome: `allowOnce`, `allowForSession` (the same action and resource for the rest of the
session, never beyond it) or `refuse`. A confirmation is a decision under AEP-0023 section 7.6.1:
it MUST come from an authenticated identity that may control the session, and MUST be decided
outside the execution environment. A confirmation is not an approval in the sense of spec 7.6:
rules that require an approval (`requireApproval`, approval steps) still require one.

### New section 10.9 (kind `AgentSession`)

An `AgentSession` is one interactive execution of an `Agent`. Like `WorkflowRun`, it has no
governance fields of its own: governance belongs to the agent it runs and to the policies that
apply.

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: AgentSession
metadata:
  generateName: security-review-
  namespace: team-a
spec:
  agentRef:
    name: security-reviewer
    version: 0.3.0
  autonomy: ask
  model:
    provider: example-provider
    name: example-model-large
  toolSources: [code-scanner]
  initialPrompt: Review the repository for injection flaws and fix the critical ones.
```

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `spec.agentRef` | object | yes | `name` of an `Agent` in the same namespace; `version` and `digest` are assertions as in `WorkflowRun`. |
| `spec.autonomy` | string | no | Level the person selected: `readOnly`, `ask` (default) or `auto`. Capped as in 7.5.8. May change while the session runs. |
| `spec.model` | object | no | `model` or one of `sessions.models` of the agent. Anything else is rejected. May change between prompts. |
| `spec.toolSources` | list | no | Names of the agent's tool sources to enable. Absent: all. Empty list: none. A name that is not a tool source of the agent is reported in status and ignored. |
| `spec.initialPrompt` | string | no | First prompt, sent when the session is ready. |
| `spec.promptRef` | object | no | A `Prompt` (AEP-0005) used as the first prompt instead of `initialPrompt`. |
| `spec.environment` | string | no | Target environment (spec 7.10). |
| `spec.paused` | boolean | no | `true` asks the runtime to pause the session. |
| `spec.stop` | boolean | no | `true` ends the session for good. |
| `status` | object | no | Written by the runtime, see below. |

Rules:

- **Starting.** The creator of the object is the actor. It is taken from an authenticated source,
  as for `WorkflowRun`. The runtime validates the agent (including `sessions`), the model, the
  tool sources, the autonomy level and every policy before it starts anything. Otherwise it sets
  `phase: rejected`.
- **Control.** The creator may send prompts, confirm actions, change level and model, pause, resume
  and stop. A runtime MAY let further identities control a session (for example a team
  maintainer), and MUST document who. Every action of a controlling identity is an audit event with
  that identity. A prompt is user input: it cannot change permissions, policies or budgets.
- **Narrowing only.** `toolSources` and `model` can only select from what the agent declares,
  intersected with the platform ceiling. A runtime MUST NOT offer a tool source that is not
  enabled. Calls to such a source are refused, and its permissions are irrelevant for this
  session. If a change cannot take effect while the session runs, the runtime reports this in
  status and applies the change on the next resume.
- **Idle and pause.** The runtime pauses a session after `idleTimeout` and on `paused: true`. A
  turn that is still running is cancelled. A paused session keeps its workspace and history, uses
  no model calls, and resumes on `paused: false` or a new prompt.
- **Budgets.** The agent's `budget` applies to the whole session across pauses: cost, tokens and
  model calls are summed over all prompts. `maxDuration` of the budget counts active time only. A
  session that reaches a budget limit ends with reason `budgetExceeded`.
- **Ending.** A session ends on `stop: true`, on deletion, at `sessions.maxDuration` or at a budget
  limit. Deleting the object MUST NOT delete audit events. What the runtime keeps of the workspace
  and history after the end, and for how long, is stated in the conformance statement (see open
  question 3).
- **One execution.** A session has one execution id (spec 10.1) for its whole life. All audit events
  of all prompts carry it.

**Status** (`AgentSessionStatus`): `executionId`, `phase` (`pending`, `ready`, `working`,
`waiting`, `paused`, `finished`, `failed`, `rejected`), `reason`, `message`, `actor`, `agent`
(`name`, `version`, `digest` as pinned), effective `autonomy` and `model`, `toolSources` (enabled
and ignored names), `pendingConfirmations` (count, never arguments), `usage`, `startedAt`,
`lastActivityAt`, `finishedAt`, `conditions` (`Accepted`, `Ready`). `status` MUST NOT contain
prompts, answers, tool arguments or secret values. `waiting` means a confirmation or a question to
a person is pending.

### Changes to section 10.4 (event types)

| Event | When |
| ----- | ---- |
| `session.started`, `session.ready`, `session.paused`, `session.resumed`, `session.finished`, `session.failed` | Lifecycle. |
| `session.prompt` | A prompt was sent (actor, length; content only at the payload level of AEP-0009). |
| `session.autonomy.changed`, `session.model.changed`, `session.toolSources.changed` | A controlling identity changed the session (actor, from, to). |
| `action.confirmationRequested` | The runtime asks a person to confirm an action. |
| `action.confirmed`, `action.refused` | The outcome, with the identity that decided and the scope (`once`, `session`). |

These events SHOULD come from the component outside the execution environment that decides
(AEP-0023 section 7.6.1, runtime feedback G76).

### Profile `session` (spec 11)

New profile: `AgentSession`, `sessions` on `Agent`, autonomy levels, `confirm`, the events above.
Under `security`, AEP-0023 section 7.6.1 applies to confirmations.

## Examples

An agent that may run interactively, never fully autonomously, with a confirmation for every push:

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: Agent
metadata:
  name: security-reviewer
spec:
  version: 0.3.0
  owner:
    team: appsec
  classification: internal
  model:
    provider: example-provider
    name: example-model
  sessions:
    maxAutonomy: ask
    models:
      - provider: example-provider
        name: example-model-large
    idleTimeout: 30m
  tools:
    - type: mcp
      server: code-scanner
      tools: [scan]
  permissions:
    default: deny
    tools:
      code-scanner.scan:
        allow: true
        confirm: never
      shell.execute:
        allow: true
        resources: ["git *", "ls *", "python -m pytest*"]
      git.push:
        allow: true
        confirm: always
  budget:
    maxCostUsd: 5
```

A person who selects `auto` gets `ask` (the ceiling). Scans run without asking. A `git push` asks
every time. `curl` is denied.

## Schema changes

- New root kind `AgentSession` with `$defs/AgentSessionSpec`, `$defs/AgentSessionStatus`.
- `$defs/AgentSpec.sessions`; `confirm` enum in `$defs/PermissionToolEntry`.
- Semantic rules: `session.agent-not-interactive` (no `sessions`), `session.model-not-allowed`,
  `session.autonomy-invalid`, `permissions.confirm-invalid`.
- Kubernetes binding (spec 3.10): plural `agentsessions`, namespaced, `status` subresource.

## Conformance impact

- New profile `session`. Valid: `10.9-agent-session.yaml`, `6-agent-sessions.yaml`. Invalid:
  `10.9-agent-session-model-not-allowed.yaml`, `7.5.8-confirm-unknown.yaml`.
- Runtime tests: a level above `maxAutonomy` is capped; `confirm: always` asks at `auto`; a
  disabled tool source is refused; a confirmation sent from inside the execution environment is
  not accepted; the budget is summed across a pause.

## Compatibility and migration

Compatible: new kind and optional fields. Runtimes that run single agents as one-step workflows
keep doing so. A runtime that offered interactive use without this AEP needs the agent's
`sessions` opt-in once it implements the profile.

## Security considerations

- The value of a confirmation depends entirely on AEP-0023 section 7.6.1. A runtime that lets the
  agent's own permission system ask the person, inside the sandbox, offers no protection against a
  command that answers for the person.
- `allowForSession` can turn into a broad grant. It is limited to the same action and resource,
  and it ends with the session.
- A command allow list (AEP-0002) and confirmations do not restrict what an allowed program runs.
  The isolation class (AEP-0023) is the boundary for that.
- Prompts and repository content are untrusted input (spec 12, runtime feedback G81). A prompt
  that asks the agent to raise its own level has no effect, because only a controlling identity
  can change the level.

## Privacy considerations

Prompts, answers and the history of a session are personal data of the person who wrote them, and
they may contain code and secrets. Their retention follows AEP-0009. Status shows no content.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **A session as a workflow with one step and `humanInput`.** Rejected: a step has a task and
  ends; human input is information, not a decision; there is no autonomy level.
- **Confirmations as approvals (spec 7.6).** Rejected: approvals have approvers, quorum and
  separation of duties, which do not fit dozens of confirmations per hour by the person who works
  with the agent. Rules that require approvals still apply on top.
- **Autonomy only as platform configuration.** Rejected: the author knows best whether an agent
  may run without a person; the platform can only lower the level.
- **Leave interactive use to runtimes.** Rejected: the reviewed manifest would say nothing about
  the most common use of coding agents.

## Implementation status

A proof-of-concept Kubernetes runtime has its own session object with the fields of this AEP
under other names: modes `plan`, `ask` and `auto`; mode allowed by a binding instead of the
manifest; tool source selection; model alternatives per binding and tenant; pause on idle; one
execution id. A console lets people start sessions, confirm calls (once, for the session, refuse)
and switch modes. Confirmations are decided by a separate container in the sandbox pod, not by the
coding agent. Shown on a test installation: sessions with real models, modes, confirmations, tool
source selection, the self-approval attack and its counter-test. Not built: `confirm` per action
(the runtime asks for every allowed action in `ask`), the author's ceiling (`maxAutonomy`), and
sessions started by events.

## Open questions

1. Should `confirm` also exist for workflow runs, as "deny unless an approval step precedes"?
2. Is `readOnly` well-defined without a standard classification of actions into reading and
   changing? Should AWP add a `readOnly` group?
3. What does a runtime keep after a session ends (history, workspace, diff), for how long, and who
   may read it (runtime feedback G85)? Here, or in AEP-0009 and AEP-0025?
4. Should a session be startable by an event (runtime feedback G86), and is the attested actor of
   AEP-0024 then its creator?
5. Name: `AgentSession` or `Session`?

## Decision

Not decided. Number to be confirmed by the maintainer.

## References

- Runtime feedback G62, G63, G73, G82, G85 ([runtime-feedback.md](../docs/runtime-feedback.md)).
- Spec `v1alpha3` sections 5.8, 6, 7.5, 7.6, 10.1, 10.4, 10.8.
- AEP-0005 (`Prompt`), AEP-0009 (audit payload levels), AEP-0017 (human input), AEP-0019
  (`WorkflowRun`), AEP-0023 (approval authority, ceilings), AEP-0027 (agent engine).
