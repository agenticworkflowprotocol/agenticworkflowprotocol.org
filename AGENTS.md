# Agent instructions for agenticworkflowprotocol.org

See README for other guidelines.

## New API versions

Applies whenever a new API version (`v1alpha4`, `v1beta1`, ...) is added, and whenever an existing
version becomes the current draft (as `v1alpha3` did with decision D22). A version is only done
when the specification, the reference validator and the editor support it together.

**1. Older versions stay backwards compatible.** A new version is added next to the older ones; it
never changes them.

- `schema/awp.<old>.json`, `spec/<old>/`, the conformance suites of older versions and their
  examples are unchanged. Check with `git diff origin/main -- schema/awp.<old>.json spec/<old> conformance`
  (only the new suite and the files of the new version may change). An erratum of an older version
  is its own commit, named as an erratum in the CHANGELOG.
- `npm test` passes for every version: the reference checker still knows all older `apiVersion`s,
  and a manifest is always validated against the schema of its own `apiVersion`, never the newest.
- `node conformance/awp-check.mjs migrate` converts every older version to the new one, and the
  migrated examples of every older version validate against the new schema. Changes that
  `migrate` cannot do mechanically are listed in the spec (section 14) and on the website
  ("Migrating to ...").
- Nothing that worked for an older version may stop working in a tool: older versions stay in the
  version lists of the validator and the editor, with their tests.

**2. Extend the validator and the editor in the same change.** Check out both repositories next to
this one, on a new branch from `origin/main`:

```sh
git clone https://github.com/agenticworkflowprotocol/awp-validator ../awp-validator
git clone https://github.com/agenticworkflowprotocol/awp-editor ../awp-editor
```

- `awp-validator`: add the version to `API_VERSIONS` in `src/versions.js` (oldest first), copy the
  artefacts with `node scripts/sync-spec.mjs ../agenticworkflowprotocol.org` (never edit
  `vendor/` by hand; review the diff), add the schema import in `src/browser.js`, the export
  `./schema/<version>.json` in `package.json`, the type in `types/index.d.ts` and tests that run its
  conformance suite. If it becomes the current draft, also set `API_VERSION`, the default `schema`
  (`src/index.js`, `src/browser.js`, `./schema.json`) and the starter manifest in `site/app.js`.
- `awp-editor`: render the new fields (`src/model/`, `src/ui/`), add the version where the model
  distinguishes layouts (for example `KRM_VERSIONS` in `src/model/index.js`), add its examples to
  `EXAMPLE_SETS` in `scripts/build.mjs` and tests in `test/`. If it becomes the current draft, it
  is the example set at `examples/` and the starter in `site/app.js`; older sets move to
  `examples/<version>/`.
- Both: update `README.md`, add a CHANGELOG section and bump `version` in `package.json` (a changed
  default is a breaking change). Run `npm test` in each repository. Pushing a new version to
  `main` publishes it, so release the validator first and then point the editor to it; never push
  without an explicit request.
- In this repository: the website (banners in `site/scripts/sync-content.mjs`, sidebar and version
  selector, `specification/versioning.md`), `spec/README.md`, the README and the Quickstart name
  the current draft, and `npm run check:examples` passes in `site/`.

## Code quality and maintainability

Applies to all new code and modifications. Goals: maintainable code, low coupling, high cohesion, minimal dependencies, clear separation of concerns, easy testing, predictable architecture, consistent English codebase, proper i18n, long-term maintainability.

**General principles:** Prefer simple over clever; composition over inheritance; loosely coupled, highly cohesive modules; Single Responsibility; business logic independent from UI/infrastructure where practical; no unnecessary abstractions or design patterns; no premature optimisation; explicit over implicit; minimal dependencies; never duplicate business logic.

**Refactor-on-touch:** Inspect surrounding code when modifying; fix violations if safely possible; do not preserve bad patterns merely because they exist; no unrelated repository-wide refactoring; keep refactoring and functional changes separable.

