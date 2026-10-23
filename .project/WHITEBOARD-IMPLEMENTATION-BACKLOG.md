# Whiteboard V1 Tasks and Subtasks

**Source:** `D:\Codatory\WHITEBOARD_USER_STORIES.md`
**Prepared:** 13 October 2026
**Scope:** Break down all source stories into implementation tasks and reviewable subtasks. This is a planning artifact; it does not authorize Squid integration, paid services, or public deployment.

## How to use this backlog

> **Current session requirements (2026-10-20):** Live Collaboration is the only session feature; do not offer or implement a separate Presentation mode. The owner must choose Editor or Viewer for every invitation. Editors and the owner may edit; Viewers are read-only for board content but navigate their own canvas. Maximum membership is 25 people including the owner (up to 24 invitees). A session has no time limit and ends only through the owner's explicit end action. Private invitations remain single-use and expire after 10 minutes. This policy supersedes conflicting older story/task text below.

- Keep each task linked to its source story ID (`WB-Sxx`). Subtask IDs use `WB-Sxx-Tyy-STzz`.
- Complete tasks in the sequence below unless an implementation gate blocks its dependent work.
- “Verify” subtasks describe acceptance evidence; they do not claim the behavior is already implemented.
- Resolve only the decisions needed by the capability being built. Keep public release gated on the open security, identity, hosting, retention, and operational decisions in the source backlog.
- Stories marked Deferred remain planning-only until separately authorized.

## 1. Standalone workspace and board creation

### WB-S01 - Open Whiteboard independently

- **WB-S01-T01: Establish the standalone Whiteboard app boundary.**
  - ST01: Inspect workspace layout and choose the smallest app location that does not mix Whiteboard into Squid product flows.
  - ST02: Add an independent app entry point and local development command with explicit dependencies/configuration.
  - ST03: Verify the app opens without Squid login, services, or workspace context.
- **WB-S01-T02: Document and enforce the future host boundary.**
  - ST01: Define the minimal Whiteboard-owned host adapter contract without wiring it to Squid.
  - ST02: Verify Whiteboard code has no imports or runtime dependencies on Squid identity, navigation, or backend.

### WB-S02 - Create a blank board

- **WB-S02-T01: Define initial board state and title behavior.**
  - ST01: Create a canonical blank-board factory with one canvas and the `Untitled` title.
  - ST02: Add local-only title editing and preserve the single-canvas model.
  - ST03: Verify creating a normal board makes no server or persistence request.

### WB-S03 - Start from a built-in template

- **WB-S03-T01: Model and catalog the V1 built-in templates.**
  - ST01: Define template data using the Whiteboard document model.
  - ST02: Add all 12 catalog entries: blank, organization chart, ERD, mind map, Kanban, flowchart, cross-functional flowchart, workflow, data flow, UML sequence, use case, and activity.
  - ST03: Verify each template is structurally valid and has stable object identifiers when instantiated.
- **WB-S03-T02: Instantiate editable template copies.**
  - ST01: Clone template content into a new board with fresh object IDs.
  - ST02: Verify edits to a created board never mutate the built-in source template.
  - ST03: Keep user-uploaded templates and draw.io template import out of the V1 catalog/flows.

**Implementation note:** WB-S03 now has the Whiteboard-owned 12-template catalog, picker, and independent board/object ID cloning. Template model cloning copies nested geometry, style, points, and endpoints so future editor changes cannot mutate catalog data through shared references. With WB-S08 connector rendering and editing implemented, template connectors are editable as well; this dependency is resolved.

## 2. Canvas, drawing, and editing

### WB-S04 - Draw freehand marks

- **WB-S04-T01: Implement pen input and stroke representation.**
  - ST01: Capture pointer samples as one Whiteboard stroke object using current palette color and weight.
  - ST02: Render strokes on the canvas and keep the selected style available to the drawing tool.
  - ST03: Verify one completed stroke is one local history gesture, independent of sample count.

**Implementation note:** WB-S04 is implemented with palette/weight controls, canvas-space pointer sampling, stroke rendering and XML persistence, plus one undo/redo history entry per completed stroke. Broader local history for non-stroke editor actions remains WB-S13 scope.

### WB-S05 - Add and resize basic shapes

- **WB-S05-T01: Implement rectangle, circle, and diamond creation.**
  - ST01: Add tool selection and pointer-based placement for each supported shape.
  - ST02: Map shapes to stable Whiteboard object types rather than editor-specific types.
- **WB-S05-T02: Preserve shape identity during resize.**
  - ST01: Add resize handles and geometry updates for all three shapes.
  - ST02: Verify circle remains a circle and rotation controls are absent/not required in V1.

**Implementation note:** Added rectangle, circle, and diamond toolbar tools; pointer-drag creation with a visible preview; canonical Whiteboard shape objects with stable IDs; SVG rendering; select-to-show corner handles; and resize geometry that preserves the selected shape kind and constrains circles to equal width and height. Rotation remains unavailable. Text, lines, arrows, and connectors now render and support the local editor interactions; WB-S08 resolved the template connector dependency, so template copies can be edited as normal boards.

**Verification follow-up (resolved):** The user confirmed the shapes appear and shared a screenshot where a circle rendered as a horizontal oval. The cause was non-uniform SVG viewport scaling. The implementation now uses aspect-preserving SVG scaling and maps pointer coordinates through the screen transform. After refreshing, the user confirmed the circle looks correct. Typecheck, lint, and production build passed. No further browser follow-up is recorded for WB-S05.

### WB-S06 - Add text and write inside shapes

- **WB-S06-T01: Implement standalone text and shape-bound text.**
  - ST01: Define text content/style and optional containing-shape binding in the document model.
  - ST02: Add text creation/editing on canvas and inside regular or template shapes.
  - ST03: Verify moving a shape moves its bound text without changing the shape type.
- **WB-S06-T02: Implement text layout and formatting.**
  - ST01: Support wrapping, left/center/right alignment, font size, and bold.
  - ST02: Run the early editor-fit check for required in-shape text behavior; reassess the adapter/engine if blocked.

**Implementation note:** The Text tool creates standalone or parent-bound text, reopens existing text for editing, and supports wrapping, alignment, size, and bold. Select mode visibly selects text on one click, moves it on drag, and enters editing on double-click or the Edit text action; shape move/resize gestures also carry bound text geometry. Text renders safely inside bounded SVG foreign objects. TypeScript and ESLint pass. Next production build was blocked by Windows path canonicalization access denial in Turbopack; browser visual interaction remains to be checked. No asynchronous behavior was introduced.

