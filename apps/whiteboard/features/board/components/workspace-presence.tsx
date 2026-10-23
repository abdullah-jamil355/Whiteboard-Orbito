import type { ReactElement } from "react";
import type { CollaboratorPresence } from "@workspace/whiteboard";

const avatarColors = ["wb-avatar-rose", "wb-avatar-emerald", "wb-avatar-violet", "wb-avatar-amber", "wb-avatar-cyan", "wb-avatar-pink"] as const;

const initialsFor = (name: string): string => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();

export const WorkspacePresence = ({ participants }: Readonly<{ participants: readonly CollaboratorPresence[] }>): ReactElement | null => {
  if (participants.length === 0) return null;
  return (
    <div aria-label="Live participants" className="wb-live-presence" role="list">
      <span className="wb-live-presence-label">In this session</span>
      {participants.map((participant) => (
        <span
          aria-label={`${participant.name}, ${participant.role}, connected`}
          className="wb-live-participant"
          key={participant.clientId}
          role="listitem"
          title={`${participant.name} · ${participant.role}`}
        >
          <span aria-hidden="true" className={`wb-participant-avatar ${avatarColors[Math.abs(participant.clientId) % avatarColors.length] ?? "wb-avatar-violet"}`}>
            {initialsFor(participant.name) || "?"}
          </span>
          <span>{participant.name}</span>
          <span className="wb-participant-role">{participant.role}</span>
        </span>
      ))}
    </div>
  );
};
