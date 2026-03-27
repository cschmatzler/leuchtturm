# Data model review

## Summary

This document captures the current evaluation of the mail data model in this repo and turns the review into **11 concrete recommendations**.

The short version is:

- the current model is already a **good canonical mirrored mail base**
- it is especially strong on **provider honesty** and **separating hot message metadata from body content**
- it is **not yet complete as a production email read model**
- the biggest gap is the missing **projection layer** that real email products end up building on top of their canonical storage

The guiding conclusion is:

> Keep the canonical provider-honest core. Strengthen the derived read models, sync-state model, and backend-only source/repair metadata around it.

---

## Files reviewed in this repo

### Current mail model and access layer

- `packages/core/src/mail/mail.sql.ts`
- `packages/core/src/mail/schema.ts`
- `packages/core/src/mail/queries.ts`
- `packages/core/src/mail/provider.ts`
- `packages/core/src/drizzle/relations.ts`
- `packages/zero/src/schema.ts`
- `packages/zero/src/queries.ts`
- `apps/api/src/handlers/zero.ts`
- `packages/core/src/mail/gmail/adapter.ts`
- `packages/core/src/mail/gmail/sync.ts`

### External references

#### 0.email / Mail0

- `apps/server/src/lib/driver/types.ts`
- `apps/server/src/routes/agent/db/schema.ts`
- `apps/server/src/routes/agent/sync-worker.ts`
- `apps/server/src/routes/agent/index.ts`
- `apps/server/src/workflows/sync-threads-workflow.ts`
- `apps/server/src/types.ts`

#### Mailspring

- `app/src/flux/models/account.ts`
- `app/src/flux/models/category.ts`
- `app/src/flux/models/folder.ts`
- `app/src/flux/models/label.ts`
- `app/src/flux/models/thread.ts`
- `app/src/flux/models/message.ts`
- `app/src/flux/models/file.ts`

#### Roundcube

- `SQL/sqlite.initial.sql`

#### Mailpile

- `mailpile/search.py`

---

## Current model: what is already strong

Before listing the 11 recommendations, it is important to say clearly what should **not** be thrown away.

### 1. The canonical base is good

The current core tables are already the right starting point:

- `mail_account`
- `mail_folder`
- `mail_label`
- `mail_conversation`
- `mail_message`
- `mail_message_body_part`
- `mail_message_label`
- `mail_message_mailbox`
- `mail_attachment`

This is much better than trying to drive the product directly from raw provider payloads or a thin IMAP cache.

### 2. The provider modeling is unusually honest

The current design does **not** collapse everything into fake universal concepts.

That is a major strength.

Examples:

- Gmail labels are modeled as labels, not secretly as folders.
- IMAP mailbox identity is modeled through `mail_message_mailbox`, not by pretending that RFC `Message-ID` is enough.
- `mail_conversation` exists for providers with native threading rather than forcing synthetic threading everywhere.

This is the right instinct, and the rest of the model should preserve it.

### 3. The body split is correct

Keeping bodies out of `mail_message` and in `mail_message_body_part` is the right call.

The current shape aligns with what mature email apps eventually learn:

- list queries should be small and cheap
- detail queries can pay the cost for body retrieval
- email bodies are too large and too irregular to treat like normal list metadata

### 4. Attachment metadata in Zero, bytes elsewhere, is correct

`mail_attachment` for metadata while keeping attachment bytes out of Zero is a strong compromise.

It supports:

- fast message detail rendering
- inline asset resolution later
- lower replicated volume
- better security boundaries

### 5. Secrets and sync mechanics are already separated from Zero

Splitting:

- `mail_account`
- `mail_account_secret`
- `mail_oauth_state`
- `mail_sync_cursor`
- `mail_provider_state`

is fundamentally the right architecture.

The work now is not to replace that split; it is to make the backend-only control/state layer more explicit and more complete.

---

## What the open source comparisons say

These external references do not all use the same architecture, but together they point in one direction.

### 0.email / Mail0

Mail0 is the clearest reference for the idea that:

- the provider adapter boundary is real
- Gmail-first systems become **thread-first read models**
- the hot query store is often smaller and more projection-shaped than the full provider payload

Its `threads`, `labels`, and `thread_labels` schema inside the agent DB is intentionally small and list-oriented. Full thread payloads live in object storage. That exact storage split is not reusable here because this product wants bodies in Zero, but the principle absolutely is reusable:

> the UI wants a hot projection, not just normalized truth

### Mailspring

Mailspring reinforces a different but compatible lesson:

- the primary UI primitive is often the **thread**, not the raw message
- threads carry rich summary data like categories, participants, attachment counts, timestamps, unread/starred state
- message bodies are not the same thing as message list metadata
- some headers deserve first-class promotion because they directly support the UX

### Roundcube

Roundcube is useful as the clearest warning that IMAP identity is operationally mailbox-scoped.

Its cache tables are mailbox-centric:

- `cache_index`
- `cache_thread`
- `cache_messages`

with mailbox and UID-shaped identity.

That strongly validates the current instinct behind `mail_message_mailbox`.

### Mailpile

Mailpile is the strongest reminder that search eventually wants its own index/projection layer.

It stores compact index rows and tag mappings optimized for retrieval, not just canonical message storage.

That matters because this repo should not assume the canonical mirror schema will also be the best future full-body search schema.

---

## The 11 recommendations

Each recommendation below includes:

- the current state
- why it is insufficient
- what the external references suggest
- a concrete direction
- examples and implications

---

## 1. Split account-scoped sync state from folder-scoped sync state

### Current state

The current repo has a single backend-only table:

- `mail_sync_cursor`

It stores:

- `account_id`
- optional `folder_id`
- `provider`
- `cursor_kind`
- `cursor_payload`

But the actual uniqueness currently expressed in `packages/core/src/mail/mail.sql.ts` is account-scoped:

- unique on `(account_id, cursor_kind)`

That fits Gmail history cursors.
It does **not** fit IMAP folder-scoped sync state.

### Why this is insufficient

IMAP sync state is not just a generic cursor. It is a per-folder operational state machine.

Examples of folder-scoped IMAP state:

- `UIDVALIDITY`
- highest imported `UID`
- highest known `MODSEQ`
- last reconciliation time
- IDLE vs poll-only mode
- last folder-specific failure

If the system eventually has one row per account for a given cursor kind, it cannot model multiple folders honestly.

### What the open source comparisons suggest

- **Roundcube** is the clearest evidence that IMAP cache and sync identity are mailbox-scoped.
- **Mail0** is Gmail-first and uses an account-shaped incremental history model. That works because Gmail really does expose account-scoped history.

Together, they suggest:

> Gmail and IMAP do not want the same sync-state abstraction.

### Recommendation

Prefer splitting the current generic table into two more explicit tables:

- `mail_account_sync_state`
- `mail_folder_sync_state`

#### Example sketch

```ts
mail_account_sync_state
- account_id
- provider
- state_kind            // gmail_history, bootstrap, etc.
- payload jsonb
- last_successful_sync_at
- last_attempted_sync_at
- last_error_code
- last_error_message

mail_folder_sync_state
- account_id
- folder_id
- provider
- state_kind            // imap_uid, imap_idle, reconciliation, etc.
- payload jsonb         // uidvalidity, highest_uid, modseq, idle state
- last_successful_sync_at
- last_attempted_sync_at
- last_error_code
- last_error_message
```

If keeping one generic table is preferred, then the uniqueness and semantics need to be tightened to allow folder-scoped rows safely, but the split-table design is clearer.

### Why this matters now

This is not cosmetic. It affects:

- correctness of IMAP incremental sync
- bounded resync behavior
- observability of partial failures
- future worker orchestration

### Example

A Gmail account can have one row like:

```json
{
	"account_id": "mac_...",
	"state_kind": "gmail_history",
	"payload": { "historyId": "8439201" }
}
```

An iCloud IMAP account needs many rows like:

```json
{
	"account_id": "mac_...",
	"folder_id": "mfl_...",
	"state_kind": "imap_uid",
	"payload": {
		"uidvalidity": 173921,
		"highestUid": 842,
		"modseq": "9912"
	}
}
```

These are different categories of state. Treating them as one abstract thing makes the model blur at the exact place where correctness matters most.

---

## 2. Strengthen the conversation/thread projection layer

### Current state

`mail_conversation` currently stores a thin summary:

- `provider_conversation_ref`
- `subject`
- `snippet`
- `latest_message_at`
- `message_count`
- `unread_count`

This is a decent start, but it is too thin for a serious Gmail-style thread list.

### Why this is insufficient

