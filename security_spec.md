# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Global Default-Deny**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **PII Isolation (Split Collection Pattern)**:
   - `/users/{userId}` stores private PII (`email`, `phoneTag`) and is strictly readable and writable ONLY by the owner (`request.auth.uid == userId`).
   - `/directory/{userId}`, `/usernames/{username}`, and `/phone_index/{phoneKey}` store ONLY non-PII public fields (`uid`, `username`, `displayName`, `bio`, `avatarFallbackColor`, `emailVerified`, `phoneVerified`) to allow safe point lookup by exact UID, exact `@username`, or normalized E.164 phone number without exposing email or phone number or allowing bulk account enumeration (`allow list` is restricted to `existing().uid == request.auth.uid`).
3. **Atomic Unique Username Reservation**:
   - `/usernames/{username}` enforces `!exists(/databases/$(database)/documents/usernames/$(username))` on `create` and locks `uid` and `username` as immutable on `update`.
   - Creating `/users/{userId}` and `/directory/{userId}` requires `existsAfter(/databases/$(database)/documents/usernames/$(incoming().username))` and `getAfter(...).data.uid == request.auth.uid`.
4. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`). `isValidId` is never used on `list` operations.
5. **Master Gate Relational Sync & Real Participant Enforcement**:
   - Creating `/chats/{chatId}` requires both `participantOneUid` and `participantTwoUid` to exist in `/directory/{uid}`, forbidding chat creation with random or non-existent users.
   - Accessing or creating `/chats/{chatId}/messages/{messageId}` requires the caller to be an authorized participant in the parent `/chats/{chatId}` document (`isAuthorizedChatParticipant(chatId)`) and `senderUid == request.auth.uid`.
6. **Temporal & Immutable Integrity**:
   - On `create`: `incoming().createdAt == request.time && incoming().updatedAt == request.time`.
   - On `update`: `incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time`.
   - Immutable identity fields (`uid`, `username`, `email`, `ownerUid`, `contactId`, `chatId`, `participantOneUid`, `participantTwoUid`, `senderUid`, `recipientUid`) cannot be mutated on `update`.

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Unauthenticated Profile Create)**: Creating `/users/user_1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Payload 2 (Cross-User PII Read)**: User `attacker_1` attempting `get` on `/users/victim_1` (containing `email` and `phoneTag`) -> `PERMISSION_DENIED`.
3. **Payload 3 (Duplicate Username Hijack)**: User `attacker_1` attempting `create` or `update` on `/usernames/salah_gomaa` owned by `user_1` -> `PERMISSION_DENIED`.
4. **Payload 4 (Shadow Field Injection on Create)**: Creating `/users/user_1` with an extra undeclared field `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Payload 5 (ID Poisoning Attack)**: Creating `/users/user_1/contacts/invalid$id!@#` -> `PERMISSION_DENIED`.
6. **Payload 6 (Chat Creation with Non-Existent User)**: Creating `/chats/user_1_fake_user` where `/directory/fake_user` does not exist -> `PERMISSION_DENIED`.
7. **Payload 7 (Unauthorized Third-Party Message Read)**: User `intruder_3` attempting `get` or `list` on `/chats/user_1_user_2/messages/msg_1` -> `PERMISSION_DENIED`.
8. **Payload 8 (Client Timestamp Forgery)**: Creating `/users/user_1` with a past or future `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Payload 9 (Immortal Field Mutation)**: Updating `/usernames/salah_gomaa` while changing `uid` or `username` -> `PERMISSION_DENIED`.
10. **Payload 10 (Update-Gap / Unauthorized Field Mutation on DirectMessage)**: Updating `text` or `senderUid` on `/chats/user_1_user_2/messages/msg_1` when only `isStarred`, `isPinned`, and `updatedAt` are allowed -> `PERMISSION_DENIED`.
11. **Payload 11 (Value Poisoning on Whitelisted Update Key)**: Updating `isMuted` on `/users/user_1/contacts/contact_1` with a string `"yes"` instead of a boolean -> `PERMISSION_DENIED`.
12. **Payload 12 (Oversized String DoW Attack)**: Creating a message with `text` length > 2000 characters -> `PERMISSION_DENIED`.
