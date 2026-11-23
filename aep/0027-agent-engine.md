# AEP-0027: Agent engine

| | |
| --- | --- |
| **AEP** | 0027 |
| **Title** | Agent engine: running an agent with an existing coding agent |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer, coding agent maintainer |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha3` |
| **Profiles affected** | `core`, `security`, new profile `engine` |
| **Created** | 2026-11-23 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

An `Agent` describes model, instructions, tools and permissions, and assumes the runtime runs the
tool loop. Coding agents bring their own loop with file editing, shell use, Git handling and
subagents, and runtimes would otherwise rebuild all of it. This AEP adds `agents[].engine`: which
engine runs the agent, from which workspace, and what it may push. It defines how AWP
permissions, budgets, outputs and audit apply to an engine. A runtime that does not have the
engine rejects the manifest instead of running a different loop. Configuration from the workspace
stays off unless the manifest allows it. The AEP answers runtime feedback G65, G66, G81 and G83.

## Motivation

- **Who runs the loop (G65).** A workflow step "fix the critical findings" is best run by a coding
  agent. The manifest cannot say so: a proof-of-concept runtime used an extension field, and
  another runtime ignoring it would run its own loop with different tools and still claim the
  step succeeded.
- **Dead ends in a workflow (G66).** The engine of the proof of concept produces only a summary and
  a diff. A step that declares outputs such as `critical` and `high` is rejected, so the next step
  cannot branch on the number of findings. The repositories are fixed in the manifest, so an event
  cannot name the repository to review.
- **Repository content as instructions (G81).** Repositories bring instruction files for agents,
  skills, custom commands and tool manager configuration that sets environment variables. A coding
  agent loads them by default. A pull request can then change what the agent does and run code at
  start, before any permission applies.
- **Credentials of the workspace (G83).** Cloning a private repository needs a credential. If it
  stays in the workspace or the environment, the engine and every command can read it.
- **Subagents.** An engine can start subagents. Whether they inherit permissions and budget, and
  whether their requests belong to the execution, is undefined.

## Goals and non-goals

- Goals: name the engine; reject unknown engines; one mapping of AWP permissions to the engine;
  budgets and audit as for any agent step; declared outputs filled by the engine; repositories as
  inputs; workspace configuration off by default; credentials outside the engine.
- Non-goals: a list of engines; the engine's own options; interactive use (AEP-0026 uses the same
  field); isolation (AEP-0023 `isolation`); state across executions (AEP-0025).

## Specification

### Changes to section 5.4 (agents)

New field `engine` on inline agents and in `Agent` manifests:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `engine.type` | string | yes | The engine, a domain-prefixed value or a name from a registry this repository keeps (for example `opencode`). A runtime that does not support the type MUST reject the manifest. |
| `engine.runtimeProfile` | string | no | A runtime-defined profile for image and resources. It MUST NOT weaken `isolation` (AEP-0023). |
| `engine.workspace.repositories` | list | no | `url` (https, expression-enabled), `ref` (branch, tag or commit, expression-enabled), `path`. Cloned before the engine starts; the commit each one starts from is recorded as its base. |
| `engine.workspace.trustRepositoryConfig` | list | no | Kinds of workspace configuration the engine may load: `instructions` (agent instruction files), `skills`, `commands`, `toolchain` (tool manager configuration). Default: none. |
| `engine.push` | object | no | `branch` (expression-enabled) and `repository` (a `path` from `repositories`). |

`engine` belongs to the `engine` profile. Expressions in `repositories` and `push` may use
`inputs.*`, `event.*` (AEP-0004) and `execution.*`. A resolved `url` is subject to the effective
network (AEP-0023) like any other destination.

### New section 5.4.6 (engine semantics)

- **Permissions.** The runtime maps the effective permissions (spec 7.5.4) to the engine. In
  unattended executions an action is allowed or denied. There is nobody to ask, so `confirm:
  always` (AEP-0026) is denied. Questions to a person are declined unless `humanInput` allows them
  (spec 5.8.2). Access outside the workspace is denied. The engine's own permission system MAY
  enforce the mapping in addition. Under `security`, a component outside the execution environment
  MUST enforce it (AEP-0023 section 7.6.1).
- **Tools.** The tools that the engine offers to the model MUST be covered by the agent's tool
  sources and permissions. Built-in tools of the engine map to action identifiers (`shell.execute`,
  `file.write`, `web.fetch`), which the runtime documents per engine.
- **Failure.** A tool call that the runtime refuses because of a permission fails the step,
  whatever the engine's exit code. So does an error that the engine reports, and a timeout.
- **Budgets.** Spec 5.7 applies to the engine's model calls. The runtime meters them outside the
  engine, also during streaming (runtime feedback G78). Subagents of the engine share the step's
  budget and permissions. Their calls belong to the step's execution and carry its execution id.
- **Outputs.** The engine produces the declared outputs of the step through the completion
  mechanism of AEP-0018, with types and schemas from AEP-0003 where present. A runtime also
  provides `summary` (the engine's final answer) and `diff` (changes against the base) if the step
  declares them. A step that pushes MUST declare `branch` and `commit`, so that the execution
  records what left the workspace.
- **Push.** `push` requires the action `git.push`, and pushes only to `branch` of `repository`.
- **Credentials.** Clone and push credentials are workflow secrets (spec 7.9). Under `security` they
  MUST NOT be visible to the engine. The runtime clones and pushes outside the engine, or removes
  the credential before the engine starts. Model and tool server credentials follow AEP-0023.
- **Workspace configuration.** Kinds not listed in `trustRepositoryConfig` MUST NOT be loaded by
  the engine. Listed kinds are untrusted input (spec 12): they can change what the agent does, never
  its permissions, budget or tools.
- **Audit.** Model calls and tool calls are audited as for any agent step. Events from the engine
  itself carry the origin `engine` (runtime feedback G76).

### Profile `engine` (spec 11)

New profile with `engine` and section 5.4.6. The conformance statement lists the supported engine
types, the action mapping of their built-in tools, and which workspace configuration kinds they
can disable.

## Examples

A scan workflow whose repository comes from the event, with counts as typed outputs:

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: Workflow
metadata:
  name: security-scan
spec:
  version: 0.2.0
  owner:
    team: appsec
  classification: internal
  triggers:
    - type: event
      eventType: com.example.security-scan.requested
  agents:
    - id: scanner
      isolation: sandbox
      engine:
        type: opencode
        workspace:
          repositories:
            - url: ${{ event.data.repository }}
              ref: ${{ event.data.ref }}
              path: repo
      model:
        provider: example-provider
        name: example-model
      tools:
        - type: mcp
          server: code-scanner
          tools: [scan]
      permissions:
        default: deny
        tools:
          code-scanner.scan: {allow: true}
          file.read: {allow: true}
  workflow:
    - id: scan
      agent: scanner
      task: Scan the repository, triage the findings and report them. Do not change files.
      outputs:
        - name: summary
        - name: critical
          type: integer
        - name: high
          type: integer
    - id: escalate
      if: ${{ steps.scan.outputs.critical > 0 }}
      dependsOn: [scan]
      agent: notifier
      task: Open a ticket with ${{ steps.scan.outputs.summary }}.
```

