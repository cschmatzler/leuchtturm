# Leuchtturm Data Model Direction

## Goal

Design a document management data model for Leuchtturm that:

- feels like a mix of **Mayan EDMS** and **Alfresco**
- stays in the **medium-ops** range
- is still **enterprise-ready**
- maps cleanly to **PostgreSQL + Drizzle + Zero**
- delegates identity, sessions, organizations, and memberships to **Better Auth** with the **org plugin**

This document captures the current recommendation, the reasoning behind it, the tradeoffs, and the full target model in one place.

---

## Context

The broader DMS research in `research/*.md` compared several families of systems:

- **Paperless-ngx**: great simple archive, low-ish ops, but lighter governance and extensibility
- **Mayan EDMS**: strong document/file/version/page model, OCR-aware, first-class metadata and checkouts
- **Documize**: good section-based authored documents, weaker structured DMS model
- **Nextcloud**: excellent file platform, weaker document semantics
- **Alfresco**: extremely flexible type/aspect/association model, but heavy operationally because of the generic repository architecture
- **Nuxeo / SharePoint / Documentum**: strong enterprise platforms, but operationally heavier than the target

The target here is **not** “clone Alfresco” and **not** “clone Mayan”.

The target is:

> **Mayan-style document discipline + Alfresco-style extensibility, implemented as a typed relational model instead of a generic repository engine.**

That is the best fit for:

- medium operations burden
- high flexibility
- enterprise features
- Drizzle-friendly SQL modeling
- Zero-friendly sync/query modeling

---

## Stack constraints that matter

This is not an abstract DMS exercise. The implementation target matters.

### PostgreSQL

Postgres strongly favors:

- explicit tables
- explicit foreign keys
- well-indexed relational joins
- typed columns for query-critical data
- JSON only where flexibility matters more than relational querying

### Drizzle

Drizzle strongly favors:

- one table per concept
- clear FK graphs
- normal joins instead of runtime-polymorphic records
- predictable relation definitions
- avoiding generic “entity_type/entity_id” patterns in core paths

### Zero

Zero strongly favors:

- stable tables with stable primary keys
- explicit relationships
- predictable, queryable shapes
- denormalized “current view” data for sync-heavy UI usage

It is a bad fit for a model that depends on:

- a single giant sparse property table
- path-based identity
- deep polymorphic runtime indirection
- storing most business data inside JSON blobs

### Better Auth org plugin

Identity and organization state should come from Better Auth, not from application-owned auth tables.

That means the app model should **reference**:

- `user`
- `organization`
- `member`
- org roles / invitations / session state as needed

But the app should **not own**:

- `user`
- `session`
- `account`
- `verification`
- custom organization membership tables

This also means the earlier custom auth schema should be treated as temporary / replaceable, not as part of the target DMS model.

---

## Primary recommendation

## Build a typed relational DMS, not a generic content repository

The core recommendation is:

- take **Mayan’s document/file/version/page discipline**
- take **Alfresco’s type/facet/relationship thinking**
- do **not** take Alfresco’s generic node/property/aspect storage model
- do **not** take Mayan’s deeper GenericFK-style indirection where it is not necessary

### In practice, that means:

- documents are first-class rows
- versions are first-class rows
- blobs are first-class rows
- metadata definitions are first-class rows
- metadata values are typed sparse rows
- facets are first-class rows
- relations are first-class rows
- ACLs are explicit rows
- lifecycle/workflow state is explicit rows

### It explicitly does **not** mean:

- no Alfresco-style `node` + `node_properties` generic store
- no generic “repository object” table for everything
- no “entity_type/entity_id” everywhere in the core
- no path-based file identity as the primary model
- no “just put metadata in `jsonb`” approach

---

## What to borrow from Mayan

These are the Mayan ideas worth keeping:

1. **Document, file/blob, and version are separate concepts**
   - avoids conflating the business object with the binary
   - supports clean immutable versioning

