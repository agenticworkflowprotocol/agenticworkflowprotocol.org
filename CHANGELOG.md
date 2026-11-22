# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
repository adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Specification
API versions (`v1alpha1`, ...) are versioned separately, see [GOVERNANCE.md](GOVERNANCE.md).

## [Unreleased]

### Fixed

- Schema `v1alpha2`: the same approval step fix as in `v1alpha1`, and the editorial note on schedule inputs in spec section 5.2.

- Schema `v1alpha1`: an approval step (`type: approval`) no longer accepts `requiredFor` and `separationOfDuties`; spec section 5.6.1 lists only `approvers`, `minApprovals`, `timeout`, `onTimeout` and `message` (new definition `ApprovalStep`, two conformance cases).
- Spec `v1alpha1` section 5.2 (editorial): a `schedule` trigger supplies no input values, so a workflow with a required input cannot be started by it. The conformance case `5.2-triggers`, the `invoice-processing` example and the triggers page of the website relied on that combination and were corrected; the reference checker reports it as the warning `lint.schedule-required-input`.

### Changed

- README: the minimal manifest is now valid under all profiles (classification, declared MCP server, explicit tools and permissions).
- Conformance case `3.2-unsupported-api-version` uses `awp.agenticworkflowprotocol.org/v9`, because `v1alpha3` is now a supported version of the reference checker.
- The repository is implementation-neutral (decision D17): implementation-specific alignment documents, mappings and the single implementation page were removed, the AEPs describe prior art without naming products, the extension prefix list starts empty, and the project contact is info@agenticworkflowprotocol.org. Repository links point to `agenticworkflowprotocol/agenticworkflowprotocol.org`.
- Extension prefix list: two more conventions (a field sits on the object it modifies; each field is documented as safe to ignore or critical, with its planned successor).
- AEP process adopted (`docs/aep-process.md`, owner decision of 2026-10-10, in force with the merge after the 5-working-day discussion period): AEPs need a reviewer who is not an author and, while all maintainers belong to one organisation, an external one (new section 5.1); no self-acceptance, also during alpha. New section 7.0 defines when an implementation may say "AWP `<version>` schema conformant (alpha)": the conformance suite passes against its validator and its real exports in public CI; until then the wording is "built to the AWP schema, conformance in progress (alpha)".
- The JSON Schema is normative for document structure; the specification text stays normative for semantics and runtime behaviour (`schema/README.md`, spec `v1alpha1` section 2, `GOVERNANCE.md`).
- AEPs 0001-0011 moved from `Draft` to `Review` with reviewer roles and the owner's decisions; targets: 0001-0007, 0010, 0011 for `v1alpha2`, 0008 and 0009 for `v1alpha3`. AEP-0007 rewritten around Model Context Protocol terms (tool definitions and definition digests, resources, OAuth 2.1 authorization with resource indicators) within the `mcp` profile; AEP-0008 requires the `ModelCatalog` digest; AEP-0009 makes `contentRetention` mandatory with the documented default `7d`. None is accepted.
- Docs: `GOVERNANCE.md`, `CONTRIBUTING.md` and the AEP process describe how changes are really
  reviewed (independent review agent, no guarantee of a human read before merge).
- Website: restyled as a documentation site (introduction page at `/`, sidebar with version label, on-this-page table of contents, prev/next links, mobile drawer, scrollable tables and code blocks); the marketing homepage was removed and its content moved into the docs pages.

### Added

- Decision D21 (refines D17): open specifications and vendor-neutral foundation projects may be named as prior art, not as dependencies. Spec `v1alpha3` section 1.2 and the README name the Open Workflow Specification and agent-sandbox as related work; AEP-0022 names the `for` task of the Open Workflow Specification as prior art.
- Decision D20: the Kubernetes resource model draft of pull request #16 becomes `v1alpha3` and starts from `v1alpha2`; the 5-day discussion period is waived for it. `v1alpha3` has step iteration as section 5.6.5, combined with the step output interface: each item run produces its outputs through `$AWP_OUTPUTS` or `complete_step`, command steps get `AWP_FOREACH_INDEX`, an output referenced by `forEach.items` is parsed as a JSON array, and `forEach` is not allowed on input steps (section 14.2 lists the changes from `v1alpha2`).
- Conformance suite for `v1alpha2` (`conformance/v1alpha2/`): the `v1alpha1` cases with apiVersion `v1alpha2` plus the step iteration cases; the `v1alpha3` suite has the step iteration cases too. `awp-check.mjs migrate` also converts `v1alpha2` manifests.
- Website: `v1alpha3` as a proposed draft next to `v1alpha1` and `v1alpha2`.

