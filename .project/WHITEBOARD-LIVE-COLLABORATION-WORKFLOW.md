# Whiteboard Live Collaboration Workflow

This document is the implementation handoff for taking Whiteboard from its current local-only board/session behavior to secure live collaboration. It explains what exists, what must be built, the order of work, the boundaries between systems, the security rules, and the completion gates. A new engineer or agent should be able to continue from this file without guessing which components are trusted.

## 1. Product boundary and current state

> **Current session requirements (2026-10-20):** Live Collaboration is the only session feature; do not offer or implement a separate Presentation mode. The owner must choose Editor or Viewer for every invitation. Editors and the owner may edit; Viewers are read-only for board content but navigate their own canvas. Maximum membership is 25 people including the owner (up to 24 invitees). A session has no time limit and ends only through the owner's explicit end action. Private invitations remain single-use and expire after 10 minutes. This policy supersedes conflicting older story/task text below.

Whiteboard is a standalone app in `apps/whiteboard`. Its editable board model and editor components live in the reusable `packages/whiteboard` library. The repository also has an Express API in `servers/api` and a server-owned MongoDB integration.

Current state has server-backed identity/sessions, private invites and member admission, plus the first semantic live-edit/persistence slice. It is not yet release-ready collaboration:

- The app asks for verified email identity and calls owner-only create/read/rename/end API routes. MongoDB stores an Active initial snapshot; same-tab reload can restore it.
- The editor connects to one Hocuspocus room per active session. It sends typed semantic edits; API rechecks membership/role, commits an operation plus canonical board/sequence transactionally in MongoDB, then broadcasts the accepted board. Offline operations stay in a session-local queue until accepted.
- The browser confirmed the sign-in dialog and successful link request after matching API `WEB_ORIGIN` to port 3100. A direct local HTTP test completed identity verification and MongoDB session create/read/rename/end. A single browser confirm-link-to-session and reload-restore test remains open.
- MongoDB connection configuration is optional in the API. A configured connection does not itself provide Whiteboard persistence.
- Production email delivery, multi-browser verification, immediate removal/session-end socket revocation, shared undo/redo, cleanup/retention, and hosting limits remain open.

Therefore, a browser-generated room ID, email, role, or UI state must never be treated as proof of authorization. The app's server-session API checks its HttpOnly verified identity cookie; any remaining local demo state is not collaboration authorization.

### Execution status (2026-10-18)

- User confirmed one-time email magic links for owner and invitee identity.
- User clarified the invite journey: the session owner sends an invitation link, and the participant accepts it to join that session. Implement this as a private, email-delivered, single-use invitation action; it must not become a public/reusable room link.
- Added normalized-email and opaque-token rules, MongoDB records/repository for identities, hashed magic-link challenges and hashed server sessions, atomic fixed-window MongoDB rate-limit counters, identity HTTP routes, HttpOnly session cookie issue/revoke, and a development-only loopback mailbox.
- Added WB-S17 server-side session schema, validation, MongoDB repository, service, and owner-only create/read/rename/end routes. Requests derive ownership from the authenticated cookie; active mode is immutable; initial board snapshots are validated as inert structured data. Added an app-owned email-link dialog and verification page, connected session create/rename/end actions to the API, and restore the server's initial snapshot for the active session kept in the current tab. Magic-link secrets use URL fragments and the local mailbox no longer puts email in the request URL. API typecheck/lint/build and 27 API tests pass; shared API types and app typecheck/lint/build pass.
- The development identity endpoints require `MONGODB_URI`; without it they fail closed with 503. The local mailbox is not real email delivery. Production email provider/domain/key are not configured.
- Seven-day server session lifetime and limits of 3 requests per email / 10 per IP per 15-minute fixed window are implementation defaults, not separately confirmed product requirements. They are documented for review. Production identity configuration requires HTTPS, MongoDB, and a stable 256-bit rate-limit HMAC key.
- Identity, invitation acceptance, durable admission (25 members including the owner) and authenticated Hocuspocus transport are implemented. The app is now wired to the semantic command protocol and Mongo operation/snapshot recovery. Multi-browser/session-restart checks, complete invite browser flow, production email, immediate revocation/closure, shared undo/redo, cleanup and deployment limits remain open.

