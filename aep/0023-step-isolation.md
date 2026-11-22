# AEP-0023: Step isolation: network and credentials

| | |
| --- | --- |
| **AEP** | 0023 |
| **Title** | Step isolation: network permissions, platform ceilings and model credentials |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer, platform operator |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha3` |
| **Profiles affected** | `core`, `security` |
| **Created** | 2026-11-22 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

`permissions.network` says what a workflow or agent needs, but not how host names are written,
how the rule relates to limits that the platform sets (network policies, egress proxies,
firewalls), what happens when a runtime cannot enforce it, or which addresses an allowed host may
resolve to. Model credentials are not covered at all. This AEP defines the host syntax, makes the
effective network the intersection of the manifest and a platform ceiling, requires a runtime to
enforce or reject, denies private and internal destinations after resolution by default under the
`security` profile unless both the manifest and the ceiling allow them, defaults `egress` to `deny`
under that profile, and keeps model credentials out of steps. It answers runtime feedback G10,
G47, G49, G50, G51 and G61.

## Motivation

- **Two places restrict egress.** A platform restricts network access per namespace or workload
  (Kubernetes `NetworkPolicy`, a service mesh, an egress proxy, a firewall). The specification
  forms the intersection only between AWP permission objects (spec 7.5.4) and says nothing about
  such a ceiling (G47). An author cannot tell whether a reviewed manifest will run, and an
  operator cannot tell whether a manifest asks for more than the platform allows.
- **Enforcement is not required.** A runtime that cannot restrict command-step egress by host
  name can silently ignore `allowHosts` (G10, G51). A proof-of-concept runtime rejected such
  manifests instead, which is the fail-closed reading, but nothing requires it.
- **No syntax.** Subdomain wildcards, ports, IP literals and CIDRs are undefined (G49), so the
  same allowlist means different things in different runtimes and cannot be translated into a
  proxy or policy configuration.
- **SSRF.** A host on the allowlist can resolve to loopback, private, link-local (cloud metadata)
  or CGNAT addresses, also after a redirect or a DNS change between check and connection (DNS
  rebinding). The tool proxy of a proof of concept had exactly this hole (G50).
- **Internal services are legitimate.** Agents often need an internal ticket system, a model
  server in the cluster or a database. A blanket ban on private addresses would force operators
  to switch the protection off entirely.
- **Model credentials.** The specification does not say where provider keys live. A runtime may
  hand the key to the agent step, where any command or injected instruction can read and
  exfiltrate it (G61).
- **Default `egress: allow`** conflicts with deny-by-default deployments and with the intent of
  the `security` profile.

## Goals and non-goals

- Goals: one host syntax; a defined relation between manifest and platform ceiling; enforce or
  reject; safe defaults under `security`; internal destinations possible when explicitly
  allowed; model credentials outside steps.
- Non-goals: a mechanism (proxy, mesh, policy engine); per-port or per-protocol firewall rules;
  inbound traffic; secret stores (spec 7.9 stays as it is).

## Specification

### Changes to section 7.5.1 (fields)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `network.egress` | string | `allow` or `deny`: outbound network access of command steps and built-in tools. Default `allow`; under the `security` profile the default is `deny`. |
| `network.allowHosts` | list | Destinations reachable when `egress` is `deny`, in the syntax of section 7.5.5. |

### New section 7.5.5 (network destinations)

An entry of `allowHosts` is one of:

| Form | Example | Matches |
| ---- | ------- | ------- |
| Host name | `api.example.com` | exactly this name (case-insensitive, without trailing dot) |
| Subdomain wildcard | `*.example.com` | any name with at least one label before `example.com`, not `example.com` itself |
| Address | `10.20.0.15`, `2001:db8::1` | exactly this address |
| CIDR | `10.20.0.0/16` | any address in the range |

Each form MAY end with `:<port>`; without a port, every port matches. A `*` anywhere other than as
the first label is invalid, and so is a bare `*`. Validators MUST reject invalid entries.

Host name entries are matched against the name the step requested, before resolution. Address and
CIDR entries are matched against the resolved address.

### New section 7.5.6 (enforcement and platform ceilings)

- **Effective network.** A platform MAY set a ceiling on the network access of executions
  (for example per namespace, tenant or runtime installation). The effective network access of a
  step is the intersection of every applicable `permissions.network` (spec 7.5.4) and the
  ceiling.
- **Enforce or reject.** A runtime MUST enforce the effective network access for every step type
  it runs, with a mechanism of its choice. A runtime MAY restrict further. If a runtime cannot
  enforce a rule for a step type, or the ceiling does not allow a destination that the manifest
  requires, the runtime MUST reject the manifest or the execution before any step runs, with a
  reason that names the rule and the step type. It MUST NOT run the step with weaker
  restrictions.
- **Internal destinations (security profile).** After resolution, the runtime MUST deny
  connections to loopback (`127.0.0.0/8`, `::1`), private (`10.0.0.0/8`, `172.16.0.0/12`,
  `192.168.0.0/16`, `fc00::/7`), link-local (`169.254.0.0/16`, `fe80::/10`), CGNAT
  (`100.64.0.0/10`) and unspecified addresses by default. Such a destination is allowed only if
  **both** hold: the manifest allows it explicitly (an address or CIDR entry that contains the
  resolved address, or a host name entry for the name that resolved to it), and the platform
  ceiling allows the resolved address. This is no blanket ban: agents may use internal services
  when author and operator both say so. The check MUST apply to the address actually connected
  to, including after redirects, so that a DNS change between check and connection cannot reach
  an address that the ceiling does not allow.
- **Conformance statement.** A runtime MUST state per step type how it enforces network access and
  which ceiling sources it reads (spec 11).

Informative: a per-workload egress proxy with an allowlist derived from `allowHosts`, plus a
network policy that lets the workload reach only that proxy, is one conforming enforcement for
command steps. A built-in tool can enforce in-process with a connection-time address check.

### Changes to section 7.9 (secrets): model credentials

- Credentials for model providers are runtime configuration, not manifest content.
- Under the `security` profile, model credentials MUST NOT be visible to steps: not in the
  environment, the filesystem or the arguments of a step. The runtime calls the provider itself
  or through a proxy that authenticates the step with a credential that is short-lived and bound
  to one execution or attempt.
- Outside the `security` profile, a runtime that exposes model credentials to steps MUST say so
  in its conformance statement.

### Change to the profile table (spec 11)

`security`: add "network enforcement or rejection (7.5.6), internal destinations (7.5.6), model
credentials outside steps (7.9)".

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha3
kind: Workflow
metadata:
  name: ticket-triage
spec:
  version: 0.1.0
  owner:
    team: support
  classification: internal
  permissions:
    network:
      egress: deny
      allowHosts:
        - api.example.com
        - "*.cdn.example.com:443"
        - 10.20.0.0/16        # internal ticket system, explicitly allowed
  agents:
    - id: triage
      model:
        provider: example-provider
        name: example-model
  workflow:
    - id: run
      agent: triage
      task: Triage new tickets.
```

