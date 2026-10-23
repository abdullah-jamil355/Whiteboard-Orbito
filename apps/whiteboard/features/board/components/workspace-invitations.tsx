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
      await createInvitation(sessionId, { email: email.trim(), role: role as "editor" | "viewer" });
      setEmail("");
      setMessage("Private invitation sent. It expires in 10 minutes.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send invitation.");
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
        <Button disabled={busy || email.trim().length === 0} type="submit">Send one-time invite</Button>
      </form>
      {message && <p aria-live="polite" className="mt-2 text-muted-foreground">{message}</p>}
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
