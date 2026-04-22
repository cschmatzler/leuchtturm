# OpenText Documentum Data Model (Public Schema Information)

> Not open source. Schema information derived from EMC/Opentext public documentation, developer guides, DQL references, and community resources.  
> Database: Oracle, SQL Server, PostgreSQL (via D2/DAR)  
> Last analyzed: 2026-04-22

## Architecture Overview

Documentum is one of the oldest and most enterprise-grade ECM/DMS platforms. Its data model is built on the **Documentum Repository**, which uses a **relational-object** hybrid approach:

- **Types** correspond to database tables
- **Objects** (instances of types) correspond to rows
- **Attributes** correspond to columns
- **Relationships** are tracked via Relation objects or repeating attribute tables

The repository is accessed via DQL (Documentum Query Language), which is SQL-like with extensions for document-specific operations.

---

## Core Type Hierarchy

```
dm_sysobject (abstract base)
  ├── dm_document (generic document)
  │     ├── dm_xml_document
  │     └── dm_plugin
  ├── dm_folder (container)
  │     ├── dm_cabinet (root folder)
  │     └── dm_xml_application
  ├── dm_note (annotation/comment)
  └── ...

dm_into (due to inherit from dm_sysobject):
  ├── dmc_richtext_attribute
  ├── dmc_application
  ├── dmc_jar
  ├── dmc_dropzone_folder
  └── dmc_transformation

Lifecycle/BPM types:
  ├── dm_policy (lifecycle definition)
  ├── dm_state (lifecycle state)
  ├── dm_process (workflow definition)
  ├── dm_activity (workflow activity)
  └── dm_workitem (workflow task)
```

---

## dm_sysobject (The Base Type)

Every document-like object inherits from `dm_sysobject`. The corresponding table is typically `dm_sysobject_s` (single-valued attributes) and `dm_sysobject_r` (repeating/multi-valued attributes).

### dm_sysobject_s (Single-valued attributes)

| Column                    | Type          | Description                                    |
| ------------------------- | ------------- | ---------------------------------------------- |
| `r_object_id`             | VARCHAR(16)   | Object ID (hex, globally unique)               |
| `object_name`             | VARCHAR(255)  | Display name                                   |
| `r_object_type`           | VARCHAR(64)   | Type name (e.g., "dm_document")                |
| `title`                   | VARCHAR(400)  | Title                                          |
| `subject`                 | VARCHAR(400)  | Subject                                        |
| `keywords`                | VARCHAR(2000) | Comma-separated keywords                       |
| `authors`                 | VARCHAR(2000) | Comma-separated authors                        |
| `r_creation_date`         | DATETIME      | Creation date (system-maintained)              |
| `r_modify_date`           | DATETIME      | Last modification date (system-maintained)     |
| `r_creation_date`         | DATETIME      | Alias: creation date                           |
| `r_modifier`              | VARCHAR(64)   | Last modifier username                         |
| `r_creator`               | VARCHAR(64)   | Creator username                               |
| `r_version_label`         | VARCHAR(64)   | Version label(s) in \_r table                  |
| `r_lock_owner`            | VARCHAR(64)   | Checkout owner                                 |
| `r_lock_date`             | DATETIME      | Lock acquisition date                          |
| `r_lock_machine`          | VARCHAR(64)   | Machine holding the lock                       |
| `r_policy_id`             | VARCHAR(16)   | FK → dm_policy (lifecycle)                     |
| `r_current_state`         | INT           | Current lifecycle state number                 |
| `i_contents_id`           | VARCHAR(16)   | FK → dmr_content (content descriptor)          |
| `i_folder_id`             | VARCHAR(16)   | FK → dm_folder (in \_r table for multi-folder) |
| `i_reference_cnt`         | INT           | Reference count                                |
| `a_is_hidden`             | BOOLEAN       | Hidden flag                                    |
| `a_storage_type`          | VARCHAR(32)   | Storage type (filestore, etc.)                 |
| `a_content_type`          | VARCHAR(64)   | MIME type hint                                 |
| `r_object_type`           | VARCHAR(64)   | Type (dm_document, etc.)                       |
| `a_application_type`      | VARCHAR(64)   | Application that created this                  |
| `a_status`                | VARCHAR(16)   | Custom status field                            |
| `a_compound_architecture` | VARCHAR(16)   | "assembly" or "virtual"                        |
| `a_link_cnt`              | INT           | Number of links (folder references)            |
| `a_archive`               | BOOLEAN       | Whether archived                               |
| `a_special_app`           | VARCHAR(64)   | Special application context                    |
| `i_is_reference`          | BOOLEAN       | Whether this is a reference (shortcut)         |
| `r_cabinet_id`            | VARCHAR(16)   | Cabinet containing this object                 |
| `r_virtual_path`          | VARCHAR(255)  | Virtual document path                          |

