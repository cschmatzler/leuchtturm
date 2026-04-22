# SharePoint Data Model (Public Schema Information)

> Not open source. Schema information derived from Microsoft documentation, CSOM/REST APIs, and public SQL schema references.  
> Database: SQL Server (on-premises) / Azure SQL (SharePoint Online)  
> Last analyzed: 2026-04-22

## Architecture Overview

SharePoint is Microsoft's enterprise content management and collaboration platform. Its data model is deeply tied to SQL Server and is primarily accessed through CSOM (Client-Side Object Model), REST APIs, and PowerShell. The on-premises SQL schema is documented; SharePoint Online's schema is similar but inaccessible directly.

Key concepts:

- **Site Collection** → **Site (Web)** → **List** → **List Item**
- **Document Library** is a specialized List that stores files
- **Content Types** define the schema for items
- **Columns (Fields)** are defined at the site level and can be added to content types
- **Properties** (metadata) are stored as list item field values

---

## Core Database Tables (On-Premises SQL)

### `AllDocs` (All Documents) — The central document table

| Column                | Type             | Description                                    |
| --------------------- | ---------------- | ---------------------------------------------- |
| `Id`                  | uniqueidentifier | Document GUID                                  |
| `SiteId`              | uniqueidentifier | Site collection ID                             |
| `WebId`               | uniqueidentifier | Web (site) ID                                  |
| `ListId`              | uniqueidentifier | List (library) ID                              |
| `DocLibId`            | uniqueidentifier | Document library ID                            |
| `Type`                | int              | 0=File, 1=Folder                               |
| `LeafName`            | nvarchar(260)    | Filename                                       |
| `DirName`             | nvarchar(260)    | Folder path                                    |
| `TimeCreated`         | datetime         | Creation time                                  |
| `TimeLastModified`    | datetime         | Last modification time                         |
| `Size`                | int              | File size                                      |
| `MetaInfo`            | nvarchar(max)    | Extended metadata (property bag)               |
| `UiVersion`           | int              | Version number (e.g., 512 = v1.0, 1024 = v2.0) |
| `UiVersionString`     | nvarchar(20)     | Version string ("1.0", "2.1")                  |
| `CheckoutUserId`      | int              | Who has it checked out                         |
| `CheckoutDate`        | datetime         | When it was checked out                        |
| `CheckoutExpires`     | datetime         | Checkout expiration                            |
| `HasPreviewImage`     | bit              | Whether thumbnail exists                       |
| `ContentVersion`      | int              | Content version counter                        |
| `DeleteTransactionId` | varbinary        | Transaction ID for deletion                    |
| `Level`               | tinyint          | 1=Published, 2=Draft, 255=Checkout             |
| `IsCurrentVersion`    | bit              | Whether this is the latest version             |

### `AllDocStreams` (Document Binary Content)

| Column    | Type                      | Description                                     |
| --------- | ------------------------- | ----------------------------------------------- |
| `Id`      | uniqueidentifier          | Document ID                                     |
| `Content` | varbinary(max)            | Binary content                                  |
| `RbsId`   | uniqueidentifier nullable | Remote Blob Storage ID (for RBS-enabled setups) |

When **Remote Blob Storage (RBS)** is enabled, content is stored on the filesystem or in Azure Blob Storage, not in SQL.

### `AllDocVersions` (Document Version History)

| Column             | Type             | Description                          |
| ------------------ | ---------------- | ------------------------------------ |
| `Id`               | uniqueidentifier | Version GUID                         |
| `SiteId`           | uniqueidentifier |                                      |
| `DocId`            | uniqueidentifier | FK → AllDocs                         |
| `Level`            | tinyint          | Version level (1=published, 2=draft) |
| `UiVersion`        | int              | Version number                       |
| `UiVersionString`  | nvarchar(20)     | Version string                       |
| `TimeCreated`      | datetime         |                                      |
| `TimeLastModified` | datetime         |                                      |
| `Size`             | int              |                                      |
| `InternalVersion`  | int              | Internal version counter             |

### `AllLists` (All Lists/Libraries)

