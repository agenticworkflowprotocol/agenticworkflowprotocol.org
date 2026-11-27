# AEP-0023: Step isolation: network and credentials

| | |
| --- | --- |
| **AEP** | 0023 |
| **Title** | Step isolation: network destinations, platform ceilings, credentials and approvals outside the execution environment |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), security reviewer, platform operator |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha4` (`v1alpha3` until [D24](../docs/decisions.md#d24-v1alpha4-becomes-the-current-draft)) |
| **Profiles affected** | `core`, `security` |
| **Created** | 2026-11-22 |
| **Discussion** | issue to be opened |
| **Supersedes** | - |
| **Superseded-by** | - |

## Summary

`permissions.network` says what a workflow needs, but not how destinations are written, how the
rule relates to limits the platform sets, or what happens when a runtime cannot enforce it. Where
credentials and approvals live is not covered at all. This AEP states what a reviewer of the
manifest must be able to rely on, and nothing about how a runtime achieves it:

- destinations are structured (`allowTo`: `host` or `cidr`, optional `ports`);
- a runtime enforces the network rules or rejects the manifest;
- internal destinations are denied under `security` unless the manifest allows them;
- anything above a platform ceiling is rejected, never adjusted;
- credentials and approvals stay outside the execution environment;
- other secrets can be delivered as a header to exactly one destination, never into the step;
- the identity of an execution can serve as a credential (`workloadIdentity`);
- an agent can require a minimum isolation class.

How to enforce this safely (address checks, proxies, gateways) is informative guidance at the end.
It answers runtime feedback G05, G10, G47, G49, G50, G51, G55, G61, G64, G67, G68, G69 and G89.

## Motivation

- **Two places restrict egress (G47).** A platform restricts network access (network policies, an
  egress proxy, a firewall); the manifest says what the workflow needs. The specification does not
  relate the two, so an author cannot tell whether a reviewed manifest will run.
- **Enforcement is not required (G10, G51).** A runtime that cannot restrict command steps by host
  name can silently ignore the rule.
- **No syntax (G49).** Wildcards, ports, addresses and ranges are undefined; a port appended to an
  IPv6 address is ambiguous.
- **Internal destinations (G50).** An allowed host can resolve to an internal address, for example
  the metadata service of a cloud. A proof of concept had exactly this hole.
- **Credentials and approvals inside the step (G61, G64, G69).** A runtime may hand a model or tool
  server credential to the step, where any command can read it. A proof of concept also showed
  that a coding agent's own permission system can be answered from inside: a command read the
  agent's local server password and confirmed its own requests.
- **Other secrets end up in the step (G05, G55).** A token for a ticket system or a chat bot that a
  command step uses is an environment variable of the step, readable by every command it runs, and
  a destination sees only a shared bot secret, not which workflow acts.
- **Isolation is invisible (G67).** An agent that runs code from an untrusted repository needs more
  than a container; the manifest cannot say so.
- **Ceilings (G68).** Whether a platform limit rejects a manifest or silently lowers a value is
  undefined; silent changes make the run differ from what was reviewed.

## Goals and non-goals

- Goals: rules a reviewer can rely on; enforce or reject; no silent adjustment.
- Non-goals: any mechanism (proxy, mesh, gateway, sandbox technology); inbound traffic; secret
  stores; what data a step may send to a tool server (G77).

## Specification

### Changes to section 7.5.1 (fields)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `network.egress` | string | `allow` or `deny`. Default `allow`; under the `security` profile, when a `permissions` object is present, the default is `deny`. |
| `network.allowTo` | list | Destinations reachable when `egress` is `deny` (section 7.5.8). Replaces `allowHosts`. |

### New section 7.5.8 (network destinations)

An entry of `allowTo` is an object with exactly one of `host` and `cidr`:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `host` | string | A host name (`api.example.com`) or a subdomain wildcard (`*.example.com`: at least one label before `example.com`). No port, no address. |
| `cidr` | string | An IPv4 or IPv6 range (`10.20.0.0/16`, `2001:db8::/32`); a single address has a full prefix (`/32`, `/128`). |
| `ports` | list | Optional. Entries with `port` (1 to 65535), optional `endPort` (a range) and `protocol` (`TCP` default, `UDP`). Absent: every port. |

`host` entries match the requested name, `cidr` entries the address connected to. The fields follow
the egress rules of Kubernetes network policies, so that a `cidr` entry translates directly into an
`ipBlock`. Validators MUST reject string entries, a bare `*`, a `*` outside the first label, and an
entry with both or neither of `host` and `cidr`.

### New section 7.5.9 (enforcement)

- A runtime MUST enforce the network rules for every step type it runs, with a mechanism of its
  choice. If it cannot enforce a rule for a step type, it MUST reject the manifest before any step
  runs. It MUST NOT run a step with weaker restrictions.
- **Internal destinations (security profile).** Connections to loopback, private, link-local and
  shared address space (RFC 1918, RFC 4193, RFC 6598, RFC 3927 and their IPv6 counterparts) are
  denied unless a `cidr` entry of the manifest contains the address and the platform ceiling allows
  it. A `host` entry never allows an internal address. The check applies to the address actually
  connected to.
- The conformance statement says per step type how network rules are enforced.

### New section 7.5.10 (platform ceilings)

A platform MAY set ceilings (for example per tenant) on permissions, models, tool servers, network
destinations, autonomy (AEP-0026), isolation and budgets. A ceiling never changes a manifest:

- If the manifest or a request asks for more than a ceiling allows, the runtime MUST reject it
  before anything runs, with reason `ceilingExceeded` and the field.
- If a ceiling sets a budget limit, the manifest MUST declare that limit, at most the ceiling.
- A stronger isolation class than required is no deviation.

Change to spec 5.7: replace "Runtimes MAY enforce stricter limits than the manifest declares (for
example tenant quotas)" with "A runtime that enforces a stricter limit than the manifest declares
MUST reject the manifest or execution (section 7.5.10)."

### Credentials and approvals outside the execution environment (sections 5.5.1, 7.6, 7.9)

Under the `security` profile:

- Model credentials and tool server credentials (for example `auth` of an MCP server) MUST NOT be
  visible to a step: not in its environment, files or arguments. `auth` of an MCP server MAY be
  satisfied by the runtime instead of a manifest secret.
- Approvals (spec 7.6) and confirmations of single actions (AEP-0026) MUST be decided outside the
  execution environment, from an authenticated identity, over a channel the execution environment
  cannot reach. Nothing that carries or proves a decision may be readable or writable inside.
- What leaves the execution environment MUST be enforced outside it: model calls, tool server
  calls, network connections, pushes, approvals and confirmations. For actions that stay inside
  (local commands, file changes), the boundary is the isolation class and what the execution
  environment can reach; a permission system inside the step (for example a coding agent's own)
  MAY check in addition and is not enforcement.

Endpoints of declared model providers (spec 5.4.3) and of declared MCP servers (spec 5.5.1) need
no `allowTo` entry. They are reached by the runtime, outside the execution environment, at the
address its runtime configuration resolves for them, and that configuration is bounded by the
platform ceilings (section 7.5.10). `allowTo` lists only what the step itself connects to.

### Secret delivery to a destination (section 7.9)

Credentials for model providers and tool servers already stay outside (above). Other secrets, for
example a token that a command step uses against a ticket system, reach the step as environment
variables today. A secret entry gains `deliver`:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `deliver` | object | Optional. How the runtime delivers the secret. Absent: the secret is an environment variable of each consumer in `scope`, named exactly like the secret (`name`). |
| `deliver.header` | object | The runtime sets the secret as an HTTP request header, outside the execution environment, on connections to one destination: `host` (as in section 7.5.8, no wildcard), `port` (default 443), `name` (header name, for example `Authorization`) and `prefix` (optional, for example `"Bearer "`). |

Rules for `deliver.header`:

1. The value MUST NOT enter the execution environment: not as an environment variable, file or
   argument. The runtime sets the header only on requests to exactly `host` and `port`, and only
   over TLS.
2. The destination MUST be reachable under `permissions.network` (an `allowTo` entry that matches
   `host` and `port`, or `egress: allow`); otherwise the manifest MUST be rejected.
3. Two secrets with `deliver.header` for the same `host`, `port` and header `name` make the manifest
   invalid.
4. A runtime that cannot deliver a header outside the execution environment MUST reject the
   manifest; it MUST NOT fall back to an environment variable.
5. A step MAY send a placeholder value in the header (for example an SDK that requires one); the
   runtime replaces it. The placeholder is not a secret and carries no meaning.

This answers G05 (naming of the environment variable when `deliver` is absent) and extends G61 to
every secret whose destination is an HTTP host.

### Execution identity as a credential (sections 5.4.4, 5.5.1, 7.9)

Some destinations accept an identity token instead of a stored secret. A credential object
(`mcpServers[].auth`, `auth` of a remote agent, `secrets[].deliver`) MAY use:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `method` | string | `workloadIdentity`. |
| `audiences` | list of string | REQUIRED with `workloadIdentity`: the audiences the token is issued for; at least one. |

Rules for `workloadIdentity`:

1. No secret is stored or declared. The runtime issues a short-lived token for each execution (or
   attempt) and sets it outside the execution environment, like a delivered header.
2. The token identifies the issuer (the runtime installation), the workflow (`metadata.name`,
   `spec.version`, digest), the execution id and the actor of the execution (spec 10.1). Its
   lifetime MUST NOT exceed the remaining time limit of the execution.
3. The destination validates the issuer and the audience. A token MUST NOT be accepted by the
   runtime itself or its gateways as their own credential.
4. A runtime that cannot issue such tokens MUST reject the manifest.

This credential runs from the runtime to the destination. It is distinct from the short-lived
credential in the implementer guidance below, which authenticates a step to the runtime's
gateway and never leaves the runtime. It answers G55 from the other side: the destination can see
which workflow and execution acts, without a shared bot secret.

### Changes to section 5.4 (agents): isolation class

| Field | Type | Description |
| ----- | ---- | ----------- |
| `isolation` | string | Minimum isolation of the agent's steps: `process`, `container`, `sandbox` (a kernel boundary in user space or an equivalent) or `vm` (a hardware-virtualised boundary). |

A runtime MUST run the agent with at least this class or reject the manifest before any step runs.
Which mechanism provides a class is platform configuration and listed in the conformance statement.

### Change to the profile table (spec 11)

`security`: add network enforcement or rejection, internal destinations, credentials and approvals
outside the execution environment, isolation class enforced or rejected.

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
        - cidr: 10.20.0.0/16      # internal ticket system: needs a cidr entry
          ports:
            - port: 8443
  agents:
    - id: triage
      isolation: sandbox
      model:
        provider: example-provider
        name: example-model
  workflow:
    - id: run
      agent: triage
      task: Triage new tickets.
```