Real thread lists need thread-level summary fields that are cheap to query and cheap to render.

Examples of data a thread list usually wants without walking every message:

- latest sender
- participant preview
- attachment presence
- draft presence
- starred state
- effective inbox/archive/trash visibility
- effective label set
- last message id for navigation

The current model keeps a lot of truth at the message level:

- `mail_message_label`
- `mail_message_mailbox`
- `mail_attachment`

That truth is good, but it is not enough by itself for a product-quality thread list.

### What the open source comparisons suggest

#### 0.email / Mail0

Its hot thread DB stores thread-level fields like:

- latest sender
- latest subject
- latest received timestamp
- thread-label relationships

It is explicitly projection-shaped.

#### Mailspring

Its `Thread` model carries:

- categories
- folders
- labels
- participants
- attachmentCount
- timestamps
- unread/starred state

This is the strongest evidence that thread-centric UX ends up needing thread-centric projections.

### Recommendation

Treat `mail_conversation` as a **maintained projection**, not as a sacred minimal identity row.

Add richer thread summary fields, and likely add conversation-level derived join tables.

#### Recommended additions to `mail_conversation`

- `latest_message_id`
- `latest_sender`
- `participants_preview`
- `has_attachments`
- maybe `is_starred`
- maybe `draft_count`

#### Recommended derived joins

- `mail_conversation_label`
- `mail_conversation_mailbox`

These should be explicitly derived from message-level truth, not treated as primary truth.

### Example

Suppose a Gmail thread has 5 messages:

- one message is unread
- two messages have user labels
- one message has an attachment
- latest sender is different from the thread starter

The UI should be able to render the list row directly from the thread projection instead of recomputing all of that on every list load.

A derived row might look like:

```json
{
	"conversation_id": "mcv_...",
	"latest_message_id": "mmg_...",
	"latest_sender": { "name": "Alice", "address": "alice@example.com" },
	"participants_preview": [
		{ "name": "Alice", "address": "alice@example.com" },
		{ "name": "Bob", "address": "bob@example.com" }
	],
	"has_attachments": true,
	"message_count": 5,
	"unread_count": 1
}
```

### Important framing

This recommendation does **not** mean moving away from message-level truth. It means acknowledging that product UIs want a thread projection above it.

---

## 3. Add explicit raw-source/blob metadata for retained MIME and provider payloads

### Current state

The documented architecture already says:

- raw MIME should be retained backend-side
- raw MIME should not be replicated to Zero
- raw MIME should be encrypted at rest
- raw MIME should be purged when the mirrored message is deleted

That is the correct policy.

What is missing is a first-class data model for that retained source.

Today the closest escape hatch is:

- `mail_provider_state`

But that is too generic.

### Why this is insufficient

Retained source is not just “misc provider state”. It is operationally important for:

- reparsing after parser changes
- sanitizer re-runs
- attachment extraction changes
- debugging malformed MIME
- provider-specific bug analysis
- future source or “show original” features
- explicit deletion guarantees

Without first-class metadata, source retention becomes an informal storage convention instead of a modeled system.

### What the open source comparisons suggest

- **Mail0** stores full thread payloads in object storage and hot query metadata in SQLite. That is a clear signal that large cold payloads want their own storage model.
- **Mailspring** separates message bodies from hot list data. Same core lesson in a different shape.

### Recommendation

Add a dedicated backend-only source metadata table, e.g.:

- `mail_message_source`

#### Example sketch

```ts
mail_message_source
- message_id
- source_kind              // raw_mime, gmail_raw_json, gmail_full_message, etc.
- storage_kind             // postgres, s3, r2, filesystem
- storage_key
- content_sha256
- byte_size
- parser_version
- sanitizer_version
- encryption_metadata jsonb
- created_at
- updated_at
```

### Why this is better than overloading `mail_provider_state`

Because it separates:

- provider-specific leftovers
- raw retained source used for repair and reprocessing

Those are not the same concern.

### Example

Imagine the sanitizer changes later to fix a security bug or improve Gmail-like rendering.

Without stored source metadata, the system may not know:

- which messages were sanitized with the old rules
- which source artifact to replay
- whether reparsing already happened

With first-class source metadata, the reprocessing path is clear.

---

## 4. Enforce ownership and account consistency at the database level

### Current state

The model duplicates `user_id` on many Zero-visible mail tables:

- `mail_account`
- `mail_folder`
- `mail_label`
- `mail_conversation`
- `mail_message`
- `mail_message_body_part`
- `mail_message_label`
- `mail_message_mailbox`
- `mail_attachment`

That is a good design for:

- Zero filtering
- authorization clarity
- simpler query predicates

However, duplicated ownership columns only stay safe if the database enforces that they agree.

### Why this is insufficient

Without stronger relational guarantees, bugs can create logically impossible states such as:

- a message with a `user_id` that differs from its account’s `user_id`
- a mailbox row whose `folder_id` points to a folder in another account
- a message attached to a conversation in another account
- a label join row that crosses account boundaries

Those bugs are especially dangerous in a replicated multi-user system because they can surface as subtle privacy or visibility problems.

### What the open source comparisons suggest

Most traditional OSS mail apps get away with weaker normalization rules because they are either:

- single-user local apps
- server-rendered apps with simpler cache layers
- less Zero-like in their data replication model

This repo does not have that luxury. Because the system is multi-user and locally replicated through Zero, explicit ownership invariants matter more.

### Recommendation

Keep the duplicated ownership fields, but enforce consistency more aggressively.

Approaches:

- composite unique constraints that include `id` + `user_id` or `id` + `account_id`
- composite foreign keys where practical
- account-scoped uniqueness on joins
- sync write helpers that always resolve joins through account-local identifiers

### Example

If `mail_folder` had a composite uniqueness guarantee like:

- `(id, account_id, user_id)`

and `mail_message_mailbox` referenced the folder with matching account/user scope, then many cross-account bugs become impossible instead of merely unlikely.

### Why this matters strategically

This is not just about cleanliness. It is part of the security story.

When a product uses per-user local replication, “the rows are probably consistent” is not a strong enough guarantee.

---

## 5. Promote key message headers to first-class modeled data

### Current state

The current `mail_message` row already includes useful core metadata:

- provider message ref
- internet message id
- sender and recipients
- subject
- snippet
- sent and received timestamps
- flags

That is a good baseline.

But it is still missing several high-value headers that real email clients frequently surface or depend on.

### Headers worth promoting

At minimum:

- `reply_to`
- `in_reply_to`
- `references`
- `list_unsubscribe`
- `list_unsubscribe_post`

Potentially also:

- `return_path`
- `sender_header`
- `delivered_to`
- `precedence` or mailing-list markers if they prove useful later

### Why this is insufficient today

Raw MIME retention is important, but raw MIME is not a substitute for modeling the subset of headers that directly affect the UX.

Examples:

- unsubscribe UI needs `List-Unsubscribe`
- later reply behavior benefits from `Reply-To`
- thread/debug/source views benefit from `In-Reply-To` and `References`
- mailing list handling often depends on promoted headers

### What the open source comparisons suggest

#### Mail0

Its parsed message model already exposes:

- `references`
- `inReplyTo`
- `replyTo`
- `listUnsubscribe`
- `listUnsubscribePost`

#### Mailspring

Its `Message` model promotes:

- `replyTo`
- `headerMessageId`
- `replyToHeaderMessageId`
- `forwardedHeaderMessageId`
- `listUnsubscribe`
- `listUnsubscribePost`

That is not accidental. These headers support real product behavior.

### Recommendation

Promote these fields either:

- directly onto `mail_message`, or
- into a dedicated `mail_message_header` / `mail_message_affordance` side table

If the product wants to keep `mail_message` lean, a side table is reasonable.

#### Example sketch

```ts
mail_message_header
- message_id
- reply_to jsonb
- in_reply_to text
- references text[] or text
- list_unsubscribe text
- list_unsubscribe_post text
- created_at
- updated_at
```

### Example use cases

#### Unsubscribe affordance

A newsletter detail view can show an explicit “unsubscribe” action without reparsing raw MIME on demand.

#### Thread inspection

A debug/admin view can quickly explain why a provider did or did not thread a message without walking the raw source.

#### Reply correctness later

When send/reply ships, these headers stop being “nice to have” and become core message behavior.

---

## 6. Add explicit account coverage and sync health metadata

### Current state

`mail_account` currently carries:

- provider
- email
- display name
- status
- capability flags

This is useful, but too thin for a long-lived partial mirror.

### Why this is insufficient

This product is not a full mailbox mirror.
It is a **durable partial mirror**.