- API version `v1alpha2` as a draft: `v1alpha1` plus step iteration (`forEach`, AEP-0022, accepted by lead decision D19 without external review). New `spec/v1alpha2/` (section 5.6.4, references `forEach.item`, `forEach.item.<key>` and `forEach.index`, changes listed in section 14.1), `schema/awp.v1alpha2.json` (`$defs/ForEach`), semantic rules `expr.iteration-outside-forEach`, `forEach.input-not-array` and `forEach.concurrency-exceeds-budget`, nine conformance cases (suite 0.2.0) and the example `image-review.workflow.yaml`. `v1alpha1` is unchanged.
- Reference checker: picks the schema by `apiVersion` (unknown versions are checked against the latest schema) and validates the examples of every API version.
- `v1alpha3` draft: step output interface, kind `WorkflowRun` with status conditions, and pinning of executions, proposed by `aep/0018-step-outputs.md`, `aep/0019-workflow-run-and-status.md` and `aep/0020-execution-pinning.md` (Draft, not accepted). Command steps write outputs as files to `$AWP_OUTPUTS`, agent steps complete with `complete_step`, minimum output sizes, outputs of failed attempts are discarded, output names are restricted to file-safe identifiers and `AWP_` variables are reserved (spec 5.6.4, rule `step.reserved-env`). New section 3.11 defines `status.conditions` in the shape of `metav1.Condition` with the conditions `Valid` and `Ready`; new section 10.8 defines `WorkflowRun` (request and status of one execution); section 10.1 pins an execution to the manifests it started with and requires the workflow digest in `workflow.started`. New CRD `schema/crd/workflowruns.yaml`, typed `status` and condition columns in all CRDs, 9 new conformance cases and the example `vulnerability-fixer.run.yaml`; container images referenced by tag are resolved to digests when an execution starts and pinned, and a runtime that cannot run an image rejects the workflow.
- `docs/runtime-feedback.md`: working list of gaps reported by a Kubernetes runtime proof of concept (G01 to G39), with their status and open questions.
- `aep/0021-extension-model.md` (Draft, concept, not applied): extension model aligned with the Kubernetes Gateway API (support levels and named features, `extensionRef` at defined extension points, domain-prefixed values, policy attachment with `targetRefs`, runtime bindings, CRDs with pruning and CEL); it would replace `extensions` objects, AEP-0011 and the prefix list.
- `docs/v1alpha3-review-guide.md`: what to read in the `v1alpha3` draft, the reasons for each change, where it touches existing decisions, and the open questions for the project lead.

