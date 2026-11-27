---
title: "Triggers and inputs"
description: "How an execution starts and how its parameters are declared and validated."
banner:
  content: "Draft - v1alpha4, the current draft. Fields and semantics may change before v1beta1."
---

```yaml
triggers:
  - type: manual
  - type: schedule
    cron: "0 6 * * 1-5"
    timezone: Europe/Berlin
inputs:
  - name: branch
    type: string
    default: main
    pattern: "^[A-Za-z0-9._/-]+$"
```

- Trigger types: `manual`, `schedule`, `event`. The trigger is recorded in `workflow.started`.
- A `schedule` trigger supplies no input values, so scheduled executions use input defaults; a required input blocks them.
- At a tick while the previous scheduled execution still runs, `concurrencyPolicy` decides: `forbid` (default) skips the tick, `allow` starts another, `replace` cancels the running one. Missed ticks are skipped; with `startingDeadline` the runtime may still start one execution for the latest missed tick within the deadline. Ticks that start no execution emit `trigger.skipped`.
- Inputs are validated before an execution starts. Inputs must not carry secrets; secrets are referenced with `secretRef`.

Normative text: [Triggers](/specification/v1alpha4/#52-triggers), [Inputs](/specification/v1alpha4/#53-inputs).
