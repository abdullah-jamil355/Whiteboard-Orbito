# Whiteboard V1 Tasks and Subtasks

- **Prepared:** 13 October 2026
- **Reviewed:** 14 October 2026
- **Stories:** [WHITEBOARD_USER_STORIES.md](./WHITEBOARD_USER_STORIES.md)
- **Scope:** Tasks and subtasks mapped to the 36 Story IDs. Story descriptions and story acceptance criteria remain in the separate stories file.
- **Current implementation target:** the connected workspace, with Whiteboard isolated from Squid's current screens, login, and backend.
- **Budget:** $0. Do not select paid services or enable paid overages.

**Separation:** This file contains the task/subtask breakdown and cross-story security checks. Each WB-Sxx section uses the story's ID and exact name; it does not copy the story description or acceptance criteria.

## How to use this breakdown

- A **task** is a deliverable: the capability or boundary that should exist when its work is done.
- A **subtask** is one concrete implementation step toward that deliverable. Complete the numbered subtasks from top to bottom unless a technical gate below says to decide something first.
- Before starting a task, read its story and acceptance criteria. They define the user-visible result; the task heading tells you what to build, and each subtask tells you the next action.
- Mark a subtask complete only after the described change exists and its behavior can be observed. Mark its task complete when all subtasks are done and the task outcome meets the relevant story acceptance criteria. Mark the story complete only after all its acceptance criteria pass.
- Task and subtask IDs are stable references and include the story ID.
- Items labelled **Gate** are technical feasibility decisions to validate during the first relevant implementation slice. They do not call for building engine comparison prototypes.
- Items labelled **Deferred** belong to WB-S36 and must not be implemented until Squid integration is separately approved.
- Story acceptance criteria remain authoritative. If a task appears to conflict with the story, follow the story and update this breakdown. Resolve a technical gate before work that depends on it; an open gate must not block unrelated local-board work.

### Example: how to read a task

For story `WB-S01 - Open Whiteboard independently`, this file lists only its tasks. `WB-S01-T01 - Establish the standalone app boundary` is one task. Its subtasks mean: (1) give Whiteboard its own workspace/app configuration and only the packages it needs, (2) create its own route and page layout, and (3) check that Whiteboard does not import or depend on Squid's app or API. The story's user need and story-level acceptance criteria are in the separate stories file. Each numbered subtask here is a work step, not another story.

### Terms used in the steps

- **Canonical Whiteboard model:** the app's own agreed data shape for boards, shapes, text, connectors, and styles. It is the source representation that XML save/load and the editor adapter use; it is not a vendor's private storage format.
- **Adapter:** a small boundary that translates between Whiteboard's model and a library or service. It keeps vendor-specific details out of the rest of the feature.
- **Transient/presence state:** temporary live information such as cursor position, who is connected, and the presenter's current view. It is not saved in a normal XML project or permanent edit history.
- **Server-accepted edit:** a change that the server has authorized, ordered, and accepted. A local/offline change is not accepted until the server confirms it.
- **Snapshot and operation:** a snapshot is a saved copy of the board at a point in time; an operation is one accepted change after that point. Recovery loads a snapshot and reapplies later operations.
- **Gate:** a decision or feasibility check that must happen before depending on that technical behavior. The gate does not mean build two prototypes; the research decision already ruled out comparison prototypes.

---

## Tasks for WB-S01 - Open Whiteboard independently

### WB-S01-T01 - Establish the standalone app boundary

- [x] WB-S01-T01.1 Add a Whiteboard-owned app/workspace manifest and only the dependencies needed by this app.
- [x] WB-S01-T01.2 Add a standalone route, layout, and app-level styling/configuration.
- [x] WB-S01-T01.3 Keep imports and runtime dependencies out of the existing Squid app and API.

### WB-S01-T02 - Provide an independent local run path

- [x] WB-S01-T02.1 Add local development/build commands using the repo's workspace control plane conventions.
- [x] WB-S01-T02.2 Document the app's local URL, environment variables, and required services.
- [x] WB-S01-T02.3 Confirm the app can render without Squid login, Squid API, or a Squid workspace.

## Tasks for WB-S02 - Create a blank board

### WB-S02-T01 - Define blank-board defaults

- [x] WB-S02-T01.1 Define the Whiteboard-owned board state and one-canvas default.
- [x] WB-S02-T01.2 Initialize a new board with the title `Untitled` and no server persistence.
- [x] WB-S02-T01.3 Track local dirty/saved state independently of any live session.

### WB-S02-T02 - Add board creation and rename UI

- [x] WB-S02-T02.1 Add a clear action to create/open a blank board.
- [x] WB-S02-T02.2 Allow the user to rename the local board and reflect the title in the UI.
- [x] WB-S02-T02.3 Keep normal-mode rename local until the user explicitly saves the XML file.

**Implementation review (16 October 2026):** WB-S01 uses its own Next.js app manifest, route, layout, and standalone dependencies; the feature barrel exports a single future host adapter contract without wiring it into Squid. The app requires no environment variables or external services in standalone local use. WB-S02 initializes one local canvas titled `Untitled`, supports local title editing, tracks dirty/saved state in client memory, and only serializes the board when XML save is explicitly requested. Focused TypeScript check, ESLint, production build, and HTTP smoke check against `http://localhost:3100/` passed (HTTP 200; Whiteboard and `Untitled` content present). Import/runtime search found no Squid or database dependencies and no `fetch` call in the app. The repository control-plane invocation and a sandboxed server launch initially hit Windows access restrictions; direct app binaries and the already-running localhost server provided equivalent validation. No new asynchronous path or server integration was introduced. No security scan was run; the added host contract is type-only and is not consumed by the app, so it adds no credentials, network calls, or authorization behavior.

## Tasks for WB-S03 - Start from a built-in template

### WB-S03-T01 - Define the template data contract and catalog

- [x] WB-S03-T01.1 Define a template format using Whiteboard-owned document data, not vendor-specific persisted records.
- [x] WB-S03-T01.2 Add blank, organization chart, ERD, mind map, and simple Kanban templates.
- [x] WB-S03-T01.3 Add flowchart, cross-functional flowchart, workflow, data flow, UML sequence, UML use case, and UML activity templates.

### WB-S03-T02 - Add template selection and editable copies

- [x] WB-S03-T02.1 Show the built-in template catalog with understandable names and previews/descriptions.
- [x] WB-S03-T02.2 Instantiate a new board by copying the selected template and assigning fresh object IDs.
- [x] WB-S03-T02.3 Ensure changes to a board created from a template never mutate the catalog template.

**Implementation review:** Added a Whiteboard-owned catalog of all 12 requested templates and a picker with names, descriptions, and previews. Instantiation makes a separate board and fresh object IDs, remapping text-to-shape and connector references. Nonblank template contents are uniformly scaled and centered to use most of the 1200×800 canvas; sparse diagrams now include more useful sample shapes, labels, and relationships. The unsaved-board replacement guard is reused when selecting a template. TypeScript, ESLint, production build, and a template-data smoke check pass. The smoke check verified all 12 instantiate, every nonblank template has at least three shapes, IDs remain unique and separate from catalog IDs, and copied layouts fit the canvas. WB-S08 renders and edits the cloned connector objects, resolving the prior connector dependency for editable template copies.