### WB-S07 - Style shapes, text, and lines

- **WB-S07-T01: Add the fixed style palette and line weights.**
  - ST01: Define palette tokens and apply them to fills, outlines, arrows/connectors, text, and pen strokes.
  - ST02: Support transparent/no-fill and thin/medium/thick line weights; omit custom color picker.
  - ST03: Verify style updates do not change object type.
- **WB-S07-T02: Render grid behind objects with shape occlusion.**
  - ST01: Add the persistent light graph-paper canvas background.
  - ST02: Ensure shape interiors occlude the grid, including transparent/no-fill shapes.
  - ST03: Treat transparent-shape grid occlusion as an editor-fit gate and stop/reassess if it cannot be met.

**WB-S07 completion note:** WB-S08 now provides line, arrow, and connector drawing with the shared palette and line-weight controls. The old dependency is resolved. Arrow and connector styles persist in the existing V1 XML model. No remaining WB-S07 acceptance criterion is known to be deferred.

### WB-S08 - Draw lines, arrows, and attached connectors

- **WB-S08-T01: Add straight lines, arrows, and orthogonal connectors.**
  - ST01: Define connector objects and endpoint geometry in the canonical model.
  - ST02: Add creation tools for straight line, arrow, and 90-degree connector.
- **WB-S08-T02: Bind and reroute connector endpoints.**
  - ST01: Attach endpoints to supported shape connection points and persist the bindings.
  - ST02: Recalculate route geometry when a bound shape moves; do not expose manual bend dragging in V1.
  - ST03: Verify required routing/binding against the editor adapter before expanding the editor slice.

**WB-S08 implementation note:** Implemented line, arrow, and connector tools/rendering in the Whiteboard-owned SVG canvas. Arrowheads are open chevrons derived from their endpoints. Connector endpoints snap to displayed shape connection points and persist shape bindings; moving/resizing a bound shape moves its endpoint and derives a new right-angle route. The shared palette and weight controls apply at drawing time. V1 deliberately provides no bend dragging. Browser checks verified arrow styling, shape attachments, and rerouting after moving an attached shape. TypeScript and ESLint pass. No asynchronous path or external service was introduced.

**WB-S08 interaction update:** The drawing viewBox now fits the actual canvas aspect ratio and grows to contain existing content, making previously letterboxed left/right regions fully interactive. Select-mode shape hover handles provide directional quick-connect: click to attach to the nearest existing shape in that direction, or drag to choose a target. Line and arrow endpoints also bind when drawn onto shapes and follow their connection points during shape movement/resizing. Browser verification checked drawings near both horizontal edges, quick-connect between distant shapes, attached arrow behavior after moving the target, and successful production build/type/lint gates.

### WB-S09 - Erase strokes and objects

- **WB-S09-T01: Implement type-aware erasing.**
  - ST01: Split/remove only the touched segment of a freehand stroke.
  - ST02: Remove the entire shape or text object when touched.
  - ST03: Verify nearby untouched objects remain intact at supported zoom levels.

### WB-S10 - Select, move, and manage objects

- **WB-S10-T01: Implement selection and object transformations.**
  - ST01: Add single-object select, move, resize, and delete operations.
  - ST02: Add box selection and move all selected diagram objects together without requiring Group/Ungroup.
  - ST03: Verify shape-bound text and connector bindings follow their related objects.
- **WB-S10-T02: Add clipboard and stacking-order commands.**
  - ST01: Implement copy, cut, paste, duplicate, and select all with safe fresh IDs for copies.
  - ST02: Implement Bring to Front and Send to Back.

**WB-S10-T03.3 completion (2026-10-19):** Reordering is represented as `objects.order` in the canonical semantic diff, accepted and persisted with the board revision, included in operation replay, and preserved by XML. The server collaboration test verifies inserted object order. Multi-browser visibility and concurrent reorder behavior remain in the authenticated browser verification gate; no separate transport was added.

**WB-S34 documentation update (2026-10-19):** Added `.project/WHITEBOARD-DEMO-RUNBOOK.md` with local app/API startup, required configuration boundaries, local mailbox limitations, a repeatable demo sequence, and explicit restart/quota/backup/retention stop conditions. The demo document does not claim Atlas is free or that the browser flow was rehearsed. Only environment example files are tracked. Atlas billing confirmation, authenticated multi-browser rehearsal, and the existing security scan remain release gates.

### WB-S11 - Pan and zoom the canvas

- **WB-S11-T01: Implement canvas camera controls.**
  - ST01: Add zoom in/out, fit-to-screen, and reset zoom.
  - ST02: Add Space+drag panning and pointer navigation without interfering with active drawing tools.
  - ST03: Verify the light grid remains visible and does not render inside shapes while panning/zooming.
- **WB-S11-T02: Keep local camera state separate from board content.**
  - ST01: Store normal-mode viewport state as local UI state, not as durable board objects.

### WB-S12 - Use the editor with a keyboard

- **WB-S12-T01: Add keyboard access and visible focus.**
  - ST01: Make tools and board objects keyboard reachable and expose a visible focus indicator.
  - ST02: Support Tab navigation through objects and arrow/Shift+arrow movement.
  - ST03: Ensure roles and status are communicated with text/semantics in addition to color.
- **WB-S12-T02: Implement editing shortcuts.**
  - ST01: Add Delete/Backspace, Ctrl+A/C/X/V/D, Ctrl+Z/Y, and Ctrl+S behaviors.
  - ST02: Avoid triggering shortcuts while focus is in text editing fields where normal text input should win.
  - ST03: Validate keyboard operation in supported Chrome and Edge; treat canvas accessibility as an editor-fit gate.

## 3. Local file save and open

### WB-S14 - Save an editable XML project file

- **WB-S14-T01: Define the versioned Whiteboard XML format.**
  - ST01: Specify version, title, canvas settings, template provenance, stable IDs, geometry, styles, text, connectors, and supported content.
  - ST02: Exclude presence, cursor, selection, credentials, invite tokens, and transient connection state.
  - ST03: Keep the canonical format independent of undocumented editor-vendor records.
- **WB-S14-T02: Export board content to a local XML download.**
  - ST01: Serialize the canonical document to the Whiteboard-owned XML format.
  - ST02: Wire Save and Ctrl+S to download the editable project file.
  - ST03: Verify normal saving is explicit and UI does not claim cloud auto-save.