### dm_sysobject_r (Repeating attributes)

| Column               | Type         | Description                                       |
| -------------------- | ------------ | ------------------------------------------------- |
| `r_object_id`        | VARCHAR(16)  | FK → dm_sysobject_s                               |
| `i_position`         | INT          | Position index (for ordering)                     |
| `r_version_label`    | VARCHAR(64)  | Version labels (multiple: "1.0", "CURRENT", etc.) |
| `r_folder_id`        | VARCHAR(16)  | Folder IDs (multi-folder)                         |
| `authors`            | VARCHAR(200) | Authors (one per row)                             |
| `keywords`           | VARCHAR(200) | Keywords (one per row)                            |
| `r_alias_value`      | VARCHAR(200) | Alias values                                      |
| `r_accessor_name`    | VARCHAR(64)  | ACL accessor names                                |
| `r_accessor_permit`  | INT          | Permission levels                                 |
| `r_accessor_xpermit` | INT          | Extended permissions                              |

**Key insight**: Documentum uses a **dual-table pattern** — `_s` for single-valued attributes and `_r` for repeating/multi-valued attributes. Every custom type follows this pattern.

---

## dm_document

Extends `dm_sysobject` with document-specific behavior. In the database, this typically means adding `dm_document_s` and `dm_document_r` tables (which may or may not have additional columns beyond what `dm_sysobject` provides — in many configurations, Documentum maps `dm_document` to the same tables as `dm_sysobject`).

Key conceptual additions:

- Content is referenced via `i_contents_id` → `dmr_content`
- Version labels are stored in `r_version_label` (repeating)
- A document can be linked to multiple folders (`r_folder_id` is repeating)

---

## dmr_content (Content Storage)

| Column         | Type         | Description                       |
| -------------- | ------------ | --------------------------------- |
| `r_object_id`  | VARCHAR(16)  | Content object ID                 |
| `parent_id`    | VARCHAR(16)  | FK → dm_sysobject                 |
| `data_ticket`  | INT/STRING   | Storage system reference          |
| `i_format`     | VARCHAR(32)  | Format name (e.g., "pdf", "msw8") |
| `i_rendition`  | INT          | 0=primary, 1+=rendition           |
| `i_page`       | INT          | Page number (0=all)               |
| `i_vstamp`     | INT          | Version stamp                     |
| `full_format`  | VARCHAR(32)  | Format name                       |
| `content_size` | INT          | Size in bytes                     |
| `set_client`   | BOOLEAN      | Client-side content flag          |
| `set_time`     | DATETIME     | Content set timestamp             |
| `set_file`     | VARCHAR(255) | Original path of stored file      |
| `set_page`     | INT          |                                   |
| `set_append`   | BOOLEAN      |                                   |

**Key concept**: A single `dm_sysobject` can have multiple `dmr_content` entries — one for each format rendition and page. The `i_rendition` value (0=primary, 1+=rendition) manages multi-format storage.

---

## dm_folder / dm_cabinet

### dm_folder (extends dm_sysobject)

| Column                        | Type         | Description             |
| ----------------------------- | ------------ | ----------------------- |
| (all dm_sysobject attributes) |              |                         |
| `r_folder_path`               | VARCHAR(740) | Repeating: full path(s) |

### dm_cabinet

A cabinet is a top-level folder. It has all `dm_folder` attributes plus:

| Column       | Type        | Description            |
| ------------ | ----------- | ---------------------- |
| `is_private` | BOOLEAN     | User's private cabinet |
| `owner_name` | VARCHAR(64) | Owner                  |

---

## Versioning

Documentum uses a **version tree** model:

- **Immutable versions**: Once a version is created, it cannot be modified. New versions create new `r_object_id` values.
- **Version label**: The repeating `r_version_label` stores multiple labels:
  - Numeric: "1.0", "1.1", "2.0"
  - Symbolic: "CURRENT", "DRAFT", "APPROVED"
- **`i_antecedent_id`**: Points to the previous version's `r_object_id`
- **`r_version_label[0]`**: Always the symbolic "CURRENT" or similar label for latest

The version chain is: `version 1.0 (antecedent=null)` → `version 1.1 (antecedent=1.0)` → `version 2.0 (antecedent=1.1)`.