2. **Pages can be first-class when needed**
   - especially useful for OCR-heavy or scan-heavy flows
   - enables enterprise document processing without going full repository-engine

3. **Checkouts / locks matter**
   - simple, explicit model
   - very useful for controlled editing and enterprise workflows

4. **Metadata should be modeled, not improvised**
   - field definitions
   - values tied to documents or versions
   - queryable and indexable

5. **ACLs and events are not optional add-ons**
   - document systems need them in the core model

---

## What to borrow from Alfresco

These are the Alfresco ideas worth keeping:

1. **Base type + optional facets/aspects**
   - document type gives the base structure
   - facets add optional capabilities and extra fields

2. **Typed relationships between documents**
   - better than pretending folders/tags can model all business semantics

3. **Lifecycle / governance as first-class concepts**
   - approval
   - publication
   - retention
   - records / hold / controlled transitions

4. **Classification should be richer than one flat tag list**
   - folders and tags both matter
   - typed relationships matter too

---

## What to explicitly avoid from Alfresco

These are the parts to reject:

1. **Generic sparse property store**
   - bad fit for Postgres + Drizzle + Zero
   - hard to query directly
   - pushes too much logic into the application/search layer

2. **Repository-engine indirection**
   - too much complexity for the target ops envelope

3. **Model deployment complexity**
   - XML-driven repository metadata / runtime dictionary systems are not the goal

4. **Aspect explosion through magic**
   - facets should be explicit and understandable, not opaque repository behavior

---

## What to explicitly avoid from Mayan

These are the parts to avoid copying literally:

1. **Unnecessary GenericFK-style polymorphism**
   - relational clarity is better for this stack

2. **Too much page/version remapping complexity unless it is truly required**
   - keep pages first-class
   - do not jump straight to an ultra-flexible composite-page version graph

3. **Relying on JSON sidecars for important business data**
   - JSON is fine for configuration and event payloads
   - it should not be the primary metadata value layer

---

## Design principles

These should drive the actual Drizzle schema.

### 1. Better Auth owns identity and org state

The application model references Better Auth rows; it does not recreate them.

Use semantic references such as:

- `organization_id`
- `user_id`
- `member_id`

The exact FK targets depend on the final Better Auth org plugin schema, but the DMS model should assume those concepts exist outside the DMS tables.

### 2. Every Zero-facing table gets a stable single-column `id`

Even join tables should usually have:

- a single `id` primary key
- plus a separate unique constraint for natural uniqueness

This is friendlier for Drizzle and Zero than composite primary keys everywhere.

### 3. The live/current document view must be denormalized

`document` should contain the fields the UI needs constantly:

- title
- status
- type
- current version reference
- current blob reference
- lifecycle state
- timestamps

The UI should not need to reconstruct the current document state by joining through versions and values for every list query.

### 4. Metadata definitions are flexible; metadata values are typed

Definitions can be flexible.
Values should still be queryable.

Good:

- `field_definition`
- `document_field_value`
- `document_version_field_value`
- typed nullable value columns
- one row per value

Bad:

- one JSON blob with all custom fields
- one string-only key/value table for everything

### 5. JSON is allowed, but only in the right places

Good uses of JSON:

- field configuration
- workflow configuration fragments
- audit payloads
- non-query-critical extension settings

Bad uses of JSON:

- primary metadata values
- core relationship modeling
- critical reporting/filtering fields

### 6. ACLs should be explicit

Avoid a generic ACL table that tries to support every possible principal and resource shape.

Prefer explicit tables like:

- `document_acl_member`
- `document_acl_role`

That is much easier to reason about and implement in Drizzle.

### 7. Blobs are not documents

Binary storage should be abstracted behind a `blob` table.

That gives:

- object storage freedom
- stable references from versions/documents
- checksum-based integrity tracking
- support for previews/renditions later without redesigning the core model

### 8. Append-only events for audit

Audit is not the same thing as activity UI, but the core model should at least support append-only audit events.

---

## Better Auth integration

The target model assumes:

- Better Auth handles auth/session/account mechanics
- Better Auth org plugin handles organizations and memberships

### The DMS layer should only reference:

- `organization_id` for top-level tenant scope
- `user_id` for actor identity where cross-org identity matters
- `member_id` where org-scoped permissions or ownership matter
- role identifiers coming from the org plugin for role-based ACLs / workflows

### The DMS layer should not define:

- auth tables
- session tables
- account tables
- a second org membership system

This is especially important because the repo currently still contains app-owned auth tables; the target direction is to remove that responsibility from the DMS schema.

---

## Whole target model

This is the whole intended model, not a staged subset.

```text
[Better Auth org plugin]
user
organization
member
(role/invitation/session/etc. as provided by plugin)

[Optional app container - decision still open]
workspace

[Schema / extensibility]
document_type
facet_definition
document_type_facet
field_definition

[Core document storage]
blob
document
document_version
document_page
page_ocr_text

[Metadata values]
document_field_value
document_version_field_value

[Classification / containment]
tag
document_tag
folder
document_folder

[Typed relations]
relation_type
document_relation

[Governance]
lifecycle_policy
lifecycle_state
lifecycle_transition
retention_policy
checkout
audit_event

[ACLs]
document_acl_member
document_acl_role

[Workflow]
workflow_definition
workflow_step_definition
workflow_instance
workflow_task
```

---

## Scope and tenancy

### Top-level scope

All DMS data is at minimum scoped by `organization_id` from Better Auth.

That means every org-owned table should usually include `organization_id`, except pure child tables that can derive org scope through their parent row.

### Workspace decision is still open

There is one unresolved structural question:

- is Better Auth `organization` the only container?
- or does the app also have a `workspace` concept under `organization`?

That decision does **not** block writing the rest of the model down.

The safe rule is:

- everything is definitely **organization-scoped**
- some content tables may later also become **workspace-scoped**

If `workspace` is adopted, it should be an app-level container, not a replacement for Better Auth `organization`.

---

## Schema / extensibility layer

This is the Alfresco-inspired part, implemented relationally.

## `document_type`

Defines the base class of a document.

Suggested fields:

- `id`
- `organization_id`
- `key`
- `name`
- `description`
- `default_lifecycle_policy_id` nullable
- `default_retention_policy_id` nullable
- `versioning_mode`
- `created_at`
- `updated_at`

Notes:

- `key` should be unique per organization
- this is the anchor for required fields, default workflow/lifecycle behavior, and UI behavior

## `facet_definition`

Defines an optional capability / mixin.

Examples:

- `classifiable`
- `retainable`
- `record`
- `signable`
- `publishable`
- `templated`
- `externally_referenced`

Suggested fields:

- `id`
- `organization_id`
- `key`
- `name`
- `description`
- `created_at`
- `updated_at`

Notes:

- `key` unique per organization
- facets add optional structure and behavior without turning the entire database into a generic repository engine

## `document_type_facet`

Associates facets with a document type.

Suggested fields:

- `id`
- `document_type_id`
- `facet_definition_id`
- `required`
- `sort_order`
- `created_at`

Constraints:

- unique `(document_type_id, facet_definition_id)`

## `field_definition`

Defines flexible metadata fields.

Suggested fields:

- `id`
- `organization_id`
- `key`
- `name`
- `description`
- `value_kind`
- `scope_kind` (`document` or `version`)
- `document_type_id` nullable
- `facet_definition_id` nullable
- `required`
- `multi_valued`
- `indexed`
- `client_visible`
- `config_json`
- `created_at`
- `updated_at`

Notes:

- field definitions may apply to a document type, a facet, or be org-wide reusable definitions depending on how strict the final implementation should be
- actual values should not live in `config_json`

Suggested `value_kind` set:

- `string`
- `text`
- `number`
- `boolean`
- `date`
- `timestamp`
- `json`
- `document_ref`
- `member_ref`

---

## Core document storage layer

This is the Mayan-inspired part, simplified for this stack.

## `blob`

Storage descriptor for binary content.

