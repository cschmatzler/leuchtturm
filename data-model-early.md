# Leuchtturm Early Document Data Model

Status: early implementation draft.

This is the reduced model for the first useful DMS slice. It keeps documents, immutable versions, uploaded files, OCR/page text, processing observability, folders, tags, document types, typed metadata, ACLs, and Turbopuffer search bookkeeping. It intentionally excludes document-to-document links, retention/records management, lifecycle workflow, comments, annotations, signatures, and share links.

## Scope

| In scope                                   | Out of scope                                         |
| ------------------------------------------ | ---------------------------------------------------- |
| Team-scoped document libraries and folders | Document-to-document links                           |
| Stable documents with immutable versions   | Retention policies, records, and legal holds         |
| Uploaded/ingested files in R2              | Lifecycle/workflow state machines and approval tasks |
| Page extraction and OCR text               | Comments and annotations                             |
| Processing jobs for ingest/OCR/renditions  | Signatures                                           |
| Tags                                       | Share links                                          |
| Document types and typed metadata          | Share links                                          |
| Object-level ACLs backed by Better Auth    | Organization-level document data                     |
| Turbopuffer/search-index bookkeeping       |                                                      |

## Core Constraints

| Constraint     | Decision                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team scope     | Every document-domain table carries `team_id`. There is no organization-level document data.                                                                                                                     |
| Auth and roles | Better Auth owns users, organization membership, team membership, organization roles, dynamic roles, and coarse permission vocabulary. Document ACLs bind those principals to libraries, folders, and documents. |
| IDs            | Use prefixed ULIDs in `char(30)` columns, for example `doc_` plus 26 ULID chars.                                                                                                                                 |
| Database       | PostgreSQL is the source of truth for metadata, folders, tags, ACLs, and processing state.                                                                                                                       |
| Blob storage   | Cloudflare R2 stores binary content. PostgreSQL stores object keys, digests, and sizes.                                                                                                                          |
| Client sync    | Zero may sync selected metadata and ACL-derived visibility. Full files, OCR text, processing internals, and blob storage internals stay server/API-only by default.                                              |
| Search         | Turbopuffer is a derived index for full-text, vector, and filtered search. PostgreSQL remains the source of truth.                                                                                               |
| Migrations     | This document is not a migration plan. Create migrations separately after approval.                                                                                                                              |

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
  -> document_rendition
  -> audit_event
  -> processing_job
  -> search_index_item -> Turbopuffer row
