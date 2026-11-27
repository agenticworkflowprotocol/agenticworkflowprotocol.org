#!/usr/bin/env node
// Generates Kubernetes CustomResourceDefinitions from the AWP JSON Schemas (v1alpha3 spec 3.10).
// One CRD per kind serves every version with the Kubernetes resource model (v1alpha3 and later);
// v1alpha3 stays the storage version while it is the current draft. The versions differ only by
// additions, so the API server converts between them by changing apiVersion (strategy None).
//
//   node conformance/crd.mjs write    writes schema/crd/<plural>.yaml
//   node conformance/crd.mjs check    fails if the files are missing or stale
//
// The JSON Schema stays normative. A CRD schema is the structural subset Kubernetes accepts:
// $ref is inlined, const becomes enum, conditionals, combinators and patterns that RE2 cannot
// evaluate are dropped, and closed objects keep unknown fields (x-kubernetes-preserve-unknown-fields)
// instead of pruning them, so that the runtime or an admission webhook can still reject them
// (fail closed, spec 3.3).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const VERSIONS = ['v1alpha3', 'v1alpha4'];
const STORAGE_VERSION = 'v1alpha3';
const GROUP = 'awp.agenticworkflowprotocol.org';
const OUT_DIR = path.join(root, 'schema', 'crd');

const condition = type => `.status.conditions[?(@.type=="${type}")].status`;
const MANIFEST_COLUMNS = [
  { name: 'Version', type: 'string', jsonPath: '.spec.version' },
  { name: 'Owner', type: 'string', jsonPath: '.spec.owner.team' },
  { name: 'Valid', type: 'string', jsonPath: condition('Valid') },
  { name: 'Ready', type: 'string', jsonPath: condition('Ready') },
  { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp' },
];

export const KINDS = [
  { kind: 'Workflow', plural: 'workflows', specDef: 'WorkflowSpec', statusDef: 'ManifestStatus', columns: MANIFEST_COLUMNS },
  { kind: 'Agent', plural: 'agents', specDef: 'AgentSpec', statusDef: 'ManifestStatus', columns: MANIFEST_COLUMNS },
  { kind: 'Policy', plural: 'policies', specDef: 'PolicySpec', statusDef: 'ManifestStatus', columns: MANIFEST_COLUMNS },
  {
    kind: 'WorkflowRun',
    plural: 'workflowruns',
    specDef: 'WorkflowRunSpec',
    statusDef: 'WorkflowRunStatus',
    columns: [
      { name: 'Workflow', type: 'string', jsonPath: '.spec.workflowRef.name' },
      { name: 'Phase', type: 'string', jsonPath: '.status.phase' },
      { name: 'Started', type: 'date', jsonPath: '.status.startedAt' },
      { name: 'Age', type: 'date', jsonPath: '.metadata.creationTimestamp' },
    ],
  },
];

// Keywords that only validate values and have no structural equivalent; full validation of these
// is the job of the AWP validator in the runtime or in an admission webhook.
const DROPPED = new Set(['if', 'then', 'else', 'allOf', 'anyOf', 'oneOf', 'not', 'propertyNames', '$comment']);
const COPIED = new Set(['description', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'minProperties', 'maxProperties', 'uniqueItems', 'required']);

// Kubernetes evaluates patterns with Go's RE2, which has no lookaround and no backreferences.
const RE2_UNSUPPORTED = /\(\?[=!<]|\\[1-9]/;

const typeOf = v => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v);

function resolve(schema, node, seen) {
  if (!node.$ref) return { node, seen };
  const name = node.$ref.replace('#/$defs/', '');
  if (seen.includes(name)) throw new Error(`recursive $ref ${name} cannot be inlined into a CRD`);
  const target = node.$ref.split('/').slice(1).reduce((n, k) => n[k], schema);
  const { $ref, ...rest } = node;
  return resolve(schema, { ...target, ...rest }, [...seen, name]);
}

/** Properties that conditional branches (if/then/else) add to an object, e.g. agent entry forms. */
function branchProperties(schema, node, seen) {
  const props = {};
  for (const key of ['then', 'else']) {
    if (!node[key]) continue;
    const { node: branch, seen: s } = resolve(schema, node[key], seen);
    Object.assign(props, branchProperties(schema, branch, s), branch.properties ? Object.fromEntries(Object.entries(branch.properties).map(([k, v]) => [k, { v, s }])) : {});
  }
  return props;
}

function convert(schema, input, seen = []) {
  const { node, seen: s } = resolve(schema, input, seen);
  if (Object.keys(node).every(k => k === 'description')) {
    return { ...node, 'x-kubernetes-preserve-unknown-fields': true };
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) if (COPIED.has(k)) out[k] = v;
  if (out.pattern && RE2_UNSUPPORTED.test(out.pattern)) delete out.pattern;
  if (node.const !== undefined) out.enum = [node.const];
  if (node.enum) out.enum = node.enum;
  out.type = node.type ?? typeOf((out.enum ?? [])[0]);
  if (node.exclusiveMinimum !== undefined) Object.assign(out, { minimum: node.exclusiveMinimum, exclusiveMinimum: true });
  if (out.type === 'array') out.items = convert(schema, node.items ?? {}, s);
  if (out.type === 'object') convertObject(schema, node, out, s);
  for (const k of Object.keys(node)) {
    if (!DROPPED.has(k) && !COPIED.has(k) && !['type', 'const', 'enum', 'exclusiveMinimum', 'items', 'properties', 'additionalProperties', '$ref', 'title'].includes(k)) {
      throw new Error(`unsupported keyword "${k}"`);
    }
  }
  return out;
}

function convertObject(schema, node, out, seen) {
  const props = Object.fromEntries(Object.entries(node.properties ?? {}).map(([k, v]) => [k, convert(schema, v, seen)]));
  for (const [k, { v, s }] of Object.entries(branchProperties(schema, node, seen))) props[k] ??= convert(schema, v, s);
  if (Object.keys(props).length) out.properties = props;
  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    out.additionalProperties = convert(schema, node.additionalProperties, seen);
  } else {
    // closed and open objects alike keep unknown fields, so that validation can still reject them
    out['x-kubernetes-preserve-unknown-fields'] = true;
  }
}

