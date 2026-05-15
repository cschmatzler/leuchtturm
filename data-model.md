# Leuchtturm Document Data Model Draft

Status: draft for discussion.

This model starts from a Paperless-ngx and Mayan EDMS shape: documents are team-scoped, ingested files are preserved, pages and OCR are first-class, metadata is typed, audit is complete, and document versions are immutable. It deliberately leaves room for Alfresco/Nuxeo-style enterprise extensions without copying their full node/aspect complexity on day one.

## Current Project Constraints

The existing codebase already defines authentication, organizations, and teams through Better Auth tables in `packages/core/src/auth/auth.sql.ts`.

| Constraint   | Decision                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team scope   | Every document-domain table carries `team_id`. There is no organization-level document data. Organization membership is reached through `team.organization_id`. |
| IDs          | Keep the existing prefixed ULID style in `char(30)` columns, for example `usr_` plus 26 ULID chars.                                                             |
| Database     | PostgreSQL is the source of truth for all metadata and relationships.                                                                                           |
| Blob storage | Cloudflare R2 stores binary content. PostgreSQL stores object keys, digests, sizes, and lifecycle metadata.                                                     |
| Client sync  | Zero syncs selected metadata and audit tables. Full files, extracted text blobs, search state, and blob storage internals stay server/API-only.                 |
| Search       | Turbopuffer is a derived index for full-text, vector, and filtered search. It is never the source of truth.                                                     |
| Migrations   | This document is not a migration plan. Migrations should be created separately when the schema is approved.                                                     |

## Research Lessons Applied

| System        | Adopt                                                                                                                                     | Avoid                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Paperless-ngx | Typed custom fields, task observability, hierarchical tags, share links, workflow triggers as a later extension.                          | Single global namespace, unversioned OCR text, JSON document links without referential integrity.   |
| Mayan EDMS    | File/page/version-page separation, checkout model, metadata definitions, OCR per version page, signatures.                                | Generic foreign keys and overly deep indirection where relational FKs are enough.                   |
| Alfresco      | Stable node identity, typed relationships, content storage abstraction, mandatory audit, optional capabilities through model definitions. | Full sparse node-property store as the primary schema, Solr-style dependence for ordinary reads.    |
| Nuxeo         | Document types, lifecycle policies, version rows with latest/latest-major flags, ACL inheritance, read ACL optimization.                  | XML-heavy deployment model and opaque generated schema tables.                                      |
| Documentum    | Immutable version chains, symbolic labels, renditions, generic relation objects, record-management path.                                  | Proprietary ID semantics, repeating attribute tables for ordinary multi-value metadata.             |
| SharePoint    | Content type inheritance concept, checkout, major/minor versions, role definitions, permission inheritance.                               | Generic fixed column pools, path-based document identity, direct SQL-style integration assumptions. |
| Nextcloud     | Simple storage abstraction, shares with expiration, activity stream ideas.                                                                | Path-based metadata identity and notification logs as compliance audit.                             |
| Documize      | Team/workspace-oriented collaboration, action-level permission vocabulary, link integrity checks.                                         | Comma-separated tags and binary blobs embedded in database rows.                                    |

## Design Principles

1. Document identity is stable and independent of path, filename, storage key, and search index row.
2. Every document belongs to exactly one team.
3. Documents may be organized in many ways: libraries, folders, tags, saved views, typed metadata, and explicit relationships.
4. Original files are append-only. R2 objects are immutable after write.
5. Document versions are immutable once finalized.
6. Pages are first-class because OCR, annotations, renditions, and version composition depend on pages.
7. Audit is append-only and mandatory for document, metadata, version, workflow, ACL, retention, and blob lifecycle events.
8. The relational model stays queryable without requiring Turbopuffer for ordinary metadata screens.
9. Search indexes, Zero replicas, generated thumbnails, and permission caches are derived data and can be rebuilt.
10. Extensibility should come from typed definitions and typed relationships before generic JSON bags.

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
  -> workflow_task / lifecycle history
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
| `deleted_at` | `timestamp null` | Soft delete where user recovery matters.            |
| `deleted_by` | `char(30) null`  | FK to `user.id`.                                    |

Recommended ID prefixes for document-domain rows:

| Prefix | Entity                 |
| ------ | ---------------------- |
| `lib_` | Document library       |
| `fol_` | Folder                 |
| `dfe_` | Folder entry           |
| `doc_` | Document               |
| `dve_` | Document version       |
| `dfl_` | Document file          |
| `dfp_` | Document file page     |
| `dvp_` | Document version page  |
| `blo_` | Blob object            |
| `ren_` | Rendition              |
| `dty_` | Document type          |
| `mfd_` | Metadata field         |
| `dmv_` | Current metadata value |
| `vmv_` | Version metadata value |
| `tag_` | Document tag           |
| `acl_` | ACL scope              |
| `ace_` | ACL entry              |
| `aud_` | Audit event            |
| `lcd_` | Lifecycle definition   |
| `wft_` | Workflow task          |
| `job_` | Processing job         |
| `six_` | Search index item      |

