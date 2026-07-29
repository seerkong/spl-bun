# Migrate ORM Consumers To NamedConf

## Why

Kunun 1.0.4 and depa ORM 0.2.0 have completed the strict annotation hard cut, but spl-bun still carries the former `#(orm #kind :{...})` transport across fixtures, tests, docs, scripts, reference bundles and generated output. Current installs also resolve through global symlinks while package manifests still declare Kunun 1.0.3 and depa ORM 0.1.x, so passing local tests is not sufficient package-boundary evidence.

## Change

- Migrate ORM annotations to external prefix `KnKnot.NamedConf`: `#(orm :field = {...})`, `#(orm :relation = {...})`, `#(orm :entity = {...})`, and `#(orm :datasource = {...})`.
- Keep Field persistence metadata flat. Relations remain exclusively on typed Properties. DataSource identity remains exclusively the `(datasource #name)` declaration.
- Preserve the existing property-first migration oracle: 30 groups, 82 inventoried fixtures and 216 relations, including ordered/composite tuples, through topology, visibility, validation/storage and write policy.
- Update and then retire the legacy migration generator so no repository tool can recreate the forbidden syntax.
- Update formal dependency declarations to Kunun 1.0.4 and the five depa ORM 0.2.0 packages. Use hashed, ephemeral sibling tarballs only for isolated verification; do not commit local path dependencies and do not publish.
- Add a classification-driven residue guard covering live sources, fixtures, tests, docs, scripts, generated output, dist, manifests, ignored lock state and active Codument evidence.
- Verify compiler, SQLite runtime, both reference domain matrices, server catalog/presets and the web workbench end to end.

## Scope

In scope are `packages/depa-orm-capsule`, `packages/depa-orm-domain-runtime`, `packages/domain-context-bundles`, `packages/kon-spl-dsl`, relevant `packages/web-server` fixtures and `packages/web-ide` verification or required integration changes, plus current Codument behaviors and track evidence.

Immutable archived Codument history is not rewritten. Explicit negative literals may remain only when a test directly asserts that the canonical compiler or guard rejects them. Actual npm publication and registry-only lock regeneration are outside this track and remain mission G5 work.

## Success

The track succeeds only when the entire positive corpus compiles against the canonical 0.2.0 contract, runtime behavior remains equivalent, manifests contain only formal versions, isolated package installation cannot resolve through hidden symlinks, the live workbench works, and the post-build residue guard reports no unclassified legacy authority.
