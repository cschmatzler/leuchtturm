# Email app research, architecture decisions, and product constraints

This document captures the research on Mail0 and Superhuman, the product constraints, and the architecture decisions for turning this repository into an email application.

It covers:

- the original goal
- what external projects were researched
- what those projects actually do
- what constraints were decided for this project
- what architecture is recommended
- what was explicitly rejected
- what remains deferred to later phases

---

## 1. Original goal

The goal is to turn this project into an email app that:

- syncs email from external providers
- shows mail in the UI via **Zero**
- exposes mail data through the backend using **Drizzle**
- has an **adapter layer** so different providers eventually write into the same canonical storage model

The minimum provider target is:

- **Gmail**

A strongly desired provider target is:

- **iCloud Mail**, which is expected to require **IMAP**

The original research request also explicitly asked for:

- looking at how **0.email / Mail0** is built, since it is open source
- figuring out what is publicly knowable about **Superhuman**
- not making decisions silently when important ambiguity exists

---

## 2. Project context in this repository

Before adding mail support, the local codebase is essentially mail-greenfield.

Relevant local files inspected:

- `packages/zero/src/schema.ts`
- `packages/zero/src/queries.ts`
- `packages/zero/src/mutators.ts`
- `packages/core/src/drizzle/index.ts`
- `packages/core/src/auth/auth.sql.ts`
- `packages/core/src/auth/schema.ts`
- `apps/api/src/handlers/zero.ts`

### What those files show

#### Zero schema is currently minimal

`packages/zero/src/schema.ts` currently only defines a `user` table in the Zero schema.

#### Zero queries are currently minimal

`packages/zero/src/queries.ts` currently only exposes a `currentUser` query.

#### Zero mutators are currently user-focused

`packages/zero/src/mutators.ts` is currently just user mutators.

#### Drizzle is currently auth-focused

`packages/core/src/drizzle/index.ts` wires up a Postgres database service using `authRelations` from `packages/core/src/auth/auth.sql.ts`.

#### API-side Zero plumbing already exists

`apps/api/src/handlers/zero.ts` already handles Zero query and mutation requests using `zeroDrizzle(...)`.

### Conclusion from local repo inspection

This repo already has the right infrastructure shape for:

- Postgres via Drizzle
- API handlers
- Zero sync

But it does **not** yet have a mail data model.

That is good news: the mail design can be introduced cleanly rather than retrofitted into a messy existing subsystem.

---

## 3. External research: Mail0 / 0.email

### How the repo was inspected

The public repository fetched and inspected was:

- `Mail-0/Zero`

The most relevant files inspected were:

- `README.md`
- `apps/server/src/lib/driver/types.ts`
- `apps/server/src/lib/driver/index.ts`
- `apps/server/src/lib/driver/google.ts`
- `apps/server/src/lib/driver/microsoft.ts`
- `apps/server/src/lib/server-utils.ts`
- `apps/server/src/lib/auth-providers.ts`
- `apps/server/src/lib/factories/base-subscription.factory.ts`
- `apps/server/src/lib/factories/google-subscription.factory.ts`
- `apps/server/src/lib/factories/outlook-subscription.factory.ts`
- `apps/server/src/db/schema.ts`
- `apps/server/src/routes/agent/db/schema.ts`
- `apps/server/src/routes/agent/db/index.ts`
- `apps/server/src/routes/agent/index.ts`
- `apps/server/src/routes/agent/sync-worker.ts`
- `apps/server/src/workflows/sync-threads-workflow.ts`
- `apps/server/src/workflows/sync-threads-coordinator-workflow.ts`
- `apps/server/src/types.ts`

### High-level summary

Mail0 is useful as a reference for:

- a provider adapter boundary
- Gmail-first sync design
- building a fast read model rather than querying providers live for every UI interaction

Mail0 is **not** a finished, trustworthy reference for:

- a complete multi-provider architecture
- IMAP support
- a fully generalized common-denominator email model

### Important findings

#### 3.1 Mail0 has a real provider interface

`apps/server/src/lib/driver/types.ts` defines a `MailManager` abstraction with methods like:

- list
- get
- create draft
- send draft
- labels
- attachment fetch
- history
- mark read/unread

`apps/server/src/lib/driver/index.ts` chooses a provider implementation.

This is worth copying conceptually.

#### 3.2 Mail0 is Gmail-first in practice

Even though there is a Microsoft driver in the public repo, the repo is still clearly Gmail-centric.

Evidence:

- Gmail push subscription is implemented in:
  - `apps/server/src/lib/factories/google-subscription.factory.ts`
- Gmail incremental history sync is implemented in:
  - `apps/server/src/lib/driver/google.ts`
- Outlook subscription support is explicitly not implemented:
  - `apps/server/src/lib/factories/outlook-subscription.factory.ts`
  - it throws `Outlook subscription not implemented yet`
