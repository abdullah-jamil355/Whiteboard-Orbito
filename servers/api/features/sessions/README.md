# Whiteboard Session Feature Contract

## Ownership

This feature owns server-side Live Collaboration session lifecycle: creation from a validated canonical board snapshot, title, Active/ended status, durable member identities, owner-only rename/end, and active-member snapshot reads. There is no separate Presentation session mode or session lifetime cutoff. Identity authentication remains owned by `features/identity`; the client never chooses the trusted owner identity. Invitation membership is owned by `features/invitations` and injected as an access check for session reads. Realtime connections are transient leases and do not determine membership or capacity.

## HTTP contract

Mutations require the configured exact `Origin` and a valid HttpOnly `wb_session` cookie. `GET` also requires the cookie and is available to the owner or an accepted, non-revoked session member.

| Method and path | Behavior |
|---|---|
| `POST /sessions` | Accepts `{ title, board }`; validates a complete canonical board snapshot, assigns the owner from the verified cookie, and persists an Active session. |
| `GET /sessions/:sessionId` | Returns the active session to its owner or an accepted, non-revoked member. |
| `GET /sessions/mine` | Lists active sessions that include the identity from the verified HttpOnly cookie, newest activity first. It returns only session identifiers, title, sequence, and update time; it never accepts an identity from the request. |
| `PATCH /sessions/:sessionId` | Owner-only title change. |
| `DELETE /sessions/:sessionId` | Owner-only end; marks the session ended, closes the room, deletes invitation rows and then operation/snapshot/session records. An optional `{ expectedSequence }` body atomically closes only the exported accepted revision; mismatch returns `409 session_revision_changed` without closing. Omit it for an explicit end without XML. |

The session persists its owner and accepted member identities independently of connection state. Capacity is 25 members total (owner plus up to 24 invitees); accepted members remain until explicit removal or owner end. Sessions have no time-based expiry and remain active until the owner explicitly ends them. Previously stored legacy `mode` and `expiresAt` fields are ignored; active sessions remain usable without a data rewrite. The board is structured JSON data; script-bearing/unknown object types and unknown properties are rejected. Object IDs are unique within the board and references to contained shapes must resolve. The API imposes coordinate, text, object-count, and geometry limits. The request body also remains bounded by the API JSON body limit. After owner end commits, the session service closes that room's currently connected sockets immediately.

Every persisted board document and accepted operation is checked against an 8 MiB BSON safety budget before a MongoDB write. A board/session creation over budget returns HTTP `413 board_too_large`; a realtime edit or history action that would exceed it is rejected before any operation, board, history, or sequence write is committed. This keeps both the session document/snapshot and single operation records below MongoDB's 16 MiB document ceiling with headroom for record metadata.

Realtime edits use server-owned semantic changes rather than raw Yjs document writes. The repository transaction rechecks active membership, assigns a monotonically increasing sequence, stores an idempotent action record, and updates the canonical board before returning. Concurrent transactions retry against the latest board; same-property changes use last accepted write wins while independent properties are preserved. Every 100th accepted operation stores a board snapshot. Reads recover the board from the latest snapshot plus contiguous later operations and fail closed if a sequence gap exists. Owner end deletes operation, shared-history, and snapshot records.

Live Undo/Redo is server-owned and distinct from the local editor's in-memory history. Each meaningful accepted edit stores its actor, server sequence, forward operation, inverse, and guards for the affected board fields/objects. A session history record keeps the undo and redo action IDs, bounded to the latest 500 undoable actions. Owner and Editor requests run through the same transaction as board mutation and sequence assignment; the server rechecks active membership, rejects Viewer requests, and broadcasts the new board plus `canUndo`/`canRedo` state only after commit. Undo checks that changed fields still have the values written by that action; if a later edit makes its inverse unsafe, the transaction aborts without changing the board. A new accepted forward edit clears Redo. Undo/Redo operations are themselves sequenced semantic operations, so snapshot replay reconstructs the current board after restart.

## Persistence and failure behavior

Sessions are stored in MongoDB through this feature's repository and model. The API creates the session index before listening. If MongoDB is not configured, unavailable, or a write fails, session endpoints fail closed with `503`; no browser-only success is reported. Unauthorized access returns the same safe `404` as a missing session. Owner end first persists the ended status, closes existing realtime sockets, deletes invitation/member rows, then operations, snapshots and the session. A cleanup failure leaves the inaccessible ended marker; the owner can retry ending the session. **Signal/threshold:** any owner-end cleanup failure is logged at error level and is actionable immediately. **Response:** restore MongoDB/API availability, inspect the session ID and cleanup stage from the structured log, then retry the owner's end request and confirm the session and related invitation/operation/history/snapshot rows are removed. There is no session-expiry background monitor. Database backups follow the configured Atlas backup retention and are outside this live-record cleanup promise.

The Whiteboard UI requests identity verification and calls these endpoints. A direct MongoDB collaboration integration verified concurrent independent edits, server sequence ordering, duplicate-action idempotency and operation replay after rereading the stored session. Multi-browser verification and a live Hocuspocus process restart remain open. Offline queued client edits are provisional until the server accepts and durably commits them.

Participants who sign in from a different browser can discover active memberships through `GET /sessions/mine`, then fetch the selected board through the normal membership-checked session read. Revocation removes the identity from the session membership index, so it no longer appears in this list and a direct stale session ID is denied.

## Security and operations

- Owner identity is read from the server-validated cookie session, never a request body or URL.
- Authenticated session responses use `Cache-Control: no-store`.
- Mutation requests require the exact configured web origin.
- Do not log board contents, cookies, auth tokens, or request bodies.
- Session creation and each realtime board edit use MongoDB transactions. Connection lease refresh/release runs asynchronously in the realtime feature and is governed by its runbook signal/threshold/response.
