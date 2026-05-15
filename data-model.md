# Leuchtturm Document Data Model Draft

Status: draft for discussion.

This model starts from a Paperless-ngx and Mayan EDMS shape: documents are team-scoped, ingested files are preserved, pages and OCR are first-class, metadata is typed, audit is complete, and document versions are immutable. It deliberately leaves room for Alfresco/Nuxeo-style enterprise extensions without copying their full node/aspect complexity on day one.

## Current Project Constraints

The existing codebase already defines authentication, organizations, and teams through Better Auth tables in `packages/core/src/auth/auth.sql.ts`.

| Constraint     | Decision                                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team scope     | Every document-domain table carries `team_id`. There is no organization-level document data. Organization membership is reached through `team.organization_id`.                                      |
| Auth and roles | Better Auth owns users, organization membership, team membership, organization roles, dynamic roles, and coarse permission vocabulary. Document ACLs only bind those principals to document objects. |
| IDs            | Keep the existing prefixed ULID style in `char(30)` columns, for example `usr_` plus 26 ULID chars.                                                                                                  |
| Database       | PostgreSQL is the source of truth for all metadata and relationships.                                                                                                                                |
| Blob storage   | Cloudflare R2 stores binary content. PostgreSQL stores object keys, digests, sizes, and lifecycle metadata.                                                                                          |
| Client sync    | Zero syncs selected metadata and audit tables. Full files, extracted text blobs, search state, and blob storage internals stay server/API-only.                                                      |
| Search         | Turbopuffer is a derived index for full-text, vector, and filtered search. It is never the source of truth.                                                                                          |
| Migrations     | This document is not a migration plan. Migrations should be created separately when the schema is approved.                                                                                          |

## Research Lessons Applied

| System        | Adopt                                                                                                                                     | Avoid                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Paperless-ngx | Typed custom fields, task observability, hierarchical tags, share links, workflow triggers as a later extension.                          | Single global namespace, unversioned OCR text, JSON document links without referential integrity.   |
| Mayan EDMS    | File/page/version-page separation, checkout model, metadata definitions, OCR per version page, signatures.                                | Generic foreign keys and overly deep indirection where relational FKs are enough.                   |
| Alfresco      | Stable node identity, typed relationships, content storage abstraction, mandatory audit, optional capabilities through model definitions. | Full sparse node-property store as the primary schema, Solr-style dependence for ordinary reads.    |
| Nuxeo         | Document types, lifecycle policies, version rows with latest/latest-major flags, ACL inheritance, read ACL optimization.                  | XML-heavy deployment model and opaque generated schema tables.                                      |
| Documentum    | Immutable version chains, symbolic labels, renditions, generic relation objects.                                                          | Proprietary ID semantics, repeating attribute tables for ordinary multi-value metadata.             |
| SharePoint    | Content type inheritance concept, checkout, major/minor versions, role definitions through Better Auth, permission inheritance.           | Generic fixed column pools, path-based document identity, direct SQL-style integration assumptions. |
| Nextcloud     | Simple storage abstraction, shares with expiration, activity stream ideas.                                                                | Path-based metadata identity and notification logs as compliance audit.                             |
| Documize      | Team/workspace-oriented collaboration, action-level permission vocabulary, link integrity checks.                                         | Comma-separated tags and binary blobs embedded in database rows.                                    |

## Design Principles

1. Document identity is stable and independent of path, filename, storage key, and search index row.
2. Every document belongs to exactly one team.
3. Documents may be organized in many ways: libraries, folders, tags, saved views, typed metadata, and typed document-to-document links such as references, replaces, duplicates, or supports.
4. Original files are append-only. R2 objects are immutable after write.
5. Document versions are immutable once finalized.
6. Pages are first-class because OCR, annotations, renditions, and version composition depend on pages.
7. Audit is append-only and mandatory for document, metadata, version, user workflow, ACL, and blob lifecycle events.
8. The relational model stays queryable without requiring Turbopuffer for ordinary metadata screens.
9. Search indexes, Zero replicas, generated thumbnails, and permission caches are derived data and can be rebuilt.
10. Extensibility should come from typed definitions and typed relationships before generic JSON bags.
11. Better Auth should be reused for organization roles and coarse permissions instead of duplicating an application role engine.
12. Cross-object links must preserve tenant boundaries. The API layer owns most invariants, but security-sensitive association tables should also be protected by database constraints where the cost is reasonable.

## High-Level Shape

```text
team
  -> document_library
      -> document_folder
          -> document_folder_entry -> document

document
  -> document_version
      -> document_version_page -> document_file_page -> document_file -> blob_object
      -> document_version_metadata_value
  -> document_metadata_value
  -> document_tag_assignment -> document_tag
  -> document_relation
  -> document_comment / document_annotation
  -> audit_event
  -> user workflow_task / document lifecycle history
  -> search_index_item -> Turbopuffer row
```

## Naming And Common Columns

Use singular table names to match existing tables such as `user`, `team`, and `team_member`.

Use these common columns unless a table is intentionally immutable and append-only.

| Column       | Type             | Notes                                               |
| ------------ | ---------------- | --------------------------------------------------- |
| `id`         | `char(30)`       | Prefixed ULID.                                      |
| `team_id`    | `char(30)`       | FK to `team.id`; present on document-domain tables. |
| `created_at` | `timestamp`      | Server timestamp.                                   |
| `created_by` | `char(30) null`  | FK to `user.id`; null for system actions.           |
| `updated_at` | `timestamp null` | Present on mutable metadata/config tables.          |
| `updated_by` | `char(30) null`  | FK to `user.id`.                                    |
| `revision`   | `integer`        | Optimistic concurrency token on mutable rows.       |
| `deleted_at` | `timestamp null` | Soft delete where user recovery matters.            |
| `deleted_by` | `char(30) null`  | FK to `user.id`.                                    |

Intentional shape exceptions: one-to-one extension tables may use their parent object ID as the primary key; closure and pure association tables may omit `id`, `updated_at`, and soft-delete columns; append-only history rows omit mutable payload columns; system-wide jobs and audit events may have nullable `team_id` only when they are genuinely cross-team.

Recommended ID prefixes for document-domain rows:

| Prefix | Entity                  |
| ------ | ----------------------- |
| `lib_` | Document library        |
| `fol_` | Folder                  |
| `dfe_` | Folder entry            |
| `doc_` | Document                |
| `dve_` | Document version        |
| `dfl_` | Document file           |
| `dfp_` | Document file page      |
| `dvp_` | Document version page   |
| `blo_` | Blob object             |
| `ren_` | Rendition               |
| `dty_` | Document type           |
| `mfd_` | Metadata field          |
| `dmv_` | Current metadata value  |
| `vmv_` | Version metadata value  |
| `tag_` | Document tag            |
| `dta_` | Document tag assignment |
| `acl_` | ACL scope               |
| `ace_` | ACL entry               |
| `aud_` | Audit event             |
| `lcd_` | Lifecycle definition    |
| `wft_` | Workflow task           |
| `job_` | Processing job          |
| `six_` | Search index item       |
| `dvl_` | Document version label  |
| `mfo_` | Metadata field option   |
| `dtf_` | Document type field     |
| `dpt_` | Document page text      |
| `svw_` | Saved view              |
| `svd_` | Saved view dependency   |
| `drt_` | Relation type           |
| `rel_` | Document relation       |
| `com_` | Comment                 |
| `ann_` | Annotation              |
| `oag_` | Object access grant     |
| `lok_` | Document lock           |
| `lcs_` | Lifecycle state         |
| `lct_` | Lifecycle transition    |
| `dle_` | Lifecycle event         |
| `auc_` | Audit change            |
| `sig_` | File signature          |
| `src_` | Ingest source           |
| `shl_` | Share link              |

## Tenant, Library, And Referential Integrity

`team_id` is a denormalized tenant key on document-domain rows for filtering, indexing, authorization, and operational safety. It is not by itself proof that two referenced rows belong together.

Recommended enforcement policy:

| Relationship type                  | Enforcement decision                                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct parent-child rows           | Enforce in API/service code and transactions; use ordinary FKs. Examples: `document_file.document_id`, `document_version.document_id`.                           |
| Cross-object association rows      | Enforce same-team in API code and prefer composite FKs or equivalent database checks when practical. Examples: folder entries, tag assignments, relations, ACLs. |
| Security/cache tables              | Prefer database-enforced tenant/object integrity. Bad rows can create data leaks through Zero, search, or derived access grants.                                 |
| Library filing                     | Initial rule: a folder entry must file a document into a folder from the same `library_id` as `document.library_id`. Cross-library filing is out of scope.       |
| Nullable parent uniqueness         | Use partial unique indexes for root and non-root rows; PostgreSQL treats `NULL` values as distinct.                                                              |
| Soft-deleteable configuration rows | Use active-only unique indexes, typically `where deleted_at is null`, when deleted rows should not block slug/name reuse.                                        |
| Historical immutable rows          | Do not soft-delete or mutate payload columns; append replacement rows and audit the action.                                                                      |

This does not require proving every same-team relationship in the database on day one. The high-value places to protect are association tables that connect independently addressable objects and anything used by authorization or sync filtering.

## Containers And Filing

### `document_library`

A team-level container similar to a SharePoint document library, Nuxeo workspace, or Documize space. Libraries are a useful permission and configuration boundary without making documents organization-scoped.

| Column                            | Type            | Notes                                                                                     |
| --------------------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `id`                              | `char(30)`      | `lib_` prefix.                                                                            |
| `team_id`                         | `char(30)`      | FK to `team.id`.                                                                          |
| `name`                            | `text`          | Display name, unique within the team for active libraries.                                |
| `description`                     | `text null`     | Optional.                                                                                 |
| `default_document_type_id`        | `char(30) null` | FK to `document_type.id`.                                                                 |
| `default_lifecycle_definition_id` | `char(30) null` | FK to `lifecycle_definition.id`; add with workflow phase if phased migrations require it. |
| common columns                    |                 | Mutable and soft-deleteable.                                                              |

ACL scopes are stored canonically in `acl_scope` with `library_id`, `folder_id`, or `document_id`; library rows do not store a back-reference to avoid circular state.

Constraints and indexes:

| Constraint                                      | Notes                                     |
| ----------------------------------------------- | ----------------------------------------- |
| partial unique `(team_id, name)` on active rows | Active library names are team-unique.     |
| `index(team_id, deleted_at)`                    | Fast active library listing.              |
| same-team FK for default type/lifecycle         | Defaults must belong to the library team. |

