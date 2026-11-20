# AEP-0018: Step output interface

| | |
| --- | --- |
| **AEP** | 0018 |
| **Title** | Step output interface |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes), runtime implementer (non-Kubernetes), author of command step images |
| **Reviewers** | - |
| **Target API version** | `v1alpha3` |
| **Profiles affected** | `core` |
| **Created** | 2026-11-19 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

Define how a step produces the values of its declared `outputs`. Command steps write one file per
output into the directory `$AWP_OUTPUTS`; agent steps end with a built-in tool `complete_step`
that carries the outputs. Runtimes accept outputs of at least 256 KiB each and 1 MiB per step,
discard outputs of failed attempts, and reserve environment variables with the prefix `AWP_`.
Output names are restricted so that they are valid file names. The text is applied in
[spec/v1alpha3 section 5.6.4](../spec/v1alpha3/README.md#564-step-outputs).

## Motivation

`outputs` declares names, and expressions read `steps.<id>.outputs.<name>`, but the specification
never says how a value gets there. Runtimes that were built against `v1alpha1` and `v1alpha3`
had to invent conventions: files in a directory announced by an environment variable, a JSON
document on standard output, a completion tool for agents. A command image written for one runtime
does not produce outputs on another, and an agent prompt that says "call the tool X when done"
only works where X exists. This is the largest portability gap reported from a Kubernetes runtime
proof of concept, and it touches every workflow that passes data between steps.

Related gaps from the same report: no minimum size for outputs, and no rule whether outputs of a
failed command are valid.

## Goals and non-goals

- Goals: a command image and an agent prompt that produce outputs on every conformant runtime; a
  size every runtime accepts; a clear rule for failed attempts.
- Non-goals: output types and schemas (AEP-0003, AEP-0014), binary artifacts and large files
  (artifact stores stay implementation-defined), the working directory and source checkout of
  command steps (open gap, see [docs/runtime-feedback.md](../docs/runtime-feedback.md)).

## Specification

Applied in [spec/v1alpha3 section 5.6.4](../spec/v1alpha3/README.md#564-step-outputs), summarised:

1. **Names.** `outputs[].name` matches `^[A-Za-z_][A-Za-z0-9_]{0,62}$`.
2. **Command steps.** The runtime creates an empty directory per attempt and passes its path in
   `AWP_OUTPUTS`. A file named like a declared output is its value (UTF-8 text, one trailing line
   feed removed). Files are read after exit status `0`; symbolic links are not followed; other
   files are ignored with a warning. The runtime also sets `AWP_EXECUTION_ID`, `AWP_STEP_ID` and
   `AWP_ATTEMPT`. The prefix `AWP_` is reserved; `env` must not use it.
3. **Agent steps.** The runtime offers a way to end the step with the output values, by default a
   built-in tool `complete_step` with one string parameter per declared output. It is not an
   action. An agent step with outputs that ends without completing fails with `notCompleted`.
4. **All steps.** Minimum accepted size 256 KiB per output and 1 MiB per step; larger outputs fail
   the step with `outputTooLarge`, never truncated. A missing output has no value (referencing it
   is an evaluation error, AEP-0013). Outputs of failed, timed-out or cancelled attempts are
   discarded.
5. **Conformance statement.** Optional `limits.outputSize` and `limits.stepOutputSize`.

## Examples

```yaml
- id: diff
  type: command
  image: registry.example.com/tools/diff@sha256:...
  command: ./diff.sh > "$AWP_OUTPUTS/new" && wc -l < "$AWP_OUTPUTS/new" > "$AWP_OUTPUTS/count"
  outputs:
    - name: new
    - name: count
- id: rate
  agent: curator
  task: "Rate these concerts: ${{ steps.diff.outputs.new }}"
  dependsOn: [diff]
  outputs:
    - name: relevant
      description: JSON array of relevant concerts.
```

The agent of `rate` ends with `complete_step({"relevant": "[...]"})`.

## Schema changes

`outputs[].name` gets the pattern above. New semantic rule `step.reserved-env`.

## Conformance impact

- `core`: the interface above.
- New `v1alpha3` cases: `valid/5.6.4-command-step-outputs`, `invalid/5.6.1-output-name-with-dot`
  (`schema.pattern`), `invalid/5.6.4-reserved-env` (`step.reserved-env`).
- Runtime tests, once a runtime suite exists: a command image writes outputs and a dependent step
  reads them; a trailing line feed is removed; a symbolic link is not followed; an oversized output
  fails the step; outputs of a failed attempt are not visible after a retry; an agent step that ends
  without `complete_step` fails.

## Compatibility and migration

Output names that do not match the pattern must be renamed; the examples and the conformance suite
contain none. Runtimes with their own conventions keep them as additional formats, but images and
prompts that rely on them are not portable.

## Security considerations

- Output files are untrusted data: read with a size limit, as text, without following symbolic
  links, so that a command cannot make the runtime read files outside the directory.
- Outputs still go through expressions only; `command` stays free of expressions (section 5.6.2).
- `complete_step` is not an action, so it cannot be used to bypass permissions: it only carries
  values to the runtime.

## Privacy considerations

Outputs may contain personal data; their classification and the `payload` rules for
`artifact.created` are unchanged.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **JSON on standard output**: mixes logs and data and breaks with tools that print to stdout.
- **One file with `name=value` lines** (as some CI systems do): needs delimiters for multi-line
  values; one file per output is simpler for shell scripts.
- **The agent's final message as the output**: works for one output only and depends on the model
  following a format.
- **Leave it implementation-defined**: keeps images and prompts tied to one runtime.

## Implementation status

Schema, semantic rule and conformance cases are in this repository. A Kubernetes runtime proof of
concept used the same file convention and a completion tool with real models.

## Open questions

1. Should `outputs[].required` exist, so that a missing output fails the step instead of failing
   the first reference to it?
2. Should the minimum sizes be larger? Kubernetes object size limits make 1 MiB per step a
   practical ceiling for runtimes that keep outputs in objects.
3. Should `complete_step` be the only name (MUST) instead of a recommendation (SHOULD)?
4. May a runtime accept non-string values in `complete_step` and store them as compact JSON text?
   An agent that returns a list (for example extracted events that the next command step parses)
   has to emit JSON inside a string parameter today: escaping errors are common and nothing is
   validated. Typed outputs (AEP-0003) are the intended solution; until then, accepting arrays and
   objects and serializing them as JSON would make such workflows reliable, but the value a
   dependent step sees would depend on whether the runtime does it.

## Decision

-

## References

- Runtime feedback: [docs/runtime-feedback.md](../docs/runtime-feedback.md), entries G01, G14 and
  G15.
