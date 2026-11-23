# AEP-0023: Step isolation: network, credentials and approvals

| | |
| --- | --- |
| **AEP** | 0023 |
| **Title** | Step isolation: network permissions, platform ceilings, credentials, approval authority and isolation class |
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
resolve to. Model credentials are not covered at all. This AEP replaces `allowHosts` with structured destinations (`allowTo`: `host` or `cidr`, `except`, `ports`, aligned with network policies), makes the
effective network the intersection of the manifest and a platform ceiling, requires a runtime to
enforce or reject, denies private and internal destinations after resolution and normalisation by default under the
`security` profile unless both the manifest and the ceiling allow them, defaults `egress` to `deny`
under that profile, and keeps model credentials out of steps. It extends the same rule to the
credentials of tool servers and to the authority that approves actions, lets a manifest require a
minimum isolation class, and states that ceilings reject and never adjust a manifest. It answers runtime
feedback G10, G47, G49, G50, G51, G61, G64, G67, G68 and G69.

All additions follow one principle: **what decides about a step, or what a step must not be able
to use, lives outside the step's execution environment.** Model credentials, tool server
credentials and approvals are the three cases a proof of concept met in practice.

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
- **Tool server credentials.** Spec 5.5.1 gives an MCP server `auth.secretRef`, and 7.9 lets the
  secret's scope name the server: the runtime hands the credential to the MCP client. When the
  client runs inside the step (a coding agent that speaks MCP itself), every command of the step
  can read it (G69). A proof of concept therefore routes MCP traffic through a gateway outside the
  step, which adds the credential and authenticates the step with a short-lived ticket.
- **Self-approval.** In interactive execution a person confirms single tool calls (AEP-0026), and
  in workflows approvals gate actions (spec 7.6). If the component that asks for and records the
  confirmation runs inside the execution environment, the step can confirm itself. A proof of
  concept showed it: the coding agent and its commands ran under the same user ID, a command read
  the agent's local server password from the process environment, and a process in the sandbox sent
  a prompt in autonomous mode and answered every permission request itself. The attack failed only
  after the decision moved to a separate container with its own process namespace, which signs
  grants and takes confirmations only from the person's authenticated console (G64).
- **Isolation is invisible.** A step that runs commands on an untrusted repository needs more than
  a container (a user-space kernel or a virtual machine). The manifest cannot require it; the
  choice sits in a runtime binding that reviewers do not see (G67).
- **Reject or adjust.** The proof of concept has ceilings per tenant for models, hosts, tool
  servers, autonomy and cost. A model outside the ceiling makes the agent invalid, while a cost
  limit above the ceiling is lowered to it, so the run differs from the reviewed manifest. The
  specification says neither (G68).
- **Ports and IPv6.** A port appended to an address string is ambiguous for IPv6
  (`2001:db8::1:443`), and the egress rules of network policies keep addresses and ports apart.

## Goals and non-goals

- Goals: one structured destination format; a defined relation between manifest and platform ceiling; enforce or
  reject; safe defaults under `security`; internal destinations possible when explicitly
  allowed; model and tool server credentials outside steps; approvals decided outside steps; a
  minimum isolation class that reviewers can see; one rule for ceilings (reject).
- Non-goals: a mechanism (proxy, mesh, policy engine, sandbox technology); per-port or
  per-protocol firewall rules; inbound traffic; secret stores (spec 7.9 stays as it is); the
  interactive execution form itself (AEP-0026); what data a step may send to a tool server
  (runtime feedback G77).

## Specification

### Changes to section 7.5.1 (fields)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `network.egress` | string | `allow` or `deny`: outbound network access of command steps and built-in tools. Default `allow`; under the `security` profile the default is `deny`. |
| `network.allowTo` | list | Destinations reachable when `egress` is `deny`, as objects of section 7.5.5. Replaces `allowHosts`. |

### New section 7.5.5 (network destinations)

