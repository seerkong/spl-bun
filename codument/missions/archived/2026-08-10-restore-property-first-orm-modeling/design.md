# Mission Design: restore property-first ORM modeling

## Control Objective

- **Desired state**: the DAG in `mission.xml`, the authority rules in this design, the accepted decisions in `decisions.xnl`, and every success criterion in `proposal.md`.
- **Actual state**: Kunun type-system and runtime class contracts, depa ORM compiler/code-first/runtime contracts, spl-bun fixtures and consumers, real track lifecycle state, test results, and fresh verification evidence.
- **Actuation**: establish current Codument control surfaces where required; create, execute, verify, and archive real tracks in owning projects; revise the mission only from code/test evidence or an explicit human decision.
- **Feedback and drift**: type-system diagnostics, compiler admission tests, composite relation cases, runtime relation suites, package-boundary checks, consumer tests, and independent source-to-runtime audits.

Standard actor semantics are defined by the Mission XML specification. Project-specific actor behavior and ownership are materialized in `mission.xml`.

## Modeling Authority

The authoring pipeline has one direction:

```text
Kunun class/type-system model
  -> typed navigation property + ORM relation metadata
  -> depa ORM compiler projection
  -> normalized OrmRelationSchema / reciprocal runtime index
  -> query and write planning
```

No lower projection may write back into an upstream model or become a second authoring source.

### Field

A field is persisted scalar or structured state owned by a class. It may participate in a storage tuple, index, primary key, validation rule, or database column mapping. It never owns a semantic relation merely because it contains a foreign-key value.

Examples: `Order.shopId`, `Order.tenantId`, `Shop.id`.

### Navigation Property

A navigation property is a typed class member whose value navigates to another domain object or collection of objects. It is part of the Kunun class/type-system model and remains distinct from runtime accessor implementation details.

Examples: `Order.shop: Shop`, `Shop.orders: Order[]`, `Department.employees: Employee[]`.

### ORM Relation Metadata

ORM relation metadata decorates a navigation property. It may describe:

- owning or inverse role;
- target type and cardinality when not fully derivable from the property type;
- ordered local and target field tuples;
- through segments and their ordered tuples;
- join constraints, ordering, limits, distinctness, and load strategy;
- visibility and write policy;
- an inverse property reference.

The owning property is the sole authority for physical join/storage mapping. The inverse property is still a real typed navigation property, but it references the owner through a stable fully qualified property identity and does not repeat the storage tuple.

For example, the semantic target is conceptually:

```text
Order.shop: Shop
  orm.relation.owner
  local_fields  = [tenantId, shopId]
  target_fields = [tenantId, id]
  inverse       = Shop.orders

Shop.orders: Order[]
  orm.relation.inverse_of = Order.shop
```

The exact Kon surface syntax is owned by the Kunun and depa ORM tracks. This mission fixes the semantic constraints without inventing a parser-only syntax ahead of the type-system contract.

## Code-First Boundary

Kunun's public type-system model is the code-first authority. A code-first caller constructs a Kunun class with typed fields and navigation properties, then applies depa ORM annotations/profiles to those members. depa ORM may provide ergonomic adapters, but those adapters must produce or decorate Kunun type-system objects and must not maintain a shadow `EntityModel` plus detached `RelationModel` graph.

Source-first and code-first paths must converge before ORM compilation:

```text
Kon source -> Kunun type-system model --\
                                      -> depa ORM property projector
TypeScript code-first Kunun model ----/
```

Round-trip or structural-equivalence tests must prove that both paths produce the same class members, metadata, diagnostics, and compiled ORM catalog.

## Composite Relation Rules

Composite joins are a primary acceptance case, not an extension:

1. Local and target tuples are ordered lists, never unordered maps or joined strings.
2. Tuple arity must match across each direct or through segment.
3. Every referenced field must exist on the endpoint class and remain a field rather than a navigation property.
4. Corresponding field types must be storage-compatible under an explicit compatibility rule.
5. Nullability and optional navigation semantics must not be inferred from only one tuple member.
6. An inverse property cannot redefine the tuple, storage, or through topology.
7. Runtime edge keys and reciprocal schemas are derived identities/projections; they do not become authoring authority.

## Legacy Migration

The target is a hard authority cut. Canonical docs, composers, and fixtures stop producing `:relationships=` and `(relation ...)`.

If implementation evidence proves that a one-step migration reader is necessary, it must satisfy all of the following:

- read-only input compatibility, never dual emission;
- explicit deprecation diagnostic;
- no merge of conflicting property and relation declarations;
- property metadata wins only after an explicit conflict error, never silently;
- a named removal gate in the owning track;
- canonical tests and examples use only property-first syntax.

The preferred default is immediate rejection because the active test corpus is controlled in spl-bun and can be migrated atomically with package consumers.

## Project And Track Boundaries

### Kunun language track

Owns the distinction and public representation of typed fields versus typed navigation properties, source binding/checking, metadata retention, and programmatic code-first construction. It does not know depa ORM runtime schemas; ORM-specific facts remain an annotation/profile extension consumed downstream.

### depa ORM track

Owns the ORM property annotation schema, diagnostics, projection into `OrmRelationSchema`, reciprocal derivation, code-first adapter, and removal/rejection of detached relation authoring. It preserves runtime relation behavior and package boundaries.

### spl-bun track

Owns the active depa ORM test capsule, copied DSL documentation, fixture migration, consumer/workbench examples, dependency integration, and guards against reintroducing the old syntax. It does not redefine the Kunun or depa ORM contracts.

Mission planning and control-plane readiness tasks are the only direct mission actions. All source, test, and specification changes are made by the real tracks above.

## Controlled Replanning

Replanning requires evidence or a human decision and must update the mission revision plus a report. Expected triggers include:

- Kunun cannot represent a typed navigation property without a language-level contract change beyond the planned track.
- A depa ORM runtime path depends on detached relation-node identity rather than compiled property identity.
- Existing bidirectional relation behavior requires a different owner/inverse projection while preserving single authority.
- Package publication or dependency resolution prevents spl-bun from testing the current workspace sources.
- A bounded compatibility reader is proven necessary by an external consumer not represented in the current test corpus.
- Fresh verification finds that canonical fixtures pass while code-first and source-first models are structurally different.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Treating runtime accessor `prop` as sufficient static typing | Kunun track must expose typed navigation properties in the public type-system model and checker |
| Replacing one detached relation registry with another shadow builder model | Code-first structural-equivalence and package-boundary tests |
| Composite tuple order or type drift | Ordered tuple contract and negative diagnostics for arity/order/type mismatch |
| Owning and inverse properties both become storage writers | Owner-only physical metadata; inverse uses stable `inverse_of` reference |
| Cycles caused by bidirectional domain navigation | Type references remain symbolic during binding; package dependencies remain acyclic |
| Compatibility layer becomes permanent | Canonical-only emission, explicit deprecation, conflict rejection, removal gate |
| Consumer fixtures self-validate an incorrect implementation | Final fresh audit follows source and code-first inputs through live compiler/runtime behavior |

## Fresh Verification Correction Policy

An implementation hidden from a package root is still a live authority when it
is compiled, declared, shipped as source, or positively exercised. Mission-level
verification therefore scans source and generated package artifacts, not only
public root exports. Any retained detached ORM annotation parser or shadow
`RelationModel` emitter must be physically removed or isolated behind a bounded,
tested migration-only boundary that is excluded from production artifacts.