## Tasks for WB-S04 - Draw freehand marks

### WB-S04-T01 - Implement the pen interaction

- [x] WB-S04-T01.1 Add pen to the tool model and make it selectable from the toolbar.
- [x] WB-S04-T01.2 Convert pointer input into a freehand stroke in canvas coordinates.
- [x] WB-S04-T01.3 Apply the selected color and thin/medium/thick line weight to new strokes.

### WB-S04-T02 - Commit a stroke as one edit

- [x] WB-S04-T02.1 Buffer pointer samples while the user is drawing.
- [x] WB-S04-T02.2 Commit one stroke object/action when the gesture completes.
- [x] WB-S04-T02.3 Avoid emitting one undo/history action for every pointer sample.

**Implementation review:** Added an accessible pen tool, five predefined pen colors, three line weights, pointer capture, logical 1200×800 canvas coordinates, live stroke preview, and SVG rendering. A completed drag appends exactly one canonical stroke object and one stroke-history entry; toolbar Undo/Redo and Ctrl+Z undo strokes as whole gestures. The XML point limit is shared with the drawing buffer. Whiteboard typecheck, ESLint, `git diff --check`, and browser interaction checks passed, including color/weight rendering and undo/redo. Shapes, text, lines, arrows, and connectors now render and support the local editor interactions; WB-S08 resolved the template connector dependency. WB-S03's templates can now be copied and edited as normal boards. No asynchronous/background path was added.

## Tasks for WB-S05 - Add and resize basic shapes

### WB-S05-T01 - Add rectangle, circle, and diamond tools

- [x] WB-S05-T01.1 Add the three shape kinds to the canonical object model and toolbar.
- [x] WB-S05-T01.2 Create a shape from a canvas gesture with sensible initial bounds.
- [x] WB-S05-T01.3 Render each shape with stable identity and editable bounds.

### WB-S05-T02 - Resize without changing shape type

- [x] WB-S05-T02.1 Add selection handles and resize behavior for each supported shape.
- [x] WB-S05-T02.2 Preserve the shape kind while updating its dimensions.
- [x] WB-S05-T02.3 Verify circle rendering and resize stay circular across viewport sizes.

**WB-S05 implementation review:** Added the three shape tools, drag previews, ordered SVG rendering from canonical board objects, stable IDs, select-to-show corner handles, resize updates that preserve shape kind, and square geometry for circles created or resized in the editor. The user's screenshot exposed viewport distortion from non-uniform SVG scaling; the canvas now uses uniform aspect-preserving rendering and maps pointer coordinates through the SVG screen transform. The user refreshed and confirmed the circle now looks correct. Rotation controls were not added. Whiteboard typecheck, ESLint, production build, and `git diff --check` passed.

## Tasks for WB-S06 - Add text and write inside shapes

### WB-S06-T01 - Support standalone and shape-bound text

- [x] WB-S06-T01.1 Use canonical text objects and explicit parent-shape binding in Whiteboard document data.
- [x] WB-S06-T01.2 Add text on canvas and text-edit behavior inside existing or template shapes.
- [x] WB-S06-T01.3 Move and resize bound text with its shape.

### WB-S06-T02 - Add text layout and formatting

- [x] WB-S06-T02.1 Implement wrapping and shape-bound clipping within the text object's bounds.
- [x] WB-S06-T02.2 Add left/center/right alignment, font size, and bold controls.
- [x] WB-S06-T02.3 Keep text edits separate from shape kind and shape style updates. **Gate:** passed with the current Whiteboard-owned SVG editor.

**Implementation review:** The canonical `TextObject` and `parentShapeId` contract now drive the Text tool. Text can be created on blank canvas or inside normal/template shapes; existing text reopens in Text mode, and Select mode gives text a visible outline and drag movement. Text editing ends on blur or Escape. Bound text remains attached when its shape moves/resizes. Wrapping, alignment, font size, and bold are supported; rendering uses inert React text with no HTML injection. TypeScript and ESLint pass. Production build is blocked by Windows workspace path canonicalization; browser interaction still needs visual verification. No asynchronous path was added.

## Tasks for WB-S07 - Style shapes, text, and lines

### WB-S07-T01 - Implement palette and line-weight state

- [x] WB-S07-T01.1 Define the predefined palette centrally and make it available to tools and object properties.
- [x] WB-S07-T01.2 Apply palette colors to fills, outlines, connectors/arrows, text, and pen strokes.
- [x] WB-S07-T01.3 Add thin, medium, and thick line weights; default each stroke tool to thin and keep edits to an existing shape local to that shape; do not add a custom color picker.

### WB-S07-T02 - Add transparent fills and grid occlusion

- [x] WB-S07-T02.1 Represent no-fill/transparent as an explicit shape style.
- [x] WB-S07-T02.2 Ensure the grid is masked inside filled and no-fill shapes according to the product rule.
- [x] WB-S07-T02.3 Preserve shape identity when colors or fill are changed. **Gate:** verified with the Whiteboard-owned SVG canvas and canonical XML style fields.

**Implementation review:** The fixed palette and weight model now apply to pen strokes, shapes, text, lines, arrows, and connectors. Shape type remains stable when its styles change; the grid stays occluded inside filled and no-fill shapes. Browser checks verified the existing S07 cases and the new red thick arrow and connector styling. WB-S08 implements the previously deferred line and connector tools. TypeScript and ESLint pass. No async path or new external boundary was introduced.

## Tasks for WB-S08 - Draw lines, arrows, and attached connectors

### WB-S08-T01 - Add straight lines and arrows

- [x] WB-S08-T01.1 Add straight-line and arrow tools and object types.
- [x] WB-S08-T01.2 Add endpoint and stroke styling from the shared palette/line-weight model.
- [x] WB-S08-T01.3 Persist line and arrow geometry in Whiteboard document data.

### WB-S08-T02 - Add attached 90-degree connectors

- [x] WB-S08-T02.1 Add a connector tool that can attach either endpoint to a shape connection point.
- [x] WB-S08-T02.2 Recompute connector route when a bound shape moves or resizes.
- [x] WB-S08-T02.3 Keep bend editing out of V1. **Gate:** met with the Whiteboard-owned SVG canvas; no manual bend handle is exposed.

### WB-S08-T03 - Fit the full drawing surface to the viewport

- [x] WB-S08-T03.1 Fit the logical SVG viewBox to the actual canvas aspect ratio so horizontal gutters do not become unreachable regions.
- [x] WB-S08-T03.2 Expand logical canvas bounds to preserve all existing content and constrain move, resize, and draw gestures to the usable surface.
- [x] WB-S08-T03.3 Keep graph-paper spacing aligned with the responsive logical-to-screen scale.

### WB-S08-T04 - Connect shapes and bind arrows

- [x] WB-S08-T04.1 Show keyboard-accessible directional quick-connect handles on hovered or selected shapes; click to connect to the nearest shape in that direction or drag to choose a target.
- [x] WB-S08-T04.2 Attach line and arrow endpoints dropped on shapes and persist their shape ID and connection point in XML.
- [x] WB-S08-T04.3 Update attached line, arrow, and connector endpoints when a bound shape moves or resizes.

