# AEP-0013: Runtime clarifications from implementation experience

| | |
| --- | --- |
| **AEP** | 0013 |
| **Title** | Runtime clarifications from implementation experience |
| **Authors** | AI agent on behalf of @weisser-dev |
| **Shepherd** | Project lead (proposed; not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer, security reviewer. None identified yet; an external review is required before `Accepted` ([aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)). |
| **Owner decisions** | [D18](../docs/decisions.md#d18-implementation-experience-goes-into-aeps-and-implementer-guidance) (2026-11-18) |
| **Target API version** | `v1alpha2` (proposed, not yet in scope) |
| **Profiles affected** | `core`, `governance`, `mcp` |
| **Created** | 2026-11-18 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Six places where `v1alpha1` leaves runtime behaviour open, found while building a runtime against
it. Each item states the gap, the proposed normative text and the behaviour that a runtime has to
choose today. None adds a manifest field except `approval.onReject` (item 3).

1. Budgets that are only known after a call (`maxTokens`, `maxCostUsd`).
2. Rendering of non-string values and of missing values in expression-enabled strings.
3. The outcome of a rejected action approval, and approvals required by the runtime.
4. The minimum events of the `core` profile.
5. Rejecting valid manifests for deployment policy.
6. Binding a declared MCP server to a configured connection.

## Motivation

Two runtimes that both follow `v1alpha1` can behave differently in each of these cases, and some
of the choices change governance results: whether a budget can be overrun, whether an execution
continues after a human said no, whether a manifest's server URL is honoured. The specification
should decide them, or say explicitly that the runtime decides and must document it.

## Goals and non-goals

- Goals: deterministic, fail-closed rules for the six cases; no new concepts.
- Non-goals: new budget kinds, a new event model, changes to the approval UI.

## Specification

### 1. Metered limits (section 5.7)

Add after "The runtime MUST check limits before each model invocation and each action":

- `maxSteps` and `resources.maxToolCalls` are counted exactly: the invocation or action that would
  make the count exceed the limit MUST NOT start.
- `resources.maxTokens` and `maxCostUsd` are known only after an invocation. The runtime MUST NOT
  start a model invocation when the usage so far has reached the limit. It SHOULD also not start
  it when a known upper bound of the invocation (for example the requested maximum of output
  tokens plus the counted input tokens) would exceed the remaining budget. An invocation that was
  allowed MAY overrun the limit; the runtime MUST then stop the execution as for any exceeded
  limit and MUST report the actual usage.
- Usage MUST be counted from the runtime's own records of invocations and actions (for example at
  the model and tool proxy), not from figures reported by the process that executes the steps.
- When `maxCostUsd` applies and the cost of an invocation can be determined neither from the
  provider nor from a configured price, the runtime MUST NOT start the invocation (fail closed)
  and MUST fail the execution with `reason: budgetExceeded`, `limit: maxCostUsd` and
  `costKnown: false`. Counting unknown cost as zero is not allowed.

### 2. Value rendering (section 3.9)

Add:

- When an expression in an expression-enabled string references a value that is not a string, the
  value is inserted as its JSON serialization without insignificant whitespace (numbers and
  booleans as their JSON text, objects and arrays as JSON).
- A reference to a declared output or an input that has no value at evaluation time (an optional
  input without `default`, an output the step did not produce) is an evaluation error: the step
  fails with reason `missingValue`. Runtimes MUST NOT insert an empty string.

### 3. Rejected approvals (section 7.6)

`approval` gains:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `onReject` | string | `fail` (default) or `continue`. `fail`: a rejected action fails its step with reason `approvalRejected`; dependent steps are skipped (section 5.6.3) and the execution fails. `continue`: the action is not executed, the agent receives a tool result that states the rejection (without the approver's comment unless `payload` allows content), and the step continues. |

Add:

- `onTimeout: reject` follows `onReject`.
- A runtime MAY show a distinct status for executions that ended because of a rejection, but in
  AWP events the execution status is `failed` with `reason: approvalRejected`.
- When an execution ends (any status), the runtime MUST close every open approval request of that
  execution, emit `approval.expired` for each, and MUST NOT accept a decision on it afterwards.
- Runtimes MAY require approval for actions that the manifest does not list (for example every
  action classified as write in their tool catalog). Such approvals follow the same rules as
  approvals from `requiredFor`, including `onReject`, and are recorded with `source: runtime` in
  `approval.requested`. This does not need the `governance` profile.

### 4. Events of the `core` profile (section 11.2)

Replace "emit `workflow.*` events to a log" with:

- emit `workflow.started`, `workflow.completed`, `workflow.failed` and `workflow.cancelled` with the
  envelope fields `id`, `type`, `time`, `executionId`, `workflow` and `actor` of section 10.3 and
  the required `data` of section 10.4, to a log that the operator can read;
- in particular `workflow.failed` with `reason: budgetExceeded` and `limit` (section 5.7) and with
  `reason: approvalRejected` (item 3).

All other event types, `payload` modes, integrity modes, decision and reproducibility records stay
in the `audit` profile. Runtimes MAY keep their own event format in addition.

### 5. Deployment policy (sections 3.3 and 11.3)

Add to section 3.3:

- A runtime MAY reject a valid manifest because of a rule of its deployment that is stricter than
  this specification (for example: every MCP tool source MUST list `tools`; every MCP server MUST
  be a configured connection). The diagnostic MUST name the field and the rule. Such rules MUST
  NOT accept a manifest that this specification rejects, and MUST NOT make the runtime execute a
  manifest with fewer restrictions.

Add to the conformance statement of section 11.3:

| Field | Description |
| ----- | ----------- |
| `deploymentPolicies` | OPTIONAL list of rules of item 5, one sentence each. They are not limitations; a profile can be claimed with them. |

### 6. Server binding (section 5.5.1)

Add:

- When a manifest declares a server in `spec.mcpServers` and the runtime binds the name to a
  connection of its own configuration, the declared `url` MUST equal the URL of that connection
  (after removing a trailing `/`); otherwise the runtime MUST reject the manifest. A runtime MUST
  NOT call a different endpoint than the one the manifest declares.
- Bindings of undeclared servers by name are recorded in the reproducibility record
  (section 10.7) with the URL that was used.

## Examples

```yaml
spec:
  budget:
    maxCostUsd: 2.00
    resources:
      maxTokens: 200000
      maxToolCalls: 30
  approval:
    requiredFor: [git.merge]
    approvers:
      - role: maintainer
    timeout: 4h
    onTimeout: reject
    onReject: fail
```

With these rules, a rejected merge fails the step that requested it, skips its dependents, fails
the execution with `reason: approvalRejected`, and closes any other open approval of the
execution.

## Schema changes

- `approval.onReject` (`fail`, `continue`) in the approval object of `spec.approval` and of
  approval steps (ignored for approval steps, which already fail when rejected).
- Conformance statement: `deploymentPolicies`.
- No other structural change.

## Conformance impact

- `core`: items 1, 2, 4, 5; `governance`: item 3; `mcp`: item 6.
- New valid case: `valid/7.6-approval-on-reject.yaml`; invalid case:
  `invalid/7.6-approval-on-reject-unknown-value.yaml`.
- Runtime tests (once a runtime suite exists): metered overrun stops the execution; unknown cost
  with `maxCostUsd` fails closed; missing value fails the step; rejection with `onReject: fail`;
  open approvals closed at the end; URL mismatch rejected.

## Compatibility and migration

- Items 1, 2, 4 and 6 tighten behaviour that `v1alpha1` left open. Runtimes that count unknown
  cost as zero, insert empty strings for missing values or call a configured endpoint that differs
  from the declared URL change behaviour.
- Item 3: the default `fail` is the stricter reading of `v1alpha1`; manifests that relied on the
  agent continuing after a rejection set `onReject: continue`.

## Security considerations

- Items 1 and 6 close fail-open paths (budget overruns through unknown cost, silent redirection to
  another endpoint).
- Item 3 makes a human "no" end the dependent work by default and prevents late decisions on
  requests of finished executions.
- Item 2 prevents tasks and arguments built from silently empty values.

## Privacy considerations

The rejection message in item 3 does not carry the approver's comment to the model unless the
audit `payload` mode allows content.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **One AEP per item**: cleaner history, but six small AEPs with the same reviewers. The items can
  be split during review if one of them blocks the others.
- **Leave the choices to runtimes and require documentation**: keeps manifests portable in syntax
  only; governance results would still differ.
- **`onReject: continue` as default**: closer to a literal reading of `v1alpha1`, but fails open
  when the agent retries the action with other arguments.

## Implementation status

At least one runtime in progress behaves as proposed in items 1 (usage from its own proxy records,
denial once the limit is reached), 3 (rejection ends the execution, open approvals are closed,
approvals for write tools come from its tool catalog), 5 (explicit tool lists required) and 6 (URL
must equal the bound connection). It differs in item 2 (missing values render as empty text) and
item 4 (own event format, no `workflow.*` events), and counts unknown cost as zero. No
implementation of this AEP exists.

## Open questions

1. Item 1: should a runtime be allowed to reserve budget before an invocation instead of checking
   after it?
2. Item 3: should `onReject` also exist per entry of `requiredFor`?
3. Item 5: should deployment policies be machine-readable (rule identifiers) for `awp lint`?

## Decision

Draft. Not in the `v1alpha2` scope until an amendment of the [scope table](../docs/decisions.md#2-resulting-scope-of-v1alpha2).

## References

- Spec sections 3.3, 3.9, 5.5.1, 5.7, 7.6, 10.3, 10.4, 10.7, 11.2, 11.3.
- AEP-0003, AEP-0007, AEP-0012.
