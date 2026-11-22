# Decision log

| | |
| --- | --- |
| **Status** | Record of the project owner's decisions. D1 and D2 change how this repository works. All other decisions set the direction of AEPs that are still in `Draft` or `Review`; they do not accept any AEP and do not change `v1alpha1`, except D19, which accepts AEP-0022 and starts the `v1alpha2` draft, and D20, which adds the `v1alpha3` draft and fixes the `v1alpha1` approval step schema. D21 refines D17. |
| **Decided** | 2026-10-10 (D1-D12, D16), 2026-11-18 (D17, D18), 2026-11-19 (D19, D20) and 2026-11-22 (D21) by the project lead |
| **Related** | [AEP process](aep-process.md), [extension prefix list](registry/extension-prefixes.md), [GOVERNANCE.md](../GOVERNANCE.md) |

> Context. AWP is alpha. The owner allows the schema to change where implementation practice shows
> a gap, and fields that are missing to be added. This does not shortcut the AEP process: every
> change still goes through an AEP and is reviewed as described in D16. No implementation has
> special rights over AWP.
>
> Nothing in this log is a conformance claim or a compliance promise. AWP provides
> machine-readable governance primitives that can help organizations implement and enforce their
> own compliance requirements; compliance depends on the implementation, organizational controls
> and applicable regulatory requirements.

## Contents