- Microsoft auth wiring is commented out in:
  - `apps/server/src/lib/auth-providers.ts`
- One sync workflow hardcodes:
  - `providerId: 'google'`
  - in `apps/server/src/workflows/sync-threads-workflow.ts`

So the public Mail0 repo should be treated as:

- **good reference for boundaries and storage patterns**
- **not proof that their multi-provider story is complete**

#### 3.3 Mail0 does not use one universal SQL table for everything

Mail0 splits storage between:

1. **queryable metadata** in SQLite tables inside Durable Objects
2. **full thread payload JSON** in object storage (`THREADS_BUCKET`, backed by R2)

Evidence:

- Hot query store schema:
  - `apps/server/src/routes/agent/db/schema.ts`
- Full thread payload written to object storage:
  - `apps/server/src/routes/agent/sync-worker.ts`
- Full thread payload read back from object storage:
  - `apps/server/src/routes/agent/index.ts`

The hot SQLite schema stores fields like:

- thread id
- provider id
- latest sender
- latest received timestamp
- latest subject

It does **not** store full message bodies in the hot store.

This is the most important architectural lesson from Mail0:

> Keep the fast read model smaller than the full provider payload.

However, this project later made a different decision: **all synced bodies must live in Zero**. So Mail0's exact storage split is informative, but not directly reusable.

#### 3.4 Mail0's Outlook model is weaker than Gmail's model

`apps/server/src/lib/driver/microsoft.ts` fetches from Microsoft Graph using mailbox/messages APIs and does not appear to model true native conversation/thread parity with Gmail.

The Outlook side behaves more like:

- list messages from folders
- treat message payloads as the core unit

That reinforces a broader lesson:

> Providers have different native concepts. The architecture should not force fake equivalence.

#### 3.5 Mail0 has no IMAP implementation in the public repo

Searches in their TypeScript / JavaScript / Markdown source did not find an IMAP implementation.

This means Mail0 is **not** a useful reference for iCloud Mail specifically.

### Mail0 README signals

Mail0's README also states:

- it integrates with Gmail and other providers
- it stores user emails in Durable Objects and an R2 bucket
- sync is now structured around that split

This is consistent with the code findings above.

### Final interpretation of Mail0

What is worth borrowing:

- provider adapter boundary
- explicit sync workers / workflows
- building a read model for UI

What is **not** worth borrowing directly:

- bodies fetched indirectly from object storage on open
- assuming a complete provider-neutral model already exists
- assuming Outlook/Microsoft parity is done

---

## 4. External research: Superhuman

Superhuman is closed source, so only public information could be used.

### How it was inspected

The most useful public source was the Superhuman help center API.

Relevant public docs inspected included:

- `Superhuman Mail for Gmail`
- `Superhuman Mail for Outlook`
- `Managing Accounts`
- `Troubleshooting Login Issues`
- `Gmail Rate-Limiting`
- `Labels (Gmail Accounts)`
- `Offline Access`

### High-level summary

Superhuman's public docs strongly suggest:

- they are **provider-API-first**, not IMAP-first
- they support **Google-hosted** and **Microsoft 365-hosted** mailboxes
- they do **not** treat all providers as identical under the hood
- Gmail-specific behavior remains Gmail-specific

### Important findings

#### 4.1 Superhuman only publicly supports Google and Microsoft 365 hosted accounts

In `Troubleshooting Login Issues`, Superhuman states that it supports:

- Google-hosted accounts
- Microsoft 365-hosted accounts

and does **not** support:

- generic Exchange accounts
- arbitrary non-Google/non-Microsoft mailbox hosts

The doc explicitly says they connect through:

- Gmail's APIs
- Microsoft's APIs

This is a strong signal that their main architecture is:

- provider APIs first
- not generic IMAP as the universal core abstraction

#### 4.2 Superhuman preserves provider-shaped semantics

In `Labels (Gmail Accounts)`, labels are explicitly Gmail-shaped.

That suggests:

- they are not flattening everything into an over-simplified lowest common denominator
- provider-specific features remain provider-specific

#### 4.3 Superhuman publicly acknowledges Gmail API limits as a real operational issue

`Gmail Rate-Limiting` discusses:

- Gmail API quotas
- throttling caused by apps downloading too much Gmail history
- the need to manage third-party app bandwidth

This is a useful reminder that Gmail API sync is the right path for Gmail, but it must be designed carefully.

#### 4.4 Superhuman's newer Mail products act directly in Gmail and Outlook inboxes

`Superhuman Mail for Gmail` says:

- it works directly in the existing Gmail inbox
- changes show up in Gmail mobile because it acts via Gmail's API

`Superhuman Mail for Outlook` says the same pattern for Outlook.

This strongly reinforces:

> For Gmail and Outlook-like providers, the provider APIs are the correct integration surface.

#### 4.5 Superhuman supports multiple accounts, but not a unified inbox in the referenced docs

`Managing Accounts` says:

- multiple Gmail or Outlook accounts can be added
- unified inbox is not currently the main model in the referenced docs

This aligns nicely with the decision for this project to start with:

- **per-account inboxes in v1**

#### 4.6 Superhuman has local caching/offline behavior

`Offline Access` mentions caching and synchronization behavior.

This is a useful product reference, but this project explicitly decided:

- **offline is not part of the current requirement**

So this is informative, not binding.

### Final interpretation of Superhuman

Superhuman's public docs suggest the following principles are sound:

- provider APIs should be used when they exist and are strong
- provider-native semantics should not be erased prematurely
- per-account UX is a valid starting point
- Gmail support should be Gmail-shaped, not IMAP-shaped

---

## 5. Supporting technical package research

### 5.1 `imapflow`

This package was researched as a candidate for IMAP support.

Important points from its public README:

- modern IMAP client for Node.js
- async/await API
- automatic handling of IMAP extensions
- supports mailbox locking and efficient fetch patterns
- has Gmail support too, but is still fundamentally an IMAP client

### Recommendation

Use `imapflow` for:

- iCloud / IMAP mailbox sync
- folder scanning
- incremental mailbox tracking
- IDLE / reconciliation loops

### 5.2 `postal-mime`

This package was researched as a MIME / RFC822 parser candidate.

Important points from its public README:

- modern email parser
- works in Node and browser/serverless contexts
- parses raw RFC822 into structured fields
- zero-dependency core

### Recommendation

Use `postal-mime` for:

- parsing raw RFC822 messages from IMAP
- extracting HTML/text bodies
- attachments metadata
- headers needed for identity and provider mapping

### 5.3 `mailparser`

This package was also looked at, but its README states that it is in maintenance mode and recommends `postal-mime` for new projects.

### Recommendation

Prefer:

- `postal-mime`

not:

- `mailparser`

### 5.4 `EmailEngine`

This was researched as a reference point, not as the default choice.

Its README says it provides a unified API over:

- IMAP
- SMTP
- Gmail API
- Microsoft Graph API

Important caveats:

- source-available / commercial, not normal permissive OSS
- separate operational system
- Redis dependency
- good benchmark for what a unified gateway can look like, but likely too heavyweight as the core foundation here

### Recommendation

Treat EmailEngine as:

- useful architectural benchmark
- not the default implementation path

---

## 6. Questions that were explicitly asked and answered

This section records every major product / architecture question that was asked to avoid making silent decisions.

### Q1. Unified inbox in v1, or per-account first?

**Answer:** per-account is good for the start.

### Q2. Is v1 read-only sync, or do send/reply/drafts need to exist immediately?

**Answer:** start with read-only.

### Q3. Is iCloud app-specific-password auth acceptable, or is OAuth-only required?

**Answer:** app-specific password is acceptable; OAuth would be nicer.

### Q4. Can message bodies be fetched on demand via API when the user opens a message?

**Answer:** no. Too slow. On-demand API fetch for bodies is not acceptable.

This was a major turning point in the architecture.

### Q5. Should Gmail semantics win in the UI, or should the project start from a stricter common denominator and then add provider-specific capabilities?

**Answer:** start from a common denominator, then layer provider-specific capabilities on top.

### Q6. Is this project personal-first or multi-user SaaS first?

**Answer:** multi-user first.

### Q7. Should all message bodies be stored in Zero, or only a hot window / cache?

**Answer:** **all bodies in Zero for all synced mail**.

### Q8. Should imported mail age out of Zero over time?

**Answer:** no.

### Q9. Should initial sync import all historical mail or a bounded window?

**Answer:** last 30 days.

### Q10. If older mail is not evicted, should the system later backfill the full historical mailbox?

**Answer:** no. The final choice was:

- import the last 30 days on connect
- sync forward forever after that
- do **not** backfill older history
- do **not** evict imported history later

This means the final model is a **durable partial mirror**.

### Q11. For providers without native threading, should the system reconstruct threads heuristically from headers?

**Answer:** no. If the provider does not provide threading, do not fake it.

### Q12. Should Zero store plain text and sanitized HTML, or a single canonical rendered body?

**Answer:** the UI should render whatever Gmail effectively renders; if Gmail exposes both plain and HTML, keep both.

The practical architecture decision from that answer is:

- store both plain text and sanitized HTML
- render HTML by default when present
- fallback to text when HTML is absent

### Q13. Should inline assets already be embedded before opening a message?

**Answer:** no. Inline assets can load separately.

### Q14. Is full-body search needed in v1?

**Answer:** no. Full-body search later.

