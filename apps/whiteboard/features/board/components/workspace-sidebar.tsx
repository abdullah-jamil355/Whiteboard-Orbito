"use client";

import type { ChangeEvent, ReactElement, RefObject } from "react";
import Link from "next/link";
import { FileUp, Home, LayoutTemplate, LogIn, LogOut, Mail, Plus, Radio, Save, Shapes } from "lucide-react";
import { Button } from "@workspace/ui/primitives/button";
import type { GoogleMailStatus } from "../api-client";

type Props = Readonly<{
  onOpenTemplates: () => void;
  email: string | undefined;
  onSignIn: () => void;
  googleMail: GoogleMailStatus | null;
  gmailActionDisabled: boolean;
  onConnectGoogleMail: () => void;
  onDisconnectGoogleMail: () => void;
  signOutDisabled: boolean;
  onSignOut: () => void;
  activeSessionTitle: string | null;
  canManageSession: boolean;
  onStartSession: () => void;
  onRenameSession: () => void;
  onEndSession: () => void;
  isImporting: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onOpenBoardFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onSaveBoard: () => boolean;
  onNewBoard: () => void;
}>;

export const WorkspaceSidebar = (props: Props): ReactElement => {
  const {
    onOpenTemplates, email, onSignIn, googleMail, gmailActionDisabled, onConnectGoogleMail,
    onDisconnectGoogleMail, signOutDisabled, onSignOut,
    activeSessionTitle, canManageSession, onStartSession, onRenameSession, onEndSession,
    isImporting, fileInputRef, onOpenBoardFile, onSaveBoard, onNewBoard
  } = props;
  const boardLocked = isImporting || activeSessionTitle !== null;

  return (
    <aside className="wb-sidebar" aria-label="Orbito workspace">
      <div className="wb-sidebar-scroll">
        <div className="wb-sidebar-brand">
          <span className="wb-brand-mark" aria-hidden="true"><Shapes size={20} /></span>
          <span className="wb-sidebar-brand-name"><strong>Orbito</strong></span>
        </div>

        <nav aria-label="Workspace navigation" className="wb-sidebar-nav">
          <Link aria-label="Home" aria-current="page" className="wb-sidebar-link wb-sidebar-link-active" href="/" title="Home">
            <Home aria-hidden="true" /><span className="wb-sidebar-label">Home</span>
          </Link>
          <Button aria-label="Templates" className="wb-sidebar-link" onClick={onOpenTemplates} size="sm" title="Templates" variant="ghost">
            <LayoutTemplate aria-hidden="true" /><span className="wb-sidebar-label">Templates</span>
          </Button>
        </nav>

        <section className="wb-sidebar-section" aria-label="Board actions">
          <p className="wb-sidebar-section-title">Board</p>
          {activeSessionTitle === null ? (
            <Button className="wb-sidebar-link wb-sidebar-primary" disabled={isImporting} onClick={onStartSession} size="sm" title="Start live session" variant="default">
              <Radio aria-hidden="true" /><span className="wb-sidebar-label">Start live session</span>
            </Button>
          ) : (
            <div className="wb-sidebar-session" title={`Active live session: ${activeSessionTitle}`}>
              <Radio aria-hidden="true" /><span className="wb-sidebar-label">Live</span>
              {canManageSession && <span className="wb-sidebar-session-actions">
                <Button onClick={onRenameSession} size="sm" title="Rename session" variant="ghost">Rename</Button>
                <Button onClick={onEndSession} size="sm" title="End session" variant="ghost">End</Button>
              </span>}
            </div>
          )}
          <input accept=".Orbito,.whiteboard,.xml,application/xml,text/xml" aria-label="Open Orbito XML project"
            disabled={boardLocked} hidden onChange={onOpenBoardFile} ref={fileInputRef} type="file" />
          <Button className="wb-sidebar-link" disabled={boardLocked} onClick={() => fileInputRef.current?.click()} size="sm" title="Open XML" variant="ghost">
            <FileUp aria-hidden="true" /><span className="wb-sidebar-label">{isImporting ? "Opening…" : "Open XML"}</span>
          </Button>
          <Button className="wb-sidebar-link" disabled={isImporting} onClick={onSaveBoard} size="sm" title="Save XML" variant="ghost">
            <Save aria-hidden="true" /><span className="wb-sidebar-label">Save XML</span>
          </Button>
          <Button className="wb-sidebar-link" disabled={boardLocked} onClick={onNewBoard} size="sm" title="New board" variant="ghost">
            <Plus aria-hidden="true" /><span className="wb-sidebar-label">New board</span>
          </Button>
        </section>
      </div>

      <div className="wb-sidebar-bottom">
        {email === undefined ? (
          <Button className="wb-sidebar-link" onClick={onSignIn} size="sm" title="Sign in" variant="ghost">
            <LogIn aria-hidden="true" /><span className="wb-sidebar-label">Sign in</span>
          </Button>
        ) : (
          <>
            <div className="wb-sidebar-profile" title={email}>
              <span className="wb-sidebar-avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</span>
              <span className="wb-sidebar-label wb-sidebar-profile-email">{email}</span>
            </div>
            {googleMail?.configured && (
              googleMail.connected ? (
                <Button className="wb-sidebar-link" disabled={gmailActionDisabled} onClick={onDisconnectGoogleMail} size="sm"
                  title={`Disconnect Gmail (${googleMail.email})`} variant="ghost">
                  <Mail aria-hidden="true" /><span className="wb-sidebar-label">Gmail connected</span>
                </Button>
              ) : (
                <Button className="wb-sidebar-link" disabled={gmailActionDisabled} onClick={onConnectGoogleMail} size="sm"
                  title="Connect Gmail to automatically email invitations" variant="ghost">
                  <Mail aria-hidden="true" /><span className="wb-sidebar-label">Connect Gmail</span>
                </Button>
              )
            )}
            <Button className="wb-sidebar-link" disabled={signOutDisabled} onClick={onSignOut} size="sm" title="Sign out" variant="ghost">
              <LogOut aria-hidden="true" /><span className="wb-sidebar-label">Sign out</span>
            </Button>
          </>
        )}
      </div>
    </aside>
  );
};