### WB-S15 - Open a Whiteboard XML file

- **WB-S15-T01: Validate and parse imported XML as data.**
  - ST01: Enforce size, version, structure, identifiers, enums, geometry, and connector-reference checks.
  - ST02: Reject scripts, executable markup, external references, unsupported versions, and malformed documents.
  - ST03: Verify invalid imports leave the currently open board unchanged.
- **WB-S15-T02: Add supported schema migrations and import flow.**
  - ST01: Add explicit migration functions for each supported older schema version.
  - ST02: Open/import only Whiteboard XML in V1; exclude draw.io import/export.
  - ST03: Verify a valid imported board can seed a live session.

### WB-S16 - Warn about unsaved local changes

- **WB-S16-T01: Track dirty state and guard board replacement/navigation.**
  - ST01: Compare the current board against its last saved/imported baseline to determine unsaved edits.
  - ST02: Warn before leaving/closing and before replacing the current board with another file.
  - ST03: Offer save/discard/cancel as appropriate; verify cancel preserves the current board and its edits.

**Implementation and future-scope notes:**

- The current standalone V1 uses the browser's native Stay/Leave warning on tab close or external navigation; custom Save/Discard/Cancel is used for in-app board replacement. This browser limitation is accepted in the WB-S16 acceptance criteria.
- The current standalone app has no in-app navigation to guard. Add a Save/Discard/Cancel guard if and when a route or navigation control is introduced; WB-S16-T02.1 is deferred until then.
- Browser download APIs report that a download was initiated, not that the user completed saving the file to disk. Keep UI copy explicit about download initiation; do not imply durable device storage confirmation.

## 4. Identity, invitations, and session access

### WB-S17 - Start a live session

- **WB-S17-T01: Implement the single Live Collaboration session flow.**
  - ST01: Do not include a Presentation mode or mode selector; choose participant roles per invitation.
  - ST02: Create an Active session immediately with owner-selected title, even before invite acceptance.
  - ST03: Keep the session in Live Collaboration until the owner explicitly ends it.
- **WB-S17-T02: Seed session state from supported board sources.**
  - ST01: Start from blank board, built-in template, or validated Whiteboard XML.
  - ST02: Keep session title/rename authority owner-only and separate from local board title behavior.

**WB-S17 implementation boundary:** The API persists Active board sessions in MongoDB, validates canonical board snapshots, derives owner identity from the verified HttpOnly cookie, and enforces owner-only rename/end with member-authorized reads. The app requests a one-time verified email link, stores only the active session ID in current-tab session storage, and now sends subsequent edits through the authenticated semantic realtime protocol. **Deferred:** finish the explicit browser link-confirmation/session-create/reload path and verify a second owner's safe `404` before marking WB-S17 complete. Production email remains a separate gate.

### WB-S18 - Invite a participant to Live Collaboration

- **WB-S18-T01: Implement owner-controlled email invitations.**
  - ST01: Normalize and validate recipient email; require an explicit Editor or Viewer role bound to the invite.
  - ST02: Generate a single-use unguessable token, store only its hash, and set 10-minute expiry.
  - ST03: Allow owner cancellation and additional invites after session start; do not create public join links.
- **WB-S18-T02: Select and integrate a no-cost email delivery path.**
  - ST01: Session owners connect their own Gmail through Google OAuth; send with the Gmail API gmail.send scope. Store refresh tokens AES-256-GCM encrypted in MongoDB and revoke/delete them on disconnect. Local OAuth client setup and test-user consent remain to be configured and verified. Production OAuth app verification remains a release gate.
  - ST02: Send an Accept invitation action and surface delivery, expiry, and cancellation states.
  - ST03: Keep paid quotas/overages disabled and verify expired/cancelled invites cannot be accepted.

**WB-S18/S19/S20 implementation status (2026-10-21):** Owner-only invite/list/cancel, normalized email binding, hashed 10-minute single-use token, development mailbox fallback for sign-in, shared Gmail SMTP settings for sign-in mail only, per-owner Google OAuth Gmail API invitations with encrypted refresh-token persistence, delivery-failure cancellation, MongoDB persistence/TTL, rate limits, owner invitation/roster UI, explicit Live Collaboration Editor/Viewer role, same-email verified acceptance, display name/initials, durable identity/membership, active-session discovery/rejoin from another browser, removal/revocation, and server role enforcement are implemented. Per-owner OAuth sender code and connection UI are wired; actual invitation delivery still requires Google OAuth client configuration, owner consent, and end-to-end verification. Authenticated cross-browser role/rejoin/removal verification remains open. Google OAuth consent verification and deployment setup remain release gates, as does approval of the seven-day auth-cookie duration. Do not claim live collaboration release-ready.
- **WB-S17/S18 two-identity API verification (2026-10-19):** A temporary local integration used separate owner, invited Editor, and unrelated identities against the configured Mongo-backed API. Invite acceptance succeeded, the accepted member read the persisted board, and the unrelated identity received `session_not_found`; the test session was ended in cleanup. The in-app browser tabs share authentication, and Edge is unavailable in this session, so browser-to-API acceptance and real two-client Hocuspocus sync remain open. WB-S17-T03.4 is not marked complete.
- **WB-S17 realtime integration harness and verification (2026-10-20):** The loopback-only script reports transport-attempt failures immediately, verifies each API cookie resolves to its expected identity before opening sockets, and includes the API's `Retry-After` on magic-link `429` responses; README/runbook say to wait before retrying. A failed run exposed a provider configuration error (`delay` below Hocuspocus's 1,000 ms minimum); this was corrected. After the cooldown, the script passed against the local API, configured MongoDB, and Hocuspocus listener: independent Owner and Editor identities authenticated, invitation acceptance succeeded, both clients received initial state and each other's accepted edits, and cleanup ended the temporary session. A deliberately invalid cookie was also rejected as `permission-denied`. The app's browser sign-in confirmation/session creation journey remains unverified, so WB-S17-T03.4 remains unchecked.
- **Security scan gate (2026-10-18):** Repository `pnpm run scan` did not pass. `pnpm audit` reports one critical and several high advisories in existing dependencies (including Next.js), and TruffleHog reported a verified credential in the ignored local API environment file plus heuristic Eraser false positives in existing whiteboard files. This invitation change adds no external dependencies and did not edit/read the local secret file. Treat the repository scan as an unresolved release gate; review/upgrade affected dependencies and handle the local credential through the owner's secret-management process. Do not print or commit the secret.