An entry of `allowTo` is an object. Its fields follow the egress rules of a Kubernetes
`NetworkPolicy` (`ipBlock.cidr`, `ipBlock.except`, `ports`), without the nesting, so that a rule
can be translated field by field:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `host` | string | cond. | A host name (`api.example.com`, matched case-insensitive, without trailing dot) or a subdomain wildcard (`*.example.com`: any name with at least one label before `example.com`, not `example.com` itself). Exactly one of `host` and `cidr`. |
| `cidr` | string | cond. | An IPv4 or IPv6 range in CIDR notation (`10.20.0.0/16`, `2001:db8::/32`). A single address is written with a full prefix (`10.20.0.15/32`, `2001:db8::1/128`). Exactly one of `host` and `cidr`. |
| `except` | list | no | CIDR ranges inside `cidr` that are excluded. Only with `cidr`. |
| `ports` | list | no | Allowed ports. Absent: every port. Each entry has `port` (integer 1 to 65535, REQUIRED), `endPort` (integer, optional, at least `port`: a range) and `protocol` (`TCP` (default) or `UDP`). |

Rules:

- Entries are objects only; a string entry is invalid. A `*` anywhere other than as the whole
  first label of `host` is invalid, and so is a bare `*`. `host` MUST NOT contain a port, an
  address or a CIDR. Validators MUST reject invalid entries.
- `host` entries are matched against the name the step requested, before resolution. `cidr`
  entries are matched against the resolved address, after normalisation (7.5.6).
- A connection is allowed if one entry matches its destination and, when the entry has `ports`,
  its port and protocol.

Informative mapping: a `cidr` entry becomes an `ipBlock` with `except` and `ports` in a
`NetworkPolicy`; a `host` entry needs a mechanism that matches names, for example the FQDN rules
of a network plugin (`toFQDNs` with `toPorts`) or the allow list of an egress proxy.

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
- **Normalisation.** Before any check against `cidr` entries, the internal ranges below or the
  ceiling, the runtime MUST normalise an IPv6 address that embeds an IPv4 address in a fixed way
  to that IPv4 address: IPv4-mapped (`::ffff:0:0/96`) and IPv4-compatible (`::/96`, except `::`
  and `::1`). Otherwise `::ffff:169.254.169.254` would reach the metadata address while passing a
  check against `169.254.0.0/16`.
- **Internal destinations (security profile).** After resolution and normalisation, the runtime
  MUST deny connections to loopback (`127.0.0.0/8`, `::1`), private (`10.0.0.0/8`,
  `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`), link-local (`169.254.0.0/16`, `fe80::/10`),
  CGNAT (`100.64.0.0/10`), unspecified addresses, and the IPv6 translation ranges NAT64
  (`64:ff9b::/96`, `64:ff9b:1::/48`) and 6to4 (`2002::/16`) by default. Translation ranges are
  denied rather than normalised because whether a translator sits behind them depends on the
  network. Such a destination is allowed only if **both** hold: the manifest allows it
  explicitly (a `cidr` entry that contains the normalised address, or a `host` entry for the name
  that resolved to it), and the platform ceiling allows the normalised address. This is no blanket ban: agents may use internal services
  when author and operator both say so. The check MUST apply to the address actually connected
  to, including after redirects, so that a DNS change between check and connection cannot reach
  an address that the ceiling does not allow.
- **Conformance statement.** A runtime MUST state per step type how it enforces network access and
  which ceiling sources it reads (spec 11).

Informative: a per-workload egress proxy with an allowlist derived from `allowTo`, plus a
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

### Changes to section 5.5.1 (MCP servers): credentials of tool servers

- Credentials of tool servers (`auth` of an MCP server, credentials of remote agents) are subject
  to the same rule as model credentials: under the `security` profile they MUST NOT be visible to
  the step. The runtime calls the server itself, or the step reaches the server through a component
  outside the step that adds the credential and authenticates the step with a credential that is
  short-lived and bound to one execution or attempt.
- `auth` MAY be satisfied by the runtime (a catalog or binding that holds the credential) instead
  of a manifest secret. The manifest still declares the server and the tools it may use.
- The component that holds the credential MUST also enforce the tool permissions of the step
  (which tools are listed and which calls are allowed), because a step that talks to the server
  directly is not bound by anything else.