### Q15. Is Gmail-first, iCloud-second an acceptable delivery timeline?

**Answer:** yes.

### Q16. Which schema model should IMAP identity use?

**Answer:** use a canonical `mail_message` row plus a separate mailbox-instance table.

The mailbox-instance table is the honest source of IMAP sync identity. In v1, every imported IMAP mailbox item gets exactly one `mail_message` row and exactly one mailbox-instance row. Do **not** attempt cross-folder IMAP deduplication in v1.

### Q17. What happens when a Gmail thread crosses the 30-day boundary?

**Answer:** select by recent activity, then import the full thread.

The practical rule is:

- bootstrap only threads with at least one message in the last 30 days
- once a thread qualifies, import the entire Gmail thread, including older messages

### Q18. How should `mail_message_body` be queried through Zero?

**Answer:** keep it in Zero, but do not include it in list queries by default.

The practical rule is:

- inbox / folder / conversation list queries should read `mail_message` without joining large body columns by default
- message-detail queries should read `mail_message_body` explicitly

### Q19. What do provider-driven deletions mean locally?

**Answer:** match the provider.

The practical rule is:

- if the provider hard-deletes, hard-delete locally
- if the provider moves to trash, mirror the move to trash locally
- if the provider changes label or folder membership, mirror that membership change locally

### Q20. For Gmail, are folders or labels the source of truth?

**Answer:** Gmail labels are the upstream source of truth.

The practical rule is:

- system labels drive canonical folder navigation views
- user-created labels remain labels, not folders
- derived canonical folders are a UI/read-model convenience, not an independent truth source

### Q21. Which IMAP folders are synced by default?

**Answer:** all selectable mailboxes/folders.

### Q22. How should the system recover when sync cursors break?

**Answer:** do a bounded resync, not a full-history rebuild.

The practical rule is:

- if a Gmail history cursor expires or becomes invalid, re-bootstrap the account using the normal bounded bootstrap rule: last 30 days of activity, but full threads for qualifying Gmail threads
- if IMAP `UIDVALIDITY` changes for a folder, reset sync state for that folder and re-bootstrap that folder for the last 30 days
- if repeated recovery fails, mark the account as degraded until it can sync successfully again

### Q23. Should raw MIME be retained after parsing?

**Answer:** yes, but backend-only, not in Zero.

---

## 7. Final product and architecture contract

Combining all the answers above, the final contract for v1 is:

### Scope

- per-account inboxes only
- read-only only
- multi-user first

### Providers

- Gmail first
- iCloud second

### Sync window

- import last 30 days on first connect
- for Gmail, if a thread has any message in that window, import the full thread
- sync forward after that
- never backfill older mail
- never evict imported mail

### Storage and sync

- all synced message bodies live in Zero-visible tables
- `mail_message_body` stays out of list queries by default and is read explicitly for message detail
- raw MIME stays out of Zero but is retained in backend-only storage
- inline assets and attachment bytes can load later
- provider-driven deletes and moves are mirrored locally
- cursor invalidation triggers bounded resync of the affected account or folder, not a full-history rebuild
- no fake threading for providers without native threading

### Search

- no full-body search in v1
- likely server-side search later

---

## 8. Final interpretation of the product model

The system should be treated as a:

> **durable, per-account, forward-syncing, partial mailbox mirror**

It is **not**:

- a disposable hot cache
- a full historical mailbox mirror
- an offline-first app
- a universal fake-threading system across all providers

This framing matters because it resolves several design tensions cleanly.

---

## 9. Core design principles

### 9.1 Use provider APIs where they are strong

For Gmail:

- use the Gmail API
- do not route Gmail through IMAP just for abstract purity

### 9.2 Use IMAP only where necessary

For iCloud:

- IMAP is the practical mailbox sync path
- SMTP is the later send path

### 9.3 Common denominator first, provider-specific features second

The common denominator should include:

- accounts
- folders/mailboxes
- messages
- message bodies
- basic flags
- sender/recipient data
- timestamps
- attachments metadata

Provider-specific layer should include:

- Gmail labels
- Gmail categories
- Gmail thread IDs
- Gmail history IDs
- IMAP mailbox path / UID / UIDVALIDITY / MODSEQ

### 9.4 Do not fake provider capabilities

If a provider does not support a concept natively:

- do not invent it and pretend it is real

The most important explicit example is threading.

### 9.5 Bodies are part of the durable read model

Because click-time body fetch was rejected, bodies are not an optional side-channel.

They are part of the core replicated UI model.

---

## 10. Recommended provider capability model

Every `mail_account` should track explicit capability flags so the UI and backend can behave honestly.

Recommended capabilities:

- `supports_threads`
- `supports_labels`
- `supports_push_sync`
- `supports_oauth`
- `supports_server_search`

### Expected initial capability matrix

