# Whiteboard V1 Technical Brief

**Status:** Draft for requirements review; Tech Lead read-back and decision pending  
**Source:** `.project/WHITEBOARD-HANDOFF.md` (reviewed 15 October 2026; current-session policy dated 20 October 2026). The workflow input `docs/client-brief.md` was not present, so this is a provisional restatement from the repository's self-contained handoff, not a verified client brief.

## Ask and capabilities

Build a standalone Whiteboard V1 for a bounded senior demo. Users create and edit a single large visual board, save/open it as Whiteboard XML, and optionally collaborate in a live session. The product must work locally, remain independent of Squid identity and backend flows, and respect the approved $0 cost ceiling. This is a demo goal, not a production-readiness commitment.

| Capability (verb + input → output) | Stated behavior |
| --- | --- |
| Create a board from a blank start or built-in template → editable single-canvas board | Blank board starts as `Untitled`; template copy is editable and does not mutate its source. Twelve built-in entries are named in the handoff. |
| Draw and edit board content from pointer/keyboard actions → updated board objects | Pen, eraser, shapes, lines/arrows/connectors, text, selection, move/resize/delete, copy/paste/duplicate, z-order, pan/zoom and keyboard access. Fixed palette and three line weights. |
| Save a board → local Whiteboard XML file | Explicit save; no automatic cloud save for normal boards. XML carries version/schema, title, canvas settings, template provenance and supported object data. |
| Open a board from a local Whiteboard XML file → validated board or actionable rejection | Only the Whiteboard format is supported. Invalid/unsupported content must not replace the current board; warn about unsaved work and offer save/discard/cancel. |
| Start or manage a live session from an owner action and invitations → session, participant state, and shared board updates | Live Collaboration is the only session mode. Owner assigns Editor or Viewer to each invite; owner and Editors edit; Viewers are read-only for board content but navigate their own canvas. Owner may invite, cancel pending invites, remove participants, and explicitly end session. |
| Deliver/accept an invitation from an intended email recipient → verified session membership or rejection | Invitation is private, single-use, expires after 10 minutes, and is bound to intended session, email, and role. No public join link. |
| Recover a session after disconnect/restart → restored shared session state, subject to unresolved retention/provider limits | Reconnect and persistence/recovery are desired V1 behavior; exact durability and operational guarantees are not approved. |

## Inputs, outputs, and scale

| Flow | Input format | Output format | Volume/limit stated |
| --- | --- | --- | --- |
| Local board editing | Pointer and keyboard events; board objects/styles | In-memory board and visible canvas | One canvas. Exact object, geometry, text, and interaction limits are unmeasured. |
| Local open/save | Whiteboard-owned versioned XML file | XML file on save; validated board or rejection on open | File size, object count/complexity and text bounds are open; must be measured/set. |
| Live invitation | Owner-entered email plus selected Editor/Viewer role | Email containing opaque single-use invite token; invitation state | Maximum 25 members including owner (up to 24 invitees); invite rate is unmeasured. |
| Live collaboration | Authenticated board edits and session messages | Shared board state, presence and participant updates | Message size/rate, active rooms, snapshot size and reconnect load are unmeasured. |
| Session persistence/recovery | Session board state and membership metadata | Restored session state, or surfaced failure | Retention, backup behavior, record/snapshot size and provider capacity unresolved. |

XML must be treated as untrusted data: known schema only, no DTD/external entities or executable markup, validate IDs/references/enums/numeric ranges, enforce bounds, and replace the open board atomically only after successful validation. The XML excludes presence, cursors, ephemeral selection, secrets, invitation tokens and transient connection state.

## Constraints and exclusions

- Cost ceiling: $0; no paid services or overages. Begin locally; do not claim production suitability.
- Preferred technical direction (Excalidraw React adapter, Yjs, Hocuspocus, MongoDB Atlas) is a recommendation requiring fit checks, not an approved implementation contract.
- No Squid entry points, identity, workspace context, or backend integration in standalone V1.
- No separate Presentation mode, public join links, automatic cloud save for normal boards, multiple canvas pages, image uploads, user template uploads, or draw.io import/export.
- Provider, deployment, security approval, retention, protocol, exact limits and public-release readiness remain unresolved.

## Decision brief for Tech Lead

**Read-back:** The product ask and confirmed user-facing behavior can be restated from the repository handoff, but the workflow's written client input is absent. The measurable technical envelope and several release-affecting policies are still open. This draft therefore cannot establish that the client brief was received or that every requirement is understood.

**Decision requested at checkpoint `d1`:** Is the repository handoff an acceptable provisional source for this workflow, and is the brief understood well enough to proceed to question ownership? Choose yes, request gaps/restate (return to s1), or identify a hard-limit conflict requiring client authority. No decision is made by this draft.

**Tech Lead read-back checklist:** Confirm the standalone demo ask, $0 ceiling, local XML flow, live collaboration roles and invitation rules, 25-member maximum, and the unresolved technical/release limits above.