```

## Common Columns

Use singular table names to match existing tables such as `user`, `team`, and `team_member`.

Use these common columns unless a table is intentionally immutable, append-only, or a pure association table.

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

Recommended ID prefixes for this early model:

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
| `mfo_` | Metadata field option   |
| `dtf_` | Document type field     |
| `dmv_` | Current metadata value  |
| `vmv_` | Version metadata value  |
| `tag_` | Document tag            |
| `dta_` | Document tag assignment |
| `acl_` | ACL scope               |
| `ace_` | ACL entry               |
| `oag_` | Object access grant     |
| `lok_` | Document lock           |
| `aud_` | Audit event             |
| `auc_` | Audit change            |
| `src_` | Ingest source           |
| `job_` | Processing job          |
| `six_` | Search index item       |

## Tenant And Referential Integrity

`team_id` is a denormalized tenant key on document-domain rows for filtering, indexing, authorization, and operational safety. It is not by itself proof that two referenced rows belong together.

| Relationship type                  | Enforcement decision                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct parent-child rows           | Enforce in API/service code and transactions; use ordinary FKs. Examples: `document_file.document_id`, `document_version.document_id`.                     |
| Cross-object association rows      | Enforce same-team in API code and prefer composite FKs or equivalent database checks when practical. Examples: folder entries, tag assignments, ACLs.      |
| Security/cache tables              | Prefer database-enforced tenant/object integrity. Bad rows can create data leaks through Zero, Turbopuffer, or derived access grants.                      |
| Library filing                     | Initial rule: a folder entry must file a document into a folder from the same `library_id` as `document.library_id`. Cross-library filing is out of scope. |
| Nullable parent uniqueness         | Use partial unique indexes for root and non-root rows; PostgreSQL treats `NULL` values as distinct.                                                        |
| Soft-deleteable configuration rows | Use active-only unique indexes, typically `where deleted_at is null`, when deleted rows should not block name reuse.                                       |
| Historical immutable rows          | Do not soft-delete or mutate payload columns; append replacement rows and audit the action.                                                                |

## Containers And Filing

### `document_library`

A team-level container and permission/configuration boundary.

| Column                     | Type            | Notes                                                      |
| -------------------------- | --------------- | ---------------------------------------------------------- |
| `id`                       | `char(30)`      | `lib_` prefix.                                             |
| `team_id`                  | `char(30)`      | FK to `team.id`.                                           |
| `name`                     | `text`          | Display name, unique within the team for active libraries. |
| `description`              | `text null`     | Optional.                                                  |
| `default_document_type_id` | `char(30) null` | FK to `document_type.id`.                                  |
| common columns             |                 | Mutable and soft-deleteable.                               |

Constraints and indexes: partial unique `(team_id, name)` on active rows, `index(team_id, deleted_at)`, and same-team FK/check for the default document type.

### `document_folder`

A stable folder/cabinet node. Folders do not define document identity.

| Column             | Type            | Notes                                                |
| ------------------ | --------------- | ---------------------------------------------------- |
| `id`               | `char(30)`      | `fol_` prefix.                                       |
| `team_id`          | `char(30)`      | FK to `team.id`.                                     |
| `library_id`       | `char(30)`      | FK to `document_library.id`.                         |
| `parent_folder_id` | `char(30) null` | FK to `document_folder.id`. Null means library root. |
| `name`             | `text`          | Folder name.                                         |
| `position`         | `integer`       | Manual ordering.                                     |
| `path_cache`       | `text null`     | Denormalized display path, not identity.             |
| common columns     |                 | Mutable and soft-deleteable.                         |

Constraints and indexes: partial unique `(library_id, name)` for active root folders, partial unique `(library_id, parent_folder_id, name)` for active child folders, `index(team_id, library_id, parent_folder_id)`, and same-library checks for parent folders.

### `document_folder_closure`

Optional once folder trees matter at scale.

| Column                 | Type       | Notes                                |
| ---------------------- | ---------- | ------------------------------------ |
| `team_id`              | `char(30)` | FK to `team.id`.                     |
| `ancestor_folder_id`   | `char(30)` | FK to `document_folder.id`.          |
| `descendant_folder_id` | `char(30)` | FK to `document_folder.id`.          |
| `depth`                | `integer`  | `0` for self, `1` for direct parent. |

Constraint: primary key `(ancestor_folder_id, descendant_folder_id)` plus same-team and same-library checks.

### `document_folder_entry`

Files a document into a folder. A document can appear in multiple folders inside its own library.

| Column        | Type            | Notes                          |
| ------------- | --------------- | ------------------------------ |
| `id`          | `char(30)`      | `dfe_` prefix.                 |
| `team_id`     | `char(30)`      | FK to `team.id`.               |
| `folder_id`   | `char(30)`      | FK to `document_folder.id`.    |
| `document_id` | `char(30)`      | FK to `document.id`.           |
| `position`    | `integer`       | Manual ordering inside folder. |
| `created_at`  | `timestamp`     | Filing timestamp.              |
| `created_by`  | `char(30) null` | FK to `user.id`.               |

Constraints and indexes: unique `(folder_id, document_id)`, `index(team_id, document_id)`, same-team check, and same-library check between folder and document.

## Documents And Versions

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
| `language`                 | `text null`      | Primary language code.                                                  |
| `owner_user_id`            | `char(30) null`  | FK to `user.id`. Ownership is not the permission model.                 |
| `current_version_id`       | `char(30) null`  | FK to `document_version.id`. Null while stub or processing.             |
| `current_major_version_id` | `char(30) null`  | FK to `document_version.id`. Useful for published views.                |
| `is_stub`                  | `boolean`        | True until first usable version exists.                                 |
| `in_trash`                 | `boolean`        | Recoverable user deletion.                                              |
| `trashed_at`               | `timestamp null` | Trash timestamp.                                                        |
| `trashed_by`               | `char(30) null`  | FK to `user.id`.                                                        |
| common columns             |                  | Mutable; `deleted_at` means final logical deletion, not ordinary trash. |

Indexes and invariants: `index(team_id, library_id, in_trash)`, `index(team_id, document_type_id)`, `index(team_id, current_version_id)`, current-version pointers must target versions from the same document, and `in_trash` is the user-recoverable deletion state.

### `document_version`

Immutable version object. New check-ins create new rows. Existing finalized rows are never edited except derived flags if we choose not to compute them from `document.current_version_id`.

| Column                    | Type             | Notes                                      |
| ------------------------- | ---------------- | ------------------------------------------ |
| `id`                      | `char(30)`       | `dve_` prefix.                             |
| `team_id`                 | `char(30)`       | FK to `team.id`.                           |
| `document_id`             | `char(30)`       | FK to `document.id`.                       |
| `version_number`          | `integer`        | Monotonic per document.                    |
| `major_number`            | `integer`        | Major version.                             |
| `minor_number`            | `integer`        | Minor version.                             |
| `label`                   | `text`           | Display label such as `1.0`.               |
| `change_summary`          | `text null`      | User/system note.                          |
| `status`                  | `text`           | `draft`, `final`, `superseded`, `deleted`. |
| `created_from_version_id` | `char(30) null`  | Previous version if derived.               |
| `created_at`              | `timestamp`      | Version creation timestamp.                |
| `created_by`              | `char(30) null`  | FK to `user.id`.                           |
| `finalized_at`            | `timestamp null` | Set when immutable/final.                  |

Constraints and indexes: unique `(document_id, version_number)`, unique `(document_id, major_number, minor_number)`, `index(team_id, document_id, created_at)`, same-document check for `created_from_version_id`.

### `document_version_label`

Optional symbolic labels for a version, such as `CURRENT`, `APPROVED`, or imported labels.

| Column                | Type            | Notes                        |
| --------------------- | --------------- | ---------------------------- |
| `id`                  | `char(30)`      | `dvl_` prefix if added.      |
| `team_id`             | `char(30)`      | FK to `team.id`.             |
| `document_id`         | `char(30)`      | FK to `document.id`.         |
| `document_version_id` | `char(30)`      | FK to `document_version.id`. |
| `label`               | `text`          | Symbolic label.              |
| `created_at`          | `timestamp`     | Assignment time.             |
| `created_by`          | `char(30) null` | FK to `user.id`.             |

Constraint: `unique(document_id, label)` and same-document check between `document_id` and `document_version_id`.

## Files, Pages, OCR, And Renditions

### `blob_object`

Storage object metadata. R2 contains bytes; PostgreSQL contains references and integrity data.

| Column          | Type             | Notes                                  |
| --------------- | ---------------- | -------------------------------------- |
| `id`            | `char(30)`       | `blo_` prefix.                         |
| `team_id`       | `char(30)`       | FK to `team.id`.                       |
| `bucket`        | `text`           | R2 bucket.                             |
| `object_key`    | `text`           | Immutable object key.                  |
| `content_type`  | `text null`      | Stored MIME type.                      |
| `size_bytes`    | `bigint`         | Object size.                           |
| `sha256`        | `char(64)`       | Content digest.                        |
| `etag`          | `text null`      | Provider ETag.                         |
| `storage_class` | `text null`      | Provider class/tier.                   |
| `created_at`    | `timestamp`      | Object creation timestamp.             |
| `created_by`    | `char(30) null`  | FK to `user.id`.                       |
| `deleted_at`    | `timestamp null` | Set after physical delete is complete. |

Constraints and indexes: unique `(bucket, object_key)`, `index(team_id, sha256, size_bytes)`, and no updates to object identity after write.

Recommended object key shape:

```text
teams/{team_id}/documents/{document_id}/versions/{document_version_id}/files/{document_file_id}/original
teams/{team_id}/documents/{document_id}/versions/{document_version_id}/pages/{page_number}/{rendition_kind}
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