### `document_folder`

A stable folder/cabinet node. Folders do not define document identity.

| Column             | Type            | Notes                                                |
| ------------------ | --------------- | ---------------------------------------------------- |
| `id`               | `char(30)`      | `fol_` prefix.                                       |
| `team_id`          | `char(30)`      | FK to `team.id`.                                     |
| `library_id`       | `char(30)`      | FK to `document_library.id`.                         |
| `parent_folder_id` | `char(30) null` | FK to `document_folder.id`. Null means library root. |
| `name`             | `text`          | Folder name.                                         |
| `slug`             | `text`          | Stable URL segment where useful.                     |
| `position`         | `integer`       | Manual ordering.                                     |
| `path_cache`       | `text null`     | Denormalized display path, not identity.             |
| common columns     |                 | Mutable and soft-deleteable.                         |

Folder permission inheritance breaks are represented by an `acl_scope` row with `folder_id`, not by a stored `acl_scope_id` back-reference.

Constraints and indexes:

| Constraint                                                                     | Notes                                               |
| ------------------------------------------------------------------------------ | --------------------------------------------------- |
| partial unique `(library_id, name)` for root active folders                    | Prevent duplicate active root names.                |
| partial unique `(library_id, parent_folder_id, name)` for active child folders | Prevent sibling name collisions.                    |
| optional equivalent active uniqueness for `slug`                               | Required if folder slugs are exposed in URLs.       |
| `index(team_id, library_id, parent_folder_id)`                                 | Fast tree loading.                                  |
| same-team FK/check for `library_id` and `parent_folder_id`                     | Parent folder must be in the same library and team. |

### `document_folder_closure`

Optional but recommended once folder trees matter at scale. This follows Nuxeo's ancestor-table lesson and avoids recursive queries for every permission or breadcrumb lookup.

| Column                 | Type       | Notes                       |
| ---------------------- | ---------- | --------------------------- |
| `team_id`              | `char(30)` | FK to `team.id`.            |
| `ancestor_folder_id`   | `char(30)` | FK to `document_folder.id`. |
| `descendant_folder_id` | `char(30)` | FK to `document_folder.id`. |
| `depth`                | `integer`  | `0` for self.               |

Primary key: `(ancestor_folder_id, descendant_folder_id)`.

### `document_folder_entry`

Allows Mayan-style multi-filing: one document can appear in multiple folders without duplicate content.

| Column        | Type            | Notes                                |
| ------------- | --------------- | ------------------------------------ |
| `id`          | `char(30)`      | `dfe_` prefix.                       |
| `team_id`     | `char(30)`      | FK to `team.id`.                     |
| `folder_id`   | `char(30)`      | FK to `document_folder.id`.          |
| `document_id` | `char(30)`      | FK to `document.id`.                 |
| `position`    | `integer null`  | Optional manual order inside folder. |
| `created_at`  | `timestamp`     | When filed.                          |
| `created_by`  | `char(30) null` | Who filed it.                        |

Constraints and indexes:

| Constraint                                                    | Notes                                                |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `unique(folder_id, document_id)`                              | No duplicate filing in the same folder.              |
| `index(team_id, document_id)`                                 | Find all folders for a document.                     |
| same-team check for folder and document                       | Protects tenant boundaries.                          |
| same-library check: `folder.library_id = document.library_id` | Initial model does not support cross-library filing. |

## Documents And Immutable Versions

### `document`

The stable logical document. This is the row Zero will usually list.

| Column                     | Type             | Notes                                                                   |
| -------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `id`                       | `char(30)`       | `doc_` prefix.                                                          |
| `team_id`                  | `char(30)`       | FK to `team.id`.                                                        |
| `library_id`               | `char(30)`       | FK to `document_library.id`.                                            |
| `document_type_id`         | `char(30) null`  | FK to `document_type.id`. Nullable for early ingestion stubs.           |
| `title`                    | `text`           | User-facing title.                                                      |
| `description`              | `text null`      | Optional.                                                               |
| `language`                 | `text null`      | Primary language code, like Mayan.                                      |
| `owner_user_id`            | `char(30) null`  | FK to `user.id`. Ownership is not the permission model.                 |
| `current_version_id`       | `char(30) null`  | FK to `document_version.id`. Null while stub or processing.             |
| `current_major_version_id` | `char(30) null`  | FK to `document_version.id`. Useful for published views.                |
| `lifecycle_definition_id`  | `char(30) null`  | FK to `lifecycle_definition.id`.                                        |
| `lifecycle_state_id`       | `char(30) null`  | FK to `lifecycle_state.id`.                                             |
| `is_stub`                  | `boolean`        | True until first usable version exists.                                 |
| `in_trash`                 | `boolean`        | Recoverable user deletion.                                              |
| `trashed_at`               | `timestamp null` | Trash timestamp.                                                        |
| `trashed_by`               | `char(30) null`  | FK to `user.id`.                                                        |
| common columns             |                  | Mutable; `deleted_at` means final logical deletion, not ordinary trash. |

Document-specific ACL overrides are represented by an `acl_scope` row with `document_id`. Null/no row means inherit from the library scope under the initial ACL rule.

Indexes and invariants:

| Index / invariant                                       | Notes                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `index(team_id, library_id, in_trash)`                  | Main document list.                                              |
| `index(team_id, document_type_id)`                      | Type filters.                                                    |
| `index(team_id, lifecycle_state_id)`                    | Workflow queues.                                                 |
| `index(team_id, current_version_id)`                    | Version joins.                                                   |
| `current_version_id` references this document           | Current pointer must not target a version from another document. |
| `current_major_version_id` references this document     | Same rule for published/latest-major pointer.                    |
| `deleted_at` only after final deletion/disposition path | `in_trash` is the user-recoverable deletion state.               |

Baseline business metadata such as document date, received date, correspondent, external identifier, archive number, and barcode should be created as seeded `metadata_field` definitions unless they become universal enough to justify first-class columns.

### `document_version`

Immutable version object. New check-ins create new rows. Existing finalized rows are never edited except derived flags such as `is_current` if we choose not to compute those from `document.current_version_id`.

| Column                   | Type            | Notes                                                                         |
| ------------------------ | --------------- | ----------------------------------------------------------------------------- |
| `id`                     | `char(30)`      | `dve_` prefix.                                                                |
| `team_id`                | `char(30)`      | FK to `team.id`.                                                              |
| `document_id`            | `char(30)`      | FK to `document.id`.                                                          |
| `document_type_id`       | `char(30) null` | Document type snapshot at version creation.                                   |
| `title`                  | `text`          | Title snapshot at version creation.                                           |
| `description`            | `text null`     | Description snapshot at version creation.                                     |
| `language`               | `text null`     | Language snapshot at version creation.                                        |
| `version_index`          | `integer`       | Monotonic integer per document.                                               |
| `major_number`           | `integer`       | Major version number.                                                         |
| `minor_number`           | `integer`       | Minor version number.                                                         |
| `label`                  | `text`          | Primary display label, usually the numeric label like `1.0`.                  |
| `version_kind`           | `text`          | `major`, `minor`, `draft`, `import`, `system`.                                |
| `predecessor_version_id` | `char(30) null` | FK to previous version.                                                       |
| `comment`                | `text null`     | Check-in reason.                                                              |
| `content_sha256`         | `char(64) null` | Hash over version page source references and metadata snapshot.               |
| `status`                 | `text`          | `creating`, `ready`, `failed`, `superseded`.                                  |
| `is_current`             | `boolean`       | Mutable derived flag mirroring `document.current_version_id` if stored.       |
| `is_current_major`       | `boolean`       | Mutable derived flag mirroring `document.current_major_version_id` if stored. |
| `created_at`             | `timestamp`     | Version creation timestamp.                                                   |
| `created_by`             | `char(30) null` | User/system actor.                                                            |

Constraints and indexes:

| Constraint                                                     | Notes                                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `unique(document_id, version_index)`                           | Stable ordering.                                                  |
| `unique(document_id, major_number, minor_number)`              | Prevent duplicate numeric versions.                               |
| `unique(document_id, label)`                                   | Primary display label is unique per document.                     |
| partial unique `(document_id)` where `is_current = true`       | At most one current version per document if flag is stored.       |
| partial unique `(document_id)` where `is_current_major = true` | At most one current major version per document if flag is stored. |
| same-document check for predecessor                            | `predecessor_version_id` must belong to the same document.        |

Only version state fields such as `status`, `is_current`, and `is_current_major` are mutable. Page mappings, file references, and snapshot columns are immutable after the version becomes `ready`.

### `document_version_label`

Additional symbolic or alternate labels for a version. This keeps the primary numeric label simple while leaving room for Documentum-style labels such as `CURRENT`, `APPROVED`, or migration-specific aliases.

| Column                | Type            | Notes                                           |
| --------------------- | --------------- | ----------------------------------------------- |
| `id`                  | `char(30)`      | `dvl_` prefix if added.                         |
| `team_id`             | `char(30)`      | FK to `team.id`.                                |
| `document_id`         | `char(30)`      | FK to `document.id`; duplicated for uniqueness. |
| `document_version_id` | `char(30)`      | FK to `document_version.id`.                    |
| `label`               | `text`          | Symbolic or alternate label.                    |
| `label_type`          | `text`          | `symbolic`, `migration`, `external`.            |
| `created_at`          | `timestamp`     | Assignment time.                                |
| `created_by`          | `char(30) null` | FK to `user.id`.                                |

Constraints: `unique(document_id, label)`, same-document check between `document_id` and `document_version_id`, and service-level prevention of collisions with the primary `document_version.label`. If database-enforced global label uniqueness becomes more important than keeping the primary numeric label inline, move primary labels into this table with `label_type = 'primary'`.

Versioning policy:

| Rule                 | Notes                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Content changes      | Create a new version.                                                                                                                   |
| Page rearrangement   | Create a new version because page mapping changes.                                                                                      |
| OCR rerun            | Does not create a document version unless the page content itself changes; OCR changes are audited and indexed separately.              |
| Metadata changes     | Update current metadata and audit the change. If the change occurs during check-in, snapshot it into `document_version_metadata_value`. |
| Lifecycle transition | Does not automatically create a version unless the transition definition requires it.                                                   |

## Blob And Page Model

### `blob_object`

