"use client";

import type { ReactElement } from "react";
import { Button } from "@workspace/ui/primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@workspace/ui/primitives/dialog";

type WorkspaceSessionEndedDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

export const WorkspaceSessionEndedDialog = ({ open, onOpenChange }: WorkspaceSessionEndedDialogProps): ReactElement => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent aria-describedby="wb-session-ended-description" aria-labelledby="wb-session-ended-title">
      <DialogHeader>
        <h2 className="text-lg font-semibold" id="wb-session-ended-title">Live session ended</h2>
        <p className="text-sm text-muted-foreground" id="wb-session-ended-description">
          The owner ended this session. Your current board remains open as a local copy. Any edits that had not synced are only in this copy; download XML to keep it.
        </p>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)}>Continue with local board</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
