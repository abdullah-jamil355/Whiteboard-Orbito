"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Button } from "@workspace/ui/primitives/button";
import { Input } from "@workspace/ui/primitives/input";
import { cancelInvitation, createInvitation, listInvitations, listSessionParticipants, removeSessionParticipant, type ApiInvitation, type ApiParticipant } from "../api-client";

type Props = Readonly<{ sessionId: string; ownerConnected: boolean }>;
export const WorkspaceInvitations = ({ sessionId, ownerConnected }: Props): ReactElement => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"" | "editor" | "viewer">("");
  const [invitations, setInvitations] = useState<readonly ApiInvitation[]>([]);
  const [participants, setParticipants] = useState<readonly ApiParticipant[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (): Promise<void> => {
    const [invitationResult, participantResult] = await Promise.all([listInvitations(sessionId), listSessionParticipants(sessionId)]);
    setInvitations(invitationResult.invitations);
    setParticipants(participantResult.members);
  }, [sessionId]);
  useEffect(() => {
    void Promise.resolve().then(refresh).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load invitations."));
  }, [refresh]);
  const invite = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!email.trim() || busy) return;
    if (role === "") {
      setMessage("Choose Editor or Viewer for this invitation.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await createInvitation(sessionId, { email: email.trim(), role: role as "editor" | "viewer" });
      setEmail("");
      if (result.invitationUrl) {
        setGeneratedLink(result.invitationUrl);
      }
      setMessage(result.delivered ? "Invitation emailed. Direct invite link also ready below:" : "Invitation link generated! Copy and share the link below with your participant:");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create invitation.");
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (invitationId: string): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      await cancelInvitation(sessionId, invitationId);
      setMessage("Invitation canceled.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not cancel invitation.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (participant: ApiParticipant): Promise<void> => {
    if (!window.confirm(`Remove ${participant.displayName} from this session? They will need a new invitation to rejoin.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await removeSessionParticipant(sessionId, participant.identityId);
      setMessage(`${participant.displayName} was removed from the session.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove this participant.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="wb-invitations">
      <summary className="cursor-pointer font-medium">Invite participants</summary>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => void invite(event)}>
        <label className="min-w-56 flex-1">
          Email address
          <Input autoComplete="email" maxLength={254} onChange={(event) => setEmail(event.currentTarget.value)} type="email" value={email} />
        </label>
        <label>
          Role
          <select className="mt-1 block h-10 rounded-md border border-input bg-background px-3" onChange={(event) => setRole(event.currentTarget.value as "" | "editor" | "viewer")} required value={role}>
            <option value="">Choose role</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <Button disabled={busy || email.trim().length === 0} type="submit">Create invite link</Button>
      </form>
      {message && <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">{message}</p>}
      {generatedLink && (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-sm flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground text-xs">Direct Invite Link:</span>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(generatedLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {copied ? "Copied! ✓" : "Copy Link"}
            </Button>
          </div>
          <code className="block select-all break-all rounded bg-background p-2 font-mono text-xs text-muted-foreground border border-border">
            {generatedLink}
          </code>
        </div>
      )}
      <h3 className="mt-4 font-medium">Participants</h3>
      <ul className="mt-2 space-y-2">
        <li className="flex flex-wrap items-center justify-between gap-2">
          <span>You · Owner · {ownerConnected ? "Connected" : "Disconnected"}</span>
        </li>
        {participants.map((participant) => (
          <li className="flex flex-wrap items-center justify-between gap-2" key={participant.identityId}>
            <span>{participant.displayName} ({participant.email}) · {participant.role} · {participant.connected ? "Connected" : "Disconnected"}</span>
            <Button disabled={busy} onClick={() => void remove(participant)} size="sm" variant="outline">Remove</Button>
          </li>
        ))}
        {participants.length === 0 && <li className="text-muted-foreground">No participants have joined yet.</li>}
      </ul>
      {invitations.length > 0 && (
        <ul className="mt-3 space-y-2">
          {invitations.map((invitation) => (
            <li className="flex flex-wrap items-center justify-between gap-2" key={invitation.id}>
              <span>{invitation.email} · {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleTimeString()}</span>
              <Button disabled={busy} onClick={() => void cancel(invitation.id)} size="sm" variant="outline">Cancel</Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">Invitations are private, single-use, valid for 10 minutes, and do not reserve a participant seat. A removed member must accept a new invitation to rejoin.</p>
    </details>
  );
};