Suggested fields:

- `id`
- `organization_id`
- `storage_backend`
- `storage_key`
- `original_filename`
- `mime_type`
- `size_bytes`
- `checksum_sha256`
- `created_at`

Notes:

- this row describes where the bytes live; it does not store the bytes in Postgres
- enables object storage backends without changing the main model

## `document`

The live business object.

Suggested fields:

- `id`
- `organization_id`
- `workspace_id` nullable if workspaces exist
- `document_type_id`
- `title`
- `status`
- `lifecycle_state_id` nullable
- `retention_policy_id` nullable
- `current_version_id` nullable
- `current_blob_id` nullable
- `owner_member_id` nullable
- `created_by_user_id`
- `updated_by_user_id`
- `created_at`
- `updated_at`
- `trashed_at` nullable
- `deleted_at` nullable
- `retention_until` nullable
- `is_record`

Notes:

- this table should be optimized for “list documents” and “show current document” queries
- `current_version_id` and `current_blob_id` denormalize the live view intentionally
- soft deletion / trash state belong here, not in a separate generic side table

## `document_version`

Immutable document version row.

Suggested fields:

- `id`
- `document_id`
- `blob_id`
- `major`
- `minor`
- `label`
- `checksum_sha256`
- `mime_type`
- `size_bytes`
- `page_count`
- `comment`
- `created_by_user_id`
- `created_at`

Constraints:

- unique `(document_id, major, minor)`

Notes:

- versions are immutable
- the current live version is pointed to by `document.current_version_id`
- storing checksum and mime here avoids forcing every version lookup through `blob` for common metadata

## `document_page`

First-class page rows for versioned documents.

Suggested fields:

- `id`
- `document_version_id`
- `page_number`
- `width` nullable
- `height` nullable
- `rotation` nullable
- `created_at`

Constraints:

- unique `(document_version_id, page_number)`

Notes:

- this keeps the valuable Mayan page-awareness without copying Mayan’s full page-remapping machinery

## `page_ocr_text`

OCR / extracted text per page.

Suggested fields:

- `id`
- `document_page_id`
- `content`
- `language` nullable
- `extractor`
- `extracted_at`

Notes:

- page-level text supports scan-heavy use cases cleanly
- full-text indexing can still be delegated to a search layer

---

## Metadata values

Flexible definitions, typed values.

## `document_field_value`

Metadata values attached to the live document object.

Suggested fields:

- `id`
- `document_id`
- `field_definition_id`
- `ordinal`
- `string_value` nullable
- `text_value` nullable
- `number_value` nullable
- `boolean_value` nullable
- `date_value` nullable
- `timestamp_value` nullable
- `json_value` nullable
- `document_ref_id` nullable
- `member_ref_id` nullable
- `created_at`
- `updated_at`

Constraints:

- unique `(document_id, field_definition_id, ordinal)`

Notes:

- multi-valued fields use multiple rows with increasing `ordinal`
- only one typed value column should be populated per row

## `document_version_field_value`

Metadata values attached to a specific version.

Suggested fields:

- `id`
- `document_version_id`
- `field_definition_id`
- `ordinal`
- `string_value` nullable
- `text_value` nullable
- `number_value` nullable
- `boolean_value` nullable
- `date_value` nullable
- `timestamp_value` nullable
- `json_value` nullable
- `document_ref_id` nullable
- `member_ref_id` nullable
- `created_at`
- `updated_at`

Constraints:

- unique `(document_version_id, field_definition_id, ordinal)`

Notes:

- splitting document-level and version-level values into separate tables keeps the relational model cleaner than a generic polymorphic subject table

---

## Classification / containment

Folders, tags, and typed relations solve different problems. All three matter.

## `tag`

Flexible label/classification tree.

Suggested fields:

- `id`
- `organization_id`
- `parent_id` nullable
- `name`
- `color` nullable
- `created_at`
- `updated_at`

Notes:

- hierarchy is useful
- tags remain many-to-many classification, not containment