**Implementation review:** Lines and arrows draw and persist with the shared palette and weight. Hovering a shape in Select mode exposes four directional quick-connect controls; clicking a control automatically connects to the nearest target in that direction, while dragging it to a shape connects to that chosen target. Connector, line, and arrow endpoints dropped on shapes are bound and follow those shapes when they move or resize. The responsive SVG viewBox now fills the available canvas ratio and expands to preserve content, so the left and right canvas edges are interactive. Browser checks drew shapes at both edges, clicked a quick-connect control to join distant shapes, drew an attached arrow between shapes, and moved a bound shape to verify both routes updated. Connector bends remain automatic in V1. TypeScript, ESLint, and production build pass. No background path or external integration was introduced.

## Tasks for WB-S09 - Erase strokes and objects

### WB-S09-T01 - Implement stroke-segment erasing

- [x] WB-S09-T01.1 Detect which stroke segments intersect the eraser path.
- [x] WB-S09-T01.2 Split/remove only the touched portions and keep untouched stroke portions.
- [x] WB-S09-T01.3 Record the completed erase gesture as one local edit action.

### WB-S09-T02 - Implement object erasing

- [x] WB-S09-T02.1 Detect shape/text objects touched by the eraser.
- [x] WB-S09-T02.2 Remove the whole touched shape or text object, including its bound text where appropriate.
- [x] WB-S09-T02.3 Avoid deleting nearby objects that the eraser did not touch.

**WB-S09 implementation review:** Added a pointer-driven eraser with a visible 12 px path preview. Stroke segments are clipped against the swept eraser path, and each surviving piece remains an editable stroke object with a stable ID. Shapes, text, lines, arrows, and connectors are removed only when their geometry intersects the eraser path. Erasing a shape also removes bound text and detaches its lines/connectors while preserving their endpoint positions. A completed erase gesture creates one local Undo/Redo history entry. Browser checks verified partial-stroke splitting, whole-shape/text deletion, untouched nearby content, and undo/redo restoration. Typecheck, ESLint, and production build pass. The story introduces no asynchronous/background path, so no new runbook signal is required.

## Tasks for WB-S10 - Select, move, and manage objects

**Implementation status:** Local object selection, transforms, clipboard operations, and stacking are implemented in `apps/whiteboard/features/board`. Shared-session propagation uses the existing ordered semantic update path from WB-S17/WB-S26. Multi-browser visibility remains a release verification gate.

### WB-S10-T01 - Implement object selection and transformations

- [x] WB-S10-T01.1 Add click selection, box selection, multi-selection, and Select All.
- [x] WB-S10-T01.2 Add move, resize, and delete operations for supported objects.
- [x] WB-S10-T01.3 Preserve shape/text and shape/connector bindings during selection and movement.

### WB-S10-T02 - Implement clipboard and duplicate operations

- [x] WB-S10-T02.1 Add copy, cut, paste, and duplicate with new stable IDs for pasted copies.
- [x] WB-S10-T02.2 Preserve relationships between objects copied together, including bound text/connectors.
- [x] WB-S10-T02.3 Add keyboard shortcuts and select-all behavior consistent with WB-S12.

### WB-S10-T03 - Add stacking order controls

- [x] WB-S10-T03.1 Store or derive a stable object z-order.
- [x] WB-S10-T03.2 Add Bring to Front and Send to Back actions.
- [x] WB-S10-T03.3 Persist stacking order in XML and shared session updates. Board object order is included in the semantic diff as `objects.order`, validated by the API, committed with the accepted board revision, replayed from the operation log, and retained by XML serialization. Existing backend tests cover insertion order; multi-browser visibility remains part of the live-session verification gate.

**WB-S10 verification:** Browser checks covered duplicate, copy/paste, box-selecting three shapes, moving the selected set, sending an object to back and bringing it to front, then deleting temporary test objects. TypeScript and ESLint pass. XML stores objects in back-to-front order.

**Selection interaction update:** Select-mode single-click targets the exact shape, text, stroke, line, arrow, or connector. Double-click text enters editing. Shift-click toggles an object in the current selection; dragging an empty-canvas marquee selects only objects fully enclosed, and Shift+marquee adds those objects. Dragging any selected member moves the group. Dotted selection, keyboard-focus, and resize-preview outlines follow each object's own geometry or path, including arrowheads and routed connectors; linear objects expose resize handles at their endpoints instead of their bounding-box corners. Dragging an attached linear object moves it by detaching endpoints whose shapes are not part of the selection; endpoints stay bound when their shapes move in the same selection. This update is statically validated; the existing browser-verification note above predates it.

## Tasks for WB-S11 - Pan and zoom the canvas

### WB-S11-T01 - Implement camera navigation

- [x] WB-S11-T01.1 Define canvas viewport/zoom state separately from board content.
- [x] WB-S11-T01.2 Add zoom in/out, fit-to-screen, reset zoom, and Space+drag pan.
- [x] WB-S11-T01.3 Keep tool gestures and pan gestures from interfering with each other.

### WB-S11-T02 - Render the graph-paper background

- [x] WB-S11-T02.1 Add persistent light graph-paper lines that remain stable during pan/zoom.
- [x] WB-S11-T02.2 Do not add a grid toggle, grid snapping, or alignment guides.
- [x] WB-S11-T02.3 Ensure shapes visually occlude the grid, including no-fill shapes, per WB-S07.

## Tasks for WB-S12 - Use the editor with a keyboard

### WB-S12-T01 - Add keyboard focus and object navigation

- [x] WB-S12-T01.1 Make toolbar tools and interactive canvas objects reachable through keyboard focus. Toolbar buttons are native controls; each board object is directly keyboard-focusable on the drawing surface.
- [x] WB-S12-T01.2 Implement Tab navigation across objects and visible focus indicators.
- [x] WB-S12-T01.3 Provide a semantic object list or equivalent accessible route if the canvas engine does not expose objects accessibly. **Gate:** the custom SVG editor exposes labeled, focusable board-object groups directly on the drawing surface.

### WB-S12-T02 - Add keyboard object actions

- [x] WB-S12-T02.1 Map arrow keys and Shift+arrow to selected-object movement.
- [x] WB-S12-T02.2 Map Delete/Backspace, Ctrl+A, Ctrl+C/X/V, and Ctrl+D to object actions.
- [x] WB-S12-T02.3 Map Ctrl+Z/Y and Ctrl+S to the local history and XML download behaviors.

### WB-S12-T03 - Make status and focus understandable

- [x] WB-S12-T03.1 Announce relevant local save state changes to assistive technology. Invitation, permission, and connection state do not exist in the local-only editor; revisit if collaboration state is added.
- [x] WB-S12-T03.2 Communicate roles/errors/status without color as the only signal.
- [ ] WB-S12-T03.3 Check desktop Chrome and Edge keyboard flows against the story's acceptance criteria. An earlier in-app Chromium smoke check covered keyboard actions while the semantic object list still existed; that does not verify direct canvas-object Tab navigation. Desktop Chrome and Edge checks remain open because neither browser is available through this environment's browser connector; C/X/V shortcut checks also could not be driven through the connector's clipboard interception.

**WB-S12 implementation status:** The canvas object list overlay was removed; each board object is now focusable directly from the canvas. Updated direct-focus behavior still requires an in-app smoke check. Desktop Chrome/Edge verification and browser-driven C/X/V verification also remain open; do not mark the story complete until those checks pass.

## Tasks for WB-S13 - Undo and redo in a local board

