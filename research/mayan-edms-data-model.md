# Mayan EDMS Data Model

> Source: [mayan-edms/Mayan-EDMS](https://github.com/mayan-edms/Mayan-EDMS)  
> Language: Python / Django  
> Database: PostgreSQL (recommended), MySQL, SQLite  
> Last analyzed: 2026-04-22

## Architecture Overview

Mayan EDMS is a Django application with a deep plugin architecture. Each app (`documents`, `cabinets`, `metadata`, `tags`, `checkouts`, `duplicates`, `ocr`, `document_signatures`, etc.) defines its own models. The system uses:

- **Django's permission framework** + **ACLs** (`mayan.apps.acls`) for granular access control
- **Django-actstream** for activity/event tracking
- **ExtraDataModelMixin** — a JSON `extra_data` field on many models for extensibility
- **Event decorators** (`@method_event`) for declarative audit logging
- **Backend pattern** — pluggable backends for sources, OCR, duplicate detection, etc.

---

## Core Document Entities

### Document (`documents_document`)

| Field               | Type                                 | Description                        |
| ------------------- | ------------------------------------ | ---------------------------------- |
| `id`                | PK (auto)                            |                                    |
| `uuid`              | UUIDField(auto)                      | Universally unique identifier      |
| `document_type_id`  | FK→DocumentType (cascade)            | Required document type             |
| `label`             | CharField(255, blank)                | Display name, defaults to filename |
| `description`       | TextField(blank)                     | Optional description               |
| `datetime_created`  | DateTimeField(auto_now_add)          | Creation timestamp, indexed        |
| `language`          | CharField(8, default='eng')          | Primary language code              |
| `in_trash`          | BooleanField(indexed, default=False) | Soft-delete flag                   |
| `trashed_date_time` | DateTimeField(nullable)              | When moved to trash                |
| `is_stub`           | BooleanField(indexed, default=True)  | Stub = no file uploaded yet        |
| `extra_data`        | JSONField (from mixin)               | Extension data                     |

Managers: `objects` (all), `trash` (in_trash=True), `valid` (in_trash=False, is_stub=False).

**Key relationships**: Document → DocumentType (FK), Document ← DocumentFiles (reverse), Document ← DocumentVersions (reverse), Document ← Tags (M2M via Tag), Document ← Cabinets (M2M via Cabinet), Document ← DocumentMetadata (reverse), Document ← Comment (reverse), Document ← DocumentCheckout (reverse one-to-one), Document ← SmartLink (via conditions).

### DocumentType (`documents_documenttype`)

| Field                                  | Type                                  | Description                      |
| -------------------------------------- | ------------------------------------- | -------------------------------- |
| `id`                                   | PK                                    |                                  |
| `label`                                | CharField(196, unique)                | Type name                        |
| `trash_time_period`                    | PositiveIntegerField(nullable)        | Auto-trash delay value           |
| `trash_time_unit`                      | CharField(8, nullable)                | Time unit (days/weeks/etc.)      |
| `delete_time_period`                   | PositiveIntegerField(nullable)        | Auto-delete from trash delay     |
| `delete_time_unit`                     | CharField(8, default)                 | Time unit                        |
| `filename_generator_backend`           | CharField(224)                        | Storage filename generator class |
| `filename_generator_backend_arguments` | TextField(validators=[YAMLValidator]) | YAML config for generator        |
| `extra_data`                           | JSONField                             | Extension data                   |

Sub-model: **DocumentTypeFilename** — quick-renames per type.

### DocumentFile (`documents_documentfile`)

| Field         | Type                                    | Description               |
| ------------- | --------------------------------------- | ------------------------- |
| `id`          | PK                                      |                           |
| `document_id` | FK→Document (cascade)                   | Parent document           |
| `timestamp`   | DateTimeField(auto_now_add)             | Upload timestamp, indexed |
| `comment`     | TextField(blank)                        | File description          |
| `file`        | FileField                               | Binary file storage       |
| `filename`    | CharField(255, blank)                   | Original filename         |
| `mimetype`    | CharField(255, nullable)                | Detected MIME type        |
| `encoding`    | CharField(64, nullable)                 | File encoding             |
| `checksum`    | CharField(64, nullable, indexed)        | SHA-256 hash              |
| `size`        | PositiveIntegerField(nullable, indexed) | File size in bytes        |
| `extra_data`  | JSONField                               | Extension data            |

**Versioning model**: Multiple `DocumentFile`s can be uploaded to a single Document. Each file upload creates a new DocumentFile record (append-only). Files are never modified in-place.

### DocumentFilePage (`documents_documentfilepage`)

| Field              | Type                          | Description         |
| ------------------ | ----------------------------- | ------------------- |
| `id`               | PK                            |                     |
| `document_file_id` | FK→DocumentFile (cascade)     | Parent file         |
| `page_number`      | PositiveIntegerField(indexed) | 1-based page number |

Each file page gets its own row. The actual image generation is lazy — cached on demand.

### DocumentVersion (`documents_documentversion`)

| Field         | Type                        | Description                          |
| ------------- | --------------------------- | ------------------------------------ |
| `id`          | PK                          |                                      |
| `document_id` | FK→Document (cascade)       | Parent document                      |
| `timestamp`   | DateTimeField(auto_now_add) | Version creation time                |
| `comment`     | TextField(blank)            | Version description                  |
| `active`      | BooleanField(default=True)  | Only one version is active at a time |
| `extra_data`  | JSONField                   | Extension data                       |

**Critical concept**: A DocumentVersion is a _mapping_ of pages from one or more DocumentFiles. It represents the "view" of the document at a point in time. When a new file is uploaded, the active version is remapped.

### DocumentVersionPage (`documents_documentversionpage`)

| Field                 | Type                          | Description                            |
| --------------------- | ----------------------------- | -------------------------------------- |
| `id`                  | PK                            |                                        |
| `document_version_id` | FK→DocumentVersion (cascade)  | Parent version                         |
| `page_number`         | PositiveIntegerField(indexed) | 1-based page sequence                  |
| `content_type_id`     | FK→ContentType                | Polymorphic reference (GenericFK)      |
| `object_id`           | PositiveIntegerField          | PK of the referenced page object       |
| `content_object`      | GenericForeignKey             | Actual page (usually DocumentFilePage) |

**Unique together**: `(document_version, page_number)`.

This is a **polymorphic association**: a version page can point to any content object (typically `DocumentFilePage`), enabling composition of versions from different files' pages.

### TrashedDocument (`documents_trasheddocument`)

| Field               | Type                  | Description               |
| ------------------- | --------------------- | ------------------------- |
| `id`                | PK                    |                           |
| `document_id`       | FK→Document (cascade) | The soft-deleted document |
| `trashed_date_time` | DateTimeField         | When it was trashed       |
| `user_id`           | FK→User (cascade)     | Who trashed it            |
| `extra_data`        | JSONField             | Extension data            |

Proxy model `TrashedDocument` filters `Document.objects.filter(in_trash=True)`.

### RecentlyAccessedDocument / RecentlyCreatedDocument

Proxy models tracking access/creation timestamps for quick filtering.

---

## Metadata

### MetadataType (`metadata_metadatatype`)

| Field                  | Type                                  | Description                                         |
| ---------------------- | ------------------------------------- | --------------------------------------------------- |
| `id`                   | PK                                    |                                                     |
| `name`                 | CharField(48, unique)                 | Internal name (no spaces, no Python reserved words) |
| `label`                | CharField(48)                         | Display label                                       |
| `default`              | CharField(128, nullable)              | Default value (Django template)                     |
| `lookup`               | TextField(nullable)                   | Lookup query (Django template, comma-delimited)     |
| `validation`           | CharField(224, blank)                 | Validator class dotted path                         |
| `validation_arguments` | TextField(validators=[YAMLValidator]) | YAML validator config                               |
| `parser`               | CharField(224, blank)                 | Parser class dotted path                            |
| `parser_arguments`     | TextField(validators=[YAMLValidator]) | YAML parser config                                  |
| `extra_data`           | JSONField                             | Extension data                                      |

### DocumentMetadata (`metadata_documentmetadata`)

| Field              | Type                              | Description         |
| ------------------ | --------------------------------- | ------------------- |
| `id`               | PK                                |                     |
| `document_id`      | FK→Document (cascade)             |                     |
| `metadata_type_id` | FK→MetadataType (cascade)         |                     |
| `value`            | CharField(255, nullable, indexed) | Actual stored value |

**Unique together**: `(document, metadata_type)`.

### DocumentTypeMetadataType (`metadata_documenttypemetadatatype`)

| Field              | Type                      | Description                       |
| ------------------ | ------------------------- | --------------------------------- |
| `id`               | PK                        |                                   |
| `document_type_id` | FK→DocumentType (cascade) |                                   |
| `metadata_type_id` | FK→MetadataType (cascade) |                                   |
| `required`         | BooleanField              | Whether this metadata is required |

**Unique together**: `(document_type, metadata_type)`.

---

## Categorization

### Tag (`tags_tag`)

| Field        | Type                   | Description             |
| ------------ | ---------------------- | ----------------------- |
| `id`         | PK                     |                         |
| `label`      | CharField(128, unique) | Tag name                |
| `color`      | CharField(7)           | RGB hex color           |
| `documents`  | M2M→Document           | Documents with this tag |
| `extra_data` | JSONField              | Extension data          |

**No hierarchy** — Tags in Mayan are flat, unlike Paperless-ngx.

### Cabinet (`cabinets_cabinet`)

Uses `django-mptt` for tree structure.

| Field       | Type                           | Description               |
| ----------- | ------------------------------ | ------------------------- |
| `id`        | PK                             |                           |
| `parent_id` | TreeForeignKey(self, nullable) | Parent cabinet            |
| `label`     | CharField(128)                 | Cabinet name              |
| `documents` | M2M→Document                   | Documents in this cabinet |

**Unique together**: `(parent, label)`.

Cabinets are hierarchical folder-like containers. ACLs propagate from root cabinet.

---

## Document Lifecycle

### Checkout (`checkouts_documentcheckout`)

| Field                 | Type                            | Description                            |
| --------------------- | ------------------------------- | -------------------------------------- |
| `id`                  | PK                              |                                        |
| `document_id`         | FK→Document (OneToOne, cascade) | Checked-out document                   |
| `checkout_datetime`   | DateTimeField(auto_now_add)     | When checked out                       |
| `expiration_datetime` | DateTimeField                   | Auto-expiry time                       |
| `user_id`             | FK→User (cascade)               | Who checked it out                     |
| `block_new_file`      | BooleanField(default=True)      | Prevent file uploads while checked out |
| `extra_data`          | JSONField                       | Extension data                         |

**OneToOne**: Only one active checkout per document. Validated expiration must be in the future.

### Document Comment (`document_comments_comment`)

| Field         | Type                           | Description    |
| ------------- | ------------------------------ | -------------- |
| `id`          | PK                             |                |
| `document_id` | FK→Document (cascade, indexed) |                |
| `user_id`     | FK→User (cascade)              | Comment author |
| `comment`     | TextField                      | Comment text   |
| `datetime`    | DateTimeField(auto_now_add)    |                |
| `extra_data`  | JSONField                      | Extension data |

---

## Signatures

### SignatureBaseModel (`document_signatures_signaturebasemodel`)

| Field                    | Type                      | Description                |
| ------------------------ | ------------------------- | -------------------------- |
| `id`                     | PK                        |                            |
| `document_file_id`       | FK→DocumentFile (cascade) | Signed file                |
| `date_time`              | DateTimeField(nullable)   | When signature was created |
| `key_id`                 | CharField(40)             | GPG key ID                 |
| `signature_id`           | CharField(64, nullable)   | Unique signature ID        |
| `public_key_fingerprint` | CharField(40, nullable)   | Fingerprint of signing key |

### DetachedSignature (extends SignatureBaseModel)

Adds: `signature_file` (FileField, stored separately).

### EmbeddedSignature (extends SignatureBaseModel)

No additional fields — signature is embedded in the document file itself.

---

## OCR

### DocumentVersionPageOCRContent (`ocr_documentversionpageocrcontent`)

| Field                      | Type                                       | Description    |
| -------------------------- | ------------------------------------------ | -------------- |
| `id`                       | PK                                         |                |
| `document_version_page_id` | FK→DocumentVersionPage (OneToOne, cascade) |                |
| `content`                  | TextField(blank)                           | Extracted text |

### DocumentTypeOCRSettings (`ocr_documenttypeocrsettings`)

| Field              | Type                                | Description                 |
| ------------------ | ----------------------------------- | --------------------------- |
| `id`               | PK                                  |                             |
| `document_type_id` | FK→DocumentType (OneToOne, cascade) |                             |
| `auto_ocr`         | BooleanField(default=True)          | Auto-queue new docs for OCR |

---

## File Metadata

### StoredDriver (`file_metadata_storeddriver`)

| Field           | Type                            | Description                        |
| --------------- | ------------------------------- | ---------------------------------- |
| `id`            | PK                              |                                    |
| `driver_path`   | CharField(255, unique)          | Python dotted path to driver class |
| `internal_name` | CharField(128, unique, indexed) | Driver identifier                  |

### DocumentFileDriverEntry (`file_metadata_documentfiledriverentry`)

| Field              | Type                      | Description |
| ------------------ | ------------------------- | ----------- |
| `id`               | PK                        |             |
| `driver_id`        | FK→StoredDriver (cascade) |             |
| `document_file_id` | FK→DocumentFile (cascade) |             |

**Unique together**: `(driver, document_file)`.

### FileMetadataEntry (`file_metadata_filemetadataentry`)

| Field                           | Type                                 | Description                         |
| ------------------------------- | ------------------------------------ | ----------------------------------- |
| `id`                            | PK                                   |                                     |
| `document_file_driver_entry_id` | FK→DocumentFileDriverEntry (cascade) |                                     |
| `key`                           | CharField(255, indexed)              | Metadata key (e.g., "EXIF:FNumber") |
| `value`                         | CharField(255, indexed)              | Metadata value                      |

---

## Sources

### Source (`sources_source`)

| Field        | Type                   | Description         |
| ------------ | ---------------------- | ------------------- |
| `id`         | PK                     |                     |
| `label`      | CharField(128, unique) | Human-readable name |
| `enabled`    | BooleanField           | Whether active      |
| `extra_data` | JSONField              | Extension data      |

Uses BackendModelMixin — actual source behavior (watch folder, IMAP, etc.) is configured via backend classes stored as Python dotted paths.

---

## Duplicate Detection

### StoredDuplicateBackend (`duplicates_storedduplicatebackend`)

| Field          | Type                     | Description          |
| -------------- | ------------------------ | -------------------- |
| `id`           | PK                       |                      |
| `backend_path` | (from BackendModelMixin) | Algorithm identifier |

### DuplicateBackendEntry (`duplicates_duplicatebackendentry`)

| Field               | Type                                | Description         |
| ------------------- | ----------------------------------- | ------------------- |
| `id`                | PK                                  |                     |
| `stored_backend_id` | FK→StoredDuplicateBackend (cascade) | Algorithm           |
| `document_id`       | FK→Document (cascade)               | Source document     |
| `documents`         | M2M→Document                        | Matching duplicates |

**Unique together**: `(stored_backend, document)`.

---

## Smart Links

### SmartLink (`linking_smartlink`)

| Field            | Type                    | Description           |
| ---------------- | ----------------------- | --------------------- |
| `id`             | PK                      |                       |
| `label`          | CharField(128, indexed) | Link name             |
| `dynamic_label`  | CharField(96, blank)    | Django template label |
| `enabled`        | BooleanField            |                       |
| `document_types` | M2M→DocumentType        | Applicable types      |
| `extra_data`     | JSONField               |                       |

### SmartLinkCondition (`linking_smartlinkcondition`)

| Field                   | Type                   | Description                |
| ----------------------- | ---------------------- | -------------------------- |
| `id`                    | PK                     |                            |
| `smart_link_id`         | FK→SmartLink (cascade) |                            |
| `inclusion`             | CharField(16)          | AND/OR                     |
| `foreign_document_data` | CharField(128)         | Target document attribute  |
| `operator`              | CharField(16)          | Comparison operator        |
| `expression`            | TextField              | Django template expression |
| `negated`               | BooleanField           | Invert logic               |
| `enabled`               | BooleanField           |                            |
| `extra_data`            | JSONField              |                            |

---

## Event / Audit System

Mayan uses **two layers** for audit:

### Layer 1: Django-actstream (Action model)

Uses `django-actstream` which provides an `Action` model:

| Field                        | Type                           | Description                                  |
| ---------------------------- | ------------------------------ | -------------------------------------------- |
| `id`                         | PK                             |                                              |
| `actor_content_type`         | FK→ContentType                 | Who performed the action                     |
| `actor_object_id`            | PositiveIntegerField           | PK of the actor                              |
| `verb`                       | CharField                      | Action identifier (e.g., "document_created") |
| `action_object_content_type` | FK→ContentType(nullable)       | Direct object                                |
| `action_object_object_id`    | PositiveIntegerField(nullable) |                                              |
| `target_content_type`        | FK→ContentType(nullable)       | Indirect target                              |
| `target_object_id`           | PositiveIntegerField(nullable) |                                              |
| `timestamp`                  | DateTimeField(auto_now_add)    | When it happened                             |
| `description`                | TextField(blank)               | Human-readable description                   |
| `public`                     | BooleanField(default=True)     | Visibility                                   |

### Layer 2: Mayan Event System (StoredEventType + Notification)

**StoredEventType** — mirrors Python event classes as DB rows:

| Field  | Type                  | Description            |
| ------ | --------------------- | ---------------------- |
| `id`   | PK                    |                        |
| `name` | CharField(64, unique) | Event class identifier |

**EventSubscription** — per-user global event subscriptions:

| Field                  | Type                         | Description |
| ---------------------- | ---------------------------- | ----------- |
| `id`                   | PK                           |             |
| `user_id`              | FK→User (cascade, indexed)   |             |
| `stored_event_type_id` | FK→StoredEventType (cascade) |             |

**Notification** — links a user to an action:

| Field       | Type                       | Description |
| ----------- | -------------------------- | ----------- |
| `id`        | PK                         |             |
| `user_id`   | FK→User (cascade, indexed) |             |
| `action_id` | FK→Action (cascade)        |             |
| `read`      | BooleanField               | Read status |

**ObjectEventSubscription** — per-object event subscriptions (GenericFK):

| Field                  | Type                         | Description        |
| ---------------------- | ---------------------------- | ------------------ |
| `id`                   | PK                           |                    |
| `content_type_id`      | FK→ContentType               | Target object type |
| `object_id`            | PositiveIntegerField         | Target object PK   |
| `content_object`       | GenericForeignKey            |                    |
| `user_id`              | FK→User (cascade, indexed)   |                    |
| `stored_event_type_id` | FK→StoredEventType (cascade) |                    |

**Decorator-driven**: Models use `@method_event` decorators to declaratively wire events:

```python
@method_event(
    event_manager_class=EventManagerSave,
    created={
        'event': event_document_created,
        'action_object': 'document_type',
        'target': 'self'
    },
    edited={
        'event': event_document_edited,
        'target': 'self'
    }
)
def save(self, *args, **kwargs):
    ...
```

This ensures every creation/edit/deletion of a Document, DocumentType, Tag, Cabinet, Metadata, Checkout, etc. is automatically recorded as an event.

---

## Extra Data Pattern

Nearly all models inherit from `ExtraDataModelMixin`, which adds:

| Field        | Type                | Description              |
| ------------ | ------------------- | ------------------------ |
| `extra_data` | JSONField(nullable) | Arbitrary extension data |

This allows plugins and integrations to attach arbitrary data without schema migrations.

---

## Relationships Diagram

```
DocumentType ──── Document ─┬─── DocumentFile ─── DocumentFilePage
    │                        ├─── DocumentVersion ─── DocumentVersionPage (GenericFK→DocumentFilePage)
    │                        ├─── Tags (M2M)
    │                        ├─── Cabinets (M2M, via MPTT tree)
    │                        ├─── DocumentMetadata ─── MetadataType
    │                        ├─── Comments (FK)
    │                        ├─── Checkout (OneToOne, when active)
    │                        ├─── SmartLinks (via conditions)
    │                        ├─── DuplicateBackendEntry (M2M)
    │                        └─── DocumentTypeMetadataType (required flag)

Source (backend pattern) → creates Document + DocumentFile
StoredDuplicateBackend → DuplicateBackendEntry → Document (M2M duplicates)

Action (actstream) ←── StoredEventType
Notification ←── User + Action
EventSubscription ←── User + StoredEventType
ObjectEventSubscription ←── User + StoredEventType + GenericFK
```

---

## Upsides

1. **Deep versioning model**: The Document → DocumentFile → DocumentFilePage → DocumentVersion → DocumentVersionPage chain is extremely flexible. Files can be appended, and versions can remap pages from different files via GenericFK. This allows representing "this version uses pages 1-3 from file A and page 4 from file B."

2. **Polymorphic version pages**: `DocumentVersionPage.content_object` (GenericFK) allows version pages to point to any model, not just `DocumentFilePage`. Future-proofs for new page sources.

3. **Comprehensive event/audit system**: The dual-layer approach (actstream + Mayan events) provides both machine-readable event tracking and user-facing notifications. The `@method_event` decorator pattern is declarative and can't be accidentally bypassed.

4. **Checkout/lock system**: First-class `DocumentCheckout` model with expiration datetime and block-new-file flag. Critical for collaborative workflows where someone needs exclusive edit access.

5. **Cabinets with MPTT**: Hierarchical folder structure with proper tree operations. ACLs inherit from root cabinet. Documents can be in multiple cabinets simultaneously.

6. **Metadata as first-class objects**: `MetadataType` with validation, lookup, and parser support is more powerful than simple key-value. The type system enforces consistency across documents of the same type.

7. **Backend pattern for extensibility**: Sources, duplicate detection, and other subsystems use `BackendModelMixin` to register Python classes as database-backed configuration. New backends can be added without schema changes.

8. **Extra data mixin**: Every major model has `extra_data` (JSONField), allowing plugins to extend entities without migrations.

9. **File metadata extraction**: Dedicated `FileMetadataEntry` model with driver-based extraction (EXIF, etc.) allows structured querying of embedded file metadata.

10. **Document signatures**: PGP/GPG signature verification built-in with both detached and embedded signature models.

## Downsides

1. **Steep complexity**: The Document → DocumentFile → DocumentVersion → DocumentVersionPage chain is powerful but extremely complex. Understanding the 4-level indirection for "what page am I looking at?" requires deep knowledge of the system.

2. **No content storage in the model**: OCR text isn't stored directly on the model — it's in `DocumentVersionPageOCRContent` linked to version pages. This means the text depends on the version and page mapping being correct.

3. **Extra data is a JSON colander**: While flexible, `extra_data` is unqueryable in a structured way. It's effectively a NoSQL sidecar on a relational model.

4. **GenericForeignKey overhead**: `DocumentVersionPage.content_object` uses Django's GenericFK, which means no database-level referential integrity and requires N+1 queries or manual prefetching.

5. **Event system complexity**: Two separate systems (actstream Action + Mayan StoredEventType/Notification) can create confusion. The `@method_event` decorator ties business logic to model methods, making it harder to test in isolation.

6. **No document-level content search field**: Unlike Paperless-ngx which has a `content` TextField on Document, Mayan stores OCR text per-page in `DocumentVersionPageOCRContent`. Full-document search requires joining through versions and pages.

7. **Metadata values are CharField(255)**: The `DocumentMetadata.value` field is limited to 255 characters. No support for long text, numeric ranges, or date-specific metadata types at the model level.

8. **Flat tags only**: Unlike Paperless-ngx's hierarchical tags, Mayan tags are flat. The Cabinet model provides hierarchy, but it serves a different purpose (container-like vs. label-like).

9. **No custom fields/types like Paperless**: Metadata types are closely tied to document types and require admin configuration. There's no equivalent of Paperless's ad-hoc custom fields on individual documents.

10. **Heavy reliance on Django internals**: The permission system, GenericFKs, MPTT, actstream, and the event decorator pattern make it very difficult to use Mayan's data layer outside of a Django context.
