# AEP-0031: Kind `McpServer`: one object per MCP server, referenced by name

| | |
| --- | --- |
| **AEP** | 0031 |
| **Title** | Kind `McpServer`: one object per MCP server, referenced by name |
| **Authors** | @agenticworkflowprotocol |
| **Shepherd** | to be assigned (not an author, [aep-process 5.1](../docs/aep-process.md#51-review-before-acceptance)) |
| **Type** | Specification |
| **Status** | Draft |
| **Reviewer roles needed** | runtime implementer (Kubernetes operator), runtime implementer (non-Kubernetes), MCP practitioner, security reviewer |
| **Reviewers** | none yet |
| **Target API version** | `v1alpha4` |
| **Profiles affected** | `mcp`, `audit` (reproducibility record) |
| **Created** | 2026-11-27 |
| **Discussion** | issue to be opened |
| **Supersedes** | the kind `McpCatalog` of [AEP-0007](0007-mcp-connection-catalog.md) (if accepted; the rest of AEP-0007 stays) |
| **Superseded-by** | - |

## Summary

Replace the kind `McpCatalog` of AEP-0007 by a kind `McpServer`: one object per MCP server that
holds the governance description of AEP-0007 (protocol revision, tools with access class,
clearance, scopes, actions and definition digest, resources, prompts, profiles) together with the
transport and the authorization metadata of the connection. It holds no URL and no credential:
both are deployment data of the runtime. A workflow declares a server by name and points to the
object with `ref: {name, version, digest}`, where `version` and `digest` are optional assertions
(AEP-0029). The per-tool `definitionDigest` stays as AEP-0007 requires it.

## Motivation

With AEP-0007 as drafted, a workflow that uses an MCP server repeats the connection in
`spec.mcpServers[]`: transport, `url`, `auth` and either an inline catalog or a reference to an
`McpCatalog`. Two problems follow:

- **Repetition.** Forty workflows that use the same ticket server repeat its transport, its
  authorization metadata and its catalog reference forty times. A change of the server's scopes or
  of its OAuth issuer is a change in every workflow.
- **Update fan-out.** `catalog.ref` requires `name`, `version` and `digest`. Every reviewed change
  of the catalog (a new tool, a changed definition, a new resource template) produces a new version
  and digest, and every workflow has to be updated before it can use the server again, including
  workflows that do not use the changed tool.
- **Half an object.** The catalog describes what a server offers, but not how a runtime connects
  to it; the connection is part of every workflow. In an object store with Kubernetes semantics
  the usual shape is one object per thing (as `StorageClass`, `RuntimeClass` or `IngressClass`),
  owned by the team that runs it, with its own status.

The URL itself is deployment data (runtime feedback G70): the same reviewed server runs at
different addresses in test and production, and the runtime reaches it, not the step (AEP-0023).
Credentials never belong to the manifest (spec 7.9, AEP-0023).

## Goals and non-goals

- Goals: describe an MCP server once and reference it by name; keep the reviewed tool definitions
  pinned; keep URL and credentials out of every manifest; one owner and one status per server.
- Non-goals: changing the catalog semantics of AEP-0007 (access classes, clearance, profiles,
  rules 1 to 11); service discovery; a registry protocol for servers.

## Prior art

kagent, a Cloud Native Computing Foundation project, has a resource `RemoteMCPServer` per server
that agents reference by name and that several agents share. It also carries the URL, header
credentials taken from a Secret and TLS settings, and it observes the tool names a server returns
instead of pinning their definitions. This AEP takes the shape (one object per server, referenced
by name) and leaves the connection data with the runtime.

## Specification

### New kind `McpServer`

`apiVersion: awp.agenticworkflowprotocol.org/v1alpha4`, `kind: McpServer`, with the common
`metadata` and the common spec fields of spec 4.2 (`version`, `owner`, ...). Kind-specific
`spec` fields:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `transport` | string | yes | `streamable-http` or `stdio` (spec 5.5.1). |
| `auth` | object | no | Authorization metadata as in AEP-0007 (`method`, and for `oauth`: `grant`, `resource`, `scopes`, `issuer`). MUST NOT contain `secretRef` or `clientRef`; the runtime supplies credentials outside the execution environment (AEP-0023). |
| `server`, `matchServerInfo`, `protocolVersion`, `tools`, `resources`, `prompts`, `profiles` | | | The catalog fields of AEP-0007 section 5.5.5, with the same rules. |

Rules:

1. An `McpServer` MUST NOT contain a `url`, an `image`, a `command`, a `secretRef`, a `clientRef`
   or any other credential. The runtime resolves where and how it reaches the server from its own
   configuration (for example a binding, AEP-0021 B6), under the constraints of its operator. The
   resolved endpoint MUST NOT contradict the object: a runtime MUST NOT use a server whose
   `serverInfo` differs when `matchServerInfo` is `true`, and MUST apply rule 4 of AEP-0007 to
   every tool it exposes.
2. When `auth.method` is `oauth` and `auth.resource` is absent, the canonical server URI is the
   endpoint the runtime resolved. A reviewer who needs a fixed audience sets `resource`.
3. The **object digest** (spec 9.1, AEP-0010) identifies one reviewed version of the object. The
   **tool definition digest** (`tools.<name>.definitionDigest`, AEP-0007 rule 4) identifies one
   tool definition as the server returns it. They protect different things: the object digest a
   reviewed description, the definition digest against a server that changes a tool after review.
   Making the object digest optional (below) does not make the definition digest optional:
   `definitionDigest` stays REQUIRED under the `security` profile, as in AEP-0007.
4. Rules 2 (no token passthrough), 3 (uncatalogued tools are not exposed) and 11 (explicit tools
   for unattended executions) of AEP-0007 apply unchanged to servers declared through an
   `McpServer`.

### Changes to section 5.5.1 (MCP servers)

An entry of `spec.mcpServers` is either an inline declaration (as in AEP-0007) or a reference:

| Field | Type | Req. | Description |
| ----- | ---- | ---- | ----------- |
| `name` | string | yes | Server name within this workflow (spec 3.4); prefix of its action identifiers. |
| `ref` | object | cond. | `name` (REQUIRED), `version` (OPTIONAL), `digest` (OPTIONAL) of an `McpServer` (reference rules of AEP-0029). |
| `profiles` | list of string | no | Catalog profiles the workflow uses. Absent: all profiles of the object. |
| `transport`, `url`, `auth`, `catalog` | | cond. | Inline declaration as in AEP-0007. |

Rules:

1. An entry MUST contain either `ref` or `transport`; never both. An entry with `ref` MUST NOT
   contain `url`, `auth` or `catalog`.
2. `version` and `digest` are assertions, not selectors (AEP-0029): the runtime resolves the object
   by `ref.name` in the workflow's scope and MUST reject the workflow when a present `version` or
   `digest` does not match the resolved object. The reproducibility record (spec 10.7) lists, per
   server, the name, version and digest of the resolved `McpServer` and the definition digests of
   the exposed tools.
3. `profiles` restricts the action groups of the catalog (AEP-0007 rule 2) to the listed profiles;
   a listed profile that the object does not define is an error. Permissions (spec 7.5) still
   decide which actions an agent may call.
4. Under the `security` profile, a reference MUST carry `version` or `digest` (AEP-0029).
5. `mcpServers[].catalog.ref` of AEP-0007 is removed; an inline `catalog` stays allowed.

## Examples

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: McpServer
metadata:
  name: tickets
spec:
  version: 1.4.0
  owner:
    team: service-desk
  transport: streamable-http
  auth:
    method: oauth
    grant: client_credentials
    scopes: from-catalog
    issuer: https://login.example.com
  protocolVersion: "2026-07-28"
  tools:
    get_ticket:
      access: read
      classification: confidential
      scopes: [tickets:read]
      definitionDigest: sha256:1111111111111111111111111111111111111111111111111111111111111111
    search:
      access: read
      classification: confidential
      scopes: [tickets:read]
      definitionDigest: sha256:2222222222222222222222222222222222222222222222222222222222222222
    add_comment:
      access: write
      classification: internal
      actions: [external.communication]
      scopes: [tickets:write]
      definitionDigest: sha256:3333333333333333333333333333333333333333333333333333333333333333
  resources:
    - uriTemplate: "tickets://{key}"
      classification: confidential
  profiles:
    read: [get_ticket, search]
    comment: [add_comment]
```

```yaml
apiVersion: awp.agenticworkflowprotocol.org/v1alpha4
kind: Workflow
metadata:
  name: ticket-triage
spec:
  version: 0.3.0
  owner:
    team: service-desk
  mcpServers:
    - name: tickets
      ref:
        name: tickets      # version and digest optional; required under the security profile
      profiles: [read]
  agents:
    - id: researcher
      model: { provider: example-provider, name: example-model }
      tools:
        - { type: mcp, server: tickets }
      permissions:
        default: deny
        tools:
          tickets.read: { allow: true }
  workflow:
    - id: research
      agent: researcher
      task: Summarize the open tickets of today.
```

The workflow names neither the URL nor a credential. The runtime resolves both from its own
configuration; with `scopes: from-catalog` and only the `read` profile granted, it requests
`tickets:read`.

## Schema changes

- New root kind `McpServer` with `$defs/McpServerSpec` (`transport`, `auth` without credential
  references, and the catalog fields of `$defs/McpCatalogSpec` of AEP-0007).
- `McpServer` entry of `spec.mcpServers`: `oneOf` inline declaration and reference (`name`, `ref`,
  `profiles`); `catalog.ref` removed.
- Semantic rules: `mcpserver.connection-data` (`url`, `image`, `command` or a credential in an
  `McpServer`), `mcpserver.ref-and-inline`, `mcpserver.unknown-profile`;
  `security.mcpserver-pin-required` under the security profile.
- CRD: plural `mcpservers`, namespaced (see open question 1), with a `status` subresource.

## Conformance impact

- `mcp`: resolution by name; mismatch of an asserted `version` or `digest`; `profiles` restriction;
  rejection of connection data in the object; definition digest checks unchanged.
- `audit`: name, version and digest of the resolved `McpServer` in the reproducibility record.
- New cases: `valid/5.5.6-mcpserver.yaml`, `valid/5.5.1-mcpserver-ref.yaml`; invalid:
  `5.5.6-mcpserver-with-url.yaml`, `5.5.6-mcpserver-with-secret.yaml`,
  `5.5.1-ref-and-inline.yaml`, `5.5.1-unknown-profile.yaml`, `5.5.1-ref-unpinned-security.yaml`.

## Compatibility and migration

AEP-0007 is not accepted, so `McpCatalog` exists in no published draft; nothing needs migration in
`v1alpha4`. Inline declarations with `url` and `auth.secretRef` stay valid. A manifest written
against the draft of AEP-0007 replaces `catalog.ref` by `ref` and moves `transport` and `auth`
(without `clientRef`) into the object.

## Security considerations

- Pinning moves from the reference to the record: without `version` or `digest`, a reviewed change
  of the object applies to every workflow that references it. That is the intent for objects owned
  by the platform; the `security` profile and policies can require a pin, and the record shows what
  was resolved.
- A server that changes a tool after review is still caught by the definition digest (AEP-0007
  rule 4), independent of how the object is referenced.
- Keeping the URL out of the object moves a governance-relevant decision to the runtime; AEP-0021
  B6 requires operator constraints for endpoints, and rule 1 forbids an endpoint that contradicts
  the object.

## Privacy considerations

No change to AEP-0007: clearance per tool and per resource applies; audit events carry digests,
not definitions or content.

## Compliance note

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. This proposal makes no compliance promise.

## Alternatives

- **Keep `McpCatalog` with a required digest** (AEP-0007 as drafted): every catalog change fans out
  to every workflow, and the connection stays repeated.
- **Put the URL into the object** (as kagent does): simpler for runtimes without bindings, but it
  ties a reviewed object to one deployment and makes test and production different objects (open
  question 2).
- **Several servers in one catalog object**: one more shared list that every change touches, the
  problem AEP-0029 describes for the model catalog.

## Implementation status

A proof-of-concept Kubernetes runtime already has a cluster-wide object per MCP server with allow
lists for tools, prompts and resources, resolved by name (runtime feedback G69 to G72); its
endpoints and credentials live in the runtime's configuration. No definition digests yet. No
implementation of this AEP exists.

## Open questions

1. Scope: is an `McpServer` namespaced like the other AWP kinds, or cluster-scoped like
   `StorageClass`, so that one platform team describes a server for all namespaces? A namespaced
   object with a reference grant (AEP-0029) is the alternative.
2. Runtimes without bindings: may an `McpServer` carry an OPTIONAL `url` that a runtime uses only
   when its configuration has none, or does that undo rule 1?
3. Should built-in tool sources (`shell`) get an object of their own in the same shape?

## Decision

-

## References

- Spec sections 3.4, 4.2, 5.5.1, 7.5, 7.9, 9.1, 10.7.
- AEP-0007 (catalog semantics), AEP-0010 (digests), AEP-0021 (bindings, B6), AEP-0023 (credentials
  outside the execution environment), AEP-0029 (references by name).
- Runtime feedback G69 to G72.
- Model Context Protocol specification, revision 2026-07-28 (reference data only).