### WB-S13-T01 - Implement local gesture history

- [x] WB-S13-T01.1 Define reversible local editor actions and their inverse data.
- [x] WB-S13-T01.2 Group one completed drag or stroke into one history entry.
- [x] WB-S13-T01.3 Keep local history isolated from any live-session history.

### WB-S13-T02 - Wire Undo/Redo and branch behavior

- [x] WB-S13-T02.1 Add Undo/Redo controls and Ctrl+Z/Ctrl+Y behavior.
- [x] WB-S13-T02.2 Restore board state after Undo and Redo without changing unrelated objects.
- [x] WB-S13-T02.3 Clear the local Redo branch when a new forward edit is committed.

**WB-S13 implementation review:** Added a Whiteboard-owned local history module that records reversible board-object and title changes by stable ID and original position. Board edits flow through one history boundary, so completed pointer gestures (including moves and pen/erase drags) record once; Undo/Redo restore only affected objects and preserve unrelated edits. History is in-memory and resets when a different board is opened; no live-session history or asynchronous path was added. Toolbar and Ctrl/Cmd+Z/Y behavior were browser-checked for shape creation, keyboard movement, Undo/Redo, and clearing Redo after a new style edit. Whiteboard TypeScript and ESLint pass; `git diff --check` passes. No new high/critical security finding was identified in this local-only change.

## Tasks for WB-S14 - Save an editable XML project file

### WB-S14-T01 - Define the versioned Whiteboard XML contract

- [ ] WB-S14-T01.1 Define root metadata, format version, title, canvas settings, templates, objects, IDs, styles, and connector bindings.
- [ ] WB-S14-T01.2 Keep presence, credentials, invitation tokens, and transient viewport state out of the normal project XML.
- [ ] WB-S14-T01.3 Record an XML compatibility/versioning policy and initial schema version.

### WB-S14-T02 - Serialize and download the project

- [ ] WB-S14-T02.1 Serialize the canonical Whiteboard model into deterministic XML.
- [ ] WB-S14-T02.2 Add Save and Ctrl+S browser download behavior with a sensible filename.
- [ ] WB-S14-T02.3 Update local dirty/saved state only after a successful save/download initiation.

## Tasks for WB-S15 - Open a Whiteboard XML file

### WB-S15-T01 - Parse, validate, and migrate supported files

- [ ] WB-S15-T01.1 Parse XML as data with safe parser settings and a file-size limit.
- [ ] WB-S15-T01.2 Validate version, object types, IDs, field values, geometry, text limits, and connector references.
- [ ] WB-S15-T01.3 Add explicit migrations for supported older Whiteboard versions; reject unsupported future versions.

### WB-S15-T02 - Load files atomically and support live startup

- [ ] WB-S15-T02.1 Build a candidate board from validated data before replacing the current board.
- [ ] WB-S15-T02.2 On parse/validation failure, retain the currently open board and show a clear error.
- [ ] WB-S15-T02.3 Allow a validated imported board to be selected as the source when starting a live session.

## Tasks for WB-S16 - Warn about unsaved local changes

### WB-S16-T01 - Track dirty state and offer save/discard

- [x] WB-S16-T01.1 Track edits since the last successful local XML save.
- [x] WB-S16-T01.2 Before replacing the board, offer Save, Discard, or Cancel.
- [x] WB-S16-T01.3 Ensure Cancel leaves the current document and selection intact.

### WB-S16-T02 - Guard navigation and close

- [ ] WB-S16-T02.1 Deferred until in-app navigation is introduced; guard that navigation against unsaved changes.
- [x] WB-S16-T02.2 Use the browser-supported unload warning where available.
- [x] WB-S16-T02.3 Keep warning copy clear about whether a download/save succeeded.

**Implementation review:** Current standalone V1 scope is implemented: Save/Discard/Cancel protects replacement by XML import or New board when the current board has unsaved objects; an empty canvas is replaced directly without a save prompt. Cancel leaves the current board untouched; dirty boards register the browser-native `beforeunload` warning. In Microsoft Edge, refreshing a dirty board displayed the native “Reload site? Changes you made may not be saved.” warning; canceling preserved the edited board. Browser close prompts provide Stay/Leave rather than custom Save/Discard controls, which is reflected in the acceptance criteria. TypeScript, ESLint, and `git diff --check` passed. WB-S16-T02.1 remains deferred because this standalone app has no in-app navigation; it is recorded in the implementation backlog for when navigation is introduced. Download completion cannot be confirmed by the web app, so UI and docs report download initiation. No asynchronous/background path was added, so the async-path DoD does not apply. No dedicated security scan was run for this local UI-only change.

## Tasks for WB-S17 - Start a live session

### WB-S17-T01 - Define session state and creation inputs

- [x] WB-S17-T01.1 Define owner, title, session mode, source board, lifecycle state, and timestamps.
- [x] WB-S17-T01.2 Add creation choices for Live Collaboration and Presentation; do not allow a mode change mid-session.
- [x] WB-S17-T01.3 Accept blank, built-in template, or validated imported XML as the initial board.

### WB-S17-T02 - Implement owner creation flow

- [x] WB-S17-T02.1 Add session title and mode selection UI before creation.
- [x] WB-S17-T02.2 Create the session as Active immediately, even with no invitees.
- [x] WB-S17-T02.3 Restrict session rename and end controls to the verified server-side owner.

### WB-S17-T03 - Implement the server-owned session boundary

- [x] WB-S17-T03.1 Validate and persist an Active session snapshot with owner identity derived from the verified server cookie.
- [x] WB-S17-T03.2 Enforce owner-only read, rename, and end; keep mode immutable and validate the complete board snapshot.
- [x] WB-S17-T03.3 Wire the app email verification and session-create/rename/end flows to the API.
- [ ] WB-S17-T03.4 Verify the complete browser-to-API flow and MongoDB repository against the configured development database, including persistence and non-owner denial. API-level separate-identity authorization and a two-client Hocuspocus sync now pass; the app's browser confirmation/session flow still needs end-to-end verification.

**Implementation review:** The app snapshots the current canonical board and submits it with a non-empty title and Live Collaboration/Presentation mode. The API authenticates the verified identity, creates the session Active, fixes its mode, and owns rename/end authorization. The app restores the initial server snapshot for the active session in the current tab. API test suite passed (27 tests), app/API typecheck/lint/build passed, the browser confirmed the sign-in dialog and successful local sign-in-link request after correcting the test origin, and a local HTTP-client integration run against configured MongoDB passed sign-in consume plus session create/read/rename/end. The browser-based verify-button-to-session path was not fully exercised. Board edits still remain local after startup; invitations, realtime, and accepted-operation recovery are not implemented. No asynchronous/background path was added; no dedicated security scan was run.

**Backend progress (2026-10-18):** Added API-owned identity and session boundaries, private email-link verification page, app session API wiring, server-validated board snapshot, immutable mode, MongoDB persistence, and owner-only create/read/rename/end. API typecheck/lint/build and 27 tests pass; app typecheck/lint/build pass. A direct local HTTP flow exercised the configured MongoDB repository and ended its test session. WB-S17 stays incomplete until the browser confirm-link path, same-tab reload restoration, and non-owner denial are verified together. Board edits are not synchronized after session creation; that is later realtime work.