The agent reaches `api.example.com` on port 443 and the ticket system if the platform ceiling allows
`10.20.0.0/16`. If `api.example.com` resolves to an internal address, the connection is denied. A
runtime that offers only containers rejects the agent.

A command step that calls a ticket API with a token it never sees, and an MCP server that accepts
the execution's identity:

```yaml
spec:
  permissions:
    network:
      egress: deny
      allowTo:
        - host: tickets.example.com
          ports:
            - port: 443
  secrets:
    - name: TICKETS_TOKEN
      source: secret-manager
      scope: [command]
      deliver:
        header:
          host: tickets.example.com
          port: 443
          name: Authorization
          prefix: "Bearer "
  mcpServers:
    - name: inventory
      transport: streamable-http
      url: https://mcp.example.com/inventory
      auth:
        method: workloadIdentity
        audiences: [inventory.example.com]
```

The command sends its requests to `tickets.example.com` without a token (or with a placeholder);
the runtime sets the header outside the step. `TICKETS_TOKEN` is not in the step's environment.

## Schema changes

- `permissions.network.allowTo`: objects with `host` or `cidr` and `ports`; `allowHosts` removed
  (`awp-check.mjs migrate` converts names and ranges).
- `agents[].isolation`: enum `process`, `container`, `sandbox`, `vm`.
- `secrets[].deliver.header` (`host`, `port`, `name`, `prefix`); credential objects gain `method`
  `workloadIdentity` with `audiences`.