## Containers And Filing

### `document_library`

A team-level container similar to a SharePoint document library, Nuxeo workspace, or Documize space. Libraries are a useful permission and configuration boundary without making documents organization-scoped.

| Column                            | Type            | Notes                            |
| --------------------------------- | --------------- | -------------------------------- |
| `id`                              | `char(30)`      | `lib_` prefix.                   |
| `team_id`                         | `char(30)`      | FK to `team.id`.                 |
| `name`                            | `text`          | Display name.                    |
| `slug`                            | `text`          | Unique within team.              |
| `description`                     | `text null`     | Optional.                        |
| `default_document_type_id`        | `char(30) null` | FK to `document_type.id`.        |
| `default_lifecycle_definition_id` | `char(30) null` | FK to `lifecycle_definition.id`. |
| `acl_scope_id`                    | `char(30) null` | FK to `acl_scope.id`.            |
| common columns                    |                 | Mutable and soft-deleteable.     |

Constraints and indexes:

| Constraint                   | Notes                                 |
| ---------------------------- | ------------------------------------- |
| `unique(team_id, slug)`      | Active library slugs are team-unique. |
| `index(team_id, deleted_at)` | Fast active library listing.          |

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
| `acl_scope_id`     | `char(30) null` | Optional permission inheritance break.               |
| common columns     |                 | Mutable and soft-deleteable.                         |

Constraints and indexes:

| Constraint                                     | Notes                                               |
| ---------------------------------------------- | --------------------------------------------------- |
| `unique(library_id, parent_folder_id, name)`   | Prevent sibling name collisions for active folders. |
| `index(team_id, library_id, parent_folder_id)` | Fast tree loading.                                  |

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

| Constraint                       | Notes                                   |
| -------------------------------- | --------------------------------------- |
| `unique(folder_id, document_id)` | No duplicate filing in the same folder. |
| `index(team_id, document_id)`    | Find all folders for a document.        |

## Documents And Immutable Versions

### `document`

The stable logical document. This is the row Zero will usually list.

| Column                     | Type             | Notes                                                         |
| -------------------------- | ---------------- | ------------------------------------------------------------- |
| `id`                       | `char(30)`       | `doc_` prefix.                                                |
| `team_id`                  | `char(30)`       | FK to `team.id`.                                              |
| `library_id`               | `char(30)`       | FK to `document_library.id`.                                  |
| `document_type_id`         | `char(30) null`  | FK to `document_type.id`. Nullable for early ingestion stubs. |
| `title`                    | `text`           | User-facing title.                                            |
| `description`              | `text null`      | Optional.                                                     |
| `language`                 | `text null`      | Primary language code, like Mayan.                            |
| `owner_user_id`            | `char(30) null`  | FK to `user.id`. Ownership is not the permission model.       |
| `current_version_id`       | `char(30) null`  | FK to `document_version.id`. Null while stub or processing.   |
| `current_major_version_id` | `char(30) null`  | FK to `document_version.id`. Useful for published views.      |
| `lifecycle_definition_id`  | `char(30) null`  | FK to `lifecycle_definition.id`.                              |
| `lifecycle_state_id`       | `char(30) null`  | FK to `lifecycle_state.id`.                                   |
| `acl_scope_id`             | `char(30) null`  | FK to `acl_scope.id`. Null means inherit from folder/library. |
| `is_stub`                  | `boolean`        | True until first usable version exists.                       |
| `in_trash`                 | `boolean`        | Recoverable user deletion.                                    |
| `trashed_at`               | `timestamp null` | Trash timestamp.                                              |
| `trashed_by`               | `char(30) null`  | FK to `user.id`.                                              |
| common columns             |                  | Mutable and soft-deleteable.                                  |

Indexes:

| Index                                  | Notes               |
| -------------------------------------- | ------------------- |
| `index(team_id, library_id, in_trash)` | Main document list. |
| `index(team_id, document_type_id)`     | Type filters.       |
| `index(team_id, lifecycle_state_id)`   | Workflow queues.    |
| `index(team_id, current_version_id)`   | Version joins.      |

### `document_version`

Immutable version object. New check-ins create new rows. Existing finalized rows are never edited except derived flags such as `is_current` if we choose not to compute those from `document.current_version_id`.