**WB-S17 integration recheck (2026-10-19):** Against the configured development MongoDB, one-time identity verification and an authenticated browser owner flow created/rejoined the live session after an API/realtime restart; the persisted board restored with its two objects. Non-owner GET/rename/end denial was separately exercised through the live API in a prior check. The synthetic session was explicitly ended through the browser and Mongo cleanup path; its active-session entry disappeared and DELETE returned 200. WB-S17-T03.4 remains open until the browser and non-owner denial checks are verified together end-to-end.

**WB-S17 two-identity API verification (2026-10-19):** A temporary local integration check created separate owner, invited Editor, and unrelated identities through the development mailbox; it created the session in configured MongoDB, accepted the private invite, confirmed the Editor read the persisted board, confirmed the unrelated identity received `session_not_found`, and ended the test session. This strengthens API/repository evidence but does not close WB-S17-T03.4 because the complete verification must include the browser confirmation flow.

**WB-S17 realtime sync verification (2026-10-20):** `whiteboard:test:realtime` passed against the local API, configured MongoDB, and Hocuspocus listener using independent Owner and Editor identities. Both authenticated, accepted invitation membership, received the persisted initial state, and received each other's accepted object edits; the temporary session was ended in script cleanup. Browser UI confirmation and session-creation flow remain open, so WB-S17-T03.4 remains unchecked.

## Tasks for WB-S18 - Invite an Editor to Live Collaboration

### WB-S18-T01 - Define invitation data and lifecycle

- [x] WB-S18-T01.1 Model invitation email, session, fixed role, token hash, sent time, expiry, cancellation, and acceptance state.
- [x] WB-S18-T01.2 Set expiry to 10 minutes and make invitation acceptance single-use.
- [x] WB-S18-T01.3 Keep invitation delivery behind a replaceable email adapter; selected loopback-only local demo mailbox. Production provider remains a release gate.

### WB-S18-T02 - Build owner invite flow and email action

- [x] WB-S18-T02.1 Add owner email entry and pending-invitation list/cancel UI.
- [x] WB-S18-T02.2 Send a private Accept invitation link with no public room-join link; token is stored as a hash and omitted from API responses.
- [x] WB-S18-T02.3 Assign Live Collaboration Editor on server; allow owner cancellation and invitations after session start; reject expired links. UI lists only pending, unexpired invites. End-to-end browser validation and production delivery remain open.

## Tasks for WB-S19 - Assign a presentation role when inviting

### WB-S19-T01 - Require role selection for presentation invitations

- [x] WB-S19-T01.1 Add an explicit Editor/Viewer choice to the owner invite flow in Presentation mode.
- [x] WB-S19-T01.2 Store the fixed role with the invitation and accepted membership on the server.
- [x] WB-S19-T01.3 Require explicit role selection; no Presentation role default is sent.

### WB-S19-T02 - Keep role fixed for the session

- [x] WB-S19-T02.1 Enforce the stored role on every session command and room connection. Authenticated multi-browser verification remains open.
- [x] WB-S19-T02.2 Prevent role edits on an existing accepted invitation/membership.
- [x] WB-S19-T02.3 Support role change only through cancel/revoke and a new invitation with the intended role.

## Tasks for WB-S20 - Accept an invitation and keep a verified identity

### WB-S20-T01 - Verify invited email ownership

- [x] WB-S20-T01.1 Specify accept-link flow: sign in through a one-time email verification link, then deliberately accept the invitation. Development uses the loopback-only mailbox; production email provider remains gated.
- [x] WB-S20-T01.2 Bind the invitation to normalized email, session, role, expiry, cancellation, and atomic single-use state on acceptance.
- [x] WB-S20-T01.3 Require an existing verified server identity/session and record it with accepted membership; never trust client-provided email or role. Acceptance does not issue a second session credential.

### WB-S20-T02 - Collect participant identity and support rejoin

- [x] WB-S20-T02.1 Ask for a display name and render an initials avatar; omit custom profile photos.
- [x] WB-S20-T02.2 Associate accepted membership with the verified identity for the session.
- [x] WB-S20-T02.3 Reverify the same email to discover and rejoin active sessions; removed members cannot rejoin with an old membership. Multi-browser verification remains open.

## Tasks for WB-S21 - Enforce the six-member session limit

### WB-S21-T01 - Implement atomic durable-member admission

- [x] WB-S21-T01.1 Count owner plus five invitees; pending invitations do not reserve member slots.
- [x] WB-S21-T01.2 Atomically consume the invitation and add its verified identity to durable session membership.
- [x] WB-S21-T01.3 Keep a full-session invitation unconsumed and reject acceptance until a member slot becomes available or it expires.

### WB-S21-T02 - Preserve membership across disconnect and support revocation

- [x] WB-S21-T02.1 Disconnect releases only its live connection lease; retain membership and allow reconnect while Active.
- [x] WB-S21-T02.2 Remove/revoke a member explicitly and require a new invitation for rejoin. Live socket/browser verification remains open.
- [x] WB-S21-T02.3 Verify final-member-slot acceptance races admit only one participant and leave the losing invite pending.

## Tasks for WB-S22 - Show live participants and cursors

### WB-S22-T01 - Define and broadcast transient presence

- [x] WB-S22-T01.1 Define transient identity display, verified role, bounded cursor, and session-room connection state; no selection/tool hint is needed in V1.
- [x] WB-S22-T01.2 Publish current presence only through the authenticated Hocuspocus session room.
- [x] WB-S22-T01.3 Keep presence out of XML files and durable document history.

### WB-S22-T02 - Render avatars and role-appropriate cursors

- [x] WB-S22-T02.1 Show connected names and initials avatars.
- [x] WB-S22-T02.2 Show Owner/Editor cursors; server sanitization removes Viewer cursor data.
- [x] WB-S22-T02.3 Remove stale presence through awareness disconnect/expiry and expose the local reconnecting/disconnected session state. Live multi-browser timing verification remains open.

## Tasks for WB-S23 - Enforce permissions on the server

### WB-S23-T01 - Authorize room connection and operations

- [x] WB-S23-T01.1 Validate authenticated identity, active session, durable membership, and seat lease before room join; reject revoked or ended sessions.
- [x] WB-S23-T01.2 Recheck active membership for sync/edit commands and owner identity/mode for presentation viewport messages; persistence transactions recheck membership before accepting a board edit.
- [x] WB-S23-T01.3 Reject Viewer edits and non-owner presentation actions at the server boundary, independent of UI controls.

### WB-S23-T02 - Revoke access immediately

- [x] WB-S23-T02.1 Treat room IDs as locators only; bind role and identity to the verified cookie and persisted membership, and overwrite client awareness identity.
- [x] WB-S23-T02.2 Revoke durable membership and close the participant's active socket immediately after the revocation commits.
- [x] WB-S23-T02.3 Reject reconnects and writes for revoked identities until a new invitation is accepted.

**WB-S23 implementation status:** Server-side authentication, role/membership checks, Viewer write rejection, and immediate revocation are implemented. Automated authorization/revocation tests exist. Real-socket tamper, wrong-room, and reconnect-after-revocation browser checks remain release gates; do not mark the story complete until those pass.

## Tasks for WB-S24 - See live edits and resolve conflicting edits

### WB-S24-T01 - Define a server-ordered edit command

