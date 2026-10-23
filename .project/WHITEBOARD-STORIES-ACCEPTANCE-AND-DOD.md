# Whiteboard User Stories — Acceptance Criteria and Definition of Done

This file presents every WB-S01–WB-S36 story with its original user story, acceptance criteria, and status, followed by the complete Definition of Done for that story. The common DoD below is additive: it preserves the existing delivery requirements and adds the four requested requirements. Story text is copied from `.project/whiteboard-review/WHITEBOARD_USER_STORIES.md`; update both files together when story scope changes.

### WB-S01 - Open Whiteboard independently

> **Current session requirements (2026-10-20):** Live Collaboration is the only session feature; do not offer or implement a separate Presentation mode. The owner must choose Editor or Viewer for every invitation. Editors and the owner may edit; Viewers are read-only for board content but navigate their own canvas. Maximum membership is 25 people including the owner (up to 24 invitees). A session has no time limit and ends only through the owner's explicit end action. Private invitations remain single-use and expire after 10 minutes. This policy supersedes conflicting older story/task text below.

**As a** Whiteboard user, **I want** to open Whiteboard as its own application, **so that** I can use it without navigating through Squid product screens.

**Acceptance criteria**

- Whiteboard has its own application entry point in the currently connected workspace.
- Opening and using the Whiteboard does not require Squid login, Squid backend services, or a Squid workspace.
- Whiteboard code and configuration have a clear boundary from existing Squid product flows.
- A future Squid connection is possible through one defined host interface, but that interface is not wired into Squid in this story.

**Status:** Confirmed.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S02 - Create a blank board

**As a** user, **I want** to open a blank board, **so that** I can start drawing without a template.

**Acceptance criteria**

- A blank board opens with the title `Untitled`.
- The user can rename a normal/local board.
- The board contains one large canvas, not multiple pages.
- Starting a normal board does not create server-side persistent storage.

**Status:** Confirmed.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S03 - Start from a built-in template

**As a** user, **I want** built-in diagram templates, **so that** I can begin with a useful structure and edit it for my needs.

**Acceptance criteria**

- The built-in catalog contains: blank page, organization chart, entity relationship diagram, mind map, simple Kanban board, flowchart, cross-functional flowchart, workflow, data flow diagram, UML sequence, UML use case, and UML activity diagrams.
- Choosing a template creates a separate editable copy on the user's board.
- The original built-in template remains unchanged when a user edits their copy.
- V1 does not include user-created template upload or draw.io template import.

**Status:** Confirmed.

## Canvas, drawing, and editing

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S04 - Draw freehand marks

**As a** user, **I want** a pen tool, **so that** I can sketch freely on the canvas.

**Acceptance criteria**

- The user can choose the pen, draw a freehand stroke, and see it on the board.
- Pen strokes use the selected palette color and one of the three line weights: thin, medium, or thick.
- A completed stroke is treated as one undoable gesture, not a separate action for each pointer sample.

**Status:** Confirmed. Shared live gesture history is specified in WB-S26.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S05 - Add and resize basic shapes

**As a** user, **I want** rectangle, circle, and diamond tools, **so that** I can build common diagrams.

**Acceptance criteria**

- The user can place a rectangle, circle, or diamond on the board.
- The user can resize each shape.
- Resizing does not change the shape type; a circle remains a circle.
- Rotation is not required in V1.

**Status:** Confirmed.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S06 - Add text and write inside shapes

**As a** user, **I want** to place text on the canvas or inside a shape, **so that** my diagrams explain themselves.

**Acceptance criteria**

- The user can add standalone text and text inside ordinary or template shapes.
- Text stays associated with and moves with its containing shape.
- Text wraps within the shape and supports left, center, and right alignment, font size, and bold.
- Editing text does not replace or alter the containing shape type.

**Status:** Confirmed. Exact editor-engine behavior is an implementation gate.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S07 - Style shapes, text, and lines

