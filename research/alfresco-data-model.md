# Alfresco Data Model

> Source: [Alfresco/alfresco-community-repo](https://github.com/Alfresco/alfresco-community-repo)  
> Language: Java (Spring / custom repository)  
> Database: RDBMS (PostgreSQL, MySQL, Oracle) + custom node store  
> Last analyzed: 2026-04-22

## Architecture Overview

Alfresco uses a **content repository** architecture fundamentally different from Django-style ORMs. The data model is defined in **XML type/aspect definitions** (not database tables). The repository maps these onto a generic node-property store in the database. The core concept is:

- **Type**: Like a class — defines mandatory and optional properties
- **Aspect**: Like a mixin/interface — adds properties/associations to any node
- **Association**: Typed relationships between nodes (parent-child, peer-to-peer)
- **Property**: Typed data field with constraints, indexing, and default values

The entire model lives in `repository/src/main/resources/alfresco/model/contentModel.xml` (and related model files) and is compiled into the repository dictionary at runtime.

---

## Type Hierarchy

```
sys:base
  └── sys:container
        └── sys:store_root
  └── cm:cmobject
        ├── cm:folder
        │     └── cm:systemfolder
        ├── cm:content (THE core document type)
        │     └── cm:dictionaryModel
        │     └── cm:savedquery
        │     └── cm:thumbnail (deprecated)
        ├── cm:link
        ├── cm:category (for classification, with cm:subcategories child-assoc)
        └── cm:authority
              ├── cm:person
              └── cm:authorityContainer (groups)
```

### `sys:base` (System Base Type)

Mandatory aspects:

- `sys:referenceable` — adds `sys:node-uuid` and `sys:store-identifier` (gives every node a globally unique reference)
- `sys:localized` — adds `sys:locale` (multilingual support)

### `cm:cmobject` (Base Content Object)

| Property  | Type   | Description                                                                        |
| --------- | ------ | ---------------------------------------------------------------------------------- |
| `cm:name` | d:text | Mandatory, CMIS `cm:name`. Indexed atomically. Constrained by `cm:filename` regex. |

Mandatory aspect: `cm:auditable`.

### `cm:folder` (extends cm:cmobject)

| Child Association | Target   | Description                                      |
| ----------------- | -------- | ------------------------------------------------ |
| `cm:contains`     | sys:base | Hierarchical containment (folders contain items) |

`archive=true` — deleted folders go to archive store.

### `cm:content` (extends cm:cmobject)

| Property     | Type      | Description                                              |
| ------------ | --------- | -------------------------------------------------------- |
| `cm:content` | d:content | The actual binary content. Indexed for full-text search. |

This is the primary document type. `cm:content` is a special property type in Alfresco that stores binary data, metadata (MIME type, encoding, size), and content URL in a single logical field.

---

## Key Aspects (Mixins)

Aspects can be applied to any node, adding properties and associations.

### `cm:auditable` (Audit Trail on Every Node)

| Property      | Type       | Protected | Description                             |
| ------------- | ---------- | --------- | --------------------------------------- |
| `cm:created`  | d:datetime | Yes       | Creation timestamp. Facetable.          |
| `cm:creator`  | d:text     | Yes       | Creator username. Facetable.            |
| `cm:modified` | d:datetime | Yes       | Last modification timestamp. Facetable. |
| `cm:modifier` | d:text     | Yes       | Last modifier username. Facetable.      |
| `cm:accessed` | d:datetime | Yes       | Last access timestamp.                  |

**This is mandatory on `cm:cmobject`** — every node in the system has audit timestamps.

### `cm:titled`

| Property         | Type     | Description              |
| ---------------- | -------- | ------------------------ |
| `cm:title`       | d:mltext | Multilingual title       |
| `cm:description` | d:mltext | Multilingual description |

### `cm:author`

| Property    | Type   | Description     |
| ----------- | ------ | --------------- |
| `cm:author` | d:text | Document author |

### `cm:ownable`

| Property   | Type   | Description                        |
| ---------- | ------ | ---------------------------------- |
| `cm:owner` | d:text | Current owner username. Facetable. |

### `cm:versionable`

| Property                      | Type      | Description                                        |
| ----------------------------- | --------- | -------------------------------------------------- |
| `cm:autoVersion`              | d:boolean | Auto-version on content update (default: true)     |
| `cm:autoVersionOnUpdateProps` | d:boolean | Auto-version on property changes (default: false)  |
| `cm:initialVersion`           | d:boolean | Create initial version on creation (default: true) |

Version history is stored in a separate version store (not in the main node table). Each version is a frozen snapshot of the node's properties and content.

### `cm:dublincore`

Extends `cm:titled`. Adds:

| Property         | Type   | Description             |
| ---------------- | ------ | ----------------------- |
| `cm:publisher`   | d:text | Publisher. Facetable.   |
| `cm:contributor` | d:text | Contributor. Facetable. |
| `cm:type`        | d:text | DC type. Facetable.     |
| `cm:identifier`  | d:text | DC identifier           |
| `cm:dcsource`    | d:text | DC source               |
| `cm:coverage`    | d:text | DC coverage             |
| `cm:rights`      | d:text | DC rights               |
| `cm:subject`     | d:text | DC subject. Facetable.  |

### `cm:effectivity`

| Property  | Type       | Description                |
| --------- | ---------- | -------------------------- |
| `cm:from` | d:datetime | Effective from. Facetable. |
| `cm:to`   | d:datetime | Effective to. Facetable.   |

### `cm:complianceable`

| Property         | Type       | Description            |
| ---------------- | ---------- | ---------------------- |
| `cm:removeAfter` | d:datetime | Scheduled removal date |

Requires `cm:auditable`.

### `cm:summarizable`

| Property     | Type   | Description  |
| ------------ | ------ | ------------ |
| `cm:summary` | d:text | Summary text |

### `cm:countable`

| Property     | Type  | Description     |
| ------------ | ----- | --------------- |
| `cm:hits`    | d:int | Hit counter     |
| `cm:counter` | d:int | General counter |

### `cm:copiedfrom`

| Association   | Type         | Target      | Description                     |
| ------------- | ------------ | ----------- | ------------------------------- |
| `cm:original` | peer-to-peer | cm:cmobject | References the source of a copy |

### `cm:workingcopy` (Checkout/Lock)

| Property               | Type               | Description                            |
| ---------------------- | ------------------ | -------------------------------------- |
| `cm:workingCopyOwner`  | d:text (protected) | Username of the person who checked out |
| `cm:proposedInlineUrl` | d:text             | Proposed inline URL                    |

`archive=false` — working copies are not archived on deletion.

### `cm:replaceable`

| Association   | Type         | Target     | Description                    |
| ------------- | ------------ | ---------- | ------------------------------ |
| `cm:replaces` | peer-to-peer | cm:content | This document replaces another |

### `cm:referencing`

| Association     | Type         | Target     | Description       |
| --------------- | ------------ | ---------- | ----------------- |
| `cm:references` | peer-to-peer | cm:content | Generic reference |

### `cm:basable`

| Association | Type         | Target     | Description             |
| ----------- | ------------ | ---------- | ----------------------- |
| `cm:basis`  | peer-to-peer | cm:content | Base document reference |

### `cm:partable`

| Association | Type         | Target     | Description          |
| ----------- | ------------ | ---------- | -------------------- |
| `cm:parts`  | peer-to-peer | cm:content | Part-of relationship |

### `cm:templatable`

| Property      | Type      | Description                |
| ------------- | --------- | -------------------------- |
| `cm:template` | d:noderef | Reference to template node |

### `cm:lockable`

| Property        | Type                | Description                                  |
| --------------- | ------------------- | -------------------------------------------- |
| `cm:lockOwner`  | d:text              | Lock owner                                   |
| `cm:lockType`   | d:text              | Lock type (READ_ONLY_LOCK, WRITE_LOCK, etc.) |
| `cm:expiryDate` | d:datetime          | Lock expiration                              |
| `cm:lockNode`   | d:noderef(node ref) | Lock node reference                          |

---

## cm:person (User/Contact Model)

| Property                                           | Type                | Description              |
| -------------------------------------------------- | ------------------- | ------------------------ |
| `cm:userName`                                      | d:text              | Mandatory, unique        |
| `cm:homeFolder`                                    | d:noderef           | User's home folder       |
| `cm:firstName`                                     | d:text              | Mandatory                |
| `cm:lastName`                                      | d:text              | Mandatory                |
| `cm:middleName`                                    | d:text              |                          |
| `cm:email`                                         | d:text              |                          |
| `cm:organizationId`                                | d:text              | Organization. Facetable. |
| `cm:jobtitle`                                      | d:text              | Job title. Facetable.    |
| `cm:location`                                      | d:text              | Location. Facetable.     |
| `cm:telephone` / `cm:mobile`                       | d:text              | Phone                    |
| `cm:userStatus` / `cm:userStatusTime`              | d:text + d:datetime | Status message           |
| `cm:skype` / `cm:instantmsg` / `cm:googleusername` | d:text              | IM handles               |
| `cm:sizeCurrent` / `cm:sizeQuota`                  | d:long              | Quota (protected)        |

Association: `cm:avatar` → cm:content (profile picture).

---

## cm:category (Classification/Tagging)

```
cm:category_root → cm:categories (child-association) → cm:category
                                                          └── cm:subcategories (recursive child-assoc)
```

Categories form a tree. Documents are tagged via `cm:generalclassifiable` aspect which holds a list of `cm:category` references.

### `cm:generalclassifiable` aspect

| Association     | Target      | Description                       |
| --------------- | ----------- | --------------------------------- |
| `cm:categories` | cm:category | Categories/tags applied to a node |

---

## cm:mlRoot / cm:mlContainer (Multilingual)

| Type             | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `cm:mlRoot`      | Container for translations of a document                   |
| `cm:mlContainer` | Holds `cm:mlChild` (translated version) child associations |

Mandatory aspects: `cm:versionable`, `cm:author`, `sys:localized`.

---

## Versioning Model

Alfresco's versioning is aspect-based (`cm:versionable`). When versioning is active:

1. **Version History Store**: Separate from the main node store. Stores frozen snapshots of node state (properties + content).
2. **Version Type**: Each version has a version type (MAJOR, MINOR) and label (e.g., "1.0", "1.1").
3. **Auto-version Properties**:
   - `cm:autoVersion` — creates new version on content update
   - `cm:autoVersionOnUpdateProps` — creates new version on property changes
   - `cm:initialVersion` — creates a "1.0" version on first save

The version store is accessed via `VersionService` and not modeled as a first-class entity in the content model XML — it's a runtime-managed structure.

---

## Workflow Model

Defined in `workflowModel.xml`. Key types:

### `bpm:startTask`

| Property                | Type      | Description                                |
| ----------------------- | --------- | ------------------------------------------ |
| `bpm:taskId`            | d:text    | Workflow engine task ID                    |
| `bpm:description`       | d:text    | Task description                           |
| `bpm:dueDate`           | d:date    | Due date                                   |
| `bpm:priority`          | d:int     | Priority                                   |
| `bpm:completionPercent` | d:int     | Completion %                               |
| `bpm:comment`           | d:text    | Comment                                    |
| `bpm:status`            | d:text    | Task status                                |
| `bpm:package`           | d:noderef | Workflow package (collection of documents) |

### `bpm:activitiOutcomeTask`

| Property      | Type   | Description             |
| ------------- | ------ | ----------------------- |
| `bpm:outcome` | d:text | Task outcome/transition |

---

## Node Store (How It's Actually Stored)

Alfresco doesn't create a separate DB table per type/aspect. Instead, it uses the **Node Ref** pattern:

**Table: `alf_node`**

| Column           | Type         | Description                                                             |
| ---------------- | ------------ | ----------------------------------------------------------------------- |
| `id`             | BIGINT       | Internal PK                                                             |
| `uuid`           | VARCHAR(64)  | Node UUID                                                               |
| `node_type`      | VARCHAR(200) | Type qname (e.g., `{http://www.alfresco.org/model/content/1.0}content`) |
| `store_id`       | BIGINT       | Which store (workspace://, archive://, etc.)                            |
| `transaction_id` | BIGINT       | Creating transaction                                                    |
| `audit_created`  | TIMESTAMP    |                                                                         |
| `audit_creator`  | VARCHAR(200) |                                                                         |
| `audit_modified` | TIMESTAMP    |                                                                         |
| `audit_modifier` | VARCHAR(200) |                                                                         |

**Table: `alf_node_properties`**

| Column               | Type          | Description                       |
| -------------------- | ------------- | --------------------------------- |
| `id`                 | BIGINT        | PK                                |
| `node_id`            | BIGINT        | FK → alf_node                     |
| `qname_id`           | BIGINT        | FK → alf_qname (property name)    |
| `boolean_value`      | BOOLEAN       |                                   |
| `long_value`         | BIGINT        |                                   |
| `float_value`        | FLOAT         |                                   |
| `double_value`       | DOUBLE        |                                   |
| `string_value`       | VARCHAR(1024) |                                   |
| `serializable_value` | BLOB          | Java-serialized for complex types |
| `list_index`         | INT           | For multi-valued properties       |

This is the **sparse column pattern** — one row per property per node. Properties that aren't set simply don't have a row.

**Table: `alf_node_aspects`**

| Column     | Type   | Description                  |
| ---------- | ------ | ---------------------------- |
| `node_id`  | BIGINT | FK → alf_node                |
| `qname_id` | BIGINT | FK → alf_qname (aspect name) |

**Table: `alf_node_assoc`** (peer-to-peer associations)

| Column           | Type   | Description                 |
| ---------------- | ------ | --------------------------- |
| `id`             | BIGINT | PK                          |
| `source_node_id` | BIGINT | FK → alf_node               |
| `target_node_id` | BIGINT | FK → alf_node               |
| `assoc_type_id`  | BIGINT | FK → alf_qname (assoc type) |

**Table: `alf_child_assoc`** (parent-child associations)

| Column            | Type         | Description                  |
| ----------------- | ------------ | ---------------------------- |
| `id`              | BIGINT       | PK                           |
| `parent_node_id`  | BIGINT       | FK → alf_node                |
| `child_node_id`   | BIGINT       | FK → alf_node                |
| `assoc_type_id`   | BIGINT       | FK → alf_qname               |
| `child_node_name` | VARCHAR(255) | Name within parent           |
| `is_primary`      | BOOLEAN      | Primary child?               |
| `qname_ns_id`     | BIGINT       | Namespace for qualified name |

---

## Audit/logging

Alfresco has a dedicated **Audit Service** that records operations:

- **Audit Application**: Defined in XML, maps module + event path to recorded data
- **Audit Entry**: Stored in `alf_audit_entry` table with timestamp, user, values as JSON
- **Audit Values**: Individual property changes stored as `alf_audit_value`

Key audit paths include:

- `/alfresco-access/login/**` — Authentication events
- `/alfresco-access/transaction/**` — Read, create, update, delete, move, copy
- `/alfresco-access/owner/**` — Ownership changes

The audit system is **configurable and filterable** — not all events are recorded by default.

---

## Relationships Diagram

```
sys:base (required: sys:referenceable, sys:localized)
  └── cm:cmobject (required: cm:auditable)
        ├── cm:folder ──[cm:contains]──→ sys:base (hierarchy)
        └── cm:content ──[cm:content property]──→ (binary storage)

Aspects (applicable to any node):
  cm:auditable (created, creator, modified, modifier, accessed)
  cm:titled (title, description)
  cm:ownable (owner)
  cm:versionable (autoVersion, initialVersion)
  cm:dublincore (publisher, contributor, type, etc.)
  cm:effectivity (from, to)
  cm:complianceable (removeAfter)
  cm:generalclassifiable ──[cm:categories]──→ cm:category
  cm:lockable (lockOwner, lockType, expiryDate)
  cm:workingcopy (workingCopyOwner)
  cm:copiedfrom ──[cm:original]──→ cm:cmobject
  cm:templatable (template noderef)
  cm:referencing ──[cm:references]──→ cm:content
  cm:replaceable ──[cm:replaces]──→ cm:content
  cm:partable ──[cm:parts]──→ cm:content
  cm:author (author text)

Node Store Tables:
  alf_node ──→ alf_node_properties (sparse key-value)
  alf_node ──→ alf_node_aspects (which mixins apply)
  alf_node ──→ alf_node_assoc (peer-to-peer)
  alf_node ──→ alf_child_assoc (parent-child)
```

---

## Upsides

1. **Extreme flexibility**: The type/aspect system allows any combination of properties to be applied to any node. A document can acquire `cm:dublincore` metadata without changing its type. This is far more flexible than fixed-schema systems.

2. **Multilingual first-class**: `d:mltext` (multilingual text) is a native property type. `cm:mlContainer` and `cm:mlRoot` provide structured translation management built into the content model.

3. **Audit is mandatory on everything**: `cm:auditable` is a mandatory aspect on `cm:cmobject`, so every content node automatically tracks created/creator/modified/modifier/accessed. No opt-in needed.

4. **Versioning is deep and configurable**: Auto-versioning on content changes, property changes, or both. Version history stored separately from the "live" node. Version types (MAJOR/MINOR) and labels are built-in.

5. **Locking/checkout is aspect-based**: `cm:lockable` and `cm:workingcopy` provide cooperative and pessimistic locking. Pessimistic locks have owners and expiration dates.

6. **Rich association model**: Parent-child (`cm:contains`), peer-to-peer (`cm:references`, `cm:replaces`, `cm:basis`, `cm:parts`), and generic associations. All are typed and queryable.

7. **Category/classifier tree**: Hierarchical classification via `cm:category` with `cm:subcategories` recursive associations. Documents can have multiple categories.

8. **Full CMIS support**: The property model maps to CMIS (Content Management Interoperability Services), enabling standards-based integration with other ECM systems.

9. **Content URL abstraction**: The `cm:content` property type stores binary data separately from metadata, with content URL, MIME type, encoding, and size all managed by the repository. Different storage backends (filesystem, S3, etc.) are transparent.

10. **Database-agnostic sparse property storage**: The `alf_node_properties` table uses a sparse key-value pattern with typed columns, allowing the schema to remain fixed while the content model evolves endlessly.

## Downsides

1. **Massive complexity**: The type/aspect/association system creates a steep learning curve. Understanding how a node's properties are actually stored requires knowledge of multiple layers (content model XML → dictionary → node store → property table).

2. **No referential integrity at DB level**: The sparse property table means there's no foreign key from a `cm:owner` text value to the `cm:person` table. Node references (`d:noderef`) are stored as strings, not enforced FKs.

3. **Sparse property queries are slow**: Querying `alf_node_properties` for specific property values requires scanning the table or relying on Solr indexes. Complex joins across properties of the same node are expensive.

4. **Audit log completeness depends on configuration**: Unlike Paperless or Mayan where audit is always-on, Alfresco's audit system must be explicitly configured. Missing events if audit paths aren't defined.

5. **No document page-level model**: Alfresco treats content as opaque binary. There's no concept of pages, page-level OCR, or page-level versioning — unlike Mayan's granular `DocumentVersionPage` / `DocumentFilePage` model.

6. **Aspect explosion**: A document that needs Dublin Core, versioning, locking, classification, and effectivity has 5+ aspects applied. The node_aspects and node_properties tables become very wide. Debugging which aspects apply to a node is non-trivial.

7. **JVM dependency**: The entire repository is deeply Java-entrenched. Custom content models require XML deployment and JVM restarts. No Django-migration-style agility.

8. **Solr dependency for reasonable query performance**: The relational store is effectively write-optimized. Read queries against the property table scale poorly without Solr/Elasticsearch, which adds operational complexity.

9. **Version store is opaque**: Version history is stored via `VersionService` in a way that's not directly queryable via SQL. You must use the API to access version chains.

10. **XML model deployment is brittle**: Types and aspects defined in XML must be registered at system startup. Errors in model definition can prevent the entire repository from booting. No online schema migration in the traditional sense.
