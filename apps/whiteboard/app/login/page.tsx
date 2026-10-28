"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Button } from "@workspace/ui/primitives/button";
import { Input } from "@workspace/ui/primitives/input";
import { loginWithPassword } from "../../features/board/api-client";

const LoginPage = (): ReactElement => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithPassword({ email: email.trim(), password });
      const pendingInvite = window.sessionStorage.getItem("wb_invite_accept_after_auth");
      if (pendingInvite) {
        router.replace("/invite/accept");
        return;
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-md p-8 border border-border rounded-xl bg-card shadow-lg flex flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back to Orbito</h1>
          <p className="text-sm text-muted-foreground">Sign in to access your whiteboards and live sessions</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Email</span>
            <Input
              autoComplete="email"
              autoFocus
              disabled={busy}
              maxLength={254}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Password</span>
            <Input
              autoComplete="current-password"
              disabled={busy}
              maxLength={128}
              onChange={(e) => setPassword(e.currentTarget.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </label>

          {error && (
            <p aria-live="polite" className="text-sm p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              {error}
            </p>
          )}

          <Button className="w-full mt-2" disabled={busy || !email.trim() || !password} type="submit">
            {busy ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-4">
          <span>Don&apos;t have an account?</span>
          <Link className="font-semibold text-primary underline hover:text-primary/80 transition-colors" href={"/register" as Route}>
            Create an account
          </Link>
        </div>

        <div className="text-center">
          <Link className="text-xs text-muted-foreground hover:underline" href="/">
            ← Return to Whiteboard
          </Link>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
