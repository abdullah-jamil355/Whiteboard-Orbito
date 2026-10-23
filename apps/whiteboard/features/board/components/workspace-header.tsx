"use client";

import type { ReactElement } from "react";
import { Shapes } from "lucide-react";
import { Input } from "@workspace/ui/primitives/input";

type Props = Readonly<{
  title: string;
  titleDisabled: boolean;
  onTitleChange: (title: string) => void;
  isDirty: boolean;
  status: string;
}>;

export const WorkspaceHeader = ({ title, titleDisabled, onTitleChange, isDirty, status }: Props): ReactElement => (
  <header className="wb-header">
    <div className="wb-header-title-group">
      <span aria-hidden="true" className="wb-header-board-mark"><Shapes size={20} /></span>
      <div className="wb-header-title-copy">
        <Input aria-label="Board title" className="wb-board-title" disabled={titleDisabled} maxLength={120}
          onChange={(event) => onTitleChange(event.currentTarget.value)} value={title} />
      </div>
    </div>
    <div className="wb-header-account">
      <div className="wb-local-state" aria-live="polite">
        <span className={`wb-local-dot${isDirty ? " wb-local-dot-dirty" : ""}`} aria-hidden="true" />{status}
      </div>
    </div>
  </header>
);
