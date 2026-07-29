# Design

## Canonical Authoring Contract

ORM configuration is a prefix annotation attached to the declaration that owns the meaning. The transport is Kunun `KnKnot.NamedConf`; it is not an ORM configuration object nested inside Class, Field or Property type payloads.

```kon
#(orm :datasource = {
  kind = sqlite
  env_conn = DATABASE_URL
  options = { pool = 10 }
})
(datasource #main)

#(orm :entity = {
  primary_key = [id]
  datasource = main
  db = { tableName = orders }
})
(class #Order :[
  #(orm :field = {
    column_name = id
    declared_type = TEXT
    nullable = false
  })
  (!String field #id)

  #(orm :relation = {
    role = owner
    cardinality = many_to_one
    optional = false
    from = { keys = [shop_id] has_foreign_key = true }
    to = { keys = [id] has_foreign_key = false }
    inverse_property = Shop.orders
  })
  (!Shop prop #shop)
])
```

The corresponding inverse is another typed Property, for example `Shop.orders`; no relation annotation is attached to scalar `shop_id`. Multi-column association tuples therefore remain relation metadata owned by the navigation Property rather than becoming an accidental single-field authority.

## Hard-Cut Rejections

The live corpus and repository tools must reject or eliminate:

- marker transport such as `#(orm #field :{...})` and `#(orm #relation :{...})`;
- a `storage = {...}` wrapper inside the Field profile;
- any relation profile on a Field, detached relation primitive, relationship section or shadow code-first relation model;
- direct datasource configuration that bypasses the prefix annotation;
- datasource `key` or `name` duplicated inside the annotation;
- compatibility readers, fallback projectors or generators that can recreate these forms;
- manifests pinned to Kunun 1.0.3 or depa ORM 0.1.x.

## Authority Boundaries

- Kunun public ClassDefinition, Field, Property, DataSource declaration and NamedConf metadata are the only source/programmatic structure authority.
- depa ORM 0.2.0 projects that model into runtime schema and owns strict diagnostics, but does not invent a second authoring graph.
- Field annotation owns physical column profile only. Property annotation owns navigation relation semantics. DataSource declaration name owns identity; its annotation owns provider configuration.
- Bundle source owns domain models. Server and web IDE display/execute those models but do not rebuild them.
- `package.json` owns committed dependency intent. Ephemeral tarballs own pre-publication package-boundary evidence only; sibling/global symlinks and the ignored root lockfile are not authorities.

## Migration Control Loop

1. Observe and classify every old-form occurrence before editing. Record source category and expected disposition.
2. Establish a legacy projection and canonical projection of the 30 group, 82 fixture, 216 relation oracle.
3. Update the migration renderer to emit NamedConf and flatten Field storage, execute the one-time migration, and compare semantic projections.
4. Remove or close the legacy reader/emitter path. The durable repository tool is the canonical-only guard, not a compatibility migrator.
5. Migrate remaining embedded source, datasource fixtures, docs, runtime/bundles/server and generated output.
6. Build and execute the full host stack, then scan again because build output is part of the contract surface.
7. Use fresh AttractorCheck feedback after each phase; fix any completion-critical drift before advancing.

## Classification And Guard

The guard consumes a machine-readable classification manifest. Positive/live categories must contain zero forbidden forms. Explicit rejection fixtures can retain the smallest old-form literal required by the assertion and must link to the test that proves rejection. Only `codument/tracks/archived` and `codument/missions/archived` are immutable-history exemptions. Active mission examples are scanned and reported as control evidence rather than hidden by a broad `codument/**` exclusion.

The scan covers source, fixtures, tests, support code, docs, migration/generation scripts, generated inventories, `dist`, manifests and the ignored lockfile. It rejects old markers, nested Field storage, relation-on-Field, direct datasource Conf, duplicate datasource identity, retired relation authorities, and old dependency versions in manifests or any authoritative lock. The ignored `bun.lock` is a dedicated non-authority evidence category: the guard reports its stale versions and fails if it becomes Git-managed or participates in isolated package proof, but G4 does not require registry versions that do not yet exist. Guard self-tests inject each rejecting category and require path-specific diagnostics.

## Dependency Provenance

Committed manifests use `kunun: 1.0.4` and depa ORM package versions `0.2.0`. Because those versions are intentionally not published during this track, verification packs sibling repositories to an external temporary directory, computes SHA-256, checks package name/version/content, installs those tarballs into an isolated temporary consumer and validates public imports and a canonical compile. The report must show that resolved modules live under the isolated consumer, not under global install paths, sibling repositories or workspace symlinks.

The root `bun.lock` is currently ignored and stale. This track reports and prevents it from becoming false evidence. Registry-only lock regeneration and registry-targeted dry runs happen in mission G5 after package availability permits them.

## Runtime And UI Verification

The compiler and capsule preserve all existing relation semantics. Domain runtime must compile canonical source and perform public SQLite Writer/Reader operations. Both reference bundles retain their complete operation matrices and expose canonical model source through server catalog/preset APIs. The web IDE is verification scope by default: it is edited only if the real workbench flow cannot render or execute canonical bundle source without a change.