## 2. Confirmed product rules

- Whiteboard owns the server-side session, identity/membership authorization, invitation lifecycle, and board collaboration protocol.
- There is one session feature: **Live Collaboration**. No session mode is selected at creation; Presentation is not a separate feature.
- A session is Active when created, even before invitees accept.
- For every invitation, the owner chooses Editor or Viewer. The selected role is fixed for that membership.
- Role changes require removing the participant and sending a new invitation with the desired role.
- A pending invite does not reserve one of 25 durable member slots (owner plus up to 24 invitees). Accepted membership persists through disconnect until removal or session end.
- A removed participant loses current access and cannot reconnect through old membership or invite credentials.
- No public room-join link is exposed. A private, short-lived email acceptance link is a bearer credential until redeemed and must be handled as a secret.
- Hocuspocus is for realtime room transport; MongoDB is for persistence. They have separate responsibilities.
- MongoDB Atlas is the preferred persistence direction, subject to confirming cost/free-tier limits, region, networking, retention, and backups. Compass is an optional admin GUI only.
- The realtime protocol uses Hocuspocus transport but does not use client-authored Yjs document updates. Semantic command authorization, ordering, Mongo transaction, broadcast-after-commit, idempotency and operation replay are implemented; browser/process restart and revocation gates remain.

## 3. Decisions that must be recorded before implementation

Do not silently choose these in code. Record the decision and consequences in the relevant story/module contract and backlog.

| Decision | Required definition | Gate |
|---|---|---|
| Owner identity | **Confirmed: one-time email magic links.** The verified email establishes identity; session ownership and recovery must still be enforced by the server | Before server-owned sessions or invites |
| Invitee email proof | **Confirmed: one-time email magic links.** The recipient proves control of the invited address before membership is created | Before accepting invitations |
| Secure session | Cookie/token format, lifetime, rotation/revocation, browser storage, CSRF/origin protections, and logout/end behavior | Before issuing identities |
| Email delivery | Pick a no-cost provider for the intended demo or a clearly scoped local mail sink; define sender/domain setup, secrets, failure/retry behavior, and delivery status | Before WB-S18 is considered complete |
| Abuse limits | Per-owner/session/email send limits, resend/cooldown behavior, enumeration-resistant responses, and rate-limit storage | Before enabling invite endpoints |
| Persistence | Choose MongoDB Atlas configuration or a documented local substitute; decide which data must survive process restart and retention/deletion behavior | Before public/restart-safe release; data model contracts before adapters |
| Realtime gate | Prove the selected Yjs/Hocuspocus integration can enforce server authorization and acceptance ordering for Whiteboard commands | Before WB-S22/WB-S24 implementation |
| Async operations | For each added background path, define observable signal, numeric/actionable threshold, owner, and runbook response | Before enabling that path |

An unresolved decision is a release gate, not an implied default. Do not commit credentials, email tokens, database URLs, or generated invite tokens.

## 4. Target ownership and request flow

```text
Whiteboard UI (apps/whiteboard)
        | HTTPS requests with server-issued identity
        v
Whiteboard API (servers/api)
  routes -> controllers -> services -> domain rules
                         |                 |
                         v                 v
                 repositories       email adapter contract
                         |                 |
                         v                 v
                MongoDB adapter      selected mail provider

Realtime client <---- authenticated room protocol ----> Hocuspocus
                         |                                  |
                         +---- authorization/command ------+
                                      |
                                      v
                           server-owned session rules

MongoDB persists sessions, identity/membership, invitations,
accepted operations, and snapshots according to their story gates.
```

The exact realtime adapter shape depends on the technical gate. Do not let the UI talk directly to MongoDB or the email vendor. Do not make Hocuspocus the identity authority. Every room join and edit must be authorized by Whiteboard-owned server rules.

Server feature code belongs under `servers/api/features/<feature>/` and is composed in `servers/api/bootstrap/create-app.ts`. Start with feature-owned code and add route/controller/service/repository/model/integration layers only when their responsibilities exist. Keep vendor code behind explicit integration contracts. Do not move feature behavior into the monorepo control plane or create a package just to represent a pattern.

