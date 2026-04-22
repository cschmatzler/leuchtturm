# Nuxeo Data Model

> Source: [nuxeo/nuxeo](https://github.com/nuxeo/nuxeo)  
> Language: Java (OSGi / JCR-inspired)  
> Database: RDBMS (PostgreSQL, MySQL, Oracle, MarkLogic) + VCS (Versioned Content Store)  
> Last analyzed: 2026-04-22

## Architecture Overview

Nuxeo uses a **Content Repository** architecture inspired by JCR (JSR-283/JSR-333) but with its own persistence layer called **VCS** (Versioned Content Store). The data model is defined in **XSD schemas** assembled into **Document Types** via XML extensions. The actual storage is in a set of generic relational tables.

Key concepts:

- **Schema**: A named set of fields (like a database table schema), defined in XSD
- **Document Type**: Composed of multiple schemas, inherits from parent types
- **Facet**: A mixin that adds schemas and behavior (like Alfresco aspects)
- **Document**: A runtime instance of a Document Type with all its schema fields

---

## Core Storage Tables

Nuxeo's VCS stores all document data in a small number of generic tables.

### `nuxeo_repository` — The main document table (called `documents` by default)

| Column            | Type          | Description                                                 |
| ----------------- | ------------- | ----------------------------------------------------------- |
| `id`              | VARCHAR(36)   | UUID primary key                                            |
| `type`            | VARCHAR(100)  | Document type name (e.g., "File", "Note", "Workspace")      |
| `parentid`        | VARCHAR(36)   | Parent document UUID (for hierarchy)                        |
| `path`            | VARCHAR(1000) | Materialized path (e.g., "/default-domain/workspaces/doc1") |
| `name`            | VARCHAR(255)  | Local name within parent                                    |
| `pos`             | BIGINT        | Position among siblings (for ordering)                      |
| `iscolumn`        | BOOLEAN       | Whether this is a column element (path element)             |
| `isretired`       | BOOLEAN       | Whether the document is in the trash                        |
| `lifecyclepolicy` | VARCHAR(64)   | Lifecycle policy name (e.g., "default")                     |
| `lifecyclestate`  | VARCHAR(64)   | Current lifecycle state (e.g., "project", "approved")       |
| `versionableid`   | VARCHAR(36)   | UUID of the version series (live document)                  |
| `isrecord`        | BOOLEAN       | Whether this is an archived record (records management)     |
| `retainuntil`     | TIMESTAMP     | Record retention until date                                 |
| `basesize`        | BIGINT        | Base content size for lazy caching                          |
| `mixin_types`     | VARCHAR[]     | List of applied facets/mixins                               |

### `nuxeo_hier` — Hierarchy table

| Column     | Type         | Description   |
| ---------- | ------------ | ------------- |
| `id`       | VARCHAR(36)  | UUID          |
| `parentid` | VARCHAR(36)  | Parent UUID   |
| `name`     | VARCHAR(255) | Local name    |
| `pos`      | BIGINT       | Sort position |

Separate from the main document table for efficient tree operations.

### `nuxeo_version` — Version Storage

| Column          | Type         | Description                                    |
| --------------- | ------------ | ---------------------------------------------- |
| `id`            | VARCHAR(36)  | UUID of the version document                   |
| `versionableid` | VARCHAR(36)  | UUID of the live document this is a version of |
| `label`         | VARCHAR(64)  | Version label (e.g., "1.0", "1.1")             |
| `description`   | VARCHAR(512) | Version description                            |
| `created`       | TIMESTAMP    | Version creation time                          |
| `islatest`      | BOOLEAN      | Whether this is the latest version             |
| `islastmajor`   | BOOLEAN      | Whether this is the latest major version       |

---

## Schema Definitions (XSD)

### Common Schema (`common`)

| Field             | Type     | Description                  |
| ----------------- | -------- | ---------------------------- |
| `dc:title`        | String   | Document title               |
| `dc:description`  | String   | Document description         |
| `dc:subjects`     | String[] | Subject keywords             |
| `dc:rights`       | String   | Access rights                |
| `dc:source`       | String   | Original source              |
| `dc:coverage`     | String   | Spatial/temporal coverage    |
| `dc:created`      | Date     | Creation date (Dublin Core)  |
| `dc:modified`     | Date     | Last modified date           |
| `dc:issued`       | Date     | Issue date                   |
| `dc:valid`        | Date     | Validity start               |
| `dc:expired`      | Date     | Expiration date              |
| `dc:creator`      | String   | Dublin Core creator          |
| `dc:contributors` | String[] | Dublin Core contributors     |
| `dc:language`     | String   | Document language            |
| `dc:format`       | String   | MIME type                    |
| `dc:type`         | String   | Document type classification |

### File Schema (`file`)

| Field           | Type   | Description                                           |
| --------------- | ------ | ----------------------------------------------------- |
| `file:content`  | Blob   | Binary content (with name, MIME type, length, digest) |
| `file:filename` | String | Original filename                                     |

The `file:content` Blob is a complex type containing:

- `name`: Filename
- `mime-type`: MIME type
- `encoding`: Character encoding
- `length`: File size in bytes
- `digest`: Hash (usually MD5)
- `data`: Reference to binary storage

### Note Schema (`note`)

| Field            | Type   | Description                   |
| ---------------- | ------ | ----------------------------- |
| `note:note`      | String | Note content (typically HTML) |
| `note:mime_type` | String | Note MIME type                |

### Files Schema (`files`)

| Field         | Type      | Description                                                       |
| ------------- | --------- | ----------------------------------------------------------------- |
| `files:files` | Complex[] | List of attached files (each with file:content and file:filename) |

### Picture Schema (`picture`)

| Field           | Type                                   | Description                                           |
| --------------- | -------------------------------------- | ----------------------------------------------------- |
| `picture:file`  | Blob                                   | Original image                                        |
| `picture:info`  | Complex (width, height, depth, format) | Image metadata                                        |
| `picture:views` | Complex[]                              | Thumbnail views (each with title, file:content, info) |

### Video Schema (`video`) — similar to Picture with transcoding views

### Audio Schema (`audio`) — similar to Picture with duration, bitrate, etc.

###

DublinCore Schema (`dublincore`)

Maps to the Dublin Core metadata standard (see Common Schema above). This is a required schema on all documents.

### UID Schema (`uid`)

| Field               | Type    | Description                        |
| ------------------- | ------- | ---------------------------------- |
| `uid:uid`           | String  | Unique identifier (auto-generated) |
| `uid:minor_version` | Integer | Minor version number               |
| `uid:major_version` | Integer | Major version number               |

### Relation Schema (`relation`)

| Field                | Type      | Description                                              |
| -------------------- | --------- | -------------------------------------------------------- |
| `relation:statement` | Complex[] | List of relation statements (subject, predicate, object) |

---

## Document Types

### Built-in Types Hierarchy

```
Document (abstract base)
  ├── Folder
  │     ├── Workspace
  │     ├── OrderedFolder
  │     ├── HiddenFolder
  │     └── SectionRoot / Section
  ├── File (file:content blob)
  ├── Note (note:note text)
  ├── Picture (picture:*)
  ├── Video (video:*)
  ├── Audio (audio:*)
  └── Comment (comment:*)
```

### `File` Type (most common document type)

Schemas: `common`, `file`, `uid`, `dublincore`, `files`

This is the standard "uploaded document" type — it has binary content in `file:content`, Dublin Core metadata, a UID, and optional attached files.

### `Workspace` Type

Schemas: `common`, `uid`, `dublincore`

A container for documents and sub-folders. The primary organizational unit in Nuxeo.

---

## Facets (Mixins)

Facets add schemas and behavior to any document type at runtime.

| Facet                    | Added Schemas          | Description                            |
| ------------------------ | ---------------------- | -------------------------------------- |
| `Versionable`            | —                      | Enables versioning on a document       |
| `Commentable`            | `comment`              | Adds comment capability                |
| `Publishable`            | `publication`          | Enables publication workflow           |
| `Folderish`              | —                      | Can contain child documents            |
| `Orderable`              | —                      | Supports manual ordering of children   |
| `HiddenInNavigation`     | —                      | Excluded from tree navigation          |
| `SystemDocument`         | —                      | Internal system document               |
| `Thumbnail`              | `thumbnail`            | Has a thumbnail image                  |
| `Downloadable`           | `download`             | Can be downloaded with permissions     |
| `HasUnrestrictedContent` | `unrestricted_content` | Content visible to specific users only |
| `MasterPublishSpace`     | —                      | Publication root                       |
| `ConcurrentCopySafe`     | —                      | Safe for concurrent copies             |

---

## ACL / Security Model

### `nuxeo_acl` — Access Control Lists

Nuxeo stores ACLs directly on documents:

| Column       | Type        | Description                                            |
| ------------ | ----------- | ------------------------------------------------------ |
| `id`         | VARCHAR(36) | ACL entry UUID                                         |
| `docid`      | VARCHAR(36) | FK → document UUID                                     |
| `user`       | VARCHAR(64) | Username, group name, or special ("Everyone")          |
| `group`      | VARCHAR(64) | Whether this is a group entry                          |
| `permission` | VARCHAR(64) | Permission name (Read, Write, Everything, etc.)        |
| `grant`      | BOOLEAN     | Whether permission is granted (true) or denied (false) |
| `pos`        | INTEGER     | Ordering (deny before grant)                           |

Permissions are hierarchical: `Everything` > `Write` > `Read`. Security checks walk up the hierarchy and merge ACLs.

---

## Audit Log

### `nuxeo_audit_log` (NXAuditEventsService)

| Column           | Type          | Description                                              |
| ---------------- | ------------- | -------------------------------------------------------- |
| `id`             | BIGINT        | Auto PK                                                  |
| `event_id`       | VARCHAR(64)   | Event category (documentCreated, documentModified, etc.) |
| `event_date`     | TIMESTAMP     | When it happened                                         |
| `doc_uuid`       | VARCHAR(36)   | Document UUID                                            |
| `doc_path`       | VARCHAR(1024) | Document path                                            |
| `doc_type`       | VARCHAR(64)   | Document type                                            |
| `doc_life_cycle` | VARCHAR(64)   | Lifecycle state                                          |
| `principal`      | VARCHAR(128)  | Username                                                 |
| `category`       | VARCHAR(64)   | Event category                                           |
| `comment`        | VARCHAR(512)  | Free text                                                |
| `repository`     | VARCHAR(64)   | Repository name                                          |

Extended log (separate table):

| Column     | Type         | Description             |
| ---------- | ------------ | ----------------------- |
| `log_id`   | BIGINT       | FK → audit_log.id       |
| `property` | VARCHAR(256) | Extended property name  |
| `value`    | VARCHAR(512) | Extended property value |

---

## Full-Text Index

Nuxeo uses Elasticsearch (or the legacy VCS full-text) for search. Full-text is not stored in the model directly — documents are indexed asynchronously.

For Elasticsearch mode, each document is synced as a JSON document with all schema fields, ACLs, and path information.

---

## Lifecycle Model

### `nuxeo_lifecycle` (in-memory, configured via XML)

Lifecycle policies define state machines:

**Default lifecycle** ("default"):

```
project → approval → approved
                       └── obsolete (from approved)
approval → project (reject)
project → deleted (delete)
```

States: `project`, `approved`, `obsolete`, `deleted`, `approved`, `approved`

Lifecycle is stored on the document row in `lifecyclepolicy` and `lifecyclestate` columns. Transitions are triggered by API calls, not by state columns.

---

## Workflow Model

Nuxeo integrates with **JBPM** (historically) and now **Nuxeo Studio workflow engine**. Workflow data is stored in:

### `nuxeo_workflow` — Workflow Instances

| Column          | Type         | Description              |
| --------------- | ------------ | ------------------------ |
| `id`            | VARCHAR(36)  | UUID                     |
| `definition_id` | VARCHAR(64)  | Workflow definition name |
| `doc_id`        | VARCHAR(36)  | Attached document        |
| `initiator`     | VARCHAR(128) | User who started         |
| `state`         | VARCHAR(64)  | Current state            |
| `start_date`    | TIMESTAMP    |                          |
| `end_date`      | TIMESTAMP    |                          |

### `nuxeo_task` — Workflow Tasks

| Column        | Type         | Description            |
| ------------- | ------------ | ---------------------- |
| `id`          | VARCHAR(36)  | UUID                   |
| `workflow_id` | VARCHAR(36)  | FK → workflow instance |
| `doc_id`      | VARCHAR(36)  | Target document        |
| `actor`       | VARCHAR(128) | Assigned user          |
| `status`      | VARCHAR(64)  | Task status            |
| `due_date`    | TIMESTAMP    |                        |

---

## Relationships Diagram

```
Document Table (nuxeo_repository)
  │
  ├── id (UUID) — primary key
  ├── type → Document Type (File, Folder, Workspace, Note, etc.)
  ├── parentid → Document (parent) — tree hierarchy
  ├── versionableid → Document (live version) — version series
  ├── lifecyclepolicy / lifecyclestate — state machine
  ├── mixin_types[] — applied facets
  │
  ├── Schema data stored in:
  │     ├── nuxeo_repository (inline columns for common fields)
  │     └── Separate tables for complex types (blobs, arrays)
  │
  ├── nuxeo_hier → parent-child tree
  ├── nuxeo_acl → per-document ACLs
  ├── nuxeo_version → version history
  ├── nuxeo_audit_log → audit trail
  ├── nuxeo_workflow → workflow instances
  └── nuxeo_task → workflow tasks
```

---

## Upsides

1. **Mature document type system**: Schemas + Document Types + Facets provide a powerful composition model. Types inherit from parent types, and facets add behavior freely.

2. **Full lifecycle management**: Lifecycle policies with state machines are first-class. Transitions, guards, and state-dependent permissions are all built in.

3. **Versioning is deep and structured**: The `nuxeo_version` table explicitly tracks version series, labels, major/minor version numbers, and latest/latest-major flags. Clear and queryable.

4. **ACL-based security at the document level**: The `nuxeo_acl` table is simple and effective. Grant/deny with ordering, hierarchical permission resolution, and per-document overrides.

5. **Dublin Core built-in**: Full Dublin Core metadata as a required schema on all documents. Interoperable with library and archival systems.

6. **Multi-blob support**: The `files:files` schema allows multiple attachments per document, and `picture:views` supports multiple renditions. No single-blob limitation.

7. **Record management**: `isrecord` and `retainuntil` fields in the main document table show first-class Records Management support — rare in open source DMS.

8. **Path-based + UUID dual addressing**: Every document has both a materialized path (`path` column) and a stable UUID (`id`). This allows both tree navigation and direct reference.

9. **Comprehensive audit log**: The `nuxeo_audit_log` table with extended properties captures document events, lifecycle transitions, and workflow actions with user context.

10. **Elasticsearch integration**: Full-text and structural search is delegated to Elasticsearch, which indexes all schema fields, ACLs, and path information. The relational store is optimized for writes and consistency.

## Downsides

1. **Complex Java stack**: The entire platform requires OSGi, JBoss/Jetty, and a Java runtime. Operational complexity is very high compared to Docker-deployable Python or Go solutions.

2. **VCS generic tables mean poor direct query performance**: Documents with many custom schemas result in wide rows in `nuxeo_repository` or additional join tables. Complex queries across multiple schemas require either Elasticsearch or careful indexing.

3. **No direct SQL access to schema fields**: Custom schema fields are stored either as columns in the main document table (if simple) or in separate joined tables (if complex). There's no guarantee which approach is used for a given field.

4. **Configuration-heavy**: Document types, schemas, facets, lifecycles, and workflows are all defined in XML and deployed through the Nuxeo Studio or XML hot-reload. Changes require redeployment of configurations.

5. **M2M relations via separate `relation` schema**: The `relation:statement` model (subject-predicate-object) is flexible but makes querying relationships harder than simple FK or M2M tables.

6. **ACL table can grow very large**: One row per (document, user/group, permission). For large deployments with thousands of users and millions of documents, this table can become a bottleneck.

7. **No page-level model**: Files are opaque binaries. There's no page extraction, no page-level OCR storage, and no page-level versioning within a document.

8. **Version storage doubles data**: When a document is checked in as a version, Nuxeo copies all data (including binaries) to a new version row. For large files, this can be storage-intensive.

9. **Workflow tables are relatively sparse**: The `nuxeo_workflow` and `nuxeo_task` tables store minimal data. Detailed workflow state and variables are handled by the workflow engine (JBPM or Nuxeo Studio), not in queryable database columns.

10. **Community vs. Enterprise feature gap**: Many advanced features (Records Management with retention rules, advanced workflow, Studio configuration, Elasticsearch setup) require the Enterprise Edition. The Community Edition is significantly less capable.