### WB-S19 - Assign a Live Collaboration role when inviting

- **WB-S19-T01: Capture and enforce fixed per-session Editor/Viewer roles.**
  - ST01: Require owner to choose Editor or Viewer for each Live Collaboration invitation.
  - ST02: Bind the role to invite and accepted membership for that session.
  - ST03: Verify role changes require revoke/cancel and a new invitation; roles do not carry to later sessions.

### WB-S20 - Accept an invitation and keep a verified identity

- **WB-S20-T01: Design and implement verified email acceptance.**
  - ST01: Select the email proof/login mechanism, secure session lifetime, resend limits, and abuse controls before release.
  - ST02: Validate token hash, recipient email proof, session, expiry, cancellation, and single-use state on acceptance.
  - ST03: Collect display name and render initials avatar; omit custom profile photos.
- **WB-S20-T02: Maintain revocable server-side participant identity.**
  - ST01: Persist authenticated identity/session association with accepted membership.
  - ST02: Support same-email rejoin from another device while Active and not removed.
  - ST03: Verify client-supplied name/email alone cannot authenticate and removed members cannot use old membership.

**WB-S20/S21 rejoin implementation (2026-10-19):** Added authenticated `GET /sessions/mine`, which lists only active sessions containing the verified identity and returns metadata only. The workspace offers a Rejoin action; selecting it fetches the current board through the existing membership-checked session endpoint. Removed identities are removed from durable membership and cannot discover or fetch that session. A rejoin that would replace local unsaved board content asks first. Session service and focused API route tests pass. Remaining: verify the email-link journey, cross-device rejoin, removal/rejoin denial, and realtime reconnection in authenticated browser clients. Do not treat the stories as complete based on code alone.

**WB-S27 BSON size gate (2026-10-19):** Added a MongoDB BSON size check before creating sessions and before persisting each accepted board/operation. Each board/snapshot and operation record has an 8 MiB budget, leaving headroom under MongoDB's 16 MiB single-document maximum; rejected writes do not advance board sequence. The API returns `413 board_too_large` for session creation and `document_too_large` for realtime edits. Unit fixtures cover accepted and over-budget documents. An authenticated Hocuspocus protocol client recovered a semantic edit after an isolated API/realtime restart. A local browser-provider test also confirmed that an offline queued edit synced after the same restart with no duplicate (the board contained exactly two objects). Stale-edit conflicts, multi-participant behavior, and Atlas cost/limits/backup retention remain release gates.

### WB-S21 - Enforce the 25-member session limit

- **WB-S21-T01: Implement atomic durable-member admission.**
  - ST01: Count owner plus up to 24 invitees (25 total); pending invitations do not reserve member slots.
  - ST02: Atomically consume invitation and add verified identity to session membership.
  - ST03: Preserve valid full-session invitations until a member slot opens or they expire.
- **WB-S21-T02: Preserve membership across disconnect and support revocation.**
  - ST01: Disconnect releases only its connection lease; membership remains and the participant may reconnect while Active.
  - ST02: Revoke removed member access and require a new invitation for rejoin.
  - ST03: Verify last-member-slot acceptance races admit only one participant and keep the losing invite unconsumed.

### WB-S22 - Show live participants and cursors

- **WB-S22-T01: Implement transient participant presence.**
  - ST01: Show connected names and initials avatars for session participants.
  - ST02: Show owner/Editor cursors; suppress Viewer cursors.
  - ST03: Keep presence out of XML, accepted board history, and durable snapshots.

### WB-S23 - Enforce permissions on the server

- **WB-S23-T01: Authorize room connections and commands.**
  - ST01: Check verified identity, active session, membership, role, and revocation status on every join/reconnect.
  - ST02: Authorize every edit command server-side; ignore client-supplied roles, IDs, or guessed room IDs as proof.
  - ST03: Reject Viewer edit requests even when sent outside normal UI controls.
- **WB-S23-T02: Revoke live connections immediately on removal.**
  - ST01: Close active room connection and invalidate session access on removal.
  - ST02: Reject later reconnects until a new invitation is accepted.
  - ST03: Verify authorization behavior at server command/connection boundaries, not only in UI tests.

## 5. Live edits, reconnect, persistence, and history

### WB-S24 - See live edits and resolve conflicting edits

- **WB-S24-T01: Define the accepted-operation command model.**
  - ST01: Represent a completed gesture as a semantic operation with actor, target, and affected properties.
  - ST02: Validate role and command against current server document; assign monotonically increasing server sequence.
  - ST03: Resolve same-object/property conflicts by acceptance sequence while preserving independent safe changes.
- **WB-S24-T02: Broadcast only accepted, recoverable edits.**
  - ST01: Apply accepted operation and publish it to connected participants in sequence.
  - ST02: Do not acknowledge an edit as accepted/saved until the durable acceptance path succeeds.
  - ST03: Verify clients do not display rejected or unpersisted changes as accepted.
  - ST04: Treat Yjs/Hocuspocus command ordering and document integration as an early technical gate.

### WB-S25 - Synchronize queued changes after reconnect

- **WB-S25-T01: Define authenticated offline queue and replay protocol.**
  - ST01: Specify what local edits may queue, their identity/session binding, and queue size/lifetime limits.
  - ST02: On reconnect reauthenticate and fetch the latest server state before replay.
  - ST03: Recheck queued operations against current authorization, server ordering, and same-object conflict rules.
- **WB-S25-T02: Surface reconciliation outcomes and connection state.**
  - ST01: Distinguish connected, reconnecting, and disconnected states in the UI.
  - ST02: Report operations that cannot be safely applied; never silently imply they were saved.
  - ST03: Validate replay behavior through disconnect/reconnect and stale-edit scenarios before release.

### WB-S26 - Use shared Undo and Redo in a live session

- **WB-S26-T01: Build server-owned shared history operations.**
  - ST01: Record one history entry per accepted semantic gesture.
  - ST02: Process Undo/Redo through the same deterministic server command sequence as forward edits.
  - ST03: Make Undo target the latest accepted board action and Redo restore the latest undone action.
- **WB-S26-T02: Guard history branches and unsafe inverses.**
  - ST01: Clear shared Redo branch after a new forward edit.
  - ST02: Validate an inverse against later board changes and reject unsafe Undo without corrupting state.
  - ST03: Verify one participant can undo another participant's latest action and simultaneous requests are deterministic.

### WB-S27 - Persist and recover an active live session

