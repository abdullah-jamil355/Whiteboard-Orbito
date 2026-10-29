"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { Button } from "@workspace/ui/primitives/button";
import {
  createBoard, createBoardHistoryEdit, isShapeTool, renameBoard, serializeBoardXml,
  STICKY_NOTE_COLORS, WHITEBOARD_PALETTE, WorkspaceCanvasStage, WorkspaceDialogs,
  WorkspaceFeedback, WorkspaceToolbar, type ArrowHead, type Board, type BoardSession,
  type ConnectorRouting, type LineWeight, type StickyNoteShape, type WhiteboardTool
} from "@workspace/whiteboard";
import { useWorkspaceObjectActions } from "../use-workspace-object-actions";
import { useWorkspaceSessionActions } from "../use-workspace-session-actions";
import { useWorkspaceKeyboardActions } from "../use-workspace-keyboard-actions";
import { useWorkspaceFileActions } from "../use-workspace-file-actions";
import { useWorkspaceRealtime } from "../use-workspace-realtime";
import { downloadBoardXml } from "../board-xml-download";
import { getStoredIdentity, type VerifiedIdentity } from "../api-client";
import { WorkspaceAuthDialog } from "./workspace-auth-dialog";
import { WorkspaceAvailableSessions } from "./workspace-available-sessions";
import { WorkspaceInvitations } from "./workspace-invitations";
import { WorkspacePresence } from "./workspace-presence";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceSidebar } from "./workspace-sidebar";
import { WorkspaceSessionEndedDialog } from "./workspace-session-ended-dialog";
import { useWorkspaceMemberSessions } from "../use-workspace-member-sessions";
import { createWhiteboardId } from "../create-whiteboard-id";
import { useWorkspaceGoogleMail } from "../use-workspace-google-mail";
import { useWorkspaceHistory } from "../use-workspace-history";
import {
  getSelectedStickyNote,
  updateStickyNoteFillHelper,
  updateStickyNoteShapeHelper
} from "../workspace-sticky-note.helpers";

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
  const [identity, setIdentity] = useState<VerifiedIdentity | null>(() => getStoredIdentity());
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedDocumentXmlRef = useRef<string | null>(null);
  const dirtyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (dirtyTimerRef.current !== null) clearTimeout(dirtyTimerRef.current); }, []);
  const hasUnsavedCanvasContent = isDirty && board.objects.length > 0;
  const [realtimeFeedback, setRealtimeFeedback] = useState<string | null>(null);

  const { googleMail, handleConnectGoogleMail, handleDisconnectGoogleMail, handleSignOut } =
    useWorkspaceGoogleMail({ identity, setCurrentOwnerId, setIdentity, setSessionFeedback });

  const sessionActions = useWorkspaceSessionActions({
    board, isImporting, sessionBusy, activeSession, currentOwnerId, identity, sessionTitleDraft,
    savedDocumentXmlRef, setIsDirty, setLocalSource, setSessionTitleDraft, setActiveSession,
    setCurrentOwnerId, setAuthDialogOpen, setSessionFeedback, setSessionBusy, setSessionDialog,
    resetBoardHistory: () => resetBoardHistory(), downloadBoardXml, endExportSequence, setEndExportSequence
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

  const { boardHistory, canRedo, canUndo, redoEdit, resetBoardHistory, setBoardHistory, undoEdit } =
    useWorkspaceHistory({ activeSession, board, realtime, setBoard });

  const isReadOnlyViewer = activeSession !== null && realtime.role === "viewer";
  const applyBoardEdit = useCallback((nextBoard: Board, recordHistory = true): void => {
    if (activeSession !== null && !realtime.queueBoardEdit(board, nextBoard)) return;
    if (recordHistory && activeSession === null) {
      const edit = createBoardHistoryEdit(board, nextBoard);
      if (edit !== null) setBoardHistory((curr) => ({ past: [...curr.past, edit], future: [] }));
    }
    setBoard(nextBoard);
    try { setIsDirty(savedDocumentXmlRef.current === null || serializeBoardXml(nextBoard) !== savedDocumentXmlRef.current); }
    catch { setIsDirty(true); }
    setSaveFailed(false);
  }, [activeSession, board, realtime, setBoardHistory]);

  const replaceBoard = useCallback((nextBoard: Board, source: "new" | "opened" | "template" | "session"): void => {
    setBoard(nextBoard);
    savedDocumentXmlRef.current = source === "opened" || source === "session" ? serializeBoardXml(nextBoard) : null;
    setIsDirty(source !== "opened" && source !== "session");
    setLocalSource(source);
    setSaveFailed(false);
    setFileFeedback(source === "opened" ? { kind: "success", message: "Orbito project opened." } : source === "session" ? { kind: "success", message: "Server session board restored; edits sync through the Orbito server." } : null);
    setPendingReplacement(null);
    resetBoardHistory();
    setSelectedShapeId(null);
    setSelectedTextId(null);
    setSelectedObjectIds([]);
    setEditingTextId(null);
  }, [resetBoardHistory]);

  const { availableSessions, rejoinSession, dismissAvailableSessions } = useWorkspaceMemberSessions({
    activeSession, hasUnsavedCanvasContent, sessionBusy, replaceBoard, setActiveSession,
    setCurrentOwnerId, setIdentity, setSessionBusy, setSessionFeedback
  });

  const fileActions = useWorkspaceFileActions({
    board, savedDocumentXmlRef, activeSession, dirtyContent: hasUnsavedCanvasContent, pendingReplacement, replaceBoard,
    setPendingReplacement, setFileFeedback, setIsImporting, setIsTemplatePickerOpen, setIsDirty,
    setLocalSource, setSaveFailed
  });

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
  const selectedStickyNote = getSelectedStickyNote(board, selectedShape, selectedText);
  const selectedToolbarText = selectedStickyNote === null ? (selectedText?.type === "text" ? selectedText : null) : null;

  useWorkspaceKeyboardActions({ board, history: boardHistory, canUndo, canRedo, selectedIds: selectedObjectIds, isDirty, save: fileActions.saveBoard, undo: undoEdit, redo: redoEdit, copy: copySelected, remove: deleteSelected, duplicate: duplicateSelected, paste: pasteObjects, select: selectObjects, move: moveObjects, setTool: setSelectedTool, readOnly: isReadOnlyViewer });

  const headerStatus = saveFailed ? "Save failed — retry XML download"
    : localSource === "session" ? `Live collaboration · ${realtime.role === "viewer" ? "Viewer (read-only)" : realtime.role === "editor" ? "Editor" : realtime.role === "owner" ? "Owner" : "Connecting"} · ${realtime.status}${realtime.queuedEditCount > 0 ? ` · ${realtime.queuedEditCount} edit(s) pending` : ""}`
    : isDirty ? "Unsaved local changes" : localSource === "opened" ? "Opened from your device" : "XML download started";

  return (
    <div className="wb-app-layout">
      <WorkspaceSidebar
        activeSessionTitle={activeSession?.title ?? null} canManageSession={canManageSession}
        email={identity?.email} fileInputRef={fileInputRef} gmailActionDisabled={sessionBusy}
        googleMail={googleMail} isImporting={isImporting} onConnectGoogleMail={handleConnectGoogleMail}
        onDisconnectGoogleMail={handleDisconnectGoogleMail} onEndSession={openEndSession}
        onNewBoard={fileActions.requestNewBoard} onOpenBoardFile={fileActions.openBoardFile}
        onOpenTemplates={() => setIsTemplatePickerOpen(true)} onRenameSession={() => { if (activeSession) { setSessionTitleDraft(activeSession.title); setSessionDialog("rename"); } }}
        onSaveBoard={fileActions.saveBoard} onSignIn={() => { setSessionFeedback(null); setAuthDialogOpen(true); }}
        onSignOut={handleSignOut} onStartSession={openStartSession} signOutDisabled={activeSession !== null || sessionBusy}
      />
      <main className="whiteboard-shell">
        <WorkspaceHeader isDirty={localSource === "session" ? saveFailed : isDirty || saveFailed} onTitleChange={(t) => applyBoardEdit(renameBoard(board, t))} status={headerStatus} title={board.title} titleDisabled={isImporting || isReadOnlyViewer} />
        {identity !== null && <WorkspaceAvailableSessions busy={sessionBusy} email={identity.email} onDismiss={dismissAvailableSessions} onRejoin={(id) => void rejoinSession(id)} sessions={availableSessions} />}
        {activeSession !== null && <WorkspacePresence participants={realtime.participants} />}
        {canManageSession && activeSession !== null && <WorkspaceInvitations ownerConnected={realtime.status === "connected"} sessionId={activeSession.id} />}
        <WorkspaceToolbar
          activateEraserTool={activateEraserTool} activateTextTool={activateTextTool} canRedo={canRedo} canUndo={canUndo}
          chooseShapeFill={chooseShapeFill} chooseShapeLineWeight={chooseShapeLineWeight} chooseShapeStroke={chooseShapeStroke}
          connectorRouting={connectorRouting} currentShapeFill={currentShapeFill} currentShapeStroke={currentShapeStroke}
          currentShapeWeight={currentShapeWeight} isLineTool={isLineTool} lineColor={lineColor} lineEndArrow={lineEndArrow}
          lineLineWeight={lineLineWeight} lineStartArrow={lineStartArrow} penColor={penColor} penLineWeight={penLineWeight}
          readOnly={isReadOnlyViewer} redoEdit={redoEdit} selectedText={selectedToolbarText} selectedTool={selectedTool}
          setConnectorRouting={setConnectorRouting} setLineColor={setLineColor} setLineEndArrow={setLineEndArrow}
          setLineLineWeight={setLineLineWeight} setLineStartArrow={setLineStartArrow} setPenColor={setPenColor}
          setPenLineWeight={setPenLineWeight} setSelectedTool={setSelectedTool} setStickyNoteFill={setStickyNoteFill}
          setStickyNoteShape={setStickyNoteShape} showShapeStyle={showShapeStyle} stickyNoteFill={stickyNoteFill}
          stickyNoteShape={stickyNoteShape} undoEdit={undoEdit} updateText={updateText}
        />
        {(fileFeedback !== null || sessionFeedback !== null || realtimeFeedback !== null) && <div aria-label="Notifications" className="wb-notification-stack">
          {fileFeedback !== null && <WorkspaceFeedback kind={fileFeedback.kind} message={fileFeedback.message} onDismiss={() => setFileFeedback(null)} />}
          {sessionFeedback !== null && <WorkspaceFeedback kind="error" message={sessionFeedback} onDismiss={() => setSessionFeedback(null)} />}
          {realtimeFeedback !== null && <WorkspaceFeedback kind="error" message={realtimeFeedback} onDismiss={() => setRealtimeFeedback(null)} />}
        </div>}
        {activeSession !== null && realtime.queuedEditCount > 0 && <Button onClick={realtime.retryQueuedEdits} size="sm" variant="outline">Retry queued edits</Button>}
        <WorkspaceAuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} onSuccess={(authId) => { setIdentity(authId); setCurrentOwnerId(authId.id); setSessionFeedback(null); }} />
        <WorkspaceSessionEndedDialog open={sessionEndedDialogOpen} onOpenChange={setSessionEndedDialogOpen} />
        <WorkspaceDialogs
          endExportSequence={endExportSequence} isImporting={isImporting} isTemplatePickerOpen={isTemplatePickerOpen}
          onChooseTemplate={fileActions.requestTemplateBoard} onDiscardReplacement={fileActions.handlePendingDiscard}
          onEndSession={(choice) => void endSession(choice)} onSaveReplacement={fileActions.handlePendingSave}
          onSaveSessionRename={saveSessionRename} onStartSession={startSession} pendingReplacement={pendingReplacement}
          saveFailed={saveFailed} sessionBusy={sessionBusy} sessionDialog={sessionDialog} sessionFeedback={sessionFeedback}
          sessionTitleDraft={sessionTitleDraft} setIsTemplatePickerOpen={setIsTemplatePickerOpen} setPendingReplacement={setPendingReplacement}
          setSessionDialog={setSessionDialog} setSessionTitleDraft={setSessionTitleDraft}
        />
        <WorkspaceCanvasStage
          board={board} collaborators={realtime.participants} connectorRouting={connectorRouting} editingTextId={editingTextId}
          lineColor={lineColor} lineEndArrow={lineEndArrow} lineLineWeight={lineLineWeight} lineStartArrow={lineStartArrow}
          onCursorChange={realtime.publishCursor} onEraseCommit={commitErase} onLineCommit={commitLine} onObjectsMove={moveObjects}
          onObjectResize={resizeObject} onSelectionChange={selectObjects} onShapeCommit={commitShape} onShapeGeometryChange={updateShapeGeometry}
          onShapeSelect={handleShapeSelect} onStickyNoteCreate={createStickyNote}
          onStickyNoteFillChange={(id, f) => updateStickyNoteFillHelper(id, f, objectActions.updateShapeStyle)}
          onStickyNoteShapeChange={(s, k) => updateStickyNoteShapeHelper(s, k, objectActions.updateShapeGeometry)}
          onStickyNoteTextChange={updateText} onStrokeCommit={commitStroke}
          onTextChange={(id, val, geo) => updateText(id, { text: val, ...(geo ? { geometry: geo } : {}) })}
          onTextCreate={createText} onTextEditFinish={(id) => setEditingTextId((curr) => curr === id ? null : curr)}
          onTextEditStart={beginTextEditing} onTextGeometryChange={updateTextGeometry} onTextSelect={handleTextSelect}
          onUpdateWaypoints={updateWaypoints} penColor={penColor} penLineWeight={penLineWeight} readOnly={isReadOnlyViewer}
          selectedObjectIds={selectedObjectIds} selectedShapeId={selectedShapeId} selectedTextId={selectedTextId} selectedTool={selectedTool}
          shapeFill={shapeFill} shapeLineWeight={shapeLineWeight} shapeStrokeColor={shapeStrokeColor}
        />
        <footer className="wb-footer">Built-in templates · Save downloads an editable XML file · {activeSession === null ? "No cloud sync" : "Live session board revisions are stored on the Orbito server"}</footer>
      </main>
    </div>
  );
};

export { WhiteboardWorkspace };