## 5. End-to-end user flows

### 5.1 Owner creates a live session

1. Owner opens a blank board, built-in template, or validated Whiteboard XML board.
2. Owner enters a title for the Live Collaboration session.
3. The client submits the board snapshot and creation options to the Whiteboard API over the configured origin.
4. The server authenticates/establishes the owner, validates the board and title, assigns server-controlled session and owner identifiers, and creates an Active session.
5. The response returns only the authorized session view and server-issued identity/session credential. The browser cannot choose its own trusted owner ID or session status.
6. The session remains a Live Collaboration session until the owner ends it. Rename and end operations are owner-authorized server commands.

**Failure behavior:** validation/authentication failure leaves the current local board unchanged and does not claim a session was created. API/database failures are visible; the client does not show a server session as Active until server confirmation. A retry must not accidentally create duplicate sessions; define request idempotency if retries can repeat creation.

### 5.2 Owner invites someone (WB-S18/WB-S19)

1. Owner opens invite UI for an Active session. Owner authorization is checked by the API, not inferred from UI visibility.
2. Owner enters an email. The owner must choose Editor or Viewer.
3. API normalizes the email for comparison, validates session status and role policy, applies rate limits, and checks duplicate/pending invite behavior.
4. The server generates a cryptographically random, single-use secret. It stores only a secure hash and binds the invitation to session, normalized email, fixed role, creator, creation/sent time, expiry, cancellation and acceptance state.
5. The invite expires exactly ten minutes after the defined send/issue timestamp. Define the timestamp semantics once and test boundary behavior.
6. The email adapter sends an Accept invitation action. The URL is a private, unguessable, short-lived credential, not a reusable public room link. Never put role or authorization claims in client-controlled query parameters.
7. UI exposes a pending/sent/failed/expired/cancelled/accepted status as applicable. A send failure is not displayed as sent. Retry semantics must not unintentionally mint multiple valid invitations or send duplicate emails.
8. Owner can cancel a pending invite. Server cancellation takes effect immediately and invalidates that invite even if its email was already delivered.
9. Invitations may be created after the session becomes Active. An invite does not reserve a participant seat.

### 5.3 Invitee accepts and establishes identity (WB-S20)

1. Invitee opens the Accept invitation action. Do not consume the token merely because a mail scanner or preview fetched the URL; use a deliberate confirmation/exchange step.
2. Server hashes the presented secret and atomically checks matching invitation, session Active state, email-proof requirement, expiry, cancellation, prior acceptance, role, and current membership/removal state.
3. The chosen email-proof mechanism verifies control of the invited email. A name typed into the browser is not email verification.
4. Server atomically consumes the invite once, creates server-side identity and session membership with the fixed role, and returns a secure authenticated session. Concurrent acceptance attempts must not both succeed.
5. Collect display name; render initials avatar. Do not accept a client-provided email/role as authority.
6. Another device must re-verify the same email/identity according to the chosen login/session design. Removed members cannot rejoin using old membership.
7. If the invite is expired, cancelled, already used, malformed, revoked, or its session is closed, show a clear safe error and make no membership/session change.

After the one-time invitation is accepted, the participant can later sign in again with the same verified email. Whiteboard lists that identity's active session memberships and the participant chooses which board to rejoin. A removed member is absent from the list and the server denies any stale session ID.

### 5.4 Join, edit, reconnect, and removal (WB-S21–WB-S27)

