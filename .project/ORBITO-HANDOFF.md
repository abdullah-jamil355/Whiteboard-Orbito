# Orbito (Whiteboard V1) — Complete Agent & Engineering Handoff

**Status:** Completed & Validated (V1 Release Ready)  
**Date:** October 2026  
**Document Purpose:** This is the authoritative, self-contained engineering handoff document for **Orbito**. It provides any incoming software engineer or AI agent with complete technical context, architecture principles, implementation details, recent bug fixes, security contracts, and operational verification procedures.

---

## 1. Executive Summary & Product Boundary

### 1.1 Product Identity
**Orbito** is a high-performance, real-time collaborative visual whiteboard application. It enables engineering teams, architects, and product designers to draw diagrams, flowcharts, system topologies, and freeform sketches with high precision, zero lag, and live multi-user collaboration.

### 1.2 Core Capabilities
1. **Infinite Vector Canvas:** Smooth panning, zooming (10% to 500%), grid background, and responsive coordinate transforms.
2. **Comprehensive Geometry Engine:** 22 vector shapes, freehand pen tool, eraser, text blocks, sticky notes, and advanced orthogonal/straight connectors.
3. **Smart Connectors (Draw.io Grade):** Intelligent path routing, waypoints, dynamic edge-snapping calculating exact non-rectangular borders (e.g., parallelograms, trapezoids, arrows).
4. **Real-time Live Collaboration:** Sub-50ms peer-to-peer sync via Yjs CRDTs and Hocuspocus WebSocket server with live presence cursors and server-authoritative role enforcement.
5. **Robust RBAC & Access Control:** Owner, Editor, and Viewer roles. Viewers are strictly read-only on the canvas while navigating viewports independently.
6. **Native XML Storage:** Project files stored as clean, structured, versioned XML documents (`.Whiteboard` / `.Orbito`), compatible with drawing vector standards.
7. **Passwordless Magic-Link Auth:** Cryptographically secure one-time tokens delivered via local dev mailbox or SMTP, paired with `HttpOnly` cookie session isolation.

### 1.3 Out-of-Scope / Non-Goals for V1
- Multi-page canvases (single large infinite canvas per board in V1).
- Freehand shape rotation (bounding-box resizing preserves geometric aspect/identity).
- Third-party cloud storage lock-in (local XML export/import is the primary project serialization).
- Multi-node Redis clustering for WebSockets (single-node Hocuspocus is verified for current scaling ceiling of 25 concurrent users per room).

---

## 2. Monorepo Architecture & Directory Structure

Orbito is built inside a modular monorepo governed by a custom zero-overhead control plane (`codebase/`).

```
nutshyll/
├── apps/
│   └── whiteboard/              # Next.js 14 Web Application (Port 3000)
│       ├── src/
│       │   ├── app/             # App Router (/board, /session, /auth, /mailbox)
│       │   ├── components/      # UI Modals, Share Dialogs, Session Banners
│       │   └── hooks/           # useCollaboration, useBoardPersistence
├── servers/
│   └── api/                     # Node.js / Express + Hocuspocus (Ports 4000 & 4001)
│       ├── src/
│       │   ├── auth/            # Magic link, HMAC signing, token verification
│       │   ├── session/         # Session persistence, invitation management
│       │   ├── realtime/        # Hocuspocus WebSocket room hooks & RBAC enforcement
│       │   └── db/              # MongoDB collections & ACID transaction helpers
│       └── tests/               # 64 automated integration & unit tests
├── packages/
│   ├── whiteboard/              # Pure Canvas & Drawing Engine (Framework Agnostic)
│   │   ├── src/
│   │   │   ├── board/           # Board state, shapes, connectors, waypoints
│   │   │   ├── canvas/          # SVG Rendering, hit-testing, zoom/pan
│   │   │   ├── xml/             # XML Parser & Serializer with schema validation
│   │   │   └── templates/       # 12 Built-in diagram templates
│   │   └── tests/               # 160 comprehensive unit tests
│   ├── ui/                      # Shared design system components (Button, Input, Dialog)
│   └── types/                   # Shared TypeScript contracts & DTOs
└── codebase/                    # Monorepo Orchestrator (repo.mjs - check, test, build)
```

### 2.1 Why `packages/whiteboard` vs `apps/whiteboard`?
- **`packages/whiteboard` (Core Engine):** Zero Next.js or server dependencies. Holds pure vector math, SVG renderers, XML schema definitions, and drawing state reducers. It can be embedded into any web app, desktop container (Electron/Tauri), or mobile WebView.
- **`apps/whiteboard` (Application Shell):** Owns routing, HTTP cookie storage, authentication flows, dialog windows, URL state, and WebSocket lifecycle management.