**As a** user, **I want** a predefined palette and transparent fill, **so that** I can make diagrams readable without needing a custom color picker.

**Acceptance criteria**

- A predefined palette can be applied to shape fills, outlines, arrows/connectors, text, and pen strokes.
- A shape can have either a selected palette fill or no fill.
- Line weight can be thin, medium, or thick. New pen strokes, shape outlines, lines, arrows, and connectors default to thin; weight changes to an existing object affect that object only.
- There is no custom color picker in V1.
- The graph-paper grid is not visible through or inside a shape, including a no-fill shape.
- Shapes keep their selected type while their style changes.

**Status:** Confirmed. Grid occlusion with no-fill shapes is an implementation gate.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S08 - Draw lines, arrows, and attached connectors

**As a** user, **I want** straight and 90-degree connectors, **so that** I can show relationships and flow between objects.

**Acceptance criteria**

- The user can draw a straight line, an arrow, and a 90-degree connector.
- Connector endpoints can attach to connection points on shapes.
- When an attached shape moves, the connector remains connected and automatically adjusts.
- Hovering over a shape exposes directional quick-connect handles; clicking one automatically connects to the nearest existing shape in that direction, and dragging one connects to the chosen target shape.
- Straight lines and arrows dropped on shapes bind their endpoints and remain attached when a bound shape moves or resizes.
- The SVG drawing surface fits the available canvas width and height so visible canvas edges remain interactive; the logical bounds expand with the viewport and existing content.
- Users cannot manually drag the 90-degree connector's bend in V1.

**Status:** Confirmed. Required routing and binding behavior is an implementation gate.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S09 - Erase strokes and objects

**As a** user, **I want** an eraser, **so that** I can remove unwanted drawing content.

**Acceptance criteria**

- Erasing a freehand stroke removes the touched portion of that stroke.
- Erasing a shape or text removes that whole object.
- Erasing does not unexpectedly delete nearby objects that were not touched.

**Status:** Confirmed.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S10 - Select, move, and manage objects

**As a** user, **I want** to select and manipulate objects, **so that** I can rearrange a diagram after drawing it.

**Acceptance criteria**

- The user can select, move, resize, and delete individual objects.
- The user can copy, cut, paste, duplicate, and select all objects.
- Box-selecting a whole diagram allows the user to move that selection together; a separate Group/Ungroup feature is not required.
- Text inside a shape moves with its shape.
- The user can use Bring to Front and Send to Back.

**Status:** Confirmed.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S11 - Pan and zoom the canvas

**As a** user, **I want** to move around and zoom the canvas, **so that** I can work on a large diagram comfortably.

**Acceptance criteria**

- The canvas can be panned and zoomed.
- The user can zoom in, zoom out, fit the board to screen, and reset zoom.
- Space+drag pans the canvas.
- A light graph-paper grid is always visible in the canvas background.
- There is no grid show/hide control, grid snapping, or alignment guide in V1.
- The grid does not show inside shapes.

**Status:** Confirmed.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S12 - Use the editor with a keyboard

**As a** keyboard user, **I want** to operate core tools and objects without relying only on a mouse, **so that** I can edit a board accessibly.

**Acceptance criteria**

- Keyboard focus can reach tools and board objects, and the focused item has a visible focus indicator.
- Tab can move through board objects.
- Arrow keys move the selected object; Shift+arrow moves it farther.
- Delete and Backspace remove the selected object.
- Ctrl+A selects all; Ctrl+C/X/V copy, cut, and paste; Ctrl+D duplicates.
- Ctrl+Z and Ctrl+Y invoke Undo and Redo; Ctrl+S invokes local XML save.
- Core status is not communicated by color alone.

**Status:** Confirmed. Canvas accessibility and browser behavior are implementation gates.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S13 - Undo and redo in a local board

**As a** user, **I want** to undo and redo local edits, **so that** I can recover from mistakes while working alone.