| Column                      | Type             | Description                               |
| --------------------------- | ---------------- | ----------------------------------------- |
| `Id`                        | uniqueidentifier | List GUID                                 |
| `Tp_WebId`                  | uniqueidentifier | Parent web ID                             |
| `Tp_Title`                  | nvarchar(255)    | List title                                |
| `Tp_Description`            | nvarchar(512)    |                                           |
| `Tp_BaseType`               | int              | 0=GenericList, 1=DocumentLibrary          |
| `Tp_ServerTemplate`         | int              | Template ID (101=DocLib, 100=GenericList) |
| `Tp_Modified`               | datetime         |                                           |
| `Tp_Created`                | datetime         |                                           |
| `Tp_ItemCount`              | int              | Cached item count                         |
| `Tp_ContentTypesEnabled`    | bit              | Whether content types are enabled         |
| `Tp_DraftVersionVisibility` | int              | Who can see drafts                        |
| `Tp_EnableMinorVersions`    | bit              | Minor versions (draft) enabled            |
| `Tp_EnableModeration`       | bit              | Content approval enabled                  |
| `Tp_EnableVersioning`       | bit              | Versioning enabled                        |
| `Tp_ForceCheckout`          | bit              | Require checkout                          |
| `Tp_MajorVersionLimit`      | int              | Max major versions (0=unlimited)          |
| `Tp_MinorVersionLimit`      | int              | Max minor versions per major              |

### `AllUserData` (List Item Data) — Lists

| Column                   | Type                   | Description                       |
| ------------------------ | ---------------------- | --------------------------------- |
| `tp_ID`                  | int                    | Item ID (per-list auto-increment) |
| `tp_SiteId`              | uniqueidentifier       |                                   |
| `tp_ListId`              | uniqueidentifier       | Parent list                       |
| `tp_RowOrdinal`          | int                    | Row ordinal for multi-row items   |
| `tp_Level`               | tinyint                | 1=Published, 2=Draft              |
| `tp_UIVersion`           | int                    |                                   |
| `tp_Modified`            | datetime               |                                   |
| `tp_Created`             | datetime               |                                   |
| `tp_Author`              | int                    | Created by (user ID)              |
| `tp_Editor`              | int                    | Modified by (user ID)             |
| `tp_Title`               | nvarchar(255)          | Item title                        |
| `tp_Data`                | nvarchar(max)          | JSON property bag                 |
| `tp_DirName`             | nvarchar(260)          | Folder path                       |
| `tp_LeafName`            | nvarchar(260)          | Filename                          |
| `tp_CheckoutUserId`      | int nullable           |                                   |
| `tp_IsCurrent`           | bit                    |                                   |
| `tp_DeleteTransactionId` | varbinary              |                                   |
| `tp_HasCopyDestinations` | bit                    |                                   |
| `tp_CopySource`          | nvarchar(260) nullable |                                   |

Plus **up to 64 generic columns**: `nvarchar1` through `nvarchar64`, `int1` through `int16`, `float1` through `float4`, `datetime1` through `datetime8`, `bit1` through `bit16`, `sql_variant1` through `sql_variant8`.

### `AllUserDataJunctions` (Multi-value Lookups)

| Column        | Type             | Description     |
| ------------- | ---------------- | --------------- |
| `tp_ID`       | int              | Junction ID     |
| `tp_SiteId`   | uniqueidentifier |                 |
| `tp_ListId`   | uniqueidentifier | Source list     |
| `tp_DocId`    | uniqueidentifier | Source document |
| `tp_FieldId`  | uniqueidentifier | Lookup field ID |
| `tp_LookupId` | int              | Target item ID  |

### `AllWebParts` (Web Part Catalog)

Stores web part configurations for page rendering — not directly relevant to document management.

---

## Content Type Model

### `ContentTypeDefinition` (Conceptual — stored in `AllContentTypes` + features XML)

Content Types define the schema for items:

| Property               | Type                | Description                                                                              |
| ---------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `Id`                   | ContentTypeId (SPI) | Hierarchical content type ID (e.g., `0x0101` = Document, `0x010100...` = custom subtype) |
| `Name`                 | String              | Display name                                                                             |
| `Group`                | String              | Content type group                                                                       |
| `Description`          | String              |                                                                                          |
| `Parent`               | ContentTypeId       | Parent type (inheritance)                                                                |
| `Hidden`               | Boolean             |                                                                                          |
| `ReadOnly`             | Boolean             |                                                                                          |
| `Sealed`               | Boolean             |                                                                                          |
| `Fields`               | FieldCollection     | Ordered set of field references                                                          |
| `DocumentTemplate`     | String              | Template URL                                                                             |
| `WorkflowAssociations` | Collection          | Attached workflows                                                                       |

**Built-in Content Types**:

- `0x01` → Item (base)
- `0x0101` → Document
- `0x0102` → Event
- `0x0104` → Announcement
- `0x0105` → Link
- `0x0107` → Task
- `0x0110` → Picture
- `0x0120` → Folder
- `0x0101...` → Custom document types

Content Type IDs are hierarchical. `0x010100...` means "Document + two custom hex bytes". This allows type inheritance to be determined from the ID alone.

### `AllContentTypes` (SQL)

