"use client";

import type { ReactElement } from "react";
import { Button } from "@workspace/ui/primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@workspace/ui/primitives/dialog";
import { Input } from "@workspace/ui/primitives/input";
import { listBoardTemplates, type Board } from "..";

type TemplateId = ReturnType<typeof listBoardTemplates>[number]["id"];
type PendingReplacement = Readonly<{ board: Board; source: "new" | "opened" | "template" }> | null;

export type WorkspaceDialogsProps = Readonly<{
  isTemplatePickerOpen: boolean;
  setIsTemplatePickerOpen: (open: boolean) => void;
  isImporting: boolean;
  onChooseTemplate: (id: TemplateId) => void;
  sessionDialog: "start" | "rename" | "end" | null;
  setSessionDialog: (value: "start" | "rename" | "end" | null) => void;
  sessionTitleDraft: string;
  setSessionTitleDraft: (value: string) => void;
  onStartSession: () => void;
  onSaveSessionRename: () => void;
  onEndSession: (choice: "download" | "confirm" | "without-download") => void;
  endExportSequence: number | null;
  sessionFeedback: string | null;
  sessionBusy: boolean;
  pendingReplacement: PendingReplacement;
  setPendingReplacement: (value: PendingReplacement) => void;
  onDiscardReplacement: () => void;
  onSaveReplacement: () => void;
  saveFailed: boolean;
}>;

export const WorkspaceDialogs = ({
  isTemplatePickerOpen, setIsTemplatePickerOpen, isImporting, onChooseTemplate,
  sessionDialog, setSessionDialog, sessionTitleDraft, setSessionTitleDraft,
  onStartSession, onSaveSessionRename, onEndSession, endExportSequence, sessionFeedback,
  pendingReplacement, setPendingReplacement, onDiscardReplacement, onSaveReplacement, saveFailed, sessionBusy
}: WorkspaceDialogsProps): ReactElement => (
  <>
    <Dialog open={isTemplatePickerOpen} onOpenChange={setIsTemplatePickerOpen}>
      <DialogContent aria-describedby="wb-template-description" aria-labelledby="wb-template-title" className="wb-template-dialog">
        <DialogHeader>
          <h2 className="text-lg font-semibold" id="wb-template-title">Choose a board template</h2>
          <p className="text-sm text-muted-foreground" id="wb-template-description">Each choice creates a separate Orbito copy. Your edits will not change the built-in template.</p>
        </DialogHeader>
        <div className="wb-template-grid">
          {listBoardTemplates().map((template) => (
            <Button className="wb-template-card" key={template.id} disabled={isImporting} onClick={() => onChooseTemplate(template.id)} variant="outline">
              <span aria-hidden="true" className={`wb-template-preview wb-template-preview-${template.preview}`}><span /><span /><span /><span /></span>
              <span className="wb-template-copy"><strong>{template.name}</strong><span>{template.description}</span></span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={sessionDialog !== null} onOpenChange={(open) => { if (!open) setSessionDialog(null); }}>
      <DialogContent aria-describedby="wb-session-description" aria-labelledby="wb-session-title" className="wb-session-dialog">
        <DialogHeader>
          <h2 className="text-lg font-semibold" id="wb-session-title">{sessionDialog === "rename" ? "Rename live session" : sessionDialog === "end" ? "End live session" : "Start a live session"}</h2>
          <p className="text-sm text-muted-foreground" id="wb-session-description">{sessionDialog === "rename" ? "Only the session owner can change this title." : sessionDialog === "end" ? endExportSequence === null ? "Download the latest synced board before ending, or end without a download. Ending disconnects participants and removes session data." : `XML is ready from synced revision ${endExportSequence}. Confirm only if you kept the download; otherwise keep the session active.` : "The current board, including a blank board, template copy, or opened Orbito XML, will seed this live collaboration session. Sessions continue until the owner ends them."}</p>
        </DialogHeader>
        {sessionDialog === "end" ? <DialogFooter className="wb-session-end-actions">
          <Button disabled={sessionBusy} onClick={() => { setSessionDialog(null); }} variant="outline">{endExportSequence === null ? "Cancel" : "Keep session active"}</Button>
          <Button disabled={sessionBusy} onClick={() => onEndSession("without-download")} variant="destructive">{sessionBusy ? "Working…" : "Discard"}</Button>
          {endExportSequence === null
            ? <Button disabled={sessionBusy} onClick={() => onEndSession("download")}>{sessionBusy ? "Working…" : "Save"}</Button>
            : <>
              <Button disabled={sessionBusy} onClick={() => onEndSession("download")} variant="outline">Download latest XML again</Button>
              <Button disabled={sessionBusy} onClick={() => onEndSession("confirm")}>{sessionBusy ? "Working…" : "Confirm End session"}</Button>
            </>}
        </DialogFooter> : <>
        <label className="wb-session-field"><span>Live board title</span><Input autoFocus maxLength={120} onChange={(event) => setSessionTitleDraft(event.currentTarget.value)} value={sessionTitleDraft} /></label>
        <DialogFooter>
          <Button onClick={() => setSessionDialog(null)} variant="outline">Cancel</Button>
          <Button disabled={sessionBusy || sessionTitleDraft.trim().length === 0} onClick={sessionDialog === "rename" ? onSaveSessionRename : onStartSession}>{sessionBusy ? "Working…" : sessionDialog === "rename" ? "Save title" : "Start session"}</Button>
        </DialogFooter>
        </>}
        {sessionDialog === "end" && sessionFeedback !== null && <p className="text-sm text-destructive" role="alert">{sessionFeedback}</p>}
      </DialogContent>
    </Dialog>
    <Dialog open={pendingReplacement !== null} onOpenChange={(open) => { if (!open) setPendingReplacement(null); }}>
      <DialogContent aria-describedby="wb-unsaved-description" aria-labelledby="wb-unsaved-title">
        <DialogHeader><h2 className="text-lg font-semibold" id="wb-unsaved-title">Unsaved changes</h2><p className="text-sm text-muted-foreground" id="wb-unsaved-description">Save your current board before replacing it, discard the unsaved changes, or cancel and keep working on this board.</p></DialogHeader>
        <DialogFooter>
          <Button onClick={() => setPendingReplacement(null)} variant="outline">Cancel</Button>
          <Button onClick={onDiscardReplacement} variant="destructive">Discard changes</Button>
          <Button onClick={onSaveReplacement}>Save and continue</Button>
        </DialogFooter>
        {saveFailed && <p className="text-sm text-destructive" role="alert">Save failed. The current board is still open; retry the download or cancel.</p>}
      </DialogContent>
    </Dialog>
  </>
);