Indexes: `index(team_id, document_id, created_at)`, `index(team_id, sha256, size_bytes)`, partial unique `(team_id, ingest_source_id, source_ref)` where `source_ref is not null`, and `index(team_id, scan_status, created_at)`.

### `document_file_page`

Page extracted from a source file.

| Column             | Type           | Notes                            |
| ------------------ | -------------- | -------------------------------- |
| `id`               | `char(30)`     | `dfp_` prefix.                   |
| `team_id`          | `char(30)`     | FK to `team.id`.                 |
| `document_id`      | `char(30)`     | FK to `document.id`.             |
| `document_file_id` | `char(30)`     | FK to `document_file.id`.        |
| `page_number`      | `integer`      | 1-based source file page number. |
| `width_px`         | `integer null` | Optional page width.             |
| `height_px`        | `integer null` | Optional page height.            |
| `rotation`         | `integer`      | Degrees.                         |
| `created_at`       | `timestamp`    | Extraction timestamp.            |

Constraints and indexes: unique `(document_file_id, page_number)`, `index(team_id, document_id)`, and same-document checks.

### `document_version_page`

Maps a logical document version page to a source file page. This allows page reordering, combining files, and replacing pages without mutating source files.

| Column                  | Type        | Notes                                |
| ----------------------- | ----------- | ------------------------------------ |
| `id`                    | `char(30)`  | `dvp_` prefix.                       |
| `team_id`               | `char(30)`  | FK to `team.id`.                     |
| `document_id`           | `char(30)`  | FK to `document.id`.                 |
| `document_version_id`   | `char(30)`  | FK to `document_version.id`.         |
| `document_file_page_id` | `char(30)`  | FK to `document_file_page.id`.       |
| `page_number`           | `integer`   | 1-based page number in this version. |
| `created_at`            | `timestamp` | Composition timestamp.               |

