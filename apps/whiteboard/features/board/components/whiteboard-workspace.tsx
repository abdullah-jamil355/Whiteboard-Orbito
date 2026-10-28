"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { Button } from "@workspace/ui/primitives/button";
import { applyBoardHistorySnapshot, createBoard, createBoardHistoryEdit, isShapeTool, renameBoard, serializeBoardXml, STICKY_NOTE_COLORS, STICKY_NOTE_HEIGHT, STICKY_NOTE_SQUARE_SIZE, STICKY_NOTE_WIDTH, WHITEBOARD_PALETTE, WorkspaceCanvasStage, WorkspaceDialogs, WorkspaceFeedback, WorkspaceToolbar, type ArrowHead, type Board, type BoardHistoryEdit, type BoardSession, type ConnectorRouting, type LineWeight, type ShapeObject, type StickyNoteShape, type WhiteboardTool } from "@workspace/whiteboard";
import { useWorkspaceObjectActions } from "../use-workspace-object-actions";
import { useWorkspaceSessionActions } from "../use-workspace-session-actions";
import { useWorkspaceKeyboardActions } from "../use-workspace-keyboard-actions";
import { useWorkspaceFileActions } from "../use-workspace-file-actions";
import { useWorkspaceRealtime } from "../use-workspace-realtime";
import { downloadBoardXml } from "../board-xml-download";
import { disconnectGoogleMail, getGoogleMailStatus, startGoogleMailConnect, signOut, type GoogleMailStatus, type VerifiedIdentity } from "../api-client";
import { WorkspaceAuthDialog } from "./workspace-auth-dialog";
import { WorkspaceAvailableSessions } from "./workspace-available-sessions";
import { WorkspaceInvitations } from "./workspace-invitations";
import { WorkspacePresence } from "./workspace-presence";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceSessionEndedDialog } from "./workspace-session-ended-dialog";
import { useWorkspaceMemberSessions } from "../use-workspace-member-sessions";
import { createWhiteboardId } from "../create-whiteboard-id";

type BoardHistory = Readonly<{
  past: readonly BoardHistoryEdit[];
  future: readonly BoardHistoryEdit[];
}>;

const getGoogleMailCallbackFeedback = (): string | null => {
  if (typeof window === "undefined") return null;
  const result = new URLSearchParams(window.location.search).get("google-mail");
  if (result === "connected") return "Gmail connected. Session invitations will be sent from your Whiteboard email address.";
  if (result === "account-mismatch") return "Connect the same Gmail address you used to sign in to Whiteboard.";
  return result === null ? null : "Gmail could not be connected. Check the Google consent and API settings, then try again.";
};