- **WB-S27-T01: Confirm demo persistence configuration and limits.**
  - ST01: Select Atlas region/network/credentials/retention configuration without enabling paid overages.
  - ST02: Check current free-tier capacity, backup, and connectivity constraints against demo needs.
  - ST03: Decide/document the allowed local substitute if Atlas cannot meet the zero-cost demo constraint.
- **WB-S27-T02: Implement recoverable accepted-operation storage.**
  - ST01: Persist session metadata, accepted operations, and snapshots with sequence watermarks.
  - ST02: Acknowledge writes only after they are recoverable; surface persistence degradation/failure.
  - ST03: Keep Hocuspocus responsible for realtime transport and MongoDB responsible for persistence.
- **WB-S27-T03: Restore state after process/browser interruption.**
  - ST01: Load latest snapshot then replay later accepted operations in sequence.
  - ST02: Authenticate reconnecting members and resume room synchronization from recovered state.
  - ST03: Verify recovery across browser disconnect and realtime process restart; keep Compass optional and out of app dependencies.

### WB-S28 - Remove temporary data after a session ends

- **WB-S28-T01: Implement terminal session closure and access invalidation.**
  - ST01: Mark session Closed, reject joins/edits, and disconnect participants after successful owner end.
  - ST02: Invalidate outstanding invitation tokens and memberships for the closed session.
- **WB-S28-T02: Delete temporary session records after explicit owner end.**
  - ST01: Delete session, invitation, membership, operation, and snapshot data on closure.
  - ST02: **Superseded:** sessions have no time-based expiry; they remain active until the owner explicitly ends them.
  - ST03: Verify an old room ID or invitation cannot reopen a closed session.

## 6. Session owner controls; Presentation-specific work superseded

WB-S29/WB-S30 presentation viewport behavior is not part of the current product. Keep the single Live Collaboration feature with explicit Editor/Viewer roles; Viewers navigate independently and cannot edit. Session membership is capped at 25 including the owner, and sessions have no time-based expiry.

### WB-S29 - Superseded by single Live Collaboration feature

- **WB-S29-T01: Share owner viewport with Presentation Viewers.**
  - ST01: Publish the owner's current canvas area and camera state as transient presentation state.
  - ST02: Keep Viewers on the owner viewport and reject independent navigation/edit commands server-side.
  - ST03: Hide Viewer cursor and verify UI controls are not the authorization boundary.

### WB-S30 - Superseded: independent canvas navigation is standard for Live Collaboration

- WB-S30's separate presentation-camera behavior is superseded. Every participant keeps an independent canvas view; Editor/Viewer differences apply to board editing permissions.

### WB-S31 - Keep the session active when the owner disconnects

- **WB-S31-T01: Preserve active session through owner disconnection.**
  - ST01: Keep session Active and ownership unchanged when owner connection drops.
  - ST02: Each participant retains their own viewport and sees the Owner disconnected state; authorized Editors can continue syncing.
  - ST03: Owner reconnect does not change participants' viewports; verify only owner can end the session.

### WB-S32 - Manage participants during a live session

- **WB-S32-T01: Add owner participant management controls.**
  - ST01: Allow new invitations after session start and show their pending/accepted/expired state.
  - ST02: Allow owner to remove a participant and connect removal to immediate server revocation.
  - ST03: Restrict rename/end controls to owner and retain fixed Editor/Viewer invitation roles for the session.
- **WB-S32-T02: Verify lifecycle races and role changes.**
  - ST01: Revoke and reinvite to change a participant role; never mutate an accepted role in place.
  - ST02: Verify invite, removal, disconnect/rejoin, and end races preserve seat and authorization rules.

### WB-S33 - End a live session with or without an XML download

- **2026-10-19 implementation and runtime verification:** Added an owner-only shutdown dialog with Download XML and End, End without downloading, and Cancel. XML is serialized from the canonical board returned by the owner session API. After starting the browser download, the owner confirms closure separately; canceling the download can leave the session Active. The DELETE request carries the downloaded sequence as an atomic compare-and-close condition; a newer accepted edit returns `409 session_revision_changed`, leaves the session Active, and surfaces a retry message in the dialog. End without download remains available and the existing room disconnection and temporary-data cleanup path runs after closure. A service regression test covers stale revision rejection and current-revision closure. The reported Redo `past` runtime error was caused by stale ignored `packages/whiteboard/dist` output that still expected `boardHistory`; rebuilding the package refreshed the generated artifact. A fresh local browser accessibility tree now shows the Whiteboard workspace, with Undo/Redo correctly disabled for an empty board, and the app responds HTTP 200. Authenticated owner-flow/two-participant race verification, full API route suite (loopback socket sandbox failure), and release security/deployment gates remain open; do not mark the story complete until those applicable DoD gates pass.

- **2026-10-19 pending-story audit:** WB-S27 persistence-failure UI and 8 MiB BSON document-budget enforcement are implemented; authenticated protocol recovery and browser-provider queued-edit recovery across a controlled API/realtime restart passed (the offline edit synced once; two objects remained). Stale-edit conflicts, multi-participant behavior, Atlas cost/limits, and backup retention remain open. WB-S28 now has no time-based expiry. Owner end closes room sockets and retries temporary-record cleanup; legacy session expiry metadata is ignored. The API test task passes 69 tests, including the owner-end cleanup retry/failure behavior; authenticated browser expiry and deployed Atlas backup-retention checks remain open. WB-S32 owner invitation/roster/role/remove controls and server revocation are implemented; authenticated multi-browser role/rejoin/race checks remain open. Checklist task boxes distinguish implemented code paths from external policy and runtime verification gates; these stories remain incomplete.
- **WB-S34 local-only boundary:** Standalone editor setup and the local development mailbox are documented, and the app states that normal boards are local-first without cloud autosave. A public/demo deployment, account-level overage controls, complete dependency-license inventory, and repeatable $0 senior-demo validation remain open gates. The development mailbox is only a local substitute and does not deliver email.
- **WB-S34 security scan follow-up (2026-10-19):** `pnpm audit` initially reported four high dependency advisories. Workspace overrides upgraded `source-map-js` to 1.2.2, `sharp` to 0.35.5, and `@modelcontextprotocol/sdk` to 1.31.0; Whiteboard tests and production build pass after installation. Re-audit now reports only GHSA-vfj7-8cjw-p6xm in `braces@3.0.3`. No patched npm release is currently published (registry latest is 3.0.3); do not pin a nonexistent `3.0.4`. The advisory originates through fast-glob/micromatch under `shadcn`/eslint tooling; replace or update that dependency path when a compatible upstream release removes vulnerable `braces`, then rerun the full security scan. TruffleHog's three “Eraser credential” alerts point at ordinary local eraser identifiers in the board source and appear to be heuristic false positives; keep them visible until scanner triage can suppress them narrowly without excluding the files. TruffleHog also verified a MongoDB credential in ignored, untracked `servers/api/.env`; no credential value was read or copied into tracked files. The credential owner must rotate/revoke it through MongoDB Atlas and update the local secret store; `git check-ignore` confirms the environment file is ignored. WB-S34-T01.3 and the no-high-findings DoD remain open until the dependency advisory is removed and the verified local credential is rotated; do not report the security gate clean.
- **WB-S35 boundary review:** V1's renderer and canonical `Board` model are Whiteboard-owned, with no editor-vendor data format or dependency, so a separate vendor-conversion adapter would have no current conversion to perform. XML writes version 1; the importer intentionally rejects other versions because no older schema is supported. Add and test an adapter/migration before selecting an external editor engine or supporting a prior XML version. No Squid identity or navigation is wired into the editor/document model. This is a scope boundary, not authorization to implement deferred WB-S36.