---

## Lifecycles

### dm_policy (Lifecycle Definition)

| Column            | Type                | Description                            |
| ----------------- | ------------------- | -------------------------------------- |
| `r_object_id`     | VARCHAR(16)         |                                        |
| `object_name`     | VARCHAR(255)        | Policy name                            |
| `description`     | VARCHAR(400)        |                                        |
| `r_current_state` | INT                 | Current state                          |
| `state_name`      | VARCHAR(64)         | State names (repeating)                |
| `state_no`        | INT                 | State numbers (repeating)              |
| `allow_attach`    | BOOLEAN (repeating) | Can objects be attached in this state? |
| `allow_detach`    | BOOLEAN (repeating) | Can objects be detached?               |
| `allow_browse`    | BOOLEAN (repeating) | Can objects be read?                   |
| `entry_criteria`  | VARCHAR(2000)       | Per-state entry criteria (repeating)   |
| `user_action`     | VARCHAR(2000)       | Per-state action scripts               |
| `action_type`     | INT (repeating)     | Action types                           |
| `next_state`      | INT (repeating)     | Transition targets                     |

### Lifecycle State Transitions

Users can transition documents through lifecycle states via `dmAPI` or DQL:

```sql
EXECUTE do_method FOR dm_policy OBJECT WHERE r_object_id = 'policy_id'
```

---

## Workflow / BPM

### dm_process (Workflow Process Definition)

| Column         | Type         | Description       |
| -------------- | ------------ | ----------------- |
| `r_object_id`  | VARCHAR(16)  |                   |
| `object_name`  | VARCHAR(255) | Process name      |
| `process_type` | INT          | 0=Standard, 1=Web |

### dm_activity (Workflow Activity)

| Column             | Type                      | Description                       |
| ------------------ | ------------------------- | --------------------------------- |
| `r_object_id`      | VARCHAR(16)               |                                   |
| `object_name`      | VARCHAR(255)              | Activity name                     |
| ` performer_type`  | INT                       | Who performs (user, group, alias) |
| `r_performer_name` | VARCHAR(64) (repeating)   | Performer(s)                      |
| `a_condition`      | VARCHAR(2000) (repeating) | Transition conditions             |
| `r_trigger_type`   | INT (repeating)           | Trigger type                      |

### dm_workitem (Task Instance)

| Column             | Type        | Description                 |
| ------------------ | ----------- | --------------------------- |
| `r_object_id`      | VARCHAR(16) |                             |
| `r_workflow_id`    | VARCHAR(16) | FK → dm_workflow            |
| `r_act_type_id`    | VARCHAR(16) | FK → dm_activity            |
| `r_performer_name` | VARCHAR(64) | Assigned user               |
| `r_priority`       | INT         | Priority                    |
| `r_date_sent`      | DATETIME    | When task was assigned      |
| `r_date_due`       | DATETIME    | Due date                    |
| `r_status`         | VARCHAR(16) | "started", "finished", etc. |

### dm_workflow (Workflow Instance)

| Column            | Type                | Description     |
| ----------------- | ------------------- | --------------- |
| `r_object_id`     | VARCHAR(16)         |                 |
| `process_id`      | VARCHAR(16)         | FK → dm_process |
| `r_start_date`    | DATETIME            |                 |
| `r_end_date`      | DATETIME (nullable) |                 |
| `r_runtime_state` | INT                 | State           |

---

## Annotations

### dm_note (extends dm_sysobject)

| Column                        | Type         | Description              |
| ----------------------------- | ------------ | ------------------------ |
| (all dm_sysobject attributes) |              |                          |
| `r_object_type`               | = 'dm_note'  |                          |
| `i_is_reference`              | = 0          | Notes are not references |
| `a_clb_content`               | VARCHAR(255) | Annotation text content  |

Notes are linked to their parent document via the `i_folder_id` pointing to the document's annotation folder, or via the `i_antecedent_id`.

---

## Relations

### dm_relation (Generic Relationship Object)

| Column          | Type        | Description                               |
| --------------- | ----------- | ----------------------------------------- |
| `r_object_id`   | VARCHAR(16) |                                           |
| `relation_name` | VARCHAR(64) | Relationship type name                    |
| `parent_id`     | VARCHAR(16) | Source object ID                          |
| `child_id`      | VARCHAR(16) | Target object ID                          |
| `child_label`   | VARCHAR(64) | Label for the relationship                |
| `permanent`     | BOOLEAN     | Whether relation survives version changes |
| `order_no`      | INT         | Ordering within the relation              |