#### Gmail

- threads: yes
- labels: yes
- push sync: yes
- OAuth: yes
- server search: yes, though not a v1 product feature here

#### iCloud IMAP

- threads: no
- labels: no
- push sync: not Gmail-style push; IMAP IDLE / reconciliation only
- OAuth: no practical v1 assumption
- app-specific password: yes
- server search: limited and provider-shaped

This capability model supports the chosen rule:

- common base model first
- provider-specific extras layered on top

---

## 11. Recommended schema

The following schema is the recommended shape, even if exact column names are later refined.

### 11.1 `mail_account`

Represents one connected mailbox.

Recommended fields:

- `id`
- `user_id`
- `provider` (`gmail`, `icloud_imap`, later maybe `microsoft_graph`)
- `email`
- `display_name`
- `status`
- capability flags
- timestamps

### Why it exists

This is the top-level unit for:

- sync ownership
- UI scoping
- per-account inboxes
- capability-driven behavior

---

### 11.2 `mail_account_secret`

Stores provider credentials and secrets.

Recommended fields:

- `account_id`
- encrypted auth payload
- auth kind
- refresh token metadata / expiry metadata
- timestamps

### Why it exists

Secrets must be kept separate from:

- Zero-visible tables
- UI-facing replicated data

This table is **not** for Zero.

---

### 11.3 `mail_folder`

Represents mailbox/folder navigation.

Recommended fields:

- `id`
- `user_id`
- `account_id`
- `provider_folder_ref`
- `kind`
  - `inbox`
  - `sent`
  - `drafts`
  - `trash`
  - `spam`
  - `archive`
  - `custom`
- `name`
- `path`
- `is_selectable`
- timestamps

### Gmail mapping

For Gmail, labels are the upstream source of truth.

Canonical folder rows are derived from Gmail system labels for navigation and counts.

User-created Gmail labels remain labels, not folders.

### iCloud mapping

For IMAP/iCloud, real mailboxes map directly to folders.

---

### 11.4 `mail_label`

Represents provider-native labels.

Recommended fields:

- `id`
- `user_id`
- `account_id`
- `provider_label_ref`
- `name`
- `color`
- `kind` (`system`, `user`)
- timestamps

### Provider notes

- Gmail: yes
- iCloud IMAP: likely none in v1

This is explicitly provider-specific, not universal.

---

### 11.5 `mail_conversation`

Represents native provider conversations/threads **only when the provider natively supports them**.

Recommended fields:

- `id`
- `user_id`
- `account_id`
- `provider_conversation_ref`
- `subject`
- `snippet`
- `latest_message_at`
- `message_count`
- `unread_count`
- timestamps

### Provider notes

- Gmail: populated using Gmail thread ids
- iCloud IMAP: do **not** populate with fake derived threads

This table exists to support the explicit decision:

> no synthetic threading for providers that do not natively provide threading

---

### 11.6 `mail_message`

This is the core message row.

Recommended fields:

- `id`
- `user_id`
- `account_id`
- `conversation_id` nullable
- `provider_message_ref` nullable
- `internet_message_id` nullable
- `subject`
- `snippet`
- sender JSON
- to JSON
- cc JSON
- bcc JSON
- `sent_at`
- `received_at`
- `is_unread`
- `is_starred`
- `is_draft`
- `has_attachments`
- `has_html`
- `has_plain_text`
- timestamps

### Identity rules

#### Gmail

Use provider-native Gmail message IDs.

#### IMAP/iCloud

Do **not** use RFC `Message-ID` as the canonical database identity.

Instead, store mailbox-scoped provider identity on a separate mailbox-instance table.

The provider-native IMAP sync identity is effectively based on:

- mailbox / folder
- `UIDVALIDITY`
- `UID`

In v1, every imported IMAP mailbox item gets exactly one `mail_message` row and exactly one mailbox-instance row. Do **not** attempt cross-folder IMAP deduplication in v1.

The `internet_message_id` should still be stored, but as metadata, not as the canonical mailbox sync identity.

---

### 11.7 `mail_message_body`

One-to-one with `mail_message`.

Recommended fields:

- `message_id`
- `text_plain`
- `html_sanitized`
- `preferred_render` (`html`, `text`)
- maybe `source_content_type`
- timestamps

### Why it is a separate table

Bodies are large.

Separating them from `mail_message` helps keep:

- inbox list queries lighter
- folder views lighter
- detail views explicit

### Important decision

This table **is part of the Zero model** because all synced bodies must be available without click-time body fetch.

### Query shape decision

This does **not** mean every list query should join body content.

The intended pattern is:

- list queries read `mail_message`
- detail queries explicitly read `mail_message_body`

---

### 11.8 `mail_message_label`

Join table for labels.

Recommended fields:

- `message_id`
- `label_id`
- timestamps

