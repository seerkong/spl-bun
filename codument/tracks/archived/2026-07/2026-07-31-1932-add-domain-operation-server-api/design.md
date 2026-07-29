# Design: Domain Operation Server API

## Authority Boundaries

`depa-data-domain-operation-contracts` remains the sole owner of Domain Operation
catalog, request, response, validation, and request-fact projection types.
`depa-data-depa-orm-domain-runtime` owns bundle loading and execution. The server
owns registration, routing, HTTP status selection, and current capability
projection. `depa-data-web-shared` may add route constants only.

The promoted nullable response-fact contract supersedes the older non-null
example in the mission HTTP design: malformed requests may expose `null`
context, operation ref, requested atomicity, or operation tree, and valid facts
are projected independently.

## Registration

`createApp` accepts zero or more registrations shaped as a trusted bundle plus
server-current `DomainOperationCapabilities`. Initialization calls
`loadDomainContextBundle` exactly once per registration, derives id/version
only from `bundle.catalog.context`, freezes the capability value, and rejects a
duplicate context id before serving requests. One id therefore selects one
active version. The default is an empty registry so existing app creation is
unchanged.

The registry contains loaded static definitions and server capability facts,
never a live SQLite database. `executeDomainOperation` continues to own the
complete create-initialize-seed-execute-observe-destroy lifecycle.

## Routes And Shapes

```text
GET  /api/domain-contexts
GET  /api/domain-contexts/:contextId
GET  /api/domain-contexts/:contextId/operations
GET  /api/domain-contexts/:contextId/presets
POST /api/domain-operations/execute
```

Successful GETs return direct contract-owned values: context reference list,
catalog, operation definition list, and preset list. Projection enumerates
public fields and adds the registered current capabilities; it never spreads a
bundle or loaded runtime object. A leak guard checks that seed, bindings,
handlers, probes, functions, and mutable/runtime state do not cross JSON.

All context-scoped GET misses return HTTP 404 with one stable transport error:
`{ error: { code: "DOMAIN_CONTEXT_NOT_FOUND", message, contextId } }`.
This shape is server-owned because it is a routing failure, not an execution
outcome.

## Execute Routing

The POST handler receives Elysia's parsed body object and forwards that exact
object to the runtime after context resolution. It must not normalize, clone,
merge, add defaults, or reconstruct a request.

Before dispatch, the server uses the public request-fact projector only to
resolve and report context facts:

- missing or structurally invalid context: HTTP 200 failure envelope with
  `REQUEST_VALIDATION_FAILED`;
- well-formed unknown context id or requested version mismatch: HTTP 200
  failure envelope with `OPERATION_CATALOG_MISMATCH`;
- resolved context: call runtime with the original body and frozen current
  capabilities, returning its success, partial, or failure envelope as HTTP
  200.

Transport-side envelopes use independently projected facts, `committed:
"none"`, no mutations, and `operationTree: null`. They never borrow identity,
operation, or capability defaults from another bundle.

## Tests And Boundaries

Direct `app.handle` tests use a server-local deterministic bundle fixture and
cover catalog projection, duplicate registration, leak prevention, exact
preset-fetch-to-POST equality, invalid/unknown/version errors, runtime failure
envelopes, sequential/concurrent isolation, and legacy route regressions.
Production source cannot import capsule paths, `halfcode`, `dist`,
`node_modules`, depa-orm internals/unallowlisted subpaths, or test fixtures.
The web-server package declares contract/runtime dependencies and a real
typecheck build; the root build invokes it without `--if-present`.