Predefined relation names include:

- `DM_RELATION_VERSION` — version chain
- `DM_RELATION_RENDITION` — format conversions
- `DM_RELATION_ANNOTATION` — document ↔ note
- `DM_RELATION_BASE_DOCUMENT` — virtual document components
- Custom relations for any business purpose

---

## Security / ACL Model

### dm_acl (Access Control List)

| Column               | Type                    | Description                                         |
| -------------------- | ----------------------- | --------------------------------------------------- |
| `r_object_id`        | VARCHAR(16)             |                                                     |
| `object_name`        | VARCHAR(255)            | ACL name                                            |
| `r_accessor_name`    | VARCHAR(64) (repeating) | User/group names                                    |
| `r_accessor_permit`  | INT (repeating)         | Permission levels (see below)                       |
| `r_accessor_xpermit` | INT (repeating)         | Extended permissions                                |
| `r_accessor_type`    | INT (repeating)         | 0=user, 1=group, 2=role, 3=owner, 4=world, 5=system |
| `description`        | VARCHAR(400)            |                                                     |

**Permission levels**:

- 1=NONE
- 2=BROWSE (Read metadata)
- 3=READ (Read content)
- 4=RELATE (Create relations)
- 5=VERSION (Check out/in)
- 6=WRITE (Edit metadata)
- 7=DELETE (Delete)

**Extended permissions** (bitmask in `r_accessor_xpermit`):

- CHANGE_LOCATION, CHANGE_STATE, CHANGE_PERMIT, CHANGE_OWNER, CHANGE_FOLDER, CONTINUE_SEARCH

ACLs are assigned to objects via `r_object_type.acl_name` or explicitly via `i_retain_acl_domain`.

---

## Audit Trail

### dmr_containment (Content vs. Audit — dmr_prefix = repository metadata)

Documentum's audit trail is stored in the `dm_audittrail` (or `dmi_audit` in some configurations):

### dm_audittrail / dmi_audit

| Column                        | Type          | Description                                                                                             |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `r_object_id`                 | VARCHAR(16)   | Audit entry ID                                                                                          |
| `event_name`                  | VARCHAR(64)   | Event type (dm_create, dm_save, dm_destroy, dm_checkout, dm_checkin, dm_move, dm_link, dm_unlink, etc.) |
| `user_name`                   | VARCHAR(64)   | User who performed action                                                                               |
| `event_date`                  | DATETIME      | When                                                                                                    |
| `audited_obj_id`              | VARCHAR(16)   | Object that was affected                                                                                |
| `object_type`                 | VARCHAR(64)   | Type of the affected object                                                                             |
| `string_1` through `string_6` | VARCHAR(200)  | Event-specific string data                                                                              |
| `id_1` through `id_3`         | VARCHAR(16)   | Event-specific object IDs                                                                               |
| `int_1` through `int_4`       | INT           | Event-specific integers                                                                                 |
| `time_1` through `time_3`     | DATETIME      | Event-specific timestamps                                                                               |
| `old_value`                   | VARCHAR(200)  | Previous attribute value                                                                                |
| `new_value`                   | VARCHAR(200)  | New attribute value                                                                                     |
| `r_object_type`               | VARCHAR(64)   | Type of audited object                                                                                  |
| `message`                     | VARCHAR(4000) | Descriptive message                                                                                     |

Audit events are registered per type and per attribute, allowing fine-grained audit of specific field changes.

---

## Virtual Documents

### Compound Architecture

Documents with `a_compound_architecture = 'assembly'` are **virtual documents** (compound documents). Their components are tracked via `dmr_containment`:

| Column               | Type        | Description                   |
| -------------------- | ----------- | ----------------------------- |
| `r_object_id`        | VARCHAR(16) |                               |
| `parent_id`          | VARCHAR(16) | Parent (assembly) object      |
| `component_id`       | VARCHAR(16) | Child component object        |
| `order_no`           | INT         | Component order               |
| `child_label`        | VARCHAR(64) | Label                         |
| `use_node_ver_label` | BOOLEAN     | Whether version label is used |
| `version_label`      | VARCHAR(64) | Which version of component    |

---

## Relationships Diagram