---

## 3. Canvas & Drawing Engine Deep-Dive

### 3.1 Vector Shape System (22 Supported Primitives)
Located in `packages/whiteboard/src/board/`:
- **Standard:** `rectangle`, `rounded-rectangle`, `circle`, `ellipse`, `diamond`.
- **Polygons:** `triangle`, `parallelogram`, `trapezoid`, `hexagon`, `octagon`, `star`.
- **Directional Arrows:** `right-arrow`, `left-arrow`, `up-arrow`, `down-arrow`, `double-arrow`, `left-right-arrow`.
- **Diagramming Specialized:** `cylinder`, `database`, `cloud`, `speech-bubble`, `actor` (UML stick figure).

### 3.2 Connector Routing & Dynamic Snapping Engine
Orbito supports two connector styles:
1. **Orthogonal:** Draw.io style right-angle bends with automated waypoint generation (`routeConnectorWaypoints`).
2. **Straight:** Direct line between two points with optional intermediate bends.

#### Dynamic Slanted Border Snapping (Critical Fix Implemented)
Traditional whiteboard libraries snap connectors only to the rectangular bounding box (`x + width`, `centerY`). For slanted shapes (like parallelograms, trapezoids, or triangular arrowheads), this causes an unsightly physical gap between the arrow and the shape's visible boundary.

