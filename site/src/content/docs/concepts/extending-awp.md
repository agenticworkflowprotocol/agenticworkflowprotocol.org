---
title: "Extending AWP"
description: "How implementations and organisations extend and refine AWP: extension fields, stricter rules, runtime-defined parts and the path into the core."
banner:
  content: "Draft - v1alpha1. Fields and semantics may change before v1beta1."
---
AWP is meant to be extended and refined. The core stays small and vendor-neutral; implementations and organisations add what they need on top. One rule limits every extension: **it may add or restrict, never weaken.** A manifest that passed review must not do more on another runtime than its authors expected.

There are four ways to extend AWP, from local to standard.

## 1. Extension fields (`x-`)

Any object in a manifest may carry fields whose name starts with `x-` ([spec 3.3](/specification/v1alpha1/#33-unknown-fields-and-extensions)).

```yaml
workflow:
  - id: review
    agent: reviewer
    x-example-reviewChecklist: security-v2
```

- A runtime that understands the field interprets it; every other runtime ignores it.
- An extension MUST NOT weaken a requirement of the specification.
- Extension values are part of the manifest digest, so changing one needs a new `metadata.version`.
- Use one prefix per implementation (`x-<prefix>-<name>`, lowerCamelCase), put the field on the object it modifies, and record the prefix in the [extension prefix list](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/docs/registry/extension-prefixes.md) so that names do not collide.

**Safe to ignore or critical.** A field that only adds information (a description, a UI hint, an example value) is safe for other runtimes to ignore. A field that restricts behaviour (an argument constraint, an output schema, a placement requirement) is critical: a runtime that ignores it runs the manifest with fewer restrictions. Until [AEP-0011](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0011-required-extensions.md) adds `metadata.requiredExtensions`, a manifest with critical extensions is not portable, and its authors should say so.

## 2. Refinement with core fields

Many refinements need no extension, because AWP lets every level only narrow what the level above allows:

- **Budgets** on workflow, agent and step: the effective limit is the minimum ([spec 5.7](/specification/v1alpha1/#57-budgets-and-resources)).
- **Permissions** on workflow and agent: an action needs both; `allow: false` wins ([spec 7.5](/specification/v1alpha1/#75-tool-governance-permissions)).
- **Action groups** map concrete tools to well-known actions, so rules can be written once for `git.merge` or `production.deploy` ([spec 5.5.4](/specification/v1alpha1/#554-action-groups)).
- **`Policy` manifests** hold an organisation's own rules (deny, require approval, data and model conditions) and are included by workflows ([spec 8](/specification/v1alpha1/#8-kind-policy-and-policy-evaluation), `governance` profile).

## 3. Runtime-defined parts

Some things are deliberately left to the runtime, so that the manifest stays portable:

- binding MCP servers that a manifest does not declare ([spec 5.5.1](/specification/v1alpha1/#551-mcp-servers));
- built-in tools and their action identifiers ([spec 5.5.2](/specification/v1alpha1/#552-tool-sources));
- where steps run ([execution placement](/implementations/execution-placement/));
- additional audit event types with a reverse-domain prefix, for example `com.example.cache.hit` ([spec 10.4](/specification/v1alpha1/#104-event-types));
- rules of a deployment that are stricter than the specification, for example "every MCP tool source lists its tools". A runtime may reject a valid manifest for such a rule if the diagnostic names it; it may never execute a manifest with fewer restrictions.

## 4. Into the core: AEPs

When an extension proves useful beyond one runtime, it becomes a proposal ([AEP process](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/docs/aep-process.md)). The usual path is:

1. A runtime ships an `x-<prefix>-` field and documents it as safe to ignore or critical.
2. An AEP proposes the core field, with the experience of that runtime as motivation.
3. Once the AEP is part of an API version the runtime supports, the runtime writes the core field and reads the extension for one more release with a deprecation warning.

Examples in progress: tool steps ([AEP-0012](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0012-tool-steps.md)), typed handoffs ([AEP-0003](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0003-typed-handoffs.md)), argument constraints ([AEP-0002](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0002-tool-argument-constraints.md)), input examples ([AEP-0014](https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/blob/main/aep/0014-input-examples-and-schemas.md)).

## What does not work

- **Unknown fields without `x-`** are rejected. A typo in a governance field must not be silently ignored (fail closed).
- **Fields of a profile the runtime does not support** are rejected with an error that names the field and the profile; the runtime must not run the rest.
- **Changing the meaning of a core field** through an extension, for example an `x-` flag that turns `default: deny` into allow, is not allowed.

## Check it

The reference checker validates manifests with extensions like any other: YAML restrictions, JSON Schema and semantic rules, optionally limited to the profiles a runtime supports.

```sh
node conformance/awp-check.mjs check --profiles core,mcp workflow.yaml
```

See the [Quickstart](/getting-started/quickstart/) for the setup.