1. Room connection presents a server-issued identity credential. Server checks identity, session active state, membership, role, removal/revocation, and seat availability before joining.
2. Maximum session membership is 25 identities including the owner (up to 24 invitees). Pending invites do not count. Atomically consume an invitation and add the verified member; disconnect does not free membership or a slot.
3. Presence is session-scoped and transient: connected users/names/initials and Editor/owner cursors as defined. Viewer cursors are not shown. Presence is excluded from XML and durable board history.
4. Every edit/owner command is validated and authorized server-side. Viewer edits, spoofed roles, client-selected user IDs, and room IDs as credentials are rejected.
5. Server accepts edits in deterministic server order. Define semantic commands/action IDs and same-object/property conflict rule. Do not claim an edit is accepted/saved before the relevant acknowledgement/persistence rule is met.
6. Reconnect authenticates again, loads current accepted state/sequence, then replays eligible queued edits through the same authorization and ordering path. Surface edits that cannot be safely replayed.
7. Shared Undo/Redo is a server-ordered semantic action history, one entry per meaningful gesture; do not assume a CRDT's default local undo satisfies shared history.
8. Persist snapshots and accepted operations. After restart, load the latest snapshot and replay later accepted operations. Presence is not restored as durable state.
9. End-session authorization invalidates room access, invitations, and reconnect credentials. Cleanup/deletion is retryable and observable; sessions do not expire by time. Atlas backup retention remains an account-level setting.

## 6. Data and security contracts

These are minimum logical fields/rules, not a locked database schema. Final schema/indexes belong to the owning feature and must be reviewed for query/race behavior.

### Session

- Server-generated stable session ID; server-generated owner identity reference.
- Title, lifecycle status (`active`/`closed` at minimum), created/updated/ended timestamps. There is no session mode.
- Initial board data validated using the Whiteboard-owned XML/model validators; never execute imported markup.
- Authorization is derived from verified identity plus stored ownership/membership, never from a submitted `ownerId`, role, or room name.

### Invitation

- Stable invitation ID, session ID, normalized recipient email, fixed role, owner identity/creator ID.
- Token hash only; never store/log the raw bearer token after delivery construction.
- Created/issued/sent timestamps, expiry timestamp, cancellation timestamp/reason where appropriate, acceptance timestamp and accepted identity reference, delivery state.
- Single-use transition must be atomic. A cancelled, expired, accepted, closed-session, or revoked invite cannot be reused.
- Rate-limit and duplicate-invite semantics must be documented. Avoid leaking whether arbitrary emails have accounts.

### Membership and authenticated identity

- Server-owned identity ID and verified email proof state; display name is user-facing metadata, not authority.
- Session membership has a fixed role and explicit active/removed state with timestamps.
- Revocation immediately affects active connection and all later commands/reconnect attempts.
- Session credential must be protected against XSS/CSRF/replay according to selected cookie/token design. Configure origin/CORS and CSRF protections to match that design; CORS alone is not authentication.

### Realtime and persistence

- Room/session IDs are routing identifiers, not secrets.
- Authorize at initial join and at every mutation boundary. If realtime messages bypass Express middleware, the same server-owned policy must be invoked inside the realtime adapter.
- Store accepted sequence/action identifiers and snapshot watermarks so replay is deterministic and idempotent.
- Do not persist presence or claim failed writes as accepted/durable.
- Keep secrets in validated server environment/configuration, never in the browser bundle or repository.

## 7. Recommended implementation sequence and gates

Story numbers are product grouping; dependency order can require prerequisite work to land first. Record cross-story work in the backlog and update affected stories rather than falsely checking boxes.

### Phase A — Decisions and boundary design

1. Reconfirm standalone Whiteboard owns API/session services; document local demo versus shared session behavior.
2. Owner and invitee identity approach is confirmed as email magic links. Cookie security and initial rate limits now have documented implementation defaults; confirm/adjust them before external release. Email provider/domain/key and persistence/retention remain gates.
3. Write module contract and threat/abuse cases: owner spoofing, invite-token leakage, email enumeration, replay, CSRF, cross-origin abuse, session closure, and concurrent acceptance/seating.
4. Gate: no invitation UI/token path until server can prove owner authority and enforce rate limits.

### Phase B — Whiteboard server session and owner identity foundation

1. Add a Whiteboard session feature to `servers/api` with validated request/response contracts and functional services.
2. Implement the selected identity/session boundary. Do not trust current browser-generated WB-S17 owner ID.
3. Create/read/rename/end session endpoints with server ownership checks and lifecycle validation.
4. Validate board source data before creating a session; keep local-only behavior clearly separate while migration is in progress.
5. Add feature-level deterministic service/controller tests and HTTP boundary tests using injected repositories/integrations.
6. Gate: another browser cannot gain owner rights by changing IDs or request payloads; session create/reload/rejoin behavior is explicitly defined.