Constraints and indexes: unique `(document_version_id, page_number)`, unique `(document_version_id, document_file_page_id)` unless the same source page can appear twice, and same-document checks.

### `document_page_text`

OCR or extracted text for a version page. Server/API-only by default.

| Column                     | Type            | Notes                                                      |
| -------------------------- | --------------- | ---------------------------------------------------------- |
| `id`                       | `char(30)`      | `dpt_` prefix if added.                                    |
| `team_id`                  | `char(30)`      | FK to `team.id`.                                           |
| `document_id`              | `char(30)`      | FK to `document.id`.                                       |
| `document_version_id`      | `char(30)`      | FK to `document_version.id`.                               |
| `document_version_page_id` | `char(30)`      | FK to `document_version_page.id`.                          |
| `text_kind`                | `text`          | `extracted`, `ocr`, `corrected`, `summary`.                |
| `engine`                   | `text null`     | OCR/extraction backend.                                    |
| `language`                 | `text`          | OCR language; use `und` when unknown.                      |
| `content`                  | `text null`     | Extracted text; required when `status = 'ready'`.          |
| `content_sha256`           | `char(64) null` | Detect unchanged reruns; required when content is present. |
| `confidence`               | `numeric null`  | Optional OCR confidence.                                   |
| `status`                   | `text`          | `pending`, `ready`, `failed`.                              |
| `error_json`               | `jsonb null`    | Structured extraction error.                               |
| `is_current`               | `boolean`       | Current text for this page/kind/language.                  |
| `created_at`               | `timestamp`     | Extraction timestamp.                                      |

Constraints: partial unique `(document_version_page_id, text_kind, language)` where `is_current = true`, index `(team_id, document_version_page_id, created_at)`, and OCR reruns append rows instead of overwriting previous text.

### `document_rendition`

Generated representations: PDF/A archive, thumbnail, page preview, image, or redacted copy.

| Column                     | Type            | Notes                                                |
| -------------------------- | --------------- | ---------------------------------------------------- |
| `id`                       | `char(30)`      | `ren_` prefix.                                       |
| `team_id`                  | `char(30)`      | FK to `team.id`.                                     |
| `document_id`              | `char(30)`      | FK to `document.id`.                                 |
| `document_version_id`      | `char(30)`      | FK to `document_version.id`.                         |
| `document_version_page_id` | `char(30) null` | Null for version-level rendition.                    |
| `kind`                     | `text`          | `pdfa`, `thumbnail`, `preview`, `image`, `redacted`. |
| `variant`                  | `text`          | Logical variant, usually `default`.                  |
| `blob_object_id`           | `char(30)`      | FK to `blob_object.id`.                              |
| `source_sha256`            | `char(64) null` | Hash of inputs used to generate the rendition.       |
| `status`                   | `text`          | `ready`, `stale`, `failed`.                          |
| `created_at`               | `timestamp`     | Generation timestamp.                                |

Constraints: separate partial unique indexes for version-level and page-level renditions, plus same-team and same-document checks.

## Document Types And Typed Metadata

### `document_type`

Team-scoped content type.

| Column                    | Type            | Notes                                        |
| ------------------------- | --------------- | -------------------------------------------- |
| `id`                      | `char(30)`      | `dty_` prefix.                               |
| `team_id`                 | `char(30)`      | FK to `team.id`.                             |
| `parent_document_type_id` | `char(30) null` | Optional parent type for simple inheritance. |
| `name`                    | `text`          | Display name.                                |
| `slug`                    | `text`          | Stable key within team.                      |
| `description`             | `text null`     | Optional.                                    |
| `color`                   | `text null`     | UI hint.                                     |
| `icon`                    | `text null`     | UI hint.                                     |
| common columns            |                 | Mutable and soft-deleteable.                 |

Constraints: active partial unique `(team_id, slug)`, same-team parent checks, and no cycles in the parent chain.

### `metadata_field`

Reusable team-scoped field definition.

| Column            | Type         | Notes                                                                                                                   |
| ----------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `id`              | `char(30)`   | `mfd_` prefix.                                                                                                          |
| `team_id`         | `char(30)`   | FK to `team.id`.                                                                                                        |
| `name`            | `text`       | Internal name.                                                                                                          |
| `label`           | `text`       | Display label.                                                                                                          |
| `data_type`       | `text`       | `text`, `long_text`, `number`, `boolean`, `date`, `datetime`, `select`, `multi_select`, `user`, `url`, `email`, `json`. |
| `sensitivity`     | `text`       | `normal`, `confidential`, `secret`.                                                                                     |
| `sync_policy`     | `text`       | `zero`, `api_only`, `never`.                                                                                            |
| `search_policy`   | `text`       | `searchable`, `filter_only`, `not_indexed`.                                                                             |
| `description`     | `text null`  | Optional.                                                                                                               |
| `validation_json` | `jsonb null` | Min/max, regex, date bounds, precision, etc.                                                                            |
| `lookup_json`     | `jsonb null` | Future controlled lookup/source config.                                                                                 |
| `extra_json`      | `jsonb null` | Type-specific settings that are not primary query paths.                                                                |
| common columns    |              | Mutable and soft-deleteable.                                                                                            |