Orbito implements exact border calculation inside [`shapeConnectionCoordinate`](file:///d:/Codatory/WhiteBoard/nutshyll/packages/whiteboard/src/board/board.ts):
- **Parallelogram:** At the right edge, the connector attaches precisely to `x + width * 0.89` instead of `x + width`.
- **Trapezoid:** Right edge attaches to `x + width * 0.82`.
- **Triangles & Arrows:** Right/left extremities compute exact slope intersections so connectors anchor seamlessly to the rendered stroke.
- **Dynamic Live Resolution:** In [`CanvasObjectRenderer`](file:///d:/Codatory/WhiteBoard/nutshyll/packages/whiteboard/src/board/components/canvas-object-renderer.tsx), `resolveAttachedEndpoint()` recalculates endpoints in real-time as connected shapes are moved or resized.

### 3.3 Robust SVG Line & Arrowhead Graphics
Located in [`CanvasLineGraphic`](file:///d:/Codatory/WhiteBoard/nutshyll/packages/whiteboard/src/board/components/canvas-line-graphic.tsx):
- **Line Rendering:** Uses SVG `<polyline points={...} />`. Avoids path string formatting anomalies and guarantees zero rendering drops across all WebKit, Blink, and Gecko engines.
- **Arrowhead Alignment (`findAdjacent`):** Inspects the polyline backward from the tip to find the preceding point that is at least `> 0.5px` distant, ensuring stable vector angles even when duplicate or micro-distance waypoints exist.
- **Hit Testing:** Renders an invisible `<polyline stroke="transparent" strokeWidth={20} />` behind the visible line, allowing effortless selection and dragging of fine 1px strokes.

---

## 4. Real-time Collaboration & Concurrency Architecture

### 4.1 Technology Choice: Yjs + Hocuspocus
```
[ Browser A (Client) ] <----\ 
                            |   (WebSocket: Port 4001)
[ Browser B (Client) ] <----+===> [ Hocuspocus Server (servers/api) ]
                            |                   |
[ Browser C (Viewer) ] <----/                   v (Atomic Writes)
                                        [ MongoDB Atlas / Local ]
```

- **Conflict-Free Replicated Data Types (CRDTs):** Yjs ensures eventual consistency without lock contention. Simultaneous moves or edits merge deterministically.
- **Hocuspocus Server:** Fast, extensible Node.js WebSocket backend built specifically for Yjs rooms.
- **Room Lifecycle Hooks:**
  1. `onAuthenticate`: Validates session cookie or invitation token, establishes member role (`Owner`, `Editor`, `Viewer`).
  2. `onLoadDocument`: Loads initial binary Yjs update from MongoDB `whiteboard_sessions`.
  3. `onChange`: Debounces and streams state snapshots to database.
  4. `onDisconnect`: Cleans up active presence state.

### 4.2 Strict RBAC Server Enforcement
1. **Viewer Role:**
   - In WebSocket `onChange` / `beforeBroadcast`, edits sent by users tagged with `Viewer` are rejected.
   - Client-side canvas disables tool selection, moving, or resizing, while leaving zoom and pan fully independent for the viewer.
2. **Editor & Owner Roles:**
   - Full read/write access.
   - Live presence broadcasting (colored cursor with initials/name badge).
3. **Session Ceilings:**
   - Maximum 25 concurrent participants per session.
   - Single-use 10-minute expiry invitations.

---

## 5. Security & Authentication Architecture

### 5.1 Passwordless Magic Links
1. User enters their email address on the login screen.
2. Server generates a cryptographically random 32-byte hex token (`crypto.randomBytes(32)`).
3. The SHA-256 hash of the token is saved in MongoDB with an expiration timestamp (15 minutes).
4. The plaintext token is emailed via Magic Link (`http://localhost:3000/auth/verify?token=...`).
5. Upon consumption, the token is marked invalid (single-use) and a signed, secure session cookie is issued.

### 5.2 XSS & CSRF Defense Model
- **`HttpOnly` Cookies:** Auth and session tokens cannot be read via `document.cookie`, neutralizing token theft via Cross-Site Scripting (XSS).
- **`SameSite=Lax`:** Prevents cross-site request forgery attacks on state-changing API endpoints.
- **Local Dev Mailbox (`/api/mailbox`):** In local development, emails are captured into an in-memory mailbox inspected via a dedicated UI, eliminating dependencies on external SMTP credentials.

---

## 6. Native XML Project Specification (`.Whiteboard` / `.Orbito`)

Diagrams are serialized to standard XML to guarantee human readability, structural schema validation, and vector hierarchy matching SVG and Draw.io formats.

### Schema Outline
```xml
<?xml version="1.0" encoding="UTF-8"?>
<whiteboard version="1.0">
  <metadata>
    <id>session-unique-id</id>
    <title>Architecture Diagram</title>
    <createdAt>2026-10-23T12:00:00.000Z</createdAt>
    <updatedAt>2026-10-23T12:05:00.000Z</updatedAt>
  </metadata>
  <viewport zoom="1" scrollX="0" scrollY="0" grid="true" />
  <objects>
    <shape id="shape-1" kind="parallelogram" x="120" y="80" width="160" height="90">
      <style fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" opacity="1" />
      <text align="center" fontSize="14" bold="false">Input Data</text>
    </shape>
    <connector id="conn-1" kind="orthogonal" startShapeId="shape-1" startSide="right" endShapeId="shape-2" endSide="left">
      <style stroke="#334155" strokeWidth="2" strokeStyle="solid" startArrow="none" endArrow="triangle" />
      <waypoints>
        <point x="280" y="125" />
        <point x="340" y="125" />
        <point x="340" y="240" />
        <point x="400" y="240" />
      </waypoints>
    </connector>
  </objects>
</whiteboard>
```

### Parser Security Constraints
- **XXE Prevention:** External entities (`<!ENTITY ...>`) and DTD references are disallowed and stripped.
- **Boundary Checks:** Coordinates, widths, heights, and zoom values are bounded to safe numerical ranges to prevent memory denial-of-service.

---

## 7. Key Bug Fixes & Architectural Lessons Learned

| Bug / Problem | Root Cause | Solution Implemented |
|---|---|---|
| **Invisible Connector Lines** | SVG `<path d={strokePointsAttribute(points)} />` was outputting `"x,y x,y"` without SVG `M` (MoveTo) and `L` (LineTo) path commands. | Migrated line rendering to `<polyline points="..." />` in `CanvasLineGraphic` and hit-targets. |
| **Arrowhead Misalignment** | Reverse-point lookup for arrowhead angle took the immediate neighbor, which in rare sub-pixel events was identical to the tip (`dist == 0`), producing `NaN` rotation. | Introduced `findAdjacent(pts, index, reverse)` requiring Euclidean distance `> 0.5px`. |
| **Connector Gap on Slanted Shapes** | `shapeConnectionCoordinate` returned outer rectangular box points (`x + width`), leaving visible air gaps on parallelograms, trapezoids, and arrows. | Implemented perimeter slope math for 9 non-rectangular shapes and dynamic border recalculation in `CanvasObjectRenderer`. |
| **Selection Box Disconnect** | Selection outlines calculated static endpoints while shapes were moved, causing a disjointed box until drop. | Integrated `resolveAttachedEndpoint` into `CanvasSelection` and overlay renderers. |
| **Concurrent Edit Collisions** | Simultaneous edits in the same session raced against MongoDB sequence numbers, rejecting valid edits with `action_conflict`. | Implemented per-session serialized execution queue (`enqueueSession`) in `realtime.server.ts` to ensure deterministic ordering. |
| **MongoDB Transaction Conflict (Code 117)** | Interleaving parallel operations (`Promise.all`) on a single MongoDB `ClientSession` triggered `ConflictingOperationInProgress`. | Structured all transaction queries in `sessions.repository.ts` sequentially within each unit-of-work. |
| **Peer Awareness State Dropping** | Multi-client presence sync bundled multiple client awareness states, which exceeded `maximumAwarenessClientStatesPerUpdate = 1` and got dropped. | Raised limit to `30` in `realtime.server.ts` while enforcing strict server-side cursor sanitization. |
| **Team Invitation Rate Limiting** | Owners inviting large teams were throttled by conservative per-IP and per-identity invitation defaults. | Expanded `magicLinkMaxPerIp` to 60 and invitation reservation limits to 30 to support full 25-member rooms. |
| **Jerky Remote Cursors** | Cursor throttle was set to 100ms with no position interpolation, causing stepped movement. | Reduced throttle to 33ms (~30fps), increased server rate ceiling to 2,400, and added SVG `transform 0.04s linear` transition. |
| **UI Stutter on Inbound Edits** | Receiving remote edits triggered synchronous full XML serialization (`serializeBoardXml`) on the main thread for dirty checking. | Debounced dirty check by 400ms, keeping the 60fps rendering pipeline non-blocking. |

---

## 8. Verification & Operational Runbook

### 8.1 Starting the Development Environment
Run all services simultaneously via the repository control plane:
```powershell
# From repository root
pnpm run dev
```
Or start individual workspace units in separate shells:
```powershell
# Terminal 1: Next.js Frontend (Port 3000)
pnpm --filter @whiteboard/web run dev

# Terminal 2: API & Hocuspocus WebSocket Server (Ports 4000 & 4001)
pnpm --filter @whiteboard/api run dev
```

### 8.2 Automated Test Execution
Run the complete test suite across all packages:
```powershell
# Run all unit and integration tests (160 whiteboard + 64 API + 11 App tests)
pnpm test

# Run strict TypeScript typecheck across monorepo
pnpm run typecheck

# Run repository health and boundary check
pnpm run check
```

### 8.3 Realtime Collaboration & Concurrency Benchmarks
Comprehensive verification scripts for live multi-user editing and stress testing:
```powershell
# 1. Dual-user live collaboration and race-condition simulator
node apps/whiteboard/scripts/test-live-collaboration.mjs

# 2. Official bi-directional WebSocket integration test
pnpm.cmd --filter @workspace/whiteboard-app run test:realtime

# 3. Heavy Multi-User Stress Benchmark (11 simultaneous users, 33 concurrent writes, 100% convergence)
node apps/whiteboard/scripts/stress-test-collaboration.mjs
```
> For complete benchmark methodology, charts, and sequence diagrams, refer to [`.project/WHITEBOARD-LIVE-COLLABORATION-TEST-REPORT.md`](file:///d:/Codatory/WhiteBoard/nutshyll/.project/WHITEBOARD-LIVE-COLLABORATION-TEST-REPORT.md).

### 8.3 Environment Variables Reference
- **`apps/whiteboard/.env`**:
  ```env
  NEXT_PUBLIC_API_URL=http://localhost:4000
  NEXT_PUBLIC_WS_URL=ws://localhost:4001
  ```
- **`servers/api/.env`**:
  ```env
  PORT=4000
  WS_PORT=4001
  MONGODB_URI=mongodb://localhost:27017/whiteboard
  COOKIE_SECRET=change-this-in-production-to-a-strong-random-secret
  NODE_ENV=development
  ```

---

## 9. Next Developer / Agent Checklist

When picking up this codebase for new features or maintenance:
- [ ] Read this handoff and `architecture.yaml`.
- [ ] Verify that `pnpm test` passes cleanly (160 whiteboard tests, 64 API tests).
- [ ] Maintain the strict boundary between pure graphics logic in `packages/whiteboard` and web app logic in `apps/whiteboard`.
- [ ] When adding new geometric shapes, register their border snapping logic in `shapeConnectionCoordinate` in `packages/whiteboard/src/board/board.ts`.
- [ ] Always validate any newly introduced asynchronous path and run `pnpm run check` before submitting changes.
