"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Button } from "@workspace/ui/primitives/button";
import { Input } from "@workspace/ui/primitives/input";
import { registerWithPassword } from "../../features/board/api-client";

const RegisterPage = (): ReactElement => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!email.trim() || !name.trim() || !password) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await registerWithPassword({
        email: email.trim(),
        name: name.trim(),
        password
      });
      const pendingInvite = window.sessionStorage.getItem("wb_invite_accept_after_auth");
      if (pendingInvite) {
        router.replace("/invite/accept");
        return;
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete registration.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-md p-8 border border-border rounded-xl bg-card shadow-lg flex flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Create your Orbito account</h1>
          <p className="text-sm text-muted-foreground">Start sketching, planning, and collaborating in real-time</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Full Name</span>
            <Input
              autoComplete="name"
              autoFocus
              disabled={busy}
              maxLength={100}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Muhammad Abdullah"
              required
              type="text"
              value={name}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Email</span>
            <Input
              autoComplete="email"
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
            <span>Password (min. 6 characters)</span>
            <Input
              autoComplete="new-password"
              disabled={busy}
              maxLength={128}
              minLength={6}
              onChange={(e) => setPassword(e.currentTarget.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Confirm Password</span>
            <Input
              autoComplete="new-password"
              disabled={busy}
              maxLength={128}
              minLength={6}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              placeholder="••••••••"
              required
              type="password"
              value={confirmPassword}
            />
          </label>

          {error && (
            <p aria-live="polite" className="text-sm p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
              {error}
            </p>
          )}

          <Button className="w-full mt-2" disabled={busy || !email.trim() || !name.trim() || !password} type="submit">
            {busy ? "Creating account…" : "Create Account"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-4">
          <span>Already have an account?</span>
          <Link className="font-semibold text-primary underline hover:text-primary/80 transition-colors" href={"/login" as Route}>
            Sign In
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

export default RegisterPage;