| Column                   | Type            | Notes                                                           |
| ------------------------ | --------------- | --------------------------------------------------------------- |
| `id`                     | `char(30)`      | `dve_` prefix.                                                  |
| `team_id`                | `char(30)`      | FK to `team.id`.                                                |
| `document_id`            | `char(30)`      | FK to `document.id`.                                            |
| `version_index`          | `integer`       | Monotonic integer per document.                                 |
| `major_number`           | `integer`       | Major version number.                                           |
| `minor_number`           | `integer`       | Minor version number.                                           |
| `label`                  | `text`          | Display label, for example `1.0`, `1.1`, `CURRENT`, `APPROVED`. |
| `version_kind`           | `text`          | `major`, `minor`, `draft`, `import`, `system`.                  |
| `predecessor_version_id` | `char(30) null` | FK to previous version.                                         |
| `comment`                | `text null`     | Check-in reason.                                                |
| `content_sha256`         | `char(64) null` | Hash over version page source references and metadata snapshot. |
| `status`                 | `text`          | `creating`, `ready`, `failed`, `superseded`.                    |
| `is_current`             | `boolean`       | Convenience flag; enforce one current per document if stored.   |
| `is_current_major`       | `boolean`       | Convenience flag for published/latest-major view.               |
| `created_at`             | `timestamp`     | Version creation timestamp.                                     |
| `created_by`             | `char(30) null` | User/system actor.                                              |

Constraints and indexes:

| Constraint                                        | Notes                                                    |
| ------------------------------------------------- | -------------------------------------------------------- |
| `unique(document_id, version_index)`              | Stable ordering.                                         |
| `unique(document_id, major_number, minor_number)` | Prevent duplicate labels for numeric versions.           |
| `unique(document_id, label)`                      | Optional if symbolic labels must be unique per document. |
| partial unique `is_current`                       | At most one current version per document.                |
| partial unique `is_current_major`                 | At most one current major version per document.          |

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

Recommended R2 key shape:

```text
teams/{team_id}/documents/{document_id}/files/{document_file_id}/original
teams/{team_id}/documents/{document_id}/versions/{document_version_id}/renditions/{kind}
teams/{team_id}/documents/{document_id}/versions/{document_version_id}/pages/{page_number}/{kind}
```

### `document_file`

Append-only uploaded or ingested file. A document can have many files over time. A version can map pages from one or more files.

| Column              | Type            | Notes                                           |
| ------------------- | --------------- | ----------------------------------------------- |
| `id`                | `char(30)`      | `dfl_` prefix.                                  |
| `team_id`           | `char(30)`      | FK to `team.id`.                                |
| `document_id`       | `char(30)`      | FK to `document.id`.                            |
| `blob_object_id`    | `char(30)`      | FK to `blob_object.id`.                         |
| `original_filename` | `text null`     | Name supplied by upload/source.                 |
| `mime_type`         | `text null`     | Detected MIME type.                             |
| `encoding`          | `text null`     | Text encoding when relevant.                    |
| `size_bytes`        | `bigint`        | Duplicate of blob size for fast reads.          |
| `sha256`            | `char(64)`      | Duplicate of blob hash for duplicate detection. |
| `source`            | `text`          | `upload`, `email`, `api`, `import`, `system`.   |
| `comment`           | `text null`     | Upload note.                                    |
| `created_at`        | `timestamp`     | Ingestion timestamp.                            |
| `created_by`        | `char(30) null` | User/system actor.                              |

Indexes:

| Index                                     | Notes                |
| ----------------------------------------- | -------------------- |
| `index(team_id, document_id, created_at)` | File history.        |
| `index(team_id, sha256, size_bytes)`      | Duplicate detection. |

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

Constraint: `unique(document_file_id, page_number)`.

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

Constraint: `unique(document_version_id, page_number)`.

### `document_page_text`

OCR or extracted text for a version page. This stays server-side by default because it can be large.

| Column                     | Type            | Notes                                 |
| -------------------------- | --------------- | ------------------------------------- |
| `id`                       | `char(30)`      | `dpt_` prefix if added.               |
| `team_id`                  | `char(30)`      | FK to `team.id`.                      |
| `document_version_page_id` | `char(30)`      | FK to `document_version_page.id`.     |
| `engine`                   | `text null`     | OCR/extraction backend.               |
| `language`                 | `text null`     | OCR language.                         |
| `content`                  | `text`          | Extracted text.                       |
| `confidence`               | `numeric null`  | Optional OCR confidence.              |
| `layout_blob_object_id`    | `char(30) null` | Optional HOCR/ALTO/layout JSON in R2. |
| `created_at`               | `timestamp`     | Extraction timestamp.                 |

Constraint: `unique(document_version_page_id)`.

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
| `blob_object_id`           | `char(30)`      | FK to `blob_object.id`.                                      |
| `status`                   | `text`          | `ready`, `stale`, `failed`.                                  |
| `created_at`               | `timestamp`     | Generation timestamp.                                        |

## Document Types And Typed Metadata

### `document_type`

Team-scoped content type. This borrows from Mayan, Nuxeo, and SharePoint while staying relational and migration-friendly.

| Column                            | Type            | Notes                            |
| --------------------------------- | --------------- | -------------------------------- |
| `id`                              | `char(30)`      | `dty_` prefix.                   |
| `team_id`                         | `char(30)`      | FK to `team.id`.                 |
| `name`                            | `text`          | Display name.                    |
| `slug`                            | `text`          | Stable key within team.          |
| `description`                     | `text null`     | Optional.                        |
| `color`                           | `text null`     | UI hint.                         |
| `icon`                            | `text null`     | UI hint.                         |
| `default_lifecycle_definition_id` | `char(30) null` | FK to `lifecycle_definition.id`. |
| common columns                    |                 | Mutable and soft-deleteable.     |