Storage abstraction for Cloudflare R2. This avoids putting R2 keys directly on document rows and makes future storage backends possible.

| Column              | Type             | Notes                                      |
| ------------------- | ---------------- | ------------------------------------------ |
| `id`                | `char(30)`       | `blo_` prefix.                             |
| `team_id`           | `char(30)`       | FK to `team.id`.                           |
| `bucket`            | `text`           | SST bucket binding name or logical bucket. |
| `key`               | `text`           | R2 object key.                             |
| `mime_type`         | `text null`      | Detected MIME type.                        |
| `size_bytes`        | `bigint`         | Object size.                               |
| `sha256`            | `char(64)`       | Integrity and dedup hash.                  |
| `etag`              | `text null`      | R2 ETag. Not a substitute for SHA-256.     |
| `storage_tier`      | `text null`      | Future archival tier.                      |
| `encryption_key_id` | `text null`      | Future envelope encryption support.        |
| `reference_count`   | `integer`        | Derived safety count.                      |
| `created_at`        | `timestamp`      | Upload time.                               |
| `created_by`        | `char(30) null`  | User/system actor.                         |
| `deleted_at`        | `timestamp null` | Tombstone before physical deletion.        |

Constraints and indexes:

| Constraint / index                   | Notes                                          |
| ------------------------------------ | ---------------------------------------------- |
| `unique(bucket, key)`                | One database row per immutable R2 object key.  |
| `index(team_id, sha256, size_bytes)` | Duplicate detection and integrity checks.      |
| `reference_count >= 0`               | Derived safety count must not become negative. |

Recommended R2 key shape:

```text
teams/{team_id}/documents/{document_id}/files/{document_file_id}/original
teams/{team_id}/documents/{document_id}/versions/{document_version_id}/renditions/{kind}
teams/{team_id}/documents/{document_id}/versions/{document_version_id}/pages/{page_number}/{kind}
```

### `document_file`

Append-only uploaded or ingested file. A document can have many files over time. A version can map pages from one or more files.

| Column              | Type             | Notes                                                                  |
| ------------------- | ---------------- | ---------------------------------------------------------------------- |
| `id`                | `char(30)`       | `dfl_` prefix.                                                         |
| `team_id`           | `char(30)`       | FK to `team.id`.                                                       |
| `document_id`       | `char(30)`       | FK to `document.id`.                                                   |
| `blob_object_id`    | `char(30)`       | FK to `blob_object.id`.                                                |
| `ingest_source_id`  | `char(30) null`  | FK to `ingest_source.id` for non-direct uploads.                       |
| `source_ref`        | `text null`      | Stable external message/path/object ID for idempotency when available. |
| `original_filename` | `text null`      | Name supplied by upload/source.                                        |
| `mime_type`         | `text null`      | Detected MIME type.                                                    |
| `encoding`          | `text null`      | Text encoding when relevant.                                           |
| `size_bytes`        | `bigint`         | Duplicate of blob size for fast reads.                                 |
| `sha256`            | `char(64)`       | Duplicate of blob hash for duplicate detection.                        |
| `scan_status`       | `text`           | `pending`, `clean`, `infected`, `failed`, `skipped`.                   |
| `scanned_at`        | `timestamp null` | Last completed file safety scan.                                       |
| `scan_engine`       | `text null`      | Scanner/backend identifier.                                            |
| `scan_result_json`  | `jsonb null`     | Structured non-secret scan result.                                     |
| `source`            | `text`           | `upload`, `email`, `api`, `import`, `system`.                          |
| `comment`           | `text null`      | Upload note.                                                           |
| `received_at`       | `timestamp null` | Source-system timestamp when available.                                |
| `created_at`        | `timestamp`      | Ingestion timestamp.                                                   |
| `created_by`        | `char(30) null`  | User/system actor.                                                     |

Indexes:

| Index                                                                                   | Notes                                                 |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `index(team_id, document_id, created_at)`                                               | File history.                                         |
| `index(team_id, sha256, size_bytes)`                                                    | Duplicate detection.                                  |
| partial unique `(team_id, ingest_source_id, source_ref)` where `source_ref is not null` | Strict import idempotency when source IDs are stable. |
| `index(team_id, scan_status, created_at)`                                               | Queue and gate unsafe files until scanning completes. |

Future file-analysis extensions, only when needed:

| Future table                   | Purpose                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `document_file_metadata_entry` | Queryable EXIF, PDF, XMP, Office, and other embedded metadata.             |
| `document_duplicate_candidate` | Reviewable duplicate/similar-document matches beyond exact SHA-256 checks. |

### `document_file_page`

Physical pages extracted from a source file.

| Column                    | Type            | Notes                              |
| ------------------------- | --------------- | ---------------------------------- |
| `id`                      | `char(30)`      | `dfp_` prefix.                     |
| `team_id`                 | `char(30)`      | FK to `team.id`.                   |
| `document_file_id`        | `char(30)`      | FK to `document_file.id`.          |
| `page_number`             | `integer`       | 1-based number in the source file. |
| `width_px`                | `integer null`  | Rendered page width.               |
| `height_px`               | `integer null`  | Rendered page height.              |
| `rotation`                | `integer null`  | Detected rotation.                 |
| `rendered_blob_object_id` | `char(30) null` | Optional page image/PDF render.    |
| `created_at`              | `timestamp`     | Extraction time.                   |

Constraints: `unique(document_file_id, page_number)` and same-team check between `document_file_page`, `document_file`, and any `rendered_blob_object_id`.

### `document_version_page`

The Mayan-inspired mapping that makes page-level immutable versions possible.

| Column                  | Type           | Notes                                |
| ----------------------- | -------------- | ------------------------------------ |
| `id`                    | `char(30)`     | `dvp_` prefix.                       |
| `team_id`               | `char(30)`     | FK to `team.id`.                     |
| `document_version_id`   | `char(30)`     | FK to `document_version.id`.         |
| `page_number`           | `integer`      | 1-based page number in this version. |
| `document_file_page_id` | `char(30)`     | FK to `document_file_page.id`.       |
| `rotation_override`     | `integer null` | Version-specific display override.   |
| `crop_json`             | `jsonb null`   | Optional crop/deskew instructions.   |
| `created_at`            | `timestamp`    | Mapping creation time.               |

Constraints: `unique(document_version_id, page_number)` and same-document check that `document_file_page_id` belongs to a file for the version's document.

### `document_page_text`

OCR or extracted text for a version page. This stays server-side by default because it can be large.

| Column                     | Type            | Notes                                                      |
| -------------------------- | --------------- | ---------------------------------------------------------- |
| `id`                       | `char(30)`      | `dpt_` prefix if added.                                    |
| `team_id`                  | `char(30)`      | FK to `team.id`.                                           |
| `document_version_page_id` | `char(30)`      | FK to `document_version_page.id`.                          |
| `text_kind`                | `text`          | `extracted`, `ocr`, `corrected`, `summary`.                |
| `engine`                   | `text null`     | OCR/extraction backend.                                    |
| `language`                 | `text`          | OCR language; use `und` when unknown.                      |
| `content`                  | `text null`     | Extracted text; required when `status = 'ready'`.          |
| `content_sha256`           | `char(64) null` | Detect unchanged reruns; required when content is present. |
| `confidence`               | `numeric null`  | Optional OCR confidence.                                   |
| `layout_blob_object_id`    | `char(30) null` | Optional HOCR/ALTO/layout JSON in R2.                      |
| `status`                   | `text`          | `ready`, `failed`, `superseded`.                           |
| `is_current`               | `boolean`       | Current text for this page/kind/language.                  |
| `created_at`               | `timestamp`     | Extraction timestamp.                                      |

Constraints: partial unique `(document_version_page_id, text_kind, language)` where `is_current = true`, and index `(team_id, document_version_page_id, created_at)`. Keep `language` non-null, for example `und` for unknown, so current-text uniqueness is not weakened by PostgreSQL's ordinary nullable-unique semantics. OCR reruns append rows instead of overwriting previous text.

### `document_rendition`

Generated representations: PDF/A archive, thumbnail, text bundle, page preview, image, redacted copy.

| Column                     | Type            | Notes                                                        |
| -------------------------- | --------------- | ------------------------------------------------------------ |
| `id`                       | `char(30)`      | `ren_` prefix.                                               |
| `team_id`                  | `char(30)`      | FK to `team.id`.                                             |
| `document_id`              | `char(30)`      | FK to `document.id`.                                         |
| `document_version_id`      | `char(30)`      | FK to `document_version.id`.                                 |
| `document_version_page_id` | `char(30) null` | Null for version-level rendition.                            |
| `kind`                     | `text`          | `pdfa`, `thumbnail`, `preview`, `image`, `text`, `redacted`. |
| `variant`                  | `text`          | Logical variant, usually `default`.                          |
| `blob_object_id`           | `char(30)`      | FK to `blob_object.id`.                                      |
| `source_sha256`            | `char(64) null` | Hash of inputs used to generate the rendition.               |
| `status`                   | `text`          | `ready`, `stale`, `failed`.                                  |
| `created_at`               | `timestamp`     | Generation timestamp.                                        |

Constraints: use separate partial unique indexes for version-level and page-level renditions: `(document_version_id, kind, variant)` where `document_version_page_id is null`, and `(document_version_id, document_version_page_id, kind, variant)` where `document_version_page_id is not null`. Use `variant` for multiple redaction profiles, preview sizes, or downstream format choices. Enforce that the rendition document, version, optional page, and blob all belong to the same team and document.

## Document Types And Typed Metadata

### `document_type`

Team-scoped content type. This borrows from Mayan, Nuxeo, and SharePoint while staying relational and migration-friendly.

| Column                            | Type            | Notes                                                                                     |
| --------------------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `id`                              | `char(30)`      | `dty_` prefix.                                                                            |
| `team_id`                         | `char(30)`      | FK to `team.id`.                                                                          |
| `parent_document_type_id`         | `char(30) null` | Optional parent type for simple inheritance.                                              |
| `name`                            | `text`          | Display name.                                                                             |
| `slug`                            | `text`          | Stable key within team.                                                                   |
| `description`                     | `text null`     | Optional.                                                                                 |
| `color`                           | `text null`     | UI hint.                                                                                  |
| `icon`                            | `text null`     | UI hint.                                                                                  |
| `default_lifecycle_definition_id` | `char(30) null` | FK to `lifecycle_definition.id`; add with workflow phase if phased migrations require it. |
| common columns                    |                 | Mutable and soft-deleteable.                                                              |

