# Document Management Systems — Data Model Research

Research into the data models of document management systems, both open source and closed source.

## Files

| File                                                       | System               | Type                        | Source                                                    |
| ---------------------------------------------------------- | -------------------- | --------------------------- | --------------------------------------------------------- |
| [paperless-ngx-data-model.md](paperless-ngx-data-model.md) | Paperless-ngx        | Open source (Python/Django) | Source code analysis                                      |
| [mayan-edms-data-model.md](mayan-edms-data-model.md)       | Mayan EDMS           | Open source (Python/Django) | Source code analysis                                      |
| [alfresco-data-model.md](alfresco-data-model.md)           | Alfresco Community   | Open source (Java/Spring)   | Source code analysis (contentModel.xml + systemModel.xml) |
| [nextcloud-data-model.md](nextcloud-data-model.md)         | Nextcloud Server     | Open source (PHP)           | Schema analysis from codebase and database docs           |
| [documize-data-model.md](documize-data-model.md)           | Documize Community   | Open source (Go)            | Source code analysis (Go structs)                         |
| [nuxeo-data-model.md](nuxeo-data-model.md)                 | Nuxeo                | Open source (Java/OSGi)     | Source code analysis (schema definitions, VCS tables)     |
| [sharepoint-data-model.md](sharepoint-data-model.md)       | Microsoft SharePoint | Closed source               | Public SQL schema docs, CSOM API, community resources     |
| [documentum-data-model.md](documentum-data-model.md)       | OpenText Documentum  | Closed source               | DQL reference, developer docs, community schema docs      |

## Depth of Analysis

Each file contains:

1. **Full data model** — all entities, fields, types, and relationships relevant to documents, versions, audit trails, metadata, workflows, and permissions. Auth/user models are excluded.
2. **Upsides and downsides** — honest assessment of each system's data model strengths and weaknesses from an architectural perspective.

## Not Yet Included

- **OpenKM** — Java-based, JCR-backed. Well-known but relatively small community.
- **SeedDMS** — PHP-based, fork of LetoDMS. Very simple flat-file model.
- **LogicalDOC** — Java-based, commercial with community edition.
- **Box** — Cloud-only, API-documented but no public schema.
- **M-Files** — Commercial, metadata-driven vault model. Limited public schema info.
- **Apache Jackrabbit Oak** — JCR reference implementation, used under the hood by many Java CMS products. Worth including as a "pure" JCR model.

These can be added in a follow-up if needed.
