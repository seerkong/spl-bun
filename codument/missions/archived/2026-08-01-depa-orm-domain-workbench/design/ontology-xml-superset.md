# Ontology XML Superset

## Layer Invariant

The latest ontology XML model has one grammar and multiple dependency layers:

```text
Type / Relation / Rule / Lifecycle kernels
                  ^
                  |
BusinessObject / Association / DomainPolicy / BusinessProcess / Capability profiles
                  ^
                  |
Operation definitions and invocation presets
                  ^
                  |
Runtime bindings and target projections
```

Dependencies point downward. A `BusinessObject` references a declared type and property identities; it never redeclares properties. An `Association` references a declared relation rather than repeating endpoints or cardinality. Domain policies and lifecycle profiles reference reusable rule and state-machine declarations.

This keeps the type system open to future upper profiles such as `PageObject` without changing or contaminating the type kernel.

## Latest-Only Boundary

The latest bundle assembly is FS-native: `Ontology` is a manifest resource with `manifest.xml`, and its direct catalog children discover resources according to KindDefinition source shape. `TypeModule`, `RelationModule`, `RuleModule`, `LifecycleModule`, `ImplementationMappingCatalog`, and `SchemaEvolutionModule` remain first-class resources, but they are discovered through `FileResourceCatalog` / `ManifestResourceCatalog` entries rather than a legacy wrapper.

This is semantic preservation without grammar compatibility:

- no legacy assembly branch;
- no `Ontology/Resources`, `Ontology/Modules`, grouped module wrappers, or per-resource `href`;
- no duplicate structural ownership;
- no inline BO properties or association endpoints;
- no generated/runtime source code inside XML.

## TypeScript/Bun OM Source

The TypeScript source of truth for Bun OM capability is `depa-ontology.ts`.

Ontology XML is the readable authoring and exchange representation over that surface:

- import maps validated XML Types, Mixins, embedded Properties, and Relations to `defineType`, `defineMixin`, `defineAttribute`, and `defineRelation`;
- import maps behavior metadata through `importBehaviorManifestJson` or the matching behavior APIs only when RuntimeBinding supplies callback identities;
- export reads schema snapshots such as `readSchemaSnapshot` and behavior manifests such as `exportBehaviorManifestJson`;
- export requires explicit policy for XML-only semantic facts and must not fabricate BusinessObject, Operation, Evidence, policy, lifecycle, or other profile declarations from runtime rows alone.

## V5 Concept Projection

| V5 concept | Latest owner |
| --- | --- |
| BusinessObject identity, purpose, property roles, and local resource tree | BusinessObject manifest over one Type |
| Type structure, inheritance, mixins, and embedded properties | TypeModule |
| Association endpoints and cardinality | RelationModule; Association holds RelationRef |
| ConstraintHandler | Domain semantic profile referencing Rule and/or validate Operation |
| Lifecycle states and derivation | LifecycleModule |
| Action / Mutation | BusinessObject-owned local resources; Operation may expose a callable surface with `behavior=action|mutation` |
| BusinessProcess | BusinessProcess profile plus composed Operation |
| Evidence | Flat EvidenceCatalog material |
| ExtensionPoint | Operation or rule binding contract plus external RuntimeBinding |

## Operation Definition

Operation keeps the accepted five dimensions:

- owner: `domain-context|business-object|association|lifecycle|constraint|business-process|capability|raw`;
- behavior: `action|mutation|query|transition|validate|computed|composed|raw`;
- subject: `none|single|selection`;
- invocation: `single|batch`;
- effect: `read-only|write|mixed`.

Input, output, and subject types reference TypeModule declarations. `selection` remains one logical subject selected by `all`, `filter`, or `ids`; `batch` remains multiple keyed invocations. Presets store the exact JSON request body and are validated against the referenced definition.

## Runtime Boundary

The ontology skill owns definitions, references, validation, and target binding declarations. It does not execute database work, compile arbitrary code, or own request state. The workbench runtime remains the authority for target resolution, transactions, execution, observation, and cleanup.
