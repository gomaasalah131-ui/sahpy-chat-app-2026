/**
 * Dirty Dozen Security Specification Verification Suite
 * Verifies all 12 adversarial payloads defined in security_spec.md return PERMISSION_DENIED.
 */

export interface SecurityPayloadTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_TESTS: SecurityPayloadTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Profile Create',
    collectionPath: '/users/user_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { uid: 'user_1', displayName: 'Anon' },
  },
  {
    id: 2,
    name: 'Cross-User PII Read',
    collectionPath: '/users/victim_1',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Duplicate Username Hijack',
    collectionPath: '/usernames/salah_gomaa',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { uid: 'attacker_1', username: 'salah_gomaa' },
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Create',
    collectionPath: '/users/user_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {
      uid: 'user_1',
      displayName: 'User',
      username: 'user_1',
      email: 'user1@gmail.com',
      phoneTag: '+201094823190',
      bio: 'Bio',
      wallpaperTheme: 'aurora-borealis',
      emailVerified: true,
      phoneVerified: true,
      isAdmin: true,
    },
  },
  {
    id: 5,
    name: 'ID Poisoning Attack',
    collectionPath: '/users/user_1/contacts/invalid$id!@#',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Chat Creation with Non-Existent User',
    collectionPath: '/chats/user_1_fake_user',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: {
      chatId: 'user_1_fake_user',
      participantOneUid: 'user_1',
      participantTwoUid: 'fake_user',
    },
  },
  {
    id: 7,
    name: 'Unauthorized Third-Party Message Read',
    collectionPath: '/chats/user_1_user_2/messages/msg_1',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client Timestamp Forgery',
    collectionPath: '/users/user_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { createdAt: '1999-01-01T00:00:00Z' },
  },
  {
    id: 9,
    name: 'Immortal Field Mutation',
    collectionPath: '/usernames/salah_gomaa',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { uid: 'hijacked_uid' },
  },
  {
    id: 10,
    name: 'Update-Gap Unauthorized Field Mutation on DirectMessage',
    collectionPath: '/chats/user_1_user_2/messages/msg_1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { text: 'Tampered message text' },
  },
  {
    id: 11,
    name: 'Value Poisoning on Whitelisted Update Key',
    collectionPath: '/users/user_1/contacts/contact_1',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { isMuted: 'yes_string_instead_of_bool' },
  },
  {
    id: 12,
    name: 'Oversized String DoW Attack',
    collectionPath: '/chats/user_1_user_2/messages/msg_1',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { text: 'x'.repeat(2500) },
  },
];