Constraints: active partial unique `(team_id, slug)`, same-team parent/default checks, and no cycles in the parent chain. Child types inherit metadata-field assignments from parents; do not support complex override rules until a real use case appears.

### `metadata_field`

Reusable team-scoped field definition.

| Column            | Type         | Notes                                                    |
| ----------------- | ------------ | -------------------------------------------------------- |
| `id`              | `char(30)`   | `mfd_` prefix.                                           |
| `team_id`         | `char(30)`   | FK to `team.id`.                                         |
| `name`            | `text`       | Internal name.                                           |
| `label`           | `text`       | Display label.                                           |
| `data_type`       | `text`       | See supported types below.                               |
| `sensitivity`     | `text`       | `normal`, `confidential`, `secret`.                      |
| `sync_policy`     | `text`       | `zero`, `api_only`, `never`.                             |
| `search_policy`   | `text`       | `searchable`, `filter_only`, `not_indexed`.              |
| `description`     | `text null`  | Optional.                                                |
| `validation_json` | `jsonb null` | Min/max, regex, date bounds, precision, etc.             |
| `lookup_json`     | `jsonb null` | Future controlled lookup/source config.                  |
| `extra_json`      | `jsonb null` | Type-specific settings that are not primary query paths. |
| common columns    |              | Mutable and soft-deleteable.                             |

Constraints and indexes: active partial unique `(team_id, name)`, plus indexes on `(team_id, data_type)` and `(team_id, deleted_at)` for admin screens.

Supported initial `data_type` values:

| Type        | Storage                                 |
| ----------- | --------------------------------------- |
| `string`    | `value_text`                            |
| `long_text` | `value_long_text`                       |
| `url`       | `value_text`                            |
| `date`      | `value_date`                            |
| `timestamp` | `value_timestamp`                       |
| `boolean`   | `value_bool`                            |
| `integer`   | `value_int`                             |
| `decimal`   | `value_decimal`                         |
| `money`     | `value_decimal` plus `value_currency`   |
| `select`    | `value_option_id`                       |
| `user`      | `value_user_id`                         |
| `document`  | `value_document_id`                     |
| `json`      | `value_json` for rare structured fields |

### `metadata_field_option`

Allowed values for select fields.

| Column              | Type        | Notes                                       |
| ------------------- | ----------- | ------------------------------------------- |
| `id`                | `char(30)`  | `mfo_` prefix if added.                     |
| `team_id`           | `char(30)`  | FK to `team.id`.                            |
| `metadata_field_id` | `char(30)`  | FK to `metadata_field.id`.                  |
| `value`             | `text`      | Stable option key.                          |
| `label`             | `text`      | Display label.                              |
| `color`             | `text null` | UI hint.                                    |
| `position`          | `integer`   | Display order.                              |
| `active`            | `boolean`   | Inactive options remain valid historically. |

Constraints: `unique(metadata_field_id, value)`, `unique(metadata_field_id, position)`, and same-team check between option and field.

### `document_type_metadata_field`

Assigns fields to document types.

| Column               | Type         | Notes                                                          |
| -------------------- | ------------ | -------------------------------------------------------------- |
| `id`                 | `char(30)`   | `dtf_` prefix if added.                                        |
| `team_id`            | `char(30)`   | FK to `team.id`.                                               |
| `document_type_id`   | `char(30)`   | FK to `document_type.id`.                                      |
| `metadata_field_id`  | `char(30)`   | FK to `metadata_field.id`.                                     |
| `required`           | `boolean`    | Required for this type.                                        |
| `repeatable`         | `boolean`    | Multiple values allowed.                                       |
| `position`           | `integer`    | Form/display order.                                            |
| `default_value_json` | `jsonb null` | Default value in typed JSON form.                              |
| `include_in_search`  | `boolean`    | Copy into search index attributes when field policy allows it. |
| `created_at`         | `timestamp`  | Assignment timestamp.                                          |

Constraint: `unique(document_type_id, metadata_field_id)`. Effective field sets include inherited parent assignments; initial implementation should reject assigning a field directly to a child type when it is already inherited unless explicit override semantics are introduced.

### `document_metadata_value`

Current mutable metadata for a document. Use sparse typed columns, not one JSON blob, so metadata remains filterable in PostgreSQL and indexable in Turbopuffer.

| Column              | Type             | Notes                                                          |
| ------------------- | ---------------- | -------------------------------------------------------------- |
| `id`                | `char(30)`       | `dmv_` prefix.                                                 |
| `team_id`           | `char(30)`       | FK to `team.id`.                                               |
| `document_id`       | `char(30)`       | FK to `document.id`.                                           |
| `metadata_field_id` | `char(30)`       | FK to `metadata_field.id`.                                     |
| `position`          | `integer`        | `0` for single-value fields, list order for repeatable fields. |
| `value_text`        | `text null`      | String, URL.                                                   |
| `value_long_text`   | `text null`      | Long text.                                                     |
| `value_date`        | `date null`      | Date.                                                          |
| `value_timestamp`   | `timestamp null` | Timestamp.                                                     |
| `value_bool`        | `boolean null`   | Boolean.                                                       |
| `value_int`         | `bigint null`    | Integer.                                                       |
| `value_decimal`     | `numeric null`   | Decimal/money amount.                                          |
| `value_currency`    | `char(3) null`   | ISO currency for money.                                        |
| `value_option_id`   | `char(30) null`  | FK to `metadata_field_option.id`.                              |
| `value_user_id`     | `char(30) null`  | FK to `user.id`.                                               |
| `value_document_id` | `char(30) null`  | FK to `document.id`.                                           |
| `value_json`        | `jsonb null`     | Structured escape hatch.                                       |
| `updated_at`        | `timestamp`      | Last update.                                                   |
| `updated_by`        | `char(30) null`  | FK to `user.id`.                                               |

Constraints and indexes:

| Constraint / index                                     | Notes                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `unique(document_id, metadata_field_id, position)`     | One current value per field position.                                  |
| exactly one typed value column populated               | Enforced by service code or database checks generated from field type. |
| value column matches `metadata_field.data_type`        | Prevents stale or contradictory sparse values.                         |
| `value_option_id` belongs to `metadata_field_id`       | Select option integrity.                                               |
| metadata field is effective for the document's type    | Required unless explicitly allowing ad-hoc fields.                     |
| required/repeatable rules checked on finalize/check-in | Draft stubs may be temporarily incomplete.                             |
| `index(team_id, metadata_field_id, value_text)`        | Text filters where enabled.                                            |
| `index(team_id, metadata_field_id, value_date)`        | Date filters.                                                          |
| `index(team_id, metadata_field_id, value_timestamp)`   | Timestamp filters.                                                     |
| `index(team_id, metadata_field_id, value_int)`         | Integer range filters.                                                 |
| `index(team_id, metadata_field_id, value_decimal)`     | Decimal/money range filters.                                           |
| `index(team_id, metadata_field_id, value_option_id)`   | Select filters.                                                        |

### `document_version_metadata_value`

Frozen metadata snapshot for a version. This uses the same typed value columns as `document_metadata_value`.

| Column                | Type        | Notes                              |
| --------------------- | ----------- | ---------------------------------- |
| `id`                  | `char(30)`  | `vmv_` prefix.                     |
| `team_id`             | `char(30)`  | FK to `team.id`.                   |
| `document_version_id` | `char(30)`  | FK to `document_version.id`.       |
| `metadata_field_id`   | `char(30)`  | FK to `metadata_field.id`.         |
| `position`            | `integer`   | Same semantics as current values.  |
| typed value columns   |             | Same as `document_metadata_value`. |
| `created_at`          | `timestamp` | Snapshot timestamp.                |

Constraints: `unique(document_version_id, metadata_field_id, position)`, same-team checks, and the same typed-value integrity rules as current metadata. Snapshots should be copied from the effective metadata set for the version's `document_type_id`, not from a later document type after the document changes.

Extension path toward Alfresco/Nuxeo facets:

| Future table                    | Purpose                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `metadata_field_set`            | Reusable groups of fields, similar to schemas/facets.     |
| `document_type_field_set`       | Apply reusable field sets to document types.              |
| `document_field_set_assignment` | Apply an optional facet to a single document when needed. |

Do not introduce these until the direct type-field assignment becomes limiting.

## Classification And Views

### `document_tag`

Hierarchical tags like Paperless-ngx, scoped to teams.

| Column                 | Type            | Notes                                                            |
| ---------------------- | --------------- | ---------------------------------------------------------------- |
| `id`                   | `char(30)`      | `tag_` prefix.                                                   |
| `team_id`              | `char(30)`      | FK to `team.id`.                                                 |
| `parent_tag_id`        | `char(30) null` | FK to `document_tag.id`.                                         |
| `name`                 | `text`          | Display name.                                                    |
| `slug`                 | `text`          | Stable key among siblings.                                       |
| `color`                | `text null`     | UI hint.                                                         |
| `match_text`           | `text null`     | Optional auto-classification hint.                               |
| `match_algorithm`      | `text null`     | `literal`, `regex`, `fuzzy`, `all`, `any`.                       |
| `match_case_sensitive` | `boolean`       | False by default, matching Paperless-style insensitive matching. |
| `is_inbox_tag`         | `boolean`       | Optional Paperless-style inbox marker.                           |
| common columns         |                 | Mutable and soft-deleteable.                                     |

Constraints: partial unique `(team_id, slug)` for active root tags, partial unique `(team_id, parent_tag_id, slug)` for active child tags, same-team parent check, and no cycles in the tag tree.

### `document_tag_assignment`

| Column        | Type            | Notes                    |
| ------------- | --------------- | ------------------------ |
| `id`          | `char(30)`      | `dta_` prefix if added.  |
| `team_id`     | `char(30)`      | FK to `team.id`.         |
| `document_id` | `char(30)`      | FK to `document.id`.     |
| `tag_id`      | `char(30)`      | FK to `document_tag.id`. |
| `created_at`  | `timestamp`     | Assignment time.         |
| `created_by`  | `char(30) null` | FK to `user.id`.         |

Constraints: `unique(document_id, tag_id)` and same-team check between document and tag.

### `saved_view`

Saved document list filters, inspired by Paperless saved views and SharePoint library views.