| Column          | Type             | Description            |
| --------------- | ---------------- | ---------------------- |
| `ContentTypeId` | varbinary(512)   | Binary content type ID |
| `Class`         | int              |                        |
| `Scope`         | uniqueidentifier | Site ID where defined  |
| `Name`          | nvarchar(128)    |                        |
| `Group`         | nvarchar(64)     |                        |
| `Description`   | nvarchar(512)    |                        |
| `ParentId`      | varbinary(512)   | Parent content type    |
| `NewSection`    | bit              |                        |
| `ReadOnly`      | bit              |                        |
| `Sealed`        | bit              |                        |
| `Hidden`        | bit              |                        |

---

## Fields (Columns) Model

### `AllFields` (Site Columns + List Fields)

| Column                | Type                      | Description                                               |
| --------------------- | ------------------------- | --------------------------------------------------------- |
| `SiteId`              | uniqueidentifier          |                                                           |
| `FieldId`             | uniqueidentifier          | Field GUID                                                |
| `ListId`              | uniqueidentifier nullable | Null = site column                                        |
| `FieldName`           | nvarchar(64)              | Internal name                                             |
| `FieldGroup`          | nvarchar(64)              | Group name                                                |
| `FieldType`           | nvarchar(32)              | Type (Text, Number, DateTime, User, Lookup, Choice, etc.) |
| `Title`               | nvarchar(128)             | Display name                                              |
| `Description`         | nvarchar(512)             |                                                           |
| `Required`            | bit                       |                                                           |
| `Hidden`              | bit                       |                                                           |
| `ReadOnlyField`       | bit                       |                                                           |
| `CanToggleHidden`     | bit                       |                                                           |
| `EnforceUniqueValues` | bit                       |                                                           |
| `SchemaXml`           | nvarchar(max)             | Full field definition XML                                 |

**Field Types**: Text, Note, Number, Currency, DateTime, Choice, MultiChoice, User, URL, Lookup, Calculated, Boolean, File, GUID, Integer, ContentType, WorkflowStatus, etc.

---

## Audit Log

### `AuditData` (SharePoint Audit Log)

| Column        | Type                      | Description               |
| ------------- | ------------------------- | ------------------------- |
| `AuditId`     | bigint                    | Auto PK                   |
| `SiteId`      | uniqueidentifier          | Site collection           |
| `ItemId`      | uniqueidentifier nullable | Document/list item        |
| `ItemType`    | int                       | Item type                 |
| `ListId`      | uniqueidentifier nullable |                           |
| `WebId`       | uniqueidentifier nullable |                           |
| `UserId`      | int                       | User who performed action |
| `Occurred`    | datetime                  | When it happened          |
| `Event`       | int                       | Event type (see below)    |
| `EventSource` | int                       | Event source              |
| `EventData`   | ntext                     | Additional event data     |

**Event Types**:
1=CheckIn, 2=CheckOut, 3=View, 4=Delete, 5=Update, 6=Copy, 7=Move, 8=SecurityChange, 9=Workflow, 10=WorkflowUpdate, 11=WorkflowDeleted, 12=Custom, 13=ChildDelete, 14=ProfileDelete, 15=Search, 16=ViewRecurrence

### `UsageData` (Analytics)

Separate table for page views, search queries, and usage statistics. Not a compliance audit log.

---

## Permissions / ACL

### `Perms` (Permissions Table)

| Column             | Type             | Description                       |
| ------------------ | ---------------- | --------------------------------- |
| `SiteId`           | uniqueidentifier |                                   |
| `ScopeId`          | uniqueidentifier | Unique scope ID                   |
| `ScopeUrl`         | nvarchar(260)    | URL path                          |
| `ScopeParentId`    | uniqueidentifier | Parent scope (inheritance)        |
| `ScopeIsInherited` | bit              | Whether permissions are inherited |
| `RoleDefId`        | uniqueidentifier | Role definition ID                |
| `PrincipalId`      | int              | User or group ID                  |

### `RoleDef` (Role Definitions) — permission levels

| Column        | Type             | Description                                |
| ------------- | ---------------- | ------------------------------------------ |
| `SiteId`      | uniqueidentifier |                                            |
| `RoleDefId`   | uniqueidentifier |                                            |
| `Name`        | nvarchar(64)     | E.g., "Full Control", "Contribute", "Read" |
| `Description` | nvarchar(512)    |                                            |
| `Permissions` | int              | Bitmask of permissions                     |

**Permission Bitmask**: ViewListItems=1, AddListItems=2, EditListItems=4, DeleteListItems=8, ApproveItems=16, OpenItems=32, ViewVersions=64, DeleteVersions=128, CancelCheckout=256, ManagePersonalViews=512, ViewFormPages=1024, Open=65536, ViewPages=131072, AddAndCustomizePages=262144, ... Full Control = all bits.

### `GroupMembership` (SecPrincipal + GroupMember)

SharePoint uses AD-like security principals. Group membership is resolved at query time via `TP_SiteID`, `TP_GroupID`.