### Phase C — Invitation lifecycle and mail boundary (WB-S18/WB-S19)

1. Implement invitation domain rules and server-owned storage contract: create, list/status, cancel, expire, accept transition.
2. Implement cryptographic token generation, hash-at-rest, ten-minute expiry, email/session/role binding, atomic single-use acceptance, and cancel/close invalidation.
3. Add replaceable email adapter; select provider/local sink and keep credentials server-only. Define failure, retry, and idempotency behavior.
4. Add owner UI: Live Collaboration defaults Editor; requires explicit Editor/Viewer; status/cancel; no public room join link.
5. Make owner check and abuse limits part of each invitation endpoint. Never make UI-only authorization.
6. Gate: test invalid, future-version/malformed, expired, cancelled, duplicate, already accepted, wrong email proof, closed-session, and concurrent acceptance cases. Verify failed mail is not reported sent.

### Phase D — Verified participant identity, seats, and server authorization (WB-S20/WB-S21/WB-S23)

1. Complete email proof and issue secure server identity/session.
2. Store membership and fixed role; implement cross-device rejoin and removal/revocation.
3. Enforce atomic 25-member admission; pending invites do not reserve slots. (MongoDB now persists owner and accepted members; invitation consumption plus member insertion use a transaction. Connection leases only track active sockets and disconnect does not affect membership.)
4. Enforce identity, session, role, membership, seat, and revocation for every room join and command. (The Hocuspocus join checks verified cookie, exact Origin, active session and membership; Viewer Yjs updates are denied. Immediate owner revocation and room closure are still pending.)
5. Gate: manual request tampering and race tests cannot join as another user, exceed six participants, or edit as Viewer.

### Phase E — Realtime protocol and presence (WB-S22/WB-S24)

1. Run a focused Hocuspocus technical spike for room isolation, auth, server authorization, update validation, ordering, persistence acknowledgement and shutdown. (Auth, role gating, server-derived awareness, bounded payload, graceful destroy and a semantic stateless command path are wired. Raw Yjs updates are rejected; two-browser room isolation and socket tampering remain unverified.)
2. Record protocol decisions and limitations before dependent features.
3. Integrate one room per active session; keep room auth tied to server-issued identity and current authorization policy.
4. Implement presence/cursors separately from durable board data. Suppress Viewer cursors.
5. Semantic edit commands now assign server sequence and merge property-level changes. Mongo operation, canonical board and sequence commit in one transaction before broadcast. Rate limit: 600 messages/socket/60 seconds.
6. Gate: verify in browsers that same-property edits follow server order, independent edits merge, and rejected/unpersisted edits stay visibly queued. Raw Yjs bypass and Viewer attempts also need real socket checks.

### Phase F — Reconnect, shared history, persistence, and closure (WB-S25–WB-S28)

1. Define disconnected status and offline operation eligibility/replay/conflict UX.
2. Implement server-authenticated reconnect and deterministic replay.
3. Implement shared semantic Undo/Redo in server order.
4. MongoDB repository now stores semantic operations, canonical board state, sequences, indexes and periodic board snapshots (every 100 accepted operations); session reads replay later contiguous operations. Keep credentials server-side.
5. Direct development Mongo integration verified concurrent edit sequencing, idempotent retry and operation replay. A 100-operation snapshot cadence and BSON document budget have automated size-boundary coverage. Still verify a real Hocuspocus process restart and confirm Atlas deployment/retention/backup limits.
6. End-session flow closes room access and credentials; cleanup can retry safely. Sessions remain active until owner end; separately document configured database-backup retention before public release.
7. Gate: API/realtime process restart recovers valid session state; persistence failures are visible and never reported as saved.

### Phase G — Superseded presentation work and bounded demo (WB-S29–WB-S34)

Presentation viewport-following stories/tasks in the legacy roadmap are superseded. Keep the shared Live Collaboration behavior: owner and Editors can edit; Viewers are read-only and navigate independently. Sessions have no time-based expiry.

