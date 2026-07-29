# Design: Response Fact Availability

## Authority

`depa-data-domain-operation-contracts` owns the public meaning of response
fields. Runtime owns execution facts, but it may only populate fields that the
contract can represent honestly.

## Request Fact Projection

Add a transport-neutral value and pure helper:

```ts
interface ExecuteOperationRequestFacts {
  readonly context: DomainContextRef | null
  readonly operationRef: string | null
  readonly requestedAtomicity: ExecutionAtomicity | null
}

function projectExecuteOperationRequestFacts(
  input: unknown,
): ExecuteOperationRequestFacts
```

The helper does not admit execution and does not replace
`parseExecuteOperationRequest`. It inspects only three independent facts:

- `context` is available only when `context.id` and `context.version` are
  non-empty strings and the value has the contract-owned context shape;
- `operationRef` is available only when `operation.ref` is a non-empty string;
- `requestedAtomicity` is available only for a recognized atomicity literal.

A malformed sibling field does not erase an independently valid fact. An
invalid fact becomes `null`; there are no empty-string or default-atomicity
sentinels.

## Response Shape

Widen four fields:

```ts
interface ExecuteOperationResponse {
  readonly context: DomainContextRef | null
  readonly operationRef: string | null
  // ...
}

interface OperationAtomicityEffect {
  readonly requested: ExecutionAtomicity | null
  readonly committed: CommittedAtomicity
}

interface OperationTrace {
  readonly operationTree: OperationTraceNode | null
  // ...
}
```

`committed` remains non-null because `none` already means no committed effect.
Before operation admission, `operationTree` is `null`; an operation ref found
in malformed input does not imply that a runtime tree existed.

## Compatibility Rules

- Valid execution responses remain structurally and semantically unchanged.
- Business failure after admission still has non-null request facts and tree.
- Validation failure before admission may preserve valid request facts but has
  `operationTree=null`.
- API version is response-envelope authority and remains `"1"`.
- No parser accepts partial requests for execution.

## Verification

- Red tests first prove the helper/export and nullable failure fixture are
  absent from the current contract.
- Implementation updates only public types/helper and response contract tests.
- Contract package tests, strict declaration build, root build, import scan,
  exact-key checks and JSON roundtrip must pass.
- A fresh coding AttractorCheck confirms no transport/runtime/database owner
  leaked into the contract capsule.