- **WB-S33-T01: Implement owner end-session choices.**
  - ST01: Offer Download XML and End, End without downloading, and Cancel only to the owner.
  - ST02: Pin export to the latest server-accepted sequence/revision before generating XML.
  - ST03: Keep session Active when export is cancelled or fails unless owner explicitly chooses End without download.
- **WB-S33-T02: Complete closure only after the chosen outcome succeeds.**
  - ST01: On successful end, notify/disconnect participants and run the temporary-data cleanup path.
  - ST02: Verify downloaded XML matches the pinned latest accepted revision and cancelled export leaves the session active.

## 7. Delivery, quality, and scope boundaries

### WB-S34 - Demonstrate Whiteboard within the $0 budge

- **WB-S34-T01: Define a reproducible local demo path.**
  - ST01: Document setup and start commands for local app/server substitutes without paid dependencies.
  - ST02: Disable automatic paid overages and record the license inventory for selected dependency versions.
  - ST03: Verify demo flow works without paid editor licensing, hosting, email, or database requirements.
- **WB-S34-T02: Bound any optional no-cost external demo.**
  - ST01: Before public access, decide local-only versus tunnel/free hosting and document quotas, sleep/restart, backup, HTTPS, origin, and secret limits.
  - ST02: Use local substitutes or pause public access where email/realtime/hosting has no usable no-cost option.
  - ST03: Label demo limits clearly; do not claim production availability or long-term storage.

### WB-S35 - Keep the editor maintainable for future changes

- **WB-S35-T01: Define Whiteboard-owned document and editor boundaries.**
  - ST01: Keep a canonical versioned document model independent from vendor-internal record dumps.
  - ST02: Place engine-specific conversion behind an adapter owned by the Whiteboard app.
  - ST03: Represent templates in canonical document data and expose only intended module APIs.
- **WB-S35-T02: Preserve evolution and integration seams.**
  - ST01: Define migration entry points for XML schema changes and supported prior versions.
  - ST02: Verify editor/document/realtime modules contain no Squid identity or navigation assumptions.

### WB-S36 - Integrate with Squid later through one interface (deferred)

- **WB-S36-T01: Keep Squid integration out of standalone V1.**
  - ST01: Track this story as Deferred; do not add Squid entry points, identity wiring, or backend calls.
  - ST02: If separately approved later, inspect the then-current Squid architecture and define the host adapter before implementation.
  - ST03: At that later gate, verify the adapter carries only required context/actions and server-side authorization remains enforced.

## Suggested delivery sequence and gates

1. WB-S01 through WB-S03: standalone app, blank board, canonical template data.
2. WB-S14 and WB-S15 foundation, then WB-S04 through WB-S13: canonical XML and local editor slice; run Excalidraw fit gates while implementing text, grid occlusion, connectors, keyboard access, and adapter behavior.
3. WB-S35: keep document/editor boundaries explicit as local implementation grows.
4. WB-S17 through WB-S23: session lifecycle, identity, invitations, seats, presence, and server authorization. Do not expose invites until email/identity decisions and abuse controls are ready.
5. WB-S24 through WB-S28: ordered edits, offline replay, shared history, persistence/recovery, closure. The semantic Hocuspocus command protocol, Mongo operation recovery, bounded offline queue, participant revocation, and retryable owner closure are implemented; sessions have no time-based expiry. Browser synchronization, shared history and deployment gates remain open.
6. WB-S29/WB-S30 presentation viewport behavior is superseded. Continue applicable participant-management and owner-control work under the single Live Collaboration feature.
7. WB-S34: prepare the bounded senior demo; any public demo remains gated on zero-cost hosting, persistence, identity, authenticated expiry verification, and configured backup-retention limits.
8. WB-S36 remains deferred until separate approval.

## Completion review

- Every story in the source backlog (WB-S01–WB-S36) has at least one linked task and concrete subtasks.
- Confirmed product behavior remains distinct from technical gates and pending operational decisions.
- No task here authorizes paid spend, production claims, public launch, or the deferred Squid integration.

## Active implementation notes

- **WB-S18/WB-S20 email flow:** Owner creates a private invitation for a specific email; the participant receives an Accept invitation link, accepts it, verifies access to that invited email through the chosen one-time email flow, and then joins that session. This is not a reusable/public room-join link. Keep actual provider configuration separate from the invitation contract.
- **Identity + WB-S17 server foundation (2026-10-18; session policy updated 2026-10-20):** User selected one-time email magic links and clarified that owners send private, one-time invitation links which participants accept to join that session. The API has normalized-email/token rules, MongoDB identity and auth-session repositories, atomic rate-limit counters (3/email and 10/IP per fixed 15 minutes), origin-checked auth routes, seven-day HttpOnly cookies, and a development-only loopback mailbox. WB-S17 has strict board snapshot validation, MongoDB session persistence/index, server-issued Active session records, one Live Collaboration feature without a mode, and owner-only create/read/rename/end API routes. API typecheck/lint/build pass and 27 tests pass.
- **Deferred to finish WB-S17:** Validate in the browser from explicit link confirmation through session create/rename/end and same-tab reload restoration; verify a second identity receives safe `404`. The backing MongoDB repository has already passed a direct local HTTP integration run. Never expose connection strings, cookies, or magic-link tokens in reports. These browser checks are required before marking WB-S17 complete.
- **Still gated:** Production email delivery, complete browser invitation journey validation, durable 25-member admission race validation, room and role authorization, realtime, board persistence/recovery, participant removal/rejoin, and end-session invite/connection cleanup. Identity and invitation rate limits and seven-day auth-session lifetime are implementation defaults; review before public release.
- **Resume condition:** Run invitation create → local mailbox → same-email verify → explicit accept → session reload, and verify owner cancellation/wrong-email/expiry behavior against the connected development MongoDB. The dev mailbox must never be exposed outside loopback development.