- Semantic rules for invalid hosts, ranges and port ranges; `secret.deliver-unreachable`,
  `secret.deliver-conflict`, `auth.workload-identity-audiences`.

## Conformance impact

- `core`: `allowTo`, enforce or reject, ceilings reject.
- `security`: `egress: deny` default, internal destinations, credentials and approvals outside,
  isolation class.
- Valid: `7.5.8-allow-to.yaml`. Invalid: string entry, bare wildcard, host with port, host and cidr.
- Valid: `7.9-deliver-header.yaml`, `7.9-workload-identity.yaml`. Invalid: delivery to a
  destination outside `allowTo`, two secrets for the same destination and header,
  `workloadIdentity` without `audiences`.
- Runtime (`security`): a delivered secret is absent from the step environment; a runtime without
  header delivery or token issuance rejects the manifest.

## Compatibility and migration

- `allowHosts` becomes `allowTo` (incompatible, allowed in an alpha version); the migration tool
  converts it.
- Under `security`, manifests with `permissions` but without `network` change from "egress allowed"
  to "egress denied".
- Under a budget ceiling, a manifest without that limit or with a higher one is rejected.

## Security considerations

The AEP keeps reviewed network rules from being weakened silently, keeps internal networks closed
unless author and operator both open them, and keeps credentials and decisions out of reach of
prompt injection. It does not protect what lives inside the execution environment: a compromised
step can still damage its own workspace, which is why the isolation class exists.