Under the `security` profile, a connection to `10.20.4.5` is allowed only if the platform
ceiling also allows that address. If `api.example.com` resolves to `10.1.2.3`, the connection is
allowed only if the ceiling allows `10.1.2.3`; with a ceiling that allows no internal addresses it
is denied.

## Schema changes

- `allowHosts` items: a pattern for the four forms with optional port.
- Semantic rule `permissions.network.host-invalid` for wildcards outside the first label, bare
  `*` and invalid CIDRs.

## Conformance impact

- `core`: host syntax, enforce-or-reject, conformance statement.
- `security`: default `egress: deny`, internal destinations, model credentials.
- Valid: `7.5.5-allow-hosts-forms.yaml`. Invalid: `7.5.5-allow-hosts-bare-wildcard.yaml`,
  `7.5.5-allow-hosts-inner-wildcard.yaml`, `7.5.5-allow-hosts-invalid-cidr.yaml`.
- Runtime tests (once a runtime suite exists): a host that resolves to a private address; a
  redirect to `169.254.169.254`; a DNS answer that changes between two lookups; a ceiling that
  forbids a required host (rejected before start).

## Compatibility and migration

- Manifests with host names only stay valid. Entries that were tolerated before and are invalid
  now (bare `*`) become invalid.
- Under `security`, manifests without `network` change from "egress allowed" to "egress denied";
  authors add `egress: allow` or `allowHosts`.
- Runtimes that ignored `allowHosts` for command steps must enforce or reject.

## Security considerations

The AEP closes SSRF through allowed hosts, prevents silent weakening of reviewed network rules and
keeps provider keys out of reach of prompt injection. Allowing internal destinations requires
agreement of author (manifest) and operator (ceiling), so neither alone can open the internal
network.

## Privacy considerations

None beyond spec 7.2. Host names in audit events may reveal which services a workflow uses.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Leave network to the platform.** Rejected: the reviewed manifest would say nothing about what
  a workflow reaches, and runtimes could not reject what they cannot run.
- **Blanket ban on private addresses.** Rejected: agents need internal services; operators would
  disable the protection altogether.
- **Allow internal destinations by the manifest alone.** Rejected: a public name can point
  anywhere after a DNS change, which is the attack; the platform ceiling decides which internal
  addresses exist for a workload.
- **Name a mechanism (proxy, network policy).** Rejected: not portable; kept as informative text.

## Implementation status

A proof-of-concept Kubernetes runtime checks the resolved address at connection time in its tool
proxy, rejects workflow-level egress rules it cannot enforce for command steps, and keeps provider
keys out of step pods (short-lived credential per attempt). It has no explicit DNS rebinding test
and no measurement of proxy latency or cost.

## Open questions

1. Should the ceiling be visible to authors, for example in the status of a binding or workflow
   (`Accepted` with reason `NetworkCeiling`)?
2. Do MCP servers over `streamable-http` fall under the same rules as built-in tools?

## Decision

Not decided. Number and scope assigned by the maintainer on 2026-11-22.

## References

- Runtime feedback G10, G47, G49, G50, G51, G61 ([runtime-feedback.md](../docs/runtime-feedback.md)).
- Spec `v1alpha3` sections 7.5, 7.9, 11.
- Kubernetes `NetworkPolicy`; RFC 1918, RFC 6598 (CGNAT), RFC 4193 (unique local IPv6).