- [x] WB-S24-T01.1 Define semantic edit commands with actor, session, target object/property, payload, and action ID. The server derives actor/session from the authenticated room and command context.
- [x] WB-S24-T01.2 Validate and assign a monotonically increasing server sequence to accepted changes.
- [x] WB-S24-T01.3 Persist an idempotent operation and canonical board update in one Mongo transaction before acknowledging an accepted edit.

### WB-S24-T02 - Apply conflict policy and broadcast changes

- [x] WB-S24-T02.1 Make the later server-accepted same-object/property change determine the final value.
- [x] WB-S24-T02.2 Preserve independent property changes when safe; covered by focused merge tests and concurrent Mongo integration.
- [x] WB-S24-T02.3 Broadcast accepted changes promptly and return explicit rejected/degraded results when not accepted. The server broadcasts only after transaction commit; rejected and storage-degraded commands return explicit results. Raw Yjs updates are rejected, not merged into the semantic board model. Two-browser delivery and rejection UX remain browser-verification gates.

## Tasks for WB-S25 - Synchronize queued changes after reconnect

### WB-S25-T01 - Track connection state and queue eligible offline edits

- [x] WB-S25-T01.1 Show connected, reconnecting, and disconnected status. Browser verification remains open.
- [x] WB-S25-T01.2 Retain offline edits with stable IDs and their original operation intent for later replay; cap the device queue at 500 edits/1 MB and refuse the next edit before applying it when full.
- [x] WB-S25-T01.3 Avoid showing offline edits as server-accepted or durably saved before confirmation.

### WB-S25-T02 - Authenticate, catch up, and reconcile on reconnect

- [x] WB-S25-T02.1 Reauthenticate and fetch the latest accepted board state/sequence.
- [x] WB-S25-T02.2 Replay eligible queued operations in deterministic order through the server conflict/authorization path.
- [x] WB-S25-T02.3 Surface rejected operations and preserve them locally; entries older than seven days remain stored and require explicit confirmation before retry. Local browser-provider reconnect recovery passed after an isolated API/realtime restart: the queued offline edit synced once and the board retained two objects. Stale-edit/conflict validation remains a release gate.

**WB-S25 reconnect retry fix (2026-10-19):** When transport leaves `connected` with an edit awaiting acknowledgement, the client clears only the volatile in-flight action marker; it retains the queued edit and stable action ID. After reauthentication and canonical-state sync, the action can be retried and the server's idempotency record prevents a duplicate commit. Regression tests cover retaining the marker while connected and resetting it on connecting/disconnected states. A local browser-provider test then restarted the isolated API/realtime processes while an offline edit was queued; the owner reconnected, the queue cleared, and the board contained exactly two objects with no duplicate. Stale-edit/conflict and multi-participant verification remain open.

## Tasks for WB-S26 - Use shared Undo and Redo in a live session

### WB-S26-T01 - Build global action history

- [x] WB-S26-T01.1 Store one server history entry per accepted semantic edit; completed pen/erase/move/resize/create/delete/style pointer gestures submit one edit operation.
- [x] WB-S26-T01.2 Persist action ID, actor, server sequence, forward operation, inverse, and affected target/property guards with the operation record.
- [x] WB-S26-T01.3 Assign Undo/Redo through the same Mongo transaction and server sequence as edits; authorize current Owner/Editor membership and reject Viewers.

### WB-S26-T02 - Implement shared Undo/Redo behavior

- [x] WB-S26-T02.1 Allow an authorized Editor to undo the latest accepted action from any participant.
- [x] WB-S26-T02.2 Redo the latest undone action and clear Redo after a new meaningful forward edit.
- [x] WB-S26-T02.3 Reject an unsafe inverse before commit; keep the board unchanged and show an understandable client message.
- [x] WB-S26-T02.4 Broadcast the committed board, sequence, and Undo/Redo availability to all room participants.

**WB-S26 implementation status:** Mongo-backed history state is capped at 500 actions per session and committed atomically with each board revision; Undo/Redo operations replay through the durable operation log. Unit tests and a direct MongoDB integration passed for forward edit, Undo, Redo, Redo-branch clearing, and operation replay. An actual API process restart and authenticated multi-browser verification remain open, so the story is not complete.

## Tasks for WB-S27 - Persist and recover an active live session

### WB-S27-T01 - Add MongoDB Atlas persistence boundary

- [x] WB-S27-T01.1 Define Whiteboard-owned persistence contracts for sessions, invitations, memberships, operations, and snapshots.
- [x] WB-S27-T01.2 Implement the Mongoose/MongoDB persistence adapter and server-only connection configuration; Atlas uses the configured MongoDB URI and the browser has no database connection.
- [x] WB-S27-T01.3 Keep Atlas credentials server-side and document local environment setup without committing secrets.

### WB-S27-T02 - Persist accepted operations and snapshots

- [x] WB-S27-T02.1 Write accepted semantic operations before acknowledging durable acceptance.
- [x] WB-S27-T02.2 Store canonical Whiteboard board snapshots with the highest included operation sequence (snapshot every 100 accepted operations); raw Yjs updates are intentionally rejected.
- [x] WB-S27-T02.3 Keep the 100-operation snapshot cadence and enforce an 8 MiB BSON limit for board/snapshot and operation documents; tests cover below/over-limit payloads. Atlas capacity and restart recovery remain release gates.

### WB-S27-T03 - Recover sessions and surface persistence failures

- [x] WB-S27-T03.1 Restore a session by loading its latest snapshot and replaying later operations; direct Mongo integration verified recovery after concurrent edits.
- [x] WB-S27-T03.2 On a newly authenticated Hocuspocus connection, load the recovered durable board/sequence and send the latest state; the client reconnect path reconciles queued operations against it. An authenticated Hocuspocus protocol client recovered a committed semantic edit after process restart. A local browser-provider test also confirmed an offline queued edit synced after isolated API/realtime restart without duplication (board retained exactly two objects). Deployed Atlas recovery/cost/backup behavior remains unverified.
- [x] WB-S27-T03.3 Show database/persistence failure and never report failed writes as saved. **Release gate:** choose the no-cost Atlas configuration and confirm its limits.

**WB-S27-T01.3 verification (2026-10-19):** The API reads `MONGODB_URI` only from server process configuration; the Whiteboard browser uses the API/realtime origins and contains no MongoDB connection code. `servers/api/.env.example` contains only a commented localhost URI, `.gitignore` ignores `.env`/`.env.*` while allowing `.env.example`, and `git ls-files` confirms only the example is tracked. The runbook explains local setup without credentials. This verifies repository credential handling and documentation; it does not verify Atlas tier, access controls, backup retention, or deployed secrets, which remain release gates.

## Tasks for WB-S28 - Remove temporary data after a session ends

### WB-S28-T01 - Close sessions and invalidate access

- [x] WB-S28-T01.1 Transition Active to Closed only after an authorized owner end flow; immediately close tracked Hocuspocus room connections after the MongoDB end commit.
- [x] WB-S28-T01.2 Disconnect room members and invalidate invitation/session access on closure.
- [x] WB-S28-T01.3 Reject old room IDs, invite tokens, and reconnect attempts after closure.
- [x] WB-S28-T01.4 When another tab has already ended the session, clear stale local session controls on the authoritative `session_not_found` response while retaining the local board.

