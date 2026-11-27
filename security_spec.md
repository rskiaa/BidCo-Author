# BidCo-Author Security Specification & Threat Invariants

## 1. Core Data Invariants
1. **Organization Isolation**: Every tender, document, chunk, analysis, eligibility report, proposal, financial model, risk report, activity log, and notification belongs to a single `orgId` and may only be read or mutated by verified members (`ownerId` or `memberUids`) of that organization.
2. **Identity Integrity**: No user may spoof `ownerId`, `uid`, or `actorUid` on creation or reassign `ownerId` / `createdAt` / `orgId` after creation.
3. **Role Protection (Anti-Privilege Escalation)**: Users cannot self-assign `admin` role in `/users/{userId}` on creation (must be `bid_manager`, `reviewer`, or `viewer`, unless creating their own primary organization where they are `ownerId` of `/organizations/{orgId}`), and cannot modify `role` on `/users/{userId}` without admin approval.
4. **Temporal & Volumetric Integrity**: All `createdAt` and `updatedAt` timestamps must equal `request.time`. All document IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and all strings and arrays have explicit upper bounds.
5. **No Unscoped List Queries**: Every `allow list` rule evaluates `resource.data.ownerId == request.auth.uid || request.auth.uid in resource.data.memberUids` directly against `resource.data` without `get()` or `exists()`.

## 2. The "Dirty Dozen" Adversarial Test Payloads
1. **Cross-Tenant Read/Write**: Authenticated User B attempts `get` or `create` under `/organizations/org_A/tenders/t1` where `org_A.ownerId == User A` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection**: User A creates a tender with an undeclared field `isApprovedOverride: true` -> `PERMISSION_DENIED` via `keys().hasOnly(...)`.
3. **Ghost Key Update**: User A updates a tender with an extra key `ownerId: "user_B"` -> `PERMISSION_DENIED` via `affectedKeys().hasOnly(...)` and immutability check.
4. **Identity Spoofing**: User A creates an `ActivityLog` with `actorUid: "user_B"` -> `PERMISSION_DENIED`.
5. **Self-Privilege Escalation**: User B creates `/users/user_B` with `role: "admin"` -> `PERMISSION_DENIED`.
6. **Unverified Email Bypass**: User with `email_verified: false` attempts write or `isAdmin()` check even with admin email string -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Client submits a 300-character or slash-containing `tenderId` -> `PERMISSION_DENIED` via `isValidId()`.
8. **Timestamp Forgery**: Client sends `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()` -> `PERMISSION_DENIED` via `incoming().createdAt == request.time`.
9. **Type / Size Poisoning on Update**: User updates `title` with a boolean or a 10,000-char string -> `PERMISSION_DENIED` because `isValidTender(incoming())` wraps the entire update block.
10. **PII Blanket Scraping**: User B queries `list` on `/users` -> `PERMISSION_DENIED`.
11. **Unbounded Array Injection**: User submits 200 items in `memberUids` or `certifications` -> `PERMISSION_DENIED` via `.size() <= 20` / `<= 25`.
12. **Terminal State Mutation**: Non-admin user attempts to mutate a `Submitted`, `Won`, or `Lost` tender's `referenceNumber` or `sourceType` -> `PERMISSION_DENIED`.
