"use client";

import { useState, type ReactElement } from "react";
import { Button } from "@workspace/ui/primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@workspace/ui/primitives/dialog";
import { Input } from "@workspace/ui/primitives/input";
import { readDevelopmentMailbox, requestSignInLink } from "../api-client";

type AuthDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

export const WorkspaceAuthDialog = ({ open, onOpenChange }: AuthDialogProps): ReactElement => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendLink = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    setVerificationUrl(null);
    try {
      await requestSignInLink(email);
      setMessage("If this address can sign in, a verification link has been sent.");
      try {
        const mailbox = await readDevelopmentMailbox(email);
        const newest = [...mailbox.messages].reverse().find((item) => item.kind === "sign-in");
        if (newest?.verificationUrl) setVerificationUrl(newest.verificationUrl);
      } catch {
        // Production and non-loopback API environments intentionally have no local inbox.
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request a sign-in link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="wb-auth-description" aria-labelledby="wb-auth-title">
        <DialogHeader>
          <h2 className="text-lg font-semibold" id="wb-auth-title">Verify your email</h2>
          <p className="text-sm text-muted-foreground" id="wb-auth-description">A verified Orbito identity is required to create and manage a server session. We will send a one-time sign-in link.</p>
        </DialogHeader>
        <label className="wb-session-field"><span>Email address</span><Input autoComplete="email" autoFocus maxLength={254} onChange={(event) => setEmail(event.currentTarget.value)} type="email" value={email} /></label>
        {message && <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p>}
        {verificationUrl && <a className="text-sm underline" href={verificationUrl}>Open local development sign-in link</a>}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">Close</Button>
          <Button disabled={busy || email.trim().length === 0} onClick={() => void sendLink()}>{busy ? "Sending…" : "Email me a sign-in link"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