Constraint: `unique(team_id, slug)`.

### `metadata_field`

Reusable team-scoped field definition.

| Column            | Type         | Notes                                                    |
| ----------------- | ------------ | -------------------------------------------------------- |
| `id`              | `char(30)`   | `mfd_` prefix.                                           |
| `team_id`         | `char(30)`   | FK to `team.id`.                                         |
| `name`            | `text`       | Internal name.                                           |
| `label`           | `text`       | Display label.                                           |
| `data_type`       | `text`       | See supported types below.                               |
| `description`     | `text null`  | Optional.                                                |
| `validation_json` | `jsonb null` | Min/max, regex, date bounds, precision, etc.             |
| `lookup_json`     | `jsonb null` | Future controlled lookup/source config.                  |
| `extra_json`      | `jsonb null` | Type-specific settings that are not primary query paths. |
| common columns    |              | Mutable and soft-deleteable.                             |

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

### `document_type_metadata_field`

Assigns fields to document types.

| Column               | Type         | Notes                              |
| -------------------- | ------------ | ---------------------------------- |
| `id`                 | `char(30)`   | `dtf_` prefix if added.            |
| `team_id`            | `char(30)`   | FK to `team.id`.                   |
| `document_type_id`   | `char(30)`   | FK to `document_type.id`.          |
| `metadata_field_id`  | `char(30)`   | FK to `metadata_field.id`.         |
| `required`           | `boolean`    | Required for this type.            |
| `repeatable`         | `boolean`    | Multiple values allowed.           |
| `position`           | `integer`    | Form/display order.                |
| `default_value_json` | `jsonb null` | Default value in typed JSON form.  |
| `include_in_search`  | `boolean`    | Copy into search index attributes. |
| `created_at`         | `timestamp`  | Assignment timestamp.              |

Constraint: `unique(document_type_id, metadata_field_id)`.

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

Constraint: `unique(document_id, metadata_field_id, position)`.

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

Constraint: `unique(document_version_id, metadata_field_id, position)`.

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

| Column            | Type            | Notes                                      |
| ----------------- | --------------- | ------------------------------------------ |
| `id`              | `char(30)`      | `tag_` prefix.                             |
| `team_id`         | `char(30)`      | FK to `team.id`.                           |
| `parent_tag_id`   | `char(30) null` | FK to `document_tag.id`.                   |
| `name`            | `text`          | Display name.                              |
| `slug`            | `text`          | Stable key among siblings.                 |
| `color`           | `text null`     | UI hint.                                   |
| `match_text`      | `text null`     | Optional auto-classification hint.         |
| `match_algorithm` | `text null`     | `literal`, `regex`, `fuzzy`, `all`, `any`. |
| `is_inbox_tag`    | `boolean`       | Optional Paperless-style inbox marker.     |
| common columns    |                 | Mutable and soft-deleteable.               |

Constraint: `unique(team_id, parent_tag_id, slug)`.

### `document_tag_assignment`

| Column        | Type            | Notes                    |
| ------------- | --------------- | ------------------------ |
| `id`          | `char(30)`      | `dta_` prefix if added.  |
| `team_id`     | `char(30)`      | FK to `team.id`.         |
| `document_id` | `char(30)`      | FK to `document.id`.     |
| `tag_id`      | `char(30)`      | FK to `document_tag.id`. |
| `created_at`  | `timestamp`     | Assignment time.         |
| `created_by`  | `char(30) null` | FK to `user.id`.         |

Constraint: `unique(document_id, tag_id)`.

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

## Relationships, Comments, And Annotations

### `document_relation_type`

Typed relationship definitions, taking the useful part of Alfresco and Documentum relations without a full generic node store.

| Column            | Type        | Notes                                  |
| ----------------- | ----------- | -------------------------------------- |
| `id`              | `char(30)`  | `drt_` prefix if added.                |
| `team_id`         | `char(30)`  | FK to `team.id`.                       |
| `name`            | `text`      | Display name.                          |
| `slug`            | `text`      | Stable key.                            |
| `inverse_name`    | `text null` | Display name for reverse direction.    |
| `version_binding` | `text`      | `current`, `specific_version`, `none`. |
| `created_at`      | `timestamp` | Definition timestamp.                  |

Initial built-in relation slugs: `references`, `replaces`, `is_part_of`, `has_part`, `duplicates`, `supersedes`, `supports`.

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

Documents are team-scoped, but team membership alone is not enough for enterprise document access. Use object-level ACL scopes with inheritance from library to folder to document.

### Permission Vocabulary

Initial permissions:

| Permission            | Meaning                                                 |
| --------------------- | ------------------------------------------------------- |
| `read_metadata`       | See document row and non-sensitive metadata.            |
| `read_content`        | Download/view file contents and OCR text.               |
| `create_document`     | Create documents in a library/folder.                   |
| `update_metadata`     | Edit title, tags, type, and metadata values.            |
| `update_content`      | Upload files, create versions, modify page composition. |
| `delete_document`     | Move to trash or request deletion.                      |
| `restore_document`    | Restore from trash.                                     |
| `manage_versions`     | Promote, label, or restore versions.                    |
| `check_out`           | Lock/check out a document.                              |
| `transition_workflow` | Perform lifecycle transitions.                          |
| `manage_acl`          | Change permissions.                                     |
| `share`               | Create share links or external access.                  |
| `view_audit`          | View audit history.                                     |
| `manage_records`      | Declare records, holds, retention, disposition.         |

### `permission_role`

Team-scoped role bundle similar to SharePoint role definitions.

| Column         | Type       | Notes                             |
| -------------- | ---------- | --------------------------------- |
| `id`           | `char(30)` | `pro_` prefix if added.           |
| `team_id`      | `char(30)` | FK to `team.id`.                  |
| `name`         | `text`     | Display name.                     |
| `slug`         | `text`     | Stable key.                       |
| `built_in`     | `boolean`  | Built-in roles cannot be deleted. |
| common columns |            | Mutable and soft-deleteable.      |

Built-in roles: `viewer`, `contributor`, `editor`, `manager`, `records_manager`.

### `permission_role_permission`

| Column               | Type       | Notes                       |
| -------------------- | ---------- | --------------------------- |
| `team_id`            | `char(30)` | FK to `team.id`.            |
| `permission_role_id` | `char(30)` | FK to `permission_role.id`. |
| `permission`         | `text`     | Permission key.             |

Primary key: `(permission_role_id, permission)`.

### `acl_scope`

Inheritance scope for library, folder, document, and later document type or saved view.

| Column                | Type            | Notes                            |
| --------------------- | --------------- | -------------------------------- |
| `id`                  | `char(30)`      | `acl_` prefix.                   |
| `team_id`             | `char(30)`      | FK to `team.id`.                 |
| `object_type`         | `text`          | `library`, `folder`, `document`. |
| `object_id`           | `char(30)`      | ID of scoped object.             |
| `parent_acl_scope_id` | `char(30) null` | FK to inherited scope.           |
| `inheritance_mode`    | `text`          | `inherit`, `break`, `append`.    |
| `created_at`          | `timestamp`     | Creation timestamp.              |
| `created_by`          | `char(30) null` | FK to `user.id`.                 |

Constraint: `unique(object_type, object_id)`.

### `acl_entry`

| Column               | Type            | Notes                                        |
| -------------------- | --------------- | -------------------------------------------- |
| `id`                 | `char(30)`      | `ace_` prefix.                               |
| `team_id`            | `char(30)`      | FK to `team.id`.                             |
| `acl_scope_id`       | `char(30)`      | FK to `acl_scope.id`.                        |
| `principal_type`     | `text`          | `team`, `user`, `team_role`.                 |
| `principal_id`       | `text`          | `team.id`, `user.id`, or role key.           |
| `permission_role_id` | `char(30)`      | FK to `permission_role.id`.                  |
| `effect`             | `text`          | `allow` or `deny`.                           |
| `position`           | `integer`       | Explicit order for deterministic resolution. |
| `created_at`         | `timestamp`     | Creation timestamp.                          |
| `created_by`         | `char(30) null` | FK to `user.id`.                             |

### `document_access_grant`

Derived read model for fast Zero and Turbopuffer filtering. This table is rebuilt when ACLs, folder filing, team membership, or role definitions change.

| Column           | Type        | Notes                        |
| ---------------- | ----------- | ---------------------------- |
| `team_id`        | `char(30)`  | FK to `team.id`.             |
| `document_id`    | `char(30)`  | FK to `document.id`.         |
| `principal_type` | `text`      | `team`, `user`, `team_role`. |
| `principal_id`   | `text`      | Principal key.               |
| `permission`     | `text`      | Effective permission.        |
| `computed_at`    | `timestamp` | Last computation.            |

Primary key: `(document_id, principal_type, principal_id, permission)`.

Security rule:

| Rule               | Notes                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Server enforcement | All write and read APIs enforce permissions on the server.                                             |
| Zero queries       | Zero queries must include authorization predicates or reference safe derived grants.                   |
| Search             | Turbopuffer filters are an optimization; API post-filtering against PostgreSQL remains the safety net. |

## Checkout And Locks

### `document_lock`

One active checkout-style lock per document unless a future collaborative editor needs shared locks.

| Column        | Type             | Notes                                |
| ------------- | ---------------- | ------------------------------------ |
| `id`          | `char(30)`       | `lok_` prefix if added.              |
| `team_id`     | `char(30)`       | FK to `team.id`.                     |
| `document_id` | `char(30)`       | FK to `document.id`.                 |
| `user_id`     | `char(30)`       | FK to `user.id`.                     |
| `lock_type`   | `text`           | `checkout`, `read_only`, `workflow`. |
| `expires_at`  | `timestamp null` | Auto-expiry.                         |
| `created_at`  | `timestamp`      | Lock creation time.                  |
| `comment`     | `text null`      | Optional reason.                     |