| Column          | Type            | Notes                        |
| --------------- | --------------- | ---------------------------- |
| `id`            | `char(30)`      | `svw_` prefix if added.      |
| `team_id`       | `char(30)`      | FK to `team.id`.             |
| `owner_user_id` | `char(30) null` | Null for team-owned view.    |
| `name`          | `text`          | Display name.                |
| `visibility`    | `text`          | `private`, `team`.           |
| `filter_json`   | `jsonb`         | Declarative filter model.    |
| `sort_json`     | `jsonb null`    | Sort field/direction.        |
| `display_json`  | `jsonb null`    | Columns, density, grouping.  |
| common columns  |                 | Mutable and soft-deleteable. |

Saved-view filters may reference metadata fields, tags, types, lifecycle states, or folders. Deleting referenced definitions should either prevent deletion while views depend on them or mark affected views invalid so the UI can repair them.

Optional `saved_view_dependency` table, populated by parsing `filter_json`, `sort_json`, and `display_json`:

| Column            | Type        | Notes                                                                  |
| ----------------- | ----------- | ---------------------------------------------------------------------- |
| `id`              | `char(30)`  | `svd_` prefix if added.                                                |
| `team_id`         | `char(30)`  | FK to `team.id`.                                                       |
| `saved_view_id`   | `char(30)`  | FK to `saved_view.id`.                                                 |
| `dependency_type` | `text`      | `metadata_field`, `tag`, `document_type`, `lifecycle_state`, `folder`. |
| `dependency_id`   | `char(30)`  | Referenced object ID; enforced by service code per type.               |
| `created_at`      | `timestamp` | Extraction timestamp.                                                  |

Constraint: `unique(saved_view_id, dependency_type, dependency_id)`. This table is derived from the saved-view JSON and can be rebuilt.

## Relationships, Comments, And Annotations

### `document_relation_type`

Typed relationship definitions, taking the useful part of Alfresco and Documentum relations without a full generic node store.

| Column                   | Type        | Notes                                                   |
| ------------------------ | ----------- | ------------------------------------------------------- |
| `id`                     | `char(30)`  | `drt_` prefix if added.                                 |
| `team_id`                | `char(30)`  | FK to `team.id`.                                        |
| `name`                   | `text`      | Display name.                                           |
| `slug`                   | `text`      | Stable key.                                             |
| `inverse_name`           | `text null` | Display name for reverse direction.                     |
| `source_version_binding` | `text`      | `current`, `specific_version`, `none`.                  |
| `target_version_binding` | `text`      | `current`, `specific_version`, `none`.                  |
| `allow_self_relation`    | `boolean`   | Usually false; enabled only for special relation types. |
| `created_at`             | `timestamp` | Definition timestamp.                                   |

Initial built-in relation slugs: `references`, `replaces`, `duplicates`, `supersedes`, `supports`, `part_of`. Use `inverse_name` for display names such as “has part” instead of creating duplicate inverse relation types unless the inverse needs different behavior.

### `document_relation`

| Column               | Type            | Notes                              |
| -------------------- | --------------- | ---------------------------------- |
| `id`                 | `char(30)`      | `rel_` prefix if added.            |
| `team_id`            | `char(30)`      | FK to `team.id`.                   |
| `relation_type_id`   | `char(30)`      | FK to `document_relation_type.id`. |
| `source_document_id` | `char(30)`      | FK to `document.id`.               |
| `source_version_id`  | `char(30) null` | FK to `document_version.id`.       |
| `target_document_id` | `char(30)`      | FK to `document.id`.               |
| `target_version_id`  | `char(30) null` | FK to `document_version.id`.       |
| `label`              | `text null`     | Optional relation label.           |
| `position`           | `integer null`  | Ordering for compound documents.   |
| `created_at`         | `timestamp`     | Creation time.                     |
| `created_by`         | `char(30) null` | FK to `user.id`.                   |

Constraints and rules:

| Rule                                             | Notes                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| same-team source and target documents            | Prevents cross-team links.                                                     |
| version IDs belong to their documents            | `source_version_id` and `target_version_id` must match source/target document. |
| `source_version_binding = specific_version`      | Requires `source_version_id`.                                                  |
| `target_version_binding = specific_version`      | Requires `target_version_id`.                                                  |
| binding is `current` or `none`                   | The matching version column should be null unless explicitly allowed later.    |
| self-relations require `allow_self_relation`     | Prevents accidental document-to-self links.                                    |
| soft-deleted targets remain referentially intact | UI can show unavailable or trashed targets instead of orphaning links.         |

### `document_comment`

Threaded comments on documents, versions, or pages.

| Column                     | Type             | Notes                          |
| -------------------------- | ---------------- | ------------------------------ |
| `id`                       | `char(30)`       | `com_` prefix if added.        |
| `team_id`                  | `char(30)`       | FK to `team.id`.               |
| `document_id`              | `char(30)`       | FK to `document.id`.           |
| `document_version_id`      | `char(30) null`  | Optional version target.       |
| `document_version_page_id` | `char(30) null`  | Optional page target.          |
| `parent_comment_id`        | `char(30) null`  | Threading.                     |
| `body`                     | `text`           | Comment body.                  |
| `status`                   | `text`           | `open`, `resolved`, `deleted`. |
| `created_at`               | `timestamp`      | Creation time.                 |
| `created_by`               | `char(30) null`  | FK to `user.id`.               |
| `resolved_at`              | `timestamp null` | Resolution time.               |
| `resolved_by`              | `char(30) null`  | FK to `user.id`.               |

### `document_annotation`

Page-level annotation anchored to a specific version page.

| Column                     | Type            | Notes                                               |
| -------------------------- | --------------- | --------------------------------------------------- |
| `id`                       | `char(30)`      | `ann_` prefix if added.                             |
| `team_id`                  | `char(30)`      | FK to `team.id`.                                    |
| `document_version_page_id` | `char(30)`      | FK to `document_version_page.id`.                   |
| `annotation_type`          | `text`          | `highlight`, `note`, `redaction`, `stamp`, `shape`. |
| `geometry_json`            | `jsonb`         | Page coordinates and shape.                         |
| `body`                     | `text null`     | Annotation text.                                    |
| `status`                   | `text`          | `open`, `resolved`, `deleted`.                      |
| `created_at`               | `timestamp`     | Creation time.                                      |
| `created_by`               | `char(30) null` | FK to `user.id`.                                    |

## ACL And Permissions

Documents are team-scoped, but team membership alone is not enough for enterprise document access. Build on Better Auth for identity, organization roles, dynamic roles, team membership, and coarse permission vocabulary. Keep a small document ACL layer only for object-specific grants, inheritance, derived access, and audit.

### Better Auth Access Control Boundary

Better Auth should answer whether a user's organization role is allowed to attempt a class of action. The document ACL resolver should answer whether that user can perform the action on a specific library, folder, or document.

Recommended Better Auth access-control resources:

| Resource       | Actions                                                                                                                                                    | Notes                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `document`     | `create`, `read_metadata`, `read_content`, `update_metadata`, `update_content`, `delete`, `restore`, `manage_versions`, `check_out`, `share`, `view_audit` | Coarse capability vocabulary for document operations.          |
| `document_acl` | `manage`                                                                                                                                                   | Required before editing document ACL scopes or entries.        |
| `workflow`     | `transition`, `manage_tasks`                                                                                                                               | Coarse workflow capabilities.                                  |
| `ac`           | Better Auth dynamic-access-control actions                                                                                                                 | Keep Better Auth's built-in dynamic role administration model. |

Better Auth roles are organization-scoped. Use the existing `member.role` field and Better Auth dynamic access control for built-in and custom roles such as `viewer`, `contributor`, `editor`, and `manager`. Do not introduce local `permission_role` or `permission_role_permission` tables unless Better Auth's dynamic roles prove insufficient.

### Document ACL Permission Vocabulary

Initial object-level permissions mirror the Better Auth vocabulary, but are granted on specific ACL scopes:

| Resource       | Action            | Meaning                                                 |
| -------------- | ----------------- | ------------------------------------------------------- |
| `document`     | `read_metadata`   | See document row and non-sensitive metadata.            |
| `document`     | `read_content`    | Download/view file contents and OCR text.               |
| `document`     | `create`          | Create documents in a library/folder.                   |
| `document`     | `update_metadata` | Edit title, tags, type, and metadata values.            |
| `document`     | `update_content`  | Upload files, create versions, modify page composition. |
| `document`     | `delete`          | Move to trash or request deletion.                      |
| `document`     | `restore`         | Restore from trash.                                     |
| `document`     | `manage_versions` | Promote, label, or restore versions.                    |
| `document`     | `check_out`       | Lock/check out a document.                              |
| `document`     | `share`           | Create share links or external access.                  |
| `document`     | `view_audit`      | View audit history.                                     |
| `document_acl` | `manage`          | Change document permissions.                            |
| `workflow`     | `transition`      | Perform lifecycle transitions.                          |

### `acl_scope`

Canonical inheritance scope for library, folder, document, and later document type or saved view. Use typed nullable FKs instead of a generic `object_type`/`object_id` pair so the database can enforce referential integrity. Target objects do not also store `acl_scope_id` back-references.

| Column                | Type            | Notes                         |
| --------------------- | --------------- | ----------------------------- |
| `id`                  | `char(30)`      | `acl_` prefix.                |
| `team_id`             | `char(30)`      | FK to `team.id`.              |
| `library_id`          | `char(30) null` | FK to `document_library.id`.  |
| `folder_id`           | `char(30) null` | FK to `document_folder.id`.   |
| `document_id`         | `char(30) null` | FK to `document.id`.          |
| `parent_acl_scope_id` | `char(30) null` | FK to inherited scope.        |
| `inheritance_mode`    | `text`          | `inherit`, `break`, `append`. |
| `created_at`          | `timestamp`     | Creation timestamp.           |
| `created_by`          | `char(30) null` | FK to `user.id`.              |

Constraints and indexes:

| Constraint                                              | Notes                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| exactly one of `library_id`, `folder_id`, `document_id` | Scope targets one concrete object.                          |
| partial unique `library_id`                             | At most one scope per library.                              |
| partial unique `folder_id`                              | At most one scope per folder.                               |
| partial unique `document_id`                            | At most one scope per document.                             |
| target object belongs to `team_id`                      | Prevents cross-team scopes.                                 |
| parent scope belongs to `team_id`                       | Prevents cross-team inheritance.                            |
| folder scope parent is folder/library scope             | Keeps ACL inheritance tree meaningful.                      |
| document scope parent is library scope initially        | Folder ACLs do not automatically grant document read/write. |
| `index(team_id, parent_acl_scope_id)`                   | Fast inherited-scope traversal and recomputation.           |

