# AEP-0026: Interactive execution

| | |
| --- | --- |
| **AEP** | 0026 |
| **Title** | Interactive execution: the `AgentSession` kind and autonomy levels |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer, user interface implementer |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha3` |
| **Profiles affected** | new profile `session` |
| **Created** | 2026-11-23 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

People use agents interactively: a person opens a session with a coding agent, sends prompts for
hours, confirms tool calls and switches between read-only and autonomous work. AWP knows only
workflow runs; a runtime can run a session only by pretending it is a workflow with one step
(spec 6). This concept adds the smallest model for interactive use: an `AgentSession` kind next to
`WorkflowRun`, an opt-in on `Agent` with a ceiling for autonomy, and three autonomy levels. Many
details are deliberately left as open questions until a second runtime has experience with them.
It answers runtime feedback G62, G63, G73 and G82.

## Motivation

- **No execution form (G62).** A session has no task and no outputs, pauses when idle and resumes.
  Budget, permissions and audit must still apply. A proof-of-concept runtime built its own session
  object; another runtime would build a different one.
- **No ceiling for autonomy (G63).** Whether an agent may run without asking is today decided by
  the platform, not by the agent's author.
- **Narrowing per session (G73, G82).** A person enables only some of the agent's tool sources or
  picks a model from alternatives the author allows.

## Specification

### Changes to section 6 (kind `Agent`)

"Runtimes MAY run a single agent as a workflow with one agent step, or interactively as an
`AgentSession` if the agent allows it." New optional field:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `sessions` | object | Whether the agent may run as an `AgentSession`. Absent: it may not. |
| `sessions.maxAutonomy` | string | Highest autonomy level: `readOnly`, `ask` (default) or `auto`. |
| `sessions.models` | list | Alternatives to `model` that a session may pick (model objects, spec 5.4.3). |

### Autonomy levels

| Level | Meaning |
| ----- | ------- |
| `readOnly` | Actions that change the workspace or external state are denied; other allowed actions require a confirmation. |
| `ask` | Every allowed action requires a confirmation. |
| `auto` | Allowed actions run without confirmation. |

Permissions decide first: no level allows an action that permissions deny. A level above
`maxAutonomy` or above the platform ceiling is rejected (AEP-0023 section 7.5.10). Confirmations are
decided outside the execution environment by an identity that may control the session (AEP-0023).
A confirmation is not an approval: rules that require an approval still require one.

### New section 10.9 (kind `AgentSession`)

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: AgentSession
metadata:
  generateName: security-review-
  namespace: team-a
spec:
  agentRef:
    name: security-reviewer
  autonomy: ask
  toolSources: [code-scanner]
  initialPrompt: Review the repository for injection flaws.
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `spec.agentRef` | object | An `Agent` in the same namespace; `version` and `digest` are assertions as in `WorkflowRun`. |
| `spec.autonomy` | string | Level the person selected; may change while the session runs. |
| `spec.model` | object | `model` or one of `sessions.models`; anything else is rejected. |
| `spec.toolSources` | list | Tool sources to enable (by `server` or `name`, spec 5.5.2). Absent: all. Never more than the agent declares. |
| `spec.initialPrompt` | string | First prompt. |
| `spec.paused`, `spec.stop` | boolean | Pause or end the session. |

Rules:

- The creator, taken from an authenticated source as for `WorkflowRun`, is the actor and may
  control the session. A runtime MAY allow further identities and MUST document who.
- One session is one execution (spec 10.1): permissions, the agent's budget (summed across pauses)
  and audit apply to the whole session. A prompt is user input and cannot change permissions,
  policies or budgets.
- A runtime rejects a session before it starts if the agent has no `sessions`, or if model, tool
  sources or autonomy are not allowed.
- `status` shows phase (`pending`, `ready`, `working`, `waiting`, `paused`, `finished`, `failed`,
  `rejected`), the effective level, model and tool sources, and usage; never prompts, answers or
  tool arguments.

## Example

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
  tools:
    - type: mcp
      server: code-scanner
      tools: [scan]
  permissions:
    default: deny
    tools:
      code-scanner.scan:
        allow: true
  budget:
    maxCostUsd: 5
```

A session can pick the large model, enable the scanner and work at `readOnly` or `ask`; selecting
`auto` is rejected.

## Schema changes

New root kind `AgentSession`; `sessions` on `$defs/AgentSpec`. Kubernetes binding: plural
`agentsessions`, namespaced, `status` subresource.

## Conformance impact

New profile `session`. Runtime tests: a level above `maxAutonomy` is rejected; a disabled tool
source is refused; a confirmation sent from inside the execution environment is not accepted.

## Compatibility and migration

Compatible: a new kind and an optional field.

## Security considerations

A confirmation protects only if it cannot come from inside the execution environment (AEP-0023).
Confirmations inside a sandbox protect against mistakes, not against a compromised engine; the
isolation class is the boundary for what stays inside. Prompts and repository content are
untrusted input (spec 12).

## Privacy considerations

Prompts and answers are personal data of the person who wrote them and may contain code and
secrets. Their retention is open question 3.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **A session as a workflow with one step and `humanInput`.** Rejected: a step has a task and ends,
  human input is information, not a decision, and there is no autonomy level.
- **Autonomy only as platform configuration.** Rejected: the author should be able to forbid
  autonomous use; the platform can only add limits.

## Implementation status

A proof-of-concept Kubernetes runtime has its own session object with modes `plan`, `ask` and
`auto` (allowed by a binding, not the manifest), tool source selection, model alternatives per
binding and tenant, pause on idle and one execution id. Tool calls are decided by a separate
container in the sandbox pod and confirmed through a console. Shown on a test installation with
real models. Not built: `maxAutonomy` in the manifest.

## Open questions

1. **Confirmation per action:** should a permission entry carry `confirm: always | never` (for
   example "a push always asks", with only "allow once" offered)? How are shell commands mapped to
   such actions (see the `actionGroups` amendment in AEP-0002)?
2. **Kinds of confirmation:** besides "allow once" and "refuse", a grant for the rest of the session?
   It needs a determinable resource, otherwise it becomes a blanket grant.
3. **Governance without a workflow:** `dataPolicy`, `modelPolicy`, `environments`, `policies`,
   `approval` and `audit` (with `contentRetention`) come from the workflow today. Put them on
   `Agent`, attach `Policy` objects to agents (AEP-0021 B5), or use a platform-level session class?
4. **Questions of the agent:** human input (spec 5.8) requires `answerers`; in a session the person
   is there. Does the question tool exist without `humanInput`?
5. **History after the end:** what is kept (history, workspace, diff), for how long, who may read it
   (G85)?
6. **Event-started sessions (G86):** is the attested actor of AEP-0024 the creator?
7. **Naming:** `autonomy` is already used by `environments` with other values; rename the session
   field (for example `mode`)? `AgentSession` or `Session`?
8. **Events:** which lifecycle and confirmation events, with which required data?
9. **Time limits:** `sessions.idleTimeout` (pause after inactivity) and `sessions.maxDuration` (end
   after active time) in the manifest, or runtime configuration?

## Decision

Not decided. Number to be confirmed by the maintainer.

## References

- Runtime feedback G62, G63, G73, G82, G85, G86 ([runtime-feedback.md](../docs/runtime-feedback.md)).
- Spec `v1alpha3` sections 5.5.2, 5.8, 6, 7.5, 7.6, 10.1, 10.8.
- AEP-0019 (`WorkflowRun`), AEP-0023 (approvals outside the execution environment, ceilings),
  AEP-0024, AEP-0027.