### Provider notes

Primarily for Gmail.

---

### 11.9 `mail_message_mailbox`

Mailbox-instance table for folder membership and provider-native mailbox identity.

Recommended fields:

- `id`
- `message_id`
- `account_id`
- `folder_id`
- `provider_folder_ref`
- `uidvalidity` nullable
- `uid` nullable
- `modseq` nullable
- timestamps

### Why it exists

This table keeps mailbox-shaped location and sync identity honest without forcing one fake universal location model.

### Provider notes

#### Gmail

Rows here represent derived canonical folder membership used for navigation.

The upstream source of truth is still Gmail labels.

#### IMAP/iCloud

This table is the source of truth for mailbox-scoped sync identity.

In v1, each imported IMAP message has exactly one `mail_message_mailbox` row and exactly one `mail_message` row.

---

### 11.10 `mail_attachment`

Attachment metadata only.

Recommended fields:

- `id`
- `message_id`
- `provider_attachment_ref`
- `filename`
- `mime_type`
- `size`
- `is_inline`
- `content_id`
- timestamps

### Important decision

Store:

- attachment metadata in Zero

Do not store:

- attachment bytes in Zero

This allows:

- instant message opening
- inline asset resolution later
- lower replicated data volume than fully embedding binaries

---

### 11.11 `mail_sync_cursor`

Stores provider-specific incremental sync positions.

Recommended fields:

- `id`
- `account_id`
- maybe `folder_id` nullable depending on provider
- `provider`
- `cursor_kind`
- provider-specific cursor payload
- timestamps

### Gmail

Store account-scoped history cursor data.

### IMAP/iCloud

Store folder-scoped sync state such as:

- `UIDVALIDITY`
- highest imported UID
- `MODSEQ` when available

---

### 11.12 `mail_provider_state`

Escape hatch for provider-specific metadata that should not be prematurely normalized.

Recommended fields:

- `id`
- `account_id`
- `provider`
- `object_type`
- `object_id`
- `payload jsonb`
- timestamps

### Why it exists

This table allows storing provider-specific details without polluting the canonical model too early.

---

## 12. What should and should not be in Zero

### Put in Zero

- `mail_account`
- `mail_folder`
- `mail_label`
- `mail_conversation`
- `mail_message`
- `mail_message_body`
- `mail_message_label`
- `mail_message_mailbox`
- `mail_attachment` metadata

### Keep out of Zero

- secrets / credentials / tokens / app passwords
- raw MIME / RFC822 source
- provider raw API payloads unless truly necessary
- low-level sync job internals
- attachment binary content

### Rationale

Zero is the UI read model.

Bodies are in-bounds because they are required for instant read UX.

Binary attachments and secrets are not.

Raw MIME is also out of Zero, but it should still be retained in backend-only storage for reparsing, debugging, and future processing.

---

## 13. Recommended Gmail adapter design

### Why Gmail should use the Gmail API

This is one of the strongest conclusions from both the research and the decisions.

Reasons:

- Gmail has strong native APIs
- Gmail has native thread IDs
- Gmail has label APIs
- Gmail has history cursors
- Gmail has push via `watch`
- Superhuman appears to use Gmail's APIs, not IMAP, for Gmail-hosted accounts
- Mail0's strongest implementation is also Gmail-shaped

### Initial sync contract

On first connect:

- select Gmail threads with at least one message in the last 30 days
- import the full thread for every qualifying thread, even when older messages in that thread fall outside the 30-day window
- derive canonical folders from Gmail system labels
- fetch user labels
- fetch native Gmail threads/messages for the selected recent-activity threads
- eagerly write:
  - messages
  - sanitized HTML
  - plain text
  - attachment metadata

### Incremental sync contract

After bootstrap:

- use `users.watch`
- consume `history.list`
- sync forward forever
- update:
  - new messages
  - label changes
  - unread/read changes
  - moves/deletes within the mirrored set

If the Gmail history cursor expires or becomes invalid:

- mark the account as resyncing
- re-run the bounded bootstrap rule for that account
- resume forward sync from a fresh cursor

### Important behavior decision

Older-than-30-day history that was never imported remains outside the local mirror forever, unless it is part of a Gmail thread that qualified for import because that thread had recent activity.

---

## 14. Recommended iCloud / IMAP adapter design

### Why iCloud needs a different path

The expectation is that iCloud Mail is practically an:

- IMAP mailbox sync problem
- SMTP send problem later

### Library choice

Recommended:

- `imapflow` for IMAP operations
- `postal-mime` for parsing raw messages

### Initial sync contract

On first connect:

- select all selectable mailboxes/folders
- import only messages from the last 30 days from those folders
- parse RFC822 messages into normalized message/body/attachment metadata
- retain raw MIME in backend-only storage
- do **not** create synthetic conversations

