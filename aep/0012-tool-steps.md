# AEP-0012: Tool steps (`type: tool`)

| | |
| --- | --- |
| **AEP** | 0012 |
| **Title** | Tool steps (`type: tool`) |
| **Authors** | AI agent on behalf of @agenticworkflowprotocol |
| **Shepherd** | Project lead (proposed; not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer, security reviewer, MCP practitioner. None identified yet; an external review is required before `Accepted` ([aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)). |
| **Owner decisions** | [D18](../docs/decisions.md#d18-implementation-experience-goes-into-aeps-and-implementer-guidance) (2026-11-18) |
| **Target API version** | `v1alpha4` (proposed, not yet in scope; `v1alpha3` until [D24](../docs/decisions.md#d24-v1alpha4-becomes-the-current-draft), `v1alpha2` until [D22](../docs/decisions.md#d22-v1alpha3-becomes-the-current-draft)) |
| **Profiles affected** | `core` (step type), `mcp` (tool steps on MCP tools) |
| **Created** | 2026-11-18 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Add a step type `tool` that performs exactly one declared action with declared arguments and no
model invocation. The action is governed like every other action (permissions, approvals,
policies, budgets, audit events). Arguments may reference inputs and step outputs; a string that
consists of one expression keeps the type of the referenced value.

## Motivation

Many workflows contain steps whose action is fixed in advance: fetch a file, run a scan that a
tool server offers, open a pull request with text that an earlier agent step prepared, post a
comment. In `v1alpha1` such a step is either

- an **agent step** with a task like "call `github.create_pull_request` with ...": the model may
  call another tool, change the arguments or not call the tool at all, and every execution pays
  for a model invocation; content from earlier steps reaches the model again and can carry a
  prompt injection; or
- a **command step**: it needs a sandbox with network access and a credential in its environment,
  although the organisation already runs the operation as a governed tool behind an MCP server.

Runtimes built against `v1alpha1` therefore add the missing step type as an extension field
("call this tool with these arguments, no task"). Such an extension is critical: a runtime that
ignores it runs an agent step without a task. Deployments that route model calls through a
gateway that only allows tools of registered MCP servers hit a further limit: a model invocation
whose tool list contains a tool of another server is blocked, so the step cannot run as an agent
step at all.

## Goals and non-goals

- Goals: a deterministic action step; the same governance as for any action; typed arguments
  from inputs and step outputs; declared outputs from the tool result.
- Non-goals: loops or fan-out over a list (a later AEP), conditional execution (AEP-0001),
  transforming tool results with expressions, tool calls from command steps.

## Specification

### Changes to section 5.6.1 (step types)

`type` gains the value `tool`. Fields per type:

| `type` | Fields |
| ------ | ------ |
| `tool` | `agent` (REQUIRED, id of an inline agent in `spec.agents`), `tool` (REQUIRED, object), `args` (OPTIONAL, object) |

`tool`:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `server` | string | cond. | REQUIRED for an MCP tool: name of an MCP server in the tool sources of `agent`. |
| `name` | string | yes | Tool name (MCP tool `name`, or the name of a built-in tool). |

`args` is a JSON object passed as the tool arguments. Every string value inside `args`, at any
depth, is expression-enabled (section 3.9).

### New section 5.6.4 Tool steps

1. A tool step performs exactly one action: `<server>.<name>` for an MCP tool, or the action
   identifier of the built-in tool (section 5.5.3). It invokes no model. `task` MUST NOT be set.
2. The action MUST be exposed to `agent` by its tool sources (section 5.5.2). The permissions of
   the workflow and of `agent` apply as for a call made by that agent (section 7.5). The agent's
   `model` and `instructions` are not used.
3. The action is subject to permissions, policies, approvals and budgets like every other action
   and produces the same events (`tool.requested`, `tool.executed` or `tool.denied`). It counts
   against `resources.maxToolCalls`; it does not count against `maxSteps`, which counts model
   invocations and command executions.
4. **Argument rendering.** Before the action is requested, the runtime renders `args`:
   - a string that consists of exactly one expression and nothing else (whitespace inside
     `${{ }}` aside) is replaced by the referenced value with its JSON type (object, array,
     number, boolean, string);
   - any other string with expressions is rendered as text ([AEP-0013](0013-runtime-clarifications.md),
     value rendering);
   - objects and arrays are rendered element by element; other values are passed unchanged.

   The rendered arguments are the arguments of `tool.requested`, of the approval request
   (section 7.6) and of argument constraints ([AEP-0002](0002-tool-argument-constraints.md)).
5. **Outcome.** The step succeeds when the action was executed and the tool did not report an
   error. For MCP tools, a result with `isError: true` fails the step with reason `toolError`. A
   denied action fails the step with the reason of `tool.denied`. `retries` repeat the whole step,
   including the evaluation of the action.
6. **Outputs.** When the tool result has structured content (MCP `structuredContent`), each
   declared output takes the member of the same name; a declared output without such a member
   fails the step with reason `outputMissing`. Without structured content, a tool step MUST NOT
   declare more than one output, and that output receives the text content of the result
   (text items joined with a line feed).

### Changes to section 3.3 (profile-bound fields)

A tool step whose `tool.server` is set belongs to the `mcp` profile, like tool sources with
`type: mcp`. A tool step on a built-in tool belongs to `core`.

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha2
kind: Workflow
metadata:
  name: dependency-fixer
  version: 0.1.0
  owner:
    team: example-team
  classification: internal
spec:
  inputs:
    - name: repository
      type: string
      required: true
      pattern: "^[a-z0-9-]+$"
    - name: cve
      type: string
      required: true
      pattern: "^CVE-\\d{4}-\\d{4,}$"
  mcpServers:
    - name: git
      transport: streamable-http
      url: https://git-mcp.example.com/mcp
  agents:
    - id: fixer
      model:
        provider: example-provider
        name: example-model
      instructions: Propose the smallest change that removes the vulnerable version.
      tools:
        - type: mcp
          server: git
          tools: [get_file_contents, create_pull_request]
  approval:
    requiredFor: [git.create_pull_request]
    approvers:
      - role: maintainer
    timeout: 24h
  workflow:
    - id: fetch
      type: tool
      agent: fixer
      tool:
        server: git
        name: get_file_contents
      args:
        repo: "${{ inputs.repository }}"
        path: package.json
      outputs:
        - name: content
    - id: propose
      agent: fixer
      dependsOn: [fetch]
      task: "Fix ${{ inputs.cve }} in this manifest: ${{ steps.fetch.outputs.content }}"
      outputs:
        - name: title
        - name: body
        - name: files
    - id: open-pr
      type: tool
      agent: fixer
      dependsOn: [propose]
      tool:
        server: git
        name: create_pull_request
      args:
        repo: "${{ inputs.repository }}"
        title: "${{ steps.propose.outputs.title }}"
        body: "${{ steps.propose.outputs.body }}"
        files: "${{ steps.propose.outputs.files }}"
```

`files` is passed with the type of the output (for example a list of objects), not as JSON text.
The pull request is opened only with the arguments the approver saw.

## Schema changes

- Step `type` enum: add `tool`. New `ToolStep` branch with `agent`, `tool` (`server`, `name`),
  `args` (object, any JSON); `task`, `command`, `approval` not allowed.
- Semantic rules (`schema/README.md`): `step.tool-not-exposed` (the tool is not in the tool sources
  of `agent`, or filtered out by `tools`), `step.tool-agent-not-inline` (the agent is a reference
  or remote agent), expression rules of section 3.9 for every string in `args`,
  `step.tool-outputs-unstructured` is a runtime failure, not a static rule.

## Conformance impact

- `core`: step type `tool` on built-in tools; `mcp`: on MCP tools.
- New valid cases: `valid/5.6.4-tool-step.yaml`, `valid/5.6.4-tool-step-typed-args.yaml`.
- New invalid cases: `invalid/5.6.4-tool-step-with-task.yaml`,
  `invalid/5.6.4-tool-step-not-exposed.yaml`, `invalid/5.6.4-tool-step-remote-agent.yaml`,
  `invalid/5.6.4-tool-step-expression-not-in-dependency.yaml`.
- Runtime tests (once a runtime suite exists): no model invocation; approval shows rendered
  arguments; `isError` fails the step; type-preserving rendering.

## Compatibility and migration

Additive; manifests of `v1alpha1` stay valid. Runtimes that used an extension field for the same
purpose map it to `type: tool` and keep reading the extension for one release with a warning.

## Security considerations

- Fewer model invocations reduce the surface for prompt injection: content from earlier steps
  reaches the tool as data, not as instructions to a model that holds tools.
- Rendered arguments can still carry attacker-controlled values (inputs, model output). Argument
  constraints (AEP-0002), approvals with the rendered arguments and output schemas (AEP-0003)
  remain the controls. Type-preserving rendering avoids building JSON by string concatenation.
- A tool step cannot widen grants: the tool must be exposed to and permitted for its agent.

## Privacy considerations

Rendered arguments appear in `tool.requested` and approval requests; the `payload` mode of the
audit configuration applies to them as to any other action.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Do nothing** (agent step with an instructing task): non-deterministic, costs a model invocation,
  and re-exposes earlier content to a model with tools.
- **Command step calling a CLI**: needs a sandbox, network permissions and a credential in the
  environment for an operation that is already a governed tool.
- **Tool step without `agent`**, governed only by `spec.permissions`: simpler, but loses the
  per-agent grant model and makes "which identity calls the tool" implicit. Listed as an open
  question.
- **Extension field per runtime**: works locally, but is critical and not portable.

## Implementation status

At least one runtime in progress implements this behaviour as an extension field on agent steps
(tool reference and arguments, no task), with the tool required to be a tool of the step's agent
and type-preserving rendering of single-expression arguments. No implementation of this AEP
exists.

## Open questions

1. Should `agent` be OPTIONAL, with only `spec.permissions` applying when it is absent?
2. Should a tool step on a well-known action (for example `pullRequest.create`) be allowed to
   name the well-known action instead of a concrete tool?
3. Should outputs be selectable from the tool result with a path (for example `from: content.0.text`)?

## Decision

Draft. Not in the `v1alpha2` scope until an amendment of the [scope table](../docs/decisions.md#2-resulting-scope-of-v1alpha2).

## References

- Spec sections 3.3, 3.9, 5.5, 5.6, 5.7, 7.5, 7.6, 10.4.
- AEP-0001, AEP-0002, AEP-0003, AEP-0013.