## `document_tag`

Suggested fields:

- `id`
- `document_id`
- `tag_id`
- `created_at`

Constraints:

- unique `(document_id, tag_id)`

## `folder`

Hierarchical folder/container tree.

Suggested fields:

- `id`
- `organization_id`
- `workspace_id` nullable if workspaces exist
- `parent_id` nullable
- `name`
- `slug` nullable
- `created_at`
- `updated_at`

Notes:

- folders model containment/navigation, not arbitrary business relations

## `document_folder`

Suggested fields:

- `id`
- `document_id`
- `folder_id`
- `is_primary`
- `created_at`

Constraints:

- unique `(document_id, folder_id)`

Notes:

- many-to-many folders are more flexible than forcing a single parent path

---

## Typed relations

Folders and tags are not enough for enterprise document semantics.

## `relation_type`

Defines a typed relationship.

Examples:

- `replaces`
- `references`
- `part_of`
- `derived_from`
- `supports`
- `attached_to_case`

Suggested fields:

- `id`
- `organization_id`
- `key`
- `name`
- `inverse_name` nullable
- `symmetric`
- `created_at`
- `updated_at`

## `document_relation`

Associates two documents with a typed relationship.

Suggested fields:

- `id`
- `source_document_id`
- `relation_type_id`
- `target_document_id`
- `position` nullable
- `created_by_user_id`
- `created_at`

Constraints:

- unique `(source_document_id, relation_type_id, target_document_id)`

Notes:

- this is the cleanest way to get the practical benefits of Alfresco-style associations without building a generic repository engine

---

## Governance layer

This is where the model becomes enterprise-ready without going full heavyweight ECM.

## `lifecycle_policy`

Defines a lifecycle state machine.

Suggested fields:

- `id`
- `organization_id`
- `key`
- `name`
- `description`
- `created_at`
- `updated_at`

## `lifecycle_state`

Suggested fields:

- `id`
- `lifecycle_policy_id`
- `key`
- `name`
- `position`
- `is_terminal`
- `created_at`

Constraints:

- unique `(lifecycle_policy_id, key)`

## `lifecycle_transition`

Suggested fields:

- `id`
- `lifecycle_policy_id`
- `from_state_id`
- `to_state_id`
- `required_permission`
- `created_at`

Notes:

- transitions are explicit and queryable
- state changes should be reflected on `document.lifecycle_state_id`

## `retention_policy`

Suggested fields:

- `id`
- `organization_id`
- `key`
- `name`
- `mode`
- `retain_for_days` nullable
- `hold_blocks_delete`
- `created_at`
- `updated_at`

Notes:

- this is enough to support enterprise retention direction without implementing a records megasystem in the first pass of schema design

## `checkout`

Document lock / checkout state.

Suggested fields:

- `id`
- `document_id`
- `member_id`
- `mode`
- `expires_at` nullable
- `released_at` nullable
- `created_at`

Constraints:

- one active checkout per document

Implementation note:

- this is a good fit for a partial unique index on active rows

## `audit_event`

Append-only audit trail.

Suggested fields:

- `id`
- `organization_id`
- `document_id` nullable
- `document_version_id` nullable
- `actor_user_id` nullable
- `event_type`
- `payload_json`
- `created_at`

Notes:

- JSON is appropriate here because audit payloads are event-shaped, not relational business fields
- keep this append-only

---

## ACL layer

ACLs should be explicit and easy to reason about.

## `document_acl_member`

Member-specific permissions.

Suggested fields:

- `id`
- `document_id`
- `member_id`
- `permission`
- `granted`
- `created_at`

Constraints:

- unique `(document_id, member_id, permission)`

## `document_acl_role`

Role-specific permissions.

Suggested fields:

- `id`
- `document_id`
- `role`
- `permission`
- `granted`
- `created_at`

Constraints:

- unique `(document_id, role, permission)`

Notes:

- these roles should map to Better Auth org roles
- explicit member and role tables are clearer than a generic principal abstraction in this stack