### Incremental sync contract

After bootstrap:

- use IMAP IDLE where practical
- run periodic reconciliation
- track per-folder state using provider-native mailbox identity and sync cursors

If `UIDVALIDITY` changes for a folder:

- reset sync state for that folder
- re-bootstrap that folder for the last 30 days
- resume incremental sync from the new folder state

### Explicit no-go decision

Do **not** reconstruct conversations heuristically from:

- `Message-ID`
- `In-Reply-To`
- `References`
- subject matching

The explicit product decision was:

> If the provider does not provide threading, then it does not provide threading. Do not hack it together.

---

## 15. UI implications

Because provider capabilities are intentionally not faked, the UI should be capability-driven.

### Gmail account UI

- conversation/thread list
- labels
- folders
- message details inside a conversation model

### iCloud / IMAP account UI

- message list
- folders/mailboxes
- message detail
- no fake conversation UI if the provider has no native threading concept available to this project

### Common base UI

Across providers, the project should still have a common shell for:

- account switching
- folder navigation
- message selection
- body rendering
- attachment metadata

This satisfies:

- common denominator first
- provider-specific features layered on top

---

## 16. Body rendering decision in practice

The user requirement was:

- render what Gmail effectively renders
- if Gmail has both plain and HTML views, preserve both

### Practical interpretation

The implementation should:

- store both plain text and sanitized HTML
- render sanitized HTML by default when present
- fall back to plain text when HTML is absent
- leave room for later UI affordances such as:
  - plain text view
  - original source view
  - show original message

### Important nuance

Perfect byte-for-byte Gmail rendering parity is likely unrealistic because Gmail's exact rendering and sanitization behavior is proprietary.

So the correct implementation goal is:

- Gmail-like functional rendering parity
- not guaranteed internal implementation parity

### Inline assets

Inline images and other CID assets do **not** need to block message open.

They may load later via attachment references and content IDs.

---

## 17. Search decision

### v1 decision

Do **not** implement full-body search in v1.

### Likely v1 search scope

If any search exists early, it should likely be limited to:

- subject
- sender
- snippet
- folders
- labels

### Later decision

Full-body search should be added later and should most likely be:

- backend-side
- powered by Postgres full text search or a dedicated indexing strategy

### Important product consequence of the 30-day bootstrap decision

When full-body search is added later, it will only search:

- the 30-day bootstrap import set
- plus all mail synced after onboarding

It will **not** search older historical mail that was never imported.

That is not a bug; it is a direct consequence of the chosen product contract.

---

## 18. Read-only v1 implications

Because v1 is explicitly read-only, the first implementation should avoid building mutation flows for:

- send
- reply
- draft creation
- label mutation
- message moves
- archive/delete actions

This simplifies v1 significantly.

### What v1 actually needs

- account connection
- initial sync
- ongoing forward sync
- account-scoped UI views
- message body rendering
- folder and label navigation

### What moves to later

- outbound mail
- draft models
- mutations through Zero
- synchronization of sent/draft state as a first-class editing workflow

---

## 19. Multi-user implications

This project is multi-user first.

That should shape the schema from day one.

### Recommended rule

Put `user_id` directly on all hot mail tables where it materially helps authorization and Zero filtering.

Examples:

- `mail_account`
- `mail_folder`
- `mail_label`
- `mail_conversation`
- `mail_message`

### Why

This makes:

- Zero access filtering simpler
- account-scoped subscriptions safer
- authorization reasoning easier

Do not rely on deep join chains for basic ownership filtering if it can be made explicit in the core rows.

---

## 20. Indexing and growth implications

Because the project decided:

- no eviction
- all synced bodies in Zero
- multi-user
- durable forward-syncing partial mirrors

this will grow over time.

Even though bootstrap is only 30 days, the mirror will accumulate all future mail forever unless a later product change says otherwise.

### Recommended indexing priorities

At minimum, design indexes around:

- `user_id`
- `account_id`
- `received_at desc`
- folder membership
- conversation membership for Gmail
- unread / latest message views

### Why separate message and body tables still matters

Even though all bodies are in Zero, a separate `mail_message_body` table still helps keep:

- inbox list views lighter
- folder queries lighter
- conversation/message detail subscriptions explicit

This means the intended query shape is still:

- lightweight list queries without body columns
- explicit detail queries with body content

---

## 21. Rejected alternatives

This section records the designs that were considered and explicitly rejected.

### Rejected: on-demand body fetch via API

Rejected because it was explicitly considered too slow.

### Rejected: bodies only in a hot cache / partial Zero subset

Rejected because all synced bodies must live in Zero.

### Rejected: evicting older mail from Zero over time

Rejected explicitly.

### Rejected: full historical mailbox import on first connect

Rejected in favor of a 30-day bootstrap.