Folder filing rule: because `document_folder_entry` supports multi-filing, document access must not implicitly union every folder ACL. Initial rule: folder ACLs govern folder navigation, filing, and create actions; document read/write access resolves from the document scope or its library parent scope. If folder-inherited document access is required, add an explicit primary filing or inherited-folder pointer before migrations.

### `acl_entry`

Object-specific grant or denial for a Better Auth principal.

| Column                      | Type            | Notes                                                               |
| --------------------------- | --------------- | ------------------------------------------------------------------- |
| `id`                        | `char(30)`      | `ace_` prefix.                                                      |
| `team_id`                   | `char(30)`      | FK to `team.id`.                                                    |
| `acl_scope_id`              | `char(30)`      | FK to `acl_scope.id`.                                               |
| `principal_type`            | `text`          | `user`, `team`, `organization_role`, `organization`.                |
| `principal_user_id`         | `char(30) null` | FK to `user.id` when `principal_type = 'user'`.                     |
| `principal_team_id`         | `char(30) null` | FK to `team.id` when `principal_type = 'team'`.                     |
| `principal_organization_id` | `char(30) null` | FK to `organization.id` when `principal_type = 'organization'`.     |
| `principal_role`            | `text null`     | Better Auth organization role key when type is `organization_role`. |
| `resource`                  | `text`          | Better Auth resource key, for example `document`.                   |
| `action`                    | `text`          | Better Auth action key, for example `read_content`.                 |
| `effect`                    | `text`          | `allow` or `deny`.                                                  |
| `position`                  | `integer`       | Explicit order for deterministic resolution.                        |
| `created_at`                | `timestamp`     | Creation timestamp.                                                 |
| `created_by`                | `char(30) null` | FK to `user.id`.                                                    |

Constraints and indexes:

| Constraint                                         | Notes                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| principal columns match `principal_type`           | User, team, Better Auth role, or whole organization.                  |
| `principal_team_id` belongs to owning organization | Team principals must not cross organization boundaries.               |
| `principal_organization_id = team.organization_id` | Organization principal means the organization that owns the ACL team. |
| `resource`/`action` belongs to allowed vocabulary  | Avoids unresolvable permission strings.                               |
| `index(team_id, acl_scope_id, position)`           | Resolve ordered ACL entries.                                          |
| `index(team_id, principal_user_id)`                | Recompute grants for a user.                                          |
| `index(team_id, principal_team_id)`                | Recompute grants for a team.                                          |
| `index(team_id, principal_organization_id)`        | Recompute grants for organization-wide entries.                       |
| `index(team_id, principal_role)`                   | Recompute grants when Better Auth roles change.                       |

### `object_access_grant`

Derived effective user grant for fast Zero and Turbopuffer filtering across libraries, folders, and documents. This table is rebuilt when ACL scopes, ACL entries, Better Auth organization membership, Better Auth roles, team membership, folder filing, or inheritance rules change. Initial implementations should derive only grants needed for metadata/content visibility filters, such as `document.read_metadata` and `document.read_content`, unless another action demonstrably needs cached rows.

| Column          | Type            | Notes                              |
| --------------- | --------------- | ---------------------------------- |
| `id`            | `char(30)`      | `oag_` prefix.                     |
| `team_id`       | `char(30)`      | FK to `team.id`.                   |
| `library_id`    | `char(30) null` | FK to `document_library.id`.       |
| `folder_id`     | `char(30) null` | FK to `document_folder.id`.        |
| `document_id`   | `char(30) null` | FK to `document.id`.               |
| `user_id`       | `char(30)`      | FK to `user.id`.                   |
| `resource`      | `text`          | Effective resource key.            |
| `action`        | `text`          | Effective action key.              |
| `source_sha256` | `char(64)`      | Hash of inputs used for staleness. |
| `computed_at`   | `timestamp`     | Last computation.                  |

Constraints and indexes:

| Constraint / index                                      | Notes                                               |
| ------------------------------------------------------- | --------------------------------------------------- |
| exactly one of `library_id`, `folder_id`, `document_id` | Grant targets one object.                           |
| partial unique library grant                            | `(library_id, user_id, resource, action)`.          |
| partial unique folder grant                             | `(folder_id, user_id, resource, action)`.           |
| partial unique document grant                           | `(document_id, user_id, resource, action)`.         |
| `index(team_id, user_id, resource, action)`             | Zero and API filtering from current user.           |
| `index(team_id, document_id, action)`                   | Search post-filter and document access lookups.     |
| same-team target checks                                 | Prevents bad derived rows from becoming data leaks. |

Security rules:

| Rule               | Notes                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Better Auth first  | Server APIs check Better Auth coarse permissions for the requested resource/action where applicable.              |
| Object ACL second  | Library, folder, and document operations require an effective ACL grant unless a deliberate global bypass exists. |
| Server enforcement | All write and read APIs enforce permissions on the server.                                                        |
| Zero queries       | Zero queries must include authorization predicates or reference safe derived grants.                              |
| Search             | Turbopuffer filters are an optimization; API post-filtering against PostgreSQL remains the safety net.            |

## Checkout And Locks

### `document_lock`

One active checkout-style lock per document unless a future collaborative editor needs shared locks.

| Column            | Type             | Notes                                   |
| ----------------- | ---------------- | --------------------------------------- |
| `id`              | `char(30)`       | `lok_` prefix if added.                 |
| `team_id`         | `char(30)`       | FK to `team.id`.                        |
| `document_id`     | `char(30)`       | FK to `document.id`.                    |
| `base_version_id` | `char(30) null`  | Version the user checked out or locked. |
| `user_id`         | `char(30)`       | FK to `user.id`.                        |
| `lock_type`       | `text`           | `checkout`, `read_only`, `workflow`.    |
| `status`          | `text`           | `active`, `released`, `expired`.        |
| `expires_at`      | `timestamp null` | Auto-expiry.                            |
| `created_at`      | `timestamp`      | Lock creation time.                     |
| `released_at`     | `timestamp null` | Release timestamp.                      |
| `released_by`     | `char(30) null`  | FK to `user.id`.                        |
| `comment`         | `text null`      | Optional reason.                        |

Recommended constraint: partial unique `(document_id)` where `lock_type = 'checkout' and status = 'active'`. `base_version_id`, when present, must belong to the locked document. Do not rely on a partial index with `expires_at > now()`; expiration should be materialized by a job or checked by the lock acquisition transaction.

## Lifecycle And Workflow

Lifecycle is the user-facing document state policy: which states a document can be in, who may move it between those states, and what approval tasks are required. It is not an engineering/background-job workflow; those operational jobs live in `processing_job`.

The first workflow model should be a state machine, not only trigger/action automation. Automation rules can be layered on transitions later.

### `lifecycle_definition`

| Column         | Type        | Notes                                    |
| -------------- | ----------- | ---------------------------------------- |
| `id`           | `char(30)`  | `lcd_` prefix.                           |
| `team_id`      | `char(30)`  | FK to `team.id`.                         |
| `name`         | `text`      | Display name.                            |
| `slug`         | `text`      | Stable key.                              |
| `description`  | `text null` | Optional.                                |
| `enabled`      | `boolean`   | Disabled definitions remain for history. |
| common columns |             | Mutable and soft-deleteable.             |

Constraint: active partial unique `(team_id, slug)`.

### `lifecycle_state`

| Column                    | Type       | Notes                                                  |
| ------------------------- | ---------- | ------------------------------------------------------ |
| `id`                      | `char(30)` | `lcs_` prefix if added.                                |
| `team_id`                 | `char(30)` | FK to `team.id`.                                       |
| `lifecycle_definition_id` | `char(30)` | FK to `lifecycle_definition.id`.                       |
| `name`                    | `text`     | Display name.                                          |
| `slug`                    | `text`     | Stable key.                                            |
| `category`                | `text`     | `draft`, `review`, `approved`, `archived`, `disposed`. |
| `position`                | `integer`  | UI/order.                                              |
| `is_initial`              | `boolean`  | Exactly one initial state per definition.              |
| `is_terminal`             | `boolean`  | Terminal state.                                        |

Constraints: unique `(lifecycle_definition_id, slug)`, partial unique one initial state per definition, and same-team checks.

### `lifecycle_transition`

| Column                     | Type       | Notes                                      |
| -------------------------- | ---------- | ------------------------------------------ |
| `id`                       | `char(30)` | `lct_` prefix if added.                    |
| `team_id`                  | `char(30)` | FK to `team.id`.                           |
| `lifecycle_definition_id`  | `char(30)` | FK to `lifecycle_definition.id`.           |
| `from_state_id`            | `char(30)` | FK to `lifecycle_state.id`.                |
| `to_state_id`              | `char(30)` | FK to `lifecycle_state.id`.                |
| `name`                     | `text`     | Display name.                              |
| `slug`                     | `text`     | Stable key.                                |
| `required_resource`        | `text`     | Usually `workflow`.                        |
| `required_action`          | `text`     | Usually `transition`.                      |
| `requires_comment`         | `boolean`  | Comment required.                          |
| `creates_major_version`    | `boolean`  | Transition creates/promotes major version. |
| `requires_completed_tasks` | `boolean`  | Blocks until tasks are complete.           |

Constraints: unique `(lifecycle_definition_id, slug)`, same-team state checks, and `from_state_id`/`to_state_id` must belong to the transition definition.

### `document_lifecycle_event`

History of state changes. Current state is stored on `document` for fast reads.

| Column                | Type            | Notes                            |
| --------------------- | --------------- | -------------------------------- |
| `id`                  | `char(30)`      | `dle_` prefix if added.          |
| `team_id`             | `char(30)`      | FK to `team.id`.                 |
| `document_id`         | `char(30)`      | FK to `document.id`.             |
| `document_version_id` | `char(30) null` | Version affected by transition.  |
| `transition_id`       | `char(30) null` | FK to `lifecycle_transition.id`. |
| `from_state_id`       | `char(30) null` | FK to `lifecycle_state.id`.      |
| `to_state_id`         | `char(30)`      | FK to `lifecycle_state.id`.      |
| `comment`             | `text null`     | User/system comment.             |
| `created_at`          | `timestamp`     | Transition time.                 |
| `created_by`          | `char(30) null` | FK to `user.id`.                 |