Recommended constraint: one unexpired `checkout` lock per document.

## Lifecycle And Workflow

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

Constraint: `unique(team_id, slug)`.

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
| `required_permission`      | `text`     | Usually `transition_workflow`.             |
| `requires_comment`         | `boolean`  | Comment required.                          |
| `creates_major_version`    | `boolean`  | Transition creates/promotes major version. |
| `requires_completed_tasks` | `boolean`  | Blocks until tasks are complete.           |

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
| `assigned_to_type`    | `text`           | `user`, `team`, `team_role`.                            |
| `assigned_to_id`      | `text`           | Principal key.                                          |
| `status`              | `text`           | `open`, `approved`, `rejected`, `cancelled`, `expired`. |
| `due_at`              | `timestamp null` | Optional due date.                                      |
| `completed_at`        | `timestamp null` | Completion time.                                        |
| `completed_by`        | `char(30) null`  | FK to `user.id`.                                        |
| `outcome`             | `text null`      | Transition-specific outcome.                            |
| `comment`             | `text null`      | Completion comment.                                     |
| `created_at`          | `timestamp`      | Assignment time.                                        |

## Audit Trail

Audit is mandatory. It should not be treated as an activity feed that can be pruned without policy.

### `audit_event`

| Column          | Type            | Notes                                                      |
| --------------- | --------------- | ---------------------------------------------------------- |
| `id`            | `char(30)`      | `aud_` prefix.                                             |
| `team_id`       | `char(30) null` | Null only for cross-team/system auth events.               |
| `actor_user_id` | `char(30) null` | FK to `user.id`. Null for system.                          |
| `actor_type`    | `text`          | `user`, `system`, `api_token`, `background_job`.           |
| `action`        | `text`          | Machine-readable event key.                                |
| `target_type`   | `text`          | `document`, `version`, `metadata`, `acl`, `workflow`, etc. |
| `target_id`     | `char(30) null` | Target object ID.                                          |
| `document_id`   | `char(30) null` | FK to `document.id` when event is document-related.        |
| `request_id`    | `text null`     | Correlates API logs.                                       |
| `ip_address`    | `text null`     | Client IP.                                                 |
| `user_agent`    | `text null`     | Client UA.                                                 |
| `outcome`       | `text`          | `success`, `failure`, `denied`.                            |
| `summary`       | `text null`     | Human-readable summary.                                    |
| `metadata_json` | `jsonb null`    | Event-specific payload.                                    |
| `previous_hash` | `char(64) null` | Hash chain predecessor for tamper evidence.                |
| `entry_hash`    | `char(64) null` | Hash over canonical event payload.                         |
| `occurred_at`   | `timestamp`     | Event time.                                                |

### `audit_event_change`

Optional normalized field-level changes for easier audit UI.

| Column           | Type         | Notes                   |
| ---------------- | ------------ | ----------------------- |
| `id`             | `char(30)`   | `auc_` prefix if added. |
| `audit_event_id` | `char(30)`   | FK to `audit_event.id`. |
| `field`          | `text`       | Changed field path.     |
| `old_value_json` | `jsonb null` | Previous value.         |
| `new_value_json` | `jsonb null` | New value.              |

Minimum audited actions:

| Area     | Actions                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------ |
| Document | create, update, trash, restore, delete_requested, delete_performed, view_metadata, view_content. |
| Files    | upload, page_extract, rendition_create, checksum_mismatch, blob_delete.                          |
| Versions | version_create, version_promote, version_label, version_restore.                                 |
| Metadata | field_create, field_update, metadata_set, metadata_clear, type_change.                           |
| ACL      | acl_scope_create, acl_entry_create, acl_entry_delete, permission_denied.                         |
| Workflow | transition, task_create, task_complete, task_reject.                                             |
| Records  | record_declare, hold_add, hold_release, retention_schedule, disposition.                         |

## Retention And Records Management

Moderate compliance now, strong records management later. Keep the core hooks from the beginning.

### `retention_policy`

| Column               | Type            | Notes                                                     |
| -------------------- | --------------- | --------------------------------------------------------- |
| `id`                 | `char(30)`      | `rtp_` prefix if added.                                   |
| `team_id`            | `char(30)`      | FK to `team.id`.                                          |
| `name`               | `text`          | Display name.                                             |
| `slug`               | `text`          | Stable key.                                               |
| `trigger`            | `text`          | `created_at`, `added_at`, `approved_at`, `metadata_date`. |
| `metadata_field_id`  | `char(30) null` | Required when trigger is `metadata_date`.                 |
| `duration_months`    | `integer`       | Retention duration.                                       |
| `disposition_action` | `text`          | `review`, `delete`, `archive`.                            |
| `enabled`            | `boolean`       | Active policy.                                            |
| common columns       |                 | Mutable and soft-deleteable.                              |

