# Paperless-ngx Data Model

> Source: [paperless-ngx/paperless-ngx](https://github.com/paperless-ngx/paperless-ngx)  
> Language: Python / Django  
> Database: PostgreSQL / SQLite  
> Last analyzed: 2026-04-22

## Architecture Overview

Paperless-ngx uses Django ORM models. The data model lives primarily in `src/documents/models.py` with supporting models in `src/paperless/models.py` and `src/paperless_mail/models.py`. It uses `django-softdelete` for soft deletion and `django-auditlog` for audit logging.

---

## Core Entities

### Document (`documents_document`)

The central entity. Extends `SoftDeleteModel` + `ModelWithOwner`.

| Field                   | Type                                            | Description                                |
| ----------------------- | ----------------------------------------------- | ------------------------------------------ |
| `id`                    | PK (auto)                                       | Primary key                                |
| `title`                 | CharField(128)                                  | Document title, indexed                    |
| `content`               | TextField                                       | Raw extracted text content (for search)    |
| `content_length`        | GeneratedField(int)                             | Auto-computed length of `content`          |
| `mime_type`             | CharField(256)                                  | MIME type, non-editable                    |
| `checksum`              | CharField(64)                                   | SHA-256 checksum of original file          |
| `archive_checksum`      | CharField(64, nullable)                         | Checksum of archived (PDF/A) version       |
| `page_count`            | PositiveIntegerField(nullable)                  | Number of pages                            |
| `created`               | DateField                                       | Date document was created (user-facing)    |
| `modified`              | DateTimeField(auto)                             | Last modification timestamp, indexed       |
| `added`                 | DateTimeField(auto)                             | When document was ingested, indexed        |
| `filename`              | FilePathField(1024, unique, nullable)           | Current storage filename                   |
| `archive_filename`      | FilePathField(1024, unique, nullable)           | Archived version filename                  |
| `original_filename`     | CharField(1024, nullable)                       | Original upload filename                   |
| `archive_serial_number` | PositiveIntegerField(unique, nullable, indexed) | Position in physical archive               |
| `root_document_id`      | FK→self(nullable)                               | Points to the root document for versioning |
| `version_index`         | PositiveIntegerField(nullable, indexed)         | Version number within root document        |
| `version_label`         | CharField(64, nullable)                         | Optional label for version                 |
| `owner_id`              | FK→User(nullable)                               | Document owner                             |
| `correspondent_id`      | FK→Correspondent(nullable)                      | FK to correspondent                        |
| `document_type_id`      | FK→DocumentType(nullable)                       | FK to document type                        |
| `storage_path_id`       | FK→StoragePath(nullable)                        | FK to storage path                         |

**Constraints**: `UniqueConstraint(root_document, version_index)` when both are non-null.

**Soft delete**: Uses `SoftDeleteModel` — no actual row deletion, a `deleted_at` field is set.

**Versioning**: When `root_document` is null → this is a root document. When set → this is a version. Root documents have a `versions` reverse relation.

### Correspondent (`documents_correspondent`)

Extends `MatchingModel` (name + matching algorithm + owner + unique constraint on name per owner).

| Field                | Type              | Description                                               |
| -------------------- | ----------------- | --------------------------------------------------------- |
| `id`                 | PK                |                                                           |
| `name`               | CharField(128)    | Correspondent name                                        |
| `match`              | CharField(256)    | Match string                                              |
| `matching_algorithm` | PositiveSmallInt  | 0=None, 1=Any, 2=All, 3=Literal, 4=Regex, 5=Fuzzy, 6=Auto |
| `is_insensitive`     | Boolean           | Case-insensitive matching                                 |
| `owner_id`           | FK→User(nullable) |                                                           |

### Tag (`documents_tag`)

Extends `MatchingModel` + `TreeNodeModel` (hierarchical tags via MPTT-like tree).

| Field                | Type              | Description                  |
| -------------------- | ----------------- | ---------------------------- |
| `id`                 | PK                |                              |
| `name`               | CharField(128)    | Tag name                     |
| `color`              | CharField(7)      | Hex color, default `#a6cee3` |
| `is_inbox_tag`       | Boolean           | Auto-tag new docs with this  |
| `match`              | CharField(256)    | Match string                 |
| `matching_algorithm` | PositiveSmallInt  | Same as Correspondent        |
| `is_insensitive`     | Boolean           | Case-insensitive             |
| `owner_id`           | FK→User(nullable) |                              |

**Max nesting depth**: 5 levels. Self-parenting and descendant loops prevented via `clean()`.

M2M with Document via `documents_document_tags`.

### DocumentType (`documents_documenttype`)

Extends `MatchingModel`. Simple name + matching config, same pattern as Correspondent.

### StoragePath (`documents_storagepath`)

Extends `MatchingModel` with an additional `path` TextField for configuring physical storage layout.

### Note (`documents_note`)

| Field         | Type                  | Description        |
| ------------- | --------------------- | ------------------ |
| `id`          | PK                    |                    |
| `note`        | TextField             | Note content       |
| `created`     | DateTimeField(auto)   | Timestamp, indexed |
| `document_id` | FK→Document(nullable) | Parent document    |
| `user_id`     | FK→User(nullable)     | Note author        |

Uses `SoftDeleteModel`.

### CustomField (`documents_customfield`)

| Field        | Type                | Description                                                                                  |
| ------------ | ------------------- | -------------------------------------------------------------------------------------------- |
| `id`         | PK                  |                                                                                              |
| `name`       | CharField(128)      | Field name (unique)                                                                          |
| `data_type`  | CharField(50)       | One of: string, url, date, boolean, integer, float, monetary, documentlink, select, longtext |
| `extra_data` | JSONField(nullable) | E.g. select options                                                                          |
| `created`    | DateTimeField(auto) |                                                                                              |

### CustomFieldInstance (`documents_customfieldinstance`)

| Field                | Type                     | Description                                |
| -------------------- | ------------------------ | ------------------------------------------ |
| `id`                 | PK                       |                                            |
| `field_id`           | FK→CustomField           | Which custom field definition              |
| `document_id`        | FK→Document              | Which document                             |
| `created`            | DateTimeField(auto)      |                                            |
| `value_text`         | CharField(256, nullable) | Stored value for string type               |
| `value_url`          | URLField(200, nullable)  | Stored value for url type                  |
| `value_date`         | DateField(nullable)      | Stored value for date type                 |
| `value_bool`         | BooleanField(nullable)   | Stored value for boolean type              |
| `value_int`          | IntegerField(nullable)   | Stored value for integer type              |
| `value_float`        | FloatField(nullable)     | Stored value for float type                |
| `value_monetary`     | DecimalField(nullable)   | Stored value for monetary type             |
| `value_document_ids` | JSONField(nullable)      | List of document IDs for documentlink type |
| `value_select`       | CharField(128, nullable) | Stored value for select type               |

Uses `SoftDeleteModel`. **Sparse column pattern**: only one `value_*` column is non-null depending on `field.data_type`.

---

## Workflow Engine

### Workflow (`documents_workflow`)

| Field     | Type                   | Description     |
| --------- | ---------------------- | --------------- |
| `id`      | PK                     |                 |
| `name`    | CharField(256, unique) | Workflow name   |
| `order`   | SmallIntegerField      | Execution order |
| `enabled` | Boolean                | Active flag     |

M2M → `WorkflowTrigger`, `WorkflowAction`.

### WorkflowTrigger (`documents_workflowtrigger`)

| Field                              | Type                     | Description                                                      |
| ---------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `id`                               | PK                       |                                                                  |
| `type`                             | PositiveSmallInt         | 1=Consumption, 2=Document Added, 3=Document Updated, 4=Scheduled |
| `sources`                          | MultiSelectField         | Consume folder, API upload, mail fetch, web UI                   |
| `filter_path`                      | CharField(256, nullable) | Path wildcard filter                                             |
| `filter_filename`                  | CharField(256, nullable) | Filename wildcard filter                                         |
| `filter_mailrule_id`               | FK→MailRule(nullable)    | Filter by mail rule                                              |
| `match`                            | CharField(256)           | Matching string                                                  |
| `matching_algorithm`               | PositiveSmallInt         | None/Any/All/Literal/Regex/Fuzzy                                 |
| `is_insensitive`                   | Boolean                  | Case-insensitive matching                                        |
| `schedule_offset_days`             | SmallIntegerField        | Days offset for scheduled triggers                               |
| `schedule_is_recurring`            | Boolean                  | Recurring schedule                                               |
| `schedule_recurring_interval_days` | PositiveSmallInt         | Recurrence interval                                              |
| `schedule_date_field`              | CharField(20)            | Which date field to check (added/created/modified/custom_field)  |
| `schedule_date_custom_field_id`    | FK→CustomField(nullable) | Custom field for date trigger                                    |

M2M: `filter_has_tags`, `filter_has_all_tags`, `filter_has_not_tags`, `filter_has_any_document_types`, `filter_has_not_document_types`, `filter_has_correspondent`, `filter_has_not_correspondents`, `filter_has_any_correspondents`, `filter_has_storage_path`, `filter_has_any_storage_paths`, `filter_has_not_storage_paths`.

### WorkflowAction (`documents_workflowaction`)

| Field                       | Type                               | Description                                                                      |
| --------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `id`                        | PK                                 |                                                                                  |
| `type`                      | PositiveSmallInt                   | 1=Assignment, 2=Removal, 3=Email, 4=Webhook, 5=Password Removal, 6=Move to Trash |
| `order`                     | PositiveSmallInt                   | Execution order within workflow                                                  |
| `assign_title`              | TextField(nullable)                | Jinja2 template for title                                                        |
| `assign_owner_id`           | FK→User(nullable)                  | Assign owner                                                                     |
| `assign_document_type_id`   | FK→DocumentType(nullable)          |                                                                                  |
| `assign_correspondent_id`   | FK→Correspondent(nullable)         |                                                                                  |
| `assign_storage_path_id`    | FK→StoragePath(nullable)           |                                                                                  |
| `email_id`                  | FK→WorkflowActionEmail(nullable)   | Email action config                                                              |
| `webhook_id`                | FK→WorkflowActionWebhook(nullable) | Webhook action config                                                            |
| `passwords`                 | JSONField(nullable)                | Passwords for PDF removal                                                        |
| `remove_all_tags`           | Boolean                            |                                                                                  |
| `remove_all_document_types` | Boolean                            |                                                                                  |
| `remove_all_correspondents` | Boolean                            |                                                                                  |
| `remove_all_storage_paths`  | Boolean                            |                                                                                  |
| `remove_all_owners`         | Boolean                            |                                                                                  |
| `remove_all_permissions`    | Boolean                            |                                                                                  |
| `remove_all_custom_fields`  | Boolean                            |                                                                                  |

M2M relationships for assignments and removals over Tags, DocumentTypes, Correspondents, StoragePaths, Users, Groups, CustomFields.

### WorkflowActionEmail

| Field              | Type           | Description                     |
| ------------------ | -------------- | ------------------------------- |
| `id`               | PK             |                                 |
| `subject`          | CharField(256) | Email subject with placeholders |
| `body`             | TextField      | Email body with placeholders    |
| `to`               | TextField      | Comma-separated email addresses |
| `include_document` | Boolean        | Attach document to email        |

### WorkflowActionWebhook

| Field              | Type                | Description                    |
| ------------------ | ------------------- | ------------------------------ |
| `id`               | PK                  |                                |
| `url`              | CharField(256)      | Destination URL                |
| `use_params`       | Boolean             | Use param mode (default true)  |
| `as_json`          | Boolean             | Send as JSON                   |
| `params`           | JSONField(nullable) | URL parameters                 |
| `body`             | TextField(nullable) | Request body                   |
| `headers`          | JSONField(nullable) | HTTP headers                   |
| `include_document` | Boolean             | Include doc in webhook payload |

### WorkflowRun (`documents_workflowrun`)

| Field         | Type                       | Description     |
| ------------- | -------------------------- | --------------- |
| `id`          | PK                         |                 |
| `workflow_id` | FK→Workflow                | Which workflow  |
| `type`        | PositiveSmallInt(nullable) | Trigger type    |
| `document_id` | FK→Document(nullable)      | Target document |
| `run_at`      | DateTimeField(auto)        | When it ran     |

Uses `SoftDeleteModel`.

---

## Task Tracking

### PaperlessTask (`documents_papelrestask`)

Full task tracking for background workers (Celery):

| Field               | Type                    | Description                                                                                                                                                                       |
| ------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | PK                      |                                                                                                                                                                                   |
| `task_id`           | CharField(72, unique)   | Celery task ID                                                                                                                                                                    |
| `task_type`         | CharField(50)           | consume_file, train_classifier, sanity_check, index_optimize, mail_fetch, llm_index, empty_trash, check_workflows, bulk_update, reprocess_document, build_share_link, bulk_delete |
| `trigger_source`    | CharField(50)           | scheduled, web_ui, api_upload, folder_consume, email_consume, system, manual                                                                                                      |
| `status`            | CharField(30)           | pending, started, success, failure, revoked                                                                                                                                       |
| `date_created`      | DateTimeField           | Task creation time                                                                                                                                                                |
| `date_started`      | DateTimeField(nullable) | When worker picked up                                                                                                                                                             |
| `date_done`         | DateTimeField(nullable) | Completion time                                                                                                                                                                   |
| `duration_seconds`  | FloatField(nullable)    | Elapsed time                                                                                                                                                                      |
| `wait_time_seconds` | FloatField(nullable)    | Queue wait time                                                                                                                                                                   |
| `input_data`        | JSONField               | Structured input parameters                                                                                                                                                       |
| `result_data`       | JSONField(nullable)     | Structured result data                                                                                                                                                            |
| `acknowledged`      | Boolean                 | User acknowledgement flag                                                                                                                                                         |
| `owner_id`          | FK→User(nullable)       |                                                                                                                                                                                   |

---

## Share Links & Bundles

### ShareLink (`documents_sharelink`)

| Field          | Type                    | Description         |
| -------------- | ----------------------- | ------------------- |
| `id`           | PK                      |                     |
| `created`      | DateTimeField(auto)     |                     |
| `expiration`   | DateTimeField(nullable) | Expiration time     |
| `slug`         | SlugField(unique)       | Public URL slug     |
| `document_id`  | FK→Document             | Target document     |
| `file_version` | CharField(50)           | archive or original |
| `owner_id`     | FK→User(nullable)       |                     |

### ShareLinkBundle (`documents_sharelinkbundle`)

| Field          | Type                           | Description                        |
| -------------- | ------------------------------ | ---------------------------------- |
| `id`           | PK                             |                                    |
| `created`      | DateTimeField(auto)            |                                    |
| `expiration`   | DateTimeField(nullable)        |                                    |
| `slug`         | SlugField(unique)              |                                    |
| `owner_id`     | FK→User(nullable)              |                                    |
| `file_version` | CharField(50)                  | archive or original                |
| `status`       | CharField(50)                  | pending, processing, ready, failed |
| `size_bytes`   | PositiveIntegerField(nullable) |                                    |
| `last_error`   | JSONField(nullable)            |                                    |
| `file_path`    | CharField(512)                 | Path to generated zip              |
| `built_at`     | DateTimeField(nullable)        |                                    |
| `documents`    | M2M→Document                   |                                    |

---

## Saved Views

### SavedView (`documents_savedview`)

| Field            | Type                           | Description                   |
| ---------------- | ------------------------------ | ----------------------------- |
| `id`             | PK                             |                               |
| `name`           | CharField(128)                 | View name                     |
| `sort_field`     | CharField(128, nullable)       | Sort field                    |
| `sort_reverse`   | Boolean                        | Reverse sort                  |
| `page_size`      | PositiveIntegerField(nullable) |                               |
| `display_mode`   | CharField(128, nullable)       | table, smallCards, largeCards |
| `display_fields` | JSONField(nullable)            | Column config                 |
| `owner_id`       | FK→User(nullable)              |                               |

### SavedViewFilterRule (`documents_savedviewfilterrule`)

| Field           | Type                     | Description                                                                                                                    |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`            | PK                       |                                                                                                                                |
| `saved_view_id` | FK→SavedView(cascade)    | Parent view                                                                                                                    |
| `rule_type`     | PositiveSmallInt         | 50 rule types: title/content/ASN/correspondent/document type/tags/date ranges/storage path/custom fields/owner/shared/mimetype |
| `value`         | CharField(255, nullable) | Rule value                                                                                                                     |

---

## Audit Trail

Paperless-ngx uses `django-auditlog` for change tracking. When `AUDIT_LOG_ENABLED=True`, the following models are registered:

```
Document (with m2m_fields={"tags"}, exclude_fields=["content_length", "modified"])
Correspondent
Tag
DocumentType
Note
CustomField
CustomFieldInstance
```

Each audit log entry (`auditlog_logentry`) records:

- `object_pk` — PK of changed object
- `object_repr` — String representation
- `object_json` — Full object state snapshot
- `action` — CREATE (0), UPDATE (1), DELETE (2), ACCESS (3)
- `changes` — JSON diff of changed fields `{field: [old, new]}`
- `actor` — FK to User
- `remote_addr` — IP address
- `timestamp` — When it happened
- `additional_data` — JSON for extra context

---

## Application Configuration

### ApplicationConfiguration (`paperless_applicationconfiguration`)

Singleton model that stores all system-wide settings:

- OCR settings: output_type, pages, language, mode, archive_file_generation, image_dpi, unpaper_clean, deskew, rotate_pages, rotate_pages_threshold, max_image_pixels, color_conversion_strategy, user_args
- Application branding: app_title, app_logo
- Barcode settings: barcodes_enabled, barcode_enable_tiff_support, barcode_string, barcode_enable_asn, barcode_asn_prefix, barcode_upscale, barcode_dpi, barcode_max_pages, barcode_enable_tag, barcode_tag_mapping, barcode_tag_split
- AI settings: ai_enabled, llm_embedding_backend, llm_embedding_model, llm_backend, llm_model, llm_api_key, llm_endpoint

---

## Relationships Diagram

```
Document ─┬─── Correspondent (FK, nullable)
           ├─── DocumentType (FK, nullable)
           ├─── StoragePath (FK, nullable)
           ├─── Owner → User (FK, nullable)
           ├─── Tags (M2M)
           ├─── Notes (FK reverse)
           ├─── CustomFieldInstances (FK reverse)
           ├─── ShareLinks (FK reverse)
           ├─── ShareLinkBundles (M2M)
           ├─── WorkflowRuns (FK reverse)
           └─── root_document → Document (self-FK for versioning)

CustomField ←─── CustomFieldInstance → Document

Workflow ──── M2M ──── WorkflowTrigger
    └─── M2M ──── WorkflowAction ──── WorkflowActionEmail
                                    └─── WorkflowActionWebhook

SavedView ──── SavedViewFilterRule (FK, cascade)

PaperlessTask (standalone, owner FK → User)
```

---

## Upsides

1. **Clean, normalized schema**: Django ORM models are well-structured with proper constraints, indexes, and foreign keys. The data model is easy to understand and follows Django conventions.

2. **Soft delete**: Both `Document` and `Note` use `SoftDeleteModel`, so data is recoverable. No accidental permanent deletions.

3. **Flexible custom fields**: The `CustomField` + `CustomFieldInstance` pattern with typed value columns (`value_text`, `value_int`, etc.) is a good EAV-like approach that keeps queries fast while supporting many data types. It avoids the pitfalls of a single JSON column for filtering.

4. **First-class versioning**: The `root_document` / `version_index` pattern for document versions is explicit and queryable. Each version is its own `Document` row with a self-referencing FK.

5. **Powerful workflow engine**: Triggers + Actions with Jinja2 templating, M2M filter conditions, and multiple action types (assignment, removal, email, webhook, password removal, trash). Scheduled triggers with recurrence support.

6. **Comprehensive audit logging via django-auditlog**: Tracks field-level changes with before/after values. Low-configuration — just register models.

7. **Tag hierarchy**: Tags support nesting up to 5 levels via `TreeNodeModel`, with validation in `clean()`.

8. **Task visibility**: `PaperlessTask` provides full observability of background processing, including wait times, durations, and structured input/result data.

9. **Share links with expiration**: Both single-document and multi-document bundle sharing with slug-based URLs and expiration.

10. **Sparse match/assignment model**: `MatchingModel` abstract class is reused across Correspondent, Tag, DocumentType, StoragePath, and WorkflowTrigger — consistent pattern for auto-classification.

## Downsides

1. **No multi-tenancy**: No organization/workspace concept. All documents live in a single global namespace. Owner-based access is the only partitioning mechanism.

2. **Audit log is optional and third-party**: `django-auditlog` must be explicitly enabled. It records object-level changes but doesn't track document content diffs (only field-level). No built-in audit UI — you rely on the django-admin or custom queries.

3. **Denormalized value columns in CustomFieldInstance**: While performant for reads, this pattern means schema migrations when adding new types, and many nullable columns per row. Adding a new data type requires a code change and migration.

4. **No document locking / checkout**: No concept of reserving a document for editing. Concurrent editing conflicts are not addressed at the data model level.

5. **No content versioning**: `content` (OCR text) is stored directly on the `Document` model, not versioned separately. If OCR is re-run, previous extractions are lost.

6. **Flat correspondent/type model**: Correspondents and DocumentTypes are just names with matching rules — no hierarchy, no metadata schema per type.

7. **Inbox tag is a boolean on Tag**: No generalized "smart inbox" mechanism — only tags can serve as inboxfilters.

8. **Workflow runs are soft-deleteable but not historic in detail**: `WorkflowRun` records that a workflow ran on a document, but doesn't store which specific actions were applied or their results.

9. **Task table can grow unbounded**: `PaperlessTask` entries have no automatic cleanup/tTL mechanism at the model level.

10. **No native document relationship model**: No FK or M2M for related documents (e.g., "this invoice relates to that contract"). The `documentlink` custom field type exists, but it's stored as JSON, not as a proper relational link with referential integrity.