### WB-S28-T02 - Delete temporary board/session records

- [x] WB-S28-T02.1 Delete session, invitation, membership, operation, and snapshot data after confirmed closure.
- [x] WB-S28-T02.2 Expire sessions two hours after creation, revoke access, close room connections, delete temporary records, and retry/log failures; see `.project/WHITEBOARD-BACKEND-RUNBOOK.md`.
- [x] WB-S28-T02.3 Reject expired session/invitation/reconnect access and verify expiry boundary/cleanup retry in automated tests. Authenticated browser and deployed MongoDB verification remain story gates.

**WB-S27/S28 verification (2026-10-19):** The control-plane API test task passed (69 API tests plus 2 logging tests). Coverage includes the exact two-hour-from-creation expiry boundary, expiry cleanup retry/failure signals, and authorization behavior. An authenticated Hocuspocus protocol client recovered a committed edit after process restart. The browser-provider also recovered an offline queued edit after isolated API/realtime restart without duplication. Browser expiry behavior and deployed Atlas tier/backup behavior remain unverified.

## Tasks for WB-S29 - Let presentation Viewers follow the owner

### WB-S29-T01 - Broadcast the owner's presentation viewport

- [x] WB-S29-T01.1 Publish owner pan/zoom/camera state as transient presentation data; server role/mode checks and bounds validation apply.
- [x] WB-S29-T01.2 Apply the owner's view to Viewers without adding it to XML or edit history.
- [x] WB-S29-T01.3 Keep the latest presented viewport available during owner disconnection while the realtime process remains running.

### WB-S29-T02 - Lock Viewer navigation and editing

- [x] WB-S29-T02.1 Disable local pan/zoom/navigation actions that would leave the presented view.
- [x] WB-S29-T02.2 Reject viewer edit/navigation commands on the server.
- [x] WB-S29-T02.3 Keep Viewer cursor hidden and communicate the read-only role clearly; cursors are not rendered in V1.

## Tasks for WB-S30 - Let presentation Editors work independently

### WB-S30-T01 - Separate editor and presenter viewports

- [x] WB-S30-T01.1 Keep each Editor's camera state local to that Editor.
- [x] WB-S30-T01.2 Prevent Editor pan/zoom from changing the owner's Viewers' presentation viewport.
- [ ] WB-S30-T01.3 Verify Editors continue receiving live participant presence independently of their viewport. Client policy tests now prove Presentation Editors can publish cursors but cannot publish the Owner viewport; actual multi-browser presence UI verification remains open with the WB-S22 gate.

### WB-S30-T02 - Permit Editor changes during presentation

- [x] WB-S30-T02.1 Permit authorized object edits to presentation Editors on the server.
- [x] WB-S30-T02.2 Sync Editor changes to the canonical shared board and other authorized participants.
- [x] WB-S30-T02.3 Keep Viewer presentation and role restrictions intact while Editors navigate elsewhere.

## Tasks for WB-S31 - Keep the session active when the owner disconnects

### WB-S31-T01 - Maintain session state during owner disconnect

- [x] WB-S31-T01.1 Keep the session Active and retain the owner identity/ownership during disconnect.
- [x] WB-S31-T01.2 Show an Owner disconnected status to Presentation participants.
- [x] WB-S31-T01.3 Allow Editors to continue authorized editing/syncing while the owner is away.

### WB-S31-T02 - Resume presentation after owner reconnect

- [x] WB-S31-T02.1 Keep Viewers on the last owner viewport while the realtime process remains available.
- [x] WB-S31-T02.2 Reauthenticate the owner and resume publishing their viewport after reconnect.
- [x] WB-S31-T02.3 Do not auto-end or transfer the session because of a disconnect.

## Tasks for WB-S32 - Manage participants during a live session

### WB-S32-T01 - Add owner session-management controls

- [x] WB-S32-T01.1 Show invite, participant list, role, connection state, and remove controls to the owner.
- [x] WB-S32-T01.2 Allow additional invitations during an active session using the mode-specific role rules.
- [x] WB-S32-T01.3 Allow only the owner to rename the session.

### WB-S32-T02 - Remove/revoke a participant

- [x] WB-S32-T02.1 Confirm the owner action where appropriate and record the membership revocation.
- [x] WB-S32-T02.2 Disconnect the removed member immediately and remove their presence.
- [x] WB-S32-T02.3 Require a new invitation for that person to rejoin.

## Tasks for WB-S33 - End a live session with or without an XML download

### WB-S33-T01 - Prepare and download the latest accepted board XML

- [x] WB-S33-T01.1 Add owner-only End Session dialog with Download XML and End, End without downloading, and Cancel choices.
- [x] WB-S33-T01.2 Export from a canonical accepted server revision, not an unconfirmed client-only state.
- [x] WB-S33-T01.3 If newer accepted edits occur during export preparation, detect and offer an up-to-date export before closure.

### WB-S33-T02 - Close only after the owner's end choice

- [x] WB-S33-T02.1 Close after successful download and owner confirmation.
- [x] WB-S33-T02.2 Close immediately when the owner explicitly chooses End without downloading.
- [x] WB-S33-T02.3 Keep the session Active when export is canceled or fails unless the owner chooses End without downloading.
- [x] WB-S33-T02.4 Notify/disconnect participants and trigger WB-S28 cleanup after closure.

## Tasks for WB-S34 - Demonstrate Whiteboard within the $0 budget

### WB-S34-T01 - Define local demo setup

- [x] WB-S34-T01.1 Document local app/server/database setup and required environment variables.
- [x] WB-S34-T01.2 Provide a local/demo email substitute if a usable free email service is unavailable.
- [ ] WB-S34-T01.3 Keep secrets out of source control and avoid paid dependencies/overages.
  - Security evidence (2026-10-19): API `.env` is ignored and untracked. `pnpm audit` high findings for `source-map-js`, `sharp`, and `@modelcontextprotocol/sdk` were resolved with lockfile overrides; `braces@3.0.3` remains high because no patched npm release is currently available. TruffleHog identified a verified credential in the local ignored API environment, which still requires owner-side rotation, and three likely false-positive eraser-code findings remain visible. Atlas billing/overage state is account-specific and unverified; do not mark this gate done.

### WB-S34-T02 - Define honest demo/deployment boundaries

- [x] WB-S34-T02.1 Document demo limits such as service restarts, quotas, backups, temporary data, and unresolved session retention in `.project/WHITEBOARD-DEMO-RUNBOOK.md`. Atlas cost/backup details remain account-specific and are explicitly unverified.
- [x] WB-S34-T02.2 Ensure the demo UI/status does not imply production availability or durable retention.
- [x] WB-S34-T02.3 Prepare a repeatable local senior-demo flow in `.project/WHITEBOARD-DEMO-RUNBOOK.md`. It distinguishes the local XML demo from the optional live flow; multi-browser rehearsal and Atlas cost confirmation remain open.

## Tasks for WB-S35 - Keep the editor maintainable for future changes

### WB-S35-T01 - Define Whiteboard-owned document and editor boundaries

- [x] WB-S35-T01.1 Define a canonical Whiteboard model that is distinct from editor-vendor storage records.
- [x] WB-S35-T01.2 V1 uses the Whiteboard-owned native canvas and canonical Board model; it has no editor-vendor record conversion to isolate. Add a conversion adapter if a different engine is selected.
- [x] WB-S35-T01.3 Keep template definitions as data in the canonical model.