**Acceptance criteria**

- Ctrl+Z reverses the latest local edit and Ctrl+Y reapplies an undone edit.
- One completed gesture, such as one drag or one pen stroke, is one history action.
- A new edit after Undo clears the Redo branch.
- Local board history is not shared with another user's board.

**Status:** Confirmed. Live shared history is specified separately in WB-S26.

## Local file save and open

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S14 - Save an editable XML project file

**As a** user, **I want** to save my normal board as an XML file on my device, **so that** I can reopen and continue my work later.

**Acceptance criteria**

- Save and Ctrl+S download an editable Whiteboard-owned XML project file.
- The saved file contains the board content needed to continue editing, not only a flat image.
- The file includes a format/schema version and stable object identifiers.
- Normal-mode saving is explicit; the application does not claim that the board has been automatically saved to the cloud.

**Status:** Confirmed. XML schema version 1 is implemented.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S15 - Open a Whiteboard XML file

**As a** user, **I want** to reopen a Whiteboard XML project file, **so that** I can continue editing a saved board.

**Acceptance criteria**

- V1 opens only Whiteboard's own XML format; it does not import/export draw.io XML.
- Supported older versions can be detected and migrated using explicit migrations.
- Invalid or unsupported future-version files produce a clear error.
- A failed import leaves the currently open board unchanged.
- XML is parsed as data; imported markup, scripts, and external references are never executed.
- A live session can be started from an imported Whiteboard XML board.

**Status:** Confirmed. Schema version and migration implementations are implementation gates.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S16 - Warn about unsaved local changes

**As a** user, **I want** a warning before I lose unsaved edits, **so that** I do not accidentally discard my board.

**Acceptance criteria**

- Leaving or closing a board with unsaved changes triggers the browser's native Stay/Leave warning where supported; the user can explicitly download the board with Save XML before leaving.
- Replacing the current board with another XML file or starting a new board while there are unsaved changes asks whether to save, discard, or cancel before replacing it.
- Canceling the warning keeps the current board open and unchanged.

**Status:** Confirmed.

## Identity, invitations, and session access

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S17 - Start a live session

**As a** board owner, **I want** to start a Live Collaboration session from a blank board, template, or imported XML, **so that** I can work on the board with invited participants.

**Acceptance criteria**

- The owner starts the single Live Collaboration session feature; there is no mode picker.
- The owner sets the live board's title at creation; only the owner can rename it.
- There is no session mode or separate Presentation feature.
- The session becomes Active as soon as it is created, even if nobody else has accepted an invitation.
- The owner can start from a blank board, a built-in template, or an imported Whiteboard XML file.

**Status:** Confirmed.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S18 - Invite a participant to Live Collaboration

**As a** session owner, **I want** to invite someone by email and select Editor or Viewer, **so that** they can join the live board with the role I intend.

**Acceptance criteria**

- The owner invites by email; no public join link is created.
- The owner explicitly selects Editor or Viewer for every invitation; no role is assigned by default.
- The invitation email has an Accept invitation action and is valid for 10 minutes.
- The owner can cancel a pending invitation, and can send invitations after the session has started.
- An invitation that has expired cannot be accepted.

**Status:** Confirmed. Email delivery vendor is pending.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S19 - Assign a role when inviting to Live Collaboration

**As a** session owner, **I want** to choose Editor or Viewer for each invitee, **so that** I control their role for the session.

**Acceptance criteria**

- The owner must assign Editor or Viewer when sending each Live Collaboration invitation.
- The assigned role is fixed for that session.
- Changing an invitee's role requires cancelling/revoking the invitation or membership and issuing a new invitation with the intended role.
- Roles do not automatically carry into a later session.

**Status:** Confirmed.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S20 - Accept an invitation and keep a verified identity

**As an** invited participant, **I want** to accept the email invitation and establish my identity, **so that** I can join and reconnect as the invited person.

