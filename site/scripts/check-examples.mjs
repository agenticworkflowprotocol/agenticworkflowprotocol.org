// Runs the YAML examples of the website through the reference checker, so that a page never shows a
// manifest the specification no longer accepts. Only marked code blocks are checked: a marker on its
// own line directly before a ```yaml fence, as an HTML comment in .md and as a JSX comment in .mdx.
//
//   <!-- awp-check -->                                     must be valid (all profiles)
//   <!-- awp-check profiles=core,security -->              must be valid under these profiles
//   <!-- awp-check expect=security.image-not-pinned -->    must be rejected with this diagnostic code
//
// Unmarked blocks are fragments or proposals and are never checked.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateText } from '../../conformance/awp-check.mjs';
import { KNOWN_PROFILES } from '../../conformance/semantic.mjs';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = join(siteRoot, 'src/content/docs');
const MARKER = /^\s*(?:<!--|\{\/\*)\s*awp-check\b(.*?)(?:-->|\*\/\})\s*$/;
const YAML_FENCE = /^\s*```ya?ml\b/;
const FENCE_END = /^\s*```\s*$/;

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const OPTIONS = ['profiles', 'expect'];

/** Parses `profiles=a,b expect=code` after the marker keyword; unknown options or profiles are problems. */
function parseOptions(text) {
  const options = {};
  const problems = [];
  for (const [, key, value] of text.matchAll(/(\w+)=(\S+)/g)) {
    if (!OPTIONS.includes(key)) problems.push(`unknown awp-check option "${key}"`);
    options[key] = value;
  }
  const profiles = options.profiles?.split(',');
  // A misspelt profile would silently drop its rules, so it is an error like in the CLI.
  for (const profile of profiles ?? []) if (!KNOWN_PROFILES.includes(profile)) problems.push(`unknown profile "${profile}"`);
  return { options: { profiles, expect: options.expect }, problems };
}

/** The family of a diagnostic code: `security` for `security.image-not-pinned`. */
const familyOf = (code) => code.split('.')[0];

/** Returns the marked YAML blocks of one page, and a problem for every marker without a YAML block. */
function markedBlocks(lines) {
  const blocks = [];
  const problems = [];
  lines.forEach((line, index) => {
    const marker = line.match(MARKER);
    if (!marker) return;
    const start = index + 1;
    const end = lines.findIndex((l, i) => i > start && FENCE_END.test(l));
    if (!YAML_FENCE.test(lines[start] ?? '') || end === -1) {
      problems.push({ line: index + 1, message: 'awp-check marker is not followed by a complete yaml code block' });
      return;
    }
    const parsed = parseOptions(marker[1]);
    for (const message of parsed.problems) problems.push({ line: index + 1, message });
    blocks.push({ line: start + 1, text: lines.slice(start + 1, end).join('\n'), ...parsed.options });
  });
  return { blocks, problems };
}

/** Checks one block and returns an error message, or null if the checker agrees with the marker. */
function checkBlock(block, location) {
  const errors = validateText(block.text, location, { profiles: block.profiles }).diagnostics
    .filter((d) => d.severity === 'error');
  if (block.expect) {
    // As in the conformance runner: the expected code must occur, and no error of another family.
    const hit = errors.some((d) => d.code === block.expect);
    const stray = errors.filter((d) => familyOf(d.code) !== familyOf(block.expect));
    return hit && stray.length === 0 ? null : `${location}: expected only ${block.expect}, got ${errors.map((d) => d.code).join(', ') || 'valid'}`;
  }
  return errors.length === 0 ? null : `${location}: ${errors.map((d) => `${d.code} ${d.path}`).join('; ')}`;
}

const pages = walk(docsDir).filter((f) => /\.mdx?$/.test(f));
const failures = [];
let checked = 0;
for (const page of pages) {
  const name = relative(siteRoot, page);
  const { blocks, problems } = markedBlocks(readFileSync(page, 'utf8').split('\n'));
  for (const problem of problems) failures.push(`${name}:${problem.line}: ${problem.message}`);
  for (const block of blocks) {
    checked++;
    const failure = checkBlock(block, `${name}:${block.line}`);
    if (failure) failures.push(failure);
  }
}
// A run that checks nothing means the markers were lost, not that every example is valid.
if (checked === 0) failures.push('no marked examples found; mark at least the Quickstart manifest');
for (const failure of failures) console.error(failure);
console.log(`check-examples: ${checked} marked examples, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
