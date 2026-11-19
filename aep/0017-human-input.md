# AEP-0017: Human input during an execution

| | |
| --- | --- |
| **AEP** | 0017 |
| **Title** | Human input during an execution |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer, security reviewer, someone familiar with MCP elicitation |
| **Reviewers** | - |
| **Target API version** | `v1alpha2` |
| **Profiles affected** | new `interaction` profile; `audit`, `mcp` |
| **Created** | 2026-11-19 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Let an execution ask a person a question and wait for a free-text or structured answer. An
**input step** (`type: input`) asks a question declared in the manifest; an agent with
`humanInput` may ask questions of its own through a built-in tool. Answers follow a flat schema
taken from MCP elicitation, come only from named human answerers, expire with `onTimeout`, are
recorded as `input.*` audit events whose content follows the `payload` rules, and never count as
approvals. The text is applied in [spec/v1alpha2 section 5.8](../spec/v1alpha2/README.md#58-human-input).

## Motivation

Approvals answer one question: may this action run? Many workflows need information instead:
"which targets?", "which of these three fixes?", a clarification in a chat thread before an agent
continues. Today authors either encode this as an approval (and parse the approver's comment),
start a new execution with new inputs, or let the agent call a chat tool, which bypasses identity
checks and audit. MCP already defines elicitation for servers that need user input; a runtime has
to decide what to do with such a request, and AWP gives it no rule.

## Goals and non-goals

- Goals: one model for declared questions and agent questions; structured answers that a runtime
  can validate; the same identity rules as approvals; an audit trail that does not copy personal
  data by default; a defined answer to MCP elicitation requests.
- Non-goals: chat transport and user interfaces, multi-turn conversations as an execution model,
  redirecting a running agent with new instructions, answers that change governance.

## Specification

Applied in [spec/v1alpha2 section 5.8](../spec/v1alpha2/README.md#58-human-input), summarised:

1. **Input step** (`type: input`, field `input`): `message` (expression), `answerSchema`
   (optional; absent means free text), `answerers` (REQUIRED, `role` or `user` entries), `timeout`,
   `onTimeout` (`fail` default, `useDefault` with REQUIRED `default`), `classification`. The step
   provides the implicit output `answer`. Declining fails the step; the first valid answer wins.
2. **Agent requests**: `humanInput` on inline agents and `Agent` manifests with `answerers`,
   `timeout`, `onTimeout` (`return` default, `fail`), `maxRequests`, `classification`. The runtime
   offers a built-in tool; requests are not actions, the data policy applies to the message, and
   answerers are told that an agent asks.
3. **MCP elicitation**: declined unless the agent has `humanInput`; requests whose schema does not
   conform are declined.
4. **Answer schema**: `type: object`, `properties` of primitive fields (`string`, `number`,
   `integer`, `boolean` with `title`, `description`, `enum`, `format`, length and range bounds),
   `required`. No secrets or credentials.
5. **Identity**: answers only from authenticated humans matching `answerers`; never from agents;
   chat answers only if attributable.
6. **Answers are not decisions**: never an approval, never a change of permissions, policies,
   budgets or the manifest.
7. **Audit**: `input.requested`, `input.provided`, `input.declined`, `input.expired`; content of
   messages and answers per `payload` (digest under `payload: metadata`).
8. **Profile**: new `interaction` profile, depending on `core`. Waiting counts against step
   `timeout` and `maxDuration`.

## Examples

```yaml
workflow:
  - id: ask-targets
    type: input
    dependsOn: [analyze]
    input:
      message: "Which environment should the fix go to?"
      answerSchema:
        type: object
        properties:
          environment:
            type: string
            enum: [staging, production]
        required: [environment]
      answerers:
        - role: release-manager
      timeout: 4h
      onTimeout: useDefault
      default:
        environment: staging
  - id: apply
    agent: fixer
    task: "Apply the fix to ${{ steps.ask-targets.outputs.answer }}."
    dependsOn: [ask-targets]
```

```yaml
agents:
  - id: fixer
    model:
      provider: example-provider
      name: example-model
    humanInput:
      answerers:
        - role: maintainer
      timeout: 30m
      maxRequests: 3
```

## Schema changes

New definitions `AnswerField`, `AnswerSchema`, `InputStep`, `HumanInput`; step type `input` with
its conditional branch; `humanInput` on `InlineAgent` and `AgentSpec`. New semantic rules
`input.required-unknown-field`, `input.enum-not-string`, `input.default-mismatch`; `profile.unsupported`
covers the `interaction` profile.

## Conformance impact

- New profile `interaction` (spec 11.2) and its fields in the profile table (spec 3.3).
- New `v1alpha2` cases: valid `5.8-input-step`, `5.8-input-step-free-text`,
  `5.8-agent-human-input`, `5.8-agent-manifest-human-input`; invalid `5.8-input-step-without-input`,
  `5.8-input-step-with-agent`, `5.8-input-without-answerers`, `5.8-use-default-without-default`,
  `5.8-answer-field-nested-object`, `5.8-required-unknown-field`, `5.8-default-mismatch`,
  `5.8-agent-invalid-on-timeout`, `3.3-profile-interaction-step`.
- Runtime tests, once a runtime suite exists: answer validation, answerer identity, expiry
  outcomes, events, declining elicitation.

## Compatibility and migration

Additive. Runtimes that do not implement the `interaction` profile reject manifests that use it
(spec 3.3), as for every profile-bound field.

## Security considerations

- **Not a decision channel.** An answer never grants an approval, even from an approver, so a chat
  reply cannot be used to skip an approval gate.
- **Identity.** Same rules as approvals; agents, tools and remote agents cannot answer.
- **Prompt injection.** An answer is untrusted input to the next model invocation, like a tool
  result. A question composed by a model can exfiltrate data to the answerer, so the data policy
  applies to it, and `maxRequests` limits how often an agent can ask.
- **Secrets.** Answer schemas must not ask for credentials; elicitation requests that do not fit
  the schema subset are declined.

## Privacy considerations

Answers may contain personal data. They carry a `classification`, and audit events store only a
digest under `payload: metadata`.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Extend approvals with comments**: mixes a decision with information and makes approvals
  harder to audit; rejected.
- **Only agent requests, no step type**: declared questions are easier to review and to test, and
  work without a model.
- **Full JSON Schema for answers**: harder to render and to validate; MCP elicitation chose the
  flat subset for the same reason.
- **Chat tools in the agent's tool list**: no identity check, no expiry, no audit; rejected.

## Implementation status

Schema, CustomResourceDefinitions, semantic rules and conformance cases are in this repository. No
runtime behaviour is implemented here.

## Open questions

1. Should an input request support several answers (for example a vote) or only the first?
2. Should a later AEP add redirecting a running agent (new instructions as data) on top of this?
3. Should `answerers` default to the approvers of the workflow?

## Decision

-

## References

- Model Context Protocol, elicitation (`elicitation/create`, requested schema, accept / decline / cancel).
