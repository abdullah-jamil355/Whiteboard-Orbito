"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { Button } from "@workspace/ui/primitives/button";
import { Input } from "@workspace/ui/primitives/input";
import { acceptInvitation, getVerifiedIdentity, readDevelopmentMailbox, requestSignInLink, type VerifiedIdentity } from "../../../features/board/api-client";

const InviteAcceptancePage = (): ReactElement => {
  const [token, setToken] = useState<string | null>(null);
  const [identity, setIdentity] = useState<VerifiedIdentity | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("Checking invitation…");
  const [signInUrl, setSignInUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fragmentToken = new URLSearchParams(url.hash.slice(1)).get("token");
    const savedToken = fragmentToken ?? window.sessionStorage.getItem("wb_pending_invitation_token");
    window.history.replaceState({}, "", url.pathname);
    if (savedToken) window.sessionStorage.setItem("wb_pending_invitation_token", savedToken);
    void Promise.resolve().then(() => getVerifiedIdentity()).then((verified) => {
      setToken(savedToken);
      setIdentity(verified);
      if (verified) setEmail(verified.email);
      setMessage(savedToken ? verified ? "Review your name, then accept this invitation." : "Sign in with the invited email address to continue." : "Invitation link is invalid.");
    });
  }, []);

  const requestSignIn = async (): Promise<void> => {
    if (busy || !token) return;
    setBusy(true); setMessage("Requesting a one-time sign-in link…");
    try {
      window.sessionStorage.setItem("wb_invite_accept_after_auth", "true");
      await requestSignInLink(email);
      const inbox = await readDevelopmentMailbox(email);
      const signInMessage = [...inbox.messages].reverse().find((item) => item.kind === "sign-in");
      if (signInMessage?.verificationUrl) setSignInUrl(signInMessage.verificationUrl);
      setMessage("Verify this email address, then return here to accept the invitation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not request sign-in."); }
    finally { setBusy(false); }
  };

  const accept = async (): Promise<void> => {
    if (!token || !identity || displayName.trim().length === 0 || busy) return;
    setBusy(true); setMessage("Accepting invitation…");
    try {
      const { membership } = await acceptInvitation(token, displayName.trim());
      window.sessionStorage.removeItem("wb_pending_invitation_token");
      window.sessionStorage.removeItem("wb_invite_accept_after_auth");
      window.sessionStorage.setItem("wb_active_session_id", membership.sessionId);
      window.location.replace("/");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not accept the invitation."); setBusy(false); }
  };

  return (
    <main className="whiteboard-shell flex min-h-screen items-center justify-center p-6">
      <section aria-live="polite" className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Join Orbito session</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {token && !identity && (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              Invited email
              <Input autoComplete="email" maxLength={254} onChange={(event) => setEmail(event.currentTarget.value)} type="email" value={email} />
            </label>
            <Button disabled={busy || email.trim().length === 0} onClick={() => void requestSignIn()}>Send sign-in link</Button>
            {signInUrl && <p className="text-sm"><a className="underline" href={signInUrl}>Open local development inbox link</a></p>}
          </div>
        )}
        {token && identity && (
          <div className="mt-4 space-y-3">
            <p className="text-sm">Signed in as {identity.email}</p>
            <label className="block text-sm">
              Display name
              <Input autoComplete="name" maxLength={80} onChange={(event) => setDisplayName(event.currentTarget.value)} value={displayName} />
            </label>
            <Button disabled={busy || displayName.trim().length === 0} onClick={() => void accept()}>{busy ? "Joining…" : "Accept invitation"}</Button>
          </div>
        )}
        <div className="mt-4"><Link className="text-sm underline" href="/">Return to Orbito</Link></div>
      </section>
    </main>
  );
};
export default InviteAcceptancePage;
