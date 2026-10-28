"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@workspace/ui/primitives/button";
import { Input } from "@workspace/ui/primitives/input";
import { acceptInvitation, getVerifiedIdentity, type VerifiedIdentity } from "../../../features/board/api-client";

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
      if (verified) {
        setEmail(verified.email);
        setDisplayName(verified.name || verified.email.split("@")[0] || "Collaborator");
      }
      setMessage(savedToken ? verified ? "Review your name, then accept this invitation." : "Sign in with the invited email address to continue." : "Invitation link is invalid.");
    });
  }, []);

  const accept = async (): Promise<void> => {
    if (!token || !identity || displayName.trim().length === 0 || busy) return;
    setBusy(true);
    setMessage("Accepting invitation…");
    try {
      const { membership } = await acceptInvitation(token, displayName.trim());
      window.sessionStorage.removeItem("wb_pending_invitation_token");
      window.sessionStorage.removeItem("wb_invite_accept_after_auth");
      window.sessionStorage.setItem("wb_active_session_id", membership.sessionId);
      window.location.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not accept the invitation.");
      setBusy(false);
    }
  };

  return (
    <main className="whiteboard-shell flex min-h-screen items-center justify-center p-6">
      <section aria-live="polite" className="w-full max-w-md rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Join Orbito session</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {token && !identity && (
          <div className="mt-4 flex flex-col gap-3">
            <Link
              className="w-full"
              href={"/login" as Route}
              onClick={() => window.sessionStorage.setItem("wb_invite_accept_after_auth", "true")}
            >
              <Button className="w-full">Sign In to Continue</Button>
            </Link>
            <Link
              className="w-full"
              href={"/register" as Route}
              onClick={() => window.sessionStorage.setItem("wb_invite_accept_after_auth", "true")}
            >
              <Button className="w-full" variant="outline">Create Account</Button>
            </Link>
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