---

## Workflow layer

The model should support review/approval/assignment without committing to a giant BPM engine.

## `workflow_definition`

Suggested fields:

- `id`
- `organization_id`
- `key`
- `name`
- `description`
- `document_type_id` nullable
- `created_at`
- `updated_at`

## `workflow_step_definition`

Suggested fields:

- `id`
- `workflow_definition_id`
- `key`
- `name`
- `step_type`
- `sort_order`
- `required_role` nullable
- `due_in_days` nullable
- `approve_transition_id` nullable
- `reject_transition_id` nullable
- `created_at`

## `workflow_instance`

Suggested fields:

- `id`
- `organization_id`
- `document_id`
- `workflow_definition_id`
- `status`
- `started_by_user_id`
- `started_at`
- `completed_at` nullable

## `workflow_task`

Suggested fields:

- `id`
- `workflow_instance_id`
- `workflow_step_definition_id`
- `document_id`
- `assignee_member_id` nullable
- `assignee_role` nullable
- `status`
- `due_at` nullable
- `completed_by_user_id` nullable
- `completed_at` nullable
- `comment` nullable
- `created_at`

Notes:

- this covers the common enterprise workflow needs without requiring a full external BPM engine as part of the relational core

---

## Zero guidance

Not every Postgres table should be mirrored through Zero.

### Good Zero candidates

These are the tables most likely to be useful in client sync/query flows:

- `document`
- `document_type`
- `facet_definition`
- `document_type_facet`
- `field_definition`
- `document_field_value` (for client-visible fields)
- `tag`
- `document_tag`
- `folder`
- `document_folder`
- `relation_type`
- `document_relation`
- `checkout`
- `workflow_task`
- maybe `workflow_instance`

### Likely server-side only or selectively exposed

These tables are heavier or more operational:

- `blob`
- `page_ocr_text`
- raw `audit_event`
- workflow definition internals if not needed client-side
- any ingestion / indexing / outbox / worker coordination tables that may exist later

### Important Zero-specific rule

Keep the current document view on `document`.

Do not force the client to derive the current live state from:

- `document_version`
- `document_field_value`
- `document_version_field_value`
- `blob`

for every list or detail query.

---

## Things this model intentionally does not do

These are explicit non-goals.

1. **No generic repository engine**
   - no `node`
   - no universal `node_property`
   - no generic content dictionary runtime

2. **No app-owned auth schema**
   - Better Auth owns that layer

3. **No path-based identity**
   - folders are structure, not identity

4. **No JSON-first metadata**
   - JSON exists, but not as the primary field value layer

5. **No giant generic ACL table**
   - explicit tables are clearer

6. **No giant BPM schema**
   - workflow support should stay practical

7. **No split “v1 vs v1.5” plan in the target model document**
   - this document describes the whole intended shape

---

## Recommended decision summary

The correct architectural direction for Leuchtturm is:

> **A typed relational DMS model for Postgres, with Mayan-style document/version/page discipline and Alfresco-style type/facet/relationship flexibility, integrated with Better Auth orgs, and shaped to work well with Drizzle and Zero.**

Translated into practical rules:

- org scope comes from Better Auth
- documents, versions, blobs, pages, and metadata are explicit tables
- extensibility happens through document types, facets, and field definitions
- values stay typed and queryable
- relationships are first-class
- ACLs are explicit
- lifecycle and workflow are modeled, but not overengineered
- the current document view is denormalized for Zero/UI performance
- auth/session/account/org membership are not duplicated in app tables

---

## Open question that remains

One decision is still unresolved:

- should there be an app-level `workspace` container under Better Auth `organization`, or not?

This document intentionally does not resolve that question.

Everything else here remains valid either way:

- if there is **no** workspace, the model is org-scoped only
- if there **is** a workspace, add `workspace` and `workspace_id` to the content/structure tables that need it

That open choice does not change the main conclusion:

> the model should still be typed, relational, facet-driven, document/version-centric, and Better-Auth-backed.