Constraints: active partial unique `(team_id, name)`, valid `data_type`, valid policies, and option rows required for select types.

### `metadata_field_option`

Options for `select` and `multi_select` metadata fields.

| Column              | Type        | Notes                      |
| ------------------- | ----------- | -------------------------- |
| `id`                | `char(30)`  | `mfo_` prefix if added.    |
| `team_id`           | `char(30)`  | FK to `team.id`.           |
| `metadata_field_id` | `char(30)`  | FK to `metadata_field.id`. |
| `label`             | `text`      | Display label.             |
| `value`             | `text`      | Stored value.              |
| `position`          | `integer`   | Display order.             |
| `color`             | `text null` | UI hint.                   |
| `created_at`        | `timestamp` | Creation time.             |

Constraints: unique `(metadata_field_id, value)`, unique `(metadata_field_id, position)`, and same-team check.

### `document_type_metadata_field`

Assigns fields to document types.

| Column               | Type         | Notes                                                      |
| -------------------- | ------------ | ---------------------------------------------------------- |
| `id`                 | `char(30)`   | `dtf_` prefix if added.                                    |
| `team_id`            | `char(30)`   | FK to `team.id`.                                           |
| `document_type_id`   | `char(30)`   | FK to `document_type.id`.                                  |
| `metadata_field_id`  | `char(30)`   | FK to `metadata_field.id`.                                 |
| `required`           | `boolean`    | Required for this type.                                    |
| `repeatable`         | `boolean`    | Multiple values allowed.                                   |
| `position`           | `integer`    | Form/display order.                                        |
| `default_value_json` | `jsonb null` | Default value in typed JSON form.                          |
| `include_in_search`  | `boolean`    | Copy into future search index when field policy allows it. |
| `created_at`         | `timestamp`  | Assignment timestamp.                                      |

Constraint: `unique(document_type_id, metadata_field_id)`. Effective field sets include inherited parent assignments.

### `document_metadata_value`

Current mutable metadata values for a document.

| Column              | Type             | Notes                                                           |
| ------------------- | ---------------- | --------------------------------------------------------------- |
| `id`                | `char(30)`       | `dmv_` prefix.                                                  |
| `team_id`           | `char(30)`       | FK to `team.id`.                                                |
| `document_id`       | `char(30)`       | FK to `document.id`.                                            |
| `metadata_field_id` | `char(30)`       | FK to `metadata_field.id`.                                      |
| `position`          | `integer`        | `0` for single value; sequence for repeatable fields.           |
| `value_text`        | `text null`      | Text-like values.                                               |
| `value_number`      | `numeric null`   | Number values.                                                  |
| `value_boolean`     | `boolean null`   | Boolean values.                                                 |
| `value_date`        | `date null`      | Date values.                                                    |
| `value_timestamp`   | `timestamp null` | Datetime values.                                                |
| `value_user_id`     | `char(30) null`  | FK to `user.id` for user fields.                                |
| `value_json`        | `jsonb null`     | Multi-select or structured values.                              |
| common columns      |                  | Mutable and soft-deleteable if history is needed through audit. |

Constraints: unique `(document_id, metadata_field_id, position)` for active rows, one populated value column matching `metadata_field.data_type`, and field must be effective for the document's type unless ad-hoc fields are explicitly allowed.

### `document_version_metadata_value`

Immutable metadata snapshot for a version.

| Column                | Type        | Notes                                                  |
| --------------------- | ----------- | ------------------------------------------------------ |
| `id`                  | `char(30)`  | `vmv_` prefix.                                         |
| `team_id`             | `char(30)`  | FK to `team.id`.                                       |
| `document_id`         | `char(30)`  | FK to `document.id`.                                   |
| `document_version_id` | `char(30)`  | FK to `document_version.id`.                           |
| `metadata_field_id`   | `char(30)`  | FK to `metadata_field.id`.                             |
| `position`            | `integer`   | Snapshot position.                                     |
| value columns         |             | Same typed value columns as `document_metadata_value`. |
| `created_at`          | `timestamp` | Snapshot time.                                         |

Constraints: unique `(document_version_id, metadata_field_id, position)` and same-document checks.

## Tags

### `document_tag`

Team-scoped tags with optional hierarchy.