### Rejected: background backfill of older historical mail after bootstrap

Rejected explicitly.

### Rejected: truncating recent Gmail threads to only the in-window messages

Rejected. Recent Gmail threads import as full threads.

### Rejected: synthetic threading for IMAP/iCloud

Rejected explicitly.

### Rejected: discarding raw MIME immediately after parsing

Rejected. Raw MIME should be retained backend-side.

### Rejected: full-history rebuild when bounded cursor recovery is enough

Rejected. Cursor failure should trigger bounded resync, not a full mailbox import.

### Rejected: letting Gmail semantics become the universal base abstraction

Rejected in favor of:

- common denominator first
- provider extras layered on top

### Rejected: using IMAP as the universal abstraction for Gmail too

Rejected because Gmail's own API is materially stronger and better aligned with both the research and product goals.

---

## 22. Recommended implementation phases

### Phase 1: Gmail, read-only, per-account

Build:

- canonical mail schema
- Zero schema additions
- Gmail account connection
- 30-day bootstrap sync
- forward incremental Gmail sync
- UI for folders, labels, conversations, messages, bodies

### Phase 2: iCloud / IMAP, read-only

Build:

- IMAP account connection using app-specific password
- 30-day mailbox bootstrap
- forward IMAP sync
- message-first UI for non-threaded provider accounts

### Phase 3: search and richer provider capabilities

Build later:

- full-body search
- more provider-specific enrichments
- potentially Outlook / Microsoft Graph if needed
- send / reply / drafts if product direction expands there

---

## 23. Final architecture statement

If all the research and decisions above are compressed into one statement, it is this:

> Build a multi-user, per-account, read-only email app whose UI is powered by Zero and whose canonical source of truth is Drizzle/Postgres, using the Gmail API for Gmail and IMAP for iCloud, storing all synced message bodies in Zero, importing only the last 30 days at first connect, syncing forward forever after that, never backfilling older history, never evicting imported history, and never inventing provider features like threading when the provider does not natively expose them.

For Gmail, bootstrap by recent activity but import full qualifying threads. For IMAP, sync all selectable folders, keep mailbox-scoped sync identity honest, and retain raw MIME backend-side while keeping it out of Zero.

---

## 24. Final list of decisions

For quick reference, the final decisions are:

1. **Provider minimum:** Gmail
2. **Desired second provider:** iCloud Mail
3. **v1 inbox model:** per-account
4. **v1 scope:** read-only
5. **product shape:** multi-user first
6. **auth for iCloud:** app-specific password acceptable; OAuth nicer later
7. **body fetch:** not on-demand
8. **Zero body policy:** all synced bodies in Zero
9. **initial import window:** last 30 days
10. **Gmail bootstrap rule:** last 30 days of activity, but full thread import for qualifying Gmail threads
11. **historical backfill after bootstrap:** no
12. **aging out imported mail from Zero:** no
13. **provider modeling strategy:** common denominator first, provider-specific features on top
14. **non-Gmail threading:** do not synthesize
15. **body storage:** both plain text and sanitized HTML
16. **body rendering:** render HTML by default when present, text fallback
17. **body query shape:** keep bodies in Zero, but fetch them explicitly in detail queries rather than by default in list queries
18. **inline assets:** can load separately
19. **full-body search:** later, not v1
20. **Gmail timeline:** first
21. **iCloud timeline:** second, acceptable
22. **Gmail integration surface:** Gmail API
23. **Gmail source of truth:** labels are authoritative; canonical folders are derived from system labels for navigation
24. **iCloud integration surface:** IMAP for sync, SMTP later for send
25. **IMAP default folder policy:** sync all selectable folders
26. **IMAP identity model:** canonical `mail_message` row plus mailbox-instance table; no cross-folder dedup in v1
27. **delete semantics:** mirror the provider; hard delete means hard delete locally
28. **cursor recovery:** bounded resync, not full-history rebuild
29. **raw MIME retention:** keep backend-side, out of Zero
30. **IMAP library recommendation:** `imapflow`
31. **MIME parser recommendation:** `postal-mime`
32. **EmailEngine:** benchmark/reference only, not default foundation
33. **Mail0:** useful for adapter/read-model inspiration, not a drop-in architecture
34. **Superhuman takeaway:** provider-API-first and provider-shaped semantics appear to be the right instincts

---

## 25. What this document intentionally does not settle

This session did **not** settle every implementation detail.

Examples of implementation details still open for actual coding work:

- exact Drizzle column names and types
- exact Zero schema/query definitions
- exact sync job orchestration layout in this repo
- exact sanitization implementation for HTML bodies
- exact attachment download endpoint design
- exact account connection UI flow
- exact pagination UX and component structure

Those are implementation tasks.

The core architecture and product constraints above were the decisions actually made in this research session.