- Traffic from the step to such a component is runtime-internal and does not need an
  `allowTo` entry. The tool server's own outbound traffic is not part of the step's
  `permissions.network`; a runtime SHOULD restrict it as well and say how in its conformance
  statement.

### New section 7.6.1 (approval authority)

Applies to approvals (spec 7.6, approval steps), to confirmations of single actions in interactive
execution (effect `ask`, AEP-0026) and to answers to human input that a runtime treats as a
decision.

- Under the `security` profile, the component that decides whether an action may run, and that
  records an approval or confirmation, MUST run outside the execution environment of the step. It
  MUST accept a decision only from an authenticated identity over a channel that the execution
  environment cannot reach.
- Anything that carries or proves a decision MUST NOT be readable or writable from inside the
  execution environment: no passwords or tokens of an approval endpoint, no signing keys, no
  pending requests that a process inside could answer. A signed grant that the step receives is
  allowed if the step cannot produce one itself.
- A permission system inside the step (for example the one of a coding agent engine) MAY be used
  in addition, but MUST NOT be the only enforcement.
- Separation of duties (spec 7.8) is checked against the authenticated identity of the decision,
  never against an identity that the step asserts.

Informative: a separate container with its own process namespace, which receives each tool call
before it runs, decides by mode, permissions and allow lists, and asks the person through the
runtime's user interface, is one conforming design. Running the decision in the same process or
under the same user ID as the step's commands is not.

### Changes to section 5.4 (agents): isolation class

| Field | Type | Description |
| ----- | ---- | ----------- |
| `isolation` | string | Minimum isolation of the execution environment of the agent's steps: `process`, `container`, `sandbox` (a kernel boundary in user space or an equivalent) or `vm` (a hardware-virtualised boundary). Default: none required. |

- The values are ordered (`process` < `container` < `sandbox` < `vm`). A runtime MUST run the step
  with at least the required class or reject the manifest or execution before any step runs.
- `isolation` is a minimum: a step that runs with a stronger class meets it. A platform MAY require
  a minimum class for every workload (for example `sandbox` per tenant); running an agent that
  requires `container` in a sandbox is no conflict.
- Which mechanism provides a class (for example gVisor for `sandbox`, Kata Containers or
  Firecracker for `vm`) is platform configuration.
- The conformance statement lists which classes the runtime provides and by which mechanism.

### New section 7.5.7 (platform ceilings in general)

7.5.6 defines the network ceiling. The same rule applies to every ceiling that a platform sets
(permissions, models, tool servers, network, autonomy, isolation, budgets): **a ceiling never
changes a manifest silently, it rejects.**

- If the manifest or a request asks for more than the ceiling allows, the runtime MUST reject the
  manifest, the execution or the request before anything runs, with a reason that names the rule
  (`ceilingExceeded`, with the field). Examples: a model or tool server outside the ceiling; a
  destination the ceiling does not allow; an isolation class the platform cannot provide; an
  autonomy level above the ceiling (AEP-0026); a `maxCostUsd` or token limit above the ceiling.
- If the ceiling sets a budget limit, the manifest MUST declare that limit (at a value up to the
  ceiling); a manifest without it is rejected. A runtime MUST NOT fill in or lower a limit on its
  own.
- A stronger isolation class than required is no deviation (5.4).
- A runtime SHOULD make ceilings visible to authors before they apply a manifest (for example in
  the status of a binding or a validation command).

Rejecting instead of adjusting keeps the reviewed manifest the truth: an execution never runs with
a budget, a model or an autonomy level that differs from what the reviewer saw.

### Change to the profile table (spec 11)

`security`: add "network enforcement or rejection (7.5.6), internal destinations (7.5.6), model
credentials outside steps (7.9), tool server credentials outside steps (5.5.1), approval
authority outside steps (7.6.1), isolation class enforced or rejected (5.4)".

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
      allowTo:
        - host: api.example.com
          ports:
            - port: 443
        - host: "*.cdn.example.com"
        - cidr: 10.20.0.0/16        # internal ticket system, explicitly allowed
          except:
            - 10.20.99.0/24
          ports:
            - port: 8000
              endPort: 8080
        - cidr: 2001:db8::1/128
          ports:
            - port: 443
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