| Column          | Type            | Notes                                    |
| --------------- | --------------- | ---------------------------------------- |
| `id`            | `char(30)`      | `tag_` prefix.                           |
| `team_id`       | `char(30)`      | FK to `team.id`.                         |
| `parent_tag_id` | `char(30) null` | Optional parent tag.                     |
| `name`          | `text`          | Display name.                            |
| `slug`          | `text`          | Stable key within team or sibling scope. |
| `color`         | `text null`     | UI hint.                                 |
| `description`   | `text null`     | Optional.                                |
| common columns  |                 | Mutable and soft-deleteable.             |

Constraints: active sibling uniqueness for `name` and `slug`, same-team parent check, and no cycles.

### `document_tag_assignment`

| Column        | Type            | Notes                    |
| ------------- | --------------- | ------------------------ |
| `id`          | `char(30)`      | `dta_` prefix.           |
| `team_id`     | `char(30)`      | FK to `team.id`.         |
| `document_id` | `char(30)`      | FK to `document.id`.     |
| `tag_id`      | `char(30)`      | FK to `document_tag.id`. |
| `created_at`  | `timestamp`     | Assignment time.         |
| `created_by`  | `char(30) null` | FK to `user.id`.         |

Constraints: unique `(document_id, tag_id)`, `index(team_id, tag_id)`, and same-team checks.

## ACL And Permissions

Documents are team-scoped, but team membership alone is not enough for enterprise document access. Better Auth answers whether a user's organization role is allowed to attempt a class of action. The document ACL resolver answers whether that user can perform the action on a specific library, folder, or document.

Recommended Better Auth resources:

| Resource       | Actions                                                                                                                                           | Notes                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `document`     | `create`, `read_metadata`, `read_content`, `update_metadata`, `update_content`, `delete`, `restore`, `manage_versions`, `check_out`, `view_audit` | Coarse capability vocabulary for document operations.          |
| `document_acl` | `manage`                                                                                                                                          | Required before editing document ACL scopes or entries.        |
| `ac`           | Better Auth dynamic-access-control actions                                                                                                        | Keep Better Auth's built-in dynamic role administration model. |

Initial object-level permissions mirror the Better Auth vocabulary, but are granted on specific ACL scopes.

### `acl_scope`

Canonical inheritance scope for library, folder, and document. Use typed nullable FKs so the database can enforce referential integrity.

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

Constraints: exactly one of `library_id`, `folder_id`, or `document_id` is populated; unique scope per target object; same-team checks; parent scope must belong to the same team.

### `acl_entry`

Grant or deny a permission to a principal on an ACL scope.

| Column           | Type            | Notes                                                          |
| ---------------- | --------------- | -------------------------------------------------------------- |
| `id`             | `char(30)`      | `ace_` prefix.                                                 |
| `team_id`        | `char(30)`      | FK to `team.id`.                                               |
| `acl_scope_id`   | `char(30)`      | FK to `acl_scope.id`.                                          |
| `effect`         | `text`          | `allow` initially; `deny` can remain unsupported until needed. |
| `principal_type` | `text`          | `user`, `team`, `organization_role`.                           |
| `principal_id`   | `text`          | User ID, team ID, or Better Auth role key.                     |
| `resource`       | `text`          | Usually `document` or `document_acl`.                          |
| `action`         | `text`          | Permission action.                                             |
| `created_at`     | `timestamp`     | Grant timestamp.                                               |
| `created_by`     | `char(30) null` | FK to `user.id`.                                               |

Constraints: unique `(acl_scope_id, principal_type, principal_id, resource, action, effect)` and same-team principal checks where the principal is a row ID.

### `object_access_grant`

Derived effective user grant for fast Zero filtering across libraries, folders, and documents. Rebuilt when ACL scopes, ACL entries, Better Auth membership/roles, team membership, folder filing, or inheritance rules change.

| Column        | Type            | Notes                                    |
| ------------- | --------------- | ---------------------------------------- |
| `id`          | `char(30)`      | `oag_` prefix if added.                  |
| `team_id`     | `char(30)`      | FK to `team.id`.                         |
| `user_id`     | `char(30)`      | FK to `user.id`.                         |
| `library_id`  | `char(30) null` | Effective library target.                |
| `folder_id`   | `char(30) null` | Effective folder target.                 |
| `document_id` | `char(30) null` | Effective document target.               |
| `resource`    | `text`          | Permission resource.                     |
| `action`      | `text`          | Permission action.                       |
| `source_hash` | `char(64)`      | Hash of inputs used to derive the grant. |
| `created_at`  | `timestamp`     | Derivation timestamp.                    |

Initial implementations should derive only grants needed for visibility filters, such as `document.read_metadata` and `document.read_content`, unless another action demonstrably needs cached rows.

### `document_lock`