---

## Version Details

Version numbers in SharePoint are stored as integers in `UiVersion`:

- Major version: `N * 512` (e.g., 1.0 = 512, 2.0 = 1024)
- Minor version: `N * 512 + M * 1` (e.g., 2.1 = 1025)

**Draft versions** (minor) are only visible to authors/editors. **Published versions** (major) are visible to readers.

**Checkout** is tracked via `CheckoutUserId` and `CheckoutDate` on the document row. Only one user can check out a document at a time.

---

## Relationships Diagram

```
Site Collection (SPSite)
  └── Web (SPWeb)
        ├── List (AllLists) ── Document Library (BaseType=1)
        │     ├── Content Types (AllContentTypes)
        │     ├── Fields (AllFields)
        │     └── List Items (AllUserData)
        │           ├── List Item Fields (nvarchar1-64, int1-16, etc.)
        │           ├── Multi-value Lookups (AllUserDataJunctions)
        │           └── Document (AllDocs)
        │                 ├── Content Streams (AllDocStreams)
        │                 ├── Versions (AllDocVersions)
        │                 └── Permissions (Perms)
        │
        └── Audit Log (AuditData)
              ├── Events (checkin/checkout/view/delete/update/copy/move/security)
              └── Usage Data

Content Type Hierarchy:
  0x01 (Item)
    0x0101 (Document)
      0x010100... (Custom Document Types)
    0x0107 (Picture)
    0x0120 (Folder)
    ... (Event, Announcement, Task, Link, etc.)
```

---

## Upsides

1. **Content Type inheritance**: Hierarchical content type IDs (`0x0101...`) allow deep inheritance with override. A document type can inherit all fields from its parent and add new ones. The type hierarchy is visible from the ID alone.

2. **Proven and massive scale**: SharePoint has been running enterprise deployments for 20+ years. The schema is battle-tested at million-document scales.

3. **Integrated lifecycle**: `Level` (Published/Draft/Checkout) + versioning + checkout + content approval in the core document table allows complete document lifecycle management without additional tables.

4. **Comprehensive permissions**: The `Perms` + `RoleDef` model with bitmask permissions and inheritance breaks provides granular role-based access control with efficient storage.

5. **Audit integration**: `AuditData` table captures all significant document events out of the box with well-defined event types.

6. **Generic columns pattern**: `AllUserData` has up to 64 `nvarchar`, 16 `int`, 4 `float`, 8 `datetime`, 16 `bit`, and 8 `sql_variant` columns. This allows mapping custom fields to typed storage without joins.

7. **Versioning with major/minor**: The 512-based version numbering elegantly encodes major and minor versions in a single integer, enabling efficient queries like "get latest major version."

8. **Remote Blob Storage (RBS)**: Binary content can be offloaded from SQL Server to filesystem or cloud storage without changing the application model.

9. **Content Type Hub**: Content types can be published from a central hub across site collections, enabling enterprise-wide schema consistency.

10. **Enterprise feature depth**: Records management, information policies, document sets, managed metadata, discovery, eDiscovery — all built on the same data model with no schema changes.

## Downsides

1. **Totally proprietary**: The SQL schema is undocumented by Microsoft, changes between versions, and is not supported for direct access. All interaction must go through APIs (CSOM, REST, Graph API).

2. **Generic column exhaustion**: With only 64 nvarchar, 16 int, etc. columns, large lists with many custom fields can hit the column limit. The `tp_Data` JSON property bag is used for overflow, but it's unqueryable.

3. **List threshold limit**: SharePoint enforces a 5,000-item list view threshold. Large document libraries require indexed columns and filtered views. This is an operational limitation baked into the data model.

4. **Cascading lookups require junction tables**: Many-to-many relationships (multi-value lookups) require the `AllUserDataJunctions` table, which adds complexity and performance overhead.

5. **No page-level content model**: Files are opaque binaries. There's no page extraction, page-level metadata, or page-level versioning. This is a fundamental limitation for document-heavy workflows.

6. **Content type IDs are opaque binary**: The hierarchical ID system is stored as `varbinary(512)`, making it impossible to read or debug without SharePoint's SDK.

7. **Audit log is separate from transaction**: `AuditData` is append-only but not immutable. It can be purged by administrators. For compliance, additional archiving is needed.

8. **Permission inheritance is complex**: When `ScopeIsInherited=false`, SharePoint must recalculate effective permissions by walking up the scope hierarchy and merging with group memberships. This can be expensive.

9. **SQL Server dependency**: On-premises SharePoint requires SQL Server (or Azure SQL). No PostgreSQL, MySQL, or SQLite option.

10. **No document signatures or integrity**: No built-in checksum, hash, or digital signature verification. External solutions (like DigiCert) must be integrated.
