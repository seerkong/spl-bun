# Verification Matrix

## Contract And Runtime

| Case | Expected | Evidence owner |
| --- | --- | --- |
| valid as-of/effective-on/range JSON roundtrip | exact object accepted | domain-operation-contracts tests |
| invalid `2025-02-29`, timestamp in day field, reversed range | path-aware validation issue | domain-operation-contracts tests |
| timeline supplied to non-temporal Operation | catalog mismatch before allocation | contract/runtime lifecycle tests |
| required timeline absent or mode unsupported | catalog mismatch before allocation | runtime lifecycle tests |
| valid/recorded predicate | SQL AST uses inclusive lower/exclusive upper with null infinity | depa-orm-domain-runtime tests |
| read-only handler calls write | execution rejected and no mutation committed | depa-orm-domain-runtime tests |
| legacy non-temporal presets | existing 315-test baseline remains green | package regression suite |

## Organization Domain

| Case | Expected | Observable evidence |
| --- | --- | --- |
| snapshot `2025-06-30` vs `2025-07-01` | hierarchy/assignment differs on boundary day | tree outcomes |
| BO history over range | ordered valid/recorded versions returned | table outcome |
| compare range | added/removed/moved/renamed facts are deterministic | composite/table outcome |
| preview draft | same validator and projected changes as apply, zero writes | mutation summary empty |
| validate DRAFT | valid result, no status write unless operation contract explicitly owns transition | outcome + probes |
| approve VALIDATED | status becomes APPROVED only | before/after probe |
| apply APPROVED | facts, event and status commit together | diff + mutation summaries |
| apply DRAFT/APPLIED/CANCELLED | invalid transition, no writes | diagnostics/outcome + equal probes |
| hierarchy cycle | rejected | stable constraint code/path |
| assignment overlap | rejected | stable constraint code/path |
| missing target at effective day | rejected | stable constraint code/path |
| injected failure after first replacement | response failure, committed none, before equals after | rollback test |
| atomic transfer batch with one invalid item | all unchanged | probes + committed none |
| best-effort transfer batch | valid item committed, invalid item mapped to diagnostic path | batch item mapping |
| consecutive/concurrent same preset | same before facts, distinct execution ids | lifecycle/server tests |

## API And Browser

| Case | Expected | Evidence owner |
| --- | --- | --- |
| production context list/catalog | organization context/resources/operations/presets visible, no handlers/seed leaked | web-server integration |
| preset execute | fetched request body and captured POST body deep-equal | server/client test |
| unknown context/version/ref | existing transport/domain failure semantics preserved | web-server tests |
| desktop timeline edit | date input updates exact JSON and response uses edited date | Playwright network capture |
| mobile layout | context, operation, timeline, editor and response remain usable without overlap | Playwright screenshot/assertions |
| invalid timeline in editor | execute disabled or failure surfaced without replacing text | component/E2E test |
| apply/invalid preset | outcome, before/after, changes, plan and diagnostics render truthful facts | E2E |

## Completion Gates

Each track must run its scoped tests, package typecheck/build, `git diff --check`, Codument strict validation, configured attractor/gap hooks and independent verify. Mission G5 additionally runs all affected package tests, production import guards and Playwright desktop/mobile scenarios before completion.