The `if` condition needs AEP-0001 and the typed outputs need AEP-0003. Without them the example
shows where engine steps stop being dead ends.

## Schema changes

- `$defs/AgentEngine`; `engine` on `$defs/InlineAgent` and `$defs/AgentSpec`.
- Semantic rules: `engine.type-unsupported` (runtime), `engine.push-outputs-missing`,
  `engine.repository-url-scheme`.

## Conformance impact

- New profile `engine`. Valid: `5.4-agent-engine.yaml`. Invalid:
  `5.4-agent-engine-push-without-outputs.yaml`, `5.4-agent-engine-http-url.yaml`.
- Runtime tests: unknown engine rejected; a refused tool call fails the step; a subagent's model
  call counts against the step budget; an instruction file in the repository is not loaded; the
  clone credential is not readable from the engine.

## Compatibility and migration

Compatible: a new optional field. Runtimes with an extension field of the same shape migrate by
renaming. Until this AEP is applied, an `extensionRef` at the agent (AEP-0021 B3) is the conforming
way, and runtimes without the extension reject the manifest.

## Security considerations

- An engine is a large program with its own permission system, plugins and configuration loading.
  It runs inside the execution environment, so its decisions do not count as enforcement under
  `security` (AEP-0023 section 7.6.1).
- Workspace configuration is code and instructions from whoever can write to the repository. The
  default "none" closes a path for prompt injection and code execution at start.
- `repositories` from event data allows a sender to choose what is cloned. The effective network and
  the platform ceiling decide which hosts are reachable. Authors SHOULD restrict `url` with a
  pattern in the event's `dataSchema`.

## Privacy considerations

Repositories may contain personal data. The diff is an output and follows the step's
classification.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **An extension field per runtime.** Works today with `extensionRef`, but every runtime names
  engines differently, and reviewers cannot compare manifests.
- **Model engines as tools.** Rejected: the engine runs the whole loop and makes the model calls,
  so budgets, model policy and audit must apply to it as to an agent.
- **Engine-specific outputs only (`summary`, `diff`).** Rejected: steps after an engine step need
  typed outputs.

## Implementation status

A proof-of-concept Kubernetes runtime runs agent steps with OpenCode through an extension field of
this shape (with the repositories fixed and the outputs limited to `summary` and `diff`). The
runtime disables project configuration and external skills of the engine. A security scan
workflow ran with it on a test installation, started by hand and by a CloudEvent: the engine
called a static analysis server through the runtime's MCP gateway with a step ticket, and the
gateway counted the calls against the run's budget. Declared outputs other than `summary` and
`diff` are rejected today. Interactive sessions of the same runtime use the same engine
(AEP-0026).

## Open questions

1. Should this repository keep a registry of engine type names, or should every type be
   domain-prefixed?
2. Must `tools` list exactly what the engine offers, or may an engine offer built-in tools that are
   only covered by permissions?
3. Engine-specific options (variants, subagent definitions): `extensionRef` on `engine`, or out of
   scope?
4. Is `trustRepositoryConfig` at the right level, or should it be a permission (`workspace.config`)?

## Decision

Not decided. Number to be confirmed by the maintainer.

## References

- Runtime feedback G65, G66, G81, G83, with G12 and G60 ([runtime-feedback.md](../docs/runtime-feedback.md)).
- Spec `v1alpha3` sections 5.4, 5.7, 5.8.2, 7.5, 7.9, 12.
- AEP-0001, AEP-0003, AEP-0004, AEP-0018, AEP-0021, AEP-0023, AEP-0026.