## Privacy considerations

None beyond spec 7.2. Destinations in audit events may reveal which services a workflow uses.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Leave network to the platform.** Rejected: the reviewed manifest would say nothing about what a
  workflow reaches.
- **Adjust instead of reject at ceilings.** Rejected: the run would differ from the reviewed manifest.
- **Rely on the engine's own permission system.** Rejected: it runs inside and was bypassed in a
  proof of concept.

Prior art (decision D21): [agent-sandbox](https://agent-sandbox.sigs.k8s.io/) (Kubernetes SIG Apps)
runs isolated, stateful agent workloads with the isolation backend chosen by `RuntimeClass`; it is
one platform-side way to provide an isolation class. [kagent](https://kagent.dev) (a CNCF project)
attaches a credential to an egress origin (a header with an optional prefix, set by a gateway that
replaces a placeholder) and can authenticate an agent to a destination with a short-lived token
for the running agent and named audiences; `deliver.header` and `workloadIdentity` follow these
two patterns.

## Implementer guidance (informative)

Hardening that a conforming runtime will need, without being part of the rules above:

- **Address checks.** Check the address actually connected to, also after redirects and DNS
  changes. Normalise IPv6 addresses that embed IPv4 (`::ffff:0:0/96`) before checking, and treat
  translation ranges (NAT64 `64:ff9b::/96`, 6to4 `2002::/16`) as internal.
- **Network.** A per-workload egress proxy with an allow list derived from `allowTo`, plus a network
  policy that lets the workload reach only that proxy, enforces `host` entries; `cidr` entries map to
  `ipBlock` with `ports`.
- **Credentials.** A gateway outside the step holds model and tool server credentials and
  authenticates the step with a short-lived credential bound to one execution or attempt; the same
  gateway can enforce tool permissions and budgets.
- **Approvals.** A separate component with its own process namespace receives each tool call before
  it runs and asks the person through the runtime's user interface. Running the decision under the
  same user ID as the step's commands is not enough.

## Implementation status

A proof-of-concept Kubernetes runtime keeps model keys out of step pods (short-lived credential per
attempt), reaches MCP servers only through a gateway with a session or step ticket, checks resolved
addresses in its tool proxy, runs an egress proxy per tenant that denies internal destinations, and
decides tool calls of interactive sessions in a separate container. On a test installation the
self-approval attack succeeded while the coding agent decided and failed afterwards. It differs from
this AEP: cost limits above a tenant ceiling are capped, its allow lists have host names without
ports, and no isolation class above `container` is deployed.

## Open questions

1. How are ceilings made visible to authors before they apply a manifest?
2. Should a `host` entry be able to allow internal addresses when marked explicitly (for example
   `internal: true`), for internal services addressed by name?
3. Are four isolation classes the right granularity, and should `sandbox` be defined by a property?
4. Should approval authority be its own AEP, since it also applies to approval steps without any
   sandbox?
5. Should separation of duties (spec 7.8) state explicitly that it is checked against the
   authenticated identity of a decision, never against an identity the step asserts?
6. Should `deliver` also offer a query parameter or a client certificate, or is a header enough?
7. Should the claims of a `workloadIdentity` token have fixed names (for example following the
   SPIFFE or OpenID Connect conventions), so that destinations can validate them portably?

## Decision

Not decided. Number and scope assigned by the maintainer on 2026-11-22.

## References

- Runtime feedback G05, G10, G47, G49, G50, G51, G55, G61, G64, G67, G68, G69, G89
  ([runtime-feedback.md](../docs/runtime-feedback.md)).
- kagent (CNCF): egress policies with credential headers, actor tokens with audiences.
- Spec `v1alpha3` sections 5.4, 5.5.1, 5.7, 7.5, 7.6, 7.9, 11.
- Kubernetes `NetworkPolicy`; RFC 1918, RFC 3927, RFC 4193, RFC 6598.
- agent-sandbox, Kubernetes SIG Apps.