1. [Decisions](#1-decisions)
2. [Resulting scope of `v1alpha2`](#2-resulting-scope-of-v1alpha2)
3. [Conflicts and how they are resolved](#3-conflicts-and-how-they-are-resolved)

## 1. Decisions

Each entry gives the question, the decision and its consequence. "Applied in" names the files
changed together with the decision. Numbers are never reused; D13-D15 and R1 were decisions about
a single implementation and were removed from this log by D17.

### D1. AEP process adopted

- **Question**: adopt `docs/aep-process.md` before the AEPs move beyond `Draft`? Numbering
  0001-0011 acceptable?
- **Decision**: adopt [docs/aep-process.md](aep-process.md) for AEPs so that changes stay
  traceable. The numbering 0001-0011 is kept.
- **Consequence**: the process is the change process for larger changes. Adopting it is itself a
  substantive change under [GOVERNANCE.md](../GOVERNANCE.md#decision-process) (see conflict C1).
  All eleven AEPs move from `Draft` to `Review`. None is `Accepted`: see D16.
- **Applied in**: `docs/aep-process.md`, `GOVERNANCE.md`, `aep/0000-template.md`, `aep/0001` to
  `aep/0011`.

### D2. JSON Schema is normative for structure

- **Question**: make the schema normative for structure?
- **Decision**: yes. For document structure (field names, types, required fields, closed objects,
  enumerations, patterns) the JSON Schema of an API version is normative. Whether a manifest is
  written as JSON or YAML does not matter: YAML is parsed into the JSON data model (spec 3.1) and
  that value is validated.
- **Consequence**: the specification text stays normative for semantics and runtime behaviour. A
  discrepancy between the two is a defect, fixed by an erratum in whichever artefact is wrong;
  until it is fixed, validators follow the schema for structure. Implementations derive their
  types from the schema, never the other way round; they should pin a copy of the schema and the
  conformance suite by commit and hash and check for drift in CI.
- **Applied in**: `schema/README.md`, `spec/v1alpha1/README.md` (section 2).

### D3. Required extensions are in scope for `v1alpha2`

- **Question**: should `v1alpha2` let a manifest declare which extensions a runtime must
  understand (AEP-0011)?
- **Decision**: yes.
- **Consequence**: implementations that need an extension which restricts behaviour should not
  present a manifest that carries it as portable until AEP-0011 is part of an API version they
  target; from then on they list such extensions in `metadata.requiredExtensions`. AEP-0011 is on
  the critical path, together with AEP-0010 (digest).
- **Applied in**: `aep/0011-required-extensions.md`.

### D4. No prefix wildcards in permissions

- **Question**: confirm "no in-segment wildcards; action groups and publish-time enumeration
  instead" (AEP-0002)?
- **Decision**: confirmed.
- **Consequence**: `jira.get_*` stays invalid. Families of tools are granted through action groups
  that are written out explicitly or enumerated at publish time from a reviewed tool list (with
  AEP-0007: the profiles of an MCP catalog). The open question about prefix wildcards is closed.
- **Applied in**: `aep/0002-tool-argument-constraints.md`.

### D5. `when` uses a restricted expression grammar, not CEL

- **Question**: base `when` on a small, restricted grammar rather than CEL or JSONPath? Bare
  expression or `${{ }}`?
- **Decision**: a restricted grammar defined in AEP-0001, not CEL.
- **Consequence**: the grammar of AEP-0001 section 3.10 is the starting point; roots are the AWP
  roots (`inputs`, `steps.<id>.outputs.<name>`, `event`, `execution.environment`). The field holds
  a bare expression without `${{ }}`.
- **Applied in**: `aep/0001-conditional-steps.md`.

### D6. Executions may succeed with condition skips

- **Question**: may an execution succeed when steps are skipped by a condition?
- **Decision**: yes.
- **Consequence**: success rule of AEP-0001 (every step `succeeded` or `skipped` with reason
  `condition`). A step skipped because a dependency failed still fails the execution.
- **Applied in**: `aep/0001-conditional-steps.md`.

### D7. Own `event` root

- **Question**: `${{ event.* }}` as a new root, or always map events to inputs?
- **Decision**: own root `${{ event.* }}` (AEP-0004).
- **Consequence**: the `Expression` pattern gains the `event` root; converters stop mapping events
  to a workflow input.
- **Applied in**: `aep/0004-event-references.md`.

### D8. `Prompt` and `Playbook` are in `v1alpha2`

- **Question**: `Prompt` and `Playbook` in `v1alpha2` or later; `v1alpha2` scope?
- **Decision**: both kinds are in `v1alpha2`. The scope is in [section 2](#2-resulting-scope-of-v1alpha2).
- **Consequence**: AEP-0005 and AEP-0006 target `v1alpha2`; the examples in AEP-0006 use
  `v1alpha2`. The version becomes later and larger (see [conflict C2](#c2-a-larger-v1alpha2-depends-on-more-reviews)).
- **Applied in**: `aep/0005-prompt-kind.md`, `aep/0006-playbook-kind.md`, `spec/README.md`.

### D9. MCP catalog in the `mcp` profile, aligned with the MCP specification

- **Question**: catalog as part of the `mcp` profile or a separate profile?
- **Decision**: part of the `mcp` profile, and it must follow the Model Context Protocol
  specification: use the MCP terms for tools, tool annotations, resources and authorization
  (OAuth 2.1), define tool definition digests, and align field names with the MCP specification.
  The public MCP specification is read as reference data only.
- **Consequence**: AEP-0007 targets `v1alpha2` and is written around MCP terms: catalog entries
  are keyed by the MCP tool `name`; the governance fields (access class, data clearance, well-known
  actions) are AWP fields next to a pinned copy of the MCP tool definition; MCP annotations such as
  `readOnlyHint` are recorded but never decide the access class; a `toolsDigest` pins the
  definitions; MCP resources get their own (read-only) catalog entries; `auth` on an MCP server
  follows the MCP authorization model. The MCP revision the field names were checked against is
  named in the AEP and must be re-checked by the reviewer (D16).
- **Applied in**: `aep/0007-mcp-connection-catalog.md`.

### D10. Model catalog prices in an own kind, referenced by digest

- **Question**: prices inside manifests or runtime-only?
- **Decision**: own kind `ModelCatalog`, referenced by digest.
- **Consequence**: the reference from `modelPolicy.catalog` carries a **required** `digest`, so a
  workflow names exactly which prices and approvals it was reviewed against. Target `v1alpha3`
  (see [conflict C3](#c3-d10-and-d11-decide-details-but-not-the-target-version)).
- **Applied in**: `aep/0008-model-provider-catalog.md`.

### D11. `contentRetention` is mandatory, with a documented default

- **Question**: retention for audit content?
- **Decision**: `contentRetention` becomes a mandatory field with a documented default value when
  content capture is used.
- **Consequence**: when `audit.payload` is not `metadata`, `contentRetention` MUST be present in
  the manifest. The specification documents `7d` as the default value: authoring tools,
  converters and exporters MUST write `contentRetention: 7d` explicitly when the author did not
  choose a value, and MUST show it to the author. A runtime never applies an implicit retention
  (see [conflict C4](#c4-mandatory-field-with-a-default-value)). Target `v1alpha3`.
- **Applied in**: `aep/0009-audit-payload-levels.md`.

### D12. Neutral list of extension prefixes

- **Question**: where do implementations record the prefixes of their extension fields?
- **Decision**: a neutral, informative list of extension prefixes, open to every implementation,
  hosted in this repository.
- **Consequence**: page [docs/registry/extension-prefixes.md](registry/extension-prefixes.md) with
  listing rules. Implementations document their fields in their own repositories.
- **Applied in**: `docs/registry/extension-prefixes.md`.

### D16. External reviewer before `Accepted`

- **Question**: seek an external reviewer before an AEP becomes `Accepted`?
- **Decision**: yes. The shepherd or reviewer must not be the author; the process lists who or
  which role is needed; no people are invented.
- **Consequence**: [aep-process section 5.1](aep-process.md#51-review-before-acceptance). An AEP
  cannot be accepted by its author or by the project lead alone, also not during alpha. Each AEP
  lists the reviewer roles it needs in its header. Until reviews exist, every AEP stays in
  `Review`.
- **Applied in**: `docs/aep-process.md`, `aep/0000-template.md`, `aep/0001` to `aep/0011`.

### D17. The repository is implementation-neutral

- **Question**: should the repository keep documents about a single implementation (alignment
  matrices, its extension namespace, its migration plan, its implementation page)?
- **Decision**: no. AWP is a specification that runtimes use, not the other way round. The
  repository names no implementation except in the implementations list, which only shows projects
  that have published a conformance statement. The project contact is
  info@agenticworkflowprotocol.org.
- **Consequence**: `docs/alignment/`, `docs/mapping-agents-md.md` and the single implementation
  page were removed; the AEPs describe prior art without naming products; decisions about one
  implementation (D13-D15, R1) were removed from this log. The extension prefix list starts empty.
- **Applied in**: this log, `README.md`, `GOVERNANCE.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  `docs/aep-process.md`, `docs/site-plan.md`, `docs/registry/extension-prefixes.md`,
  `aep/0001` to `aep/0011`, `site/`.
- **Refined by**: D21 (open specifications and vendor-neutral foundation projects may be named as
  prior art).

### D18. Implementation experience goes into AEPs and implementer guidance

- **Question**: how is feedback from runtimes that are built against `v1alpha1` recorded?
- **Decision**: as AEPs for gaps in the specification and as informative implementer guidance on
  the website, both without naming the runtime.
- **Consequence**: new AEPs in `Draft`: AEP-0012 (tool steps), AEP-0013 (runtime clarifications:
  budget metering, value rendering, rejected approvals, the event minimum of `core`) and AEP-0014
  (input examples and object schemas). New informative page on execution placement (executors) and a section with
  implementation notes in "Build your own AWP runtime". Whether the three AEPs join the `v1alpha2`
  scope is decided by an amendment of section 2 once they reach `Review`.
- **Applied in**: `aep/0012` to `aep/0014`, `site/src/content/docs/implementations/`.

### D19. Step iteration goes into `v1alpha2` directly

- **Question**: wait with step iteration until `v1alpha2` is cut with all AEPs of its scope, or
  start `v1alpha2` now with it?
- **Decision**: the project lead accepts AEP-0022 (step iteration, `forEach`) and publishes
  `v1alpha2` now as a **draft**: `v1alpha1` plus AEP-0022. This is an exception to D16 for this
  AEP only: it is accepted without the external review. Reviews are still invited; their findings
  are handled as errata of the draft.
- **Consequence**: `spec/v1alpha2/`, `schema/awp.v1alpha2.json` and conformance cases for
  `forEach` exist; the reference checker selects the schema by `apiVersion`. `v1alpha1` is
  unchanged. The other AEPs of section 2 join the `v1alpha2` draft when they are accepted;
  `v1alpha2` stays a draft (aep-process 6.2) until then.
- **Applied in**: `aep/0022-step-iteration.md`, `spec/v1alpha2/`, `schema/awp.v1alpha2.json`,
  `schema/README.md`, `conformance/`, `spec/README.md`, `docs/aep-process.md`, `site/`.

### D20. The Kubernetes resource model draft becomes `v1alpha3`

- **Question**: pull request #16 proposed a `v1alpha2` draft aligned with the Kubernetes resource
  model (AEPs 0015 to 0021). At the same time `v1alpha2` already existed as the draft with step
  iteration (D19). Which draft is `v1alpha2`, and is the 5-day discussion period of GOVERNANCE.md
  waited for?
- **Decision**: `v1alpha2` stays the draft of D19 (`v1alpha1` plus step iteration). The draft of
  pull request #16 becomes `v1alpha3` and starts from `v1alpha2`, so it has step iteration too
  (section 5.6.5, because 5.6.4 is step outputs there). The pull request is merged now: the owner
  waives the 5-day discussion period for it (alpha waiver of GOVERNANCE.md). AEPs 0015 to 0021 keep
  their numbers and stay `Draft`; the step iteration AEP moves from 0015 to 0022, because the
  numbers of the pull request were public first. The `v1alpha1` approval step fix of the pull
  request (approval steps accept no `requiredFor` and no `separationOfDuties`, spec 5.6.1) is an
  erratum and also applies to `v1alpha2`.
- **Consequence**: three API versions: `v1alpha1`, `v1alpha2` (draft) and `v1alpha3` (draft built
  from Draft AEPs, nothing in it is accepted except step iteration). Each has its own conformance
  suite (`conformance/`, `conformance/v1alpha2/`, `conformance/v1alpha3/`); `awp-check.mjs migrate`
  converts `v1alpha1` and `v1alpha2` manifests to `v1alpha3`. The review of AEPs 0015 to 0021
  (D16) and the questions of the review guide stay open; the discussion continues in issues. The
  side-by-side page of the pull request still says `v1alpha2` for what is now `v1alpha3`.
- **Applied in**: this log, `spec/v1alpha3/`, `schema/awp.v1alpha3.json`, `schema/crd/`,
  `schema/awp.v1alpha2.json`, `spec/v1alpha2/` (5.2 note, example), `conformance/`,
  `aep/0015` to `aep/0022`, `docs/v1alpha3-review-guide.md`, `spec/README.md`, `README.md`, `site/`.

### D21. Open specifications and foundation projects may be named as prior art

- **Question**: D17 says the AEPs describe prior art without naming products. May the
  specification and the AEPs name related open specifications and open-source projects that AWP
  takes ideas from, such as the Open Workflow Specification or a Kubernetes SIG project?
- **Decision**: yes, as sources of ideas and inspiration, not as dependencies. The repository may
  name open specifications and standards (as it already names MCP, A2A, CloudEvents and the
  Gateway API) and vendor-neutral open-source projects hosted by a foundation or a Kubernetes SIG,
  where AWP borrows a concept or wording. It still names no runtime, product or vendor offering
  outside the implementations list (D17). A named project creates no normative reference: AWP
  stays complete without it, and conformance never requires it.
- **Consequence**: spec `v1alpha3` section 1.2 and the README get a related-work paragraph naming
  the Open Workflow Specification (control flow of workflows) and agent-sandbox (isolated
  execution of agent code on Kubernetes). AEPs name such projects in their prior-art text where
  they borrow from them: AEP-0022 (iteration), and the drafts for event triggers and step
  isolation.
- **Applied in**: this log, `spec/v1alpha3/README.md`, `README.md`, `aep/0022-step-iteration.md`.

## 2. Resulting scope of `v1alpha2`

| AEP | Title | Target | Reason |
| --- | --- | --- | --- |
| 0001 | Conditional steps (`when`) | `v1alpha2` | D5, D6 |
| 0002 | Argument constraints, call limits, no prefix wildcards | `v1alpha2` | D4 |
| 0003 | Typed handoffs | `v1alpha2` | scope decision of 2026-10-10 |
| 0004 | Event references | `v1alpha2` | D7 |
| 0005 | Kind `Prompt` | `v1alpha2` | D8 |
| 0006 | Kind `Playbook` | `v1alpha2` | D8 |
| 0007 | MCP catalog (in `mcp`, aligned with MCP) | `v1alpha2` | D8 + D9 |
| 0008 | `ModelCatalog` kind, referenced by digest | `v1alpha3` | D10 |
| 0009 | Audit payload levels, mandatory `contentRetention` | `v1alpha3` | D11 |
| 0010 | Digest canonicalisation | `v1alpha2` | scope decision of 2026-10-10 |
| 0011 | Required extensions | `v1alpha2` | D3 |
| 0012 | Tool steps | proposed for `v1alpha2`, not yet in scope | D18 |
| 0013 | Runtime clarifications | proposed for `v1alpha2`, not yet in scope | D18 |
| 0014 | Input examples and object schemas | proposed for `v1alpha2`, not yet in scope | D18 |
| 0022 | Step iteration (`forEach`) | `v1alpha2`, in the draft since 2026-11-19; also in the `v1alpha3` draft | D19, D20 |
| 0015-0021 | Kubernetes resource model, schedule semantics, human input, step outputs, `WorkflowRun`, execution pinning, extension model | proposed for `v1alpha3`, in its draft but not accepted | D20 |

Since D19 `v1alpha2` exists as a draft. It is completed (no longer a draft) when every AEP in its
scope is `Accepted` and written into it, or explicitly moved to a later version by an amendment to
this table (an AEP that does not find a reviewer must not block the others).

## 3. Conflicts and how they are resolved

### C1. Adoption of the process versus the current decision rules

D1 and D2 change how decisions are made. The process in force before (GOVERNANCE.md) requires at
least 5 working days of public discussion for substantive changes. Resolution: the owner waived
the 5-day period for that change (alpha, no third party depends on the schema yet; recorded under
the "Alpha waiver" in GOVERNANCE.md). No AEP changes status beyond `Review` until the external
review (D16) has happened.

### C2. A larger `v1alpha2` depends on more reviews

D8 and D9 add AEP-0005, 0006 and 0007 to `v1alpha2`; D16 requires an external review before any of
them is accepted. Resolution: the scope table allows moving a single AEP to `v1alpha3` by an
amendment, so that `v1alpha2` is not blocked by the AEP with the slowest review.

### C3. D10 and D11 decide details, but not the target version

D8 lists the `v1alpha2` scope without AEP-0008 and AEP-0009, while D10 and D11 decide their
content. Resolution: both target `v1alpha3`; their content follows D10 and D11. Moving them into
`v1alpha2` is an amendment of the scope table, not a new decision.

### C4. Mandatory field with a default value

A field that is mandatory has no default in the usual sense. Resolution (D11): the field is
required in the manifest; the specification documents `7d` as the value that tools write
explicitly when the author does not choose one. Runtimes never assume a retention.

### C5. Self-acceptance versus the external reviewer

AEPs could in principle be accepted by the project lead during alpha. D16 requires an external
reviewer, and aep-process requires a Final Comment Period of at least 10 working days. Resolution:
no self-acceptance; AEPs are in `Review` and record the needed reviewer roles.

### C7. MCP terms are external reference data

D9 asks to align names with the MCP specification, which is maintained elsewhere and changes by
revision. Resolution: AEP-0007 names the MCP revision its terms were checked against, copies no
normative MCP text, and treats a later MCP revision as a reason for an erratum or a new AEP, never
as an automatic change.
