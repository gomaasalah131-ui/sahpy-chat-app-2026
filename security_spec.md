# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Global Default-Deny**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity & Ownership**: All writes require `isSignedIn()`, `request.auth.token.email_verified == true`, and strict ownership (`request.auth.uid == userId`).
3. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`). `isValidId` is never used on `list` operations.
4. **Master Gate Relational Sync**:
   - Creating, reading, updating, or deleting `/users/{userId}/contacts/{contactId}` requires the parent `/users/{userId}` document to exist and have `data.uid == request.auth.uid`.
   - Creating, reading, updating, or deleting `/users/{userId}/contacts/{contactId}/messages/{messageId}` requires the parent `/users/{userId}/contacts/{contactId}` document to exist and have `data.ownerUid == request.auth.uid`.
5. **Temporal & Immutable Integrity**:
   - On `create`: `incoming().createdAt == request.time && incoming().updatedAt == request.time`.
   - On `update`: `incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time`.
   - Immutable identity fields (`uid`, `ownerUid`, `contactId`) cannot be mutated on `update`.

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Unauthenticated Profile Create)**: Creating `/users/user_1` with `auth == null` -> `PERMISSION_DENIED`.
2. **Payload 2 (Unverified Email Write)**: Creating `/users/user_1` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Payload 3 (Cross-User PII Read)**: User `attacker_1` attempting `get` on `/users/victim_1` -> `PERMISSION_DENIED`.
4. **Payload 4 (Shadow Field Injection on Create)**: Creating `/users/user_1` with an extra undeclared field `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Payload 5 (ID Poisoning Attack)**: Creating `/users/user_1/contacts/invalid$id!@#` -> `PERMISSION_DENIED`.
6. **Payload 6 (Orphaned Contact Create - Master Gate Violation)**: Creating `/users/user_1/contacts/contact_1` when `/users/user_1` does not exist -> `PERMISSION_DENIED`.
7. **Payload 7 (Identity Spoofing in Payload)**: User `user_1` creating `/users/user_1/contacts/contact_1` with `ownerUid: "user_2"` -> `PERMISSION_DENIED`.
8. **Payload 8 (Client Timestamp Forgery)**: Creating `/users/user_1` with a past or future `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Payload 9 (Immortal Field Mutation)**: Updating `/users/user_1/contacts/contact_1` while changing `createdAt` or `ownerUid` -> `PERMISSION_DENIED`.
10. **Payload 10 (Update-Gap / Unauthorized Field Mutation on Message)**: Updating `text` or `senderRole` on an existing message when only `isStarred`, `isPinned`, and `updatedAt` are allowed -> `PERMISSION_DENIED`.
11. **Payload 11 (Value Poisoning on Whitelisted Update Key)**: Updating `isMuted` on `/users/user_1/contacts/contact_1` with a string `"yes"` instead of a boolean -> `PERMISSION_DENIED`.
12. **Payload 12 (Oversized String DoW Attack)**: Creating a message with `text` length > 2000 characters -> `PERMISSION_DENIED`.