That means completeness is non-uniform by design:

- initial bootstrap imports only recent mail
- Gmail imports full threads for recent-activity threads
- older mail is not backfilled
- future mail accumulates forever

If that product contract is real, then mirror coverage is part of the model’s truth.

### What the open source comparisons suggest

- **Mailspring** keeps sync state and sync error on account objects.
- **Superhuman’s public docs** imply strong internal awareness of provider state, account health, and rate-limit conditions.
- **Mail0** has workflow/state coordination around sync operations.

The consistent lesson is:

> account state is not just identity plus provider flags; it is also health and coverage

### Recommendation

Add coverage and health metadata directly to `mail_account` or a tightly related backend-only account-state table.

#### Recommended fields

- `bootstrap_cutoff_at`
- `bootstrap_completed_at`
- `last_successful_sync_at`
- `last_attempted_sync_at`
- `last_error_code`
- `last_error_message`
- `degraded_reason`
- maybe `disconnecting_at`
- maybe `requires_reauth_at`

### Example

Two accounts can both be `healthy` in a simplistic status system while actually being very different:

- Account A bootstrapped yesterday and synced successfully 2 minutes ago
- Account B bootstrapped 4 months ago, last synced 6 days ago, and silently fell back from IDLE to poll-only

The user and the system should be able to tell those apart.

### Why this matters for UX

This metadata supports honest UI such as:

- “Synced through Mar 27”
- “Last successful update 3 minutes ago”
- “Needs re-authentication”
- “Only mirrored mail is searchable”

In a partial-mirror product, this is not debugging trivia. It is the product contract made visible.

---

## 7. Improve folder and label hierarchy support

### Current state

The current tables model:

- `mail_folder.path`
- `mail_label.name`

That is enough for flat rendering, but probably not enough for mature navigation.

### Why this is insufficient

Both IMAP folders and Gmail labels are often hierarchical in practice.

Examples:

- IMAP: `Projects/Alpha`, `Projects/Beta`
- Gmail labels: `Personal/Travel`, `Work/Recruiting`

Even if Gmail exposes user labels differently from folders semantically, the sidebar usually wants tree-like rendering and consistent nested navigation behavior.

### What the open source comparisons suggest

#### Mailspring

Its `Category` abstraction leans heavily on `path` and role-aware display logic. The displayed category name is derived from a structured path, not just a flat label string.

#### Roundcube

Its mailbox-oriented architecture is deeply path/mailbox aware because IMAP folders are inherently hierarchical.

### Recommendation

Model hierarchy more explicitly instead of relying only on raw name strings.

Options:

- store `path` on labels as well as folders
- store `delimiter`
- store `parent_id`
- optionally store `depth`
- optionally store `sort_key`

#### Example sketch

```ts
mail_folder - path - delimiter - parent_id - depth;

mail_label - path - delimiter - parent_id - depth;
```

Not all of these fields are required immediately, but the model should move toward explicit hierarchy.

### Example

A Gmail label named `Projects/Alpha` should not force the UI to repeatedly split strings and infer tree structure at runtime. The stored read model should already know its parent relationship or path segmentation.

### Important nuance

This does **not** mean claiming Gmail labels and IMAP folders are the same kind of thing. It only means that both benefit from a navigation-friendly hierarchical representation.

---

## 8. Add more query-shaped projections and indexes for primary list views

### Current state

The current model is logically sound, but some of the list-driving query shapes are still too close to the canonical tables.

For example, folder message queries currently work through:

- `mail_message_mailbox`
- then `.related("message")`

That is correct, but it may not be the ideal long-term hot path.

### Why this is insufficient

Real mail UIs repeatedly ask questions like:

- what should appear in this folder list, ordered by latest activity?
- what should appear in this label view?
- what should appear in this conversation list for this account?
- what unread/attachment/starred indicators do I need on the list row?

When the hot query path always has to jump through joins to reconstruct sort-critical or display-critical data, the model is still a little too canonical and not yet projection-shaped enough.

### What the open source comparisons suggest

#### 0.email / Mail0

Its hot agent DB is intentionally tiny and query-shaped. The `threads` table exists precisely so the UI is not recomputing everything from full payloads.

#### Mailspring

Its thread model already carries the summary fields that drive list rendering.

### Recommendation

Add more explicit list-oriented projections or denormalized sort fields for the main product views.