- **WB-S21/WB-S23/WB-S22 transport implementation (2026-10-18):** Added Hocuspocus server wiring, exact-Origin and verified `wb_session` room auth, active session + accepted membership checks, server-derived awareness identity, Viewer update denial, durable session membership for owner plus 24 invitees, transactional invite consumption + membership admission, transient 30-second socket lease refresh / 90-second expiry, and graceful realtime shutdown. Disconnect releases only the socket lease and does not remove membership. Private invitation tokens remain one-time; they are accepted through the email flow and are never room credentials.
- **WB-S21 MongoDB integration validation (2026-10-18):** Against the configured development MongoDB, created an owner session, admitted four members, raced two verified invitations for the last slot, confirmed exactly one acceptance and that the losing invitation remained usable, disconnected/reconnected an admitted member without losing membership, and confirmed six persisted member identities. Temporary session/invitation records were deleted in cleanup.
- **Still gated after transport work:** Verify browser invite/rejoin behavior, Atlas deployment/cost limits, lease expiry, Viewer and raw Yjs write rejection, cross-room isolation, process restart, and graceful shutdown. Immediate participant removal/revocation is implemented in the later WB-S32 slice; its real-socket/browser verification remains open. Do not claim WB-S21/S22/S23 fully complete.
- **Validation status (2026-10-18):** `pnpm install --offline` completed. API tests (47), API lint/typecheck/build, app lint/typecheck, and shared-types typecheck pass. A direct Mongo collaboration integration passed concurrent sequence assignment, idempotent retry and operation replay; its temporary records were deleted.
- **WB-S24/WB-S27 semantic editing and persistence foundation (2026-10-18):** Added an app Hocuspocus provider that submits typed semantic edits, tracks connection state and queued commands; API rejects raw Yjs writes and Viewer edits; each accepted edit is membership-checked, assigned a Mongo sequence, saved as an operation and current board in one transaction, and broadcast only after commit. Same-property edits are server-order last-write-wins; independent properties merge. A duplicate action ID is idempotent. Board snapshots are written at each 100th accepted operation and session reads recover from the latest snapshot plus later contiguous operation records. Direct Mongo integration passed concurrent edits, idempotent retry, and replay with temporary records removed. API 45 tests/typecheck pass; app typecheck/lint pass. API lint findings were being corrected; rerun final gates before handoff.
- **Still deferred before WB-S24/WB-S27 completion:** Verify two authenticated browser participants see the same board and stale/same-property edits converge; verify a running Hocuspocus process reconnects after restart; verify invalid/revoked member and Viewer/raw Yjs attempts through real sockets; verify a recovery gap and DB outage show clear failure in UI. No XML import or app UI currently presents queued edits as confirmed server saves. A 2026-10-19 local browser attempt confirmed two in-app tabs share the same authentication context; signing out one disconnected the owner's realtime socket, so it did not count as multi-participant evidence. Repeat with independent browser profiles or devices, and end the temporary test session after the attempt.
- **WB-S26 implementation now present:** Shared Undo/Redo is implemented in the session operation/history transaction; see the 2026-10-19 implementation update below. Its Mongo restart/integration and multi-browser gates remain open. WB-S25 queue bounds/replay policy and WB-S28 member/session revocation, retryable owner closure, and no time-based expiry are implemented; browser and live-socket verification remains open. Operation logs are removed at owner end or expiry; Atlas backup deletion follows configured provider retention.
- **WB-S28 owner-end access revocation (2026-10-18):** After the owner-end transaction succeeds, the session service invokes the realtime room closer; every currently connected socket for that session is immediately closed and its lease timer removed. Future connection attempts and edits are denied because the persisted session is ended. Unit test asserts the room close callback follows successful owner end. Invitation invalidation/data deletion completes synchronously with retryable cleanup; participant removal/revocation is implemented in WB-S32, with browser verification open.
- **WB-S28 stale-tab recovery (2026-10-19):** Browser verification found that a tab still showing a session as Active retained stale controls after another tab ended it. An authoritative `session_not_found` API code now clears the stale session state and history while preserving the local board; a focused regression test passes. The temporary test session was ended and the stale-tab controls were cleared in the browser. The same in-app browser tabs shared authentication, so this does not satisfy the independent multi-participant verification gate.
- **Persistence/deployment gates remain:** Atlas tier/region/network/retention/backup have not been confirmed. Current snapshot cadence is every 100 accepted commands, storing the canonical board snapshot. Board/snapshot and accepted-operation documents are limited to 8 MiB BSON, below MongoDB's 16 MiB ceiling. Production email provider and public deployment remain disabled.
- **Realtime signals:** API log `Realtime semantic command rate limit exceeded.` is emitted on the 601st message from a socket per 60-second window; the client receives `rate_limited`. API log `Realtime board edit could not be persisted.` and client reason `storage_unavailable` indicate the attempted edit was not accepted; three failures in five minutes for one session are actionable. Replay gap/missing snapshot causes session recovery to fail closed and is immediately actionable. Runbook response steps are in `.project/WHITEBOARD-BACKEND-RUNBOOK.md`.
- **Validation note (updated 2026-10-18):** `pnpm install` linked patched Next.js 16.3.8. API tests (47), API lint/typecheck/build, app lint/typecheck/Next production build, shared-types typecheck, and `git diff --check` pass. Direct Mongo collaboration integration passed. Browser multi-participant, live process-restart and deployment tests remain unverified. These are real release gates, not reasons to mark implementation complete.
- **Security scan gate (2026-10-18):** Updating both Next.js apps to 16.3.8 removed the critical Next.js advisory and the Next.js high advisory. Fresh `pnpm audit` still reports four high advisories: `braces@3.0.3` (patched `>=3.0.4`), `source-map-js@1.2.1` (patched `>=1.2.2`), optional `sharp@0.35.4` (patched `>=0.35.5`), and dev-only `@modelcontextprotocol/sdk@1.30.0` (patched `>=1.31.0`). Attempted workspace overrides, but the configured npm registry reports `braces@3.0.3` as its latest and refuses the advisory-listed patched version, so no unresolvable overrides were kept. Repository scan also flags ordinary `eraser` identifiers as three false-positive unverified “Eraser credential” detections, and detects a verified Mongo credential in the ignored, untracked local `servers/api/.env`; its content was not opened or reported. Before release, resolve the four dependency advisories through a registry that contains the patched packages/update upstream dependency parents; review/rotate the local DB credential if it was not expected to be active; adjust false-positive handling through an approved control-plane change. Until scan is clean, the DoD security gate is open.
- **Security scan refresh (2026-10-19):** Prescribed `pnpm run scan` still exits 1. Current audit reports one high `braces@3.0.3` finding (GHSA-vfj7-8cjw-p6xm); the [GitHub Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version, and [npm lists 3.0.3 as latest](https://www.npmjs.com/package/braces?activeTab=versions). TruffleHog reports three ordinary Eraser identifiers as unverified false positives and a verified MongoDB credential in `servers/api/.env`. Git confirms that file is ignored and untracked; its contents were not opened or emitted. No new dependencies were added in this slice. Keep WB-S34-T01.3 open pending safe upstream advisory remediation/review and owner-side Atlas credential rotation; do not silence the source scan by excluding affected application files.
- **WB-S32/WB-S28 implementation update (2026-10-18/19):** Added owner-only participant roster with role/display name/email and live socket state, removal confirmation UI, transactional membership revocation and active lease removal, immediate tracked socket closure, and fresh-invitation-required rejoin. Owner is not removable; capacity remains owner plus 24 invitees. Accepted membership no longer inherits the pending invitation TTL, so it remains durable until removal, explicit end, or no time-based expiry. Owner end persists `ended` first, closes room sockets, deletes invitation/membership rows, then operations, history, snapshots, and session; failure is logged and retryable from the ended marker. Automated expiry tests pass; authenticated browser/socket validation, Atlas backup behavior, and dependency security gate remain open.
- **WB-S32/WB-S28 validation (2026-10-18):** Network-free API unit tests pass (14 invitation/session service tests), including roster state, immediate removal callback, owner self-removal denial, and retryable ordered closure cleanup. The full API route suite cannot bind/connect loopback sockets in this execution environment (`EACCES`); API TypeScript/lint currently surface broad Express/Mongoose unresolved-type errors, and app typecheck reports `Doc.destroy` missing from the installed Yjs declarations. Those checks must be rerun in a correctly linked workspace environment. No browser or live WebSocket verification was possible in this run.
- **WB-S25 queue safety update (2026-10-19):** Client queue now has a 500-edit and 1 MB limit; the next live edit is refused before board state changes if it would exceed either limit. Queue entries carry a creation time. Entries older than seven days remain on-device and require explicit user confirmation before replay because replay can overwrite newer values. Reauthentication, server-state catch-up, ordered server-mediated replay, pending count, connection state, blocked-edit feedback, and idempotent retry after a lost in-flight acknowledgement are implemented. A focused app regression test covers clearing the transport's in-flight marker while preserving the stable queued action. Local browser-provider disconnect/reconnect recovery now passed after an isolated API/realtime restart, with the queued edit applied once. Stale-edit conflict and multi-participant sequence-reconciliation checks remain open.
- **WB-S29/WB-S30/WB-S31 presentation transport update (2026-10-19):** Added server-bounded Owner viewport messages for Presentation, transient room broadcast, Viewer camera lock/read-only UI, Editor-local navigation, server role/mode authorization, and Owner connect/disconnect broadcasts. The latest camera remains in realtime process memory across Owner disconnect and is republished on reconnect. Viewport state is not persisted across realtime process restart. Targeted schema/authorization tests and client/server/package typechecks passed; live multi-browser follow, unauthorized viewport attempt, Owner disconnect/reconnect, and process restart remain verification gates. Runbook and module contracts document signals, thresholds, role checks, and the process-memory limitation.
- **WB-S22 presence UI update (2026-10-19):** Added server-sanitized Hocuspocus awareness identity/role, bounded cursor payloads, server removal of Viewer cursors, connected participant name/initial avatars, Owner/Editor cursor rendering, and per-socket awareness rate/state-count bounds. Presence remains transient, session-room scoped, and outside board/XML/history. Unit tests cover forged identity, Viewer cursor suppression, invalid cursor bounds, and publisher authorization; app/package typechecks and focused lint/tests pass. Live multi-browser disconnect/removal expiry behavior and room-isolation verification remain open; the runbook documents the 30-second expiry and 1,200-updates/minute signal thresholds.
- **WB-S30-T01.3 client permission test (2026-10-19):** Presence publishing now uses separate tested policies for cursor and viewport messages. A Presentation Editor can publish cursor presence while only the Owner can publish the shared viewport; unauthenticated, stale-session, and Viewer cursor publishing are denied. Browser-visible multi-participant presence remains unverified.
- **WB-S22/S23 implementation review (2026-10-19):** Presence and server authorization/revocation paths are implemented, and the task checklist reflects code-level completion. Authenticated multi-browser tests for cross-room isolation, Viewer tampering, removal disconnect/rejoin denial, and awareness expiry remain open; neither story is marked complete. **Validation correction (2026-10-19):** Explicit API Express type dependencies and transaction/test-fixture typing fixes now allow the API-wide typecheck and ESLint tasks to pass.
- **WB-S26 implementation update (2026-10-19):** Added a Mongo-backed per-session Undo/Redo stack capped at 500 actions; forward semantic edits store actor, server sequence, inverse changes, and field/object guards. Authorized Owner/Editor history commands commit board changes, history-stack transitions, operation-log records, and sequence updates in one transaction; unsafe inverses are rejected before mutation. Client toolbar and Ctrl/Cmd+Z/Y now use shared history in live sessions and local history outside sessions. Board and history availability broadcast together; replay includes Undo/Redo operations. Unit tests pass for guards, independent-property preservation, stack transitions, Redo-branch clearing, and strict message validation. Direct MongoDB integration passed for forward edit, Undo, Redo, Redo-branch clearing, and operation replay; temporary session records were deleted. Still open: actual API process restart, authenticated multi-browser verification, security scan, and existing live session release gates. API-wide typecheck and ESLint now pass (2026-10-19). WB-S26 is not marked complete.
