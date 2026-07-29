# Change: migrate ORM consumers to property relations

## Context And Why

Kunun and depa ORM now expose one property-first model: scalar Fields own storage facts, while typed navigation Properties own relation metadata. The spl-bun capsule still contains 82 detached relation fixtures, retired code-first APIs, public-package deep imports and a copied DSL bundle describing the old authority. Leaving that corpus unchanged would make the largest consumer and regression suite contradict the new model.

## Goals / Non-Goals

Goals:

- Migrate all canonical capsule relation fixtures to typed owner/inverse Properties.
- Replace retired `CodeFirstOrm*` consumers with Kunun builders and the public definition compiler.
- Use only published public package roots in committed source and verify against the completed local public artifacts without committing local paths.
- Preserve the full relation runtime behavior and add anti-drift guards.
- Align the copied DSL documentation and production domain runtime/workbench consumers.

Non-goals:

- Publish new Kunun or depa ORM package versions.
- Redesign runtime relation schemas, query semantics or storage adapters.
- Keep a compatibility parser for detached relation syntax.
- Change domain bundle operation semantics unrelated to relation authoring.

## What Changes

- **BREAKING**: canonical host fixtures stop using `:relationships=` and `(relation ...)`.
- **BREAKING**: tests stop importing retired code-first APIs and unexported DSL package subpaths.
- Add a migration oracle that compares normalized pre-migration and property-first catalogs while the old package remains available only as a temporary tool.
- Add property metadata to source Properties and explicit inverse Properties where navigation is public.
- Normalize affected bundle Fields from list annotations and type overrides to Kunun typed Fields with object storage/validation metadata.
- Rewrite code-first coverage around `RowMemberBuilder.Field`, `RowMemberBuilder.Property`, `TypeSystem`, `OrmKununMetadata` and `OrmKununDefinitionCompiler`.
- Update copied docs and architecture guards.

## Impact

- Behaviors: `depa-orm-property-first-consumers`
- Code: `packages/depa-orm-capsule`, `packages/depa-orm-domain-runtime`, related bundle/workbench tests and workspace dependency gates
- Data: test fixtures only; scalar schema equivalence is checked against the legacy compiler and no production database migration occurs