This does **not** need to mean one projection table per screen. It can be incremental.

Possible options:

- strengthen `mail_conversation` as the account thread list projection
- add folder/list sort fields onto `mail_message_mailbox`
- add conversation-level derived joins
- add lightweight account/sidebar counters in a dedicated projection

#### Example options

##### Option A: denormalize onto mailbox rows

```ts
mail_message_mailbox -
	sort_received_at -
	sort_latest_activity_at -
	is_unread_cached -
	has_attachments_cached;
```

##### Option B: add explicit folder projection

```ts
mail_folder_entry
- folder_id
- message_id or conversation_id
- latest_activity_at
- sender_preview
- snippet
- unread
- has_attachments
```

### Example

A folder list view should be able to answer:

- show 50 items in Inbox
- ordered by latest relevant time
- with sender, subject, snippet, unread, attachments

without expensive dynamic reconstruction on every load.

### Indexing implications

At minimum, query-critical indexes should exist around:

- `(user_id, account_id, received_at desc)`
- folder membership + sort key
- conversation membership + latest activity
- label membership + latest activity
- unread subsets

This recommendation is not about premature optimization. It is about modeling the primary read paths explicitly.

---

## 9. Add first-class identity / alias modeling before send-and-reply work grows

### Current state

The current data model is read-only focused, which is fine for v1.

But email accounts almost always end up needing explicit modeling for identities and aliases.

Examples:

- Gmail send-as aliases
- multiple From identities for one account
- display-name variants
- default reply identity
- special support or team aliases

### Why this matters even before send ships

Even in a read-only phase, identity data can still matter for:

- showing “me” correctly across accounts
- distinguishing primary address vs alias in recipients
- future-proofing reply behavior without retrofitting later
- interpreting provider metadata accurately

### What the open source comparisons suggest

#### Mailspring

Its `Account` model already includes:

- aliases
- default alias
- autoaddress behavior

That is a strong sign that account identity gets more complex quickly.

### Recommendation

Add an explicit identity layer soon, even if the first implementation keeps it backend-only or lightly used.

#### Suggested table

- `mail_identity` or `mail_account_alias`

#### Example sketch

```ts
mail_identity -
	id -
	user_id -
	account_id -
	address -
	display_name -
	is_primary -
	is_default_send_as -
	provider_identity_ref -
	created_at -
	updated_at;
```

### Example

Suppose a Gmail account is connected as:

- `founder@example.com`

but also has valid send-as identities:

- `press@example.com`
- `jobs@example.com`

If the model only has `mail_account.email`, later outbound work has to retrofit a concept that is already real.

### Important nuance

This recommendation is not saying to build send now. It is saying that identities are a real part of the domain and should not remain hidden inside provider payloads for too long.

---

## 10. Plan for a separate search projection instead of forcing search onto canonical rows

### Current state

The current design correctly defers full-body search.
That is the right product decision.

But the long-term data-model implication should be made explicit now:

> the canonical mirror schema is unlikely to be the final search schema

### Why this matters

Search wants different optimizations than canonical storage.

Search usually wants:

- normalized text blobs
- tokenized participants
- label and folder filters
- subject/body weighting
- possibly conversation-level rollups
- coverage-awareness for partial mirrors

Trying to bolt this directly onto the canonical tables later often leads to awkward query plans and unclear ownership of indexed content.

### What the open source comparisons suggest

#### Mailpile

Mailpile is the strongest example here. Its indexing strategy is intentionally search-shaped, with compact rows and tag relationships optimized for retrieval.

That does not mean this repo should copy Mailpile’s implementation. It means the repo should copy the principle:

> search deserves its own projection/index layer

### Recommendation

When search is introduced, add a dedicated search document/index layer instead of pretending the canonical tables alone are enough.

#### Example possibilities

- `mail_search_document`
- Postgres `tsvector` materialization table
- account-scoped or conversation-scoped search index rows

#### Example sketch

```ts
mail_search_document
- message_id
- account_id
- conversation_id nullable
- folder_ids
- label_ids
- subject_text
- sender_text
- recipient_text
- body_text
- snippet_text
- mirrored_coverage_kind
- tsvector or search payload
- updated_at
```

### Example

A search result for `invoice from Stripe` should eventually be able to search:

- sender tokens
- subject
- snippet
- maybe body
- maybe attachment names