### `workflow_task`

Approval/review task tied to a document, version, and optional transition.

| Column                | Type             | Notes                                                   |
| --------------------- | ---------------- | ------------------------------------------------------- |
| `id`                  | `char(30)`       | `wft_` prefix.                                          |
| `team_id`             | `char(30)`       | FK to `team.id`.                                        |
| `document_id`         | `char(30)`       | FK to `document.id`.                                    |
| `document_version_id` | `char(30) null`  | FK to `document_version.id`.                            |
| `transition_id`       | `char(30) null`  | FK to `lifecycle_transition.id`.                        |
| `assigned_user_id`    | `char(30) null`  | FK to `user.id` for user-assigned tasks.                |
| `assigned_team_id`    | `char(30) null`  | FK to `team.id` for team-assigned tasks.                |
| `assigned_role`       | `text null`      | Better Auth organization role key for role tasks.       |
| `claimed_by`          | `char(30) null`  | FK to `user.id` when a group/role task is claimed.      |
| `claimed_at`          | `timestamp null` | Claim timestamp.                                        |
| `status`              | `text`           | `open`, `approved`, `rejected`, `cancelled`, `expired`. |
| `due_at`              | `timestamp null` | Optional due date.                                      |
| `completed_at`        | `timestamp null` | Completion time.                                        |
| `completed_by`        | `char(30) null`  | FK to `user.id`.                                        |
| `outcome`             | `text null`      | Transition-specific outcome.                            |
| `comment`             | `text null`      | Completion comment.                                     |
| `created_at`          | `timestamp`      | Assignment time.                                        |

Constraints: exactly one of `assigned_user_id`, `assigned_team_id`, or `assigned_role` is populated; assigned teams and role-derived users must belong to the document team's organization; `claimed_by` must be an eligible assignee for team/role tasks.

## Audit Trail

Audit is mandatory. It should not be treated as an activity feed that can be pruned without policy.

### `audit_event`

| Column                | Type            | Notes                                                                  |
| --------------------- | --------------- | ---------------------------------------------------------------------- |
| `id`                  | `char(30)`      | `aud_` prefix.                                                         |
| `team_id`             | `char(30) null` | Null only for cross-team/system auth events.                           |
| `actor_user_id`       | `char(30) null` | FK to `user.id`. Null for system.                                      |
| `actor_type`          | `text`          | `user`, `system`, `api_token`, `background_job`.                       |
| `action`              | `text`          | Machine-readable event key.                                            |
| `target_type`         | `text`          | `document`, `version`, `metadata`, `acl`, `workflow`, etc.             |
| `target_id`           | `char(30) null` | Target object ID.                                                      |
| `document_id`         | `char(30) null` | FK to `document.id` when event is document-related.                    |
| `request_id`          | `text null`     | Correlates API logs.                                                   |
| `ip_address`          | `text null`     | Client IP.                                                             |
| `user_agent`          | `text null`     | Client UA.                                                             |
| `outcome`             | `text`          | `success`, `failure`, `denied`.                                        |
| `summary`             | `text null`     | Human-readable summary.                                                |
| `metadata_json`       | `jsonb null`    | Event-specific payload.                                                |
| `hash_chain_key`      | `text null`     | Chain scope, for example `team:{team_id}` or `document:{document_id}`. |
| `hash_chain_sequence` | `bigint null`   | Monotonic sequence within the hash chain.                              |
| `previous_hash`       | `char(64) null` | Hash chain predecessor for tamper evidence.                            |
| `entry_hash`          | `char(64) null` | Hash over canonical event payload.                                     |
| `occurred_at`         | `timestamp`     | Event time.                                                            |

Constraints and indexes:

| Constraint / index                                       | Notes                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| `unique(hash_chain_key, hash_chain_sequence)`            | Required when tamper-evident hash chains are enabled.       |
| `index(team_id, document_id, occurred_at)`               | Document timeline.                                          |
| `index(team_id, target_type, target_id, occurred_at)`    | Target-object audit lookup.                                 |
| partition/export policy before high-volume view auditing | `view_content` and `view_metadata` events can grow quickly. |

### `audit_event_change`

Optional normalized field-level changes for easier audit UI.

| Column           | Type            | Notes                                               |
| ---------------- | --------------- | --------------------------------------------------- |
| `id`             | `char(30)`      | `auc_` prefix if added.                             |
| `audit_event_id` | `char(30)`      | FK to `audit_event.id`.                             |
| `team_id`        | `char(30) null` | Copied from audit event for partitioning/filtering. |
| `field`          | `text`          | Changed field path.                                 |
| `old_value_json` | `jsonb null`    | Previous value.                                     |
| `new_value_json` | `jsonb null`    | New value.                                          |

Minimum audited actions:

| Area     | Actions                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------ |
| Document | create, update, trash, restore, delete_requested, delete_performed, view_metadata, view_content. |
| Files    | upload, page_extract, rendition_create, checksum_mismatch, blob_delete.                          |
| Versions | version_create, version_promote, version_label, version_restore.                                 |
| Metadata | field_create, field_update, metadata_set, metadata_clear, type_change.                           |
| ACL      | acl_scope_create, acl_entry_create, acl_entry_delete, permission_denied.                         |
| Workflow | transition, task_create, task_complete, task_reject.                                             |

Audit is not the user notification system. Add separate activity, notification, or subscription tables if users need inbox notifications, mentions, task alerts, or email digests.

## Signatures

### `document_file_signature`

Mayan's signature model is worth keeping as a first-class extension even if signature verification ships later.

| Column                     | Type             | Notes                                     |
| -------------------------- | ---------------- | ----------------------------------------- |
| `id`                       | `char(30)`       | `sig_` prefix if added.                   |
| `team_id`                  | `char(30)`       | FK to `team.id`.                          |
| `document_file_id`         | `char(30)`       | FK to `document_file.id`.                 |
| `signature_type`           | `text`           | `embedded`, `detached`.                   |
| `signature_blob_object_id` | `char(30) null`  | Detached signature in R2.                 |
| `signature_id`             | `text null`      | Provider signature ID.                    |
| `key_id`                   | `text null`      | Signing key ID.                           |
| `public_key_fingerprint`   | `text null`      | Fingerprint.                              |
| `signed_at`                | `timestamp null` | Signature timestamp.                      |
| `verified_at`              | `timestamp null` | Verification timestamp.                   |
| `verification_status`      | `text`           | `unknown`, `valid`, `invalid`, `expired`. |

Constraints: same-team checks for `document_file_id` and detached signature blob, plus `index(team_id, document_file_id)`.

## Ingestion And Processing

### `ingest_source`

| Column         | Type         | Notes                                        |
| -------------- | ------------ | -------------------------------------------- |
| `id`           | `char(30)`   | `src_` prefix if added.                      |
| `team_id`      | `char(30)`   | FK to `team.id`.                             |
| `name`         | `text`       | Display name.                                |
| `source_type`  | `text`       | `upload`, `email`, `api`, `import`, `watch`. |
| `enabled`      | `boolean`    | Active source.                               |
| `config_json`  | `jsonb null` | Source config, secrets excluded.             |
| common columns |              | Mutable and soft-deleteable.                 |

Constraints: active partial unique `(team_id, name)`, and do not store source secrets in `config_json`; store secret references only.

### `processing_job`

PaperlessTask-style observability for OCR, thumbnailing, PDF/A, indexing, imports, and ACL recomputation.

| Column                 | Type             | Notes                                                                                        |
| ---------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `id`                   | `char(30)`       | `job_` prefix.                                                                               |
| `team_id`              | `char(30) null`  | FK to `team.id`.                                                                             |
| `job_type`             | `text`           | `consume_file`, `ocr`, `render_page`, `generate_pdfa`, `index_search`, `recompute_acl`, etc. |
| `idempotency_key`      | `text null`      | Stable key preventing duplicate jobs for retries/imports.                                    |
| `trigger_source`       | `text`           | `web_ui`, `api`, `email`, `system`, `scheduled`.                                             |
| `status`               | `text`           | `pending`, `running`, `success`, `failure`, `cancelled`.                                     |
| `priority`             | `integer`        | Queue priority.                                                                              |
| `document_id`          | `char(30) null`  | Related document.                                                                            |
| `document_version_id`  | `char(30) null`  | Related version.                                                                             |
| `input_blob_object_id` | `char(30) null`  | Related upload blob.                                                                         |
| `input_json`           | `jsonb null`     | Structured input.                                                                            |
| `result_json`          | `jsonb null`     | Structured output.                                                                           |
| `error_json`           | `jsonb null`     | Structured error.                                                                            |
| `attempts`             | `integer`        | Retry count.                                                                                 |
| `created_at`           | `timestamp`      | Enqueue time.                                                                                |
| `started_at`           | `timestamp null` | Start time.                                                                                  |
| `done_at`              | `timestamp null` | Completion time.                                                                             |
| `acknowledged_at`      | `timestamp null` | User acknowledged failure/result.                                                            |
| `acknowledged_by`      | `char(30) null`  | FK to `user.id`.                                                                             |

Indexes: `index(team_id, status, priority, created_at)`, `index(team_id, document_id, created_at)`, and partial unique `(team_id, job_type, idempotency_key)` where `idempotency_key is not null` for jobs that must not run twice.

## Search With Turbopuffer

PostgreSQL remains source of truth. Turbopuffer stores denormalized rows for query performance.

Recommended search units:

| Unit         | Purpose                                                            |
| ------------ | ------------------------------------------------------------------ |
| Document row | Search title, metadata, tags, lifecycle state, high-level summary. |
| Page row     | Search OCR/extracted text with page-level result highlighting.     |
| Chunk row    | Vector search over long OCR text, summaries, or embeddings.        |

### `search_index_item`

Tracks derived Turbopuffer rows and rebuild status.

