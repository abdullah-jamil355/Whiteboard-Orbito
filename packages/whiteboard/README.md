# Whiteboard component library

`@workspace/whiteboard` is the reusable Whiteboard editor package. It exports the
board model and operations, XML import/export, built-in templates, session model,
and controlled React components from its public package entry point. The host app
owns its workspace state, action hooks, keyboard/file integration, and page composition.

## Use in a workspace app

Add `@workspace/whiteboard` as a `workspace:*` dependency, then import a component,
its public prop contract, and stylesheet through the package exports:

```tsx
import { WhiteboardCanvas, type WhiteboardCanvasProps } from "@workspace/whiteboard";
import "@workspace/whiteboard/styles.css";

export const BoardCanvas = (props: WhiteboardCanvasProps) => <WhiteboardCanvas {...props} />;
```

The host app supplies board state and callbacks through the component contracts,
and owns its page, theme tokens, and product-specific routing. The package owns
reusable editor components, board model, editing operations, XML boundary, templates,
and component styles. Generic controls continue to come from `@workspace/ui`.
The styles use host-provided CSS theme tokens; the standalone app provides light and
dark token sets while preserving the drawing surface colors across appearance changes.
The embedding host owns workspace branding and shell styling; reusable board components
consume the host's theme tokens.
The app-owned workspace sidebar uses these styles as a narrow icon rail on desktop and
expands over the workspace on hover or keyboard focus; mobile navigation stays labeled.

`WhiteboardCanvas` provides an unbounded coordinate workspace with fixed top and left
rulers. Camera pan and zoom are local view state; opening a different board starts at
100% zoom centered on the board's initial coordinate area. Desktop users hold Space
while dragging an empty canvas to pan; touch users drag empty canvas space. Objects may
be created and moved at positive or negative world coordinates without canvas-edge clamps.

In this app, `features/board` composes the package components with local state and
actions. Its file handling uses browser APIs for explicit XML downloads and imports;
it does not imply cloud persistence or server authorization.

## Board and session contract

`createBoard(id)` creates a blank graph-paper canvas titled `Untitled`. Board state
stays in the browser until the host saves it. `session.ts` owns the local session
model: it snapshots the current canonical board, fixes its mode at creation, starts
in Active status, and permits owner-checked rename operations. This is only
in-browser demo state; it is not shared between clients, is not server authorization,
and is lost on reload. Invitations, participant access, and realtime claims require
host-side identity and authorization.

## Local runbook

From the repository root run `node codebase/cli/repo.mjs run whiteboard:dev`, then
open the printed Next.js URL (normally `http://localhost:3000`). No database,
environment file, Squid service, or authenticated session is required. Focused
static checks are `node codebase/cli/repo.mjs run whiteboard-library:typecheck` and
`node codebase/cli/repo.mjs run whiteboard-library:lint`.