- Working draft `v1alpha3` (`spec/v1alpha3`, `schema/awp.v1alpha3.json`) with the Kubernetes resource model alignment proposed in `aep/0015-kubernetes-resource-model.md` (Draft, not accepted): `metadata` holds only Kubernetes `ObjectMeta` fields and DNS-1123 names, the governance fields (`version`, `owner`, `classification`, `risk`, `integrity`, ...) are in `spec`, extension fields are keys of `extensions` objects, `owner` and policy conditions have one type, `status` is reserved, and the digest covers `apiVersion`, `kind`, `metadata.name` and `spec`. New section 3.10 on object stores and the Kubernetes binding. Other AEPs for `v1alpha3` are not applied yet.
- Kubernetes CustomResourceDefinitions for `v1alpha3` (`schema/crd/`), generated from the JSON Schema by `conformance/crd.mjs`; `npm test` fails when they are stale.
- `v1alpha3`: schedule semantics (`concurrencyPolicy` with default `forbid`, `startingDeadline`, missed ticks skipped by default, event `trigger.skipped`; `aep/0016-schedule-semantics.md`) and human input (input steps, agent requests with `humanInput`, answer schema from MCP elicitation, profile `interaction`, events `input.*`; `aep/0017-human-input.md`). Both Draft, not accepted.
- Conformance suite for `v1alpha3` (`conformance/v1alpha3/`), the reference checker selects the schema by `apiVersion`, and `awp-check.mjs migrate` converts `v1alpha1` manifests to `v1alpha3`.
- Proposed (Draft, not accepted) AEPs from implementation experience with `v1alpha1` (decision D18): `aep/0012` tool steps (a step that performs one declared action without a model), `aep/0013` runtime clarifications (metering of budgets known only after a call, rendering of non-string values in expressions, the outcome of a rejected action approval, the minimum events of `core`), `aep/0014` input examples and object schemas. They do not change `v1alpha1`.
- AWP logo: brand assets in light and dark (`site/public/brand/`, served at `/brand/`), logo in the site header and the README, new favicons and social preview image.
- Website header: links to the validator, the editor and the viewer next to GitHub; footer link to the viewer.
- Links to the AWP editor and viewer ([online](https://editor.agenticworkflowprotocol.org), [Web Components](https://github.com/agenticworkflowprotocol/awp-editor)) in the README, the introduction, the Quickstart, the sidebar and the footer.
- Links to the reference validator ([online](https://validator.agenticworkflowprotocol.org), [CLI and library](https://github.com/agenticworkflowprotocol/awp-validator)) in the README, the introduction, the Quickstart, "Build your own AWP runtime", the sidebar and the footer.
- Website: concept page "Extending AWP" (extension fields, refinement with core fields, runtime-defined parts, the path into the core through AEPs, and what is rejected).
- Website: informative page on execution placement (executors) and implementation notes in "Build your own AWP runtime".
- Decision log (`docs/decisions.md`): the owner's decisions with consequences and conflicts.
- Informative, implementation-neutral list of extension prefixes (`docs/registry/extension-prefixes.md`), open to every implementation.
- Proposed (Draft, not accepted) AWP Enhancement Proposals `aep/0001` to `aep/0011`: conditional steps, argument constraints and call limits in permissions (no prefix wildcards), typed handoffs, event references, kind `Prompt`, kind `Playbook`, MCP connection catalog, model and provider catalog, audit payload levels, digest canonicalisation and required extensions. They do not change `v1alpha1`.
- Website (`site/`): Astro Starlight site with homepage, concept, governance, security, integration, example and implementation pages, the specification rendered from `spec/`, offline Pagefind search, dark/light themes, link check, size budget and accessibility check, and a GitHub Pages workflow (`.github/workflows/pages.yml`).
- Website: Quickstart page and `llms.txt` / `llms-full.txt` generated at build time.

- Repository scaffold: README, licenses (CC BY 4.0 for specification text, Apache-2.0 for code),
  Code of Conduct, contributing guide with DCO, governance, security policy, issue and pull request
  templates, `CNAME` for `agenticworkflowprotocol.org`.
- Draft specification `v1alpha1` (`spec/v1alpha1`): document model, kinds `Workflow`, `Agent` and
  `Policy`, governance, policy evaluation, supply chain integrity, audit and traceability,
  conformance profiles, glossary and nine examples.
- Documentation site plan (`docs/site-plan.md`).
- JSON Schema (draft 2020-12) for manifests of `v1alpha1` (`schema/awp.v1alpha1.json`) with entry
  points for `Workflow`, `Agent` and `Policy`, and a catalogue of the semantic validation rules
  that JSON Schema cannot express (`schema/README.md`).
- Conformance suite for validators (`conformance/`): 28 valid and 141 invalid manifests (one rule
  per file, named after the specification section), a machine-readable test index
  (`conformance/index.json`) and a reference checker (`npm test`) with pinned development
  dependencies (`ajv`, `yaml`).
- Command-line output formats for `awp validate`, `awp lint`, `awp simulate`, `awp plan`, `awp run`
  and `awp audit`, including diagnostics, exit codes and the plan output (`docs/cli.md`).
- Draft proposal for AWP Enhancement Proposals (`docs/aep-process.md`, not adopted): AEP lifecycle, numbering, template (`aep/0000-template.md`), versioning rules for API versions and repository releases, and rules for a future conformance mark (self-certification, test suite, revocation). No mark or certification exists.

### Changed

- Specification section 11.4 links to the CLI output format document instead of announcing it.

[Unreleased]: https://github.com/agenticworkflowprotocol/agenticworkflowprotocol.org/commits/main
