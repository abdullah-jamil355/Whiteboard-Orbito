# Whiteboard XML project format

This document defines the app-owned local project format emitted by `apps/whiteboard/features/board/xml.ts`.
It is a versioned interchange contract for Whiteboard content, independent of editor-library record formats.

## Version 1

- The document is UTF-8 XML 1.0 with a `whiteboard` root element. New project downloads use the `.Whiteboard` filename extension; the extension identifies Whiteboard's own XML project and does not change the XML payload.
- `formatVersion` is the required integer schema version. Version 1 is the first supported version.
- Root `id` is the stable board identifier; `templateId` records the source template (`blank` for a new board).
- Built-in template IDs are `blank`, `organization-chart`, `entity-relationship`, `mind-map`, `kanban`, `flowchart`, `cross-functional-flowchart`, `workflow`, `data-flow`, `uml-sequence`, `uml-use-case`, and `uml-activity`. A template-based board stores its selected ID while receiving its own board and object IDs.
- `<title>` stores the board title.
- `<canvas>` stores `gridStyle` and `gridSpacing`.
- `<objects>` stores editable board objects in back-to-front drawing order. Each object has a stable `id`. Bring to Front and Send to Back reorder this list, and the V1 serializer preserves it exactly, so local XML save/open retains stacking.
- `<shape>` stores shape kind, geometry, fill, stroke, and line weight. `fill="none"` is an explicit no-fill style; the canvas paints a white interior mask so the graph-paper grid does not show through it.
- Rectangle, circle, and diamond objects are rendered and editable in the standalone canvas. New circles and circles resized in the editor keep equal width and height; rotation is not part of V1. Existing serialized shape geometry remains the canonical source and is not rewritten merely by opening a project.
- `<text>` stores editable text, geometry, alignment, font size, bold style, color, and optional `parentShapeId` binding. The `color` attribute is optional when reading older V1 files and defaults to Ink; new files write it explicitly. Text is rendered as inert text content and wraps within its bounded geometry. Shape-bound text geometry remains inset from the containing shape and follows it when moved or resized. Text formatting updates the text object without changing shape kind or shape style.
- `<stroke>` stores color, line weight, and ordered `<point>` coordinates in logical canvas units. A new board starts with a 1200 by 800 minimum canvas; the app fits the SVG viewBox to the available surface aspect ratio and expands the logical bounds to keep all board objects visible and usable. Pointer positions are mapped through the SVG screen transform into the same logical space. Imported strokes may contain up to 100,000 points. When erasing only part of a stroke, each surviving piece is stored as its own stroke object; the first piece keeps the original ID and additional pieces receive fresh stable IDs.
- `<line>` and `<arrow>` store color, line weight, and start/end coordinates. Either endpoint may also store `shapeId` and `connectionPoint`; these optional bindings let lines and arrows connect to shapes and follow their connection points when the shape moves or resizes. If the bound shape is erased, the endpoint keeps its last coordinates and becomes unbound. The SVG canvas renders arrows with an open chevron head derived from the stored endpoints; the head is not stored as separate geometry.
- `<connector>` stores color, line weight, start/end coordinates, and optional endpoint `shapeId` and `connectionPoint` bindings. Its right-angle route is derived from these endpoints. Shape hover handles can create a quick connector to the nearest shape in that direction or start a drag to another target; dragging from a connector/line/arrow tool onto a shape attaches that endpoint. A bound endpoint's coordinates are updated with its connection point when its shape moves or resizes; if the shape is erased, the endpoint keeps its last coordinates and becomes unbound. Connector bends are not editable in V1.
- Palette colors use six-digit hexadecimal form (`#RRGGBB`); `none` is allowed only for shape fill. The toolbar offers the fixed Whiteboard palette and does not include a custom color picker. Connector connection points are `top`, `right`, `bottom`, `left`, or `center`, and a bound endpoint includes both its shape ID and connection point. Unbound endpoints remain at their stored coordinates.
- Numeric values use JavaScript's deterministic decimal string representation; non-finite values are rejected. Negative zero is written as `0`.
- Text and attribute values escape XML metacharacters. Characters forbidden by XML 1.0 are rejected instead of producing malformed XML.
- Serialization preserves object order and emits a final newline, so the same canonical board produces the same XML text.
- Template definitions use Whiteboard-owned canonical objects. Creating a template board copies the source objects, generates fresh IDs, and remaps text/connector references so each board is independent of the immutable catalog entry.
- Copy, cut, paste, and duplicate operate on selected local objects. New copies receive fresh IDs; shape-bound text and connectors whose endpoint shapes are copied together have their references remapped. An endpoint whose referenced shape is not copied becomes an unbound endpoint at the correspondingly offset coordinates.

## Excluded data

Version 1 contains only durable board content. It excludes user identity, credentials, invitation tokens, presence, cursors, selection, viewport/camera state, local Undo/Redo history, and transient connection state. New transient or security-sensitive fields must not be added to the serializer.

## Compatibility policy

The app increments `formatVersion` when it changes the persisted schema incompatibly. The V1 reader accepts only explicitly supported versions. Each older version that remains supported must have a named, deterministic migration into the current canonical `Board` model before it can be opened. Unknown future versions and malformed XML are rejected without replacing the current board. The initial V1 writer does not claim support for opening files; parsing, validation, migration dispatch, and import UX belong to WB-S15.

## Local save and replacement lifecycle

- The workspace marks the current board dirty after edits and clean after an XML download is initiated or a validated XML project is opened.
- The default blank board download is named `Untitled Diagram.Whiteboard`. Renamed boards use their sanitized board title followed by `.Whiteboard`. The importer continues to accept legacy `.whiteboard.xml` files as XML projects.
- Replacing a dirty board, whether by opening a validated project or starting a new board, requires an explicit Save, Discard, or Cancel choice. Cancel preserves the current board and its dirty state. A failed XML download keeps the replacement prompt open and does not replace the current board.
- While the board is dirty, the app registers the browser `beforeunload` warning. Browsers control this native prompt and expose only their built-in stay/leave choices; the app cannot add a Save button to a tab-close or external-navigation prompt. Save from the Whiteboard toolbar before leaving when needed.
- If in-app navigation is introduced, its navigation action must use the same Save/Discard/Cancel guard before moving away from a dirty board.

## V1 import limits

The browser importer accepts UTF-8 project files up to 5 MiB. It rejects DTD/entity declarations and processing instructions, malformed XML, namespaces, unknown elements/attributes, and unsupported format versions. It allows at most 10,000 board objects, 100,000 points in one stroke, and 10,000 characters in one text object. Titles are limited to 120 characters; IDs are unique, use the documented ASCII identifier form, and are limited to 128 characters. Coordinates must be finite and within ±10,000,000; dimensions must be positive and at most 10,000,000; font sizes range from 6 to 256; grid spacing ranges from 4 to 200. Object references must resolve to shapes. Parsed data becomes a candidate `Board` only after every check succeeds. The importer has no side effects on the current board until that validation completes.
