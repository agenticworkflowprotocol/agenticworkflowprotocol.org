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
| **Target API version** | `v1alpha4` (`v1alpha3` until [D24](../docs/decisions.md#d24-v1alpha4-becomes-the-current-draft)) |
| **Profiles affected** | new profile `engine` |
| **Created** | 2026-11-23 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

An `Agent` assumes that the runtime runs the tool loop. Coding agents bring their own loop with file
editing, shell use and Git handling. This concept adds `agents[].engine`: which engine runs the
agent and from which repositories. AWP permissions, budgets and audit stay in force, and a runtime
without the engine rejects the manifest instead of running a different loop. Configuration from the
repository is not loaded unless the manifest allows it. Outputs, pushing and repositories chosen by
events are left as open questions. It answers runtime feedback G65 and G81 and part of G66 and G83.

## Motivation

- **Who runs the loop (G65).** A step "fix the critical findings" is best run by a coding agent.
  The manifest cannot say so; a runtime that ignores an extension field runs its own loop and still
  reports success.
- **Repository content as instructions (G81).** Repositories bring instruction files, skills,
  commands and tool manager configuration that set environment variables. An engine loads them by
  default, so a pull request can change what the agent does before any permission applies.

## Specification

### Changes to section 5.4 (agents)

New optional field `engine` on inline agents and `Agent` manifests:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `engine.type` | string | The engine, a domain-prefixed value (`example.com/coding-agent`). A runtime that does not support it MUST reject the manifest. |
| `engine.workspace.repositories` | list | `url` (https, a fixed value), `ref`, `path`: cloned before the engine starts; the starting commit is recorded. |
| `engine.workspace.trustRepositoryConfig` | list | Kinds of repository configuration the engine may load: `instructions`, `skills`, `commands`, `toolchain`. Default: none. |

### New section 5.4.5 (engine semantics)

- Permissions (spec 7.5), budgets (spec 5.7) and audit apply to the engine as to any agent step;
  model calls are metered outside the engine. Subagents of the engine share the step's permissions
  and budget.
- In unattended executions an action is allowed or denied; there is nobody to ask.
- What leaves the execution environment (model and tool calls, network, credentials) is enforced
  outside it (AEP-0023). For actions that stay inside, the boundary is the isolation class; the
  engine's own permission system is an additional check.
- Clone credentials are workflow secrets (spec 7.9) and, under `security`, not visible to the engine.
- Repository configuration not listed in `trustRepositoryConfig` MUST NOT be loaded. Listed kinds
  are untrusted input (spec 12) and cannot change permissions, budget or tools.

## Example

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
  agents:
    - id: scanner
      isolation: sandbox
      engine:
        type: example.com/coding-agent
        workspace:
          repositories:
            - url: https://git.example.com/app.git
              ref: main
              path: app
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
      task: Scan the repository and report the findings. Do not change files.
      outputs:
        - name: summary
```

## Schema changes

`$defs/AgentEngine`; `engine` on `$defs/InlineAgent` and `$defs/AgentSpec`.

## Conformance impact

New profile `engine`. Runtime tests: an unknown engine is rejected; a repository instruction file is
not loaded; a subagent's model call counts against the step budget.

## Compatibility and migration

Compatible: a new optional field. Until it is applied, an `extensionRef` (AEP-0021 B3) is the
conforming way.

## Security considerations

An engine is a large program inside the execution environment; its decisions do not count as
enforcement (AEP-0023). Repository configuration is code and instructions from whoever can write to
the repository; the default "none" closes that path.

## Privacy considerations

Repositories may contain personal data; outputs follow the step's classification.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **An extension field per runtime.** Works with `extensionRef`, but reviewers cannot compare
  manifests across runtimes.
- **Engines as tools.** Rejected: the engine makes the model calls, so budgets, model policy and audit
  must apply to it as to an agent.

## Implementation status

A proof-of-concept Kubernetes runtime runs agent steps with an open-source coding agent through an
extension field of this shape and disables project configuration and external skills. A security
scan workflow ran with it on a test installation, started by hand and by a CloudEvent. It produces
only `summary` and `diff` as outputs.

## Open questions

1. **Outputs (G66):** should the engine fill declared outputs through the completion mechanism of
   AEP-0018, with types from AEP-0003, so that later steps can branch on them?
2. **Repositories from inputs or events (G66):** expression-enabled `url`? Then a clone credential
   must be bound to a host or URL pattern, or a sender can redirect it.
3. **Push:** `engine.push` with branch and repository, `git.push` permission, outputs `branch` and
   `commit`; and what pushing means in a session.
4. **Registry:** should this repository keep a registry of engine names?
5. **Tools:** must `tools` list everything the engine offers, or may built-in tools be covered by
   permissions only?
6. **Failure:** does a refused tool call fail the step, or is it a tool error the agent can recover
   from?
7. **Runtime profile:** should the manifest name a runtime-defined profile for image and resources
   (`engine.runtimeProfile`), or is that binding data only?

## Decision

Not decided. Number to be confirmed by the maintainer.

## References

- Runtime feedback G65, G66, G81, G83 ([runtime-feedback.md](../docs/runtime-feedback.md)).
- Spec `v1alpha3` sections 5.4, 5.7, 7.5, 7.9, 12.
- AEP-0003, AEP-0018, AEP-0021, AEP-0023, AEP-0026.
