# Documize Data Model

> Source: [documize/community](https://github.com/documize/community)  
> Language: Go  
> Database: PostgreSQL, MySQL, SQLite (via Go ORM)  
> Last analyzed: 2026-04-22

## Architecture Overview

Documize is a knowledge management / document collaboration platform. Its data model is defined in Go structs under `model/` and `domain/`, with database access via a store layer under `domain/*/store/`. The core concepts are: **Organization → Space → Document → Page/Section**, with categories, permissions, and approval workflows.

Every entity has a `BaseEntity` with `ID` (uint64, DB auto-inc), `RefID` (string UUID), `Created` (timestamp), and `Revised` (timestamp).

---

## Core Entities

### Organization (`model/org/org.go`)

Multi-tenant root. All data is scoped to an organization.

| Field          | Type         | Description                      |
| -------------- | ------------ | -------------------------------- |
| `RefID`        | string       | UUID                             |
| `Company`      | string       | Company name                     |
| `Title`        | string       | Organization display name        |
| `Message`      | string       | Welcome message                  |
| `URL`          | string       | Custom URL                       |
| `Domain`       | string       | Email domain for auto-enrollment |
| `ETag`         | string       | Concurrency token                |
| `Subscription` | Subscription | License/billing info             |
| `MaxTags`      | int          | Maximum tags per space           |
| `Active`       | bool         | Whether org is active            |

### Space (`model/space/space.go`)

Container for documents (like a project, department, or folder).

| Field           | Type               | Description                                          |
| --------------- | ------------------ | ---------------------------------------------------- |
| `ID`            | uint64             | Auto PK                                              |
| `RefID`         | string             | UUID                                                 |
| `Name`          | string             | Space name                                           |
| `Description`   | string             | Description                                          |
| `OrgID`         | string             | Owning organization                                  |
| `UserID`        | string             | Creator                                              |
| `LabelID`       | string             | FK → Label (color grouping)                          |
| `Type`          | Scope              | 1=Public, 2=Private, 3=Restricted                    |
| `Lifecycle`     | workflow.Lifecycle | Default lifecycle for new docs (Draft/Live/Archived) |
| `Likes`         | string             | "Did this help?" prompt text                         |
| `Icon`          | string             | Space icon identifier                                |
| `CountCategory` | int                | Cached category count                                |
| `CountContent`  | int                | Cached document count                                |
| `Created`       | time.Time          |                                                      |
| `Revised`       | time.Time          |                                                      |

### Label (`model/label/label.go`)

Color labels for spaces.

| Field   | Type   | Description  |
| ------- | ------ | ------------ |
| `ID`    | uint64 | Auto PK      |
| `RefID` | string | UUID         |
| `OrgID` | string | Organization |
| `Name`  | string | Label name   |
| `Color` | string | Hex color    |

### Document (`model/doc/doc.go`)

The central content entity.

| Field          | Type                | Description                                 |
| -------------- | ------------------- | ------------------------------------------- |
| `ID`           | uint64              | Auto PK                                     |
| `RefID`        | string              | UUID                                        |
| `OrgID`        | string              | Organization                                |
| `SpaceID`      | string              | Parent space                                |
| `UserID`       | string              | Creator                                     |
| `Job`          | string              | Import job ID                               |
| `Location`     | string              | External storage location                   |
| `Name`         | string              | Document title                              |
| `Excerpt`      | string              | Short description                           |
| `Slug`         | string              | URL-friendly name (not exported to JSON)    |
| `Tags`         | string              | Comma-separated tag list                    |
| `Template`     | bool                | Whether this is a template                  |
| `Protection`   | workflow.Protection | 0=None, 1=Locked, 2=Review required         |
| `Approval`     | workflow.Approval   | 0=None, 1=Anybody, 2=Majority, 3=Unanimous  |
| `Lifecycle`    | workflow.Lifecycle  | 0=Draft, 1=Live, 2=Archived                 |
| `Versioned`    | bool                | Whether this doc is part of a version group |
| `VersionID`    | string              | Group ID for versioning                     |
| `VersionOrder` | int                 | Order within version group                  |
| `Sequence`     | int                 | Sort order within space                     |
| `GroupID`      | string              | Version group identifier                    |
| `Category`     | []string            | Read-only list of category IDs              |

### Page / Section (`model/page/page.go`)

A document is composed of pages/sections. Each page is a content block.

| Field         | Type                  | Description                                                     |
| ------------- | --------------------- | --------------------------------------------------------------- |
| `ID`          | uint64                | Auto PK                                                         |
| `RefID`       | string                | UUID                                                            |
| `OrgID`       | string                | Organization                                                    |
| `DocumentID`  | string                | Parent document                                                 |
| `UserID`      | string                | Last editor                                                     |
| `ContentType` | string                | Content type (wysiwyg, code, table, section, tab)               |
| `Type`        | string                | Page type (wysiwyg/section/tab)                                 |
| `TemplateID`  | string                | Reusable block FK                                               |
| `Level`       | uint64                | Heading level (1=N)                                             |
| `Sequence`    | float64               | Sort order (double for precise insertion)                       |
| `Numbering`   | string                | Outline numbering string                                        |
| `Name`        | string                | Section title                                                   |
| `Body`        | string                | Rendered HTML content                                           |
| `Revisions`   | uint64                | Number of revisions                                             |
| `Status`      | workflow.ChangeStatus | 0=Published, 1=Pending, 2=UnderReview, 3=Rejected, 4=PendingNew |
| `RelativeID`  | string                | Links pending page to its published counterpart                 |

### Page Meta (`model/page/page.go`)

| Field            | Type      | Description                             |
| ---------------- | --------- | --------------------------------------- |
| `ID`             | uint64    |                                         |
| `Created`        | time.Time |                                         |
| `Revised`        | time.Time |                                         |
| `OrgID`          | string    |                                         |
| `UserID`         | string    |                                         |
| `DocumentID`     | string    |                                         |
| `SectionID`      | string    | FK → Page                               |
| `RawBody`        | string    | Raw/unrendered content (Markdown, code) |
| `Config`         | string    | JSON configuration for section type     |
| `ExternalSource` | bool      | Whether data is externally sourced      |

### Revision (`model/page/page.go`)

| Field         | Type   | Description                    |
| ------------- | ------ | ------------------------------ |
| `ID`          | uint64 |                                |
| `RefID`       | string | UUID                           |
| `OrgID`       | string |                                |
| `DocumentID`  | string |                                |
| `SectionID`   | string | FK → Page                      |
| `OwnerID`     | string | Original author                |
| `UserID`      | string | Reviser                        |
| `ContentType` | string |                                |
| `Type`        | string |                                |
| `Name`        | string | Section title at revision time |
| `Body`        | string | Rendered content               |
| `RawBody`     | string | Raw content                    |
| `Config`      | string | JSON config                    |
| `Email`       | string | Author email                   |
| `Firstname`   | string |                                |
| `Lastname`    | string |                                |
| `Initials`    | string |                                |
| `Revisions`   | int    | Total revision count           |

### Attachment (`model/attachment/attachment.go`)

| Field        | Type   | Description                        |
| ------------ | ------ | ---------------------------------- |
| `ID`         | uint64 |                                    |
| `RefID`      | string | UUID                               |
| `OrgID`      | string |                                    |
| `DocumentID` | string | Parent document                    |
| `SectionID`  | string | Optional: page-specific attachment |
| `Job`        | string | Upload job ID                      |
| `FileID`     | string | Storage file reference             |
| `Filename`   | string | Original filename                  |
| `Data`       | []byte | Binary content                     |
| `Extension`  | string | File extension                     |

### Link (`model/link/link.go`)

Cross-references between sections and other documents/sections/attachments.

| Field              | Type   | Description                                   |
| ------------------ | ------ | --------------------------------------------- |
| `ID`               | uint64 |                                               |
| `RefID`            | string | UUID                                          |
| `OrgID`            | string |                                               |
| `SpaceID`          | string |                                               |
| `UserID`           | string |                                               |
| `LinkType`         | string | Type: section, document, attachment, external |
| `SourceDocumentID` | string | Document containing the link                  |
| `SourceSectionID`  | string | Page containing the link                      |
| `TargetDocumentID` | string | Target document                               |
| `TargetID`         | string | Target section/attachment ID                  |
| `ExternalID`       | string | External URL                                  |
| `Orphan`           | bool   | Whether the link target no longer exists      |

---

## Categorization

### Category (`model/category/category.go`)

| Field       | Type   | Description                        |
| ----------- | ------ | ---------------------------------- |
| `ID`        | uint64 |                                    |
| `RefID`     | string | UUID                               |
| `OrgID`     | string |                                    |
| `SpaceID`   | string | Parent space                       |
| `Name`      | string | Category name                      |
| `IsDefault` | bool   | Default category for new documents |

### Category Member (`model/category/category.go`)

| Field        | Type   | Description   |
| ------------ | ------ | ------------- |
| `ID`         | uint64 |               |
| `RefID`      | string | UUID          |
| `OrgID`      | string |               |
| `CategoryID` | string | FK → Category |
| `SpaceID`    | string |               |
| `DocumentID` | string | FK → Document |

---

## Permissions

### Permission (Permission Record — `model/permission/common.go`)

| Field      | Type     | Description                            |
| ---------- | -------- | -------------------------------------- |
| `ID`       | uint64   |                                        |
| `OrgID`    | string   |                                        |
| `Who`      | WhoType  | "user" or "role"                       |
| `WhoID`    | string   | User/Group ID                          |
| `Action`   | Action   | Specific permission action (see below) |
| `Scope`    | Scope    | "object" or "table"                    |
| `Location` | Location | "space" or "document"                  |
| `RefID`    | string   | Target space/document ID               |

**Permitted Actions**:

- Space: View, Manage, Owner
- Document: Add, Edit, Delete, Move, Copy, Template, Approve, Lifecycle, Version

Permissions are stored as **individual rows per action per user per object**. A flattened `Record` struct is computed for display.

### Document Permission (`model/permission/document.go`)

Flattened view:

- `DocumentRoleEdit`: bool
- `DocumentRoleApprove`: bool

### Space Permission (`model/permission/space.go`)

Flattened view with 12 boolean fields covering space and document operations.

---

## Workflow / Lifecycle

### Workflow (`model/workflow/workflow.go`)

| Enum           | Value                                                           | Description             |
| -------------- | --------------------------------------------------------------- | ----------------------- |
| `Protection`   | 0=None, 1=Locked, 2=Review                                      | Change protection level |
| `Approval`     | 0=None, 1=Anybody, 2=Majority, 3=Unanimous                      | Approval requirements   |
| `ChangeStatus` | 0=Published, 1=Pending, 2=UnderReview, 3=Rejected, 4=PendingNew | Section states          |
| `Lifecycle`    | 0=Draft, 1=Live, 2=Archived                                     | Document lifecycle      |

The workflow is embedded in Document (`Protection`, `Approval`, `Lifecycle` fields) and Page (`Status` field) rather than in a separate table.

---

## Audit / Activity

### AppEvent (`model/audit/audit.go`)

| Field     | Type      | Description            |
| --------- | --------- | ---------------------- |
| `ID`      | uint64    |                        |
| `OrgID`   | string    |                        |
| `UserID`  | string    |                        |
| `Type`    | EventType | Event type (see below) |
| `IP`      | string    | Client IP              |
| `Created` | time.Time |                        |

**Event Types** (60+ events):

- Document: add, upload, view, update, delete, revisions, permission
- Space: add, update, delete, permission, join, invite
- Section: add, update, delete, rollback, resequence, copy
- Category: add, delete, update, link, unlink
- Attachment: add, download, delete
- User: add, update, delete, password reset
- Workflow: approval requested, withdrawn, approved, rejected, publication requested
- Version: add, remove, reorder
- System: license change, auth change, SMTP change, database backup/restore

### UserActivity (`model/activity/activity.go`)

A richer activity model tied to specific objects:

| Field          | Type       | Description                                                         |
| -------------- | ---------- | ------------------------------------------------------------------- |
| `ID`           | uint64     |                                                                     |
| `OrgID`        | string     |                                                                     |
| `UserID`       | string     |                                                                     |
| `SpaceID`      | string     |                                                                     |
| `DocumentID`   | string     |                                                                     |
| `SectionID`    | string     |                                                                     |
| `ActivityType` | Type       | Created=1, Read=2, Edited=3, Deleted=4, Archived=5, Approved=6, ... |
| `SourceType`   | SourceType | Space=1, Document=2, Page=3, Search=4                               |
| `Metadata`     | string     | Extra data (search terms, etc.)                                     |
| `Created`      | time.Time  |                                                                     |

---

## Document Meta (Viewers/Editors)

### DocumentMetaViewer

| Field       | Type      | Description |
| ----------- | --------- | ----------- |
| `UserID`    | string    |             |
| `Created`   | time.Time |             |
| `Firstname` | string    |             |
| `Lastname`  | string    |             |

### DocumentMetaEditor

| Field       | Type      | Description             |
| ----------- | --------- | ----------------------- |
| `SectionID` | string    | Which page was edited   |
| `UserID`    | string    |                         |
| `Action`    | string    | Edit action description |
| `Created`   | time.Time |                         |
| `Firstname` | string    |                         |
| `Lastname`  | string    |                         |

---

## Pinning

### Pin (`model/pin/pin.go`)

| Field        | Type   | Description |
| ------------ | ------ | ----------- |
| `ID`         | uint64 |             |
| `RefID`      | string | UUID        |
| `OrgID`      | string |             |
| `UserID`     | string |             |
| `DocumentID` | string |             |
| `Sequence`   | int    | Sort order  |

---

## Block (Reusable Content)

### Block (`model/block/block.go`)

Reusable content blocks that can be inserted into any document.

| Field         | Type   | Description        |
| ------------- | ------ | ------------------ |
| `ID`          | uint64 |                    |
| `RefID`       | string | UUID               |
| `OrgID`       | string |                    |
| `SpaceID`     | string |                    |
| `UserID`      | string |                    |
| `ContentType` | string | Content type       |
| `Type`        | string | Block type         |
| `Title`       | string | Block title        |
| `Body`        | string | Block content      |
| `Excerpt`     | string | Short description  |
| `RawBody`     | string | Unrendered content |
| `Config`      | string | JSON config        |

---

## Template

### Template (`model/template/template.go`)

| Field         | Type   | Description           |
| ------------- | ------ | --------------------- |
| `ID`          | uint64 |                       |
| `RefID`       | string | UUID                  |
| `OrgID`       | string |                       |
| `SpaceID`     | string | Source space          |
| `Title`       | string |                       |
| `Description` | string |                       |
| `Type`        | string | "private" or "public" |
| `DocumentID`  | string | Source document       |

---

## Relationships Diagram

```
Organization (multi-tenant root)
  │
  ├── Label (color labels for spaces)
  │
  └── Space
        ├── SpacePermission (per-user/group actions)
        ├── Category (within space)
        │     └── CategoryMember → Document
        ├── Label (space color label)
        │
        └── Document
              ├── DocumentPermission (per-user actions)
              ├── Page / Section (1:N)
              │     ├── PageMeta (raw content, config)
              │     ├── Revision (1:N version history)
              │     └── Link (cross-references)
              ├── Attachment (1:N, optionally per-section)
              ├── Pin (per-user pinning)
              └── AppEvent / UserActivity (audit trail)

Block (reusable content, space-scoped)
Template (document template, space-scoped)
```

---

## Upsides

1. **Multi-tenancy first-class**: `OrgID` on every entity. Clean separation of organizations. No risk of data leakage between tenants.

2. **Section-based content model**: Documents are composed of Pages/Sections, each with their own type (wysiwyg, code, table, embedded data). This is much richer than a single content blob — sections can be reordered, individually edited, approved, and versioned.

3. **Page-level change status**: Each page has a `Status` (Published, Pending, UnderReview, Rejected, PendingNew). Combined with document-level `Protection` (None, Locked, Review) and `Approval` thresholds, this enables fine-grained content review workflows.

4. **Dual audit models**: `AppEvent` captures system-level CRUD events with timestamps and IPs. `UserActivity` captures richer activity with document/section context. Both together provide comprehensive tracking.

5. **Version grouping**: Documents can be versioned via `VersionID` / `GroupID`, with `VersionOrder` controlling display order. Simple but effective.

6. **Permission granularity**: Individual action-level permissions (View, Edit, Delete, Move, Copy, Template, Approve, Lifecycle, Version) stored as discrete rows. The flattened `Record` struct provides an efficient computed view.

7. **Link integrity checking**: The `Link` model tracks `Orphan` status, detecting when cross-references break. This is rare in DMS systems.

8. **Simple deployment**: Go binary + database. No JVM, no Python virtualenv, no complex dependencies.

9. **Template system**: Documents can be marked as templates, enabling reuse. Blocks provide reusable content sections separate from documents.

10. **RefID pattern**: Every entity has both an auto-increment `ID` (for DB efficiency) and a UUID `RefID` (for API/external references). This dual-ID pattern avoids exposing internal IDs while keeping fast joins.

## Downsides

1. **Tags are a comma-separated string**: `Document.Tags` is just a string field. No tag table, no tag hierarchy, no tag-level permissions or metadata. Querying by tag requires LIKE or string splitting.

2. **No file-level storage model**: Attachments store binary data directly as `[]byte` in the model. The `FileID` field suggests a file store reference, but there's no clear distinction between inline and external storage in the data model.

3. **No checksum/integrity**: No hash fields on attachments or documents. Can't verify file integrity or detect duplicates.

4. **Revisions are full copies**: Each `Revision` stores the complete section content (`Body`, `RawBody`, `Config`). No delta storage. For documents with many revisions, storage grows linearly.

5. **No document type or schema system**: Unlike Mayan's `DocumentType` or Alfresco's type/aspect system, Documize has no way to define different document structures for different use cases. All documents share the same flat Page-based model.

6. **Permission rows are verbose**: One row per (user, action, object). For a space with 10 users and 12 actions, that's 120 rows. Computing the flattened `Record` requires scanning all rows.

7. **No structured metadata**: No equivalent of Paperless's `CustomField` or Mayan's `MetadataType`. The only per-document metadata is `Tags` (comma-separated string) and `Category` membership.

8. **Draft/Published model is coarse**: Documents have only 3 lifecycle states (Draft, Live, Archived). There's no equivalent of Mayan's fine-grained `is_stub` or Paperless's `StoragePath` routing.

9. **Activity model lacks immutability guarantees**: `AppEvent` and `UserActivity` are regular tables with no architectural protection against modification or deletion. Not suitable for compliance audit without additional constraints.

10. **No full-text search in model**: The data model doesn't include search indexes or content extraction fields. Search relies on separate search services (Elasticsearch/bleve) configured outside the model.