```
dm_sysobject_s + dm_sysobject_r  (base object table)
  │
  ├── dm_document (extends dm_sysobject)
  │     ├── Content: dmr_content (1:N by parent_id)
  │     │     └── data_ticket → filestore/blob
  │     │
  │     ├── Folders: r_folder_id (repeating) → dm_folder
  │     │     └── dm_folder → dm_cabinet (root)
  │     │
  │     ├── ACL: acl_name → dm_acl
  │     │     └── r_accessor_name[], r_accessor_permit[] (permissions)
  │     │
  │     ├── Lifecycle: r_policy_id → dm_policy
  │     │     └── r_current_state → state_name, entry_criteria
  │     │
  │     ├── Version Chain: i_antecedent_id → previous version
  │     │
  │     ├── Relations: dm_relation (parent_id, child_id, relation_name)
  │     │     └── Custom: any relation type
  │     │
  │     ├── Annotations: dm_note (via i_folder_id or relation)
  │     │
  │     └── Containment: dmr_containment (for virtual documents)
  │           └── component_id → child dm_sysobject

dm_process → dm_activity → dm_workflow → dm_workitem (workflow)
dm_audittrail (event: dm_create, dm_save, dm_destroy, dm_checkout, etc.)
```

---

## Upsides

1. **Mature and proven**: Documentum has been in production for 30+ years at massive scale (Fortune 500, government). The data model has been refined through decades of enterprise use.

2. **Dual-table pattern for repeating values**: The `_s` (single-valued) and `_r` (repeating-valued) table pattern cleanly handles multi-valued attributes (authors, keywords, folder paths, ACL entries) without separate junction tables.

3. **Comprehensive versioning**: Immutable version objects with antecedent chains, symbolic version labels ("CURRENT", "APPROVED" alongside "2.1"), and full version tree support.

4. **Virtual documents**: Compound document architecture (`a_compound_architecture='assembly'`) with `dmr_containment` allows documents to contain other documents as components, with version-specific binding.

5. **Lifecycle state machines**: `dm_policy` with per-state entry criteria, transition actions, and permission controls provides a full lifecycle engine integrated into the data model.

6. **Fine-grained audit**: `dm_audittrail` records every significant event, with event-specific columns (`string_1..6`, `id_1..3`, `int_1..4`, `time_1..3`) and `old_value`/`new_value` for attribute changes.

7. **Multi-format renditions**: `dmr_content` with `i_rendition` and `i_format` supports storing the same document in multiple formats (PDF, HTML, thumbnail) alongside the primary content.

8. **Generic relation model**: `dm_relation` with arbitrary `relation_name` allows any type of link between any two objects without schema changes.

9. **Powerful ACL model**: The `dm_acl` with accessor types (user, group, role, owner, world) and extended permissions (CHANGE_STATE, CHANGE_PERMIT, etc.) provides enterprise-grade access control.

10. **Storage abstraction**: `data_ticket` in `dmr_content` abstracts the actual file location. Documents can be on filesystem, object storage, or encrypted stores without changing the data model.

## Downsides

1. **Extremely complex**: The data model has been growing since the 1990s. Understanding all the `_s`/`_r` table pairs, `dmr_` metadata tables, and `dmi_` internal tables requires significant expertise.

2. **16-character object IDs**: `r_object_id` is a 16-character hex string encoding type information. These are not standard UUIDs and require Documentum APIs to generate or decode.

3. **Repeating attributes require joins**: To query a document's authors or keywords, you must join `_s` and `_r` tables. This makes even simple queries complex and slow for objects with many repeating attributes.

4. **Proprietary and expensive**: Documentum is a commercial product with significant licensing costs. The on-premises deployment requires Oracle or SQL Server, application servers, and specialized admin skills.

5. **DQL is not SQL**: Documentum Query Language (DQL) is needed for many operations and doesn't support all SQL constructs. Direct SQL access is unsupported and risks breaking the repository.

6. **No native page model**: Like Alfresco and SharePoint, Documentum treats files as opaque binaries. Page-level content extraction and versioning are not in the core model.

7. **Type system rigidity**: Adding new types requires deploying DMCL scripts or DAR packages. Type changes can invalidate existing objects. The `r_object_type` is stored as a string, limiting the type hierarchy depth.

8. **Virtual document performance**: The `dmr_containment` model for virtual documents can become very wide for compound documents, leading to slow queries and complex version resolution.

9. **Audit trail storage growth**: `dm_audittrail` can grow very large in active systems. Without archiving, it impacts query performance. The event-specific columns (`string_1..6`) make the schema brittle — new event types may need more columns.

10. **ACL complexity**: The permission model with basic levels (1-7) plus extended permissions (bitmask) plus accessor types is powerful but extremely difficult to reason about. Debugging "why can't user X see document Y" often requires tracing through multiple ACLs, groups, and inheritance chains.