| Column                     | Type             | Notes                                               |
| -------------------------- | ---------------- | --------------------------------------------------- |
| `id`                       | `char(30)`       | `six_` prefix.                                      |
| `team_id`                  | `char(30)`       | FK to `team.id`.                                    |
| `document_id`              | `char(30)`       | FK to `document.id`.                                |
| `document_version_id`      | `char(30) null`  | FK to `document_version.id`.                        |
| `document_version_page_id` | `char(30) null`  | FK to `document_version_page.id`.                   |
| `unit_type`                | `text`           | `document`, `page`, `chunk`.                        |
| `chunk_number`             | `integer null`   | Chunk number for long content.                      |
| `namespace`                | `text`           | Turbopuffer namespace.                              |
| `turbopuffer_id`           | `text`           | Row ID in Turbopuffer.                              |
| `content_sha256`           | `char(64) null`  | Detect stale text; nullable for metadata-only rows. |
| `metadata_sha256`          | `char(64)`       | Detect stale filters/attributes.                    |
| `access_sha256`            | `char(64)`       | Detect stale derived access filters.                |
| `status`                   | `text`           | `pending`, `indexed`, `stale`, `failed`.            |
| `indexed_at`               | `timestamp null` | Last successful index.                              |
| `error_json`               | `jsonb null`     | Last indexing error.                                |

Constraints and indexes: unique `(namespace, turbopuffer_id)`, same-team/document checks for version and page IDs, `unit_type` consistent with nullable page/chunk columns, source-side partial uniqueness for logical rows such as one document row per document, one page row per version page, and one chunk row per `(document_version_page_id, chunk_number)`, plus `index(team_id, document_id, status)` for rebuilds. Do not rely on ordinary nullable unique constraints for chunk/document/page variants.

Turbopuffer attributes to write:

| Attribute                  | Notes                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `team_id`                  | Mandatory filter.                                                                                    |
| `document_id`              | Stable Postgres identity.                                                                            |
| `document_version_id`      | Current or explicit version.                                                                         |
| `document_version_page_id` | Page result target.                                                                                  |
| `document_type_id`         | Type filter.                                                                                         |
| `lifecycle_state_id`       | Workflow filter.                                                                                     |
| `tag_ids`                  | Tag filter if supported by chosen indexing shape.                                                    |
| `metadata_*`               | Selected typed metadata fields marked `include_in_search` whose field `search_policy` allows export. |
| `access_user_ids`          | Derived user IDs from document grants if Turbopuffer filtering supports the final shape.             |
| `access_sha256`            | Hash of derived access inputs used for staleness checks.                                             |
| `content`                  | Full-text searchable field.                                                                          |
| `vector`                   | Optional embedding.                                                                                  |

Search safety:

| Rule                    | Notes                                                           |
| ----------------------- | --------------------------------------------------------------- |
| API owns search         | The client does not query Turbopuffer directly.                 |
| Permission filter first | Query with team and derived user-access filters where possible. |
| Post-filter always      | Re-check returned document IDs against PostgreSQL permissions.  |
| Rebuildable index       | Deleting Turbopuffer rows must not delete source data.          |

## Zero Sync Boundary

Zero should sync metadata and audit data needed for instant document UI and audit timelines. It should not sync full files, extracted text blobs, search state, or raw permission internals by default.

Recommended Zero-synced tables:

| Table                          | Reason                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| `document_library`             | Navigation and configuration.                                              |
| `document_folder`              | Folder tree.                                                               |
| `document_folder_entry`        | Folder contents.                                                           |
| `document`                     | Main document list and detail metadata.                                    |
| `document_version`             | Version history summary.                                                   |
| `document_version_page`        | Page count/order and page navigation.                                      |
| `document_type`                | Forms and filters.                                                         |
| `metadata_field`               | Forms and filters.                                                         |
| `metadata_field_option`        | Select fields.                                                             |
| `document_type_metadata_field` | Type field requirements.                                                   |
| `document_metadata_value`      | Current metadata whose field `sync_policy = 'zero'`.                       |
| `document_tag`                 | Tag tree.                                                                  |
| `document_tag_assignment`      | Tags on documents.                                                         |
| `saved_view`                   | User/team views.                                                           |
| `workflow_task`                | User task inbox, filtered by assignment.                                   |
| `audit_event`                  | Document audit timeline, permissioned and paginated.                       |
| `audit_event_change`           | Field-level change details for visible audit events, redacted when needed. |

Server-only by default:

| Table                 | Reason                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| `blob_object`         | Storage internals and signed URL generation stay server-side.             |
| `document_page_text`  | Large and potentially sensitive.                                          |
| `document_rendition`  | Expose through API when generating signed URLs.                           |
| `acl_scope`           | Internal permission model.                                                |
| `acl_entry`           | Internal permission model.                                                |
| `object_access_grant` | Derived authorization data; expose only safe booleans if needed.          |
| `processing_job`      | Server operations; expose filtered user-facing jobs separately if needed. |
| `search_index_item`   | Derived search state.                                                     |

For Zero authorization, mirror the current style in `packages/zero/src/queries.ts`: every query must start from Better Auth organization membership, apply team scope where relevant, and then apply safe object access predicates or derived grants. Zero queries for `document_metadata_value` must join or otherwise respect `metadata_field.sync_policy`; sensitive metadata fields and audit change payloads should be API-only or redacted even when the parent document row is visible.

## Share Links

Paperless and Nextcloud both show that expiring share links are useful, but they should not bypass audit.

### `document_share_link`

| Column                | Type             | Notes                                                                    |
| --------------------- | ---------------- | ------------------------------------------------------------------------ |
| `id`                  | `char(30)`       | `shl_` prefix if added.                                                  |
| `team_id`             | `char(30)`       | FK to `team.id`.                                                         |
| `document_id`         | `char(30)`       | FK to `document.id`.                                                     |
| `document_version_id` | `char(30) null`  | Null means current version at access time, non-null means fixed version. |
| `slug`                | `text`           | Public slug. Store token hash separately if using bearer tokens.         |
| `token_hash`          | `text`           | Hash of secret token.                                                    |
| `password_hash`       | `text null`      | Optional password for public links.                                      |
| `resource`            | `text`           | Usually `document`.                                                      |
| `action`              | `text`           | Usually `read_content`.                                                  |
| `expires_at`          | `timestamp null` | Expiration.                                                              |
| `max_uses`            | `integer null`   | Optional.                                                                |
| `use_count`           | `integer`        | Increment on access.                                                     |
| `revoked_at`          | `timestamp null` | Revocation.                                                              |
| `revoked_by`          | `char(30) null`  | FK to `user.id`.                                                         |
| `last_used_at`        | `timestamp null` | Last successful access.                                                  |
| `created_at`          | `timestamp`      | Creation time.                                                           |
| `created_by`          | `char(30) null`  | FK to `user.id`.                                                         |

Constraints and indexes: unique `(team_id, slug)`, unique `token_hash`, `index(team_id, document_id)`, and same-team check between document and fixed version. Every share access creates an `audit_event` that records the resolved `document_version_id` when the link targets the current version at access time. Multi-document bundles can be added later with a `document_share_bundle` table rather than overloading this row.

## Implementation Phases

Phases are product slices, not a promise that every nullable FK column must exist before its referenced feature table. If migrations are split by phase, add workflow, ACL, and search columns with the phase that introduces their referenced tables.

### Phase 1: DMS Core

Tables: `document_library`, `document_folder`, `document_folder_entry`, `document`, `document_version`, `blob_object`, `document_file`, `document_file_page`, `document_version_page`, `document_page_text`, `document_rendition`, `ingest_source`, `processing_job`, `audit_event`.

Capabilities: upload, ingest, OCR, page extraction, immutable versions, basic folders, mandatory audit.

### Phase 2: Metadata And Classification

Tables: `document_type`, `metadata_field`, `metadata_field_option`, `document_type_metadata_field`, `document_metadata_value`, `document_version_metadata_value`, `document_version_label`, `document_tag`, `document_tag_assignment`, `saved_view`.

Capabilities: typed metadata forms, tags, saved views, version metadata snapshots.

### Phase 3: Enterprise Access And Workflow

Tables/configuration: Better Auth dynamic access control if enabled, `acl_scope`, `acl_entry`, `object_access_grant`, `document_lock`, `lifecycle_definition`, `lifecycle_state`, `lifecycle_transition`, `document_lifecycle_event`, `workflow_task`.

Capabilities: Better Auth organization roles and coarse permissions, object-level ACL inheritance, checkout, state machine workflow, task inbox.

### Phase 4: Compliance, Search, And Collaboration

Tables: `document_file_signature`, `document_relation_type`, `document_relation`, `document_comment`, `document_annotation`, `search_index_item`, `document_share_link`.

Capabilities: signatures, related documents, annotations, Turbopuffer search, share links.

## Open Design Questions

These are not blockers for the conceptual model, but they should be decided before implementation migrations.

| Question                                                                                               | Why it matters                                                                                                        |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Should Turbopuffer use one namespace per team or one namespace per environment with `team_id` filters? | Affects isolation, operational cardinality, and search query shape. The table supports either by storing `namespace`. |
| Which symbolic version labels should be reserved by the system?                                        | `document_version_label` supports labels such as `CURRENT` and `APPROVED`; reserved names avoid user conflicts.       |
| Should metadata edits outside check-in create minor versions?                                          | Stronger version semantics but more version churn. The draft currently audits them and snapshots on version creation. |
| Should ACL `deny` entries ship in the first implementation?                                            | Denies are enterprise-friendly but make effective permission reasoning harder. The table supports them.               |
| Should any Better Auth role bypass object ACLs globally?                                               | Simpler administration, but it weakens confidential document boundaries unless the bypass is explicit and audited.    |
| Should Better Auth dynamic access control ship on day one?                                             | Dynamic roles are powerful, but static roles plus document ACLs may be enough for the first implementation.           |
| Which seeded metadata fields should default to `confidential`, `secret`, `api_only`, or `not_indexed`? | Field-level policy columns exist, but defaults matter for safe initial behavior.                                      |
| Which object access grants, if any, should be exposed as booleans through Zero?                        | Full ACL/grant internals should stay server-only, but the UI may need safe capability flags.                          |
| How much audit history should be visible in-product versus exported to compliance storage?             | The model keeps audit in Postgres with tamper-evident hashes; long-term archival can be added.                        |

## Deliberate Non-Choices

1. No migrations are generated by this draft.
2. No path-based document identity.
3. No database-stored file bytes.
4. No generic SharePoint-style fixed custom column pool.
5. No Alfresco-style universal sparse property table as the primary model.
6. No untyped comma-separated tags or JSON-only metadata values.
7. No client-side direct blob or search access without server authorization.
8. No duplicate local organization role engine while Better Auth access control can cover the role layer.
9. No cross-library filing in the initial folder model.
10. No generic activity/notification feed in the compliance audit tables.
