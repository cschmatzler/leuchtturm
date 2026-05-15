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

Nuxeo's VCS maps high-level document properties to SQL fragments. The core table names are defined in `Model.java`; schema fields may be stored in generated per-schema/per-complex-type tables rather than a single `nuxeo_repository` table.

### `hierarchy` — The core document tree table

| Column       | Type         | Description                                     |
| ------------ | ------------ | ----------------------------------------------- |
| `id`         | VARCHAR(36)  | UUID                                            |
| `parentid`   | VARCHAR(36)  | Parent UUID                                     |
| `name`       | VARCHAR(255) | Local name                                      |
| `pos`        | BIGINT       | Sort position                                   |
| `isproperty` | BOOLEAN      | Whether row represents a complex-property child |

The document type, mixins, record flags, version flags, trash flags, and change tokens are mapped as main-fragment properties on `hierarchy`, such as `primarytype`, `mixintypes`, `isrecord`, `retainuntil`, `baseversionid`, `ischeckedin`, `majorversion`, `minorversion`, `isversion`, `istrashed`, `isdeleted`, and `deletedtime`.

### `misc` — Lifecycle and misc document state

| Column            | Type        | Description             |
| ----------------- | ----------- | ----------------------- |
| `id`              | VARCHAR(36) | Document UUID           |
| `lifecyclepolicy` | VARCHAR(64) | Lifecycle policy name   |
| `lifecyclestate`  | VARCHAR(64) | Current lifecycle state |

### `versions` — Version Storage

| Column          | Type         | Description                                    |
| --------------- | ------------ | ---------------------------------------------- |
| `id`            | VARCHAR(36)  | UUID of the version document                   |
| `versionableid` | VARCHAR(36)  | UUID of the live document this is a version of |
| `label`         | VARCHAR(64)  | Version label (e.g., "1.0", "1.1")             |
| `description`   | VARCHAR(512) | Version description                            |
| `created`       | TIMESTAMP    | Version creation time                          |
| `islatest`      | BOOLEAN      | Whether this is the latest version             |
| `islastmajor`   | BOOLEAN      | Whether this is the latest major version       |

### Other VCS Core Tables

| Table                | Description                                  |
| -------------------- | -------------------------------------------- |
| `acls`               | ACL rows for documents                       |
| `locks`              | Document lock owner and creation timestamp   |
| `proxies`            | Proxy target/versionable mappings            |
| `fulltext`           | Legacy VCS full-text fields and job IDs      |
| `ancestors`          | Ancestor relationships for hierarchy queries |
| `hierarchy_read_acl` | Precomputed read ACL optimization            |
| `aclr_user_map`      | Read ACL to user mapping                     |

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

### `acls` — Access Control Lists

Nuxeo stores ACLs directly on documents:

| Column       | Type        | Description                                            |
| ------------ | ----------- | ------------------------------------------------------ |
| `id`         | VARCHAR(36) | Document UUID / fragment owner                         |
| `name`       | VARCHAR(64) | ACL name                                               |
| `user`       | VARCHAR(64) | Username, group name, or special ("Everyone")          |
| `group`      | VARCHAR(64) | Whether this is a group entry                          |
| `permission` | VARCHAR(64) | Permission name (Read, Write, Everything, etc.)        |
| `grant`      | BOOLEAN     | Whether permission is granted (true) or denied (false) |
| `pos`        | INTEGER     | Ordering (deny before grant)                           |

Permissions are hierarchical: `Everything` > `Write` > `Read`. Security checks walk up the hierarchy and merge ACLs.

---

## Audit Log

### `NXP_LOGS` (SQL audit backend / NXAuditEventsService compatibility)

| Column               | Type          | Description                                              |
| -------------------- | ------------- | -------------------------------------------------------- |
| `LOG_ID`             | BIGINT        | Auto PK                                                  |
| `LOG_EVENT_ID`       | VARCHAR(64)   | Event category (documentCreated, documentModified, etc.) |
| `LOG_EVENT_DATE`     | TIMESTAMP     | When it happened                                         |
| `LOG_DATE`           | TIMESTAMP     | When audit row was inserted                              |
| `LOG_DOC_UUID`       | VARCHAR(36)   | Document UUID                                            |
| `LOG_DOC_PATH`       | VARCHAR(1024) | Document path                                            |
| `LOG_DOC_TYPE`       | VARCHAR(64)   | Document type                                            |
| `LOG_DOC_LIFE_CYCLE` | VARCHAR(64)   | Lifecycle state                                          |
| `LOG_PRINCIPAL_NAME` | VARCHAR(128)  | Username                                                 |
| `LOG_CATEGORY`       | VARCHAR(64)   | Event category                                           |
| `LOG_COMMENT`        | VARCHAR(512)  | Free text                                                |
| `LOG_REPOSITORY_ID`  | VARCHAR(64)   | Repository name                                          |