### `document_record`

| Column                | Type             | Notes                                             |
| --------------------- | ---------------- | ------------------------------------------------- |
| `document_id`         | `char(30)`       | PK and FK to `document.id`.                       |
| `team_id`             | `char(30)`       | FK to `team.id`.                                  |
| `retention_policy_id` | `char(30) null`  | FK to `retention_policy.id`.                      |
| `declared_at`         | `timestamp null` | When declared a record.                           |
| `declared_by`         | `char(30) null`  | FK to `user.id`.                                  |
| `retain_until`        | `timestamp null` | Computed retention date.                          |
| `disposition_state`   | `text`           | `none`, `pending_review`, `approved`, `disposed`. |

### `document_hold`

| Column        | Type             | Notes                           |
| ------------- | ---------------- | ------------------------------- |
| `id`          | `char(30)`       | `hol_` prefix if added.         |
| `team_id`     | `char(30)`       | FK to `team.id`.                |
| `document_id` | `char(30)`       | FK to `document.id`.            |
| `reason`      | `text`           | Hold reason.                    |
| `matter_ref`  | `text null`      | Legal matter or case reference. |
| `created_at`  | `timestamp`      | Hold start.                     |
| `created_by`  | `char(30) null`  | FK to `user.id`.                |
| `released_at` | `timestamp null` | Hold release.                   |
| `released_by` | `char(30) null`  | FK to `user.id`.                |

Deletion rule: a document with an active hold or unexpired retention date cannot be permanently deleted by normal user flows.

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

### `processing_job`

PaperlessTask-style observability for OCR, thumbnailing, PDF/A, indexing, retention checks, imports, and ACL recomputation.

| Column                 | Type             | Notes                                                                                        |
| ---------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `id`                   | `char(30)`       | `job_` prefix.                                                                               |
| `team_id`              | `char(30) null`  | FK to `team.id`.                                                                             |
| `job_type`             | `text`           | `consume_file`, `ocr`, `render_page`, `generate_pdfa`, `index_search`, `recompute_acl`, etc. |
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

| Column                     | Type             | Notes                                    |
| -------------------------- | ---------------- | ---------------------------------------- |
| `id`                       | `char(30)`       | `six_` prefix.                           |
| `team_id`                  | `char(30)`       | FK to `team.id`.                         |
| `document_id`              | `char(30)`       | FK to `document.id`.                     |
| `document_version_id`      | `char(30) null`  | FK to `document_version.id`.             |
| `document_version_page_id` | `char(30) null`  | FK to `document_version_page.id`.        |
| `chunk_number`             | `integer null`   | Chunk number for long content.           |
| `namespace`                | `text`           | Turbopuffer namespace.                   |
| `turbopuffer_id`           | `text`           | Row ID in Turbopuffer.                   |
| `content_sha256`           | `char(64)`       | Detect stale text.                       |
| `metadata_sha256`          | `char(64)`       | Detect stale filters/attributes.         |
| `status`                   | `text`           | `pending`, `indexed`, `stale`, `failed`. |
| `indexed_at`               | `timestamp null` | Last successful index.                   |
| `error_json`               | `jsonb null`     | Last indexing error.                     |

Turbopuffer attributes to write:

| Attribute                  | Notes                                                                     |
| -------------------------- | ------------------------------------------------------------------------- |
| `team_id`                  | Mandatory filter.                                                         |
| `document_id`              | Stable Postgres identity.                                                 |
| `document_version_id`      | Current or explicit version.                                              |
| `document_version_page_id` | Page result target.                                                       |
| `document_type_id`         | Type filter.                                                              |
| `lifecycle_state_id`       | Workflow filter.                                                          |
| `tag_ids`                  | Tag filter if supported by chosen indexing shape.                         |
| `metadata_*`               | Selected typed metadata fields marked `include_in_search`.                |
| `access_principals`        | Derived principal keys if Turbopuffer filtering supports the final shape. |
| `content`                  | Full-text searchable field.                                               |
| `vector`                   | Optional embedding.                                                       |

Search safety:

| Rule                    | Notes                                                          |
| ----------------------- | -------------------------------------------------------------- |
| API owns search         | The client does not query Turbopuffer directly.                |
| Permission filter first | Query with team and access-principal filters where possible.   |
| Post-filter always      | Re-check returned document IDs against PostgreSQL permissions. |
| Rebuildable index       | Deleting Turbopuffer rows must not delete source data.         |

## Zero Sync Boundary

Zero should sync metadata and audit data needed for instant document UI and audit timelines. It should not sync full files, extracted text blobs, search state, or raw permission internals by default.

Recommended Zero-synced tables:

| Table                          | Reason                                               |
| ------------------------------ | ---------------------------------------------------- |
| `document_library`             | Navigation and configuration.                        |
| `document_folder`              | Folder tree.                                         |
| `document_folder_entry`        | Folder contents.                                     |
| `document`                     | Main document list and detail metadata.              |
| `document_version`             | Version history summary.                             |
| `document_version_page`        | Page count/order and page navigation.                |
| `document_type`                | Forms and filters.                                   |
| `metadata_field`               | Forms and filters.                                   |
| `metadata_field_option`        | Select fields.                                       |
| `document_type_metadata_field` | Type field requirements.                             |
| `document_metadata_value`      | Current metadata.                                    |
| `document_tag`                 | Tag tree.                                            |
| `document_tag_assignment`      | Tags on documents.                                   |
| `saved_view`                   | User/team views.                                     |
| `workflow_task`                | User task inbox, filtered by assignment.             |
| `audit_event`                  | Document audit timeline, permissioned and paginated. |
| `audit_event_change`           | Field-level change details for visible audit events. |

Server-only by default:

| Table                   | Reason                                                                    |
| ----------------------- | ------------------------------------------------------------------------- |
| `blob_object`           | Storage internals and signed URL generation stay server-side.             |
| `document_page_text`    | Large and potentially sensitive.                                          |
| `document_rendition`    | Expose through API when generating signed URLs.                           |
| `acl_scope`             | Internal permission model.                                                |
| `acl_entry`             | Internal permission model.                                                |
| `document_access_grant` | Derived authorization data; expose only safe booleans if needed.          |
| `processing_job`        | Server operations; expose filtered user-facing jobs separately if needed. |
| `search_index_item`     | Derived search state.                                                     |

For Zero authorization, mirror the current style in `packages/zero/src/queries.ts`: every query must start from team membership and then apply document access predicates.

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
| `permission`          | `text`           | Usually `read_content`.                                                  |
| `expires_at`          | `timestamp null` | Expiration.                                                              |
| `max_uses`            | `integer null`   | Optional.                                                                |
| `use_count`           | `integer`        | Increment on access.                                                     |
| `revoked_at`          | `timestamp null` | Revocation.                                                              |
| `created_at`          | `timestamp`      | Creation time.                                                           |
| `created_by`          | `char(30) null`  | FK to `user.id`.                                                         |

Every share access creates an `audit_event`.

## Implementation Phases

### Phase 1: DMS Core

Tables: `document_library`, `document_folder`, `document_folder_entry`, `document`, `document_version`, `blob_object`, `document_file`, `document_file_page`, `document_version_page`, `document_page_text`, `document_rendition`, `processing_job`, `audit_event`.

Capabilities: upload, ingest, OCR, page extraction, immutable versions, basic folders, mandatory audit.

### Phase 2: Metadata And Classification

Tables: `document_type`, `metadata_field`, `metadata_field_option`, `document_type_metadata_field`, `document_metadata_value`, `document_version_metadata_value`, `document_tag`, `document_tag_assignment`, `saved_view`.

Capabilities: typed metadata forms, tags, saved views, version metadata snapshots.

### Phase 3: Enterprise Access And Workflow

Tables: `permission_role`, `permission_role_permission`, `acl_scope`, `acl_entry`, `document_access_grant`, `document_lock`, `lifecycle_definition`, `lifecycle_state`, `lifecycle_transition`, `document_lifecycle_event`, `workflow_task`.

Capabilities: object-level ACL inheritance, checkout, state machine workflow, task inbox.

### Phase 4: Compliance, Search, And Collaboration

Tables: `retention_policy`, `document_record`, `document_hold`, `document_file_signature`, `document_relation_type`, `document_relation`, `document_comment`, `document_annotation`, `search_index_item`, `document_share_link`.

Capabilities: retention-ready model, holds, signatures, related documents, annotations, Turbopuffer search, share links.

## Open Design Questions

These are not blockers for the conceptual model, but they should be decided before implementation migrations.

| Question                                                                                               | Why it matters                                                                                                        |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Should Turbopuffer use one namespace per team or one namespace per environment with `team_id` filters? | Affects isolation, operational cardinality, and search query shape. The table supports either by storing `namespace`. |
| Should symbolic version labels be unique per document?                                                 | Documentum allows multiple labels in some cases; simpler UI usually wants unique labels.                              |
| Should metadata edits outside check-in create minor versions?                                          | Stronger version semantics but more version churn. The draft currently audits them and snapshots on version creation. |
| Should ACL `deny` entries ship in the first implementation?                                            | Denies are enterprise-friendly but make effective permission reasoning harder. The table supports them.               |
| Which metadata fields are sensitive and should not sync through Zero?                                  | Some field values may need API-only access even if most metadata syncs.                                               |
| How much audit history should be visible in-product versus exported to compliance storage?             | The model keeps audit in Postgres with tamper-evident hashes; long-term archival can be added.                        |

## Deliberate Non-Choices

1. No migrations are generated by this draft.
2. No path-based document identity.
3. No database-stored file bytes.
4. No generic SharePoint-style fixed custom column pool.
5. No Alfresco-style universal sparse property table as the primary model.
6. No untyped comma-separated tags or JSON-only metadata values.
7. No client-side direct blob or search access without server authorization.