/** One entry of spec.versions: the structural schema of `version` for one kind. */
function crdVersion(schema, version, { kind, specDef, statusDef, columns }) {
  const spec = convert(schema, { $ref: `#/$defs/${specDef}` });
  // status is typed so that the API server checks runtime writes; unknown fields are kept
  const status = { ...convert(schema, { $ref: `#/$defs/${statusDef}` }), 'x-kubernetes-preserve-unknown-fields': true };
  return {
    name: version,
    served: true,
    storage: version === STORAGE_VERSION,
    subresources: { status: {} },
    additionalPrinterColumns: columns,
    schema: {
      openAPIV3Schema: {
        description: `AWP ${kind} (${GROUP}/${version}). Generated from schema/awp.${version}.json; the JSON Schema is normative.`,
        type: 'object',
        required: ['spec'],
        properties: {
          apiVersion: { type: 'string' },
          kind: { type: 'string' },
          metadata: { type: 'object' },
          spec,
          status,
        },
      },
    },
  };
}

/** @param {Map<string, object>} schemas JSON Schema per version */
export function crdFor(schemas, entry) {
  const { kind, plural } = entry;
  return {
    apiVersion: 'apiextensions.k8s.io/v1',
    kind: 'CustomResourceDefinition',
    metadata: { name: `${plural}.${GROUP}` },
    spec: {
      group: GROUP,
      names: { kind, listKind: `${kind}List`, plural, singular: kind.toLowerCase(), categories: ['awp'] },
      scope: 'Namespaced',
      versions: [...schemas].map(([version, schema]) => crdVersion(schema, version, entry)),
    },
  };
}

export function renderCrds() {
  const schemas = new Map(VERSIONS.map(v => [v, JSON.parse(fs.readFileSync(path.join(root, 'schema', `awp.${v}.json`), 'utf8'))]));
  const header = `# Generated by conformance/crd.mjs from ${VERSIONS.map(v => `schema/awp.${v}.json`).join(', ')}. Do not edit.\n`;
  return KINDS.map(k => ({ file: path.join(OUT_DIR, `${k.plural}.yaml`), text: header + stringify(crdFor(schemas, k), { lineWidth: 0 }) }));
}

/** Returns a list of problems; empty when the committed CRDs match the schema. */
export function checkCrds() {
  return renderCrds().flatMap(({ file, text }) => {
    const rel = path.relative(root, file);
    if (!fs.existsSync(file)) return [`${rel} is missing; run node conformance/crd.mjs write`];
    return fs.readFileSync(file, 'utf8') === text ? [] : [`${rel} is stale; run node conformance/crd.mjs write`];
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'write') {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const { file, text } of renderCrds()) fs.writeFileSync(file, text);
    process.exit(0);
  }
  if (cmd === 'check') {
    const problems = checkCrds();
    for (const p of problems) console.error(p);
    process.exit(problems.length ? 1 : 0);
  }
  console.error('usage: crd.mjs write | check');
  process.exit(2);
}