An agent that runs commands on untrusted repositories, with a tool server whose credential the
runtime holds:

```yaml
  agents:
    - id: reviewer
      isolation: sandbox
      model:
        provider: example-provider
        name: example-model
      tools:
        - type: mcp
          server: code-scanner          # resolved from the runtime's catalog, no auth.secretRef
          tools: [scan]
      permissions:
        default: deny
        tools:
          code-scanner.scan:
            allow: true
          shell.execute:
            allow: true
```

A runtime that offers only containers rejects this agent. The step reaches `code-scanner` through
the runtime's gateway with a ticket for this attempt; the scanner's credential never enters the
step.

Under the `security` profile, a connection to `10.20.4.5` is allowed only if the platform
ceiling also allows that address. If `api.example.com` resolves to `10.1.2.3`, the connection is
allowed only if the ceiling allows `10.1.2.3`; with a ceiling that allows no internal addresses it
is denied.

## Schema changes

- `permissions.network.allowTo`: list of objects with `host` or `cidr` (`oneOf`), `except`
  (only with `cidr`), `ports` (`port`, `endPort`, `protocol`). `allowHosts` is removed;
  `awp-check.mjs migrate` converts `name` to `{host: name}`, an address to `{cidr: address/32}` or
  `/128`, and a CIDR to `{cidr: ...}`.
- Semantic rules: `permissions.network.host-invalid` (wildcards outside the first label, bare `*`,
  a port or address in `host`), `permissions.network.cidr-invalid`, `except-outside-cidr`,
  `port-range-invalid` (`endPort` below `port`).
- `agents[].isolation`: enum `process`, `container`, `sandbox`, `vm`.

## Conformance impact

- `core`: `allowTo`, enforce-or-reject, conformance statement.
- `security`: default `egress: deny`, internal destinations, model and tool server credentials,
  approval authority, isolation class.
- Valid: `5.4-agent-isolation.yaml`. Invalid: `5.4-agent-isolation-unknown.yaml`.
- Valid: `7.5.5-allow-to-forms.yaml`. Invalid: `7.5.5-allow-to-string-entry.yaml`,
  `7.5.5-allow-to-bare-wildcard.yaml`, `7.5.5-allow-to-host-with-port.yaml`,
  `7.5.5-allow-to-host-and-cidr.yaml`, `7.5.5-allow-to-except-outside.yaml`,
  `7.5.5-allow-to-port-range.yaml`.
- Runtime tests (once a runtime suite exists): a host that resolves to a private address; a
  redirect to `169.254.169.254`; a AAAA record `::ffff:169.254.169.254`; an address in
  `64:ff9b::/96`; a DNS answer that changes between two lookups; a ceiling that
  forbids a required host (rejected before start); a process in the step that tries to read a
  tool server credential; a process in the step that answers its own confirmation request; an
  agent that requires `vm` on a runtime with containers only (rejected before start).

## Compatibility and migration

- Manifests with host names only stay valid. Entries that were tolerated before and are invalid
  now (bare `*`) become invalid.
- Under `security`, manifests without `network` change from "egress allowed" to "egress denied";
  authors add `egress: allow` or `allowTo`.
- `allowHosts` becomes `allowTo` with objects (incompatible, allowed in an alpha version);
  `awp-check.mjs migrate` converts it. Entries with a port in the string have no automatic
  conversion for IPv6 and are reported.
- Under a budget ceiling, manifests without that budget limit and manifests with a higher limit
  become invalid for that platform.
- Runtimes that ignored network rules for command steps must enforce or reject.
- Under `security`, runtimes that pass `auth` of MCP servers into steps must move it to a gateway
  or the runtime. Manifests stay valid; `auth.secretRef` becomes optional where the runtime
  provides the credential.
- `isolation` is optional; existing manifests are unaffected.

## Security considerations

The AEP closes SSRF through allowed hosts, prevents silent weakening of reviewed network rules and
keeps provider keys out of reach of prompt injection. Allowing internal destinations requires
agreement of author (manifest) and operator (ceiling), so neither alone can open the internal
network.

