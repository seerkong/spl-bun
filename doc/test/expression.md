# Test expression module

This document explains how to run expression tests from the spl-bun repo root.

## Prerequisites
- Use Bun (project uses bun test).
- Run commands from: `E:\infra-dev\src\esProc\spl-bun`

## Run expression tests
- Single module test file:
  ```sh
  bun test packages/expression/__tests__/expression.test.ts
  ```

- All expression tests:
  ```sh
  bun test packages/expression/__tests__
  ```

- Specific test by pattern:
  ```sh
  bun test packages/expression/__tests__/expression.test.ts -t "parser"
  ```

## Optional: coverage for expression tests
```sh
bun test packages/expression/__tests__ --coverage
```

## Notes
- If running from another directory, change into the repo root first.
- Tests are in `packages/expression/__tests__`.