**Functions:** Preferred ≤30 lines, warning at 50. Extract when: multiple responsibilities, independent purpose, nameable, independently testable, reused, or mixed abstraction levels. Options object over >4 parameters. Top-level function should read like a high-level description.

**Files:** Preferred max ~250 lines, warning at 400. Review for multiple responsibilities, mixed abstraction levels, repeated logic, business logic in inappropriate places, or utility dumping. Split by responsibility and cohesion, not line count.

**Nesting and control flow:** Max 3 levels. Guard clauses and early returns. Avoid clever one-liners that hurt readability.

**React:** Components describe UI composition; no substantial business logic inside. Extract: API access → services, business logic → domain functions, reusable logic → custom hooks, transformations → pure functions, complex UI → child components, forms → dedicated hooks. Component size ≤150 lines preferred, warning >250.

**Business logic:** Framework-independent where practical. Layering: UI → Hook/Controller → Application Service → Domain → Infrastructure. Pure TypeScript functions where possible.

**Node.js backend:** Separate responsibilities (routes, controllers, services, domain, repositories, infrastructure). Controllers thin: validate/parse, call application logic, map result. Business rules not in controllers. Split god services.

**Dependencies:** Minimise. Before adding: stdlib possible? maintained? widely used? transitive footprint? security/licence risk? substantial enough? No dependency for trivial functionality; prefer existing project dependencies; no overlapping libraries.

**Utilities:** No `utils.ts`/`helpers.ts`/`misc.ts`/`common.ts` dumping grounds; name by domain (`date/formatDate.ts`, `auth/permissions.ts`).

**DRY, but not excessively:** No duplicated meaningful business logic, but "duplication is cheaper than the wrong abstraction". Extract when conceptually the same, changes together, clearly nameable, reduces complexity.

**Naming:** All identifiers in English (variables, functions, classes, types, interfaces, components, hooks, files, folders, API models). Descriptive names that communicate intent.

**Comments:** English; explain why, constraints, non-obvious decisions, workarounds; not the obvious; remove outdated comments.

**i18n:** All user-facing text through the project's i18n system, never hard-coded. Keys stable, descriptive, hierarchical (`profile.saveChanges`, `errors.networkUnavailable`); never use translated strings as logic identifiers.

**Error handling:** Explicit, meaningful errors; never silently swallow; no bare `console.log(error)`; typed/domain errors where useful; separate user-facing messages, developer diagnostics, and internal details.

**Logging:** Useful context. Never log passwords, access tokens, API keys, secrets, or sensitive personal information.

**Testing:** Business logic independently testable: pure functions, domain logic, application services without browser, React rendering, real database or real external API. Do not mock everything by default.

**Architecture:** Organise by feature/domain when large enough (`features/users/{components,hooks,services,types.ts,validation.ts}`) rather than a giant global structure; a global structure is fine for genuinely shared infrastructure.

**Dependency direction:** Inward towards stable business logic: UI → Application → Domain; Infrastructure → Application/Domain. Domain logic must not depend directly on framework-specific libraries unless necessary.

**Dead code:** Remove unused imports, variables, functions, dead components, obsolete feature flags, commented-out implementations. Version control recovers deleted code.

**Magic values:** No unexplained magic numbers/strings; use named domain constants (`MAX_RETRIES`).

**Security:** Never hard-code secrets, API keys, passwords, tokens; use env vars or secret-management mechanism; validate external input; treat external data as untrusted; avoid unsafe dynamic execution.

**API boundaries:** Explicit contracts; do not pass arbitrary objects; validate at boundaries and convert to internal models (External API → Validation → Internal Model).

**Definition of done:** identifiers English, comments English, user-facing text via i18n, no unnecessary dependencies, functions single responsibility, large functions/components evaluated, no duplicated business logic, business logic separated from UI/infrastructure, no hard-coded secrets, errors handled intentionally, dead code removed, touched code improved when safe, tests for important logic, architecture remains easy to understand.
