"use client";

import { useEffect, useState, type ReactElement } from "react";
import { X } from "lucide-react";
import { Button } from "@workspace/ui/primitives/button";
import type { ApiActiveSession } from "../api-client";

type Props = Readonly<{
  sessions: readonly ApiActiveSession[];
  email: string | undefined;
  busy: boolean;
  onRejoin: (sessionId: string) => void;
  onDismiss: () => void;
}>;

export const WorkspaceAvailableSessions = ({ sessions, email, busy, onRejoin, onDismiss }: Props): ReactElement | null => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessions.length === 0) return;
    const timer = setTimeout(() => {
      setDismissed(true);
      onDismiss();
    }, 10000);
    return () => clearTimeout(timer);
  }, [sessions, onDismiss]);

  if (dismissed || sessions.length === 0) return null;

  return (
    <section aria-label="Your active sessions" className="wb-available-sessions flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 flex-wrap flex-1">
        <span className="text-sm font-medium">Active sessions for {email}:</span>
        {sessions.map((session) => (
          <Button disabled={busy} key={session.id} onClick={() => onRejoin(session.id)} size="sm" variant="outline">
            Rejoin {session.title} · Live collaboration
          </Button>
        ))}
      </div>
      <Button
        aria-label="Dismiss active sessions"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
        onClick={() => {
          setDismissed(true);
          onDismiss();
        }}
        size="icon"
        title="Dismiss"
        variant="ghost"
      >
        <X size={14} />
      </Button>
    </section>
  );
};