Pod or container isolation alone does not protect anything that lives inside the pod: a sandbox
keeps the step away from the node, not from the coding agent's own server, its permission system
or a credential in its environment. The additions for tool server credentials and approval
authority close that gap. A command allow list or approval does not restrict what an allowed
program runs (`make`, test runners); the isolation class is the boundary for that.

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
- **Rely on the engine's own permission system for confirmations.** Rejected: it runs inside the
  execution environment; a proof of concept bypassed it from a command of the same step.
- **Isolation only in the runtime binding.** Rejected: reviewers cannot see or require it, and a
  binding change silently weakens it.
- **A separate AEP for approval authority.** Possible; kept here because the reason and the test
  are the same as for credentials.

Prior art (named under decision D21): [agent-sandbox](https://agent-sandbox.sigs.k8s.io/)
(Kubernetes SIG Apps) provides isolated, stateful execution environments for agents on
Kubernetes (`Sandbox`, with `SandboxTemplate`, `SandboxClaim` and `SandboxWarmPool`), with the
isolation backend chosen by `RuntimeClass` (for example gVisor or Kata Containers). It is one
platform-side way to run steps in a sandbox and keep warm pools; this AEP does not require it and
states only what the effective network and credential isolation must be.

## Implementation status

A proof-of-concept Kubernetes runtime checks the resolved address at connection time in its tool
proxy, rejects workflow-level egress rules it cannot enforce for command steps, and keeps provider
keys out of step pods (short-lived credential per attempt). It has no explicit DNS rebinding test
and no measurement of proxy latency or cost.

The same runtime, extended to interactive sessions with a coding agent, shows the additions:

- **Ceilings and egress.** An egress proxy per tenant with an allow list derived from the tenant
  ceiling and the agent's host list. It denies private, loopback, link-local and CGNAT
  destinations after resolution, and a network policy lets the sandbox reach only that proxy and
  the gateways. Models, hosts and tool servers outside the tenant ceiling reject the agent. It
  differs from this AEP in two points: cost limits above the tenant ceiling are capped instead of
  rejected, and its allow list has host names without ports. Normalisation of IPv4-mapped
  addresses and the translation ranges are not tested.
- **Tool server credentials.** A static analysis server over MCP is reachable only through the
  runtime's MCP gateway (network policy). The gateway accepts a session ticket or a step ticket,
  hides tools that are not in the catalog, refuses calls to them, counts calls against the budget
  and audits arguments and results.
- **Approval authority.** The self-approval attack described in the motivation succeeded while the
  coding agent decided, and failed after the decision moved to a separate container. The same
  command through the console produced exactly one confirmation and ran after "allow once".
  Remaining limits: the engine's plugin runs in the engine process, and reading the session over
  the local API stays possible.
- **Isolation class.** The class maps to a runtime class in a platform profile; only `container` is
  deployed, so a stronger class is not shown.

## Open questions

1. How are ceilings made visible to authors before they apply a manifest, given that they reject
   (status of a binding, a validation command, a published ceiling object)? The proof of concept
   reports them in the status of its binding.
2. Do MCP servers over `streamable-http` fall under the same rules as built-in tools? Proposed
   answer from the proof of concept: the step's connection to the server goes through a component
   outside the step (5.5.1) and is runtime-internal; the server's own egress is restricted by the
   runtime but is not part of the step's `permissions.network` (runtime feedback G77).
3. Are four isolation classes the right granularity, and should `sandbox` be defined by a
   property (syscalls handled outside the host kernel) instead of an example?
4. Does approval authority belong here or in its own AEP, given that it also applies to approval
   steps without any sandbox?

## Decision

Not decided. Number and scope assigned by the maintainer on 2026-11-22.

## References

- Runtime feedback G10, G47, G49, G50, G51, G61, G64, G67, G68, G69
  ([runtime-feedback.md](../docs/runtime-feedback.md)).
- Spec `v1alpha3` sections 5.4, 5.5.1, 7.5, 7.6, 7.8, 7.9, 11.
- AEP-0026 (interactive execution, effect `ask`).
- Kubernetes `NetworkPolicy`; RFC 1918, RFC 6598 (CGNAT), RFC 4193 (unique local IPv6).
- agent-sandbox, Kubernetes SIG Apps.
