# Nextcloud Server Files Data Model

> Source: [nextcloud/server](https://github.com/nextcloud/server)  
> Language: PHP (Nextcloud app framework / Symfony Console components)  
> Database: MySQL/MariaDB, PostgreSQL, SQLite  
> Last analyzed: 2026-04-22

## Architecture Overview

Nextcloud is a broad collaboration platform, not a dedicated DMS. Its file management is built on the **ownCloud file cache** architecture, with apps (Files, Share, Versions, Trashbin, Activity, Tags, Comments, Workflow) layered on top. The data model is defined primarily through database migrations and is stored directly in relational tables.

---

## Core Files Tables

### `oc_filecache` — The Central Node Table

This is the heart of the file system. Every file, folder, and share target has a row here.

| Column             | Type                  | Description                                                                  |
| ------------------ | --------------------- | ---------------------------------------------------------------------------- |
| `fileid`           | BIGINT AUTO_INCREMENT | Primary key                                                                  |
| `storage`          | BIGINT                | Which storage backend this file lives on                                     |
| `path`             | VARCHAR(4000)         | Relative path within the storage                                             |
| `path_hash`        | VARCHAR(32)           | MD5 of `path` (for indexing)                                                 |
| `parent`           | BIGINT                | Parent fileid (filesystem hierarchy)                                         |
| `name`             | VARCHAR(250)          | Filename (basename)                                                          |
| `mimetype`         | INT                   | FK → `oc_mimetypes.id`                                                       |
| `mimepart`         | INT                   | FK → `oc_mimetypes.id` (top-level MIME category)                             |
| `size`             | BIGINT                | File size in bytes (negative for folders = total children size)              |
| `mtime`            | BIGINT                | Modification timestamp (Unix epoch)                                          |
| `storage_mtime`    | BIGINT                | Modification time on the storage (may differ from mtime due to cache)        |
| `encrypted`        | INT                   | Server-side encryption status (0=not encrypted)                              |
| `unencrypted_size` | BIGINT                | Size before encryption                                                       |
| `etag`             | VARCHAR(40)           | Entity tag for caching/conflict detection                                    |
| `permissions`      | INT                   | Bitmask: 1=shared, 2=read, 4=write, 8=delete, 16=update, 32=create, 64=share |

**Index**: Unique on `(storage, path_hash)`.

This table serves as both the filesystem tree and the metadata cache. Folders are rows with `mimetype` pointing to `httpd/unix-directory`.

### `oc_storages` — Storage Backends

| Column       | Type                  | Description                                            |
| ------------ | --------------------- | ------------------------------------------------------ |
| `numeric_id` | BIGINT AUTO_INCREMENT | Numeric PK used as FK in filecache                     |
| `available`  | INT                   | Storage availability flag                              |
| `id`         | VARCHAR(64) unique    | Storage identifier (e.g., "local::/data/user1/files/") |

### `oc_mimetypes` — MIME Type Registry

| Column     | Type                | Description             |
| ---------- | ------------------- | ----------------------- |
| `id`       | INT AUTO_INCREMENT  | PK                      |
| `mimetype` | VARCHAR(255) unique | E.g., "application/pdf" |
| `icon`     | VARCHAR(255)        | Icon name for UI        |

---

### `oc_mounts` — External Storage Mounts

| Column        | Type          | Description              |
| ------------- | ------------- | ------------------------ |
| `id`          | BIGINT        | PK                       |
| `user_id`     | VARCHAR(64)   | User who owns this mount |
| `mount_id`    | VARCHAR(255)  | External storage id      |
| `mount_point` | VARCHAR(4000) | Path where mounted       |
| `storage_id`  | BIGINT        | FK → oc_storages         |

---

## Sharing Model

### `oc_share` — File/Folder Shares

| Column                   | Type                  | Description                                                                                    |
| ------------------------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| `id`                     | BIGINT AUTO_INCREMENT | PK                                                                                             |
| `share_type`             | INT                   | 0=user, 1=group, 2=public link, 3=email, 4=contact, 5=remote, 6=room, 7=user group, 8=external |
| `share_with`             | VARCHAR(255)          | Recipient (user, group, or email depending on type)                                            |
| `share_with_displayname` | VARCHAR(255)          | Display name cache                                                                             |
| `password`               | VARCHAR(255)          | Password for link shares (hashed)                                                              |
| `uid_owner`              | VARCHAR(64)           | User who created the share                                                                     |
| `uid_initiator`          | VARCHAR(64)           | User who initiated (may differ from owner via reshare)                                         |
| `parent`                 | BIGINT nullable       | Parent share ID (for group → user target shares)                                               |
| `item_type`              | VARCHAR(64)           | "file" or "folder"                                                                             |
| `item_source`            | VARCHAR(255)          | Source filecache fileid (string)                                                               |
| `item_target`            | VARCHAR(255)          | Target path for the recipient                                                                  |
| `file_source`            | BIGINT nullable       | Source filecache fileid (numeric)                                                              |
| `file_target`            | VARCHAR(4000)         | Target mount point name                                                                        |
| `permissions`            | INT                   | Bitmask (see filecache permissions)                                                            |
| `stime`                  | BIGINT                | Share creation timestamp                                                                       |
| `accepted`               | INT nullable          | Whether share was accepted                                                                     |
| `expiration`             | DATE nullable         | Expiration date                                                                                |
| `token`                  | VARCHAR(32)           | Public link token                                                                              |
| `mail_send`              | INT                   | Whether email notification was sent                                                            |
| `share_name`             | VARCHAR(64)           | Custom share name                                                                              |
| `parent_note`            | TEXT                  | Note attached to share                                                                         |

---

## Versioning Model

### Files Versioning app

Nextcloud uses the **Files Versioning** app. Older versions are stored as version files in storage, and current releases also keep version metadata in a dedicated `oc_files_versions` table:

- The current file lives at: `<storage>/files/<path>`
- Version files live at: `<storage>/files_versions/<path>.v<timestamp>`
- Version metadata is stored in `oc_files_versions`

### `oc_files_versions` — Version Metadata

| Column      | Type   | Description                 |
| ----------- | ------ | --------------------------- |
| `id`        | BIGINT | Auto PK                     |
| `file_id`   | BIGINT | Current file's filecache ID |
| `timestamp` | BIGINT | Version timestamp           |
| `size`      | BIGINT | Version file size           |
| `mimetype`  | BIGINT | MIME type ID                |
| `metadata`  | JSON   | Version metadata            |

Unique index: `(file_id, timestamp)`.

---

## Trashbin Model

### Files Trashbin app

Deleted files are moved to a `files_trashbin/` path within the same storage. Current releases also keep trash metadata in `oc_files_trash`:

- Original path is preserved
- Deletion timestamp appended to filename
- Restorable by moving back to original path and removing from trash storage

### `oc_files_trash` — Trash Metadata

| Column       | Type         | Description                 |
| ------------ | ------------ | --------------------------- |
| `auto_id`    | BIGINT       | Auto PK                     |
| `id`         | VARCHAR(250) | Trash item identifier       |
| `user`       | VARCHAR(64)  | User whose trashbin owns it |
| `timestamp`  | VARCHAR(12)  | Deletion timestamp          |
| `location`   | VARCHAR(512) | Original location           |
| `type`       | VARCHAR(4)   | File/folder type marker     |
| `mime`       | VARCHAR(255) | MIME type                   |
| `deleted_by` | VARCHAR(64)  | User who deleted the item   |

---

## Tags/Labels Model

### `oc_systemtag` — System Tags

| Column       | Type                  | Description               |
| ------------ | --------------------- | ------------------------- |
| `id`         | BIGINT AUTO_INCREMENT | PK                        |
| `name`       | VARCHAR(64) unique    | Tag name                  |
| `visibility` | INT                   | 0=hidden, 1=visible       |
| `editable`   | INT                   | 0=static, 1=user-editable |

### `oc_systemtag_object_mapping` — Tag ↔ Object Mapping

| Column        | Type        | Description                  |
| ------------- | ----------- | ---------------------------- |
| `objectid`    | VARCHAR(64) | Filecache fileid (as string) |
| `objecttype`  | VARCHAR(64) | Object type (always "files") |
| `systemtagid` | BIGINT      | FK → oc_systemtag            |

**Unique**: `(objectid, objecttype, systemtagid)`.

Tags are flat (no hierarchy). Nextcloud also supports **collaborative tags** via the Tags app, which adds a separate table.

---

## Activity/Logging Model

### `oc_activity` — Activity Stream

| Column          | Type                   | Description                                              |
| --------------- | ---------------------- | -------------------------------------------------------- |
| `activity_id`   | BIGINT AUTO_INCREMENT  | PK                                                       |
| `app`           | VARCHAR(255)           | App that generated the activity                          |
| `subject`       | VARCHAR(255)           | Subject key (translatable)                               |
| `subjectparams` | TEXT                   | JSON parameters for subject                              |
| `message`       | VARCHAR(255)           | Message key                                              |
| `messageparams` | TEXT                   | JSON parameters for message                              |
| `file`          | VARCHAR(4000) nullable | File path                                                |
| `link`          | VARCHAR(4000) nullable | Link to related object                                   |
| `object_type`   | VARCHAR(255) nullable  | Type of related object                                   |
| `object_id`     | VARCHAR(255) nullable  | ID of related object                                     |
| `type`          | VARCHAR(255)           | Activity type (file_created, file_changed, shared, etc.) |
| `timestamp`     | INT                    | Unix timestamp                                           |
| `priority`      | INT                    | Priority level                                           |
| `user`          | VARCHAR(64)            | User who performed the action                            |

### `oc_activity_mq` — Activity Mail Queue

| Column              | Type                  | Description            |
| ------------------- | --------------------- | ---------------------- |
| `mail_id`           | BIGINT AUTO_INCREMENT | PK                     |
| `amq_app`           | VARCHAR(255)          | App                    |
| `amq_subject`       | VARCHAR(255)          | Subject key            |
| `amq_subjectparams` | TEXT                  | Subject parameters     |
| `amq_affecteduser`  | VARCHAR(64)           | Notification recipient |
| `amq_timestamp`     | INT                   | Timestamp              |
| `amq_type`          | VARCHAR(255)          | Activity type          |
| `amq_latest_send`   | INT                   | Next email batch time  |

---

## Comments Model

### `oc_comments` — File Comments

| Column                   | Type                          | Description                  |
| ------------------------ | ----------------------------- | ---------------------------- |
| `id`                     | VARCHAR(64)                   | UUID                         |
| `parent_id`              | VARCHAR(64) nullable          | Parent comment for threading |
| `topmost_parent_id`      | VARCHAR(64) nullable          | Root comment of the thread   |
| `children_count`         | INT default 0                 | Cached reply count           |
| `message`                | TEXT                          | Comment text                 |
| `verb`                   | VARCHAR(64) default 'comment' | Activity verb                |
| `actor_type`             | VARCHAR(64)                   | "users" etc.                 |
| `actor_id`               | VARCHAR(64)                   | User ID                      |
| `object_type`            | VARCHAR(64)                   | "files" etc.                 |
| `object_id`              | VARCHAR(64)                   | Filecache fileid             |
| `creation_timestamp`     | DATETIME                      | When created                 |
| `latest_child_timestamp` | DATETIME nullable             | Latest reply time            |
| `expire_date`            | DATETIME nullable             | Auto-delete date             |

---

## Workflow Engine

### `oc_flow_operations` — Workflow Rules

| Column      | Type                  | Description                       |
| ----------- | --------------------- | --------------------------------- |
| `id`        | BIGINT AUTO_INCREMENT | PK                                |
| `class`     | VARCHAR(256)          | Operation implementation class    |
| `name`      | VARCHAR(256)          | Operation name                    |
| `checks`    | TEXT JSON             | Condition specification           |
| `operation` | TEXT JSON             | Operation configuration           |
| `entity`    | VARCHAR(256)          | Entity class, usually file entity |
| `events`    | TEXT                  | Events that trigger the rule      |

Checks are JSON arrays of conditions (e.g., file size, MIME type, user group matches). Scope is stored separately in `oc_flow_operations_scope` with `operation_id`, `type`, and `value`.

---

## Metadata/Custom Properties

### `oc_properties` — Arbitrary File Properties

| Column          | Type                  | Description                |
| --------------- | --------------------- | -------------------------- |
| `id`            | BIGINT AUTO_INCREMENT | PK                         |
| `userid`        | VARCHAR(64)           | Property owner             |
| `propertypath`  | VARCHAR(255)          | File path                  |
| `propertyname`  | VARCHAR(255)          | Property name (namespaced) |
| `propertyvalue` | TEXT                  | Property value             |
| `valuetype`     | SMALLINT              | Stored value type marker   |

This is a WebDAV property store — arbitrary key-value metadata per file path. Used for custom properties not covered by the core filecache.

---

## Retention / Auto-Deletion

Handled by the **Retention** app. Rules stored in app config:

| Concept        | Description                                                        |
| -------------- | ------------------------------------------------------------------ |
| Retention rule | Tag + duration → files with that tag are auto-deleted after N days |
| Retention job  | Background job scans tagged files and deletes expired ones         |

---

## Relationships Diagram

```
oc_storages ──┐
              │
              ▼
oc_filecache ◄──── oc_share (via file_source)
   │    │     │
   │    │     ├──► oc_systemtag_object_mapping ──► oc_systemtag (tags)
   │    │     │
   │    │     └──► oc_comments (via object_id)
   │    │
   │    ├──► oc_mounts (external storage mounts)
   │    │
   │    └──► oc_properties (arbitrary WebDAV metadata)
   │
    └──► Versions: stored under files_versions/ path + oc_files_versions metadata
    └──► Trash: stored under files_trashbin/ path + oc_files_trash metadata

oc_activity (standalone audit, keyed on user + file path)
```

---

## Upsides

1. **Simple core**: `oc_filecache` is the single source of truth for all files and folders. The schema is relatively easy to understand — it's a filesystem tree in a table.

2. **Permissions in metadata**: Permissions bitmask directly in `filecache` allows fast permission checks without joins. Bitmask operations are cheap.

3. **Flexible sharing**: The `oc_share` table supports 8+ share types (user, group, public link, email, remote, room, etc.) in a single unified model. Link shares with passwords and expiration are first-class.

4. **Versioning reuses file storage**: Version binaries live under a different path prefix, while `oc_files_versions` stores lightweight metadata keyed by current file ID and timestamp.

5. **Activity stream**: `oc_activity` records all significant file operations with i18n-ready subjects/messages and JSON parameters. It's a comprehensive audit trail.

6. **WebDAV native**: The `oc_properties` table allows any WebDAV property to be stored per file, enabling rich metadata without schema changes.

7. **System tags**: The tag system is simple and efficient — flat tags with visibility/editability flags, mapped to files via a junction table.

8. **Path-based indexing**: `path_hash` (MD5) enables fast lookups by path without storing the full path in the index.

9. **Multi-storage**: Each user can have their own storage backend, and external storages are mounted via `oc_mounts`. The same filecache schema handles everything.

10. **Massive ecosystem**: Nextcloud's app architecture means the core model is stable while apps (Metadata, FullTextSearch, OCR, Collabora, OnlyOffice, etc.) extend it without breaking the core.

## Downsides

1. **Not a DMS first**: Nextcloud is a file sync/share platform, not an EDMS. There's no document type concept, no metadata schema per type, no structured content versioning, no audit-grade compliance features.

2. **No document page model**: Files are opaque binaries. There's no page-level concept, no OCR text storage, no content extraction at the DB level.

3. **Path-based identity is fragile**: Moving a file changes its `path` and thus its `path_hash`. All references (`oc_share`, `oc_properties`, `oc_comments`) that use path or fileid must be updated. The `etag` helps detect stale caches but doesn't prevent race conditions.

4. **Flat tags only**: No tag hierarchy or nested classification. The tag system (`oc_systemtag`) is simple name-value with no parent/child or grouping.

5. **Versions are still storage-path oriented**: Even with `oc_files_versions`, version binaries live as files under `files_versions/`. Rich version metadata such as user-authored reason/comments is limited compared with dedicated DMS version objects.

6. **Comments are limited**: `oc_comments` supports threading but is basic. No rich text, no attachments, no resolution status, no inline annotations.

7. **Activity records are ephemeral**: `oc_activity` entries are designed for notifications, not compliance audit. They're regularly pruned. There's no immutable audit log.

8. **Share table duplication**: `share_type` with 8+ variants creates a complex table where different share types have different valid columns. Some columns are always null for certain share types.

9. **No document workflow state machine**: The `oc_flow_operations` table supports basic if-then rules (auto-tag, auto-move, notify) but there's no state machine for approval workflows, review cycles, or publication lifecycles.

10. **oc_properties is path-based, not fileid-based**: File properties are keyed on `propertypath` (string), not `fileid`. If a file is moved, property lookups may break unless the path is carefully updated.
