/**
 * Security Rules Verification Suite (Phase 0 TDD)
 * Documents the 12 Dirty Dozen adversarial test payloads and expected PERMISSION_DENIED outcomes.
 */

export interface SecurityTestPayload {
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update';
  actor: { uid: string; email: string; email_verified: boolean };
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const dirtyDozenPayloads: SecurityTestPayload[] = [
  {
    name: '1. Self-Verify Shadow Field',
    collection: 'users/userA',
    operation: 'create',
    actor: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { uid: 'userA', isVerified: true, role: 'admin' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified Email Spoof',
    collection: 'reports/rep1',
    operation: 'list',
    actor: { uid: 'attacker', email: 'israrwazeer89@gmail.com', email_verified: false },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '3. PII Cross-Read',
    collection: 'users/userA/private/info',
    operation: 'get',
    actor: { uid: 'userB', email: 'b@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '4. Identity Spoofing on Exchange',
    collection: 'exchangeRequests/req1',
    operation: 'create',
    actor: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { fromUid: 'userB', toUid: 'userC', status: 'pending' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '5. Self-Exchange Attack',
    collection: 'exchangeRequests/req2',
    operation: 'create',
    actor: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { fromUid: 'userA', toUid: 'userA', status: 'pending' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '6. Orphan Exchange Target',
    collection: 'exchangeRequests/req3',
    operation: 'create',
    actor: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { fromUid: 'userA', toUid: 'nonExistentUser999', status: 'pending' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '7. State Shortcutting',
    collection: 'exchangeRequests/reqPending',
    operation: 'update',
    actor: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { status: 'accepted' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '8. Terminal State Tampering',
    collection: 'exchangeRequests/reqCompleted',
    operation: 'update',
    actor: { uid: 'userB', email: 'b@example.com', email_verified: true },
    payload: { status: 'pending' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '9. Unauthorized Message Injection',
    collection: 'conversations/convAB/messages/msg1',
    operation: 'create',
    actor: { uid: 'userC', email: 'c@example.com', email_verified: true },
    payload: { senderId: 'userC', text: 'Intrusion attempt' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '10. Fake Review Fabrication',
    collection: 'reviews/rev1',
    operation: 'create',
    actor: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { exchangeId: 'nonExistentExchange', reviewerId: 'userA', revieweeId: 'userB', rating: 5 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '11. ID Poisoning / Resource Exhaustion',
    collection: `users/${'x'.repeat(200)}`,
    operation: 'create',
    actor: { uid: 'userA', email: 'a@example.com', email_verified: true },
    payload: { bio: 'y'.repeat(5000) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    name: '12. Blanket Collection Scrape',
    collection: 'notifications',
    operation: 'list',
    actor: { uid: 'userA', email: 'a@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