const WhiteboardWorkspace = (): ReactElement => {
  const [board, setBoard] = useState<Board>(() => createBoard(createWhiteboardId()));
  const [isDirty, setIsDirty] = useState(true);
  const [localSource, setLocalSource] = useState<"new" | "downloaded" | "opened" | "template" | "session">("new");
  const [saveFailed, setSaveFailed] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingReplacement, setPendingReplacement] = useState<Readonly<{ board: Board; source: "new" | "opened" | "template" }> | null>(null);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<BoardSession | null>(null);
  const [currentOwnerId, setCurrentOwnerId] = useState<string | null>(null);
  const [identity, setIdentity] = useState<VerifiedIdentity | null>(null);
  const [googleMailState, setGoogleMailState] = useState<Readonly<{ identityId: string; status: GoogleMailStatus | null }> | null>(null);
  const googleMail = identity !== null && googleMailState?.identityId === identity.id ? googleMailState.status : null;
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState<string | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [endExportSequence, setEndExportSequence] = useState<number | null>(null);
  const [sessionDialog, setSessionDialog] = useState<"start" | "rename" | "end" | null>(null);
  const [sessionTitleDraft, setSessionTitleDraft] = useState("Untitled");
  const [fileFeedback, setFileFeedback] = useState<Readonly<{ kind: "error" | "success"; message: string }> | null>(null);
  const [selectedTool, setSelectedTool] = useState<WhiteboardTool>("select");
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<readonly string[]>([]);
  const [clipboardObjects, setClipboardObjects] = useState<readonly Board["objects"][number][]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [penColor, setPenColor] = useState<string>(WHITEBOARD_PALETTE[0].value);
  const [penLineWeight, setPenLineWeight] = useState<LineWeight>("thin");
  const [shapeStrokeColor, setShapeStrokeColor] = useState<string>(WHITEBOARD_PALETTE[0].value);
  const [shapeLineWeight, setShapeLineWeight] = useState<LineWeight>("thin");
  const [shapeFill, setShapeFill] = useState<string | "none">("none");
  const [stickyNoteFill, setStickyNoteFill] = useState<string>(STICKY_NOTE_COLORS[0].fill);
  const [stickyNoteShape, setStickyNoteShape] = useState<StickyNoteShape>("rectangle");
  const [lineColor, setLineColor] = useState<string>(WHITEBOARD_PALETTE[0].value);
  const [lineLineWeight, setLineLineWeight] = useState<LineWeight>("thin");
  const [connectorRouting, setConnectorRouting] = useState<ConnectorRouting>("orthogonal");
  const [lineStartArrow, setLineStartArrow] = useState<ArrowHead>("none");
  const [lineEndArrow, setLineEndArrow] = useState<ArrowHead>("none");
  const [boardHistory, setBoardHistory] = useState<BoardHistory>({ past: [], future: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedDocumentXmlRef = useRef<string | null>(null);
  const dirtyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (dirtyTimerRef.current !== null) clearTimeout(dirtyTimerRef.current);
  }, []);
  const hasUnsavedCanvasContent = isDirty && board.objects.length > 0;
  const [realtimeFeedback, setRealtimeFeedback] = useState<string | null>(null);
  const resetBoardHistory = useCallback((): void => setBoardHistory({ past: [], future: [] }), []);
  useEffect(() => {
    if (identity === null) return;
    let isCurrent = true;
    void getGoogleMailStatus().then((status) => { if (isCurrent) setGoogleMailState({ identityId: identity.id, status }); })
      .catch(() => { if (isCurrent) setGoogleMailState({ identityId: identity.id, status: null }); });
    return () => { isCurrent = false; };
  }, [identity]);
  useEffect(() => {
    const callbackFeedback = getGoogleMailCallbackFeedback();
    // This consumes one-shot OAuth redirect state after hydration to avoid a server/client markup mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (callbackFeedback !== null) setSessionFeedback(callbackFeedback);
    if (new URLSearchParams(window.location.search).has("google-mail")) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const sessionActions = useWorkspaceSessionActions({
    board, isImporting, sessionBusy, activeSession, currentOwnerId, identity, sessionTitleDraft,
    savedDocumentXmlRef, setIsDirty, setLocalSource,
    setSessionTitleDraft, setActiveSession, setCurrentOwnerId, setAuthDialogOpen,
    setSessionFeedback, setSessionBusy, setSessionDialog, resetBoardHistory, downloadBoardXml, endExportSequence, setEndExportSequence
  });
  const { canManageSession, endSession, openEndSession, openStartSession, saveSessionRename, sessionEndedDialogOpen, setSessionEndedDialogOpen, startSession } = sessionActions;
  const realtime = useWorkspaceRealtime({
    sessionId: activeSession?.id ?? null,
    onSessionEnded: sessionActions.handleRemoteSessionEnd,
    onBoardState: (nextBoard) => {
      setBoard(nextBoard);
      if (savedDocumentXmlRef.current === null) {
        setIsDirty(true);
      } else {
        if (dirtyTimerRef.current !== null) clearTimeout(dirtyTimerRef.current);
        dirtyTimerRef.current = setTimeout(() => {
          try { setIsDirty(serializeBoardXml(nextBoard) !== savedDocumentXmlRef.current); }
          catch { setIsDirty(true); }
        }, 400);
      }

    },
    onFeedback: setRealtimeFeedback
  });
  const queueBoardEdit = realtime.queueBoardEdit;
  const undoShared = realtime.undoShared;
  const redoShared = realtime.redoShared;
  const isReadOnlyViewer = activeSession !== null && realtime.role === "viewer";
  const applyBoardEdit = useCallback((nextBoard: Board, recordHistory = true): void => {
    if (activeSession !== null && !queueBoardEdit(board, nextBoard)) return;
    if (recordHistory && activeSession === null) {
      const edit = createBoardHistoryEdit(board, nextBoard);
      if (edit !== null) {
        setBoardHistory((current) => ({ past: [...current.past, edit], future: [] }));
      }
    }
    setBoard(nextBoard);
    try {
      setIsDirty(savedDocumentXmlRef.current === null || serializeBoardXml(nextBoard) !== savedDocumentXmlRef.current);
    } catch {
      setIsDirty(true);
    }
    setSaveFailed(false);
  }, [activeSession, board, queueBoardEdit]);

  const replaceBoard = useCallback((nextBoard: Board, source: "new" | "opened" | "template" | "session"): void => {
    setBoard(nextBoard);
    savedDocumentXmlRef.current = source === "opened" || source === "session" ? serializeBoardXml(nextBoard) : null;
    setIsDirty(source !== "opened" && source !== "session");
    setLocalSource(source);
    setSaveFailed(false);
    setFileFeedback(source === "opened" ? { kind: "success", message: "Orbito project opened." } : source === "session" ? { kind: "success", message: "Server session board restored; edits sync through the Orbito server." } : null);
    setPendingReplacement(null);
    setBoardHistory({ past: [], future: [] });
    setSelectedShapeId(null);
    setSelectedTextId(null);
    setSelectedObjectIds([]);
    setEditingTextId(null);
  }, []);

  const { availableSessions, rejoinSession, dismissAvailableSessions } = useWorkspaceMemberSessions({
    activeSession, hasUnsavedCanvasContent, sessionBusy, replaceBoard, setActiveSession,
    setCurrentOwnerId, setIdentity, setSessionBusy, setSessionFeedback
  });

  const updateTitle = (title: string): void => {
    applyBoardEdit(renameBoard(board, title));
  };

  const fileActions = useWorkspaceFileActions({
    board, savedDocumentXmlRef, activeSession, dirtyContent: hasUnsavedCanvasContent, pendingReplacement, replaceBoard,
    setPendingReplacement, setFileFeedback, setIsImporting, setIsTemplatePickerOpen, setIsDirty,
    setLocalSource, setSaveFailed
  });
  const { handlePendingDiscard, handlePendingSave, openBoardFile, requestNewBoard, requestTemplateBoard, saveBoard } = fileActions;

  const objectActions = useWorkspaceObjectActions({
    board, applyBoardEdit, selectedObjectIds, setSelectedObjectIds, setSelectedShapeId, setSelectedTextId,
    setEditingTextId, selectedShapeId, selectedTextId, selectedTool, setSelectedTool, clipboardObjects,
    setClipboardObjects, setShapeStrokeColor, setShapeLineWeight, setShapeFill,
    stickyNoteOptions: { fill: stickyNoteFill, shape: stickyNoteShape }
  });
  const {
    activateEraserTool, activateTextTool, beginTextEditing, chooseShapeFill,
    chooseShapeLineWeight, chooseShapeStroke, commitErase, commitLine, commitShape, commitStroke,
    copySelected, createStickyNote, createText, deleteSelected, duplicateSelected, handleShapeSelect, handleTextSelect,
    moveObjects, pasteObjects, resizeObject, selectObjects, selectedShape, selectedText,
    updateShapeGeometry, updateText, updateTextGeometry, updateWaypoints
  } = objectActions;

  const shapeToolSelected = isShapeTool(selectedTool);
  const isLineTool = selectedTool === "line" || selectedTool === "arrow" || selectedTool === "connector" || selectedTool === "connection" || selectedTool === "waypoints";
  const showShapeStyle = (selectedTool === "select" && selectedShape !== null && selectedShape.stickyNote !== true) || shapeToolSelected;
  const currentShapeFill = selectedTool === "select" && selectedShape !== null ? selectedShape.style.fill : shapeFill;
  const currentShapeStroke = selectedTool === "select" && selectedShape !== null ? selectedShape.style.stroke : shapeStrokeColor;
  const currentShapeWeight = selectedTool === "select" && selectedShape !== null ? selectedShape.style.lineWeight : shapeLineWeight;
  const selectedStickyNoteShape = selectedShape?.stickyNote === true
    ? selectedShape
    : selectedText?.parentShapeId === undefined ? null : board.objects.find((object): object is ShapeObject => object.type === "shape" && object.id === selectedText.parentShapeId && object.stickyNote === true) ?? null;
  const selectedStickyNoteText = selectedStickyNoteShape === null ? null : board.objects.find((object) => object.type === "text" && object.parentShapeId === selectedStickyNoteShape.id) ?? null;
  const selectedStickyNote = selectedStickyNoteShape !== null && selectedStickyNoteText?.type === "text"
    ? { shape: selectedStickyNoteShape, text: selectedStickyNoteText }
    : null;
  const selectedToolbarText = selectedStickyNote === null ? selectedText : null;
  const updateStickyNoteFill = (shapeId: string, fill: string): void => {
    const paletteColor = STICKY_NOTE_COLORS.find((color) => color.fill === fill);
    if (paletteColor !== undefined) objectActions.updateShapeStyle(shapeId, { fill, stroke: paletteColor.stroke });
  };
  const updateStickyNoteShape = (shape: ShapeObject, kind: StickyNoteShape): void => {
    const size = kind === "square" ? STICKY_NOTE_SQUARE_SIZE : { width: STICKY_NOTE_WIDTH, height: STICKY_NOTE_HEIGHT };
    const width = typeof size === "number" ? size : size.width;
    const height = typeof size === "number" ? size : size.height;
    const centerX = shape.geometry.x + shape.geometry.width / 2;
    const centerY = shape.geometry.y + shape.geometry.height / 2;
    objectActions.updateShapeGeometry(shape.id, { x: centerX - width / 2, y: centerY - height / 2, width, height });
  };

  const undoEdit = useCallback((): void => {
    if (activeSession !== null) { undoShared(); return; }
    const action = boardHistory.past.at(-1);
    if (action === undefined) return;
    applyBoardEdit(applyBoardHistorySnapshot(board, action, "before"), false);
    setBoardHistory((current) => ({
      past: current.past.slice(0, -1),
      future: [action, ...current.future]
    }));
  }, [activeSession, applyBoardEdit, board, boardHistory.past, undoShared]);

  const redoEdit = useCallback((): void => {
    if (activeSession !== null) { redoShared(); return; }
    const action = boardHistory.future[0];
    if (action === undefined) return;
    const unaffectedIds = new Set(board.objects.filter((object) => !action.affectedIds.includes(object.id)).map((object) => object.id));
    if (action.after.some(({ object }) => unaffectedIds.has(object.id))) return;
    applyBoardEdit(applyBoardHistorySnapshot(board, action, "after"), false);
    setBoardHistory((current) => ({
      past: [...current.past, action],
      future: current.future.slice(1)
    }));
  }, [activeSession, applyBoardEdit, board, boardHistory.future, redoShared]);

  const canUndo = activeSession === null
    ? boardHistory.past.length > 0
    : realtime.status === "connected" && realtime.role !== "viewer" && realtime.sharedHistory.canUndo && realtime.queuedEditCount === 0 && !realtime.historyBusy;
  const canRedo = activeSession === null
    ? boardHistory.future.length > 0
    : realtime.status === "connected" && realtime.role !== "viewer" && realtime.sharedHistory.canRedo && realtime.queuedEditCount === 0 && !realtime.historyBusy;

  useWorkspaceKeyboardActions({ board, history: boardHistory, canUndo, canRedo, selectedIds: selectedObjectIds, isDirty, save: saveBoard, undo: undoEdit, redo: redoEdit, copy: copySelected, remove: deleteSelected, duplicate: duplicateSelected, paste: pasteObjects, select: selectObjects, move: moveObjects, setTool: setSelectedTool, readOnly: isReadOnlyViewer });

  const headerStatus = saveFailed
    ? "Save failed — retry XML download"
    : localSource === "session"
      ? `Live collaboration · ${realtime.role === "viewer" ? "Viewer (read-only)" : realtime.role === "editor" ? "Editor" : realtime.role === "owner" ? "Owner" : "Connecting"} · ${realtime.status}${realtime.queuedEditCount > 0 ? ` · ${realtime.queuedEditCount} edit(s) pending` : ""}`
      : isDirty
        ? "Unsaved local changes"
        : localSource === "opened"
          ? "Opened from your device"
          : "XML download started";
  const handleSignOut = (): void => {
    void signOut().then(() => { setIdentity(null); setCurrentOwnerId(null); })
      .catch((error: unknown) => setSessionFeedback(error instanceof Error ? error.message : "Sign out failed."));
  };
  const handleConnectGoogleMail = (): void => {
    void startGoogleMailConnect().then(({ authorizationUrl }) => window.location.assign(authorizationUrl))
      .catch((error: unknown) => setSessionFeedback(error instanceof Error ? error.message : "Could not start Gmail connection."));
  };
  const handleDisconnectGoogleMail = (): void => {
    void disconnectGoogleMail().then(() => {
      if (identity !== null) setGoogleMailState({ identityId: identity.id, status: { configured: true, connected: false } });
    })
      .catch((error: unknown) => setSessionFeedback(error instanceof Error ? error.message : "Could not disconnect Gmail."));
  };

  return (
    <div className="wb-app-layout">
      <WorkspaceSidebar
        onOpenTemplates={() => setIsTemplatePickerOpen(true)}
        email={identity?.email}
        onSignIn={() => { setSessionFeedback(null); setAuthDialogOpen(true); }}
        googleMail={googleMail}
        gmailActionDisabled={sessionBusy}
        onConnectGoogleMail={handleConnectGoogleMail}
        onDisconnectGoogleMail={handleDisconnectGoogleMail}
        signOutDisabled={activeSession !== null || sessionBusy}
        onSignOut={handleSignOut}
        activeSessionTitle={activeSession?.title ?? null}
        canManageSession={canManageSession}
        onStartSession={openStartSession}
        onRenameSession={() => {
          if (activeSession !== null) {
            setSessionTitleDraft(activeSession.title);
            setSessionDialog("rename");
          }
        }}
        onEndSession={openEndSession}
        isImporting={isImporting}
        fileInputRef={fileInputRef}
        onOpenBoardFile={openBoardFile}
        onSaveBoard={saveBoard}
        onNewBoard={requestNewBoard}
      />
      <main className="whiteboard-shell">
      <WorkspaceHeader title={board.title} titleDisabled={isImporting || isReadOnlyViewer} onTitleChange={updateTitle}
        isDirty={localSource === "session" ? saveFailed : isDirty || saveFailed} status={headerStatus} />

      {identity !== null && <WorkspaceAvailableSessions sessions={availableSessions} email={identity.email} busy={sessionBusy} onRejoin={(sessionId) => void rejoinSession(sessionId)} onDismiss={dismissAvailableSessions} />}
      {activeSession !== null && <WorkspacePresence participants={realtime.participants} />}

      {canManageSession && activeSession !== null && (googleMail?.connected
        ? <WorkspaceInvitations sessionId={activeSession.id} ownerConnected={realtime.status === "connected"} />
        : <div className="mx-4 my-2 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
          <span>{googleMail?.configured === false ? "Google OAuth must be configured on the API before invitations can be emailed." : "Connect Gmail from the workspace sidebar before inviting participants."}</span>
        </div>)}

      <WorkspaceToolbar
        selectedTool={selectedTool} setSelectedTool={setSelectedTool} readOnly={isReadOnlyViewer}
        activateEraserTool={activateEraserTool} activateTextTool={activateTextTool}
        selectedText={selectedToolbarText} updateText={updateText}
        stickyNoteFill={stickyNoteFill} setStickyNoteFill={setStickyNoteFill} stickyNoteShape={stickyNoteShape} setStickyNoteShape={setStickyNoteShape}
        penColor={penColor} setPenColor={setPenColor}
        penLineWeight={penLineWeight} setPenLineWeight={setPenLineWeight} isLineTool={isLineTool}
        lineColor={lineColor} setLineColor={setLineColor} lineLineWeight={lineLineWeight} setLineLineWeight={setLineLineWeight}
        connectorRouting={connectorRouting} setConnectorRouting={setConnectorRouting}
        lineStartArrow={lineStartArrow} setLineStartArrow={setLineStartArrow}
        lineEndArrow={lineEndArrow} setLineEndArrow={setLineEndArrow}
        showShapeStyle={showShapeStyle} currentShapeStroke={currentShapeStroke} chooseShapeStroke={chooseShapeStroke}
        currentShapeFill={currentShapeFill} chooseShapeFill={chooseShapeFill} currentShapeWeight={currentShapeWeight}
        chooseShapeLineWeight={chooseShapeLineWeight} canUndo={canUndo} canRedo={canRedo} undoEdit={undoEdit}
        redoEdit={redoEdit}
      />

      {(fileFeedback !== null || sessionFeedback !== null || realtimeFeedback !== null) && <div aria-label="Notifications" className="wb-notification-stack">
        {fileFeedback !== null && <WorkspaceFeedback kind={fileFeedback.kind} message={fileFeedback.message} onDismiss={() => setFileFeedback(null)} />}
        {sessionFeedback !== null && <WorkspaceFeedback kind="error" message={sessionFeedback} onDismiss={() => setSessionFeedback(null)} />}
        {realtimeFeedback !== null && <WorkspaceFeedback kind="error" message={realtimeFeedback} onDismiss={() => setRealtimeFeedback(null)} />}
      </div>}
      {activeSession !== null && realtime.queuedEditCount > 0 && <Button onClick={realtime.retryQueuedEdits} size="sm" variant="outline">Retry queued edits</Button>}
      <WorkspaceAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        onSuccess={(authIdentity) => {
          setIdentity(authIdentity);
          setSessionFeedback(null);
        }}
      />
      <WorkspaceSessionEndedDialog open={sessionEndedDialogOpen} onOpenChange={setSessionEndedDialogOpen} />

      <WorkspaceDialogs
        isTemplatePickerOpen={isTemplatePickerOpen}
        setIsTemplatePickerOpen={setIsTemplatePickerOpen}
        isImporting={isImporting}
        onChooseTemplate={requestTemplateBoard}
        sessionDialog={sessionDialog}
        setSessionDialog={setSessionDialog}
        sessionTitleDraft={sessionTitleDraft}
        setSessionTitleDraft={setSessionTitleDraft}
        onStartSession={startSession}
        onSaveSessionRename={saveSessionRename}
        onEndSession={(choice) => void endSession(choice)}
        endExportSequence={endExportSequence}
        sessionFeedback={sessionFeedback}
        sessionBusy={sessionBusy}
        pendingReplacement={pendingReplacement}
        setPendingReplacement={setPendingReplacement}
        onDiscardReplacement={handlePendingDiscard}
        onSaveReplacement={handlePendingSave}
        saveFailed={saveFailed}
      />

      <WorkspaceCanvasStage
        board={board}
        readOnly={isReadOnlyViewer}
        collaborators={realtime.participants}
        onCursorChange={realtime.publishCursor}
        editingTextId={editingTextId}
        lineColor={lineColor}
        lineLineWeight={lineLineWeight}
        connectorRouting={connectorRouting}
        lineStartArrow={lineStartArrow}
        lineEndArrow={lineEndArrow}
        onLineCommit={commitLine}
        onEraseCommit={commitErase}
        onShapeCommit={commitShape}
        onStickyNoteCreate={createStickyNote}
        onStickyNoteFillChange={updateStickyNoteFill}
        onStickyNoteShapeChange={updateStickyNoteShape}
        onStickyNoteTextChange={updateText}
        onShapeGeometryChange={updateShapeGeometry}
        onShapeSelect={handleShapeSelect}
        onSelectionChange={selectObjects}
        onObjectsMove={moveObjects}
        onObjectResize={resizeObject}
        onStrokeCommit={commitStroke}
        onUpdateWaypoints={updateWaypoints}
        onTextChange={(textId, value, geometry) => updateText(textId, { text: value, ...(geometry === undefined ? {} : { geometry }) })}
        onTextCreate={createText}
        onTextEditFinish={(textId) => setEditingTextId((current) => current === textId ? null : current)}
        onTextEditStart={beginTextEditing}
        onTextGeometryChange={updateTextGeometry}
        onTextSelect={handleTextSelect}
        penColor={penColor}
        penLineWeight={penLineWeight}
        shapeStrokeColor={shapeStrokeColor}
        shapeLineWeight={shapeLineWeight}
        shapeFill={shapeFill}
        selectedShapeId={selectedShapeId}
        selectedTextId={selectedTextId}
        selectedObjectIds={selectedObjectIds}
        selectedTool={selectedTool}
      />
      <footer className="wb-footer">Built-in templates · Save downloads an editable XML file · {activeSession === null ? "No cloud sync" : "Live session board revisions are stored on the Orbito server"}</footer>
      </main>
    </div>
  );
};

export { WhiteboardWorkspace };




