# Gmail watch / push sync notes

This document explains whether Gmail supports a push-based sync model and what the correct implementation shape should be for this repo.

## Short answer

Yes.

For Gmail, the system can and should use a **push-triggered** model instead of pure polling.

But the important nuance is:

> Gmail does not send full message payloads directly as webhooks.
> Gmail sends change notifications, and the app must then reconcile by pulling the actual changes.

So the real model is:

- **push for wake-up**
- **pull for truth**

---

## What Gmail actually provides

Gmail's API supports mailbox change notifications through:

- `users.watch`
- Google Cloud Pub/Sub

The flow is:

1. The app calls `users.watch` for a Gmail mailbox.
2. Gmail registers that mailbox to send notifications to a configured Pub/Sub topic.
3. Gmail publishes change notifications to Pub/Sub when mailbox state changes.
4. Pub/Sub can either:
   - push to an HTTPS webhook owned by the app, or
   - be polled by a worker process.
5. The notification includes the mailbox identity and a new `historyId`.
6. The app then calls `users.history.list` using its previously stored cursor.
7. The app fetches the actual changed messages or threads using Gmail API reads such as:
   - `messages.get`
   - `threads.get`

This means Gmail does support a push-capable integration surface, but it is **not** the same as a provider POSTing full email objects directly to the app.

---

## Is this a webhook system?

### Functionally: yes

If Pub/Sub is configured in push mode, the app receives HTTPS requests when Gmail mailbox changes occur.

From the application's point of view, that behaves a lot like a webhook.

### Architecturally: not directly

The actual chain is:

- Gmail -> Pub/Sub
- Pub/Sub -> app webhook

So it is more accurate to describe it as:

- **Gmail watch notifications via Pub/Sub**

not:

- direct Gmail webhooks with full payload bodies

---

## Why this is the right Gmail model

Gmail has stronger native primitives than IMAP for Gmail-hosted mailboxes.

Important Gmail-native capabilities include:

- thread ids
- label APIs
- history cursors
- watch/push notifications

That makes a Gmail-native integration better than treating Gmail like a generic mailbox and polling it like IMAP.

Compared with polling, a watch-based model gives:

- lower latency
- fewer wasted API calls
- better scaling across many accounts
- a design aligned with Gmail's actual sync model

For this project, pure polling would be the worse choice.

---

## The most important caveat

The push event is **not** the email data.

It only tells the system that mailbox history has advanced.

The app still needs to do a reconciliation pass using:

- the previously stored `historyId`
- `users.history.list`
- message or thread fetches for changed objects

That means the push path should be understood as:

- trigger a sync job
- not as a complete state transfer

---

## Recommended architecture for this repo

The correct Gmail sync architecture is:

### 1. Initial connect / bootstrap

On first connect:

- bootstrap the account using the agreed bounded bootstrap rules
- store the latest Gmail `historyId`
- register `users.watch`

### 2. Receive push notification

When Pub/Sub pushes an event:

- authenticate and validate the incoming Pub/Sub request
- identify the affected Gmail account
- enqueue a sync job for that account

The webhook handler should stay lightweight.
It should not do full sync work inline.

### 3. Run per-account reconciliation

In the account sync worker:

- load the stored Gmail history cursor for that account
- call `users.history.list(startHistoryId=stored_cursor)`
- apply all changes to the local mirror
- fetch changed messages or threads as needed
- write the new local state
- update the stored cursor to the latest `historyId`

### 4. Handle cursor failure

If Gmail reports that the stored history cursor is invalid or expired:

- mark the account as `resyncing`
- run the bounded resync flow
- store a fresh cursor
- re-establish or renew watch state if needed

---

## What changes need to be applied locally

A Gmail history reconciliation pass should be able to reflect at least:

- new messages
- newly qualifying messages in existing mirrored threads
- label changes
- unread/read changes
- starred changes
- deletions
- moves represented through label membership changes

For this repo's current mirrored-mail model, the push flow should update the same canonical tables already planned for Gmail sync.

---

## Required operational assumptions

### 1. Watches expire

Gmail watch registrations are not permanent.

The system must:

- persist watch-related state as needed
- renew watch registrations before expiration
- treat renewal as a normal background maintenance task

### 2. History cursors can expire

If the app falls behind too far, Gmail may reject the stored `historyId`.

That is not a catastrophic error if the system is designed correctly.
The fallback should be:

- bounded resync using the project's normal Gmail bootstrap rule
- not a full-history rebuild

### 3. Notifications are triggers, not truth

Pub/Sub delivery should not be treated as a perfect event log.

Correctness must come from:

- stored sync state
- Gmail `history.list`
- idempotent reconciliation

### 4. Per-account mutual exclusion is still required

Push delivery can burst or duplicate.

The system should still enforce:

- at most one sync job per `mail_account` at a time

If a second push arrives while sync is running:

- enqueue or coalesce it
- do not start a concurrent sync for the same account

---

## What this means for the current repo

From the currently reviewed mail code:

- the Gmail adapter already has a history-based incremental sync concept
- the Gmail sync layer already assumes stored history cursors and bounded resync

So the main missing piece is not the conceptual sync model.

The main missing piece is the **watch registration and Pub/Sub ingestion path**, plus the background worker plumbing around it.

In other words:

- the repo already has part of the **pull reconciliation** side
- it still needs the **push trigger** side

---

## Recommended implementation stance

For Gmail, the project should adopt this policy:

> Use `users.watch` and Pub/Sub for push-triggered mailbox change notifications, and use `users.history.list` plus normal Gmail fetches for authoritative reconciliation.

That is the correct Gmail-native model.

It is better than:

- pure polling
- treating Gmail as generic IMAP
- assuming webhook delivery contains the full changed messages

---

## Final conclusion

Yes, Gmail supports a push-based sync model.

But the exact shape is:

- `users.watch`
- Pub/Sub notifications
- app webhook or Pub/Sub pull consumer
- `history.list` reconciliation
- per-account sync worker
- bounded resync when history cursors expire

So the right design is:

> **push-triggered, history-based pull reconciliation**

That is the model this repo should use for Gmail.