Extended log (separate table):

| Column     | Type         | Description             |
| ---------- | ------------ | ----------------------- |
| `LOG_ID`   | BIGINT       | FK → NXP_LOGS.LOG_ID    |
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

States: `project`, `approval`, `approved`, `obsolete`, `deleted`

Lifecycle is stored on the document row in `lifecyclepolicy` and `lifecyclestate` columns. Transitions are triggered by API calls, not by state columns.

---

## Workflow Model

Nuxeo integrates with document routing/workflow services. Workflow definitions and tasks are exposed through the repository and task/page-provider APIs rather than simple stable SQL tables named `nuxeo_workflow` and `nuxeo_task`. Treat workflow storage as implementation-specific: query it through Nuxeo APIs instead of relying on direct SQL table names.

---

## Relationships Diagram

```
VCS Core Tables
  │
  ├── hierarchy.id (UUID) — primary key/tree identity
  ├── hierarchy.parentid/name/pos — tree hierarchy
  ├── main fragment primarytype/mixintypes — document type + facets
  ├── versions.versionableid — version series
  ├── misc.lifecyclepolicy/lifecyclestate — state machine
  │
  ├── Schema data stored in:
  │     ├── generated simple schema tables
  │     └── Separate tables for complex types (blobs, arrays)
  │
  ├── acls → per-document ACLs
  ├── versions → version history
  ├── NXP_LOGS → SQL audit trail
  ├── nuxeo_workflow → workflow instances
  └── nuxeo_task → workflow tasks
```

---

## Upsides

1. **Mature document type system**: Schemas + Document Types + Facets provide a powerful composition model. Types inherit from parent types, and facets add behavior freely.

2. **Full lifecycle management**: Lifecycle policies with state machines are first-class. Transitions, guards, and state-dependent permissions are all built in.

3. **Versioning is deep and structured**: The `versions` table explicitly tracks version series, labels, major/minor version numbers, and latest/latest-major flags. Clear and queryable.

4. **ACL-based security at the document level**: The `acls` table is simple and effective. Grant/deny with ordering, hierarchical permission resolution, and per-document overrides.

5. **Dublin Core built-in**: Full Dublin Core metadata as a required schema on all documents. Interoperable with library and archival systems.

6. **Multi-blob support**: The `files:files` schema allows multiple attachments per document, and `picture:views` supports multiple renditions. No single-blob limitation.

7. **Record management**: `isrecord` and `retainuntil` fields in the main document table show first-class Records Management support — rare in open source DMS.

8. **Tree-based + UUID addressing**: Every document has a stable UUID (`id`) and a tree position through `parentid`, `name`, and `pos` in `hierarchy`. Path-style navigation is derived from the tree rather than guaranteed as a simple VCS `path` column.

9. **Comprehensive audit log**: The SQL audit backend's `NXP_LOGS` table, with extended properties, captures document events, lifecycle transitions, and workflow actions with user context.

10. **Elasticsearch integration**: Full-text and structural search is delegated to Elasticsearch, which indexes all schema fields, ACLs, and path information. The relational store is optimized for writes and consistency.

## Downsides

1. **Complex Java stack**: The entire platform requires OSGi, JBoss/Jetty, and a Java runtime. Operational complexity is very high compared to Docker-deployable Python or Go solutions.

2. **VCS generic tables mean poor direct query performance**: Documents with many custom schemas result in generated schema tables and additional joins. Complex queries across multiple schemas require either Elasticsearch/OpenSearch or careful indexing.

3. **No direct SQL access to schema fields**: Custom schema fields are stored either as columns in the main document table (if simple) or in separate joined tables (if complex). There's no guarantee which approach is used for a given field.

4. **Configuration-heavy**: Document types, schemas, facets, lifecycles, and workflows are all defined in XML and deployed through the Nuxeo Studio or XML hot-reload. Changes require redeployment of configurations.

5. **M2M relations via separate `relation` schema**: The `relation:statement` model (subject-predicate-object) is flexible but makes querying relationships harder than simple FK or M2M tables.

6. **ACL table can grow very large**: One row per (document, user/group, permission). For large deployments with thousands of users and millions of documents, this table can become a bottleneck.

7. **No page-level model**: Files are opaque binaries. There's no page extraction, no page-level OCR storage, and no page-level versioning within a document.

8. **Version storage doubles data**: When a document is checked in as a version, Nuxeo copies all data (including binaries) to a new version row. For large files, this can be storage-intensive.

9. **Workflow persistence is implementation-specific**: Detailed workflow state and variables are handled by the workflow/routing engine and repository APIs, not by stable, simple SQL tables intended for direct querying.

10. **Community vs. Enterprise feature gap**: Many advanced features (Records Management with retention rules, advanced workflow, Studio configuration, Elasticsearch setup) require the Enterprise Edition. The Community Edition is significantly less capable.
