# Design: Domain Operation Contracts

## Context

The mission requires one HTTP-compatible Operation language shared by multiple
DomainContext bundles, a depa-orm-backed runtime, the server, and the
workbench. Existing SPL DTOs in `packages/web-shared` have a different owner,
while framework-specific or database-specific types would make the contract
non-portable.

The contract package therefore owns only immutable JSON-compatible values and
pure validation. Runtime behavior remains in later tracks.

## Package Boundary

Create `packages/domain-operation-contracts` with package name
`depa-data-domain-operation-contracts`.

Allowed contents:

- literal value sets and TypeScript discriminated unions;
- catalog, preset, request, response, and capability DTOs;
- pure parsers and consistency validators;
- JSON fixtures and contract tests.

Forbidden dependencies and responsibilities:

- Vue, Vite, Elysia, SQLite, Kon compiler, depa-orm implementation, or capsule
  fixtures/internals;
- target resolution, operation handlers, selection expansion, batch
  scheduling, transactions, request lifecycle, routes, or UI;
- DOM state, framework request objects, database rows, executable bindings, or
  internal compiler ASTs in public DTOs.

## Public Model

### Operation Definition

An `OperationDefinition` declares:

- stable `ref`;
- `ownerKind` and optional semantic `ownerRef`;
- `behaviorKind`;
- `subjectKind`;
- `invocationMode`;
- `effect`;
- input schema and capability requirements.

The value sets are:

- owner: `domain-context`, `business-object`, `association`, `lifecycle`,
  `constraint`, `business-process`, `capability`, `raw`;
- behavior: `action`, `mutation`, `query`, `transition`, `validate`,
  `computed`, `composed`, `raw`;
- subject: `none`, `single`, `selection`;
- invocation: `single`, `batch`;
- effect: `read-only`, `write`, `mixed`.

`atomicity` is not part of this identity. It is requested under execution as
`atomic` or `best-effort`.

### Subject And Invocation

`Subject` is a discriminated union:

- `none`;
- `single` with a stable `{ type, id }` reference;
- `selection` with an `all`, `filter`, or `ids` selector.

`Invocation` is independently discriminated:

- `single` has one subject, verb, and payload;
- `batch` has one or more uniquely keyed items, each with its own subject,
  verb, and payload.

A selection therefore remains `mode: "single"`. A batch item may itself use a
selection subject. Validators reject duplicate item keys and malformed or
empty batches.

### Catalog

Catalog DTOs expose:

- DomainContext id, bundle version, title, and description;
- read-only model sources;
- semantic resources;
- Operation definitions and input schemas;
- invocation presets;
- current capability projection.

`apiVersion` versions the transport envelope. It is distinct from the context
or bundle version.

### Execute Request

The request carries:

- `apiVersion: "1"`;
- exact context id/version;
- an Operation declaration sufficient for preview and catalog consistency
  checking;
- a single or batch invocation;
- execution atomicity and requested observation channels.

The preview JSON is the request object. Parsers may return an equivalent typed
value but cannot add a second hidden request model.

### Execute Response

The response envelope reports `success`, `partial`, or `failure` and contains:

- outcome: `table`, `entity`, `collection`, `scalar`, `graph`, `tree`, or
  `composite`;
- effects, including requested/committed atomicity and batch item mapping;
- observations for before, after, diff, and probes;
- trace with operation tree, stages, public plans, and optional SQL;
- structured diagnostics.

The stable diagnostic set includes:

- `UNSUPPORTED_ATOMIC_COMPOSITION`;
- `CROSS_DATASOURCE_ATOMICITY_REJECTED`;
- `BATCH_ITEM_MAPPING_UNAVAILABLE`;
- `SQL_TRACE_UNAVAILABLE`;
- `OPERATION_CATALOG_MISMATCH`;
- request validation and execution/cleanup categories needed by the envelope.

Unavailable SQL or row-level mapping is represented explicitly. The contract
does not claim those capabilities exist.

## Validation

The package exports pure unknown-input parsing with a structured error carrying
one or more issues:

```ts
interface ContractValidationIssue {
  readonly path: string
  readonly code: string
  readonly message: string
  readonly expected?: JsonValue
}
```

Validation covers object/array/string/value shape, discriminants, non-empty
stable refs, batch item uniqueness, and JSON-compatible payloads. A separate
pure catalog consistency validator compares request and definition dimensions,
context version, and invocation/subject shape. It does not execute capability
logic or database work.

## Test Strategy

Tests are written before each implementation slice:

1. request/five-dimension tests first, then DTO/parser implementation;
2. response/catalog/diagnostic tests first, then response and compatibility
   implementation;
3. package boundary, declaration build, focused tests, and root build as the
   final gate.

Representative fixtures use generic example values only. JSON serialization
and parsing are exercised directly so future server and UI tracks can reuse the
same objects without translation.