**Acceptance criteria**

- Only the person who can verify control of the invited email can accept the invitation.
- The participant supplies a display name; the UI shows an initials avatar. Custom profile photos are outside V1.
- The accepted invite is associated with a server-side identity/session, not merely a client-provided name or email.
- The participant can verify the same invited email and rejoin from another browser/device while the session is active, unless removed.
- A removed participant cannot rejoin using the old membership.
- No separate public room link is exposed.

**Status:** Product flow confirmed. V1 code uses one-time email magic links and a seven-day server-side sign-in cookie. Each session owner can connect a Gmail account through Google OAuth and send invitations through the Gmail API; sign-in mail may use the optional shared Gmail sender. OAuth client setup and actual inbox verification remain pending. Production delivery remains a release gate, and the seven-day duration is an implementation default pending product/security approval. Board sessions have no time-based expiry under WB-S28; authenticated browser verification remains open.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S21 - Enforce the 25-member session limit

**As a** session owner, **I want** the session to have a 25-member limit including me, **so that** the live group stays within the agreed V1 size and participants can return after disconnecting.

**Acceptance criteria**

- No more than 25 accepted members belong to the session: the owner and at most 24 invitees.
- A pending invitation does not reserve a member slot and remains pending if the member limit is reached.
- Invitation acceptance and persistent membership insertion are atomic, so racing acceptances cannot exceed 25 session members; a rejected acceptance does not consume the invitation.
- Disconnecting or closing a browser does not remove a member or free a slot. That member can reconnect while the session is Active.
- Explicit removal or session end revokes membership; a removed member requires a new invitation.

**Status:** Confirmed. Durable membership and atomic acceptance are implementation gates.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S22 - Show live participants and cursors

**As a** participant, **I want** to see who is currently editing and where Editors are working, **so that** live collaboration is understandable.

**Acceptance criteria**

- Show connected participant names and initials avatars.
- Show cursors for the owner and Editors.
- Do not show a board cursor for a Viewer.
- Presence is transient and is not saved into the XML project file or durable board history.

**Status:** Confirmed.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S23 - Enforce permissions on the server

**As a** board owner, **I want** access restrictions to be checked by the server, **so that** a participant cannot gain access by changing browser controls or messages.

**Acceptance criteria**

- Every room join checks verified identity, session status, current membership, role, and removal/revocation status.
- Every edit command is authorized on the server; hiding a browser control alone does not grant security.
- A Viewer edit request is rejected even if submitted outside the normal UI.
- Room IDs and client-supplied roles/user IDs do not grant access.
- Removing a participant revokes their existing live connection and rejects later reconnects until a new invitation is accepted.

**Status:** Confirmed. Exact auth/session implementation is pending.

## Live edits, reconnect, persistence, and history

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S24 - See live edits and resolve conflicting edits

**As an** Editor, **I want** my changes and other Editors' changes to appear live, **so that** we can work on the same board together.

**Acceptance criteria**

- An accepted board edit is sent to other connected participants in real time.
- When competing changes affect the same object/property, the latest server-accepted change is the final value; client clocks do not decide which edit is latest.
- Independent property changes are retained where the model can safely preserve them.
- Rejected or unpersisted changes are not shown as accepted/saved.

**Status:** Product rule confirmed. Server ordering and interaction with Yjs are implementation gates.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S25 - Synchronize queued changes after reconnect

**As a** participant, **I want** my changes to synchronize after I reconnect, **so that** brief connectivity loss does not silently discard my work.

**Acceptance criteria**

- On reconnect, the client authenticates again and receives the latest board state.
- Changes made while disconnected are synchronized/reconciled with the current state.
- Replay follows server acceptance ordering and the same-object conflict rule.
- The user is told when an offline change cannot be applied safely; the application does not silently imply that it was saved.
- Presence/connection status distinguishes connected, reconnecting, and disconnected states.