without turning every canonical table query into a full scan or ad hoc join explosion.

### Coverage implication

Because the product mirrors only part of the mailbox, search docs should also know that they represent only the mirrored subset. That makes the product behavior honest instead of accidentally overpromising completeness.

---

## 11. Add a participant/contact projection above raw JSON recipient arrays

### Current state

The current `mail_message` model stores participants as JSON-like address collections:

- `sender`
- `to_recipients`
- `cc_recipients`
- `bcc_recipients`

This is correct for message fidelity.
It is not yet enough for richer people-centric behavior.

### Why this is insufficient

Email products quickly want features that operate on normalized people data rather than per-message raw address blobs.

Examples:

- sender search
- participant chips and previews
- recipient deduplication by canonicalized address
- later autocomplete and compose support
- “all threads with Alice” or “recent senders”
- local enrichment like avatar, display-name preference, last seen

JSON recipient arrays preserve source fidelity, but they are not the same thing as a participant projection.

### What the open source comparisons suggest

#### Mailspring

Its models make participants a first-class concept:

- `Contact`
- thread participants
- message `to` / `cc` / `bcc` / `from` collections built around contact objects

That does not require this repo to fully normalize every address immediately, but it does suggest where the model eventually wants to go.

### Recommendation

Keep the raw JSON address blobs on `mail_message` for fidelity, but add a normalized participant projection when people-centric features become important.

#### Possible table shape

```ts
mail_participant - id - user_id - normalized_address - display_name - last_seen_at - source_kind; // derived_from_mail, imported_contact, user_edited

mail_message_participant -
	message_id -
	participant_id -
	role - // from, to, cc, bcc, reply_to
	ordinal;
```

### Example

Two messages may contain these sender variants:

- `"Alice W." <alice@example.com>`
- `Alice Wong <alice@example.com>`

At the canonical message level, preserving both exact values is correct.
At the participant projection level, they should be recognized as the same normalized address.

### Why this matters strategically

This is how the model avoids a bad future choice between:

- preserving exact source fidelity
- supporting people-centric product behavior

The correct answer is to do both, with separate layers.

---

## Putting the 11 recommendations together

Taken together, these recommendations imply a clearer architecture with three layers.

## A. Canonical mirror layer

This is the provider-honest mirrored truth.

Keep and strengthen:

- `mail_account`
- `mail_folder`
- `mail_label`
- `mail_conversation`
- `mail_message`
- `mail_message_body_part`
- `mail_message_label`
- `mail_message_mailbox`
- `mail_attachment`

This layer should remain the source of truth for mirrored mail state.

## B. Projection layer

This is where product-optimized reads live.

Add here:

- richer conversation/thread summaries
- conversation-level folder/label projections
- folder/list projections
- search documents later
- participant/contact projections later

This layer exists so the UI does not constantly reconstruct everything from canonical rows.

## C. Backend control/state/source layer

This is where sync and repair logic live.

Strengthen here:

- account sync state
- folder sync state
- raw source metadata
- health and coverage metadata
- provider-specific leftovers
- secrets and auth state

This layer should remain out of Zero.

---

## Recommended implementation order

The 11 recommendations do not all have the same urgency.

### Highest priority

1. split account-scoped vs folder-scoped sync state
2. strengthen the conversation projection
3. add explicit raw-source/blob metadata
4. enforce ownership/account consistency

These change correctness and architecture, not just convenience.

### Next priority

5. promote key message headers
6. add account coverage and sync health metadata
7. improve hierarchy support
8. add more query-shaped projections and indexes

These make the product model more honest and more usable.

### Later but worth planning now

9. identity / alias modeling
10. search projection
11. participant/contact projection

These become more important as the product moves beyond read-only mirroring.

---

## Final conclusion

The current repo already has the right base instinct:

- provider-honest canonical tables
- bodies split from list metadata
- mailbox-instance identity for IMAP
- secrets and sync state outside Zero

That foundation should be preserved.

The next step is not to replace the current schema with a more magical unified abstraction.
The next step is to acknowledge what mature mail products eventually learn:

> the canonical mirror is necessary, but not sufficient

Real products also need:

- explicit sync-state models
- explicit raw-source retention metadata
- explicit coverage/health modeling
- explicit thread/list/search/participant projections

That is the path from “a correct mirrored mail schema” to “a production-grade email application data model.”