1. Add owner-follow viewport and Viewer controls only after role enforcement and room authorization.
2. Implement owner operations, session closure, and participant removal under the same authorization policy.
3. Run the bounded demo checklist against actual intended deployment limits, email delivery, identity, persistence, expiry, cleanup, and recovery.
4. Gate: do not publicly expose the demo while no-cost hosting, identity, durable state, retention, or abuse-control gates remain unresolved.

## 8. Validation and completion checklist per change

Use the repository workflow `UNDERSTAND -> PLAN -> IMPLEMENT -> VALIDATE -> REVIEW -> RECORD -> COMPLETE`.

For every story/change:

- Read `AGENTS.md`, `architecture.yaml`, the relevant architecture/integration/type/testing guides, story acceptance criteria, task list, and existing backlog entry.
- Inspect the owning unit with `node codebase/cli/repo.mjs projects --json` and task ordering with the control plane before choosing commands.
- Implement only the story's owned behavior plus explicitly recorded prerequisite work. Preserve package/app/server dependency boundaries.
- Validate input at HTTP and persistence boundaries. Use feature contracts and runtime schemas; do not spread `any` or trust client assertions.
- Run the smallest useful declared repository tasks (typecheck/lint/build and relevant existing tests). Run browser verification for changed user flows when the app can be exercised.
- Review authorization, data exposure, error handling, race behavior, dependency diff, and logs for secrets/PII.
- Update affected module contract, runbook, and user-facing docs in the same change. Record every deferred finding in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with scope, reason, owner/dependency, and resume condition.
- Introduce no new critical/high security findings.
- For every asynchronous/background path, document its signal, numeric/actionable threshold, and specific runbook response. Email send, cleanup, snapshot, replay, and retry paths each need their own operational behavior if implemented asynchronously.
- Do not mark a story complete because a plan exists or a UI is present. Acceptance criteria and DoD must be evidenced; unresolved release gates remain explicit.

## 9. Observability and runbook requirements

Before enabling an async/background operation, its change must define:

1. **Signal:** structured, privacy-safe event/metric that shows queued, attempted, succeeded, failed, retried, timed out, or degraded state. Never log raw invitation token, full email unnecessarily, auth cookie, or credential.
2. **Threshold:** an explicit numeric threshold/time window that distinguishes normal transient behavior from actionable failure. Choose and justify it from demo expectations and provider/database limits; do not leave “monitor errors” as the threshold.
3. **Runbook action:** where to inspect health/logs, safe retry/recovery procedure, how to prevent duplicate invitation/operation effects, and when to disable the feature or notify the owner.

At minimum, the relevant runbook should eventually cover email delivery failures, invitation expiry/cancellation, rate limiting, MongoDB unavailable/write failures, Hocuspocus disconnect/restart, snapshot/replay failures, cleanup retry, and credential rotation. Only include paths that the code actually implements; update the runbook with the same change.

## 10. Current next step

Do **not** expose the current APIs as a complete collaboration system. The app provider, semantic server ordering, persist-before-broadcast behavior and operation replay are implemented, with focused Mongo integration checks. Next verify two authenticated browser participants, same-property conflict convergence, offline reconnect, Viewer/raw-Yjs tampering, room isolation and Hocuspocus restart. Then close immediate revocation/session-end socket behavior, shared undo/redo, queue bounds/replay recovery, operation/snapshot cleanup and deployment/retention gates. Production invitation mail remains blocked on provider setup and verified sender credentials.

## 11. Source of truth

This workflow supplements, and does not replace, the story acceptance criteria, task breakdown, backlog, or repository architecture policy. If this file conflicts with confirmed acceptance criteria or `AGENTS.md`/`architecture.yaml`, update this workflow and preserve the higher-authority source.

- Stories and DoD: `.project/WHITEBOARD-STORIES-ACCEPTANCE-AND-DOD.md`
- Tasks/subtasks: `.project/whiteboard-review/WHITEBOARD_TASKS_AND_SUBTASKS.md`
- Deferred gates: `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md`
- Server architecture: `.agent/instructions/architecture.md`
- Integration ownership: `.agent/instructions/integrations.md`
- API composition: `servers/api/bootstrap/create-app.ts`
- Current API features: `servers/api/features/`
- MongoDB integration: `servers/api/integrations/mongodb/`