**Status:** Reconnect synchronization confirmed. Exact offline queue/replay/conflict protocol is an implementation gate.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S26 - Use shared Undo and Redo in a live session

**As an** Editor, **I want** Undo and Redo to affect the shared board history, **so that** the group can correct and restore changes consistently.

**Acceptance criteria**

- An Editor's Undo reverses the latest accepted board action, including an action made by another Editor.
- Redo restores the latest undone action.
- One meaningful gesture, such as one drag or one pen stroke, is one history action.
- A new forward edit clears the shared Redo branch.
- Simultaneous Undo/Redo requests are processed in deterministic server order.
- If an undo inverse can no longer be applied safely, the command is rejected and the shared board remains valid.

**Status:** Confirmed. This needs a product-owned shared history/command layer; a CRDT's default undo alone is not sufficient.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S27 - Persist and recover an active live session

**As a** participant, **I want** active session data to survive a browser disconnect or server restart, **so that** I can reconnect to the current board before the owner ends it.

**Acceptance criteria**

- MongoDB Atlas is the current preferred database direction; Hocuspocus is the current preferred realtime server direction. They have separate responsibilities, and deployment fit remains to be verified.
- One Hocuspocus server can host isolated rooms, with one room per live session.
- The system can restore a snapshot and replay later accepted operations after a restart.
- The durable path does not acknowledge an edit as saved until it can be recovered.
- Database or persistence failures are visible; the UI does not claim failed writes are saved.
- MongoDB Compass is an optional admin GUI, not a second database or application dependency.

**Status:** Preferred direction confirmed. Whiteboard-owned MongoDB persistence, server-side connection configuration, 100-operation snapshots, and recovery from snapshots plus later accepted operations are implemented and direct database integration has passed. Atlas account cost/retention/backup configuration, authenticated process-restart recovery, and multi-browser verification remain open.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S28 - Remove temporary data after a session ends

**As a** participant, **I want** a closed session to stop accepting access and clear its temporary server data, **so that** ended boards are not left active on the service.

**Acceptance criteria**

- Successful end disconnects participants and marks the session Closed.
- Temporary session, invitation, membership, operation, and snapshot data are deleted after closure, as required by the agreed lifecycle.
- Reusing an old room ID or invitation cannot reopen the closed session.
- Sessions have no time limit. They stay active until the owner explicitly ends them; explicit end closes access and triggers temporary-data cleanup.

**Status:** Owner end and retryable cleanup are implemented. Sessions have no time-based expiry; legacy expiry metadata is ignored. Authenticated browser and deployed MongoDB/backup-retention verification remain release gates.

## Session owner controls

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S29 and WB-S30 - Superseded

The Presentation-specific viewport-following and independent-editor stories are superseded by the 2026-10-20 Live Collaboration requirements above. Every participant has a role, Editor or Viewer; viewers navigate independently and cannot edit.

---

### WB-S31 - Keep the session active when the owner disconnects

**As a** participant, **I want** the session state to remain clear if the owner disconnects, **so that** I know whether the session is still active.

**Acceptance criteria**

- Owner disconnection does not end the session or transfer ownership.
- Viewers keep their own local viewport; the owner disconnect does not end the session.
- Editors may keep editing and syncing while the owner is disconnected.
- When the owner reconnects, the session remains available without changing participant viewports.
- Only the owner can end the session.

**Status:** Confirmed.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S32 - Manage participants during a live session

**As a** session owner, **I want** to invite, remove, and manage participants during the session, **so that** I can control who is present.

**Acceptance criteria**

- The owner can send new invitations after a session has started.
- The owner can remove a participant; their live access is revoked and connection closed immediately.
- A removed participant needs a new invitation to rejoin.
- Only the owner can rename or end the session.
- Editor/Viewer invitation roles stay fixed for the session; changing role requires a new invitation with the intended role.

