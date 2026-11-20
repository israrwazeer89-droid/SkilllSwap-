# SkillSwap Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Integrity**: Every user-created document (`users`, `exchangeRequests`, `matches`, `conversations`, `messages`, `reviews`, `notifications`, `reports`) must enforce that the owner/author/sender UID equals `request.auth.uid` and `request.auth.token.email_verified == true`.
2. **PII Isolation**: User emails, blocked user IDs, and privacy settings are stored exclusively in `/users/{userId}/private/info`, never in `/users/{userId}`. Only the owner or a verified admin can read or write `/users/{userId}/private/info`.
3. **Admin Privilege Separation**: Non-admin users cannot set `isVerified: true`, `isSuspended: true`, or write to `/admins/{userId}`. Admin checks verify `email_verified == true` when checking the bootstrapped admin email.
4. **Master Gate & Message Security**: Messages in `/conversations/{conversationId}/messages/{messageId}` require the sender to be a participant in the parent `/conversations/{conversationId}` document via `get()` on create/get, and `participantIds` on the message must match the parent conversation for O(1) `allow list` filtering.
5. **Terminal State Locking**: Once an `exchangeRequests/{requestId}` reaches `'completed'`, `'rejected'`, or `'cancelled'`, no non-admin user may modify it.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps on writes must equal `request.time`.
7. **Review Grounding**: A review may only be created by a participant of an existing, `'completed'` exchange request (`exchangeId`).
8. **Path Hardening**: All document IDs must satisfy `^[a-zA-Z0-9_-]+$` and `size() <= 128`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Verify Shadow Field**: User creates/updates `/users/{uid}` with `isVerified: true` or `isSuspended: false -> true` or adds an arbitrary ghost field `role: 'admin'`.
2. **Unverified Email Spoof**: User with `email: 'israrwazeer89@gmail.com'` and `email_verified: false` attempts admin read/write on `/reports` or `/admins`.
3. **PII Cross-Read**: User B attempts `get` or `list` on `/users/{userA}/private/info`.
4. **Identity Spoofing on Exchange**: User A attempts to create `/exchangeRequests/{id}` with `fromUid: userB`.
5. **Self-Exchange Attack**: User A attempts to create `/exchangeRequests/{id}` with `fromUid == toUid`.
6. **Orphan Exchange Target**: User A attempts to create `/exchangeRequests/{id}` targeting a non-existent `toUid`.
7. **State Shortcutting**: Sender `fromUid` attempts to transition their own `pending` exchange request directly to `accepted` or `completed`.
8. **Terminal State Tampering**: Either user attempts to reopen a `completed` or `rejected` exchange request back to `pending`.
9. **Unauthorized Message Injection**: User C (not in `participantIds`) attempts to read or write in `/conversations/{convId}/messages/{msgId}`.
10. **Fake Review Fabrication**: User A attempts to create a review for an exchange that does not exist or is still `pending`.
11. **ID Poisoning / Resource Exhaustion**: Attacker uses a 500-character document ID or injects a 5KB bio string into `/users/{uid}`.
12. **Blanket Collection Scrape**: User attempts `list` on `/exchangeRequests`, `/conversations`, `/notifications`, or `/reports` without filtering to `request.auth.uid`.
