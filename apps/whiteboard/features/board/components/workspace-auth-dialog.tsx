"use client";

import { useState, type ReactElement } from "react";
import { Button } from "@workspace/ui/primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@workspace/ui/primitives/dialog";
import { Input } from "@workspace/ui/primitives/input";
import { loginWithPassword, registerWithPassword, type VerifiedIdentity } from "../api-client";

type AuthDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (identity: VerifiedIdentity) => void;
}>;

type AuthMode = "login" | "register";

export const WorkspaceAuthDialog = ({ open, onOpenChange, onSuccess }: AuthDialogProps): ReactElement => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const resetForm = (): void => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setMessage(null);
    setIsError(false);
    setBusy(false);
  };

  const switchMode = (nextMode: AuthMode): void => {
    setMode(nextMode);
    setMessage(null);
    setIsError(false);
  };

  const handleLogin = async (): Promise<void> => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setMessage(null);
    setIsError(false);
    try {
      const result = await loginWithPassword({ email: email.trim(), password });
      onSuccess?.(result.identity);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Invalid email or password.");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (): Promise<void> => {
    if (!email.trim() || !name.trim() || !password) return;
    if (password.length < 6) {
      setIsError(true);
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setIsError(true);
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage(null);
    setIsError(false);
    try {
      const result = await registerWithPassword({
        email: email.trim(),
        name: name.trim(),
        password
      });
      onSuccess?.(result.identity);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not complete registration.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) resetForm(); }}>
      <DialogContent aria-describedby="wb-auth-description" aria-labelledby="wb-auth-title" className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4 border-b border-border pb-3">
            <button
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${mode === "login" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => switchMode("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${mode === "register" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => switchMode("register")}
              type="button"
            >
              Create Account
            </button>
          </div>
          <h2 className="text-lg font-semibold pt-2" id="wb-auth-title">
            {mode === "login" ? "Sign in to Orbito" : "Create your Orbito account"}
          </h2>
          <p className="text-sm text-muted-foreground" id="wb-auth-description">
            {mode === "login"
              ? "Enter your email and password to access your whiteboards."
              : "Enter your details to create an account and start collaborating."}
          </p>
        </DialogHeader>

        <form
          className="flex flex-col gap-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === "login") void handleLogin();
            else void handleRegister();
          }}
        >
          {mode === "register" && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>Full Name</span>
              <Input
                autoComplete="name"
                autoFocus
                disabled={busy}
                maxLength={100}
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Muhammad Abdullah"
                required
                type="text"
                value={name}
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Email address</span>
            <Input
              autoComplete="email"
              autoFocus={mode !== "register"}
              disabled={busy}
              maxLength={254}
              onChange={(event) => setEmail(event.currentTarget.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Password</span>
            <Input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={busy}
              maxLength={128}
              minLength={6}
              onChange={(event) => setPassword(event.currentTarget.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </label>

          {mode === "register" && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>Confirm Password</span>
              <Input
                autoComplete="new-password"
                disabled={busy}
                maxLength={128}
                minLength={6}
                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                placeholder="••••••••"
                required
                type="password"
                value={confirmPassword}
              />
            </label>
          )}

          {message && (
            <p
              aria-live="polite"
              className={`text-sm p-2 rounded-md ${isError ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-muted text-muted-foreground"}`}
            >
              {message}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            {mode === "login" ? (
              <span>
                Don&apos;t have an account?{" "}
                <button className="underline text-primary hover:text-primary/80" onClick={() => switchMode("register")} type="button">
                  Create an account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button className="underline text-primary hover:text-primary/80" onClick={() => switchMode("login")} type="button">
                  Sign In
                </button>
              </span>
            )}
          </div>

          <DialogFooter className="mt-2 flex items-center justify-between gap-2">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            {mode === "login" ? (
              <Button disabled={busy || !email.trim() || !password} type="submit">
                {busy ? "Signing in…" : "Sign In"}
              </Button>
            ) : (
              <Button disabled={busy || !email.trim() || !name.trim() || !password} type="submit">
                {busy ? "Creating account…" : "Create Account"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