**Status:** Participant roster, owner-only removal, immediate membership revocation/socket closure, and fixed invitation roles are implemented. Live multi-participant browser verification and final security/release gates remain open.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S33 - End a live session with or without an XML download

**As a** session owner, **I want** to download the board before ending or explicitly end without a download, **so that** I choose whether to keep a local copy.

**Acceptance criteria**

- Only the owner can initiate End Session.
- The owner can choose Download XML and End, End without downloading, or Cancel.
- Downloaded XML represents the latest server-accepted board revision.
- Choosing End without downloading closes the session without requiring an XML file.
- If the owner cancels the download or it fails, the session remains Active unless the owner explicitly chooses End without downloading.
- Successful closure notifies/disconnects participants and triggers temporary-data deletion.

**Status:** Confirmed. Exact latest-revision handshake is an implementation gate.

## Delivery, quality, and scope boundaries

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S34 - Demonstrate Whiteboard within the $0 budget

**Kind:** Enabler — delivery constraint.

**As a** project owner, **I want** a local or no-cost demo path, **so that** I can develop, test, and show the work to seniors without spending money.

**Acceptance criteria**

- Local development and demonstration do not require paid services or paid editor licensing.
- No automatic paid overages are enabled.
- Any free-tier or tunnel demo clearly communicates limits such as sleeping, restarts, quotas, missing backups, or temporary data.
- If an external email/realtime/hosting capability has no usable free option, development can use a local substitute or pause public access rather than incur a cost.
- A demo does not claim production availability, long-term storage, or production security review unless those are actually delivered.

**Status:** Zero budget confirmed. Exact no-cost provider/hosting selection is pending.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S35 - Keep the editor maintainable for future changes

**Kind:** Enabler — architecture quality.

**As a** product team, **I want** editor, document format, templates, and realtime integration behind Whiteboard-owned boundaries, **so that** future changes do not require rewriting unrelated product areas.

**Acceptance criteria**

- Whiteboard's XML/document model is not simply an undocumented dump of the editor vendor's internal records.
- Engine-specific data is contained behind an adapter boundary.
- Templates are represented as data using the Whiteboard document model.
- Replacing the engine or evolving the XML format has an explicit migration path.
- No Squid-specific identity or navigation assumptions are spread across editor/document code.

**Status:** Confirmed design goal; exact module boundaries are implementation design.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.

---

### WB-S36 - Integrate with Squid later through one interface (deferred)

**Kind:** Deferred integration — not standalone V1 work.

**As a** Squid user, **I want** to open Whiteboard from an approved Squid entry point, **so that** I can use it with Squid identity and workspace context.

**Acceptance criteria when this is separately approved**

- Inspect the live Squid architecture at that time; do not infer production interfaces from this current workspace.
- Squid communicates with Whiteboard through one defined host adapter/interface.
- The interface carries only the required user, workspace, permissions, theme/locale, and return-navigation context.
- Whiteboard remains a separate feature; Squid does not duplicate Whiteboard behavior across product screens.
- Squid membership and role authorization are enforced server-side.

**Status:** Deferred. Do not include this in the standalone V1 implementation until separately authorized.

**Definition of Done for this story**

- Complete the story's relevant task subtasks; satisfy its acceptance criteria; close technical gates before dependent behavior; meet applicable security checks; validate with the smallest useful repository task; and record unresolved release gates. A planning document alone does not mark implementation done.
- Record every discovered deferred item in `.project/WHITEBOARD-IMPLEMENTATION-BACKLOG.md` with enough context to resume it; a code comment alone is not a deferral record.
- Update affected documentation in the same change, including the relevant module contract, runbook, and user-facing docs. Update only documents the change affects.
- Introduce no new critical or high security findings.
- If the story adds an asynchronous/background path, define its observable signal, actionable threshold, and runbook response for that threshold.
- Apply this DoD only if WB-S36 is separately approved; WB-S36 remains outside standalone V1 until then.

---

