# Changelog

All notable changes to this repository are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
repository adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Specification
API versions (`v1alpha1`, ...) are versioned separately, see [GOVERNANCE.md](GOVERNANCE.md).

## [Unreleased]

### Changed

- The repository is implementation-neutral (decision D17): implementation-specific alignment documents, mappings and the single implementation page were removed, the AEPs describe prior art without naming products, the extension prefix list starts empty, and the project contact is info@agenticworkflowprotocol.org. Repository links point to `agenticworkflowprotocol/agenticworkflowprotocol.org`.
- Extension prefix list: two more conventions (a field sits on the object it modifies; each field is documented as safe to ignore or critical, with its planned successor).
- AEP process adopted (`docs/aep-process.md`, owner decision of 2026-10-10, in force with the merge after the 5-working-day discussion period): AEPs need a reviewer who is not an author and, while all maintainers belong to one organisation, an external one (new section 5.1); no self-acceptance, also during alpha. New section 7.0 defines when an implementation may say "AWP `<version>` schema conformant (alpha)": the conformance suite passes against its validator and its real exports in public CI; until then the wording is "built to the AWP schema, conformance in progress (alpha)".
- The JSON Schema is normative for document structure; the specification text stays normative for semantics and runtime behaviour (`schema/README.md`, spec `v1alpha1` section 2, `GOVERNANCE.md`).
- AEPs 0001-0011 moved from `Draft` to `Review` with reviewer roles and the owner's decisions; targets: 0001-0007, 0010, 0011 for `v1alpha2`, 0008 and 0009 for `v1alpha3`. AEP-0007 rewritten around Model Context Protocol terms (tool definitions and definition digests, resources, OAuth 2.1 authorization with resource indicators) within the `mcp` profile; AEP-0008 requires the `ModelCatalog` digest; AEP-0009 makes `contentRetention` mandatory with the documented default `7d`. None is accepted.
- Docs: `GOVERNANCE.md`, `CONTRIBUTING.md` and the AEP process describe how changes are really
  reviewed (independent review agent, no guarantee of a human read before merge).
- Website: restyled as a documentation site (introduction page at `/`, sidebar with version label, on-this-page table of contents, prev/next links, mobile drawer, scrollable tables and code blocks); the marketing homepage was removed and its content moved into the docs pages.

### Added

- Proposed (Draft, not accepted) AEPs from implementation experience with `v1alpha1` (decision D18): `aep/0012` tool steps (a step that performs one declared action without a model), `aep/0013` runtime clarifications (metering of budgets known only after a call, rendering of non-string values in expressions, the outcome of a rejected action approval, the minimum events of `core`), `aep/0014` input examples and object schemas. They do not change `v1alpha1`.
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
