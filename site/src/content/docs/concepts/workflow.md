---
title: "Workflow steps and execution model"
description: "Steps, dependsOn, command steps and the execution model."
banner:
  content: "Draft - v1alpha4, the current draft. Fields and semantics may change before v1beta1."
---

```yaml
workflow:
  - id: fix
    agent: fixer
  - id: test
    type: command
    command: npm test
    dependsOn:
      - fix
```

1. Cycles, duplicate step ids and unknown references are rejected.
2. A step is ready when all steps in `dependsOn` have succeeded; ready steps may run concurrently within `maxConcurrency`.
3. If a step fails after its retries, everything that depends on it is skipped.
4. Step statuses: `pending`, `running`, `waitingForApproval`, `waitingForInput`, `succeeded`, `failed`, `skipped`, `cancelled`.
5. Declared outputs of a step are available to dependent steps through expressions. Command steps write them as files to `$AWP_OUTPUTS`; outputs of a failed attempt are discarded ([Step outputs](/specification/v1alpha4/#564-step-outputs)).
6. An agent or command step can run once per item of a list with `forEach` ([Iteration](/specification/v1alpha4/#565-iteration)).

Normative text: [Workflow steps](/specification/v1alpha4/#56-workflow-steps), [Execution model](/specification/v1alpha4/#563-execution-model).
