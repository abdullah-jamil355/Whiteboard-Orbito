"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import Link from "next/link";
import { Button } from "@workspace/ui/primitives/button";
import { consumeSignInLink } from "../../../features/board/api-client";

const VerifyPage = (): ReactElement => {
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("Checking your Orbito sign-in link…");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    const linkToken = new URLSearchParams(url.hash.slice(1)).get("token");
    window.history.replaceState({}, "", window.location.pathname);
    void Promise.resolve().then(() => {
      if (linkToken) { setToken(linkToken); setMessage("Your one-time link is ready. Confirm below to sign in."); }
      else setMessage("This sign-in link is missing its token. Request a new one from Orbito.");
    });
  }, []);

  const verify = async (): Promise<void> => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await consumeSignInLink(token);
      const inviteSession = window.sessionStorage.getItem("wb_invite_accept_after_auth");
      if (inviteSession) { window.location.replace("/invite/accept"); return; }
      window.location.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not verify this sign-in link.");
      setBusy(false);
    }
  };

  return <main className="whiteboard-shell flex min-h-screen items-center justify-center p-6"><section aria-live="polite" className="rounded-lg border border-border bg-card p-6"><h1 className="text-lg font-semibold">Orbito sign-in</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p><div className="mt-4 flex gap-3"><Button disabled={!token || busy} onClick={() => void verify()}>{busy ? "Verifying…" : "Confirm sign-in"}</Button><Link className="inline-flex items-center text-sm underline" href="/">Return to Orbito</Link></div></section></main>;
};

export default VerifyPage;