### WB-S35-T02 - Preserve a safe change/migration path

- [x] WB-S35-T02.1 Add XML version identifiers from the first saved file version.
- [x] WB-S35-T02.2 V1 has no supported older XML schema; the importer explicitly rejects unsupported versions. Register a migration before adding support for any prior version.
- [x] WB-S35-T02.3 Keep Squid identity/navigation out of the core editor and document model.

## Tasks for WB-S36 - Integrate with Squid later through one interface (deferred)

> **Deferred:** Do not execute these tasks during standalone V1. Start only after separate approval to integrate Whiteboard with Squid.

### WB-S36-T01 - Inspect the live Squid integration boundary (deferred)

- [ ] WB-S36-T01.1 Inspect the then-current live Squid codebase and architecture rather than assuming this workspace's current backend is the production interface.
- [ ] WB-S36-T01.2 Identify Squid identity, workspace membership, navigation, permissions, deployment, and security boundaries.
- [ ] WB-S36-T01.3 Record integration constraints and get approval for the chosen interface before connecting systems.

### WB-S36-T02 - Implement one Squid host adapter (deferred)

- [ ] WB-S36-T02.1 Define the minimal host contract for user/workspace context, permissions, theme/locale, and return navigation.
- [ ] WB-S36-T02.2 Implement Squid-specific mapping only inside the host adapter.
- [ ] WB-S36-T02.3 Enforce membership and allowed actions server-side without duplicating Whiteboard behavior across Squid screens.

## Security and safety DoD

The ordinary DoD above is not sufficient by itself for a feature that accepts XML files, invitations, and long-lived realtime connections. For every task, apply the relevant controls below and record verification in that task's review notes. If a control is genuinely out of scope, record the reason; do not assume that hiding a button or trusting a library default provides security.

| Task scope | Security/safety acceptance checks before marking a task Done |
| --- | --- |
| **WB-S01 to WB-S13: standalone app and editor interactions** | Keep secrets and server credentials out of browser code and committed files. Treat board text and imported/template data as untrusted; render it as text rather than executable markup. Validate object values and impose reasonable bounds on text length, dimensions, and object counts so malformed input cannot freeze the editor. Confirm the app has no accidental dependency on Squid authentication or APIs. |
| **WB-S14 to WB-S16: XML save, import, and unsaved work** | Import XML as untrusted input. Reject DTD/DOCTYPE and external-entity processing, enforce file-size and structural limits, allow only the Whiteboard schema's known elements/attributes, validate IDs/references/numeric ranges before changing the open board, and show a safe error without leaking parser internals. Invalid input must not partially replace a board. XML text must remain inert when rendered. Verify a valid file round-trips and malformed/oversized/hostile files are rejected. |
| **WB-S17 to WB-S21: sessions, invitations, identity, and membership** | Only the session owner can create/manage/end their session. Invitation tokens must be unpredictable, stored server-side as hashes, single-use, bound to the intended session/email/role, and expire after 10 minutes. Verify invited email ownership before accepting; the email may carry an opaque, single-use invitation token, but never a reusable room credential; redact tokens from logs and referrers. Normalize and validate email/input; rate-limit invitation creation and acceptance. Enforce the six-member limit (owner plus five invitees) atomically; disconnect must not remove membership. Never trust a role, identity, or membership claim supplied by the browser. |
| **WB-S22 to WB-S26: realtime presence, permissions, edits, reconnect, shared history** | Authorize the connection and every edit/undo/redo against current server-side membership and role; deny by default. Viewers cannot mutate data, and their cursors remain hidden. Use WSS in deployed environments, validate WebSocket Origin against an explicit allowlist, re-check authorization on reconnect, and bound message size, message rate, and concurrent connections. Validate every message against the expected schema and board/session; reject stale/revoked/closed-session access. Do not accept client-assigned server sequence numbers. Log security events without logging board content, credentials, session cookies, or invite tokens. Verify allowed and denied cases, including Viewer writes, wrong-room access, expired/revoked invitations, unauthorized Origin, and reconnect after removal. |
| **WB-S27 to WB-S28: persistence, recovery, cleanup** | Keep Atlas credentials server-side, out of source control and logs; use a least-privilege database identity and encrypted transport. Validate persisted records before applying them to a live board. A failed or ambiguous write must not be reported as saved/accepted. Session closure must revoke access before cleanup; cleanup must be retryable, and the documented retention/recovery policy must state what is and is not removed (including any backups). Do not promise deletion from backups unless the storage configuration actually guarantees it. |
| **WB-S29 to WB-S33: presentation, participant management, session end** | Enforce Viewer/Editor/Owner capabilities on the server, not only by disabling UI controls. A Viewer cannot navigate away from the presenter view or edit; a presentation Editor can edit and navigate independently but cannot take owner-only actions. Removal and closure revoke room access immediately, including existing connections and later reconnects. XML export uses an authorized, validated server-accepted revision; download failure/cancel follows the owner's explicit choice and never silently closes the session. |
| **WB-S34 to WB-S35: demo and future maintainability** | Document public-demo limitations, data retention, free-tier limits, and recovery expectations honestly. Do not commit secrets or enable paid overages. Keep vendor/service credentials and security checks behind replaceable server-side boundaries; a future engine or host integration must not weaken the controls above. |
| **WB-S36: future Squid integration (deferred)** | Do not implement or connect it in standalone V1. When separately approved, repeat the security review against the then-current Squid identity, membership, authorization, and deployment boundaries before enabling any integration. |

These controls follow OWASP guidance to deny access by default and enforce least privilege ([Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)), validate WebSocket origins, authentication, message limits, and sensitive logging ([WebSocket Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)), and harden XML parsing against DTD/external-entity attacks ([XXE Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)).

## Cross-story implementation gates

These gates are referenced by the tasks above; they are not extra product stories.

1. **Editor gate:** In the first editor slice, verify text-in-shapes, required connector behavior, transparent-shape grid occlusion, keyboard access, and the XML adapter. No parallel comparison prototypes.
2. **Realtime gate:** Verify the chosen Yjs/Hocuspocus versions and design for authorization, server-accepted sequence, offline replay, global history, and durable writes before building full collaboration UX.
3. **Email gate:** Choose the email identity/delivery approach, session lifetime, rate limits, and error behavior before sending real invitations.
4. **$0 operations gate:** Confirm Atlas, realtime hosting, and email options fit $0. If not, keep the demo local or pause public access; do not turn on paid overages.
5. **Abandoned-session gate:** Decide recovery/retention if the owner can never return before exposing sessions publicly.

## Completion order

Follow the research roadmap rather than numeric story order where dependencies require it. The practical critical path is: WB-S01 to WB-S03 for the standalone shell and board/template defaults; WB-S14 to WB-S16 for the canonical model, XML, and unsaved-work handling; WB-S04 to WB-S13 for the single-user editor; WB-S17 to WB-S23 for session control, identity, seats, presence, and authorization; WB-S24 to WB-S28 for ordered edits, reconnect, shared history, persistence, and closure; WB-S29 to WB-S33 for presentation and owner controls; then WB-S34 to WB-S35 for demo readiness and maintainability. WB-S36 remains deferred until separate approval.