One active checkout-style lock per document unless a future collaborative editor needs shared locks.

| Column            | Type             | Notes                                   |
| ----------------- | ---------------- | --------------------------------------- |
| `id`              | `char(30)`       | `lok_` prefix if added.                 |
| `team_id`         | `char(30)`       | FK to `team.id`.                        |
| `document_id`     | `char(30)`       | FK to `document.id`.                    |
| `base_version_id` | `char(30) null`  | Version the user checked out or locked. |
| `user_id`         | `char(30)`       | FK to `user.id`.                        |
| `lock_type`       | `text`           | `checkout`, `read_only`.                |
| `status`          | `text`           | `active`, `released`, `expired`.        |
| `expires_at`      | `timestamp null` | Auto-expiry.                            |
| `created_at`      | `timestamp`      | Lock creation time.                     |
| `released_at`     | `timestamp null` | Release timestamp.                      |
| `released_by`     | `char(30) null`  | FK to `user.id`.                        |
| `comment`         | `text null`      | Optional reason.                        |

Recommended constraint: partial unique `(document_id)` where `lock_type = 'checkout' and status = 'active'`. `base_version_id`, when present, must belong to the locked document.

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

Observability for ingest, OCR, thumbnailing, PDF/A generation, search indexing, imports, and ACL recomputation.

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

Indexes: `index(team_id, status, priority, created_at)`, `index(team_id, document_id, created_at)`, and partial unique `(team_id, job_type, idempotency_key)` where `idempotency_key is not null`.

## Audit Trail

Audit is mandatory for the early model. It should not be treated as an activity feed that can be pruned without policy.

### `audit_event`

| Column          | Type            | Notes                                          |
| --------------- | --------------- | ---------------------------------------------- |
| `id`            | `char(30)`      | `aud_` prefix.                                 |
| `team_id`       | `char(30) null` | Null only for system-wide events.              |
| `actor_user_id` | `char(30) null` | FK to `user.id`; null for system.              |
| `actor_type`    | `text`          | `user`, `system`, `api_token`.                 |
| `action`        | `text`          | Stable action key.                             |
| `target_type`   | `text`          | `document`, `version`, `metadata`, `acl`, etc. |
| `target_id`     | `char(30) null` | Primary target.                                |
| `document_id`   | `char(30) null` | Denormalized when relevant.                    |
| `ip`            | `inet null`     | Request IP when available.                     |
| `user_agent`    | `text null`     | Request user agent when available.             |
| `request_id`    | `text null`     | Trace/request ID.                              |
| `created_at`    | `timestamp`     | Event timestamp.                               |
| `prev_hash`     | `char(64) null` | Optional tamper-evident chain.                 |
| `event_hash`    | `char(64) null` | Optional tamper-evident chain.                 |

### `audit_change`

Structured before/after data for auditable mutations.

| Column           | Type            | Notes                                  |
| ---------------- | --------------- | -------------------------------------- |
| `id`             | `char(30)`      | `auc_` prefix if added.                |
| `team_id`        | `char(30) null` | Matches event.                         |
| `audit_event_id` | `char(30)`      | FK to `audit_event.id`.                |
| `field_path`     | `text`          | Changed field path.                    |
| `old_value_json` | `jsonb null`    | Redacted or null for sensitive values. |
| `new_value_json` | `jsonb null`    | Redacted or null for sensitive values. |

Minimum audited actions:

| Area       | Actions                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Document   | create, update, trash, restore, delete_requested, delete_performed, view_metadata, view_content. |
| Files      | upload, page_extract, rendition_create, checksum_mismatch, blob_delete.                          |
| Versions   | version_create, version_promote, version_label, version_restore.                                 |
| Metadata   | field_create, field_update, metadata_set, metadata_clear, type_change.                           |
| ACL        | acl_scope_create, acl_entry_create, acl_entry_delete, permission_denied.                         |
| Processing | job_create, job_start, job_complete, job_fail.                                                   |

## Search With Turbopuffer

PostgreSQL remains the source of truth. Turbopuffer stores denormalized rows for query performance.

Recommended search units:

| Unit         | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| Document row | Search title, selected metadata, tags, and high-level summary. |
| Page row     | Search OCR/extracted text with page-level result highlighting. |
| Chunk row    | Vector search over long OCR text, summaries, or embeddings.    |

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

Constraints and indexes: unique `(namespace, turbopuffer_id)`, same-team/document checks for version and page IDs, `unit_type` consistent with nullable page/chunk columns, source-side partial uniqueness for logical rows such as one document row per document, one page row per version page, and one chunk row per `(document_version_page_id, chunk_number)`, plus `index(team_id, document_id, status)` for rebuilds.

Turbopuffer attributes to write:

| Attribute                  | Notes                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `team_id`                  | Mandatory filter.                                                                                    |
| `document_id`              | Stable Postgres identity.                                                                            |
| `document_version_id`      | Current or explicit version.                                                                         |
| `document_version_page_id` | Page result target.                                                                                  |
| `document_type_id`         | Type filter.                                                                                         |
| `tag_ids`                  | Tag filter if supported by chosen indexing shape.                                                    |
| `metadata_*`               | Selected typed metadata fields marked `include_in_search` whose field `search_policy` allows export. |
| `access_user_ids`          | Derived user IDs from document grants if Turbopuffer filtering supports the final shape.             |
| `access_sha256`            | Hash of derived access inputs used for staleness checks.                                             |
| `content`                  | Full-text searchable field.                                                                          |
| `vector`                   | Optional embedding.                                                                                  |

Search safety:

1. Do not index fields where `metadata_field.search_policy = 'not_indexed'`.
2. Do not index OCR/content for documents the file scanner marked unsafe.
3. Rebuild or mark stale when document metadata, tags, OCR text, current version, or derived access grants change.
4. Treat Turbopuffer as derived data; failed or missing search rows must not affect source-of-truth reads.

## Zero Sync Boundaries

Recommended Zero-synced tables:

| Table                          | Notes                                                |
| ------------------------------ | ---------------------------------------------------- |
| `document_library`             | Team library list.                                   |
| `document_folder`              | Folder tree.                                         |
| `document_folder_entry`        | Folder contents after access filtering.              |
| `document`                     | Metadata row only, filtered by object access.        |
| `document_version`             | Version list and labels, filtered by object access.  |
| `document_version_label`       | Version labels.                                      |
| `document_type`                | Forms and filters.                                   |
| `metadata_field`               | Forms and filters.                                   |
| `metadata_field_option`        | Select fields.                                       |
| `document_type_metadata_field` | Type field requirements.                             |
| `document_metadata_value`      | Current metadata whose field `sync_policy = 'zero'`. |
| `document_tag`                 | Tag tree.                                            |
| `document_tag_assignment`      | Tags on documents.                                   |

Server-only by default:

| Table                          | Reason                                                                    |
| ------------------------------ | ------------------------------------------------------------------------- |
| `blob_object`                  | Storage internals.                                                        |
| `document_file`                | Download and scan state should go through API.                            |
| `document_file_page`           | Usually API-only unless page UI needs it.                                 |
| `document_version_page`        | Usually API-only unless page UI needs it.                                 |
| `document_page_text`           | OCR can contain sensitive content.                                        |
| `document_rendition`           | Download URLs should be API-issued.                                       |
| `acl_scope` / `acl_entry`      | Permission internals.                                                     |
| `object_access_grant`          | Derived authorization internals.                                          |
| `audit_event` / `audit_change` | API-only, filtered and redacted.                                          |
| `processing_job`               | Server operations; expose filtered user-facing jobs separately if needed. |
| `search_index_item`            | Derived search state.                                                     |

Zero queries must start from Better Auth organization membership, apply team scope where relevant, and apply safe object access predicates or derived grants. Zero queries for `document_metadata_value` must respect `metadata_field.sync_policy`.

## Implementation Slices

### Slice 1: Upload And Basic Filing

Tables: `document_library`, `document_folder`, `document_folder_entry`, `document`, `document_version`, `blob_object`, `document_file`, `document_file_page`, `document_version_page`, `ingest_source`, `processing_job`, `audit_event`.

Capabilities: upload, ingest, page extraction, immutable versions, basic folders, and mandatory audit.

### Slice 2: OCR And Renditions

Tables: `document_page_text`, `document_rendition`.

Capabilities: OCR/extracted text, thumbnails, previews, and generated PDF/A or preview artifacts.

### Slice 3: Classification

Tables: `document_type`, `metadata_field`, `metadata_field_option`, `document_type_metadata_field`, `document_metadata_value`, `document_version_metadata_value`, `document_version_label`, `document_tag`, `document_tag_assignment`.

Capabilities: document types, typed metadata forms, tags, and version metadata snapshots.

### Slice 4: Object Access And Search

Tables/configuration: Better Auth dynamic access control if enabled, `acl_scope`, `acl_entry`, `object_access_grant`, `document_lock`, `audit_change`, `search_index_item`.

Capabilities: object-level ACL inheritance, derived access grants for Zero/API filtering, checkout locks, structured audit changes, and Turbopuffer search indexing.

## Deliberate Non-Choices

1. No migrations are generated by this draft.
2. No path-based document identity.
3. No database-stored file bytes.
4. No document-to-document links.
5. No retention policies, records, or holds.
6. No lifecycle workflow state machines or approval tasks.
7. No comments, annotations, signatures, or share links.
